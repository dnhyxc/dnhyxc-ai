/**
 * 语句错题集列表：分页拉取与删除
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
	type EnglishClassicQuoteMistakeListEntry,
	listEnglishClassicQuoteMistakes,
	removeEnglishClassicQuoteMistakesBatch,
} from '@/service';

export function useClassicQuoteMistakesList(active: boolean) {
	const { t } = useI18n();
	const [entries, setEntries] = useState<EnglishClassicQuoteMistakeListEntry[]>(
		[],
	);
	const [totalCount, setTotalCount] = useState(0);
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
			setTotalCount(0);
			try {
				const res = await listEnglishClassicQuoteMistakes({
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
				hasMoreRef.current = list.length >= VOCAB_HISTORY_PAGE_SIZE;
			} catch {
				if (gen !== loadGenRef.current) return;
				setEntries([]);
				setTotalCount(0);
				hasMoreRef.current = false;
				Toast({
					type: 'error',
					title: t('englishLearning.mistakes.classicListLoadFailed'),
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
			const res = await listEnglishClassicQuoteMistakes({
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
				hasMoreRef.current = false;
				return;
			}
			setEntries((prev) => [...prev, ...chunk]);
			offsetRef.current += chunk.length;
			hasMoreRef.current = chunk.length >= VOCAB_HISTORY_PAGE_SIZE;
		} catch {
			if (gen !== loadGenRef.current) return;
			hasMoreRef.current = false;
		} finally {
			if (gen === loadGenRef.current) {
				fetchingMoreRef.current = false;
				setLoadingMore(false);
			}
		}
	}, [loading]);

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
		async (selected: EnglishClassicQuoteMistakeListEntry[]) => {
			if (selected.length === 0) return;
			await removeEnglishClassicQuoteMistakesBatch(selected.map((it) => it.id));
			const gen = ++loadGenRef.current;
			await fetchFirstPage(gen);
		},
		[fetchFirstPage],
	);

	return {
		entries,
		totalCount,
		loading,
		loadingMore,
		onViewportScroll,
		onBatchRemove,
	};
}
