/**
 * 资源库右侧词条列表：分页加载、瞬时网络重试、切换库时丢弃过期响应、会话内列表缓存
 */
import { Toast } from '@ui/index';
import {
	type UIEventHandler,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import {
	SCROLL_LOAD_THRESHOLD_PX,
	VOCAB_LIBRARY_ITEMS_PAGE_SIZE,
} from '@/constants';
import { useI18n } from '@/hooks';
import { retryAsync } from '@/utils/retryAsync';
import {
	getLibraryWordsListCache,
	setLibraryWordsListCache,
} from '../utils/libraryWordsListCache';

export type LibraryWordsListResult<TItem, TLibrary> = {
	library: TLibrary;
	items: TItem[];
};

export type UseLibraryWordsListOptions<TItem, TLibrary> = {
	libraryId: string | null;
	pageSize?: number;
	/** 区分单词库 / 经典句库缓存命名空间 */
	cacheNamespace?: string;
	fetchPage: (
		libraryId: string,
		limit: number,
		offset: number,
	) => Promise<LibraryWordsListResult<TItem, TLibrary>>;
};

export function useLibraryWordsList<TItem, TLibrary>({
	libraryId,
	pageSize = VOCAB_LIBRARY_ITEMS_PAGE_SIZE,
	cacheNamespace,
	fetchPage,
}: UseLibraryWordsListOptions<TItem, TLibrary>) {
	const { t } = useI18n();
	const [items, setItems] = useState<TItem[]>([]);
	const [resolvedLibrary, setResolvedLibrary] = useState<TLibrary | null>(null);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	/** 从缓存恢复时用于恢复 ScrollArea 滚动位置 */
	const [initialScrollTop, setInitialScrollTop] = useState(0);

	const offsetRef = useRef(0);
	const hasMoreRef = useRef(true);
	const fetchingMoreRef = useRef(false);
	const libraryIdRef = useRef<string | null>(null);
	const loadGenRef = useRef(0);
	const scrollTopRef = useRef(0);

	const persistCache = useCallback(
		(
			id: string,
			snapshot: {
				items: TItem[];
				resolvedLibrary: TLibrary | null;
			},
		) => {
			if (!cacheNamespace) return;
			setLibraryWordsListCache<TItem, TLibrary>(cacheNamespace, id, {
				items: snapshot.items,
				resolvedLibrary: snapshot.resolvedLibrary,
				offset: offsetRef.current,
				hasMore: hasMoreRef.current,
				scrollTop: scrollTopRef.current,
			});
		},
		[cacheNamespace],
	);

	const fetchPageWithRetry = useCallback(
		(id: string, offset: number) =>
			retryAsync(() => fetchPage(id, pageSize, offset), {
				retries: 2,
				delayMs: 400,
			}),
		[fetchPage, pageSize],
	);

	const fetchFirstPage = useCallback(
		async (id: string, gen: number) => {
			fetchingMoreRef.current = false;
			setLoading(true);
			setLoadingMore(false);
			setInitialScrollTop(0);
			scrollTopRef.current = 0;
			offsetRef.current = 0;
			hasMoreRef.current = true;
			setItems([]);
			setResolvedLibrary(null);
			try {
				const data = await fetchPageWithRetry(id, 0);
				if (gen !== loadGenRef.current || libraryIdRef.current !== id) return;
				const resolved = data.library ?? null;
				if (resolved) {
					setResolvedLibrary(resolved);
				}
				const list = Array.isArray(data.items) ? data.items : [];
				setItems(list);
				offsetRef.current = list.length;
				hasMoreRef.current = list.length >= pageSize;
				persistCache(id, {
					items: list,
					resolvedLibrary: resolved,
				});
			} catch {
				if (gen !== loadGenRef.current) return;
				setItems([]);
				hasMoreRef.current = false;
				Toast({
					type: 'error',
					title: t('englishLearning.library.wordsLoadFailed'),
				});
			} finally {
				if (gen === loadGenRef.current) {
					setLoading(false);
				}
			}
		},
		[fetchPageWithRetry, pageSize, persistCache, t],
	);

	const fetchMore = useCallback(async () => {
		const id = libraryIdRef.current;
		const gen = loadGenRef.current;
		if (!id || !hasMoreRef.current || fetchingMoreRef.current || loading) {
			return;
		}
		fetchingMoreRef.current = true;
		setLoadingMore(true);
		const offset = offsetRef.current;
		try {
			const data = await fetchPageWithRetry(id, offset);
			if (gen !== loadGenRef.current || libraryIdRef.current !== id) return;
			const chunk = Array.isArray(data.items) ? data.items : [];
			if (chunk.length === 0) {
				hasMoreRef.current = false;
				setItems((prev) => {
					persistCache(id, {
						items: prev,
						resolvedLibrary,
					});
					return prev;
				});
				return;
			}
			setItems((prev) => {
				const next = [...prev, ...chunk];
				offsetRef.current = next.length;
				hasMoreRef.current = chunk.length >= pageSize;
				persistCache(id, {
					items: next,
					resolvedLibrary,
				});
				return next;
			});
		} catch {
			if (gen !== loadGenRef.current) return;
			Toast({
				type: 'error',
				title: t('englishLearning.library.wordsLoadMoreFailed'),
			});
		} finally {
			if (gen === loadGenRef.current) {
				fetchingMoreRef.current = false;
				setLoadingMore(false);
			}
		}
	}, [fetchPageWithRetry, loading, pageSize, persistCache, resolvedLibrary, t]);

	const restoreFromCache = useCallback(
		(id: string) => {
			if (!cacheNamespace) return false;
			const cached = getLibraryWordsListCache<TItem, TLibrary>(
				cacheNamespace,
				id,
			);
			if (!cached) return false;

			loadGenRef.current += 1;
			offsetRef.current = cached.offset;
			hasMoreRef.current = cached.hasMore;
			scrollTopRef.current = cached.scrollTop;
			setItems(cached.items);
			setResolvedLibrary(cached.resolvedLibrary);
			setInitialScrollTop(cached.scrollTop);
			setLoading(false);
			setLoadingMore(false);
			fetchingMoreRef.current = false;
			return true;
		},
		[cacheNamespace],
	);

	useEffect(() => {
		libraryIdRef.current = libraryId;
		if (!libraryId) {
			loadGenRef.current += 1;
			setItems([]);
			setResolvedLibrary(null);
			setInitialScrollTop(0);
			return;
		}
		if (restoreFromCache(libraryId)) {
			return;
		}
		const gen = ++loadGenRef.current;
		void fetchFirstPage(libraryId, gen);
	}, [libraryId, fetchFirstPage, restoreFromCache]);

	const onViewportScroll = useCallback<UIEventHandler<HTMLDivElement>>(
		(e) => {
			const el = e.currentTarget;
			scrollTopRef.current = el.scrollTop;
			if (libraryIdRef.current && cacheNamespace) {
				setLibraryWordsListCache<TItem, TLibrary>(
					cacheNamespace,
					libraryIdRef.current,
					{
						items,
						resolvedLibrary,
						offset: offsetRef.current,
						hasMore: hasMoreRef.current,
						scrollTop: el.scrollTop,
					},
				);
			}
			const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
			if (rest < SCROLL_LOAD_THRESHOLD_PX) {
				void fetchMore();
			}
		},
		[cacheNamespace, fetchMore, items, resolvedLibrary],
	);

	return {
		items,
		setItems,
		resolvedLibrary,
		loading,
		loadingMore,
		initialScrollTop,
		onViewportScroll,
	};
}
