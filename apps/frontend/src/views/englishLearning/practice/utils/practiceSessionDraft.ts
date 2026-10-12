/**
 * 练习会话 sessionStorage 快照（整队 queue 冻结，保证随机顺序可续）
 * active 按 contentKind（vocab / classic）分槽，互不覆盖
 */
import {
	sessionDraftClearPrefix,
	sessionDraftGet,
	sessionDraftRemove,
	sessionDraftSet,
	sessionDraftUserScope,
} from '../../utils/sessionDraftStorage';
import type {
	PracticeAttemptResult,
	PracticeContentKind,
	PracticeCountOption,
	PracticeItem,
	PracticeMode,
	PracticeOrder,
	PracticeReportSaveMode,
	PracticeSessionCursor,
	PracticeSessionRound,
	PracticeSetupConfig,
} from '../types';

export const PRACTICE_DRAFT_VERSION = 1 as const;
export const PRACTICE_DRAFT_KEY_PREFIX = 'el-practice-draft';

export type PracticeSessionDraft = {
	v: typeof PRACTICE_DRAFT_VERSION;
	sid: string;
	phase: 'running' | 'summary';
	config: PracticeSetupConfig;
	queue: PracticeItem[];
	index: number;
	results: PracticeAttemptResult[];
	sessionRounds: PracticeSessionRound[];
	sessionCursor: PracticeSessionCursor | null;
	practicedKeys: string[];
	sessionReportId: string | null;
	updatedAt: string;
};

function normalizeKind(
	kind: PracticeContentKind | undefined,
): PracticeContentKind {
	return kind === 'classic' ? 'classic' : 'vocab';
}

function bodyKey(sid: string): string {
	return `${PRACTICE_DRAFT_KEY_PREFIX}:${sessionDraftUserScope()}:${sid}`;
}

function activeKey(kind: PracticeContentKind): string {
	return `${PRACTICE_DRAFT_KEY_PREFIX}:active:${sessionDraftUserScope()}:${kind}`;
}

/** M2 旧指针（未分 kind）；读时迁到 vocab/classic 槽后删除 */
function legacyActiveKey(): string {
	return `${PRACTICE_DRAFT_KEY_PREFIX}:active:${sessionDraftUserScope()}`;
}

function migrateLegacyActive(): void {
	const legacySid = sessionDraftGet<string>(legacyActiveKey());
	if (!legacySid) return;
	const draft = loadPracticeDraft(legacySid);
	sessionDraftRemove(legacyActiveKey());
	if (!draft) return;
	const kind = normalizeKind(draft.config.contentKind);
	if (!sessionDraftGet<string>(activeKey(kind))) {
		sessionDraftSet(activeKey(kind), legacySid);
	}
}

export function getPracticeActiveSid(kind: PracticeContentKind): string | null {
	migrateLegacyActive();
	return sessionDraftGet<string>(activeKey(normalizeKind(kind)));
}

export function setPracticeActiveSid(
	kind: PracticeContentKind,
	sid: string | null,
): void {
	const key = activeKey(normalizeKind(kind));
	if (!sid) {
		sessionDraftRemove(key);
		return;
	}
	sessionDraftSet(key, sid);
}

export function loadPracticeDraft(sid: string): PracticeSessionDraft | null {
	const draft = sessionDraftGet<PracticeSessionDraft>(bodyKey(sid));
	if (!draft || draft.v !== PRACTICE_DRAFT_VERSION || draft.sid !== sid) {
		return null;
	}
	if (draft.phase !== 'running' && draft.phase !== 'summary') return null;
	if (!draft.config || !Array.isArray(draft.queue)) return null;
	return draft;
}

export function savePracticeDraft(draft: PracticeSessionDraft): boolean {
	const kind = normalizeKind(draft.config.contentKind);
	const ok = sessionDraftSet(bodyKey(draft.sid), {
		...draft,
		v: PRACTICE_DRAFT_VERSION,
		updatedAt: new Date().toISOString(),
	} satisfies PracticeSessionDraft);
	if (ok) setPracticeActiveSid(kind, draft.sid);
	return ok;
}

export function clearPracticeDraft(sid: string): void {
	const draft = loadPracticeDraft(sid);
	sessionDraftRemove(bodyKey(sid));
	const kinds: PracticeContentKind[] = draft
		? [normalizeKind(draft.config.contentKind)]
		: ['vocab', 'classic'];
	for (const kind of kinds) {
		if (sessionDraftGet<string>(activeKey(kind)) === sid) {
			setPracticeActiveSid(kind, null);
		}
	}
}

/** 新开局：仅替换同 contentKind 的旧活跃正文 */
export function replacePracticeDraft(draft: PracticeSessionDraft): boolean {
	const kind = normalizeKind(draft.config.contentKind);
	const prev = getPracticeActiveSid(kind);
	if (prev && prev !== draft.sid) clearPracticeDraft(prev);
	return savePracticeDraft(draft);
}

export function clearAllPracticeDrafts(): void {
	sessionDraftClearPrefix(`${PRACTICE_DRAFT_KEY_PREFIX}:`);
}

export type PracticeUnfinishedInfo = {
	sid: string;
	phase: 'running' | 'summary';
	current: number;
	total: number;
	contentKind: PracticeContentKind;
	mode: PracticeMode;
	order: PracticeOrder;
	count: PracticeCountOption;
	reportSaveMode: PracticeReportSaveMode;
	/** 词库 / 收藏等来源展示名（来自草稿 config） */
	sourceTitle?: string;
};

/** 根路径「继续上次」：按 contentKind 探测对应活跃快照 */
export function peekPracticeUnfinished(
	kind: PracticeContentKind,
): PracticeUnfinishedInfo | null {
	const want = normalizeKind(kind);
	const sid = getPracticeActiveSid(want);
	if (!sid) return null;
	const draft = loadPracticeDraft(sid);
	if (!draft) return null;
	if (normalizeKind(draft.config.contentKind) !== want) return null;
	if (draft.phase === 'running' && draft.queue.length === 0) return null;
	if (draft.phase === 'summary' && draft.sessionRounds.length === 0) {
		return null;
	}
	const total = Math.max(1, draft.queue.length);
	const sourceTitle = draft.config.sourceTitle?.trim() || undefined;
	return {
		sid: draft.sid,
		phase: draft.phase,
		current: Math.min(draft.index + 1, total),
		total,
		contentKind: want,
		mode: draft.config.mode,
		order: draft.config.order,
		count: draft.config.count,
		reportSaveMode: draft.config.reportSaveMode ?? 'manual',
		sourceTitle,
	};
}
