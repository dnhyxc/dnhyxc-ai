/**
 * 练习会话 sessionStorage 快照（整队 queue 冻结，保证随机顺序可续）
 * active 按 draftScope（kind:source[:id]）分槽，多库互不覆盖
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
	PracticeSource,
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

/** 算活跃槽：只用稳定字段，标题永不进键 */
export type PracticeDraftScopeInput = {
	contentKind: PracticeContentKind;
	source: PracticeSource;
	libraryId?: string;
	streamId?: string;
};

function normalizeKind(
	kind: PracticeContentKind | undefined,
): PracticeContentKind {
	return kind === 'classic' ? 'classic' : 'vocab';
}

export function resolvePracticeDraftScope(
	input: PracticeDraftScopeInput,
): string {
	const kind = normalizeKind(input.contentKind);
	const libraryId = input.libraryId?.trim();
	const streamId = input.streamId?.trim();

	if (input.source === 'library' && libraryId) {
		return `${kind}:library:${libraryId}`;
	}
	if ((input.source === 'pack' || input.source === 'live') && streamId) {
		return `${kind}:pack:${streamId}`;
	}
	if (input.source === 'live') return `${kind}:live`;
	if (input.source === 'pack') return `${kind}:pack`;
	if (input.source === 'favorites') return `${kind}:favorites`;
	if (input.source === 'mistakes') return `${kind}:mistakes`;
	if (input.source === 'review') return `${kind}:review`;
	if (input.source === 'dailyMemorize') return `${kind}:daily-memorize`;
	if (input.source === 'library') return `${kind}:library`;
	return `${kind}:unknown`;
}

function scopeFromConfig(config: PracticeSetupConfig): string {
	return resolvePracticeDraftScope({
		contentKind: normalizeKind(config.contentKind),
		source: config.source,
		libraryId: config.libraryId,
		streamId: config.streamId,
	});
}

function bodyKey(sid: string): string {
	return `${PRACTICE_DRAFT_KEY_PREFIX}:${sessionDraftUserScope()}:${sid}`;
}

function activeKey(scope: string): string {
	return `${PRACTICE_DRAFT_KEY_PREFIX}:active:${sessionDraftUserScope()}:${scope}`;
}

/** 更早：未分 kind 的单指针 */
function legacyBareActiveKey(): string {
	return `${PRACTICE_DRAFT_KEY_PREFIX}:active:${sessionDraftUserScope()}`;
}

/** M4：仅按 contentKind 分槽的指针 */
function legacyKindActiveKey(kind: PracticeContentKind): string {
	return `${PRACTICE_DRAFT_KEY_PREFIX}:active:${sessionDraftUserScope()}:${normalizeKind(kind)}`;
}

function migrateLegacyActives(): void {
	const bareSid = sessionDraftGet<string>(legacyBareActiveKey());
	if (bareSid) {
		const draft = loadPracticeDraft(bareSid);
		sessionDraftRemove(legacyBareActiveKey());
		if (draft) {
			const scope = scopeFromConfig(draft.config);
			if (!sessionDraftGet<string>(activeKey(scope))) {
				sessionDraftSet(activeKey(scope), bareSid);
			}
		}
	}

	for (const kind of ['vocab', 'classic'] as const) {
		const kindKey = legacyKindActiveKey(kind);
		const sid = sessionDraftGet<string>(kindKey);
		if (!sid) continue;
		const draft = loadPracticeDraft(sid);
		sessionDraftRemove(kindKey);
		if (!draft) continue;
		const scope = scopeFromConfig(draft.config);
		if (!sessionDraftGet<string>(activeKey(scope))) {
			sessionDraftSet(activeKey(scope), sid);
		}
	}
}

export function getPracticeActiveSid(scope: string): string | null {
	migrateLegacyActives();
	return sessionDraftGet<string>(activeKey(scope));
}

export function setPracticeActiveSid(scope: string, sid: string | null): void {
	const key = activeKey(scope);
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
	const scope = scopeFromConfig(draft.config);
	const ok = sessionDraftSet(bodyKey(draft.sid), {
		...draft,
		v: PRACTICE_DRAFT_VERSION,
		updatedAt: new Date().toISOString(),
	} satisfies PracticeSessionDraft);
	if (ok) setPracticeActiveSid(scope, draft.sid);
	return ok;
}

function clearActivePointersTo(sid: string): void {
	if (typeof sessionStorage === 'undefined') return;
	const prefix = `${PRACTICE_DRAFT_KEY_PREFIX}:active:${sessionDraftUserScope()}`;
	const keys: string[] = [];
	for (let i = 0; i < sessionStorage.length; i++) {
		const k = sessionStorage.key(i);
		if (!k?.startsWith(prefix)) continue;
		if (sessionDraftGet<string>(k) === sid) keys.push(k);
	}
	for (const k of keys) sessionDraftRemove(k);
}

export function clearPracticeDraft(sid: string): void {
	sessionDraftRemove(bodyKey(sid));
	clearActivePointersTo(sid);
}

/** 新开局：仅替换同 draftScope 的旧活跃正文 */
export function replacePracticeDraft(draft: PracticeSessionDraft): boolean {
	const scope = scopeFromConfig(draft.config);
	const prev = getPracticeActiveSid(scope);
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

/** 根路径「继续上次」：按当前入口 draftScope 探测 */
export function peekPracticeUnfinished(
	input: PracticeDraftScopeInput,
): PracticeUnfinishedInfo | null {
	const scope = resolvePracticeDraftScope(input);
	const want = normalizeKind(input.contentKind);
	const sid = getPracticeActiveSid(scope);
	if (!sid) return null;
	const draft = loadPracticeDraft(sid);
	if (!draft) return null;
	if (scopeFromConfig(draft.config) !== scope) return null;
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

/** ponytail: scope 字符串契约；破了两库会串槽 */
export function selfCheckPracticeDraftScope(): void {
	const a = resolvePracticeDraftScope({
		contentKind: 'vocab',
		source: 'library',
		libraryId: 'lib-a',
	});
	const b = resolvePracticeDraftScope({
		contentKind: 'vocab',
		source: 'library',
		libraryId: 'lib-b',
	});
	if (a === b) {
		throw new Error('selfCheckPracticeDraftScope: libraries must differ');
	}
	if (a !== 'vocab:library:lib-a' || b !== 'vocab:library:lib-b') {
		throw new Error(`selfCheckPracticeDraftScope: unexpected ${a}/${b}`);
	}
	const renamed = resolvePracticeDraftScope({
		contentKind: 'vocab',
		source: 'library',
		libraryId: 'lib-a',
	});
	if (renamed !== a) {
		throw new Error('selfCheckPracticeDraftScope: id scope must be stable');
	}
	const daily = resolvePracticeDraftScope({
		contentKind: 'vocab',
		source: 'dailyMemorize',
	});
	if (daily !== 'vocab:daily-memorize') {
		throw new Error(`selfCheckPracticeDraftScope: daily=${daily}`);
	}
	const pack = resolvePracticeDraftScope({
		contentKind: 'classic',
		source: 'live',
		streamId: 'stream-1',
	});
	if (pack !== 'classic:pack:stream-1') {
		throw new Error(`selfCheckPracticeDraftScope: pack=${pack}`);
	}
}
