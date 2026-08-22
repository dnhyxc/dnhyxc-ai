/**
 * 资源库右侧词条列表：续读预取（0→续读页）+ 向下滚动加载更多。
 */
import { Toast } from '@ui/index';
import {
	type RefObject,
	type UIEventHandler,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { VOCAB_LIBRARY_ITEMS_PAGE_SIZE } from '@/constants';
import { useI18n } from '@/hooks';
import { retryAsync } from '@/utils/retryAsync';
import {
	getLibraryWordsListCache,
	setLibraryWordsListCache,
} from '../utils/libraryWordsListCache';
import {
	buildLibraryPrefetchChunks,
	mapWithConcurrency,
} from '../utils/libraryWordsListPrefetch';
import {
	alignResumeOffset,
	cacheCoversResumeOffset,
} from '../utils/libraryWordsListResume';

const PREFETCH_CONCURRENCY = 3;

export type LibraryWordsListResult<TItem, TLibrary> = {
	library: TLibrary;
	items: TItem[];
};

export type UseLibraryWordsListOptions<TItem, TLibrary> = {
	libraryId: string | null;
	pageSize?: number;
	cacheNamespace?: string;
	initialResumeOffset?: number;
	persistResume?: boolean;
	onResumeOffsetChange?: (libraryId: string, offset: number) => void;
	viewportRef?: RefObject<HTMLDivElement | null>;
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
	initialResumeOffset = 0,
	persistResume = true,
	onResumeOffsetChange,
	viewportRef,
	fetchPage,
}: UseLibraryWordsListOptions<TItem, TLibrary>) {
	const { t } = useI18n();
	const [items, setItems] = useState<TItem[]>([]);
	const [resolvedLibrary, setResolvedLibrary] = useState<TLibrary | null>(null);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [initialScrollTop, setInitialScrollTop] = useState(0);
	const [initialScrollItemIndex, setInitialScrollItemIndex] = useState(0);

	const startOffsetRef = useRef(0);
	const endOffsetRef = useRef(0);
	const hasMoreRef = useRef(true);
	const fetchingMoreRef = useRef(false);
	const lastMoreOffsetRef = useRef(-1);
	const listReadyRef = useRef(false);
	const scrollTopRef = useRef(0);
	const libraryIdRef = useRef<string | null>(null);
	const loadGenRef = useRef(0);
	const loadingRef = useRef(false);
	const resolvedLibraryRef = useRef<TLibrary | null>(null);
	const itemsRef = useRef<TItem[]>([]);
	const fetchPageRef = useRef(fetchPage);
	const tRef = useRef(t);
	const lastSavedResumeRef = useRef(0);
	const initialResumeOffsetRef = useRef(initialResumeOffset);
	const persistResumeRef = useRef(persistResume);
	const onResumeOffsetChangeRef = useRef(onResumeOffsetChange);
	const fetchFirstPageRef = useRef<
		(id: string, gen: number, resumeOffset: number) => Promise<void>
	>(async () => {});
	const bootedLibraryIdRef = useRef<string | null>(null);

	fetchPageRef.current = fetchPage;
	tRef.current = t;
	loadingRef.current = loading;
	resolvedLibraryRef.current = resolvedLibrary;
	itemsRef.current = items;
	initialResumeOffsetRef.current = initialResumeOffset;
	persistResumeRef.current = persistResume;
	onResumeOffsetChangeRef.current = onResumeOffsetChange;

	const markListReady = useCallback(() => {
		requestAnimationFrame(() => {
			listReadyRef.current = true;
		});
	}, []);

	const setResume = useCallback(
		(offset: number) => {
			const id = libraryIdRef.current;
			if (!id) return;
			const next = alignResumeOffset(offset, pageSize);
			if (next === lastSavedResumeRef.current) return;
			lastSavedResumeRef.current = next;
			if (!persistResumeRef.current) return;
			onResumeOffsetChangeRef.current?.(id, next);
		},
		[pageSize],
	);

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
				startOffset: startOffsetRef.current,
				endOffset: endOffsetRef.current,
				hasMore: hasMoreRef.current,
				hasPrevious: false,
				scrollTop: scrollTopRef.current,
			});
		},
		[cacheNamespace],
	);

	const fetchPageWithRetry = useCallback(
		(id: string, limit: number, offset: number) =>
			retryAsync(() => fetchPageRef.current(id, limit, offset), {
				retries: 2,
				delayMs: 400,
			}),
		[],
	);

	const applyWindow = useCallback(
		(
			id: string,
			startOffset: number,
			list: TItem[],
			resolved: TLibrary | null,
			scrollItemIndex: number,
			hasMore: boolean,
		) => {
			startOffsetRef.current = startOffset;
			endOffsetRef.current = startOffset + list.length;
			hasMoreRef.current = hasMore;
			setItems(list);
			if (resolved) setResolvedLibrary(resolved);
			setResume(alignResumeOffset(scrollItemIndex, pageSize));
			setInitialScrollItemIndex(scrollItemIndex);
			persistCache(id, { items: list, resolvedLibrary: resolved });
		},
		[pageSize, persistCache, setResume],
	);

	const restoreFromCache = useCallback(
		(id: string, resumeOffset: number): boolean => {
			if (!cacheNamespace) return false;
			const cached = getLibraryWordsListCache<TItem, TLibrary>(
				cacheNamespace,
				id,
			);
			if (!cached || cached.items.length === 0) return false;
			if (!cacheCoversResumeOffset(cached, resumeOffset, pageSize)) {
				return false;
			}

			const page = alignResumeOffset(resumeOffset, pageSize);
			loadGenRef.current += 1;
			startOffsetRef.current = cached.startOffset;
			endOffsetRef.current = cached.endOffset;
			hasMoreRef.current = cached.hasMore;
			scrollTopRef.current = cached.scrollTop;
			lastSavedResumeRef.current =
				page > 0 ? page : alignResumeOffset(cached.startOffset, pageSize);
			lastMoreOffsetRef.current = -1;
			const scrollIndex = Math.min(
				Math.max(0, page - cached.startOffset),
				Math.max(0, cached.items.length - 1),
			);
			setItems(cached.items);
			setResolvedLibrary(cached.resolvedLibrary);
			setInitialScrollTop(cached.scrollTop);
			setInitialScrollItemIndex(scrollIndex);
			setLoading(false);
			setLoadingMore(false);
			fetchingMoreRef.current = false;
			return true;
		},
		[cacheNamespace, pageSize],
	);

	const fetchInitialWindow = useCallback(
		async (id: string, gen: number, resumeOffset: number) => {
			listReadyRef.current = false;
			fetchingMoreRef.current = false;
			lastMoreOffsetRef.current = -1;
			setLoading(true);
			setLoadingMore(false);
			setInitialScrollTop(0);
			setInitialScrollItemIndex(0);
			scrollTopRef.current = 0;
			setItems([]);
			setResolvedLibrary(null);
			try {
				const chunks = buildLibraryPrefetchChunks(resumeOffset, pageSize);
				const pages = await mapWithConcurrency(
					chunks,
					PREFETCH_CONCURRENCY,
					(chunk) => fetchPageWithRetry(id, chunk.limit, chunk.offset),
				);
				if (gen !== loadGenRef.current || libraryIdRef.current !== id) return;

				const list: TItem[] = [];
				let lib: TLibrary | null = null;
				for (const page of pages) {
					const chunk = Array.isArray(page.items) ? page.items : [];
					list.push(...chunk);
					if (page.library) lib = page.library;
				}

				if (list.length === 0 && resumeOffset > 0) {
					const fallback = await fetchPageWithRetry(id, pageSize, 0);
					if (gen !== loadGenRef.current || libraryIdRef.current !== id) {
						return;
					}
					const fallbackList = Array.isArray(fallback.items)
						? fallback.items
						: [];
					const hasMore = fallbackList.length >= pageSize;
					applyWindow(
						id,
						0,
						fallbackList,
						fallback.library ?? null,
						0,
						hasMore,
					);
					return;
				}

				const scrollIndex = Math.min(
					Math.max(0, resumeOffset),
					Math.max(0, list.length - 1),
				);
				const lastPage = pages.at(-1);
				const lastChunk = chunks.at(-1);
				const hasMore =
					(lastPage?.items.length ?? 0) === (lastChunk?.limit ?? 0);
				applyWindow(id, 0, list, lib, scrollIndex, hasMore);
			} catch {
				if (gen !== loadGenRef.current) return;
				setItems([]);
				hasMoreRef.current = false;
				Toast({
					type: 'error',
					title: tRef.current('englishLearning.library.wordsLoadFailed'),
				});
			} finally {
				if (gen === loadGenRef.current) {
					setLoading(false);
					markListReady();
				}
			}
		},
		[applyWindow, fetchPageWithRetry, markListReady, pageSize],
	);

	const fetchMore = useCallback(async () => {
		const id = libraryIdRef.current;
		const gen = loadGenRef.current;
		const offset = endOffsetRef.current;
		if (
			!listReadyRef.current ||
			!id ||
			!hasMoreRef.current ||
			fetchingMoreRef.current ||
			loadingRef.current ||
			lastMoreOffsetRef.current === offset
		) {
			return;
		}
		fetchingMoreRef.current = true;
		lastMoreOffsetRef.current = offset;
		setLoadingMore(true);
		try {
			const data = await fetchPageWithRetry(id, pageSize, offset);
			if (gen !== loadGenRef.current || libraryIdRef.current !== id) return;
			const chunk = Array.isArray(data.items) ? data.items : [];
			const lib = resolvedLibraryRef.current;
			if (chunk.length === 0) {
				hasMoreRef.current = false;
				persistCache(id, { items: itemsRef.current, resolvedLibrary: lib });
				return;
			}
			setItems((prev) => {
				const next = [...prev, ...chunk];
				endOffsetRef.current = startOffsetRef.current + next.length;
				hasMoreRef.current = chunk.length >= pageSize;
				persistCache(id, { items: next, resolvedLibrary: lib });
				return next;
			});
			setResume(offset);
		} catch {
			lastMoreOffsetRef.current = -1;
			if (gen !== loadGenRef.current) return;
			Toast({
				type: 'error',
				title: tRef.current('englishLearning.library.wordsLoadMoreFailed'),
			});
		} finally {
			if (gen === loadGenRef.current) {
				fetchingMoreRef.current = false;
				setLoadingMore(false);
			}
		}
	}, [fetchPageWithRetry, pageSize, persistCache, setResume]);

	fetchFirstPageRef.current = fetchInitialWindow;

	useEffect(() => {
		libraryIdRef.current = libraryId;
		listReadyRef.current = false;
		lastMoreOffsetRef.current = -1;
		if (!libraryId) {
			loadGenRef.current += 1;
			bootedLibraryIdRef.current = null;
			setItems([]);
			setResolvedLibrary(null);
			setInitialScrollTop(0);
			setInitialScrollItemIndex(0);
			return;
		}
		if (bootedLibraryIdRef.current === libraryId) {
			return;
		}

		const resumeOffset = alignResumeOffset(
			initialResumeOffsetRef.current,
			pageSize,
		);
		if (restoreFromCache(libraryId, resumeOffset)) {
			bootedLibraryIdRef.current = libraryId;
			markListReady();
			return;
		}
		bootedLibraryIdRef.current = libraryId;
		lastSavedResumeRef.current = resumeOffset;
		const gen = ++loadGenRef.current;
		void fetchFirstPageRef.current(libraryId, gen, resumeOffset);
	}, [libraryId, pageSize, restoreFromCache, markListReady]);

	useEffect(() => {
		const el = viewportRef?.current;
		if (!el || initialScrollTop <= 0) return;
		el.scrollTop = initialScrollTop;
		scrollTopRef.current = initialScrollTop;
	}, [libraryId, initialScrollTop, viewportRef]);

	const onViewportScroll = useCallback<UIEventHandler<HTMLDivElement>>(
		(e) => {
			scrollTopRef.current = e.currentTarget.scrollTop;
			if (!libraryIdRef.current || !cacheNamespace) return;
			setLibraryWordsListCache<TItem, TLibrary>(
				cacheNamespace,
				libraryIdRef.current,
				{
					items: itemsRef.current,
					resolvedLibrary: resolvedLibraryRef.current,
					startOffset: startOffsetRef.current,
					endOffset: endOffsetRef.current,
					hasMore: hasMoreRef.current,
					hasPrevious: false,
					scrollTop: scrollTopRef.current,
				},
			);
		},
		[cacheNamespace],
	);

	const onEndReached = useCallback(() => {
		void fetchMore();
	}, [fetchMore]);

	return {
		items,
		setItems,
		resolvedLibrary,
		loading,
		loadingMore,
		initialScrollTop,
		initialScrollItemIndex,
		onViewportScroll,
		onEndReached,
	};
}
