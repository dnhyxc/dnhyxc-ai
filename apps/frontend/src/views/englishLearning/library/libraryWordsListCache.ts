/**
 * 资源库词条列表会话内缓存：切换单词库 / 离开页面再返回时恢复已加载分页与滚动位置
 */

export type LibraryWordsListCacheEntry<TItem, TLibrary> = {
	items: TItem[];
	resolvedLibrary: TLibrary | null;
	offset: number;
	hasMore: boolean;
	scrollTop: number;
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
