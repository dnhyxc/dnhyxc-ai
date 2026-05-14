/**
 * 英语学习 Agent：专项模式 `english_learning`，对接 `/agent/session` + `/agent/sse`。
 * 多会话：与知识库助手一致，按 `stateBySession` 隔离消息与流式，切换历史不中断其它会话的 SSE。
 */
import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import type { UIEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
	createAgentSession,
	deleteAgentSession,
	getAgentSessionDetail,
	listAgentSessions,
	stopAgentStream,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import type { Message, SearchOrganicItem } from '@/types/chat';
import { AGENT_SSE_USER_ABORT_MARKER, streamAgentSse } from '@/utils/agentSse';

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token') || '';
}

function mapApiMessagesToUi(
	list: Array<{
		id: string;
		role: string;
		content: string;
		searchOrganic?: SearchOrganicItem[] | null;
		createdAt: string | Date;
	}>,
): Message[] {
	return list.map((m) => ({
		chatId: m.id,
		role: m.role === 'user' ? 'user' : 'assistant',
		content: m.content,
		searchOrganic: m.searchOrganic ?? undefined,
		timestamp: new Date(m.createdAt),
		isStreaming: false,
	}));
}

/** 单会话运行态（消息、发送、流式句柄、工具条文案） */
export type EnglishSessionRuntime = {
	messages: Message[];
	isSending: boolean;
	isHistoryLoading: boolean;
	abortStream: (() => void) | null;
	toolStatus: string | null;
};

export class EnglishAgentStore {
	/** 当前界面展示的会话 id（与 URL `session` 对齐） */
	activeSessionId: string | null = null;
	/** 当前展示会话标题（来自详情或列表） */
	sessionTitle: string | null = null;
	/** 各会话独立状态，支持后台会话继续流式 */
	stateBySession: Record<string, EnglishSessionRuntime> = {};
	/** 正在消费 SSE 的会话（用于停止与工具条归属） */
	streamingSessionId: string | null = null;

	sessionList: Array<{
		sessionId: string;
		title: string | null;
		createdAt: string;
		updatedAt: string;
	}> = [];
	sessionsPage = { pageNo: 1, pageSize: 20, total: 0 };
	historySessionLoading = false;
	historySessionLoadingMore = false;

	/** 快捷意图：仅通过 `intentPrefix` 传给服务端拼入模型输入，不入库；发送后清空 */
	pendingIntentPrefix = '';
	loadError: string | null = null;
	isHydrating = false;

	constructor() {
		makeAutoObservable(this);
	}

	/** 兼容旧命名：分享、URL 等仍读 `sessionId` */
	get sessionId(): string | null {
		return this.activeSessionId;
	}

	get messages(): Message[] {
		const sid = this.activeSessionId;
		if (!sid) return [];
		return this.stateBySession[sid]?.messages ?? [];
	}

	get isSending(): boolean {
		const sid = this.activeSessionId;
		if (!sid) return false;
		return Boolean(this.stateBySession[sid]?.isSending);
	}

	get abortStream(): (() => void) | null {
		const sid = this.activeSessionId;
		if (!sid) return null;
		return this.stateBySession[sid]?.abortStream ?? null;
	}

	/** 仅当前展示会话内的流式（贴底滚动等） */
	get isStreaming(): boolean {
		return this.messages.some((m) => m.isStreaming);
	}

	/** 知识库式锁定：英语学习无「草稿迁入」场景，恒不锁历史抽屉 */
	get isEnglishSessionSwitcherLocked(): boolean {
		return false;
	}

	get toolStatus(): string | null {
		const streamSid = this.streamingSessionId;
		const active = this.activeSessionId;
		if (!streamSid || streamSid !== active) return null;
		return this.stateBySession[streamSid]?.toolStatus ?? null;
	}

	private get hasMoreHistorySessions(): boolean {
		return this.sessionList.length < (this.sessionsPage.total ?? 0);
	}

	ensureSessionState(sid: string): EnglishSessionRuntime {
		const id = (sid ?? '').trim();
		if (!id) {
			return {
				messages: [],
				isSending: false,
				isHistoryLoading: false,
				abortStream: null,
				toolStatus: null,
			};
		}
		if (!this.stateBySession[id]) {
			this.stateBySession[id] = {
				messages: [],
				isSending: false,
				isHistoryLoading: false,
				abortStream: null,
				toolStatus: null,
			};
		}
		return this.stateBySession[id]!;
	}

	isSessionStreaming(sessionId: string): boolean {
		const sid = (sessionId ?? '').trim();
		if (!sid) return false;
		const st = this.stateBySession[sid];
		return Boolean(st?.messages?.some((m) => m.isStreaming));
	}

	/** 确保已有会话，首次发送时创建 */
	async ensureSession(titleFallback: string): Promise<string | null> {
		if (this.activeSessionId) return this.activeSessionId;
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
				this.activeSessionId = sid;
				this.sessionTitle = res.data?.title ?? titleFallback;
				this.ensureSessionState(sid);
				if (!this.sessionList.some((s) => s.sessionId === sid)) {
					const now = new Date().toISOString();
					this.sessionList = [
						{
							sessionId: sid,
							title: this.sessionTitle,
							createdAt: now,
							updatedAt: now,
						},
						...this.sessionList,
					];
					this.sessionsPage.total = (this.sessionsPage.total ?? 0) + 1;
				}
			});
			return sid;
		} catch {
			return null;
		}
	}

	/** 从服务端恢复消息列表（URL 进入或切换会话） */
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
					this.activeSessionId = null;
					this.sessionTitle = null;
				});
				return;
			}
			const sid = sess.sessionId;
			runInAction(() => {
				this.activeSessionId = sid;
				this.sessionTitle = sess.title;
				const st = this.ensureSessionState(sid);
				st.messages = mapApiMessagesToUi(payload.messages ?? []);
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

	/**
	 * 切换当前展示的会话；若本地已有消息 / 正在拉历史 / 正在发送，不重复拉取（与 assistant.switchSession 一致）。
	 * 不中止其它会话的 SSE。
	 */
	async switchSession(sessionId: string): Promise<void> {
		if (!readToken()) return;
		const sid = (sessionId ?? '').trim();
		if (!sid) return;
		runInAction(() => {
			this.activeSessionId = sid;
		});
		const st = this.ensureSessionState(sid);
		if (st.messages.length > 0 || st.isHistoryLoading || st.isSending) {
			const row = this.sessionList.find((s) => s.sessionId === sid);
			if (row?.title != null) {
				runInAction(() => {
					this.sessionTitle = row.title;
				});
			}
			return;
		}
		runInAction(() => {
			st.isHistoryLoading = true;
		});
		try {
			const res = await getAgentSessionDetail(sid);
			const payload = res.data;
			const sess = payload?.session;
			runInAction(() => {
				if (!sess) {
					st.messages = [];
				} else {
					this.sessionTitle = sess.title;
					st.messages = mapApiMessagesToUi(payload.messages ?? []);
				}
			});
		} finally {
			runInAction(() => {
				st.isHistoryLoading = false;
			});
		}
	}

	async refreshSessionList(): Promise<void> {
		if (!readToken()) return;
		try {
			runInAction(() => {
				this.historySessionLoading = true;
			});
			const pageNo = 1;
			const pageSize = this.sessionsPage.pageSize ?? 20;
			const res = await listAgentSessions({ pageNo, pageSize });
			const data = res.data;
			if (data?.list) {
				runInAction(() => {
					this.sessionList = data.list ?? [];
					this.sessionsPage = {
						pageNo: data.pageNo ?? pageNo,
						pageSize: data.pageSize ?? pageSize,
						total: data.total ?? data.list?.length ?? 0,
					};
				});
			}
		} catch {
			// ignore
		} finally {
			runInAction(() => {
				this.historySessionLoading = false;
			});
		}
	}

	private async loadMoreSessionList(): Promise<void> {
		if (!readToken()) return;
		if (this.historySessionLoading) return;
		if (this.historySessionLoadingMore) return;
		if (!this.hasMoreHistorySessions) return;
		const page = this.sessionsPage;
		runInAction(() => {
			this.historySessionLoadingMore = true;
		});
		try {
			const nextPageNo = (page.pageNo ?? 1) + 1;
			const pageSize = page.pageSize ?? 20;
			const res = await listAgentSessions({ pageNo: nextPageNo, pageSize });
			const data = res.data;
			if (data?.list?.length) {
				runInAction(() => {
					const prev = this.sessionList ?? [];
					const seen = new Set(prev.map((s) => s.sessionId));
					const appended = data.list.filter((s) => !seen.has(s.sessionId));
					this.sessionList = [...prev, ...appended];
					this.sessionsPage = {
						pageNo: data.pageNo ?? nextPageNo,
						pageSize: data.pageSize ?? pageSize,
						total: data.total ?? page.total,
					};
				});
			}
		} catch {
			// ignore
		} finally {
			runInAction(() => {
				this.historySessionLoadingMore = false;
			});
		}
	}

	onHistorySessionViewportScroll = (e: UIEvent<HTMLElement>) => {
		if (this.historySessionLoading) return;
		if (this.historySessionLoadingMore) return;
		if (!this.hasMoreHistorySessions) return;
		const el = e.currentTarget;
		const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (remaining > 80) return;
		void this.loadMoreSessionList();
	};

	/**
	 * 新对话草稿：清空当前展示会话的选中态（历史列表无高亮），主区显示空态；
	 * 不立即创建服务端会话，首条发送时由 ensureSession 创建；不中断其它会话的 SSE。
	 */
	beginNewConversationDraft(): void {
		runInAction(() => {
			this.activeSessionId = null;
			this.sessionTitle = null;
			this.loadError = null;
		});
	}

	/** 新建空会话并切为当前（不中断其它会话流式） */
	async createNewSession(titleFallback = '英语学习'): Promise<string | null> {
		if (!readToken()) {
			Toast({ type: 'warning', title: '请先登录后再使用英语学习' });
			return null;
		}
		try {
			const res = await createAgentSession({ title: titleFallback });
			const sid = res.data?.sessionId;
			if (!sid) {
				Toast({ type: 'error', title: '创建学习会话失败' });
				return null;
			}
			runInAction(() => {
				this.activeSessionId = sid;
				this.sessionTitle = res.data?.title ?? titleFallback;
				const st = this.ensureSessionState(sid);
				st.messages = [];
				st.isSending = false;
				st.isHistoryLoading = false;
			});
			void this.refreshSessionList();
			return sid;
		} catch {
			Toast({ type: 'error', title: '创建学习会话失败' });
			return null;
		}
	}

	async deleteSession(sessionId: string): Promise<void> {
		if (!readToken()) return;
		const sid = (sessionId ?? '').trim();
		if (!sid) return;
		if (this.isSessionStreaming(sid)) {
			Toast({ type: 'info', title: '该对话正在输出中，暂不支持删除' });
			return;
		}
		try {
			await deleteAgentSession(sid);
		} catch {
			return;
		}
		runInAction(() => {
			this.sessionList = this.sessionList.filter((s) => s.sessionId !== sid);
			this.sessionsPage.total = Math.max(0, (this.sessionsPage.total ?? 0) - 1);
			delete this.stateBySession[sid];
			if (this.streamingSessionId === sid) {
				this.streamingSessionId = null;
			}
			if (this.activeSessionId === sid) {
				const next = this.sessionList[0]?.sessionId ?? null;
				this.activeSessionId = next;
				this.sessionTitle = next
					? (this.sessionList.find((s) => s.sessionId === next)?.title ?? null)
					: null;
			}
		});
		if (this.activeSessionId) {
			await this.switchSession(this.activeSessionId);
		}
	}

	/** 清空所有本地状态并中止全部会话的前端 SSE（离开页等） */
	resetConversation(): void {
		for (const st of Object.values(this.stateBySession)) {
			st.abortStream?.();
		}
		runInAction(() => {
			this.stateBySession = {};
			this.activeSessionId = null;
			this.sessionTitle = null;
			this.streamingSessionId = null;
			this.sessionList = [];
			this.sessionsPage = { pageNo: 1, pageSize: 20, total: 0 };
			this.pendingIntentPrefix = '';
			this.loadError = null;
		});
		EnglishPackStore.setSidebarIntentPrefix('');
	}

	stopGenerating(): void {
		const sid = this.streamingSessionId ?? this.activeSessionId;
		if (!sid) return;
		const st = this.ensureSessionState(sid);
		st.abortStream?.();
		void (async () => {
			try {
				await stopAgentStream({ sessionId: sid });
			} catch {
				// Toast 由 http 层处理
			}
		})();
		runInAction(() => {
			st.abortStream = null;
			st.isSending = false;
			st.toolStatus = null;
			st.messages = st.messages.map((m) => {
				if (!m.isStreaming) return m;
				return { ...m, isStreaming: false, isStopped: true };
			});
			if (this.streamingSessionId === sid) {
				this.streamingSessionId = null;
			}
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

		const titleFallback =
			options?.titleFallback ?? this.sessionTitle ?? '英语学习';

		const sid = await this.ensureSession(titleFallback);
		if (!sid) return;

		const st = this.ensureSessionState(sid);
		if (st.isSending || st.messages.some((m) => m.isStreaming)) {
			Toast({ type: 'warning', title: '请等待当前回复结束后再试' });
			return;
		}

		st.abortStream?.();
		runInAction(() => {
			st.abortStream = null;
			st.isSending = true;
			st.toolStatus = null;
		});

		const intentPrefixSnapshot = this.pendingIntentPrefix.trim();
		runInAction(() => {
			this.pendingIntentPrefix = '';
		});
		EnglishPackStore.setSidebarIntentPrefix('');

		const userChatId = uuidv4();
		const assistantChatId = uuidv4();
		let userRowId = userChatId;
		let assistantRowId = assistantChatId;

		runInAction(() => {
			st.messages.push({
				chatId: userRowId,
				role: 'user',
				content: userText,
				timestamp: new Date(),
			});
			st.messages.push({
				chatId: assistantRowId,
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
				const idx = st.messages.findIndex((m) => m.chatId === assistantRowId);
				if (idx < 0) return;
				const prev = st.messages[idx] as Message;
				st.messages[idx] = {
					...prev,
					content: accumulated,
				};
			});
		};

		const patchAssistantOrganic = (organic: SearchOrganicItem[]) => {
			runInAction(() => {
				const idx = st.messages.findIndex((m) => m.chatId === assistantRowId);
				if (idx < 0) return;
				const prev = st.messages[idx] as Message;
				st.messages[idx] = {
					...prev,
					searchOrganic: organic,
				};
			});
		};

		runInAction(() => {
			this.streamingSessionId = sid;
		});

		try {
			const abort = await streamAgentSse({
				body: {
					sessionId: sid,
					content: userText,
					assistMode: 'english_learning',
					...(intentPrefixSnapshot
						? { intentPrefix: intentPrefixSnapshot }
						: {}),
				},
				callbacks: {
					onMessageIds: ({ userMessageId, assistantMessageId }) => {
						runInAction(() => {
							const ui = st.messages.findIndex((m) => m.chatId === userRowId);
							const ai = st.messages.findIndex(
								(m) => m.chatId === assistantRowId,
							);
							if (ui >= 0) {
								const prev = st.messages[ui] as Message;
								st.messages[ui] = {
									...prev,
									chatId: userMessageId,
								};
							}
							if (ai >= 0) {
								const prev = st.messages[ai] as Message;
								st.messages[ai] = {
									...prev,
									chatId: assistantMessageId,
								};
							}
							userRowId = userMessageId;
							assistantRowId = assistantMessageId;
						});
					},
					onDelta: (d) => patchAssistant(d),
					onSearchOrganic: (organic) => patchAssistantOrganic(organic),
					onTool: (ev) => {
						runInAction(() => {
							st.toolStatus =
								ev.phase === 'start'
									? ev.name
										? `调用工具：${ev.name}…`
										: '检索中…'
									: null;
						});
					},
					onComplete: (err) => {
						runInAction(() => {
							st.isSending = false;
							const idx = st.messages.findIndex(
								(m) => m.chatId === assistantRowId,
							);
							if (idx >= 0) {
								const prev = st.messages[idx] as Message;
								if (prev.isStreaming) {
									st.messages[idx] = {
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
							st.abortStream = null;
							st.toolStatus = null;
							if (this.streamingSessionId === sid) {
								this.streamingSessionId = null;
							}
						});
						void this.refreshSessionList();
					},
					onError: () => {
						runInAction(() => {
							st.isSending = false;
							const idx = st.messages.findIndex(
								(m) => m.chatId === assistantRowId,
							);
							if (idx >= 0) {
								const prev = st.messages[idx] as Message;
								st.messages[idx] = {
									...prev,
									isStreaming: false,
									content: prev.content || '请求中断',
								};
							}
							st.abortStream = null;
							st.toolStatus = null;
							if (this.streamingSessionId === sid) {
								this.streamingSessionId = null;
							}
						});
					},
				},
			});
			runInAction(() => {
				st.abortStream = abort;
			});
		} catch {
			runInAction(() => {
				st.isSending = false;
				const idx = st.messages.findIndex((m) => m.chatId === assistantRowId);
				if (idx >= 0) {
					const prev = st.messages[idx] as Message;
					st.messages[idx] = { ...prev, isStreaming: false };
				}
				st.abortStream = null;
				if (this.streamingSessionId === sid) {
					this.streamingSessionId = null;
				}
			});
		}
	}
}

const _englishAgentStore = new EnglishAgentStore();
export const englishAgentStore = _englishAgentStore;
export default englishAgentStore;
