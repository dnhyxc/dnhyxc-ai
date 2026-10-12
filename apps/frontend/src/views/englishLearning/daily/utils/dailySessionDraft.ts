/**
 * 今日记词会话 sessionStorage 快照
 */
import type { PracticeReportSaveMode } from '../../practice/types';
import {
	sessionDraftClearPrefix,
	sessionDraftGet,
	sessionDraftRemove,
	sessionDraftSet,
	sessionDraftUserScope,
} from '../../utils/sessionDraftStorage';
import type {
	DailyMemorizeMode,
	DailySessionRound,
	DailySessionSummary,
	DailyVocabCard,
} from '../types';

export const DAILY_DRAFT_VERSION = 1 as const;
export const DAILY_DRAFT_KEY_PREFIX = 'el-daily-draft';

export type DailyPendingRecord = {
	key: string;
	correct: boolean;
	origin: DailyVocabCard['origin'];
};

export type DailySessionDraft = {
	v: typeof DAILY_DRAFT_VERSION;
	sid: string;
	phase: 'session' | 'done';
	mode: DailyMemorizeMode;
	reportSaveMode: PracticeReportSaveMode;
	cards: DailyVocabCard[];
	index: number;
	pendingRecords: DailyPendingRecord[];
	sessionRounds: DailySessionRound[];
	summary: DailySessionSummary | null;
	isRetryWrong: boolean;
	practicedKeys: string[];
	sessionReportId: string | null;
	/** 0 卡合法进 done */
	allowEmptyDone?: boolean;
	updatedAt: string;
};

function bodyKey(sid: string): string {
	return `${DAILY_DRAFT_KEY_PREFIX}:${sessionDraftUserScope()}:${sid}`;
}

function activeKey(): string {
	return `${DAILY_DRAFT_KEY_PREFIX}:active:${sessionDraftUserScope()}`;
}

export function getDailyActiveSid(): string | null {
	return sessionDraftGet<string>(activeKey());
}

export function setDailyActiveSid(sid: string | null): void {
	if (!sid) {
		sessionDraftRemove(activeKey());
		return;
	}
	sessionDraftSet(activeKey(), sid);
}

export function loadDailyDraft(sid: string): DailySessionDraft | null {
	const draft = sessionDraftGet<DailySessionDraft>(bodyKey(sid));
	if (!draft || draft.v !== DAILY_DRAFT_VERSION || draft.sid !== sid) {
		return null;
	}
	if (draft.phase !== 'session' && draft.phase !== 'done') return null;
	if (!Array.isArray(draft.cards)) return null;
	return draft;
}

export function saveDailyDraft(draft: DailySessionDraft): boolean {
	const ok = sessionDraftSet(bodyKey(draft.sid), {
		...draft,
		v: DAILY_DRAFT_VERSION,
		updatedAt: new Date().toISOString(),
	} satisfies DailySessionDraft);
	if (ok) setDailyActiveSid(draft.sid);
	return ok;
}

export function clearDailyDraft(sid: string): void {
	sessionDraftRemove(bodyKey(sid));
	if (getDailyActiveSid() === sid) setDailyActiveSid(null);
}

export function replaceDailyDraft(draft: DailySessionDraft): boolean {
	const prev = getDailyActiveSid();
	if (prev && prev !== draft.sid) clearDailyDraft(prev);
	return saveDailyDraft(draft);
}

export function clearAllDailyDrafts(): void {
	sessionDraftClearPrefix(`${DAILY_DRAFT_KEY_PREFIX}:`);
}

export type DailyUnfinishedInfo = {
	sid: string;
	phase: 'session' | 'done';
	current: number;
	total: number;
	mode: DailyMemorizeMode;
	reportSaveMode: PracticeReportSaveMode;
	/** 本轮卡数（用于 Intro 回显每轮词数） */
	wordsPerRound: number;
};

/** 根路径「继续上次」探测 */
export function peekDailyUnfinished(): DailyUnfinishedInfo | null {
	const sid = getDailyActiveSid();
	if (!sid) return null;
	const draft = loadDailyDraft(sid);
	if (!draft) return null;
	if (draft.phase === 'session' && draft.cards.length === 0) return null;
	if (
		draft.phase === 'done' &&
		draft.summary == null &&
		draft.sessionRounds.length === 0 &&
		!draft.allowEmptyDone
	) {
		return null;
	}
	const total = Math.max(1, draft.cards.length);
	return {
		sid: draft.sid,
		phase: draft.phase,
		current: Math.min(draft.index + 1, total),
		total,
		mode: draft.mode,
		reportSaveMode: draft.reportSaveMode ?? 'manual',
		wordsPerRound: draft.cards.length,
	};
}
