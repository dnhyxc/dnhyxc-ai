/**
 * 知识库右侧助手状态：含「未保存草稿 ephemeral / 保存后迁入 import-transcript / 清空草稿联动」等逻辑。
 * 完整设计文档：`docs/knowledge/knowledge-assistant-complete.md`；持久化专题：`docs/knowledge/knowledge-assistant-ephemeral-persistence.md`。
 */
import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import {
	// 新增：按知识条目标识拉取该文章下“全部”助手会话（用于历史记录抽屉）。
	// 说明：原先只需要 getAssistantSessionByKnowledgeArticle（最近会话），多会话后必须有列表接口。
	createAssistantSession,
	getAssistantSessionByKnowledgeArticle,
	getAssistantSessionDetail,
	// 新增：多会话列表接口封装（GET /assistant/sessions/for-knowledge）。
	getAssistantSessionsByKnowledgeArticle,
	importAssistantTranscript,
	patchAssistantSessionKnowledgeArticle,
	stopAssistantStream,
} from '@/service';
import type { Message } from '@/types/chat';
import {
	ASSISTANT_SSE_USER_ABORT_MARKER,
	streamAssistantSse,
} from '@/utils/assistantSse';

/**
 * 对外暴露的 AssistantStore 公开 API。
 *
 * 目的：避免在 `useStore()` 返回类型推断时把 class 的 private 成员（如 activeState/canonicalKey 等）
 * 带入导出类型，触发 TS4094（导出匿名类类型包含私有属性）。
 */
export interface AssistantStoreApi {
	activeDocumentKey: string;
	// 兼容字段：仍保留“文档 → sessionId”的旧映射。
	// 注意：多会话场景下，一个文档可能对应多个 session；因此真正的“当前会话”应以 activeSessionByDocument 为准。
	/** 兼容旧字段：仍保留，但仅作为“当前文档当前会话”的快捷映射（多会话场景请使用 activeSessionByDocument） */
	sessionByDocument: Record<string, string>;
	// 新增：文档（canonical）→ 当前激活会话 id。
	// 作用：切换历史会话只更新这个指针，不会中断其它会话的流式输出。
	/** 文档（canonical）→ 当前激活的会话 id（多会话） */
	activeSessionByDocument: Record<string, string>;
	// 新增：文档（canonical）→ 历史会话列表（给 UI 抽屉/列表展示）。
	// 约定：按 updatedAt 倒序（最近活跃在前）；若后端时间解析异常，前端仍会做兜底排序。
	/** 文档（canonical）→ 历史会话列表（按 updatedAt 倒序） */
	sessionsByDocument: Record<
		string,
		Array<{
			sessionId: string;
			title: string | null;
			createdAt: string;
			updatedAt: string;
		}>
	>;
	knowledgeAssistantPersistenceAllowed: boolean;

	readonly sessionId: string | null;
	// 新增：当前文档激活的会话 id（多会话主入口）。
	readonly activeSessionId: string | null;
	// 新增：当前文档的历史会话列表（供 UI 直接使用）。
	readonly sessionListForActiveDocument: Array<{
		sessionId: string;
		title: string | null;
		createdAt: string;
		updatedAt: string;
	}>;
	readonly messages: Message[];
	readonly isHistoryLoading: boolean;
	readonly isSending: boolean;
	readonly loadError: string | null;
	readonly abortStream: (() => void) | null;
	readonly isStreaming: boolean;

	setKnowledgeAssistantPersistenceAllowed(allowed: boolean): void;
	clearAssistantStateOnKnowledgeDraftReset(
		syncActiveDocumentKey?: string | null,
		options?: { stopBackend?: boolean },
	): void;

	activateForDocument(documentKey: string): Promise<void>;
	remapAssistantSessionDocumentKey(fromKey: string, toKey: string): void;
	getSessionIdForDocumentKey(documentKey: string): string | null;
	persistKnowledgeArticleBindingOnServer(
		sessionId: string,
		knowledgeArticleId: string,
	): Promise<void>;
	fetchSessionMessages(): Promise<void>;
	flushEphemeralTranscriptIfNeeded(
		cloudArticleId: string,
		fromDocumentKey: string,
		toDocumentKey: string,
	): Promise<void>;
	ensureSessionForCurrentDocument(): Promise<string | null>;
	// 新增：强制创建新会话（用于“新对话”按钮）。
	createNewSessionForCurrentDocument(): Promise<string | null>;
	// 新增：切换到指定会话（用于历史记录切换）。
	switchSessionForCurrentDocument(sessionId: string): Promise<void>;
	// 新增：刷新当前文档的会话列表（用于抽屉打开时自动刷新）。
	refreshSessionListForCurrentDocument(): Promise<void>;
	sendMessage(
		raw?: string,
		options?: { extraUserContentForModel?: string },
	): Promise<void>;
	stopGenerating(): Promise<void>;

	isStreamingForDocumentKey(documentKey: string): boolean;
	scheduleEphemeralFlushAfterStreaming(
		cloudArticleId: string,
		fromDocumentKey: string,
		toDocumentKey: string,
	): void;
}

function readToken(): string {
	if (typeof window === 'undefined') {
		return '';
	}
	return localStorage.getItem('token') || '';
}

function mapApiMessagesToUi(
	rows: Array<{
		id: string;
		role: string;
		content: string;
		createdAt: string;
	}>,
): Message[] {
	const out: Message[] = [];
	for (const m of rows) {
		if (m.role !== 'user' && m.role !== 'assistant') continue;
		out.push({
			id: m.id,
			chatId: m.id,
			role: m.role as 'user' | 'assistant',
			content: m.content ?? '',
			timestamp: new Date(m.createdAt),
			createdAt: new Date(m.createdAt),
			isStreaming: false,
		});
	}
	return out;
}

/** 从与编辑器一致的 documentKey 解析知识条目标识（去掉 `__trash-*` 等与回收站分栏相关的后缀） */
function knowledgeArticleBindingFromDocumentKey(documentKey: string): string {
	const sep = '__trash-';
	const i = documentKey.indexOf(sep);
	return (i >= 0 ? documentKey.slice(0, i) : documentKey).trim();
}

/** 将当前内存消息转为后端 `import-transcript` 所需的行序列（含未结束流式时的已生成片段） */
function buildImportTranscriptLinesFromMessages(
	messages: Message[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
	const lines: Array<{ role: 'user' | 'assistant'; content: string }> = [];
	for (const m of messages) {
		if (m.role !== 'user' && m.role !== 'assistant') continue;
		lines.push({ role: m.role, content: m.content ?? '' });
	}
	// 与后端 `ImportAssistantTranscriptDto` 的 `@ArrayMaxSize(200)` 对齐；超出时只迁入「最近」200 条（时间顺序保留，即末尾窗口）
	return lines.slice(-200);
}

/** 不落库多轮：已进入 UI 的轮次（排除末尾空占位助手） */
function buildEphemeralContextTurnsFromMessages(
	messages: Message[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
	const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
	for (const m of messages) {
		if (m.role !== 'user' && m.role !== 'assistant') continue;
		if (m.role === 'assistant' && m.isStreaming && !(m.content ?? '').trim()) {
			continue;
		}
		out.push({ role: m.role, content: m.content ?? '' });
	}
	return out.slice(-120);
}

/**
 * 知识库右侧「通用助手」：与后端 `AssistantController` 对齐，按文档维度缓存 sessionId。
 */
export class AssistantStore {
	/** 当前知识文档标识（与 MarkdownEditor documentIdentity 一致） */
	activeDocumentKey = '';
	/**
	 * 文档维度的助手运行态（切换文档不应打断其它文档的流式输出）。
	 * 说明：历史/发送/流式都绑定到 documentKey；activeDocumentKey 只是当前 UI 的“指针”。
	 */
	private stateByDocument: Record<
		string,
		{
			/**
			 * 注意：多会话后，document 维度 state 仅承载 ephemeral 与“文档级”控制字段；
			 * 持久化会话的 messages/isSending/isHistoryLoading 等改到 stateBySession。
			 */
			sessionId: string | null;
			messages: Message[];
			isHistoryLoading: boolean;
			isSending: boolean;
			loadError: string | null;
			abortStream: (() => void) | null;
			/**
			 * ephemeral（不落库）流式停止句柄：
			 * - 后端在 `ephemeral=true` 的 SSE 开始阶段下发 `meta.streamId`
			 * - 前端保存到该字段，供“停止生成/清空草稿”调用 `/assistant/stop` 使用
			 */
			ephemeralStreamId: string | null;
			/** 是否已尝试拉取过历史（避免频繁 activate 时重复请求） */
			historyHydrated: boolean;
			/**
			 * 首次保存时若仍在流式输出：先不迁入（避免绑定不完整对话），等流式结束后再 flush。
			 * 该字段挂在 state 上，确保在 `fromKey → toKey` remap 时会随 state 一起迁移。
			 */
			pendingEphemeralFlush: {
				cloudArticleId: string;
				fromDocumentKey: string;
				toDocumentKey: string;
			} | null;
		}
	> = {};
	/** 文档 key → 已创建的助手 sessionId（内存级，换篇后仍保留映射） */
	sessionByDocument: Record<string, string> = {};

	// 新增：文档 → 当前激活会话映射（用于多会话切换“指针”）。
	// 设计意图：切换会话只改这个映射，不会触碰其它会话的流式状态（避免切换时 stop/abort）。
	/** 文档 key → 当前激活的会话 id */
	activeSessionByDocument: Record<string, string> = {};

	// 新增：文档 → 会话列表缓存（用于历史记录抽屉展示）。
	// 注意：该列表只存“会话元信息”（title/createdAt/updatedAt），不含 messages（messages 走 getSessionDetail）。
	/** 文档 key → 该文章下全部会话列表（用于历史记录） */
	sessionsByDocument: Record<
		string,
		Array<{
			sessionId: string;
			title: string | null;
			createdAt: string;
			updatedAt: string;
		}>
	> = {};

	// 新增：会话维度运行态（每个 sessionId 独立一份）。
	// 关键收益：支持“多个会话同时流式”（并发 SSE），且不会发生 messages 串写/互相覆盖。
	/** 会话维度运行态：切换会话不应打断其它会话的流式输出 */
	private stateBySession: Record<
		string,
		{
			// 会话 id：键即 sessionId，这里留一份便于调试/断言
			sessionId: string;
			// 会话消息列表：含 user/assistant 气泡与 streaming 增量
			messages: Message[];
			// 会话历史加载：切换到该会话首次加载详情时会置 true
			isHistoryLoading: boolean;
			// 会话发送中：仅阻止“同一会话”重入，不影响其它会话并发发送
			isSending: boolean;
			// 会话错误：用于 UI toast/占位回填
			loadError: string | null;
			// 会话 SSE abort：用于“停止生成”，且只会中断当前会话
			abortStream: (() => void) | null;
		}
	> = {};

	/**
	 * 知识库：是否允许助手会话写入后端（已保存云端 id / 本地文件 / 回收站预览为 true；新建未保存云端草稿为 false）。
	 * 为 false 时使用 ephemeral SSE，不落库；首次保存后由 `flushEphemeralTranscriptIfNeeded` 迁入。
	 */
	knowledgeAssistantPersistenceAllowed = true;

	constructor() {
		makeAutoObservable(this);
	}

	/**
	 * 注意：知识区的 `documentKey` 可能携带 `__trash-*` 等 nonce 后缀（用于 UI 分栏/视图身份）。
	 * 流式输出与会话应绑定到稳定的条目标识，否则切换回来会落到“新 key”的空 state，表现为只剩「思考中…」。
	 */
	private canonicalKey(documentKey: string): string {
		const raw = (documentKey ?? '').trim();
		if (!raw) return '';
		return knowledgeArticleBindingFromDocumentKey(raw) || raw;
	}

	private ensureState(documentKey: string): {
		sessionId: string | null;
		messages: Message[];
		isHistoryLoading: boolean;
		isSending: boolean;
		loadError: string | null;
		abortStream: (() => void) | null;
		ephemeralStreamId: string | null;
		historyHydrated: boolean;
		pendingEphemeralFlush: {
			cloudArticleId: string;
			fromDocumentKey: string;
			toDocumentKey: string;
		} | null;
	} {
		// 统一规范 documentKey
		const key = this.canonicalKey(documentKey);
		if (!key) {
			// 没有 key 时给一个临时态，避免 getter 报错；但业务上仍会在发送前提示「文档未就绪」
			return {
				sessionId: null,
				messages: [],
				isHistoryLoading: false,
				isSending: false,
				loadError: null,
				abortStream: null,
				ephemeralStreamId: null,
				historyHydrated: false,
				pendingEphemeralFlush: null,
			};
		}
		if (!this.stateByDocument[key]) {
			this.stateByDocument[key] = {
				sessionId: null,
				messages: [],
				isHistoryLoading: false,
				isSending: false,
				loadError: null,
				abortStream: null,
				ephemeralStreamId: null,
				historyHydrated: false,
				pendingEphemeralFlush: null,
			};
		}
		return this.stateByDocument[key];
	}

	/**
	 * 查询某个文档（按 canonicalKey）当前是否仍有流式消息。
	 * 用于首次保存时判断是否应当“延迟迁入”。
	 */
	isStreamingForDocumentKey(documentKey: string): boolean {
		const key = this.canonicalKey(documentKey);
		const state = key ? this.stateByDocument[key] : null;
		return Boolean(state?.messages?.some((m) => m.isStreaming));
	}

	/**
	 * 首次保存时若仍在流式：登记一个“待迁入”任务，等流式结束后自动 flush 到新知识条目。
	 *
	 * 注意：
	 * - 这不会中断 SSE。
	 * - 会将当前 state 标记为 historyHydrated，避免保存后 activate 拉取服务端空历史覆盖 UI。
	 */
	scheduleEphemeralFlushAfterStreaming(
		cloudArticleId: string,
		fromDocumentKey: string,
		toDocumentKey: string,
	): void {
		const state = this.ensureState(fromDocumentKey);
		runInAction(() => {
			state.pendingEphemeralFlush = {
				cloudArticleId,
				fromDocumentKey,
				toDocumentKey,
			};
			// 保存后会进入“允许持久化”模式，此时如果立刻 hydrate，服务端还没迁入会返回空，容易覆盖 UI
			// 标记为已 hydrate，等流式结束后的 flush 完成后再由逻辑显式对齐（可选 fetch）
			state.historyHydrated = true;
		});
	}

	private get activeState() {
		// 说明：activeState 是所有 getter（messages/isSending/abortStream 等）的统一数据源“指针”。
		// 目标：在不影响旧功能（ephemeral）前提下，引入“会话维度 state”（支持多 session 并发流式）。
		//
		// ephemeral（不落库）仍走 document 维度 state
		if (!this.knowledgeAssistantPersistenceAllowed) {
			// 当不允许持久化时，后端不会创建 session；因此只能使用 document 维度 state 来保存消息与流式增量。
			return this.ensureState(this.activeDocumentKey);
		}
		// 持久化：优先使用当前文档的 activeSessionId；若缺失则退回 document 维度（兼容旧路径）。
		const key = this.canonicalKey(this.activeDocumentKey);
		// activeSid：当前文档（canonical）下用户正在查看的会话 id；切换历史会话时只更新此映射。
		const activeSid = (key && this.activeSessionByDocument[key]) || null;
		if (activeSid) {
			// 当存在 activeSid 时，所有 UI getter 直接指向该会话的独立 state（支持并发流式，不互相覆盖）。
			return this.ensureSessionState(activeSid);
		}
		// 兜底：极端情况下没有 activeSid（例如旧数据/初始化阶段），继续走旧的 document 维度 state，避免 getter 崩溃。
		return this.ensureState(this.activeDocumentKey);
	}

	/** 当前文档对应的助手会话 id；首次发送前可能为空 */
	get sessionId(): string | null {
		// 兼容：sessionId 是历史字段（单会话时代直接挂在 document state 上）。
		// 多会话后，真正的“当前会话”由 activeSessionId 决定；这里仍返回 activeSessionId 以保持外部使用语义。
		if (!this.knowledgeAssistantPersistenceAllowed) {
			// ephemeral：没有会话概念，沿用旧字段。
			return this.activeState.sessionId;
		}
		// 持久化：返回当前文档激活的会话 id。
		return this.activeSessionId;
	}
	private set sessionId(value: string | null) {
		// 兼容：仅用于旧路径；多会话下请使用 activeSessionByDocument + stateBySession。
		// 注意：这里只写 document 维度 state，是为了不影响旧调用；新逻辑不依赖这里的值。
		this.ensureState(this.activeDocumentKey).sessionId = value;
	}

	get activeSessionId(): string | null {
		if (!this.knowledgeAssistantPersistenceAllowed) {
			// ephemeral（短暂的）：没有会话列表，退回 document state 的 sessionId（通常为 null）。
			return this.ensureState(this.activeDocumentKey).sessionId ?? null;
		}
		// canonical 文档 key：确保同一文章（去掉 __trash-* 后缀）映射到同一桶。
		const docKey = this.canonicalKey(this.activeDocumentKey);
		if (!docKey) return null;
		// 返回当前文档激活的会话 id（多会话主指针）。
		return this.activeSessionByDocument[docKey] ?? null;
	}

	get sessionListForActiveDocument(): Array<{
		sessionId: string;
		title: string | null;
		createdAt: string;
		updatedAt: string;
	}> {
		// 取当前文档的 canonical key（避免 trash 后缀导致会话列表“看起来丢失”）。
		const docKey = this.canonicalKey(this.activeDocumentKey);
		if (!docKey) return [];
		// 返回缓存的历史会话列表；若尚未拉取则为空数组。
		return this.sessionsByDocument[docKey] ?? [];
	}

	get messages(): Message[] {
		return this.activeState.messages;
	}
	private set messages(value: Message[]) {
		this.activeState.messages = value;
	}

	get isHistoryLoading(): boolean {
		return this.activeState.isHistoryLoading;
	}
	private set isHistoryLoading(value: boolean) {
		this.activeState.isHistoryLoading = value;
	}

	get isSending(): boolean {
		return this.activeState.isSending;
	}
	private set isSending(value: boolean) {
		this.activeState.isSending = value;
	}

	get loadError(): string | null {
		return this.activeState.loadError;
	}
	private set loadError(value: string | null) {
		this.activeState.loadError = value;
	}

	/** 最近一次流式请求的取消函数（仅当前 activeDocumentKey） */
	get abortStream(): (() => void) | null {
		return this.activeState.abortStream;
	}
	private set abortStream(value: (() => void) | null) {
		this.activeState.abortStream = value;
	}

	private ensureSessionState(sessionId: string): {
		sessionId: string;
		messages: Message[];
		isHistoryLoading: boolean;
		isSending: boolean;
		loadError: string | null;
		abortStream: (() => void) | null;
	} {
		// sid：清理输入，避免空格导致 stateBySession 产生“幽灵 key”。
		const sid = (sessionId ?? '').trim();
		if (!sid) {
			// 不应到此：调用方应确保持久化模式下 sessionId 存在。
			// 这里返回一个临时态用于兜底，避免 getter（messages 等）直接抛错导致 UI 崩溃。
			// 不应到此；兜底返回一个临时态避免 getter 崩溃
			return {
				sessionId: '',
				messages: [],
				isHistoryLoading: false,
				isSending: false,
				loadError: null,
				abortStream: null,
			};
		}
		if (!this.stateBySession[sid]) {
			// 首次见到该 sessionId：创建一份独立运行态。
			// 注意：messages/isSending/abortStream 都是“会话级”的，这正是支持并发流式的关键。
			this.stateBySession[sid] = {
				sessionId: sid,
				messages: [],
				isHistoryLoading: false,
				isSending: false,
				loadError: null,
				abortStream: null,
			};
		}
		return this.stateBySession[sid]!;
	}

	setKnowledgeAssistantPersistenceAllowed(allowed: boolean): void {
		runInAction(() => {
			this.knowledgeAssistantPersistenceAllowed = allowed;
		});
	}

	/**
	 * 知识编辑区执行「清空 / 新建草稿」时：中断流式、清空当前文档下的内存对话与 session 映射。
	 * 用于未保存云端草稿等 `documentKey` 不变、不会再次触发 `activateForDocument` 的场景，避免助手气泡残留。
	 *
	 * @param syncActiveDocumentKey 清空后左侧 `documentKey` 已与 props 一致时传入，用于同步 `activeDocumentKey`（避免仅因 `editingId` 变 null 触发 `activateForDocument` 二次拉会话）；不传则不改写 `activeDocumentKey`。
	 */
	clearAssistantStateOnKnowledgeDraftReset(
		syncActiveDocumentKey?: string | null,
		options?: { stopBackend?: boolean },
	): void {
		// 获取当前激活的文档 key（如 knowledge 编辑页的左右联动用于唯一标识 editor）
		const rawKey = this.activeDocumentKey;
		// 规范化 key，确保一致性（如 draft-new/已保存/本地 Markdown 等统一处理）
		const key = rawKey ? this.canonicalKey(rawKey) : '';
		// 拿到当前文档对应的助手状态对象，如不存在则为 null
		const state = key ? this.ensureState(key) : null;
		// 记录当前会话的 sessionId（持久化模式），用于必要时 stop
		const prevSid = state?.sessionId ?? null;
		// 记录当前 SSE 流的 ephemeral streamId（未保存草稿/本地临时态）。
		const prevStreamId = state?.ephemeralStreamId ?? null;

		state?.abortStream?.();
		if (state) {
			state.abortStream = null;
		}

		runInAction(() => {
			if (key) {
				delete this.stateByDocument[key];
				delete this.sessionByDocument[key];
			}
			const next = syncActiveDocumentKey?.trim();
			if (next) {
				this.activeDocumentKey = next;
				// 确保新 key 有 state，避免后续 getter 指向空引用
				this.ensureState(next);
			}
		});

		// 清空内容/新建草稿属于“本地重置编辑态”，默认只需要中断前端 SSE 并清理内存 state。
		// 若无条件调用后端 stop，会把“清空内容”误变成“停止生成”，并影响“已保存条目清空但流式继续”的体验。
		// 仅在调用方显式要求时才通知后端停止。
		if (options?.stopBackend) {
			// 优先 stop 持久化 session；无 session 时尝试 stop ephemeral streamId
			if (prevSid) {
				void stopAssistantStream({ sessionId: prevSid }).catch(() => {});
			} else if (prevStreamId) {
				void stopAssistantStream({ streamId: prevStreamId }).catch(() => {});
			}
		}
	}

	get isStreaming(): boolean {
		return this.messages.some((m) => m.isStreaming);
	}

	/** 切换知识条目时调用：内存映射或服务端按条目标识拉取历史，无则保持空会话待首轮发送 */
	async activateForDocument(documentKey: string): Promise<void> {
		// nextKey：来自 UI 的 documentKey（可能包含 __trash-* 等后缀），先 trim 规避空格误触发。
		const nextKey = (documentKey ?? '').trim();
		// 空 key 直接返回：避免 canonicalKey 计算与后续请求出现无意义的 warning/toast。
		if (!nextKey) return;
		// docKey：canonicalKey 后的稳定 key，用于把同一篇文章的多种视图身份收敛到同一桶。
		const docKey = this.canonicalKey(nextKey);

		// 切换文档时不要打断其它文档的流式输出，只切换 active 指针
		runInAction(() => {
			// 写入 activeDocumentKey：UI “当前文章”指针切换。
			this.activeDocumentKey = nextKey;
			// ensureState：保证文档维度 state 存在（ephemeral/兼容字段在这里承载）。
			this.ensureState(docKey);
		});

		// state：当前文档维度 state（用于去重、ephemeral、以及 historyHydrated 标记）。
		const state = this.ensureState(docKey);

		// 若不允许持久化（ephemeral）：不走后端会话列表/历史拉取，保持旧行为。
		if (!this.knowledgeAssistantPersistenceAllowed) {
			return;
		}

		// 未登录：不请求后端，避免无 token 的 401 打扰用户。
		if (!readToken()) {
			return;
		}

		// 并发去重：UI 层 effect 可能因 `activeDocumentKey` 被写入而二次触发 activate。
		// 若同一 canonical 文档正在拉取历史/会话，则直接复用进行中的结果，避免重复请求
		// `/assistant/session/for-knowledge?knowledgeArticleId=...`。
		if (state.isHistoryLoading) {
			return;
		}

		// 若该文档已经 hydrate 过历史/会话，且目前已有内容或正在流式，则不重复请求
		if (state.historyHydrated) {
			return;
		}

		// bindingId：从 documentKey 提取的文章绑定 id（去掉 __trash-* 等后缀）。
		const bindingId = knowledgeArticleBindingFromDocumentKey(nextKey);

		// 计算应该激活的会话：优先已有 active → 其次旧 sessionByDocument → 兜底走旧 for-knowledge
		// sid：最终要展示/加载的会话 id。
		let sid =
			// 优先：文档当前激活会话（用户可能刚切过历史会话）
			this.activeSessionByDocument[docKey] ??
			// 其次：兼容旧字段（文档 → 单会话 id）
			this.sessionByDocument[docKey] ??
			null;

		if (!sid) {
			// 兼容旧：for-knowledge 返回最近会话 + 消息
			if (bindingId) {
				runInAction(() => {
					// 置 loading：用于 UI 展示“正在加载对话…”
					state.isHistoryLoading = true;
				});
				try {
					// 旧接口：只返回最近会话 + 消息（用于兜底 hydrate）。
					const res = await getAssistantSessionByKnowledgeArticle(bindingId);
					const data = res.data;
					if (data?.session?.sessionId) {
						sid = data.session.sessionId;
						// sstate：会话维度 state（多会话的 messages/isSending/abortStream 都放这里）。
						const sstate = this.ensureSessionState(sid);
						runInAction(() => {
							// 兼容字段写入：让旧路径仍能拿到 sessionId
							this.sessionByDocument[docKey] = sid!;
							// 激活会话指针：UI getter 之后将指向该会话
							this.activeSessionByDocument[docKey] = sid!;
							// 写入消息：用 mapApiMessagesToUi 把后端结构映射为 UI Message[]
							sstate.messages = mapApiMessagesToUi(data.messages ?? []);
							// 关闭会话级 loading：保证切到该会话后不会一直显示 loading
							sstate.isHistoryLoading = false;
						});
					}
				} catch {
					// Toast 由 http 层处理
				} finally {
					runInAction(() => {
						// 关闭文档级 loading：避免 UI 卡在“加载中…”
						state.isHistoryLoading = false;
						// 标记 hydrate 完成：避免重复 activate 时再次请求
						state.historyHydrated = true;
					});
				}
			} else {
				runInAction(() => {
					// 无 bindingId（无法请求后端）：直接标记 hydrate，保持空会话待首轮发送。
					state.historyHydrated = true;
				});
			}
			return;
		}
		// 设置 active session，并拉取详情填充消息（若之前已加载过则复用内存）
		runInAction(() => {
			// 兼容字段：同步记录“当前文档的 sessionId”，便于其它旧逻辑读取
			this.sessionByDocument[docKey] = sid!;
			// 多会话指针：切换到该 session（不会影响其它 session 的 state）
			this.activeSessionByDocument[docKey] = sid!;
		});
		// sstate：当前激活会话的独立 state（并发流式时每个 session 都有自己的 messages/isSending）
		const sstate = this.ensureSessionState(sid);
		if (
			// 若已存在消息：说明此前已加载过，无需重复拉取
			sstate.messages.length > 0 ||
			// 若正在发送/加载：避免并发重复请求覆盖
			sstate.isSending ||
			sstate.isHistoryLoading
		) {
			runInAction(() => {
				// 标记 hydrate：避免 activate 再次进入请求流程
				state.historyHydrated = true;
			});
			return;
		}
		runInAction(() => {
			// 会话级 loading：用于 UI 切到该会话时显示加载态（若 UI 依赖）
			sstate.isHistoryLoading = true;
		});

		try {
			// 拉取会话详情（含全量 messages）：用于历史切换/首次加载
			const res = await getAssistantSessionDetail(sid);
			const payload = res.data;
			if (!payload?.session) {
				runInAction(() => {
					// 后端返回 session=null：说明会话不存在（可能被级联删除），清理缓存映射
					delete this.sessionByDocument[docKey];
					delete this.activeSessionByDocument[docKey];
					// 清空该会话消息：避免 UI 展示旧内容
					sstate.messages = [];
				});
				return;
			}
			runInAction(() => {
				// 将后端 messages 映射为 UI Message[] 并写入会话 state
				sstate.messages = mapApiMessagesToUi(payload.messages ?? []);
			});
		} catch {
			// Toast 由 http 层处理
			runInAction(() => {
				delete this.sessionByDocument[docKey];
				delete this.activeSessionByDocument[docKey];
				sstate.messages = [];
			});
		} finally {
			runInAction(() => {
				// 关闭会话级 loading：保证 UI 恢复可交互
				sstate.isHistoryLoading = false;
				// 标记文档 hydrate：避免重复 activate 重复请求
				state.historyHydrated = true;
			});
		}
	}

	/**
	 * 文档维度 key 变更时（如草稿首次保存得到真实 id、本地首次落盘），迁移 session 映射，避免助手历史丢失。
	 */
	remapAssistantSessionDocumentKey(fromKey: string, toKey: string): void {
		if (!fromKey || !toKey || fromKey === toKey) return;
		const from = this.canonicalKey(fromKey);
		const to = this.canonicalKey(toKey);
		if (!from || !to || from === to) {
			runInAction(() => {
				if (this.activeDocumentKey === fromKey) {
					this.activeDocumentKey = toKey;
				}
			});
			return;
		}
		runInAction(() => {
			const sid = this.sessionByDocument[from];
			if (sid) {
				this.sessionByDocument[to] = sid;
				delete this.sessionByDocument[from];
			}
			const s = this.stateByDocument[from];
			if (s) {
				this.stateByDocument[to] = s;
				delete this.stateByDocument[from];
			}
			if (this.activeDocumentKey === fromKey) {
				this.activeDocumentKey = toKey;
			}
		});
	}

	/** 当前 documentKey 在内存中的 sessionId（供保存后改绑服务端条目标识等场景） */
	getSessionIdForDocumentKey(documentKey: string): string | null {
		const key = this.canonicalKey(documentKey);
		return this.sessionByDocument[key] ?? null;
	}

	/** 同步更新服务端「会话 ↔ 知识条目」绑定（草稿保存为正式 id、本地路径变更等） */
	async persistKnowledgeArticleBindingOnServer(
		sessionId: string,
		knowledgeArticleId: string,
	): Promise<void> {
		if (!readToken()) return;
		await patchAssistantSessionKnowledgeArticle(sessionId, {
			knowledgeArticleId,
		});
	}

	async fetchSessionMessages(): Promise<void> {
		// 兼容旧调用：默认取当前 activeDocumentKey
		const key = this.activeDocumentKey;
		if (!key) return;
		await this.fetchSessionMessagesForDocumentKey(key);
	}

	private async fetchSessionMessagesForDocumentKey(
		documentKey: string,
	): Promise<void> {
		const key = this.canonicalKey(documentKey);
		if (!key) return;
		const state = this.ensureState(key);
		if (!state.sessionId) return;

		const res = await getAssistantSessionDetail(state.sessionId);
		const payload = res.data;
		// 后端在会话已删除时返回 session: null（避免 404）；同步清掉本地缓存的旧 sessionId
		if (!payload?.session) {
			runInAction(() => {
				delete this.sessionByDocument[key];
				delete this.stateByDocument[key];
			});
			return;
		}
		if (!payload.messages) return;
		runInAction(() => {
			state.messages = mapApiMessagesToUi(payload.messages);
			state.historyHydrated = true;
		});
	}

	/**
	 * 新建云端知识首次保存成功时：把草稿阶段助手对话写入该条目对应会话。
	 * 须在将编辑态切到正式 `knowledgeArticleId` 之前调用，避免 `activate` 先拉空库覆盖界面。
	 */
	async flushEphemeralTranscriptIfNeeded(
		cloudArticleId: string,
		fromDocumentKey: string,
		toDocumentKey: string,
	): Promise<void> {
		if (!readToken()) return;
		// 兼容：保存过程中可能已经 remap 了 state（fromCanonical 被迁走），因此优先复用已有 state
		const from = this.canonicalKey(fromDocumentKey);
		const to = this.canonicalKey(toDocumentKey);
		const sourceState =
			(this.stateByDocument[from] ?? this.stateByDocument[to]) ||
			this.ensureState(fromDocumentKey);
		const lines = buildImportTranscriptLinesFromMessages(sourceState.messages);
		if (lines.length === 0) return;
		try {
			// 多会话下，为避免覆盖已有历史，迁入时优先新建一个会话作为“草稿对话”承载。
			// 不影响旧接口：后端仍支持不传 sessionId 的旧行为；这里只是更安全的默认策略。
			const created = await createAssistantSession({
				knowledgeArticleId: cloudArticleId,
				forceNew: true,
			});
			const targetSid = created.data?.sessionId;
			const res = await importAssistantTranscript({
				knowledgeArticleId: cloudArticleId,
				...(targetSid ? { sessionId: targetSid } : {}),
				lines,
			});
			const sid = res.data?.sessionId;
			if (!sid) return;
			runInAction(() => {
				delete this.sessionByDocument[from];
				this.sessionByDocument[to] = sid;
				this.activeSessionByDocument[to] = sid;
				const sstate = this.ensureSessionState(sid);
				// 迁入后为避免额外请求，直接复用当前 UI 消息快照作为该新会话的初始展示
				sstate.messages = sourceState.messages.map((m) => ({
					...m,
					isStreaming: false,
				}));
				const toState = this.ensureState(to);
				toState.historyHydrated = true;
				toState.pendingEphemeralFlush = null;
				if (this.activeDocumentKey === fromDocumentKey) {
					this.activeDocumentKey = toDocumentKey;
				}
			});
			void this.refreshSessionListForCurrentDocument().catch(() => {});
		} catch {
			// Toast 由 http 层处理
		}
	}

	/** 确保当前文档已有 sessionId（首轮发送时创建） */
	async ensureSessionForCurrentDocument(): Promise<string | null> {
		if (!this.knowledgeAssistantPersistenceAllowed) {
			return null;
		}
		if (!readToken()) {
			Toast({ type: 'warning', title: '请先登录后再使用助手' });
			return null;
		}
		const key = this.activeDocumentKey;
		if (!key) {
			Toast({ type: 'warning', title: '文档未就绪' });
			return null;
		}
		const canonical = this.canonicalKey(key);
		const existing = this.activeSessionByDocument[canonical] ?? null;
		if (existing) {
			return existing;
		}
		const binding = knowledgeArticleBindingFromDocumentKey(key);
		const res = await createAssistantSession(
			binding ? { knowledgeArticleId: binding } : {},
		);
		const created = (res.data as { sessionId?: string })?.sessionId;
		if (!created) {
			Toast({ type: 'error', title: '创建助手会话失败' });
			return null;
		}
		runInAction(() => {
			this.sessionByDocument[canonical] = created;
			this.activeSessionByDocument[canonical] = created;
			this.ensureSessionState(created);
			// 新会话创建后刷新列表（异步，不阻塞发送）
		});
		void this.refreshSessionListForCurrentDocument().catch(() => {});
		return created;
	}

	/**
	 * 为当前激活的文档强制创建一个新的对话 session（用于用户点击“新对话”按钮）。
	 * 若当前状态不允许持久化，则返回 null。
	 * 若成功，切换激活 session，并清空新会话下的消息。
	 * 最后刷新会话列表并返回新 sessionId。
	 */
	async createNewSessionForCurrentDocument(): Promise<string | null> {
		// 检查当前文档是否允许知识助手持久化（即是否允许多会话）
		if (!this.knowledgeAssistantPersistenceAllowed) {
			// 若不允许，提示用户必须先保存草稿
			Toast({ type: 'warning', title: '未保存草稿不支持多会话' });
			return null; // 返回 null 标记不可创建
		}
		// 检查当前是否已登录（本地有 token）
		if (!readToken()) {
			// 未登录则提示用户先登录
			Toast({ type: 'warning', title: '请先登录后再使用助手' });
			return null; // 返回 null，阻止后续流程
		}
		// 获取当前激活的文档 key
		const key = this.activeDocumentKey;
		// 如未选中文档，则提示就绪失败
		if (!key) {
			Toast({ type: 'warning', title: '文档未就绪' });
			return null; // 返回 null
		}
		// 计算当前文档的 canonical key，用于跨草稿/知识统一定位
		const canonical = this.canonicalKey(key);
		// 提取该文档对应的知识条目绑定 id
		const binding = knowledgeArticleBindingFromDocumentKey(key);
		// 调用后端接口创建新的助手会话（传 binding.id + forceNew:true 强制新建）
		const res = await createAssistantSession(
			binding
				? { knowledgeArticleId: binding, forceNew: true } // 如有绑定，则带上 knowledgeArticleId
				: { forceNew: true }, // 如无绑定，只传 forceNew
		);
		// 从返回数据结构中提取新创建的 sessionId
		const created = (res.data as { sessionId?: string })?.sessionId;
		// 检查是否创建成功
		if (!created) {
			// 创建失败，弹出提示
			Toast({ type: 'error', title: '创建新对话失败' });
			return null; // 返回 null
		}
		// 使用 mobx runInAction 保证状态变更批量同步
		runInAction(() => {
			// 将当前文档激活 session 设为新建的 sessionId
			this.activeSessionByDocument[canonical] = created;
			// 同步绑定 sessionByDocument
			this.sessionByDocument[canonical] = created;
			// 确保新 session 状态存在，并清空该会话下的消息列表
			this.ensureSessionState(created).messages = [];
		});
		// 返回新创建的会话 sessionId
		return created;
	}

	/**
	 * 切换当前文档绑定的对话 session
	 * @param sessionId 要切换到的 sessionId
	 */
	async switchSessionForCurrentDocument(sessionId: string): Promise<void> {
		// 规范化 sessionId，避免首尾空格影响
		const sid = (sessionId ?? '').trim();
		// 若 sessionId 为空，直接返回
		if (!sid) return;
		// 若当前文档状态不允许持久化助手（如未保存草稿），禁止切换
		if (!this.knowledgeAssistantPersistenceAllowed) return;
		// 如果未登录用户（无 token），禁止切换
		if (!readToken()) return;
		// 获取当前激活文档的 canonicalKey（兼容草稿/知识等多文档标识）
		const canonical = this.canonicalKey(this.activeDocumentKey);
		// 若canonicalKey无效，直接返回
		if (!canonical) return;
		// 切换激活会话和当前文档-sid的绑定（同步 this.activeSessionByDocument、this.sessionByDocument）
		runInAction(() => {
			this.activeSessionByDocument[canonical] = sid;
			this.sessionByDocument[canonical] = sid;
		});
		// 获取 session 状态对象（若不存在则创建空壳）
		const sstate = this.ensureSessionState(sid);
		//【关键设计理念】：如果本地已有消息、正在加载历史或正在发送消息，不再重复拉取
		if (
			sstate.messages.length > 0 ||
			sstate.isHistoryLoading ||
			sstate.isSending
		) {
			return;
		}
		// 否则设置 isHistoryLoading 标记，避免重复并发加载
		runInAction(() => {
			sstate.isHistoryLoading = true;
		});
		try {
			// 发起 API 请求，拉取该会话的历史消息详情
			const res = await getAssistantSessionDetail(sid);
			const payload = res.data; // payload结构见 service 文件类型说明
			// 会话不存在（如已被删除等），本地消息置空
			if (!payload?.session) {
				runInAction(() => {
					sstate.messages = [];
				});
				return;
			}
			// 将 API 消息转为 UI 消息模型后写入 session 状态
			runInAction(() => {
				sstate.messages = mapApiMessagesToUi(payload.messages ?? []);
			});
		} finally {
			// 不管是否出错，都重置 isHistoryLoading
			runInAction(() => {
				sstate.isHistoryLoading = false;
			});
		}
	}

	/**
	 * 刷新当前文档对应的助手会话列表（如知识库文档打开时自动拉取可切换的历史会话列表）。
	 */
	async refreshSessionListForCurrentDocument(): Promise<void> {
		// 若当前文档“允许会话持久化”开关未开启，直接返回（如草稿状态文档不允许持久化多对话）
		if (!this.knowledgeAssistantPersistenceAllowed) return;
		// 如果用户未登录（无 token），直接返回，不请求后端
		if (!readToken()) return;
		// 获取当前激活文档的 key
		const key = this.activeDocumentKey;
		// 取 canonicalKey，用于作为 sessionsByDocument 的字典 key
		const canonical = this.canonicalKey(key);
		// 解析绑定的知识条目 id（去掉__trash-*等后缀，保证 and 绑定知识的一致性）
		const binding = knowledgeArticleBindingFromDocumentKey(key);
		// 如果 canonicalKey 无效 或 知识绑定 id 无效，则忽略本次刷新
		if (!canonical || !binding) return;
		try {
			// 请求后端，获取该知识文章所有关联的会话列表
			const res = await getAssistantSessionsByKnowledgeArticle(binding);
			// 拿到响应数据
			const data = res.data;
			// 如果返回的数据中有 list 字段，说明获取到了会话列表
			if (data?.list) {
				runInAction(() => {
					// 将会话列表写入本地 store 的 sessionsByDocument，key 为 canonical 文档标识
					this.sessionsByDocument[canonical] = data.list ?? [];
				});
			}
		} catch {
			// 若拉取过程中出错，忽略异常（如网络错误/接口报错等不会影响 UI 主流程）
		}
	}

	// 发送一条消息到助手
	async sendMessage(
		raw?: string,
		options?: { extraUserContentForModel?: string },
	): Promise<void> {
		// 获取当前激活文档 key，若无则设为 ''
		const documentKey = (this.activeDocumentKey ?? '').trim();
		// 若文档 key 不存在，则弹窗警告并返回
		if (!documentKey) {
			Toast({ type: 'warning', title: '文档未就绪' });
			return;
		}
		// 获得文档规范化标识（canonical key）
		const canonical = this.canonicalKey(documentKey);
		// 获取当前文档的状态对象（session state）
		const docState = this.ensureState(canonical);
		// 判断当前是否为“临时会话”（不持久化模式）
		const ephemeral = !this.knowledgeAssistantPersistenceAllowed;

		// 处理用户输入文本，去除前后空格
		const text = (raw ?? '').trim();
		// 文本为空则直接返回
		if (!text) return;
		// 若提供额外内容也去除空格，否则为 undefined
		const extraUserContentForModel = options?.extraUserContentForModel?.trim();

		// 初始化会话 id
		let sid: string | null = null;
		if (!ephemeral) {
			// 非临时会话：确保存在后端会话，获取会话 id
			sid = await this.ensureSessionForCurrentDocument();
			// 若获取失败则直接返回
			if (!sid) return;
		} else {
			// 临时会话模式需要校验用户已登录
			if (!readToken()) {
				Toast({ type: 'warning', title: '请先登录后再使用助手' });
				return;
			}
		}

		// 拿到 sessionId 后选择 state，防止并发时 session 状态冲突
		// 重要：必须在拿到最终 sessionId 之后再选择 state，
		// 否则会在“切换会话/尚未 activeSessionId”时误用空 session 的临时态，导致并发会话被错误互斥。
		const state = ephemeral ? docState : this.ensureSessionState(sid!);
		// 如果正在发送消息或历史消息拉取中，则忽略本次请求，防止并发发送
		if (state.isSending || state.isHistoryLoading) return;

		// 临时会话时，基于历史消息生成当前上下文 rounds 片段
		const contextTurns = ephemeral
			? buildEphemeralContextTurnsFromMessages(state.messages)
			: undefined;

		// 如果有流式请求未终止，则先终止它
		state.abortStream?.();
		// 更新状态，重置 abortStream
		runInAction(() => {
			state.abortStream = null;
		});

		// 为本次对话生成用户和助手消息的唯一 chatId
		const userChatId = uuidv4();
		const assistantChatId = uuidv4();

		// 使用 mobx 的方式往 observable 数组中插入新消息，并置为“正在发送”
		runInAction(() => {
			// 插入用户的消息
			state.isSending = true;
			state.messages.push({
				chatId: userChatId,
				role: 'user',
				content: text,
				timestamp: new Date(),
			});
			// 插入助手的占位消息（空内容，流式生成中）
			state.messages.push({
				chatId: assistantChatId,
				role: 'assistant',
				content: '',
				timestamp: new Date(),
				isStreaming: true,
				thinkContent: '',
			});
		});

		// 用于累计助手分段生成的内容
		let accumulated = '';
		// 用于累计“思考”内容（如 inner monologue）
		let thinkBuf = '';
		// 如果为临时会话，清除本地已存的 streamId，方便流程中更新
		if (ephemeral) {
			docState.ephemeralStreamId = null;
		}

		// 该方法合并助手流式返回的增量，并实时写入对应助手消息
		const applyAssistantPatch = (delta: string, thinkDelta?: string) => {
			if (delta) accumulated += delta; // 累积正文
			if (thinkDelta) thinkBuf += thinkDelta; // 累积 thinkContent
			// 每次都用新对象替换，触发 observable 数组精确的变更感知
			runInAction(() => {
				const idx = state.messages.findIndex(
					(m) => m.chatId === assistantChatId,
				);
				if (idx < 0) return; // 未找到则忽略
				const prev = state.messages[idx] as Message;
				state.messages[idx] = {
					...prev,
					content: accumulated, // 刷新正文
					thinkContent: thinkBuf, // 刷新思考
				};
			});
		};

		try {
			// 发起 SSE 请求，请求体根据是否为临时会话分别构建
			const abort = await streamAssistantSse({
				body: ephemeral
					? {
							ephemeral: true,
							content: text,
							// 如果带有额外内容则加入
							...(extraUserContentForModel ? { extraUserContentForModel } : {}),
							contextTurns, // 上下文 rounds
						}
					: {
							sessionId: sid,
							content: text,
							...(extraUserContentForModel ? { extraUserContentForModel } : {}),
						},
				callbacks: {
					// 收到 assistant 的内容增量
					onDelta: (d) => applyAssistantPatch(d),
					// 收到“思考”内容（如 inner monologue）
					onThinking: (t) => applyAssistantPatch('', t),
					// 元信息回调，比如流式句柄 streamId
					onMeta: (meta) => {
						// 仅临时会话处理 streamId
						if (!ephemeral) return;
						if (meta?.streamId) {
							docState.ephemeralStreamId = meta.streamId; // 存下后续用于中断
						}
					},
					// 流式交付完成（含错误/中止）
					onComplete: async (err) => {
						// 判断是否为用户主动取消
						const userAborted = err === ASSISTANT_SSE_USER_ABORT_MARKER;
						runInAction(() => {
							// 标记已结束发送
							state.isSending = false;
							// 找到本轮助手消息
							const idx = state.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								const prev = state.messages[idx] as Message;
								const next: Message = {
									...prev,
									isStreaming: false,
								};
								// 若出错且非主动中断，将 content 设为失败提示
								if (err && !userAborted) {
									next.content = next.content || `生成失败：${err}`;
									next.isStopped = true;
								}
								// 用新对象替换，供 observer 精准感知
								state.messages[idx] = next;
							}
						});
						// 流式已终止，移除 abort 句柄
						state.abortStream = null;
						// 临时会话清除流 ID
						if (ephemeral) {
							docState.ephemeralStreamId = null;
						}
						// 若存在延迟触发 session 迁移的 pending 标记，且已无流式消息，触发历史迁移
						const pending = ephemeral ? docState.pendingEphemeralFlush : null;
						if (pending && !state.messages.some((m) => m.isStreaming)) {
							try {
								await this.flushEphemeralTranscriptIfNeeded(
									pending.cloudArticleId,
									pending.fromDocumentKey,
									pending.toDocumentKey,
								);
							} finally {
								// 迁移后释放 pending 标记，防止重复
								runInAction(() => {
									docState.pendingEphemeralFlush = null;
								});
							}
						}
						// 非临时会话若请求正常完成，则刷新服务端会话，保证本地与服务端消息一致
						if (!err && !ephemeral) {
							try {
								// 注意不要冒然刷新他人会话（多会话场景），仅刷新本 sessionId
								if (sid) {
									const res = await getAssistantSessionDetail(sid);
									const payload = res.data;
									// 校验 id 匹配，防止被并发覆盖
									if (payload?.session?.sessionId === sid) {
										runInAction(() => {
											state.messages = mapApiMessagesToUi(
												payload.messages ?? [],
											);
										});
									}
								}
							} catch {
								// 服务端拉取失败不要影响前端已渲染内容
							}
						}
					},
					// 服务端返回异常或链路故障等
					onError: (e) => {
						runInAction(() => {
							state.isSending = false; // 停止发送
							// 将本轮助手消息从“流式”转为“已停止”，并展示失败内容
							const idx = state.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								const prev = state.messages[idx] as Message;
								state.messages[idx] = {
									...prev,
									isStreaming: false,
									content: prev.content || e.message,
								};
							}
						});
						// 移除流式 abort 句柄
						state.abortStream = null;
						// 临时会话清除流 ID
						if (ephemeral) {
							docState.ephemeralStreamId = null;
						}
						// 发生错误时不进行历史迁移，置空 pending 标记
						runInAction(() => {
							docState.pendingEphemeralFlush = null;
						});
					},
				},
			});
			// 保存本轮 SSE 的 abort 句柄，供 UI 主动中断
			state.abortStream = abort;
			// 非临时会话下，生成后自动刷新会话列表（如 session tab 自动刷新）
			if (!ephemeral) {
				// 忽略错误，保证 UI 流畅
				void this.refreshSessionListForCurrentDocument().catch(() => {});
			}
		} catch {
			// 流式 SSE 发生顶层错误时需恢复 UI 状态
			runInAction(() => {
				state.isSending = false;
				const idx = state.messages.findIndex(
					(m) => m.chatId === assistantChatId,
				);
				if (idx >= 0) {
					const prev = state.messages[idx] as Message;
					state.messages[idx] = {
						...prev,
						isStreaming: false,
					};
				}
			});
			// 释放 abort 句柄及流 ID
			state.abortStream = null;
			if (ephemeral) {
				docState.ephemeralStreamId = null;
			}
		}
	}

	async stopGenerating(): Promise<void> {
		// 先断 SSE：若先 await 网关，期间 delta 仍会 apply，`...prev` 会保持 isStreaming=true
		this.abortStream?.();
		this.abortStream = null;
		runInAction(() => {
			this.isSending = false;
			// 用“替换对象”而不是原地 mutate：保证 UI 在文档切换/映射迁移时也能稳定刷新停止态
			this.messages = this.messages.map((m) => {
				if (!m.isStreaming) return m;
				return { ...m, isStreaming: false, isStopped: true };
			});
		});
		const sid = this.sessionId;
		if (!sid) {
			// ephemeral：尝试用 streamId 停止后端流（若后端支持）
			const streamId = this.ensureState(
				this.activeDocumentKey,
			).ephemeralStreamId;
			if (streamId) {
				try {
					await stopAssistantStream({ streamId });
				} catch {
					// 无进行中时后端返回失败，忽略
				}
			}
			return;
		}
		try {
			await stopAssistantStream({ sessionId: sid });
		} catch {
			// 无进行中时后端返回失败，忽略
		}
	}
}

const _assistantStore = new AssistantStore();
export const assistantStore: AssistantStoreApi = _assistantStore;
export default assistantStore;
