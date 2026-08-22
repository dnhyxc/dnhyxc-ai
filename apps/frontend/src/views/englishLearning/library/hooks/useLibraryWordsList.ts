/**
 * 资源库右侧词条列表：双向分页、续读页、瞬时网络重试、切换库时丢弃过期响应、会话内窗口缓存
 */
import { Toast } from '@ui/index';
import {
	type RefObject,
	type UIEventHandler,
	useCallback,
	useEffect,
	useRef,
	useState,
	type WheelEventHandler,
} from 'react';
import { flushSync } from 'react-dom';
import {
	SCROLL_LOAD_THRESHOLD_PX,
	VOCAB_LIBRARY_ITEMS_PAGE_SIZE,
} from '@/constants';
import { useI18n } from '@/hooks';
import { retryAsync } from '@/utils/retryAsync';
import { setLibraryWordsListCache } from '../utils/libraryWordsListCache';
import { alignResumeOffset } from '../utils/libraryWordsListResume';

export type LibraryWordsListResult<TItem, TLibrary> = {
	library: TLibrary;
	items: TItem[];
};

export type UseLibraryWordsListOptions<TItem, TLibrary> = {
	libraryId: string | null;
	pageSize?: number;
	/** 区分单词库 / 经典句库缓存命名空间 */
	cacheNamespace?: string;
	/** 进入库时的续读 offset（来自库列表项；切换 libraryId 时读取） */
	initialResumeOffset?: number;
	/** 是否把续读写回服务端（非所有者应 false） */
	persistResume?: boolean;
	/** 续读变更：写库 + 同步左侧列表 / 选中项 */
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
	const [loadingPrevious, setLoadingPrevious] = useState(false);
	/** 从缓存恢复时用于恢复滚动位置 */
	const [initialScrollTop, setInitialScrollTop] = useState(0);

	const startOffsetRef = useRef(0);
	const endOffsetRef = useRef(0);
	const hasMoreRef = useRef(true);
	const hasPreviousRef = useRef(false);
	const fetchingMoreRef = useRef(false);
	const fetchingPrevRef = useRef(false);
	/** prepend 校正期间忽略触顶/触底 */
	const suppressScrollLoadRef = useRef(false);
	/** 进入后仅拉续读页；用户滚动/点击后再允许无限加载 */
	const scrollLoadArmedRef = useRef(false);
	const lastScrollTopRef = useRef(0);
	const libraryIdRef = useRef<string | null>(null);
	const loadGenRef = useRef(0);
	const scrollTopRef = useRef(0);
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

	fetchPageRef.current = fetchPage;
	tRef.current = t;
	resolvedLibraryRef.current = resolvedLibrary;
	itemsRef.current = items;
	initialResumeOffsetRef.current = initialResumeOffset;
	persistResumeRef.current = persistResume;
	onResumeOffsetChangeRef.current = onResumeOffsetChange;

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
				hasPrevious: hasPreviousRef.current,
				scrollTop: scrollTopRef.current,
			});
		},
		[cacheNamespace],
	);

	const fetchPageWithRetry = useCallback(
		(id: string, offset: number) =>
			retryAsync(() => fetchPageRef.current(id, pageSize, offset), {
				retries: 2,
				delayMs: 400,
			}),
		[pageSize],
	);

	const applyWindow = useCallback(
		(
			id: string,
			startOffset: number,
			list: TItem[],
			resolved: TLibrary | null,
		) => {
			startOffsetRef.current = startOffset;
			endOffsetRef.current = startOffset + list.length;
			hasPreviousRef.current = startOffset > 0;
			hasMoreRef.current = list.length >= pageSize;
			setItems(list);
			if (resolved) setResolvedLibrary(resolved);
			setResume(startOffset);
			persistCache(id, { items: list, resolvedLibrary: resolved });
		},
		[pageSize, persistCache, setResume],
	);

	const fetchFirstPage = useCallback(
		async (id: string, gen: number, resumeOffset: number) => {
			fetchingMoreRef.current = false;
			fetchingPrevRef.current = false;
			suppressScrollLoadRef.current = true;
			scrollLoadArmedRef.current = false;
			setLoading(true);
			setLoadingMore(false);
			setLoadingPrevious(false);
			setInitialScrollTop(0);
			scrollTopRef.current = 0;
			lastScrollTopRef.current = 0;
			startOffsetRef.current = resumeOffset;
			endOffsetRef.current = resumeOffset;
			hasMoreRef.current = true;
			hasPreviousRef.current = resumeOffset > 0;
			setItems([]);
			setResolvedLibrary(null);
			try {
				let startOffset = resumeOffset;
				let data = await fetchPageWithRetry(id, startOffset);
				if (gen !== loadGenRef.current || libraryIdRef.current !== id) return;
				let list = Array.isArray(data.items) ? data.items : [];
				if (list.length === 0 && startOffset > 0) {
					startOffset = 0;
					lastSavedResumeRef.current = -1;
					data = await fetchPageWithRetry(id, 0);
					if (gen !== loadGenRef.current || libraryIdRef.current !== id) {
						return;
					}
					list = Array.isArray(data.items) ? data.items : [];
				}
				const resolved = data.library ?? null;
				applyWindow(id, startOffset, list, resolved);
			} catch {
				if (gen !== loadGenRef.current) return;
				setItems([]);
				hasMoreRef.current = false;
				hasPreviousRef.current = false;
				Toast({
					type: 'error',
					title: tRef.current('englishLearning.library.wordsLoadFailed'),
				});
			} finally {
				if (gen === loadGenRef.current) {
					setLoading(false);
					requestAnimationFrame(() => {
						suppressScrollLoadRef.current = false;
					});
				}
			}
		},
		[applyWindow, fetchPageWithRetry],
	);

	const fetchMore = useCallback(async () => {
		const id = libraryIdRef.current;
		const gen = loadGenRef.current;
		if (
			!id ||
			!hasMoreRef.current ||
			fetchingMoreRef.current ||
			fetchingPrevRef.current ||
			suppressScrollLoadRef.current ||
			!scrollLoadArmedRef.current ||
			loading
		) {
			return;
		}
		fetchingMoreRef.current = true;
		setLoadingMore(true);
		const offset = endOffsetRef.current;
		try {
			const data = await fetchPageWithRetry(id, offset);
			if (gen !== loadGenRef.current || libraryIdRef.current !== id) return;
			const chunk = Array.isArray(data.items) ? data.items : [];
			const lib = resolvedLibraryRef.current;
			if (chunk.length === 0) {
				hasMoreRef.current = false;
				setItems((prev) => {
					persistCache(id, { items: prev, resolvedLibrary: lib });
					return prev;
				});
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
	}, [fetchPageWithRetry, loading, pageSize, persistCache, setResume]);

	const fetchPrevious = useCallback(async () => {
		const id = libraryIdRef.current;
		const gen = loadGenRef.current;
		if (
			!id ||
			!hasPreviousRef.current ||
			fetchingMoreRef.current ||
			fetchingPrevRef.current ||
			suppressScrollLoadRef.current ||
			!scrollLoadArmedRef.current ||
			loading
		) {
			return;
		}
		const start = startOffsetRef.current;
		if (start <= 0) {
			hasPreviousRef.current = false;
			return;
		}
		const prevOffset = Math.max(0, start - pageSize);
		const el = viewportRef?.current ?? null;

		fetchingPrevRef.current = true;
		suppressScrollLoadRef.current = true;

		// 顶部插入 loading 时先钉住视口，避免列表被顶开（与底部 loading 不顶视口对称）
		if (el) {
			const h0 = el.scrollHeight;
			const t0 = el.scrollTop;
			flushSync(() => {
				setLoadingPrevious(true);
			});
			el.scrollTop = t0 + (el.scrollHeight - h0);
			scrollTopRef.current = el.scrollTop;
			lastScrollTopRef.current = el.scrollTop;
		} else {
			setLoadingPrevious(true);
		}

		try {
			const data = await fetchPageWithRetry(id, prevOffset);
			if (gen !== loadGenRef.current || libraryIdRef.current !== id) {
				suppressScrollLoadRef.current = false;
				return;
			}
			const chunk = Array.isArray(data.items) ? data.items : [];
			const lib = resolvedLibraryRef.current;
			if (chunk.length === 0) {
				hasPreviousRef.current = false;
				if (el) {
					const h0 = el.scrollHeight;
					const t0 = el.scrollTop;
					flushSync(() => {
						setLoadingPrevious(false);
					});
					el.scrollTop = Math.max(0, t0 + (el.scrollHeight - h0));
					scrollTopRef.current = el.scrollTop;
					lastScrollTopRef.current = el.scrollTop;
				} else {
					setLoadingPrevious(false);
				}
				suppressScrollLoadRef.current = false;
				return;
			}

			/**
			 * 根因（桌面 WKWebView 尤甚）：
			 * - 下滑 append：上方 DOM 不变，视口仍是已绘制内容 → 无闪烁
			 * - 上滑 prepend：上方插入后若 scrollTop 仍≈0，视口落到未绘制新区 → 黑屏一帧
			 * ScrollArea 默认内层 flex/table 会加剧 scrollTop 回弹；列表侧用 viewportClassName
			 * 强制 block，并用 ΔscrollHeight 在同一同步回合钉住视口。
			 */
			const heightBefore = el?.scrollHeight ?? 0;
			const topBefore = el?.scrollTop ?? 0;

			flushSync(() => {
				setItems((prev) => {
					const next = [...chunk, ...prev];
					startOffsetRef.current = prevOffset;
					endOffsetRef.current = prevOffset + next.length;
					hasPreviousRef.current = prevOffset > 0;
					persistCache(id, { items: next, resolvedLibrary: lib });
					return next;
				});
				setLoadingPrevious(false);
			});

			const viewport = viewportRef?.current;
			if (viewport) {
				const nextTop = Math.max(
					0,
					topBefore + (viewport.scrollHeight - heightBefore),
				);
				viewport.scrollTop = nextTop;
				scrollTopRef.current = nextTop;
				lastScrollTopRef.current = nextTop;
				// 延后写续读，避免父级重渲与钉住抢同一帧
				queueMicrotask(() => {
					setResume(prevOffset);
				});
				requestAnimationFrame(() => {
					if (viewportRef?.current === viewport) {
						viewport.scrollTop = nextTop;
						scrollTopRef.current = viewport.scrollTop;
						lastScrollTopRef.current = viewport.scrollTop;
					}
					suppressScrollLoadRef.current = false;
				});
			} else {
				setResume(prevOffset);
				suppressScrollLoadRef.current = false;
			}
		} catch {
			suppressScrollLoadRef.current = false;
			if (gen !== loadGenRef.current) return;
			Toast({
				type: 'error',
				title: tRef.current('englishLearning.library.wordsLoadMoreFailed'),
			});
		} finally {
			if (gen === loadGenRef.current) {
				fetchingPrevRef.current = false;
				setLoadingPrevious(false);
			}
		}
	}, [
		fetchPageWithRetry,
		loading,
		pageSize,
		persistCache,
		setResume,
		viewportRef,
	]);

	fetchFirstPageRef.current = fetchFirstPage;

	// 切换库时读列表项续读；故意不依赖 initialResumeOffset 后续变更，避免写回后重载
	useEffect(() => {
		libraryIdRef.current = libraryId;
		scrollLoadArmedRef.current = false;
		lastScrollTopRef.current = 0;
		if (!libraryId) {
			loadGenRef.current += 1;
			setItems([]);
			setResolvedLibrary(null);
			setInitialScrollTop(0);
			return;
		}
		const resumeOffset = alignResumeOffset(
			initialResumeOffsetRef.current,
			pageSize,
		);
		lastSavedResumeRef.current = resumeOffset;
		const gen = ++loadGenRef.current;
		void fetchFirstPageRef.current(libraryId, gen, resumeOffset);
	}, [libraryId, pageSize]);

	const onViewportScroll = useCallback<UIEventHandler<HTMLDivElement>>(
		(e) => {
			const el = e.currentTarget;
			const top = el.scrollTop;
			const prevTop = lastScrollTopRef.current;
			const goingUp = top < prevTop - 0.5;
			const goingDown = top > prevTop + 0.5;
			lastScrollTopRef.current = top;
			scrollTopRef.current = top;
			if (libraryIdRef.current && cacheNamespace) {
				setLibraryWordsListCache<TItem, TLibrary>(
					cacheNamespace,
					libraryIdRef.current,
					{
						items: itemsRef.current,
						resolvedLibrary: resolvedLibraryRef.current,
						startOffset: startOffsetRef.current,
						endOffset: endOffsetRef.current,
						hasMore: hasMoreRef.current,
						hasPrevious: hasPreviousRef.current,
						scrollTop: top,
					},
				);
			}
			if (suppressScrollLoadRef.current || !scrollLoadArmedRef.current) {
				return;
			}
			if (goingUp && top < SCROLL_LOAD_THRESHOLD_PX) {
				void fetchPrevious();
			}
			const rest = el.scrollHeight - top - el.clientHeight;
			if (goingDown && rest < SCROLL_LOAD_THRESHOLD_PX) {
				void fetchMore();
			}
		},
		[cacheNamespace, fetchMore, fetchPrevious],
	);

	const armScrollLoad = useCallback(() => {
		scrollLoadArmedRef.current = true;
	}, []);

	const onViewportWheel = useCallback<WheelEventHandler<HTMLDivElement>>(
		(e) => {
			armScrollLoad();
			if (suppressScrollLoadRef.current) return;
			if (e.deltaY >= 0) {
				const el = e.currentTarget;
				const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
				if (rest < SCROLL_LOAD_THRESHOLD_PX) {
					void fetchMore();
				}
				return;
			}
			const el = e.currentTarget;
			if (el.scrollTop < SCROLL_LOAD_THRESHOLD_PX) {
				void fetchPrevious();
			}
		},
		[armScrollLoad, fetchMore, fetchPrevious],
	);

	return {
		items,
		setItems,
		resolvedLibrary,
		loading,
		loadingMore,
		loadingPrevious,
		initialScrollTop,
		onViewportScroll,
		onViewportWheel,
		onViewportPointerDown: armScrollLoad,
	};
}
