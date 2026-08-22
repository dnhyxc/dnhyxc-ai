/**
 * 资源库词条续读 offset 会话缓存。
 * 浏览中只改本地；离开当前库 / 切后台 / 刷新时再 flush 到 DB（对齐电子书进度）。
 */
import {
	patchEnglishClassicQuotesLibraryItemsResume,
	patchEnglishClassicQuotesLibraryItemsResumeKeepalive,
	patchEnglishVocabularyLibraryItemsResume,
	patchEnglishVocabularyLibraryItemsResumeKeepalive,
} from '@/service';
import type { LibraryKind } from '@/views/englishLearning/library/types';
import { alignResumeOffset } from '@/views/englishLearning/library/utils/libraryWordsListResume';

const PAGE_SIZE_HINT = 50;

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

export function setEnglishLibraryItemsResumeOffset(
	kind: LibraryKind,
	libraryId: string,
	offset: number,
	pageSize = PAGE_SIZE_HINT,
): void {
	const id = libraryId.trim();
	if (!id) return;
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
export function getEnglishLibraryItemsResumeOffset(
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
export function resolveEnglishLibraryItemsResumeOffset(
	kind: LibraryKind,
	libraryId: string,
	fallback = 0,
	pageSize = PAGE_SIZE_HINT,
): number {
	const stored = getEnglishLibraryItemsResumeOffset(kind, libraryId);
	if (stored !== undefined) return stored;
	return alignResumeOffset(fallback, pageSize);
}

/** 列表拉取后：用 API 值填补尚未写入的条目（不覆盖会话内更新，且视为已同步） */
export function hydrateEnglishLibraryItemsResumeOffset(
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
export function flushEnglishLibraryItemsResume(
	kind: LibraryKind,
	libraryId: string,
	opts?: { keepalive?: boolean },
): void {
	const id = libraryId.trim();
	if (!id) return;
	const key = entryKey(kind, id);
	if (!dirty.has(key)) return;
	const offset = offsets.get(key) ?? 0;

	if (opts?.keepalive) {
		if (kind === 'vocab') {
			patchEnglishVocabularyLibraryItemsResumeKeepalive(id, offset);
		} else {
			patchEnglishClassicQuotesLibraryItemsResumeKeepalive(id, offset);
		}
		synced.set(key, offset);
		dirty.delete(key);
		return;
	}

	const patch =
		kind === 'vocab'
			? patchEnglishVocabularyLibraryItemsResume
			: patchEnglishClassicQuotesLibraryItemsResume;
	void patch(id, offset)
		.then(() => {
			synced.set(key, offset);
			dirty.delete(key);
		})
		.catch(() => {
			// 保持 dirty，下次离开再试
		});
}

export function clearEnglishLibraryItemsResumeOffset(
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
export function clearEnglishLibraryItemsResumeCache(): void {
	offsets.clear();
	synced.clear();
	dirty.clear();
}
