/**
 * 电子书阅读助手：对接 `/ebook-assistant/*`，按 bookId 隔离多会话。
 * 结构参考 `englishAgent.ts`，会话与消息独立于 knowledge `assistantStore`。
 */
import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import type { UIEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
	createEbookAssistantSession,
	deleteEbookAssistantSession,
	getEbookAssistantSessionByBook,
	getEbookAssistantSessionDetail,
	getEbookAssistantSessionsByBook,
	stopEbookAssistantStream,
} from '@/service';
import { EBOOK_ASSISTANT_SSE } from '@/service/api';
import type { Message } from '@/types/chat';
import { AGENT_SSE_USER_ABORT_MARKER, streamAgentSse } from '@/utils/agentSse';
import { createStreamingMobxPatchScheduler } from '@/utils/scheduleStreamingMobxPatch';

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token') || '';
}

function mapApiMessagesToUi(
	list: Array<{
		id: string;
		role: string;
		content: string;
		createdAt: string | Date;
	}>,
): Message[] {
	return list.map((m) => ({
		chatId: m.id,
		role: m.role === 'user' ? 'user' : 'assistant',
		content: m.content,
		timestamp: new Date(m.createdAt),
		isStreaming: false,
	}));
}

export type EbookSessionRuntime = {
	messages: Message[];
	isSending: boolean;
	isHistoryLoading: boolean;
	abortStream: (() => void) | null;
};

export class EbookAssistantStore {
	activeBookId: string | null = null;
	activeSessionId: string | null = null;
	activeSessionByBook: Record<string, string> = {};
	stateBySession: Record<string, EbookSessionRuntime> = {};
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
	bookHydrated: Record<string, boolean> = {};

	constructor() {
		makeAutoObservable(this);
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

	get isHistoryLoading(): boolean {
		const sid = this.activeSessionId;
		if (!sid) return false;
		return Boolean(this.stateBySession[sid]?.isHistoryLoading);
	}

	get isStreaming(): boolean {
		return this.messages.some((m) => m.isStreaming);
	}

	get isEbookSessionSwitcherLocked(): boolean {
		return false;
	}

	private get hasMoreHistorySessions(): boolean {
		return this.sessionList.length < (this.sessionsPage.total ?? 0);
	}

	ensureSessionState(sid: string): EbookSessionRuntime {
		const id = (sid ?? '').trim();
		if (!id) {
			return {
				messages: [],
				isSending: false,
				isHistoryLoading: false,
				abortStream: null,
			};
		}
		if (!this.stateBySession[id]) {
			this.stateBySession[id] = {
				messages: [],
				isSending: false,
				isHistoryLoading: false,
				abortStream: null,
			};
		}
		return this.stateBySession[id]!;
	}

	isSessionStreaming(sessionId: string): boolean {
		const sid = (sessionId ?? '').trim();
		if (!sid) return false;
		return Boolean(
			this.stateBySession[sid]?.messages?.some((m) => m.isStreaming),
		);
	}

	async ensureSession(bookId: string): Promise<string | null> {
		const bid = (bookId ?? '').trim();
		if (!bid) return null;

		// 仅复用当前书籍已绑定的会话，禁止误用其它书的 activeSessionId
		const mappedSid = this.activeSessionByBook[bid];
		if (mappedSid) {
			runInAction(() => {
				this.activeBookId = bid;
				this.activeSessionId = mappedSid;
			});
			return mappedSid;
		}

		if (!readToken()) {
			Toast({ type: 'warning', title: '请先登录后再使用阅读助手' });
			return null;
		}
		try {
			const res = await createEbookAssistantSession({ bookId: bid });
			const sid = res.data?.sessionId;
			if (!sid) {
				Toast({ type: 'error', title: '创建阅读会话失败' });
				return null;
			}
			runInAction(() => {
				this.activeBookId = bid;
				this.activeSessionId = sid;
				this.activeSessionByBook[bid] = sid;
				this.ensureSessionState(sid);
				if (!this.sessionList.some((s) => s.sessionId === sid)) {
					const now = new Date().toISOString();
					this.sessionList = [
						{
							sessionId: sid,
							title: res.data?.title ?? null,
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

	private patchSessionListTitle(sessionId: string, title: string): void {
		const sid = (sessionId ?? '').trim();
		const preview = (title ?? '').trim().slice(0, 60);
		if (!sid || !preview) return;
		runInAction(() => {
			this.sessionList = this.sessionList.map((row) =>
				row.sessionId === sid ? { ...row, title: preview } : row,
			);
		});
	}

	async activateForBook(bookId: string): Promise<void> {
		const bid = (bookId ?? '').trim();
		if (!bid) return;

		const bookChanged = this.activeBookId !== bid;
		runInAction(() => {
			this.activeBookId = bid;
			// 切换书后立即切到该书会话指针，避免仍展示/发送上一本书的 sessionId
			this.activeSessionId = this.activeSessionByBook[bid] ?? null;
			if (bookChanged) {
				this.sessionList = [];
				this.sessionsPage = { pageNo: 1, pageSize: 20, total: 0 };
			}
		});

		if (!readToken()) return;
		if (this.bookHydrated[bid]) {
			return;
		}

		const existingSid = this.activeSessionByBook[bid];
		if (existingSid) {
			runInAction(() => {
				this.activeSessionId = existingSid;
			});
			const st = this.ensureSessionState(existingSid);
			if (st.messages.length > 0 || st.isSending || st.isHistoryLoading) {
				runInAction(() => {
					this.bookHydrated[bid] = true;
				});
				return;
			}
		}

		runInAction(() => {
			if (existingSid) {
				this.ensureSessionState(existingSid).isHistoryLoading = true;
			}
		});

		try {
			const res = existingSid
				? await getEbookAssistantSessionDetail(existingSid)
				: await getEbookAssistantSessionByBook(bid);
			const data = res.data;
			if (data?.session?.sessionId) {
				const sid = data.session.sessionId;
				runInAction(() => {
					this.activeSessionId = sid;
					this.activeSessionByBook[bid] = sid;
					const st = this.ensureSessionState(sid);
					st.messages = mapApiMessagesToUi(data.messages ?? []);
					st.isHistoryLoading = false;
				});
			} else if (existingSid) {
				runInAction(() => {
					this.ensureSessionState(existingSid).isHistoryLoading = false;
				});
			}
		} catch {
			// Toast 由 http 层处理
		} finally {
			runInAction(() => {
				this.bookHydrated[bid] = true;
				if (existingSid) {
					const st = this.stateBySession[existingSid];
					if (st) st.isHistoryLoading = false;
				}
			});
		}
	}

	async switchSession(sessionId: string): Promise<void> {
		if (!readToken()) return;
		const sid = (sessionId ?? '').trim();
		if (!sid) return;
		const bookId = this.activeBookId;
		runInAction(() => {
			this.activeSessionId = sid;
			if (bookId) this.activeSessionByBook[bookId] = sid;
		});
		const st = this.ensureSessionState(sid);
		if (st.messages.length > 0 || st.isHistoryLoading || st.isSending) {
			return;
		}
		runInAction(() => {
			st.isHistoryLoading = true;
		});
		try {
			const res = await getEbookAssistantSessionDetail(sid);
			const payload = res.data;
			runInAction(() => {
				if (!payload?.session) {
					st.messages = [];
				} else {
					st.messages = mapApiMessagesToUi(payload.messages ?? []);
				}
			});
		} finally {
			runInAction(() => {
				st.isHistoryLoading = false;
			});
		}
	}

	async refreshSessionListForCurrentBook(): Promise<void> {
		const bookId = this.activeBookId;
		if (!bookId || !readToken()) return;
		try {
			runInAction(() => {
				this.historySessionLoading = true;
			});
			const pageNo = 1;
			const pageSize = this.sessionsPage.pageSize ?? 20;
			const res = await getEbookAssistantSessionsByBook(bookId, {
				pageNo,
				pageSize,
			});
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
		const bookId = this.activeBookId;
		if (!bookId || !readToken()) return;
		if (this.historySessionLoading || this.historySessionLoadingMore) return;
		if (!this.hasMoreHistorySessions) return;
		const page = this.sessionsPage;
		runInAction(() => {
			this.historySessionLoadingMore = true;
		});
		try {
			const nextPageNo = (page.pageNo ?? 1) + 1;
			const pageSize = page.pageSize ?? 20;
			const res = await getEbookAssistantSessionsByBook(bookId, {
				pageNo: nextPageNo,
				pageSize,
			});
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
		if (this.historySessionLoading || this.historySessionLoadingMore) return;
		if (!this.hasMoreHistorySessions) return;
		const el = e.currentTarget;
		const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (remaining > 80) return;
		void this.loadMoreSessionList();
	};

	async createNewSession(): Promise<string | null> {
		const bookId = this.activeBookId;
		if (!bookId) {
			Toast({ type: 'warning', title: '书籍未就绪' });
			return null;
		}
		if (!readToken()) {
			Toast({ type: 'warning', title: '请先登录后再使用阅读助手' });
			return null;
		}
		await this.refreshSessionListForCurrentBook();
		const active = this.activeSessionId;
		if (active) {
			const cur = this.ensureSessionState(active);
			const curStreaming = cur.messages.some((m) => m.isStreaming);
			if (
				cur.messages.length === 0 &&
				!cur.isSending &&
				!curStreaming &&
				!cur.isHistoryLoading
			) {
				return active;
			}
		}
		try {
			const res = await createEbookAssistantSession({
				bookId,
				forceNew: true,
			});
			const sid = res.data?.sessionId;
			if (!sid) {
				Toast({ type: 'error', title: '创建新对话失败' });
				return null;
			}
			runInAction(() => {
				this.activeSessionId = sid;
				this.activeSessionByBook[bookId] = sid;
				const st = this.ensureSessionState(sid);
				st.messages = [];
				st.isSending = false;
				st.isHistoryLoading = false;
			});
			void this.refreshSessionListForCurrentBook();
			return sid;
		} catch {
			Toast({ type: 'error', title: '创建新对话失败' });
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
			await deleteEbookAssistantSession(sid);
		} catch {
			return;
		}
		const bookId = this.activeBookId;
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
				if (bookId) {
					this.activeSessionByBook[bookId] = next ?? '';
					if (!next) delete this.activeSessionByBook[bookId];
				}
			}
		});
		if (this.activeSessionId) {
			await this.switchSession(this.activeSessionId);
		}
	}

	stopGenerating(): void {
		const sid = this.streamingSessionId ?? this.activeSessionId;
		if (!sid) return;
		const st = this.ensureSessionState(sid);
		st.abortStream?.();
		void (async () => {
			try {
				await stopEbookAssistantStream({ sessionId: sid });
			} catch {
				// Toast 由 http 层处理
			}
		})();
		runInAction(() => {
			st.abortStream = null;
			st.isSending = false;
			st.messages = st.messages.map((m) => {
				if (!m.isStreaming) return m;
				return { ...m, isStreaming: false, isStopped: true };
			});
			if (this.streamingSessionId === sid) {
				this.streamingSessionId = null;
			}
		});
	}

	async sendMessage(
		rawText: string,
		options?: { bookId?: string; extraUserContentForModel?: string },
	): Promise<void> {
		const userText = (rawText ?? '').trim();
		if (!userText) return;
		const bookId = (options?.bookId ?? this.activeBookId ?? '').trim();
		if (!bookId) {
			Toast({ type: 'warning', title: '书籍未就绪' });
			return;
		}
		if (!readToken()) {
			Toast({ type: 'warning', title: '请先登录后再使用阅读助手' });
			return;
		}

		if (this.activeBookId !== bookId || !this.bookHydrated[bookId]) {
			await this.activateForBook(bookId);
		}

		const sid = await this.ensureSession(bookId);
		if (!sid) return;

		const st = this.ensureSessionState(sid);
		if (st.isSending || st.messages.some((m) => m.isStreaming)) {
			Toast({ type: 'warning', title: '请等待当前回复结束后再试' });
			return;
		}

		this.patchSessionListTitle(sid, userText);

		st.abortStream?.();
		runInAction(() => {
			st.abortStream = null;
			st.isSending = true;
		});

		const userChatId = uuidv4();
		const assistantChatId = uuidv4();
		let userRowId = userChatId;
		let assistantRowId = assistantChatId;
		let accumulated = '';

		runInAction(() => {
			st.messages.push({
				chatId: userChatId,
				role: 'user',
				content: userText,
				timestamp: new Date(),
			});
			st.messages.push({
				chatId: assistantChatId,
				role: 'assistant',
				content: '',
				timestamp: new Date(),
				isStreaming: true,
				thinkContent: '',
			});
		});

		const flushAssistantPatch = () => {
			runInAction(() => {
				const idx = st.messages.findIndex((m) => m.chatId === assistantRowId);
				if (idx < 0) return;
				const prev = st.messages[idx] as Message;
				if (prev.content === accumulated) return;
				prev.content = accumulated;
			});
		};
		const assistantPatchScheduler =
			createStreamingMobxPatchScheduler(flushAssistantPatch);

		const patchAssistant = (delta: string) => {
			if (delta) accumulated += delta;
			assistantPatchScheduler.schedule();
		};

		runInAction(() => {
			this.streamingSessionId = sid;
		});

		try {
			const abort = await streamAgentSse({
				api: EBOOK_ASSISTANT_SSE,
				body: {
					sessionId: sid,
					bookId,
					content: userText,
					...(options?.extraUserContentForModel?.trim()
						? {
								extraUserContentForModel:
									options.extraUserContentForModel.trim(),
							}
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
								st.messages[ui] = { ...prev, chatId: userMessageId };
							}
							if (ai >= 0) {
								const prev = st.messages[ai] as Message;
								st.messages[ai] = { ...prev, chatId: assistantMessageId };
							}
							userRowId = userMessageId;
							assistantRowId = assistantMessageId;
						});
					},
					onDelta: (d) => patchAssistant(d),
					onComplete: (err) => {
						assistantPatchScheduler.flush();
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
							if (this.streamingSessionId === sid) {
								this.streamingSessionId = null;
							}
						});
						void this.refreshSessionListForCurrentBook();
					},
					onError: () => {
						assistantPatchScheduler.flush();
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
			assistantPatchScheduler.flush();
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

	resetForBook(bookId?: string): void {
		if (bookId) {
			runInAction(() => {
				delete this.bookHydrated[bookId];
				delete this.activeSessionByBook[bookId];
				if (this.activeBookId === bookId) {
					this.activeBookId = null;
					this.activeSessionId = null;
					this.sessionList = [];
				}
			});
			return;
		}
		for (const st of Object.values(this.stateBySession)) {
			st.abortStream?.();
		}
		runInAction(() => {
			this.stateBySession = {};
			this.activeBookId = null;
			this.activeSessionId = null;
			this.activeSessionByBook = {};
			this.streamingSessionId = null;
			this.sessionList = [];
			this.sessionsPage = { pageNo: 1, pageSize: 20, total: 0 };
			this.bookHydrated = {};
		});
	}
}

const _ebookAssistantStore = new EbookAssistantStore();
export const ebookAssistantStore = _ebookAssistantStore;
export default ebookAssistantStore;
