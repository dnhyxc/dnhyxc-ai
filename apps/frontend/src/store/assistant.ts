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
import { streamAssistantSse } from '@/utils/assistantSse';

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
class AssistantStore {
	/** 当前知识文档标识（与 MarkdownEditor documentIdentity 一致） */
	activeDocumentKey = '';
	/** 当前文档对应的助手会话 id；首次发送前可能为空 */
	sessionId: string | null = null;
	messages: Message[] = [];
	isHistoryLoading = false;
	isSending = false;
	loadError: string | null = null;
	/** 最近一次流式请求的取消函数 */
	abortStream: (() => void) | null = null;
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

	setKnowledgeAssistantPersistenceAllowed(allowed: boolean): void {
		runInAction(() => {
			this.knowledgeAssistantPersistenceAllowed = allowed;
		});
	}

	/**
	 * 知识编辑区执行「清空 / 新建草稿」时：中断流式、清空当前文档下的内存对话与 session 映射。
	 * 用于未保存云端草稿等 `documentKey` 不变、不会再次触发 `activateForDocument` 的场景，避免助手气泡残留。
	 */
	clearAssistantStateOnKnowledgeDraftReset(): void {
		const prevSid = this.sessionId;
		this.abortStream?.();
		this.abortStream = null;
		runInAction(() => {
			this.messages = [];
			this.sessionId = null;
			this.isSending = false;
			this.loadError = null;
			const key = this.activeDocumentKey;
			if (key) {
				delete this.sessionByDocument[key];
			}
		});
		if (prevSid) {
			void stopAssistantStream(prevSid).catch(() => {});
		}
	}

	get isStreaming(): boolean {
		return this.messages.some((m) => m.isStreaming);
	}

	/** 切换知识条目时调用：内存映射或服务端按条目标识拉取历史，无则保持空会话待首轮发送 */
	async activateForDocument(documentKey: string): Promise<void> {
		this.abortStream?.();
		this.abortStream = null;

		runInAction(() => {
			this.activeDocumentKey = documentKey;
			this.messages = [];
			this.sessionId = null;
			this.loadError = null;
		});

		if (!this.knowledgeAssistantPersistenceAllowed) {
			return;
		}

		if (!readToken()) {
			return;
		}

		let sid = this.sessionByDocument[documentKey] ?? null;
		let hydratedFromArticleApi = false;

		if (!sid) {
			const bindingId = knowledgeArticleBindingFromDocumentKey(documentKey);
			if (bindingId) {
				runInAction(() => {
					this.isHistoryLoading = true;
				});
				try {
					const res = await getAssistantSessionByKnowledgeArticle(bindingId);
					const data = res.data;
					if (data?.session?.sessionId) {
						sid = data.session.sessionId;
						runInAction(() => {
							this.sessionByDocument[documentKey] = sid!;
							this.sessionId = sid!;
							this.messages = mapApiMessagesToUi(data.messages ?? []);
						});
						hydratedFromArticleApi = true;
					}
				} catch {
					// Toast 由 http 层处理
				} finally {
					runInAction(() => {
						this.isHistoryLoading = false;
					});
				}
			}
		}

		if (!sid) {
			return;
		}
		if (hydratedFromArticleApi) {
			return;
		}

		runInAction(() => {
			this.sessionId = sid;
			this.isHistoryLoading = true;
		});

		try {
			await this.fetchSessionMessages();
		} catch {
			// Toast 由 http 层处理
			runInAction(() => {
				delete this.sessionByDocument[documentKey];
				this.sessionId = null;
				this.messages = [];
			});
		} finally {
			runInAction(() => {
				this.isHistoryLoading = false;
			});
		}
	}

	/**
	 * 文档维度 key 变更时（如草稿首次保存得到真实 id、本地首次落盘），迁移 session 映射，避免助手历史丢失。
	 */
	remapAssistantSessionDocumentKey(fromKey: string, toKey: string): void {
		if (!fromKey || !toKey || fromKey === toKey) return;
		runInAction(() => {
			const sid = this.sessionByDocument[fromKey];
			if (sid) {
				this.sessionByDocument[toKey] = sid;
				delete this.sessionByDocument[fromKey];
			}
			if (this.activeDocumentKey === fromKey) {
				this.activeDocumentKey = toKey;
			}
		});
	}

	/** 当前 documentKey 在内存中的 sessionId（供保存后改绑服务端条目标识等场景） */
	getSessionIdForDocumentKey(documentKey: string): string | null {
		return this.sessionByDocument[documentKey] ?? null;
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
		if (!this.sessionId) return;
		const res = await getAssistantSessionDetail(this.sessionId);
		const payload = res.data;
		// 后端在会话已删除时返回 session: null（避免 404）；同步清掉本地缓存的旧 sessionId
		if (!payload?.session) {
			runInAction(() => {
				const key = this.activeDocumentKey;
				if (key) {
					delete this.sessionByDocument[key];
				}
				this.sessionId = null;
				this.messages = [];
			});
			return;
		}
		if (!payload.messages) return;
		runInAction(() => {
			this.messages = mapApiMessagesToUi(payload.messages);
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
		const lines = buildImportTranscriptLinesFromMessages(this.messages);
		if (lines.length === 0) return;
		try {
			const res = await importAssistantTranscript({
				knowledgeArticleId: cloudArticleId,
				lines,
			});
			const sid = res.data?.sessionId;
			if (!sid) return;
			runInAction(() => {
				delete this.sessionByDocument[fromDocumentKey];
				this.sessionByDocument[toDocumentKey] = sid;
				this.sessionId = sid;
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
		const existing = this.sessionId ?? this.sessionByDocument[key] ?? null;
		if (existing) {
			runInAction(() => {
				this.sessionId = existing;
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
			this.sessionByDocument[key] = created;
			this.sessionId = created;
		});
		return created;
	}

	async sendMessage(raw?: string): Promise<void> {
		const text = (raw ?? '').trim();
		if (!text || this.isSending || this.isHistoryLoading) return;

		const ephemeral = !this.knowledgeAssistantPersistenceAllowed;
		let sid: string | null = null;
		if (!ephemeral) {
			sid = await this.ensureSessionForCurrentDocument();
			if (!sid) return;
		} else {
			if (!readToken()) {
				Toast({ type: 'warning', title: '请先登录后再使用助手' });
				return;
			}
			if (!this.activeDocumentKey) {
				Toast({ type: 'warning', title: '文档未就绪' });
				return;
			}
		}

		const contextTurns = ephemeral
			? buildEphemeralContextTurnsFromMessages(this.messages)
			: undefined;

		this.abortStream?.();
		runInAction(() => {
			this.abortStream = null;
		});

		const userChatId = uuidv4();
		const assistantChatId = uuidv4();

		runInAction(() => {
			this.isSending = true;
			this.messages.push({
				chatId: userChatId,
				role: 'user',
				content: text,
				timestamp: new Date(),
			});
			this.messages.push({
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

		const applyAssistantPatch = (delta: string, thinkDelta?: string) => {
			if (delta) accumulated += delta;
			if (thinkDelta) thinkBuf += thinkDelta;
			// 每次流式增量用新对象替换 messages[i]，让 observable 数组发生「元素级」变更，便于列表/子 observer 稳定刷新
			runInAction(() => {
				const idx = this.messages.findIndex(
					(m) => m.chatId === assistantChatId,
				);
				if (idx < 0) return;
				const prev = this.messages[idx] as Message;
				this.messages[idx] = {
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
							contextTurns,
						}
					: {
							sessionId: sid,
							content: text,
						},
				callbacks: {
					onDelta: (d) => applyAssistantPatch(d),
					onThinking: (t) => applyAssistantPatch('', t),
					onComplete: async (err) => {
						runInAction(() => {
							this.isSending = false;
							const idx = this.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								this.messages[idx].isStreaming = false;
								if (err) {
									this.messages[idx].content =
										this.messages[idx].content || `生成失败：${err}`;
									this.messages[idx].isStopped = true;
								}
							}
						});
						this.abortStream = null;
						if (!err && !ephemeral) {
							try {
								await this.fetchSessionMessages();
							} catch {
								// 忽略：界面已展示累积正文
							}
						}
					},
					onError: (e) => {
						runInAction(() => {
							this.isSending = false;
							const idx = this.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								this.messages[idx].isStreaming = false;
								this.messages[idx].content =
									this.messages[idx].content || e.message;
							}
						});
						this.abortStream = null;
					},
				},
			});
			this.abortStream = abort;
		} catch {
			runInAction(() => {
				this.isSending = false;
				const idx = this.messages.findIndex(
					(m) => m.chatId === assistantChatId,
				);
				if (idx >= 0) {
					this.messages[idx].isStreaming = false;
				}
			});
			this.abortStream = null;
		}
	}

	async stopGenerating(): Promise<void> {
		// 先断 SSE：若先 await 网关，期间 delta 仍会 apply，`...prev` 会保持 isStreaming=true
		this.abortStream?.();
		this.abortStream = null;
		runInAction(() => {
			this.isSending = false;
			for (const m of this.messages) {
				if (m.isStreaming) {
					m.isStreaming = false;
					m.isStopped = true;
				}
			}
		});
		const sid = this.sessionId;
		if (!sid) return;
		try {
			await stopAssistantStream(sid);
		} catch {
			// 无进行中时后端返回失败，忽略
		}
	}
}

export default new AssistantStore();
