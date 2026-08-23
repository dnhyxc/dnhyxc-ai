/**
 * 英语学习列表会话内缓存：切换库 / 离开再返回时恢复已加载窗口与滚动位置
 */
import {
	classicQuoteFavoriteContentKey,
	normalizeEnglishVocabWordKey,
} from '@/service';

export type LibraryWordsListCacheEntry<TItem, TLibrary> = {
	items: TItem[];
	resolvedLibrary: TLibrary | null;
	/** 当前窗口下界（API offset） */
	startOffset: number;
	/** 当前窗口上界（下一页 API offset） */
	endOffset: number;
	hasMore: boolean;
	hasPrevious: boolean;
	scrollTop: number;
	totalCount?: number;
};

type CacheSlot<TItem, TLibrary> = {
	data: LibraryWordsListCacheEntry<TItem, TLibrary>;
	lastAccess: number;
};

const MAX_CACHE_ENTRIES = 12;
const store = new Map<string, CacheSlot<unknown, unknown>>();

function cacheKey(namespace: string, libraryId: string): string {
	return `${namespace}:${libraryId}`;
}

function touchLru(key: string, slot: CacheSlot<unknown, unknown>) {
	store.delete(key);
	slot.lastAccess = Date.now();
	store.set(key, slot);
}

function evictIfNeeded() {
	while (store.size > MAX_CACHE_ENTRIES) {
		let oldestKey: string | null = null;
		let oldest = Infinity;
		for (const [key, slot] of store) {
			if (slot.lastAccess < oldest) {
				oldest = slot.lastAccess;
				oldestKey = key;
			}
		}
		if (!oldestKey) break;
		store.delete(oldestKey);
	}
}

export function getLibraryWordsListCache<TItem, TLibrary>(
	namespace: string,
	libraryId: string,
): LibraryWordsListCacheEntry<TItem, TLibrary> | null {
	const key = cacheKey(namespace, libraryId);
	const slot = store.get(key);
	if (!slot) return null;
	touchLru(key, slot);
	return slot.data as LibraryWordsListCacheEntry<TItem, TLibrary>;
}

export function setLibraryWordsListCache<TItem, TLibrary>(
	namespace: string,
	libraryId: string,
	data: LibraryWordsListCacheEntry<TItem, TLibrary>,
) {
	const key = cacheKey(namespace, libraryId);
	const slot: CacheSlot<TItem, TLibrary> = {
		data,
		lastAccess: Date.now(),
	};
	touchLru(key, slot as CacheSlot<unknown, unknown>);
	evictIfNeeded();
}

/** 删除库等场景下使缓存失效 */
export function invalidateLibraryWordsListCache(
	namespace: string,
	libraryId: string,
) {
	store.delete(cacheKey(namespace, libraryId));
}

/** 练习/记词等页收藏变更后，同步已缓存列表中的 favoriteId */
export function patchVocabFavoriteInListCaches(
	wordKey: string,
	favoriteId: string | null,
) {
	const wk = wordKey.trim().toLowerCase();
	if (!wk) return;
	for (const [key, slot] of store) {
		const entry = slot.data as LibraryWordsListCacheEntry<
			{ word: string; favoriteId?: string | null },
			unknown
		>;
		let changed = false;
		const items = entry.items.map((item) => {
			if (normalizeEnglishVocabWordKey(item.word) !== wk) return item;
			const next = favoriteId;
			if ((item.favoriteId ?? null) === next) return item;
			changed = true;
			return { ...item, favoriteId: next };
		});
		if (changed) {
			entry.items = items;
			touchLru(key, slot);
		}
	}
}

export function patchClassicFavoriteInListCaches(
	contentKey: string,
	favoriteId: string | null,
) {
	const ck = contentKey.trim();
	if (!ck) return;
	for (const [key, slot] of store) {
		const entry = slot.data as LibraryWordsListCacheEntry<
			{ english: string; favoriteId?: string | null },
			unknown
		>;
		let changed = false;
		const items = entry.items.map((item) => {
			if (classicQuoteFavoriteContentKey(item.english) !== ck) return item;
			const next = favoriteId;
			if ((item.favoriteId ?? null) === next) return item;
			changed = true;
			return { ...item, favoriteId: next };
		});
		if (changed) {
			entry.items = items;
			touchLru(key, slot);
		}
	}
}
