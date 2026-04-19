import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import {
	createAssistantSession,
	getAssistantSessionDetail,
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

	constructor() {
		makeAutoObservable(this);
	}

	get isStreaming(): boolean {
		return this.messages.some((m) => m.isStreaming);
	}

	/** 切换知识条目时调用：有已绑定 session 则拉历史，否则清空待首轮发送再建会话 */
	async activateForDocument(documentKey: string): Promise<void> {
		this.abortStream?.();
		this.abortStream = null;

		runInAction(() => {
			this.activeDocumentKey = documentKey;
			this.messages = [];
			this.sessionId = null;
			this.loadError = null;
		});

		if (!readToken()) {
			return;
		}

		const sid = this.sessionByDocument[documentKey];
		if (!sid) {
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

	async fetchSessionMessages(): Promise<void> {
		if (!this.sessionId) return;
		const res = await getAssistantSessionDetail(this.sessionId);
		const payload = res.data;
		if (!payload?.messages) return;
		runInAction(() => {
			this.messages = mapApiMessagesToUi(payload.messages);
		});
	}

	/** 确保当前文档已有 sessionId（首轮发送时创建） */
	async ensureSessionForCurrentDocument(): Promise<string | null> {
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
		const res = await createAssistantSession({});
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

		const sid = await this.ensureSessionForCurrentDocument();
		if (!sid) return;

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
				body: {
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
						if (!err) {
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
