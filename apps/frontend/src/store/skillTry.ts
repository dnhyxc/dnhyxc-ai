/**
 * Skill 侧栏：试跑 / 生成。
 * 多会话按 stateBySession 隔离（对齐英语学习 / 知识库助手）：切换历史、新对话、Skill、模式不中断其它会话 SSE。
 */
import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import type { UIEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
	bindSkillTrySession,
	createSkillTrySession,
	deleteAgentSession,
	getAgentSessionDetail,
	listSkillTrySessions,
	stopAgentStream,
	updateAgentSessionTitle,
} from '@/service';
import type { Message, SearchOrganicItem } from '@/types/chat';
import { AGENT_SSE_USER_ABORT_MARKER, streamAgentSse } from '@/utils/agentSse';
import { createStreamingMobxPatchScheduler } from '@/utils/scheduleStreamingMobxPatch';

export type SkillPanelMode = 'try' | 'generate';

/** 新建未保存时的生成会话桶 key（非真实 skillId） */
export const GENERATE_DRAFT_SCOPE = '__draft__';

const INTENT_DRAFT_BODY_CAP = 12_000;

function scopeKey(skillId: string | null | undefined): string {
	return skillId?.trim() || GENERATE_DRAFT_SCOPE;
}

function buildGenerateIntentPrefix(title: string, content: string): string {
	let body = content;
	let truncated = false;
	if (body.length > INTENT_DRAFT_BODY_CAP) {
		body = body.slice(0, INTENT_DRAFT_BODY_CAP);
		truncated = true;
	}
	return `【当前编辑器草稿（仅本轮参考，可改写）】\n标题：${title || '（空）'}\n正文：\n${body || '（空）'}${truncated ? '\n\n（正文已截断）' : ''}\n`;
}

function needsGenerateDraftPrefix(opts: {
	messageCountBeforeSend: number;
	draftTitle: string;
	draftContent: string;
	lastApplied?: { title: string; content: string };
}): boolean {
	const hasDraft = Boolean(opts.draftTitle || opts.draftContent);
	if (!hasDraft) return false;
	if (opts.messageCountBeforeSend === 0) return true;
	const la = opts.lastApplied;
	if (!la) return true;
	return opts.draftTitle !== la.title || opts.draftContent !== la.content;
}

type SessionRuntime = {
	messages: Message[];
	isSending: boolean;
	isHistoryLoading: boolean;
	abortStream: (() => void) | null;
};

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
		appliedSkills?: Array<{ id: string; title: string }> | null;
		createdAt: string | Date;
	}>,
): Message[] {
	return list.map((m) => ({
		chatId: m.id,
		id: m.id,
		role: m.role === 'user' ? 'user' : 'assistant',
		content: m.content,
		searchOrganic: m.searchOrganic ?? undefined,
		...(m.appliedSkills?.length ? { appliedSkills: m.appliedSkills } : {}),
		timestamp: new Date(m.createdAt),
		isStreaming: false,
	}));
}

/** 流结束时统一正文：保留已生成内容；失败/空响应给出可读文案，避免空白气泡 */
function resolveAssistantEndContent(opts: {
	accumulated: string;
	prevContent: string;
	err?: string;
}): string {
	const userAborted = opts.err === AGENT_SSE_USER_ABORT_MARKER;
	const kept = opts.accumulated || opts.prevContent || '';
	if (kept.trim()) return kept;
	if (userAborted) return '';
	if (opts.err) return `生成失败：${opts.err}`;
	return '本轮未生成文本，请重试';
}

/** 从 Agent 回复解析标题 + 正文，供写入 Monaco（须与气泡所见一致） */
export function parseSkillDraft(raw: string): {
	title: string;
	content: string;
} {
	const text = (raw ?? '').trim();
	if (!text) return { title: '', content: '' };

	// 仅当整段就是一个代码围栏时才解包；禁止摘取文中第一个 ```，否则气泡全文与写入内容会分叉
	const wholeFence = text.match(
		/^```(?:skill|markdown)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i,
	);
	const body = (wholeFence?.[1] ?? text).trim();

	const heading = body.match(/^#\s+(.+?)\s*\r?\n([\s\S]*)$/);
	if (heading) {
		return {
			title: heading[1].trim().slice(0, 200),
			content: heading[2].trim(),
		};
	}
	const lines = body.split(/\r?\n/);
	const first = (lines[0] ?? '').replace(/^#\s*/, '').trim() || '未命名 Skill';
	const rest = lines.slice(1).join('\n').trim();
	return {
		title: first.slice(0, 200),
		content: rest || body,
	};
}

class SkillTryStore {
	mode: SkillPanelMode = 'try';
	/** 当前界面展示的会话 */
	activeSessionId: string | null = null;
	sessionTitle: string | null = null;
	/** 当前编辑的 Skill；生成新建时为 null（草稿桶） */
	boundSkillId: string | null = null;
	/** 各 scope（skillId 或 __draft__）上次展示的会话 */
	activeSessionBySkill: Record<string, string | null> = {};
	/** 生成：各 scope 上次「应用到编辑器」或打开时的正文基线（控 intentPrefix） */
	lastAppliedByScope: Record<string, { title: string; content: string }> = {};
	/** 各会话独立运行态，支持后台继续流式 */
	stateBySession: Record<string, SessionRuntime> = {};

	sessionList: Array<{
		sessionId: string;
		title: string | null;
		createdAt: string;
		updatedAt: string;
	}> = [];
	sessionsPage = { pageNo: 1, pageSize: 20, total: 0 };
	historySessionLoading = false;
	historySessionLoadingMore = false;

	constructor() {
		makeAutoObservable(this);
	}

	private currentScopeKey(): string {
		// try / generate 分桶，否则切模式会复用对方会话指针
		return `${this.mode}:${scopeKey(this.boundSkillId)}`;
	}

	/** 打开 Skill / 新建 / 保存后对齐编辑器基线，避免无谓全文注入 */
	syncEditorBaseline(title: string, content: string): void {
		const key = this.currentScopeKey();
		this.lastAppliedByScope[key] = {
			title: (title ?? '').trim(),
			content: content ?? '',
		};
	}

	/** 「应用到编辑器」后更新基线 */
	markEditorApplied(title: string, content: string): void {
		this.syncEditorBaseline(title, content);
	}

	/**
	 * 新建草稿首次保存：把草稿桶会话 bind 到新 skillId，并迁移本地指针。
	 * 须在 skillStore 写入 editingId 之前调用，避免 bindSkill(新 id) 把 activeSession 清成空。
	 */
	async attachDraftToSkill(skillId: string): Promise<void> {
		const kid = skillId.trim();
		if (!kid || !readToken()) return;
		const draftKey = `generate:${GENERATE_DRAFT_SCOPE}`;
		const skillKey = `generate:${kid}`;
		const toBind = new Set<string>();
		const draftSid = this.activeSessionBySkill[draftKey];
		if (draftSid) toBind.add(draftSid);
		if (this.activeSessionId && this.boundSkillId == null) {
			toBind.add(this.activeSessionId);
		}
		const moved =
			this.activeSessionId && this.boundSkillId == null
				? this.activeSessionId
				: (draftSid ?? this.activeSessionId);
		for (const sid of toBind) {
			try {
				await bindSkillTrySession(sid, kid);
			} catch {
				/* 已绑定或非 generate 则忽略 */
			}
		}
		runInAction(() => {
			this.activeSessionBySkill[skillKey] = moved ?? null;
			delete this.activeSessionBySkill[draftKey];
			const baseline = this.lastAppliedByScope[draftKey];
			if (baseline) {
				this.lastAppliedByScope[skillKey] = baseline;
				delete this.lastAppliedByScope[draftKey];
			}
			this.boundSkillId = kid;
			if (moved) {
				this.activeSessionId = moved;
				this.ensureSessionState(moved);
				const row = this.sessionList.find((s) => s.sessionId === moved);
				if (row?.title != null) this.sessionTitle = row.title;
			}
		});
		await this.refreshSessionList(kid);
		this.hydrateActiveIfNeeded();
	}

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

	get isHistoryLoading(): boolean {
		const sid = this.activeSessionId;
		if (!sid) return false;
		return Boolean(this.stateBySession[sid]?.isHistoryLoading);
	}

	get isStreaming(): boolean {
		return this.messages.some((m) => m.isStreaming);
	}

	get hasMoreHistorySessions(): boolean {
		return this.sessionList.length < (this.sessionsPage.total ?? 0);
	}

	ensureSessionState(sid: string): SessionRuntime {
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
		const st = this.stateBySession[sid];
		return Boolean(st?.isSending || st?.messages?.some((m) => m.isStreaming));
	}

	private rememberActiveForCurrentScope(): void {
		this.activeSessionBySkill[this.currentScopeKey()] = this.activeSessionId;
	}

	private restoreActiveForCurrentScope(): void {
		this.activeSessionId =
			this.activeSessionBySkill[this.currentScopeKey()] ?? null;
		const sid = this.activeSessionId;
		if (!sid) {
			this.sessionTitle = null;
			return;
		}
		this.ensureSessionState(sid);
		const row = this.sessionList.find((s) => s.sessionId === sid);
		this.sessionTitle = row?.title ?? this.sessionTitle;
	}

	/** 恢复展示会话后，若本地无缓存则拉详情（不中止流） */
	private hydrateActiveIfNeeded(): void {
		const sid = this.activeSessionId;
		if (!sid) return;
		const st = this.ensureSessionState(sid);
		if (st.messages.length > 0 || st.isSending || st.isHistoryLoading) return;
		void this.switchSession(sid);
	}

	/** 切换试跑 / 生成：不中止对方模式后台流 */
	setMode(mode: SkillPanelMode): void {
		if (mode === this.mode) return;
		runInAction(() => {
			this.rememberActiveForCurrentScope();
			this.mode = mode;
			this.sessionList = [];
			this.sessionsPage = { pageNo: 1, pageSize: 20, total: 0 };
			this.restoreActiveForCurrentScope();
		});
		this.hydrateActiveIfNeeded();
		void this.refreshSessionList();
	}

	/**
	 * 切 Skill / 新建：记住并恢复该 scope 的会话指针，不中止其它会话 SSE。
	 * try / generate 同一套锚定。
	 */
	bindSkill(skillId: string | null): void {
		if (skillId === this.boundSkillId) return;
		runInAction(() => {
			this.rememberActiveForCurrentScope();
			this.boundSkillId = skillId;
			this.sessionList = [];
			this.sessionsPage = { pageNo: 1, pageSize: 20, total: 0 };
			this.restoreActiveForCurrentScope();
		});
		this.hydrateActiveIfNeeded();
		if (this.mode === 'try' && !skillId) return;
		void this.refreshSessionList(skillId);
	}

	/** 新对话：只切展示指针，不中止当前/其它会话流式 */
	newChat(): void {
		runInAction(() => {
			this.activeSessionId = null;
			this.sessionTitle = null;
			this.rememberActiveForCurrentScope();
		});
	}

	resetOnUserSwitch(): void {
		for (const st of Object.values(this.stateBySession)) {
			st.abortStream?.();
		}
		runInAction(() => {
			this.mode = 'try';
			this.activeSessionId = null;
			this.sessionTitle = null;
			this.boundSkillId = null;
			this.activeSessionBySkill = {};
			this.lastAppliedByScope = {};
			this.stateBySession = {};
			this.sessionList = [];
			this.sessionsPage = { pageNo: 1, pageSize: 20, total: 0 };
		});
	}

	/** 仅停止当前展示会话（用户点停止） */
	stopGenerating(): void {
		const sid = this.activeSessionId;
		if (!sid) return;
		const st = this.ensureSessionState(sid);
		st.abortStream?.();
		void stopAgentStream({ sessionId: sid }).catch(() => undefined);
		runInAction(() => {
			st.abortStream = null;
			st.isSending = false;
			st.messages = st.messages.map((m) =>
				m.isStreaming ? { ...m, isStreaming: false, isStopped: true } : m,
			);
		});
	}

	async refreshSessionList(skillId?: string | null): Promise<void> {
		const sid =
			skillId !== undefined
				? skillId?.trim() || null
				: this.boundSkillId?.trim() || null;
		if (!readToken()) {
			runInAction(() => {
				this.sessionList = [];
				this.sessionsPage = { pageNo: 1, pageSize: 20, total: 0 };
			});
			return;
		}
		if (this.mode === 'try' && !sid) {
			runInAction(() => {
				this.sessionList = [];
				this.sessionsPage = { pageNo: 1, pageSize: 20, total: 0 };
			});
			return;
		}
		try {
			runInAction(() => {
				this.historySessionLoading = true;
			});
			const pageNo = 1;
			const pageSize = this.sessionsPage.pageSize ?? 20;
			const res = await listSkillTrySessions({
				...(sid ? { skillId: sid } : {}),
				kind: this.mode,
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
					if (this.activeSessionId) {
						const row = this.sessionList.find(
							(s) => s.sessionId === this.activeSessionId,
						);
						if (row?.title != null) this.sessionTitle = row.title;
					}
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
		if (this.mode === 'try' && !this.boundSkillId) return;
		const page = this.sessionsPage;
		runInAction(() => {
			this.historySessionLoadingMore = true;
		});
		try {
			const nextPageNo = (page.pageNo ?? 1) + 1;
			const pageSize = page.pageSize ?? 20;
			const sid = this.boundSkillId?.trim() || null;
			const res = await listSkillTrySessions({
				...(sid ? { skillId: sid } : {}),
				kind: this.mode,
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
		if (this.historySessionLoading) return;
		if (this.historySessionLoadingMore) return;
		if (!this.hasMoreHistorySessions) return;
		const el = e.currentTarget;
		const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (remaining > 80) return;
		void this.loadMoreSessionList();
	};

	private patchSessionListTitle(sessionId: string, title: string): void {
		const sid = (sessionId ?? '').trim();
		const preview = (title ?? '').trim();
		if (!sid || !preview) return;
		runInAction(() => {
			this.sessionTitle =
				this.activeSessionId === sid ? preview : this.sessionTitle;
			this.sessionList = this.sessionList.map((row) =>
				row.sessionId === sid
					? { ...row, title: preview, updatedAt: new Date().toISOString() }
					: row,
			);
		});
	}

	async renameSession(sessionId: string, rawTitle: string): Promise<boolean> {
		const sid = (sessionId ?? '').trim();
		const title = (rawTitle ?? '').trim().slice(0, 255);
		if (!sid || !title) return false;
		if (!readToken()) return false;
		try {
			const res = await updateAgentSessionTitle(sid, title);
			const next = res.data?.title?.trim() || title;
			this.patchSessionListTitle(sid, next);
			Toast({ type: 'success', title: '会话标题更新成功' });
			return true;
		} catch {
			return false;
		}
	}

	/** 切换展示会话；本地已有消息/发送中则不重拉，不中止其它 SSE */
	async switchSession(sessionId: string): Promise<void> {
		if (!readToken()) return;
		const sid = (sessionId ?? '').trim();
		if (!sid) return;
		runInAction(() => {
			this.activeSessionId = sid;
			this.rememberActiveForCurrentScope();
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
					this.sessionTitle = null;
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
			for (const [k, v] of Object.entries(this.activeSessionBySkill)) {
				if (v === sid) this.activeSessionBySkill[k] = null;
			}
			if (this.activeSessionId === sid) {
				this.activeSessionId = null;
				this.sessionTitle = null;
				this.rememberActiveForCurrentScope();
			}
		});
	}

	async sendMessage(
		rawText: string,
		options: {
			skillId?: string | null;
			draftTitle?: string;
			draftContent?: string;
		} = {},
	): Promise<void> {
		const userText = (rawText ?? '').trim();
		if (!userText) return;
		if (!readToken()) {
			Toast({
				type: 'warning',
				title:
					this.mode === 'generate'
						? '请先登录后再生成 Skill'
						: '请先登录后再试跑 Skill',
			});
			return;
		}
		const skillId = options.skillId?.trim() || null;
		const isGenerate = this.mode === 'generate';
		if (!isGenerate && !skillId) {
			Toast({ type: 'warning', title: '请先保存 Skill 后再试跑' });
			return;
		}
		if (this.isSending || this.isStreaming) {
			Toast({ type: 'warning', title: '请等待当前回复结束后再试' });
			return;
		}

		if (skillId !== this.boundSkillId) {
			this.bindSkill(skillId);
		}

		const titlePreview = userText.slice(0, 60);

		let sid = this.activeSessionId;
		if (!sid) {
			// 不传 title：首条用户消息由后端 memory 写入标题；本地先用提问预览
			const res = await createSkillTrySession({
				kind: isGenerate ? 'generate' : 'try',
				...(skillId ? { skillId } : {}),
			});
			sid = res.data?.sessionId ?? null;
			if (!sid) {
				Toast({ type: 'error', title: '创建会话失败' });
				return;
			}
			runInAction(() => {
				this.activeSessionId = sid;
				this.sessionTitle = titlePreview;
				this.ensureSessionState(sid!);
				this.rememberActiveForCurrentScope();
				if (!this.sessionList.some((s) => s.sessionId === sid)) {
					const now = new Date().toISOString();
					this.sessionList = [
						{
							sessionId: sid!,
							title: titlePreview,
							createdAt: now,
							updatedAt: now,
						},
						...this.sessionList,
					];
					this.sessionsPage.total = (this.sessionsPage.total ?? 0) + 1;
				}
			});
		} else if (!this.sessionTitle?.trim()) {
			this.patchSessionListTitle(sid, titlePreview);
		}

		const st = this.ensureSessionState(sid);
		const messageCountBeforeSend = st.messages.length;
		// 同会话重发：只中止本会话旧流
		st.abortStream?.();
		runInAction(() => {
			st.abortStream = null;
			st.isSending = true;
		});

		const userChatId = uuidv4();
		const assistantChatId = uuidv4();
		let userRowId = userChatId;
		let assistantRowId = assistantChatId;

		runInAction(() => {
			st.messages.push({
				chatId: userRowId,
				id: userChatId,
				role: 'user',
				content: userText,
				timestamp: new Date(),
			});
			st.messages.push({
				chatId: assistantRowId,
				id: assistantChatId,
				role: 'assistant',
				content: '',
				timestamp: new Date(),
				isStreaming: true,
				thinkContent: '',
			});
		});

		let accumulated = '';
		const flushAssistantPatch = () => {
			runInAction(() => {
				const idx = st.messages.findIndex((m) => m.chatId === assistantRowId);
				if (idx < 0) return;
				const prev = st.messages[idx] as Message;
				if (prev.content === accumulated) return;
				// 就地改 content：对齐 englishAgent，避免每 token 整表 MessageList 重渲染
				prev.content = accumulated;
			});
		};
		const assistantPatchScheduler =
			createStreamingMobxPatchScheduler(flushAssistantPatch);

		const patchAssistant = (delta: string) => {
			if (delta) accumulated += delta;
			assistantPatchScheduler.schedule();
		};

		const patchAssistantOrganic = (organic: SearchOrganicItem[]) => {
			runInAction(() => {
				const idx = st.messages.findIndex((m) => m.chatId === assistantRowId);
				if (idx < 0) return;
				const prev = st.messages[idx] as Message;
				st.messages[idx] = { ...prev, searchOrganic: organic };
			});
		};

		const draftTitle = options.draftTitle?.trim() ?? '';
		const draftContent = options.draftContent ?? '';
		const intentPrefix =
			isGenerate &&
			needsGenerateDraftPrefix({
				messageCountBeforeSend,
				draftTitle,
				draftContent,
				lastApplied: this.lastAppliedByScope[`generate:${scopeKey(skillId)}`],
			})
				? buildGenerateIntentPrefix(draftTitle, draftContent)
				: undefined;

		const streamSid = sid;
		try {
			console.log(skillId, 'intentPrefix', intentPrefix);
			const abort = await streamAgentSse({
				body: {
					sessionId: streamSid,
					content: userText,
					memorySource: 'skill_try',
					...(isGenerate
						? {
								assistMode: 'skill_generate',
								...(intentPrefix ? { intentPrefix } : {}),
							}
						: { skillIds: skillId ? [skillId] : [] }),
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
					onSearchOrganic: (organic) => patchAssistantOrganic(organic),
					onSkillsApplied: (skills) => {
						runInAction(() => {
							const idx = st.messages.findIndex(
								(m) => m.chatId === assistantRowId,
							);
							if (idx < 0) return;
							const prev = st.messages[idx] as Message;
							st.messages[idx] = { ...prev, appliedSkills: skills };
						});
					},
					onComplete: (err) => {
						assistantPatchScheduler.flush();
						const userAborted = err === AGENT_SSE_USER_ABORT_MARKER;
						const finishLocal = (content: string) => {
							runInAction(() => {
								st.isSending = false;
								st.abortStream = null;
								const idx = st.messages.findIndex(
									(m) => m.chatId === assistantRowId,
								);
								if (idx < 0) return;
								const prev = st.messages[idx] as Message;
								st.messages[idx] = {
									...prev,
									content: resolveAssistantEndContent({
										accumulated: content,
										prevContent: prev.content,
										err,
									}),
									isStreaming: false,
									...(err && !userAborted ? { isStopped: true } : {}),
								};
							});
						};

						const localText = accumulated.trim();
						if (localText || userAborted || err) {
							finishLocal(accumulated);
							void this.refreshSessionList();
							if (err && !userAborted) {
								Toast({ type: 'error', title: err });
							}
							return;
						}

						// 正文空且无显式错误：可能是 SSE 丢帧；尝试从服务端找回已落库内容
						void (async () => {
							let recovered = '';
							try {
								const res = await getAgentSessionDetail(streamSid);
								const list = res.data?.messages ?? [];
								for (let i = list.length - 1; i >= 0; i -= 1) {
									const m = list[i];
									if (m?.role === 'assistant' && m.content?.trim()) {
										recovered = m.content;
										break;
									}
								}
							} catch {
								/* ignore */
							}
							finishLocal(recovered);
							void this.refreshSessionList();
							if (!recovered.trim()) {
								Toast({
									type: 'warning',
									title: '本轮未生成文本，请重试',
								});
							}
						})();
					},
					onError: (e) => {
						assistantPatchScheduler.flush();
						runInAction(() => {
							st.isSending = false;
							st.abortStream = null;
							const idx = st.messages.findIndex(
								(m) => m.chatId === assistantRowId,
							);
							if (idx >= 0) {
								const prev = st.messages[idx] as Message;
								st.messages[idx] = {
									...prev,
									isStreaming: false,
									isStopped: true,
									content: resolveAssistantEndContent({
										accumulated,
										prevContent: prev.content,
										err: e.message || '请求中断',
									}),
								};
							}
						});
					},
				},
			});
			runInAction(() => {
				st.abortStream = abort;
			});
		} catch (e) {
			assistantPatchScheduler.flush();
			runInAction(() => {
				st.isSending = false;
				st.abortStream = null;
				const idx = st.messages.findIndex((m) => m.chatId === assistantRowId);
				if (idx >= 0) {
					const prev = st.messages[idx] as Message;
					st.messages[idx] = {
						...prev,
						isStreaming: false,
						isStopped: true,
						content: resolveAssistantEndContent({
							accumulated,
							prevContent: prev.content,
							err: e instanceof Error ? e.message : '发送失败',
						}),
					};
				}
			});
			Toast({
				type: 'error',
				title: e instanceof Error ? e.message : '发送失败',
			});
		}
	}
}

const skillTryStore = new SkillTryStore();
export default skillTryStore;
