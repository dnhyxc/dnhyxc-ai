/**
 * 资源库右侧词条列表：分页加载、瞬时网络重试、切换库时丢弃过期响应
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
} from '@/constant';
import { useI18n } from '@/hooks';
import { retryAsync } from '@/utils/retryAsync';

export type LibraryWordsListResult<TItem, TLibrary> = {
	library: TLibrary;
	items: TItem[];
};

export type UseLibraryWordsListOptions<TItem, TLibrary> = {
	libraryId: string | null;
	pageSize?: number;
	fetchPage: (
		libraryId: string,
		limit: number,
		offset: number,
	) => Promise<LibraryWordsListResult<TItem, TLibrary>>;
};

export function useLibraryWordsList<TItem, TLibrary>({
	libraryId,
	pageSize = VOCAB_LIBRARY_ITEMS_PAGE_SIZE,
	fetchPage,
}: UseLibraryWordsListOptions<TItem, TLibrary>) {
	const { t } = useI18n();
	const [items, setItems] = useState<TItem[]>([]);
	const [resolvedLibrary, setResolvedLibrary] = useState<TLibrary | null>(null);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);

	const offsetRef = useRef(0);
	const hasMoreRef = useRef(true);
	const fetchingMoreRef = useRef(false);
	const libraryIdRef = useRef<string | null>(null);
	const loadGenRef = useRef(0);

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
			offsetRef.current = 0;
			hasMoreRef.current = true;
			setItems([]);
			setResolvedLibrary(null);
			try {
				const data = await fetchPageWithRetry(id, 0);
				if (gen !== loadGenRef.current || libraryIdRef.current !== id) return;
				if (data.library) {
					setResolvedLibrary(data.library);
				}
				const list = Array.isArray(data.items) ? data.items : [];
				setItems(list);
				offsetRef.current = list.length;
				hasMoreRef.current = list.length >= pageSize;
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
		[fetchPageWithRetry, pageSize, t],
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
				return;
			}
			setItems((prev) => [...prev, ...chunk]);
			offsetRef.current += chunk.length;
			hasMoreRef.current = chunk.length >= pageSize;
		} catch {
			if (gen !== loadGenRef.current) return;
			// 不关闭 hasMore，滚动到底可再次尝试
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
	}, [fetchPageWithRetry, loading, pageSize, t]);

	useEffect(() => {
		libraryIdRef.current = libraryId;
		if (!libraryId) {
			loadGenRef.current += 1;
			setItems([]);
			setResolvedLibrary(null);
			return;
		}
		const gen = ++loadGenRef.current;
		void fetchFirstPage(libraryId, gen);
	}, [libraryId, fetchFirstPage]);

	const onViewportScroll = useCallback<UIEventHandler<HTMLDivElement>>(
		(e) => {
			const el = e.currentTarget;
			const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
			if (rest < SCROLL_LOAD_THRESHOLD_PX) {
				void fetchMore();
			}
		},
		[fetchMore],
	);

	return {
		items,
		setItems,
		resolvedLibrary,
		loading,
		loadingMore,
		onViewportScroll,
	};
}
