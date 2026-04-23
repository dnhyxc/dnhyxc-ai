/**
 * 文档侧边助手 Store（MobX 版本）。
 *
 * 设计目标：
 * - 按 documentKey（文档标识）隔离会话与流式状态：切换文档不应影响其它文档的流式输出
 * - 支持 persistenceAllowed：允许持久化时走 sessionId + 落库；不允许时走 ephemeral + contextTurns
 * - 支持首次保存后迁入对话：import transcript → 绑定到新条目
 *
 * 你可以把本文件改造成 Zustand/Redux 版本；只要对外 API 保持即可。
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import type { AssistantRole } from './assistantApi';
import {
	createAssistantSession,
	getAssistantSessionByArticle,
	getAssistantSessionDetail,
	importAssistantTranscript,
	patchAssistantSessionBinding,
	stopAssistantStream,
} from './assistantApi';
import { streamAssistantSse } from './assistantSse';
import { canonicalAssistantDocumentKey } from './knowledgeAssistantKeys';

export type UiMessage = {
	id?: string;
	chatId: string;
	role: AssistantRole;
	content: string;
	createdAt?: Date;
	timestamp: Date;
	isStreaming?: boolean;
	isStopped?: boolean;
	thinkContent?: string;
};

function mapApiMessagesToUi(
	rows: Array<{
		id: string;
		role: AssistantRole;
		content: string;
		createdAt: string;
	}>,
): UiMessage[] {
	return rows.map((m) => ({
		id: m.id,
		chatId: m.id,
		role: m.role,
		content: m.content ?? '',
		timestamp: new Date(m.createdAt),
		createdAt: new Date(m.createdAt),
		isStreaming: false,
	}));
}

function buildImportTranscriptLinesFromMessages(
	messages: UiMessage[],
): Array<{ role: AssistantRole; content: string }> {
	const lines = messages
		.filter((m) => m.role === 'user' || m.role === 'assistant')
		.map((m) => ({ role: m.role, content: m.content ?? '' }));
	return lines.slice(-200);
}

function buildEphemeralContextTurnsFromMessages(
	messages: UiMessage[],
): Array<{ role: AssistantRole; content: string }> {
	const turns: Array<{ role: AssistantRole; content: string }> = [];
	for (const m of messages) {
		if (m.role !== 'user' && m.role !== 'assistant') continue;
		if (m.role === 'assistant' && m.isStreaming && !(m.content ?? '').trim())
			continue;
		turns.push({ role: m.role, content: m.content ?? '' });
	}
	return turns.slice(-120);
}

type DocumentState = {
	sessionId: string | null;
	messages: UiMessage[];
	isHistoryLoading: boolean;
	isSending: boolean;
	loadError: string | null;
	abortStream: (() => void) | null;
	historyHydrated: boolean;
	pendingEphemeralFlush: {
		articleId: string;
		fromDocumentKey: string;
		toDocumentKey: string;
	} | null;
};

export class AssistantStore {
	activeDocumentKey = '';
	sessionByDocument: Record<string, string> = {};
	persistenceAllowed = true;

	private stateByDocument: Record<string, DocumentState> = {};

	constructor() {
		makeAutoObservable(this);
	}

	private canonicalKey(documentKey: string): string {
		return canonicalAssistantDocumentKey(documentKey);
	}

	private ensureState(documentKey: string): DocumentState {
		const key = this.canonicalKey(documentKey);
		if (!key) {
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

	private get activeState(): DocumentState {
		return this.ensureState(this.activeDocumentKey);
	}

	get sessionId(): string | null {
		return this.activeState.sessionId;
	}

	get messages(): UiMessage[] {
		return this.activeState.messages;
	}

	get isHistoryLoading(): boolean {
		return this.activeState.isHistoryLoading;
	}

	get isSending(): boolean {
		return this.activeState.isSending;
	}

	get isStreaming(): boolean {
		return this.messages.some((m) => m.isStreaming);
	}

	setPersistenceAllowed(allowed: boolean) {
		runInAction(() => {
			this.persistenceAllowed = allowed;
		});
	}

	/** 切换文档时调用：仅切换 active 指针；需要持久化时再 hydrate 历史 */
	async activateForDocument(documentKey: string): Promise<void> {
		const next = (documentKey ?? '').trim();
		if (!next) return;
		const canonical = this.canonicalKey(next);
		runInAction(() => {
			this.activeDocumentKey = next;
			this.ensureState(canonical);
		});

		if (!this.persistenceAllowed) return;

		const state = this.ensureState(canonical);
		if (state.historyHydrated) return;

		let sid = this.sessionByDocument[canonical] ?? state.sessionId ?? null;

		// 可选：如果 canonical 自身就是稳定条目 id，可直接用它做 binding
		if (!sid && canonical) {
			runInAction(() => {
				state.isHistoryLoading = true;
			});
			try {
				const res = await getAssistantSessionByArticle(canonical);
				if (res?.session?.sessionId) {
					sid = res.session.sessionId;
					runInAction(() => {
						this.sessionByDocument[canonical] = sid!;
						state.sessionId = sid!;
						state.messages = mapApiMessagesToUi(res.messages ?? []);
					});
				}
			} finally {
				runInAction(() => {
					state.isHistoryLoading = false;
					state.historyHydrated = true;
				});
			}
		}

		if (!sid) {
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
			const detail = await getAssistantSessionDetail(sid);
			runInAction(() => {
				state.messages = mapApiMessagesToUi(detail.messages ?? []);
			});
		} finally {
			runInAction(() => {
				state.isHistoryLoading = false;
				state.historyHydrated = true;
			});
		}
	}

	/** 首次保存仍在流式时：登记迁入任务，等流式结束后自动 flush */
	scheduleEphemeralFlushAfterStreaming(input: {
		articleId: string;
		fromDocumentKey: string;
		toDocumentKey: string;
	}) {
		const state = this.ensureState(input.fromDocumentKey);
		runInAction(() => {
			state.pendingEphemeralFlush = { ...input };
			state.historyHydrated = true;
		});
	}

	/** 首次保存成功时：把 ephemeral 对话迁入并绑定到新条目 */
	async flushEphemeralTranscriptIfNeeded(input: {
		articleId: string;
		fromDocumentKey: string;
		toDocumentKey: string;
	}): Promise<void> {
		const from = this.canonicalKey(input.fromDocumentKey);
		const to = this.canonicalKey(input.toDocumentKey);
		const source =
			this.stateByDocument[from] ??
			this.stateByDocument[to] ??
			this.ensureState(from);
		const lines = buildImportTranscriptLinesFromMessages(source.messages);
		if (!lines.length) return;

		const res = await importAssistantTranscript({
			knowledgeArticleId: input.articleId,
			lines,
		});
		const sid = res?.sessionId;
		if (!sid) return;

		runInAction(() => {
			delete this.sessionByDocument[from];
			this.sessionByDocument[to] = sid;
			const toState = this.ensureState(to);
			toState.sessionId = sid;
			toState.historyHydrated = true;
			toState.pendingEphemeralFlush = null;
			if (this.activeDocumentKey === input.fromDocumentKey) {
				this.activeDocumentKey = input.toDocumentKey;
			}
		});
	}

	/** 需要持久化时确保 sessionId（首轮发送前创建） */
	async ensureSessionForCurrentDocument(): Promise<string | null> {
		if (!this.persistenceAllowed) return null;
		const key = (this.activeDocumentKey ?? '').trim();
		if (!key) return null;
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
		const created = await createAssistantSession({
			knowledgeArticleId: canonical,
		});
		if (!created?.sessionId) return null;
		runInAction(() => {
			this.sessionByDocument[canonical] = created.sessionId;
			state.sessionId = created.sessionId;
			state.historyHydrated = true;
		});
		return created.sessionId;
	}

	async persistArticleBindingOnServer(sessionId: string, articleId: string) {
		await patchAssistantSessionBinding(sessionId, {
			knowledgeArticleId: articleId,
		});
	}

	async sendMessage(
		text: string,
		options?: { extraUserContentForModel?: string },
	) {
		const rawKey = (this.activeDocumentKey ?? '').trim();
		if (!rawKey) return;
		const canonical = this.canonicalKey(rawKey);
		const state = this.ensureState(canonical);

		const content = (text ?? '').trim();
		if (!content || state.isSending || state.isHistoryLoading) return;
		const extra = options?.extraUserContentForModel?.trim();

		const ephemeral = !this.persistenceAllowed;
		let sid: string | null = null;
		if (!ephemeral) {
			sid = await this.ensureSessionForCurrentDocument();
			if (!sid) return;
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
				content,
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

		let acc = '';
		let thinkBuf = '';
		const applyPatch = (delta: string, thinkDelta?: string) => {
			if (delta) acc += delta;
			if (thinkDelta) thinkBuf += thinkDelta;
			runInAction(() => {
				const idx = state.messages.findIndex(
					(m) => m.chatId === assistantChatId,
				);
				if (idx < 0) return;
				const prev = state.messages[idx];
				state.messages[idx] = { ...prev, content: acc, thinkContent: thinkBuf };
			});
		};

		try {
			const abort = await streamAssistantSse({
				url: '/assistant/sse', // TODO：替换为你的真实地址（或在外层拼好完整 URL）
				body: ephemeral
					? {
							ephemeral: true,
							content,
							...(extra ? { extraUserContentForModel: extra } : {}),
							contextTurns,
						}
					: {
							sessionId: sid,
							content,
							...(extra ? { extraUserContentForModel: extra } : {}),
						},
				callbacks: {
					onDelta: (d) => applyPatch(d),
					onThinking: (t) => applyPatch('', t),
					onComplete: async (err) => {
						runInAction(() => {
							state.isSending = false;
							const idx = state.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								const prev = state.messages[idx];
								state.messages[idx] = {
									...prev,
									isStreaming: false,
									isStopped: Boolean(err),
									content:
										prev.content || (err ? `生成失败：${err}` : prev.content),
								};
							}
						});
						state.abortStream = null;

						const pending = state.pendingEphemeralFlush;
						if (pending && !state.messages.some((m) => m.isStreaming)) {
							try {
								await this.flushEphemeralTranscriptIfNeeded({
									articleId: pending.articleId,
									fromDocumentKey: pending.fromDocumentKey,
									toDocumentKey: pending.toDocumentKey,
								});
							} finally {
								runInAction(() => {
									state.pendingEphemeralFlush = null;
								});
							}
						}
					},
					onError: () => {
						runInAction(() => {
							state.isSending = false;
							const idx = state.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								const prev = state.messages[idx];
								state.messages[idx] = {
									...prev,
									isStreaming: false,
									isStopped: true,
								};
							}
							state.pendingEphemeralFlush = null;
						});
						state.abortStream = null;
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
					const prev = state.messages[idx];
					state.messages[idx] = {
						...prev,
						isStreaming: false,
						isStopped: true,
					};
				}
				state.pendingEphemeralFlush = null;
			});
			state.abortStream = null;
		}
	}

	async stopGenerating(): Promise<void> {
		this.activeState.abortStream?.();
		this.activeState.abortStream = null;
		runInAction(() => {
			this.activeState.isSending = false;
			this.activeState.messages = this.activeState.messages.map((m) =>
				m.isStreaming ? { ...m, isStreaming: false, isStopped: true } : m,
			);
		});
		const sid = this.activeState.sessionId;
		if (sid) {
			try {
				await stopAssistantStream(sid);
			} catch {
				// 忽略：后端不支持或无进行中任务
			}
		}
	}
}

export const assistantStore = new AssistantStore();
