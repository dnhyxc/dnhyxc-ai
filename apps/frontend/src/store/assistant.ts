/**
 * 知识库右侧助手状态：含「未保存草稿 ephemeral / 保存后迁入 import-transcript / 清空草稿联动」等逻辑。
 * 完整设计文档：`docs/knowledge/knowledge-assistant-complete.md`；持久化专题：`docs/knowledge/knowledge-assistant-ephemeral-persistence.md`。
 */
import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import {
	createAssistantSession,
	getAssistantSessionByKnowledgeArticle,
	getAssistantSessionDetail,
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
	sessionByDocument: Record<string, string>;
	knowledgeAssistantPersistenceAllowed: boolean;

	readonly sessionId: string | null;
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
			sessionId: string | null;
			messages: Message[];
			isHistoryLoading: boolean;
			isSending: boolean;
			loadError: string | null;
			abortStream: (() => void) | null;
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
		historyHydrated: boolean;
		pendingEphemeralFlush: {
			cloudArticleId: string;
			fromDocumentKey: string;
			toDocumentKey: string;
		} | null;
	} {
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
		return this.ensureState(this.activeDocumentKey);
	}

	/** 当前文档对应的助手会话 id；首次发送前可能为空 */
	get sessionId(): string | null {
		return this.activeState.sessionId;
	}
	private set sessionId(value: string | null) {
		this.activeState.sessionId = value;
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
		// ephemeralStreamId 只存在于特定 state 下，需 Any 断言保证兼容
		const prevStreamId =
			(state as any)?.ephemeralStreamId != null
				? String((state as any).ephemeralStreamId)
				: null;

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
		const nextKey = (documentKey ?? '').trim();
		if (!nextKey) return;
		const docKey = this.canonicalKey(nextKey);

		// 切换文档时不要打断其它文档的流式输出，只切换 active 指针
		runInAction(() => {
			this.activeDocumentKey = nextKey;
			this.ensureState(docKey);
		});

		const state = this.ensureState(docKey);

		if (!this.knowledgeAssistantPersistenceAllowed) {
			return;
		}

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

		let sid = this.sessionByDocument[docKey] ?? state.sessionId ?? null;
		let hydratedFromArticleApi = false;

		if (!sid) {
			const bindingId = knowledgeArticleBindingFromDocumentKey(nextKey);
			if (bindingId) {
				runInAction(() => {
					state.isHistoryLoading = true;
				});
				try {
					const res = await getAssistantSessionByKnowledgeArticle(bindingId);
					const data = res.data;
					if (data?.session?.sessionId) {
						sid = data.session.sessionId;
						runInAction(() => {
							this.sessionByDocument[docKey] = sid!;
							state.sessionId = sid!;
							state.messages = mapApiMessagesToUi(data.messages ?? []);
						});
						hydratedFromArticleApi = true;
					}
				} catch {
					// Toast 由 http 层处理
				} finally {
					runInAction(() => {
						state.isHistoryLoading = false;
					});
				}
			}
		}

		if (!sid) {
			runInAction(() => {
				state.historyHydrated = true;
			});
			return;
		}
		if (hydratedFromArticleApi) {
			runInAction(() => {
				state.historyHydrated = true;
			});
			return;
		}

		runInAction(() => {
			state.sessionId = sid;
			state.isHistoryLoading = true;
		});

		try {
			await this.fetchSessionMessages();
		} catch {
			// Toast 由 http 层处理
			runInAction(() => {
				delete this.sessionByDocument[docKey];
				state.sessionId = null;
				state.messages = [];
			});
		} finally {
			runInAction(() => {
				state.isHistoryLoading = false;
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
			const res = await importAssistantTranscript({
				knowledgeArticleId: cloudArticleId,
				lines,
			});
			const sid = res.data?.sessionId;
			if (!sid) return;
			runInAction(() => {
				delete this.sessionByDocument[from];
				this.sessionByDocument[to] = sid;
				const toState = this.ensureState(to);
				toState.sessionId = sid;
				toState.historyHydrated = true;
				toState.pendingEphemeralFlush = null;
				if (this.activeDocumentKey === fromDocumentKey) {
					this.activeDocumentKey = toDocumentKey;
				}
			});
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
		const state = this.ensureState(canonical);
		const existing =
			state.sessionId ?? this.sessionByDocument[canonical] ?? null;
		if (existing) {
			runInAction(() => {
				state.sessionId = existing;
			});
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
			state.sessionId = created;
			state.historyHydrated = true;
		});
		return created;
	}

	async sendMessage(
		raw?: string,
		options?: { extraUserContentForModel?: string },
	): Promise<void> {
		const documentKey = (this.activeDocumentKey ?? '').trim();
		if (!documentKey) {
			Toast({ type: 'warning', title: '文档未就绪' });
			return;
		}
		const canonical = this.canonicalKey(documentKey);
		const state = this.ensureState(canonical);

		const text = (raw ?? '').trim();
		if (!text || state.isSending || state.isHistoryLoading) return;
		const extraUserContentForModel = options?.extraUserContentForModel?.trim();

		const ephemeral = !this.knowledgeAssistantPersistenceAllowed;
		let sid: string | null = null;
		if (!ephemeral) {
			// ensureSessionForCurrentDocument 依赖 activeDocumentKey，此处 documentKey 就是当下 active
			sid = await this.ensureSessionForCurrentDocument();
			if (!sid) return;
		} else {
			if (!readToken()) {
				Toast({ type: 'warning', title: '请先登录后再使用助手' });
				return;
			}
		}

		const contextTurns = ephemeral
			? buildEphemeralContextTurnsFromMessages(state.messages)
			: undefined;

		state.abortStream?.();
		runInAction(() => {
			state.abortStream = null;
		});

		const userChatId = uuidv4();
		const assistantChatId = uuidv4();

		runInAction(() => {
			state.isSending = true;
			state.messages.push({
				chatId: userChatId,
				role: 'user',
				content: text,
				timestamp: new Date(),
			});
			state.messages.push({
				chatId: assistantChatId,
				role: 'assistant',
				content: '',
				timestamp: new Date(),
				isStreaming: true,
				thinkContent: '',
			});
		});

		let accumulated = '';
		let thinkBuf = '';
		// ephemeral：后端下发的可 stop 句柄（streamId）
		if (ephemeral) {
			(state as any).ephemeralStreamId = null;
		}

		const applyAssistantPatch = (delta: string, thinkDelta?: string) => {
			if (delta) accumulated += delta;
			if (thinkDelta) thinkBuf += thinkDelta;
			// 每次流式增量用新对象替换 messages[i]，让 observable 数组发生「元素级」变更，便于列表/子 observer 稳定刷新
			runInAction(() => {
				const idx = state.messages.findIndex(
					(m) => m.chatId === assistantChatId,
				);
				if (idx < 0) return;
				const prev = state.messages[idx] as Message;
				state.messages[idx] = {
					...prev,
					content: accumulated,
					thinkContent: thinkBuf,
				};
			});
		};

		try {
			const abort = await streamAssistantSse({
				body: ephemeral
					? {
							ephemeral: true,
							content: text,
							...(extraUserContentForModel ? { extraUserContentForModel } : {}),
							contextTurns,
						}
					: {
							sessionId: sid,
							content: text,
							...(extraUserContentForModel ? { extraUserContentForModel } : {}),
						},
				callbacks: {
					onDelta: (d) => applyAssistantPatch(d),
					onThinking: (t) => applyAssistantPatch('', t),
					onMeta: (meta) => {
						if (!ephemeral) return;
						if (meta?.streamId) {
							(state as any).ephemeralStreamId = meta.streamId;
						}
					},
					onComplete: async (err) => {
						const userAborted = err === ASSISTANT_SSE_USER_ABORT_MARKER;
						runInAction(() => {
							state.isSending = false;
							const idx = state.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								const prev = state.messages[idx] as Message;
								const next: Message = {
									...prev,
									isStreaming: false,
								};
								// 用户点「停止」会先 abort SSE：此处勿把哨兵当真实错误，也勿用空会话覆盖已生成正文
								if (err && !userAborted) {
									next.content = next.content || `生成失败：${err}`;
									next.isStopped = true;
								}
								// 用新对象替换，避免原地 mutate 在“key remap/视图切换”时出现短暂订阅/渲染不一致
								state.messages[idx] = next;
							}
						});
						state.abortStream = null;
						if (ephemeral) {
							(state as any).ephemeralStreamId = null;
						}
						// 若首次保存时登记了“延迟迁入”：在流式结束后把完整对话迁入并绑定到新知识条目
						// 注意：这里只处理“当前 state”上的 pending；它会在 fromKey→toKey remap 时随 state 迁移
						const pending = state.pendingEphemeralFlush;
						if (pending && !state.messages.some((m) => m.isStreaming)) {
							try {
								await this.flushEphemeralTranscriptIfNeeded(
									pending.cloudArticleId,
									pending.fromDocumentKey,
									pending.toDocumentKey,
								);
							} finally {
								runInAction(() => {
									state.pendingEphemeralFlush = null;
								});
							}
						}
						// 主动停止时服务端往往尚未写入本轮 assistant 片段，拉会话会覆盖本地已累积内容
						if (!err && !ephemeral) {
							try {
								await this.fetchSessionMessagesForDocumentKey(canonical);
							} catch {
								// 忽略：界面已展示累积正文
							}
						}
					},
					onError: (e) => {
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
									content: prev.content || e.message,
								};
							}
						});
						state.abortStream = null;
						if (ephemeral) {
							(state as any).ephemeralStreamId = null;
						}
						// 发生错误时不自动迁入，避免把“错误/中断导致的不完整内容”强绑定到新知识条目
						// 若产品需要“即使错误也迁入”，可把该逻辑移动到 UI 层由用户确认。
						runInAction(() => {
							state.pendingEphemeralFlush = null;
						});
					},
				},
			});
			state.abortStream = abort;
		} catch {
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
			state.abortStream = null;
			if (ephemeral) {
				(state as any).ephemeralStreamId = null;
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
			const streamId =
				(this.activeState as any)?.ephemeralStreamId != null
					? String((this.activeState as any).ephemeralStreamId)
					: null;
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
