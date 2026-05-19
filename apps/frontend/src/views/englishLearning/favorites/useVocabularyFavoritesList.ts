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
	removeEnglishVocabularyFavorite,
} from '@/service';

export function useVocabularyFavoritesList(active: boolean) {
	const { t } = useI18n();
	const [entries, setEntries] = useState<EnglishVocabularyFavoriteListEntry[]>(
		[],
	);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const offsetRef = useRef(0);
	const hasMoreRef = useRef(true);
	const fetchingMoreRef = useRef(false);
	const loadGenRef = useRef(0);

	const fetchFirstPage = useCallback(
		async (gen: number) => {
			fetchingMoreRef.current = false;
			setLoading(true);
			setLoadingMore(false);
			offsetRef.current = 0;
			hasMoreRef.current = true;
			setEntries([]);
			try {
				const res = await listEnglishVocabularyFavorites({
					limit: VOCAB_HISTORY_PAGE_SIZE,
					offset: 0,
					silent: true,
				});
				if (gen !== loadGenRef.current) return;
				const list = Array.isArray(res.data) ? res.data : [];
				setEntries(list);
				offsetRef.current = list.length;
				hasMoreRef.current = list.length >= VOCAB_HISTORY_PAGE_SIZE;
			} catch {
				if (gen !== loadGenRef.current) return;
				setEntries([]);
				hasMoreRef.current = false;
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
		[t],
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
			const chunk = Array.isArray(res.data) ? res.data : [];
			if (chunk.length === 0) {
				hasMoreRef.current = false;
				return;
			}
			setEntries((prev) => [...prev, ...chunk]);
			offsetRef.current += chunk.length;
			hasMoreRef.current = chunk.length >= VOCAB_HISTORY_PAGE_SIZE;
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
	}, [loading, t]);

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
			await Promise.all(
				selected.map((it) => removeEnglishVocabularyFavorite(it.word)),
			);
			const gen = ++loadGenRef.current;
			await fetchFirstPage(gen);
		},
		[fetchFirstPage],
	);

	return {
		entries,
		loading,
		loadingMore,
		onViewportScroll,
		onBatchRemove,
	};
}
