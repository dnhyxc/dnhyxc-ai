/**
 * 英语学习 Agent：专项模式 `english_learning`，对接 `/agent/session` + `/agent/sse`。
 */
import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import {
	createAgentSession,
	getAgentSessionDetail,
	stopAgentStream,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import type { Message, SearchOrganicItem } from '@/types/chat';
import { AGENT_SSE_USER_ABORT_MARKER, streamAgentSse } from '@/utils/agentSse';

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token') || '';
}

export class EnglishAgentStore {
	sessionId: string | null = null;
	sessionTitle: string | null = null;
	messages: Message[] = [];
	isSending = false;
	abortStream: (() => void) | null = null;
	/** 快捷意图：下次发送时拼入正文前缀，发送后清空 */
	pendingIntentPrefix = '';
	/** 工具调用轻量状态（展示「检索中」等） */
	toolStatus: string | null = null;
	loadError: string | null = null;
	isHydrating = false;

	constructor() {
		makeAutoObservable(this);
	}

	get isStreaming(): boolean {
		return this.messages.some((m) => m.isStreaming);
	}

	private buildOutgoingContent(userText: string): string {
		const trimmed = userText.trim();
		const intentBlock = this.pendingIntentPrefix
			? `${this.pendingIntentPrefix}\n\n`
			: '';
		return `${intentBlock}${trimmed}`;
	}

	/** 确保已有会话，首次发送时创建 */
	async ensureSession(titleFallback: string): Promise<string | null> {
		if (this.sessionId) return this.sessionId;
		if (!readToken()) {
			Toast({ type: 'warning', title: '请先登录后再使用英语学习' });
			return null;
		}
		try {
			const res = await createAgentSession({
				title: titleFallback,
			});
			const sid = res.data?.sessionId;
			if (!sid) {
				Toast({ type: 'error', title: '创建学习会话失败' });
				return null;
			}
			runInAction(() => {
				this.sessionId = sid;
				this.sessionTitle = res.data?.title ?? titleFallback;
			});
			return sid;
		} catch {
			return null;
		}
	}

	/** 从服务端恢复消息列表 */
	async hydrateSession(sessionId: string): Promise<void> {
		if (!readToken()) return;
		this.isHydrating = true;
		this.loadError = null;
		try {
			const res = await getAgentSessionDetail(sessionId);
			const payload = res.data;
			const sess = payload?.session;
			if (!sess) {
				runInAction(() => {
					this.loadError = '会话不存在或无权访问';
					this.sessionId = null;
					this.messages = [];
				});
				return;
			}
			runInAction(() => {
				this.sessionId = sess.sessionId;
				this.sessionTitle = sess.title;
				this.messages = (payload.messages ?? []).map((m) => ({
					chatId: m.id,
					role: m.role === 'user' ? 'user' : 'assistant',
					content: m.content,
					searchOrganic: m.searchOrganic ?? undefined,
					timestamp: new Date(m.createdAt),
					isStreaming: false,
				}));
			});
		} catch {
			runInAction(() => {
				this.loadError = '加载会话失败';
			});
		} finally {
			runInAction(() => {
				this.isHydrating = false;
			});
		}
	}

	/** 清空本地状态并准备新对话（不自动删库） */
	resetConversation(): void {
		this.abortStream?.();
		runInAction(() => {
			this.abortStream = null;
			this.isSending = false;
			this.sessionId = null;
			this.sessionTitle = null;
			this.messages = [];
			this.toolStatus = null;
			this.pendingIntentPrefix = '';
			this.loadError = null;
		});
		EnglishPackStore.setSidebarIntentPrefix('');
	}

	stopGenerating(): void {
		const sid = this.sessionId;
		this.abortStream?.();
		void (async () => {
			if (sid) {
				try {
					await stopAgentStream({ sessionId: sid });
				} catch {
					// Toast 由 http 层处理
				}
			}
		})();
		runInAction(() => {
			this.abortStream = null;
			this.isSending = false;
			this.toolStatus = null;
			this.messages = this.messages.map((m) => {
				if (!m.isStreaming) return m;
				return { ...m, isStreaming: false, isStopped: true };
			});
		});
	}

	setIntentPrefix(prefix: string): void {
		this.pendingIntentPrefix = prefix;
		EnglishPackStore.setSidebarIntentPrefix(prefix);
	}

	async sendMessage(
		rawText: string,
		options?: { titleFallback?: string },
	): Promise<void> {
		const userText = (rawText ?? '').trim();
		if (!userText) return;
		if (!readToken()) {
			Toast({ type: 'warning', title: '请先登录后再使用英语学习' });
			return;
		}
		if (this.isSending || this.isStreaming) {
			Toast({ type: 'warning', title: '请等待当前回复结束后再试' });
			return;
		}

		const titleFallback =
			options?.titleFallback ?? this.sessionTitle ?? '英语学习';

		const sid = await this.ensureSession(titleFallback);
		if (!sid) return;

		this.abortStream?.();
		runInAction(() => {
			this.abortStream = null;
			this.isSending = true;
			this.toolStatus = null;
		});

		const outgoing = this.buildOutgoingContent(userText);
		runInAction(() => {
			this.pendingIntentPrefix = '';
		});
		EnglishPackStore.setSidebarIntentPrefix('');

		const userChatId = uuidv4();
		const assistantChatId = uuidv4();

		runInAction(() => {
			this.messages.push({
				chatId: userChatId,
				role: 'user',
				content: userText,
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

		const patchAssistant = (delta: string) => {
			if (delta) accumulated += delta;
			runInAction(() => {
				const idx = this.messages.findIndex(
					(m) => m.chatId === assistantChatId,
				);
				if (idx < 0) return;
				const prev = this.messages[idx] as Message;
				this.messages[idx] = {
					...prev,
					content: accumulated,
				};
			});
		};

		const patchAssistantOrganic = (organic: SearchOrganicItem[]) => {
			runInAction(() => {
				const idx = this.messages.findIndex(
					(m) => m.chatId === assistantChatId,
				);
				if (idx < 0) return;
				const prev = this.messages[idx] as Message;
				this.messages[idx] = {
					...prev,
					searchOrganic: organic,
				};
			});
		};

		try {
			const abort = await streamAgentSse({
				body: {
					sessionId: sid,
					content: outgoing,
					assistMode: 'english_learning',
				},
				callbacks: {
					onDelta: (d) => patchAssistant(d),
					onSearchOrganic: (organic) => patchAssistantOrganic(organic),
					onTool: (ev) => {
						runInAction(() => {
							this.toolStatus =
								ev.phase === 'start'
									? ev.name
										? `调用工具：${ev.name}…`
										: '检索中…'
									: null;
						});
					},
					onComplete: (err) => {
						runInAction(() => {
							this.isSending = false;
							const idx = this.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								const prev = this.messages[idx] as Message;
								if (prev.isStreaming) {
									this.messages[idx] = {
										...prev,
										isStreaming: false,
										...(err &&
										err !== AGENT_SSE_USER_ABORT_MARKER &&
										!prev.content
											? { content: `生成失败：${err}` }
											: {}),
									};
								}
							}
							this.abortStream = null;
							this.toolStatus = null;
						});
					},
					onError: () => {
						runInAction(() => {
							this.isSending = false;
							const idx = this.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								const prev = this.messages[idx] as Message;
								this.messages[idx] = {
									...prev,
									isStreaming: false,
									content: prev.content || '请求中断',
								};
							}
							this.abortStream = null;
							this.toolStatus = null;
						});
					},
				},
			});
			runInAction(() => {
				this.abortStream = abort;
			});
		} catch {
			runInAction(() => {
				this.isSending = false;
				const idx = this.messages.findIndex(
					(m) => m.chatId === assistantChatId,
				);
				if (idx >= 0) {
					const prev = this.messages[idx] as Message;
					this.messages[idx] = { ...prev, isStreaming: false };
				}
				this.abortStream = null;
			});
		}
	}
}

const _englishAgentStore = new EnglishAgentStore();
export const englishAgentStore = _englishAgentStore;
export default englishAgentStore;
