/**
 * 英语学习列表续读 offset 会话缓存。
 * 浏览中只改本地；离开 / 切后台 / 刷新时再 flush 到 DB（对齐电子书进度）。
 * 收藏 / 错题 / 记词记录等固定列表走占位 library_id（见 ElFixedListScope）。
 */

import {
	ENGLISH_LEARNING_LIST_RESUME_LIBRARY_ID,
	VOCAB_LIBRARY_ITEMS_PAGE_SIZE,
} from '@/constants';
import {
	getClassicFavResume,
	getClassicMissResume,
	getDailyMemoResume,
	getVocabFavResume,
	getVocabMissResume,
	patchElListResume,
} from '@/service';
import type { LibraryKind } from '@/views/englishLearning/library/types';
import {
	entryResumeModuleKey,
	fixedListResumeModuleKey,
	isElResumeModuleEnabled,
} from '@/views/englishLearning/utils/elResumeModule';
import { alignResumeOffset } from '@/views/englishLearning/utils/libraryWordsListResume';

const PAGE_SIZE_HINT = VOCAB_LIBRARY_ITEMS_PAGE_SIZE;

const offsets = new Map<string, number>();
/** 已成功同步到服务端的值；与 offsets 不同则视为 dirty */
const synced = new Map<string, number>();
const dirty = new Set<string>();

function entryKey(kind: LibraryKind, libraryId: string): string {
	return `${kind}:${libraryId}`;
}

function markDirtyIfNeeded(key: string, next: number) {
	const prevSynced = synced.get(key) ?? 0;
	if (next === prevSynced) {
		dirty.delete(key);
	} else {
		dirty.add(key);
	}
}

export function setElResumeOffset(
	kind: LibraryKind,
	libraryId: string,
	offset: number,
	pageSize = PAGE_SIZE_HINT,
): void {
	const id = libraryId.trim();
	if (!id) return;
	if (!isElResumeModuleEnabled(entryResumeModuleKey(kind, id))) return;
	const key = entryKey(kind, id);
	const next = alignResumeOffset(offset, pageSize);
	if (next <= 0) {
		offsets.delete(key);
	} else {
		offsets.set(key, next);
	}
	markDirtyIfNeeded(key, next);
}

/** 仅会话内写过 / 从列表灌过时有值 */
export function getElResumeOffset(
	kind: LibraryKind,
	libraryId: string,
): number | undefined {
	const id = libraryId.trim();
	if (!id) return undefined;
	const key = entryKey(kind, id);
	if (!offsets.has(key) && !dirty.has(key)) return undefined;
	return offsets.get(key) ?? 0;
}

/** store 优先，否则用列表/接口带回的 fallback */
export function resolveElResumeOffset(
	kind: LibraryKind,
	libraryId: string,
	fallback = 0,
	pageSize = PAGE_SIZE_HINT,
): number {
	if (!isElResumeModuleEnabled(entryResumeModuleKey(kind, libraryId))) return 0;
	const stored = getElResumeOffset(kind, libraryId);
	if (stored !== undefined) return stored;
	return alignResumeOffset(fallback, pageSize);
}

/** 列表拉取后：用 API 值填补尚未写入的条目（不覆盖会话内更新，且视为已同步） */
export function hydrateElResumeOffset(
	kind: LibraryKind,
	libraryId: string,
	offset: number,
	pageSize = PAGE_SIZE_HINT,
): void {
	const id = libraryId.trim();
	if (!id) return;
	const key = entryKey(kind, id);
	if (offsets.has(key) || dirty.has(key)) return;
	const next = alignResumeOffset(offset, pageSize);
	if (next > 0) {
		offsets.set(key, next);
	}
	synced.set(key, next);
	dirty.delete(key);
}

/**
 * 将本地 dirty 续读刷到服务端。
 * keepalive：pagehide / 切后台 / 卸载，避免被浏览器掐断。
 */
export function flushElResume(
	kind: LibraryKind,
	libraryId: string,
	opts?: { keepalive?: boolean },
): void {
	const id = libraryId.trim();
	if (!id) return;
	if (!isElResumeModuleEnabled(entryResumeModuleKey(kind, id))) return;
	const key = entryKey(kind, id);
	if (!dirty.has(key)) return;
	const offset = offsets.get(key) ?? 0;

	if (opts?.keepalive) {
		void patchElListResume(kind, id, offset, { keepalive: true });
		synced.set(key, offset);
		dirty.delete(key);
		return;
	}

	void patchElListResume(kind, id, offset)
		.then(() => {
			synced.set(key, offset);
			dirty.delete(key);
		})
		.catch(() => {
			// 保持 dirty，下次离开再试
		});
}

export function clearElResumeOffset(
	kind: LibraryKind,
	libraryId: string,
): void {
	const id = libraryId.trim();
	if (!id) return;
	const key = entryKey(kind, id);
	offsets.delete(key);
	synced.delete(key);
	dirty.delete(key);
}

/** 切换账号时清空 */
export function clearElResumeCache(): void {
	offsets.clear();
	synced.clear();
	dirty.clear();
}

// ---------- 固定列表（收藏 / 错题 / 记词记录）----------

export type ElFixedListScope =
	| 'vocab-favorites'
	| 'classic-favorites'
	| 'vocab-mistakes'
	| 'classic-mistakes'
	| 'vocab-daily-memorize';

export function elFixedListResumeId(scope: ElFixedListScope): string {
	switch (scope) {
		case 'vocab-favorites':
			return ENGLISH_LEARNING_LIST_RESUME_LIBRARY_ID.vocabFavorites;
		case 'classic-favorites':
			return ENGLISH_LEARNING_LIST_RESUME_LIBRARY_ID.classicFavorites;
		case 'vocab-mistakes':
			return ENGLISH_LEARNING_LIST_RESUME_LIBRARY_ID.vocabMistakes;
		case 'classic-mistakes':
			return ENGLISH_LEARNING_LIST_RESUME_LIBRARY_ID.classicMistakes;
		case 'vocab-daily-memorize':
			return ENGLISH_LEARNING_LIST_RESUME_LIBRARY_ID.vocabDailyMemorize;
	}
}

export function elFixedListKind(scope: ElFixedListScope): LibraryKind {
	return scope.startsWith('classic') ? 'classic' : 'vocab';
}

export function resolveElFixedListResume(
	scope: ElFixedListScope,
	fallback = 0,
): number {
	if (!isElResumeModuleEnabled(fixedListResumeModuleKey(scope))) return 0;
	const kind = elFixedListKind(scope);
	const id = elFixedListResumeId(scope);
	return resolveElResumeOffset(kind, id, fallback, PAGE_SIZE_HINT);
}

export function setElFixedListResume(
	scope: ElFixedListScope,
	offset: number,
): void {
	const kind = elFixedListKind(scope);
	const id = elFixedListResumeId(scope);
	setElResumeOffset(kind, id, offset, PAGE_SIZE_HINT);
}

export function flushElFixedListResume(
	scope: ElFixedListScope,
	opts?: { keepalive?: boolean },
): void {
	const kind = elFixedListKind(scope);
	const id = elFixedListResumeId(scope);
	flushElResume(kind, id, opts);
}

export async function resolveElFixedListInitialResume(
	scope: ElFixedListScope,
): Promise<number> {
	if (!isElResumeModuleEnabled(fixedListResumeModuleKey(scope))) return 0;
	const kind = elFixedListKind(scope);
	const id = elFixedListResumeId(scope);
	const stored = getElResumeOffset(kind, id);
	if (stored !== undefined) return stored;

	const fetchResume = (() => {
		switch (scope) {
			case 'vocab-favorites':
				return getVocabFavResume;
			case 'classic-favorites':
				return getClassicFavResume;
			case 'vocab-mistakes':
				return getVocabMissResume;
			case 'classic-mistakes':
				return getClassicMissResume;
			case 'vocab-daily-memorize':
				return getDailyMemoResume;
		}
	})();

	const res = await fetchResume({ silent: true });
	const offset = res.data?.itemsResumeOffset ?? 0;
	hydrateElResumeOffset(kind, id, offset, PAGE_SIZE_HINT);
	return resolveElResumeOffset(kind, id, offset, PAGE_SIZE_HINT);
}
