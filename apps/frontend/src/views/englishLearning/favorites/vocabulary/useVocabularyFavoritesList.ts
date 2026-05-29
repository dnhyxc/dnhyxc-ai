/**
 * 单词收藏列表：分页拉取与批量取消收藏
 */
import { Toast } from '@ui/index';
import {
	type UIEventHandler,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { SCROLL_LOAD_THRESHOLD_PX, VOCAB_HISTORY_PAGE_SIZE } from '@/constant';
import { useI18n } from '@/hooks';
import {
	type EnglishVocabularyFavoriteListEntry,
	listEnglishVocabularyFavorites,
	removeEnglishVocabularyFavoritesBatch,
} from '@/service';

export function useVocabularyFavoritesList(active: boolean) {
	const { t } = useI18n();
	const [entries, setEntries] = useState<EnglishVocabularyFavoriteListEntry[]>(
		[],
	);
	const [totalCount, setTotalCount] = useState(0);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const offsetRef = useRef(0);
	const hasMoreRef = useRef(true);
	const [hasMore, setHasMore] = useState(true);
	const fetchingMoreRef = useRef(false);
	const loadGenRef = useRef(0);

	const syncHasMore = useCallback((value: boolean) => {
		hasMoreRef.current = value;
		setHasMore(value);
	}, []);

	const fetchFirstPage = useCallback(
		async (gen: number) => {
			fetchingMoreRef.current = false;
			setLoading(true);
			setLoadingMore(false);
			offsetRef.current = 0;
			syncHasMore(true);
			setEntries([]);
			setTotalCount(0);
			try {
				const res = await listEnglishVocabularyFavorites({
					limit: VOCAB_HISTORY_PAGE_SIZE,
					offset: 0,
					silent: true,
				});
				if (gen !== loadGenRef.current) return;
				const page = res.data;
				const list = Array.isArray(page?.items) ? page.items : [];
				setEntries(list);
				setTotalCount(
					typeof page?.totalCount === 'number' ? page.totalCount : list.length,
				);
				offsetRef.current = list.length;
				syncHasMore(list.length >= VOCAB_HISTORY_PAGE_SIZE);
			} catch {
				if (gen !== loadGenRef.current) return;
				setEntries([]);
				setTotalCount(0);
				syncHasMore(false);
				Toast({
					type: 'error',
					title: t('englishLearning.favorites.listLoadFailed'),
				});
			} finally {
				if (gen === loadGenRef.current) {
					setLoading(false);
				}
			}
		},
		[syncHasMore, t],
	);

	const fetchMore = useCallback(async () => {
		if (!hasMoreRef.current || fetchingMoreRef.current || loading) {
			return;
		}
		const gen = loadGenRef.current;
		fetchingMoreRef.current = true;
		setLoadingMore(true);
		const offset = offsetRef.current;
		try {
			const res = await listEnglishVocabularyFavorites({
				limit: VOCAB_HISTORY_PAGE_SIZE,
				offset,
				silent: true,
			});
			if (gen !== loadGenRef.current) return;
			const page = res.data;
			const chunk = Array.isArray(page?.items) ? page.items : [];
			if (typeof page?.totalCount === 'number') {
				setTotalCount(page.totalCount);
			}
			if (chunk.length === 0) {
				syncHasMore(false);
				return;
			}
			setEntries((prev) => [...prev, ...chunk]);
			offsetRef.current += chunk.length;
			syncHasMore(chunk.length >= VOCAB_HISTORY_PAGE_SIZE);
		} catch {
			if (gen !== loadGenRef.current) return;
			Toast({
				type: 'error',
				title: t('englishLearning.favorites.listLoadMoreFailed'),
			});
		} finally {
			if (gen === loadGenRef.current) {
				fetchingMoreRef.current = false;
				setLoadingMore(false);
			}
		}
	}, [loading, syncHasMore, t]);

	useEffect(() => {
		if (!active) {
			loadGenRef.current += 1;
			return;
		}
		const gen = ++loadGenRef.current;
		void fetchFirstPage(gen);
	}, [active, fetchFirstPage]);

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

	const onBatchRemove = useCallback(
		async (selected: EnglishVocabularyFavoriteListEntry[]) => {
			if (selected.length === 0) return;
			await removeEnglishVocabularyFavoritesBatch(selected.map((it) => it.id));
			const gen = ++loadGenRef.current;
			await fetchFirstPage(gen);
		},
		[fetchFirstPage],
	);

	return {
		entries,
		totalCount,
		hasMore,
		loading,
		loadingMore,
		onViewportScroll,
		onBatchRemove,
	};
}
