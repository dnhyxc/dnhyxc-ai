/**
 * 拉取结果历史会话：按 streamId 分页加载明细（与 favorites 列表 hook 同构）
 */
import {
	type UIEventHandler,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { SCROLL_LOAD_THRESHOLD_PX } from '@/constant';

export type PackStreamHistoryPageResult<T> = {
	items: T[];
	itemCount: number;
};

export type UsePackStreamHistoryListOptions<T> = {
	streamId: string | null | undefined;
	pageSize: number;
	fetchPage: (
		streamId: string,
		limit: number,
		offset: number,
	) => Promise<PackStreamHistoryPageResult<T>>;
};

export function usePackStreamHistoryList<T>({
	streamId,
	pageSize,
	fetchPage,
}: UsePackStreamHistoryListOptions<T>) {
	const activeStreamId = streamId?.trim() || null;
	const active = Boolean(activeStreamId);

	const [items, setItems] = useState<T[]>([]);
	const [itemCount, setItemCount] = useState(0);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const offsetRef = useRef(0);
	const hasMoreRef = useRef(true);
	const fetchingMoreRef = useRef(false);
	const streamIdRef = useRef<string | null>(null);

	const fetchFirstPage = useCallback(
		async (sid: string) => {
			fetchingMoreRef.current = false;
			setLoading(true);
			setLoadingMore(false);
			offsetRef.current = 0;
			hasMoreRef.current = true;
			setItems([]);
			setItemCount(0);
			try {
				const { items: list, itemCount: total } = await fetchPage(
					sid,
					pageSize,
					0,
				);
				setItems(list);
				setItemCount(total);
				offsetRef.current = list.length;
				hasMoreRef.current = list.length >= pageSize;
			} catch {
				setItems([]);
				hasMoreRef.current = false;
			} finally {
				setLoading(false);
			}
		},
		[fetchPage, pageSize],
	);

	const fetchMore = useCallback(async () => {
		const sid = streamIdRef.current;
		if (!sid || !hasMoreRef.current || fetchingMoreRef.current || loading) {
			return;
		}
		fetchingMoreRef.current = true;
		setLoadingMore(true);
		const offset = offsetRef.current;
		try {
			const { items: chunk } = await fetchPage(sid, pageSize, offset);
			if (chunk.length === 0) {
				hasMoreRef.current = false;
				return;
			}
			setItems((prev) => [...prev, ...chunk]);
			offsetRef.current += chunk.length;
			hasMoreRef.current = chunk.length >= pageSize;
		} catch {
			hasMoreRef.current = false;
		} finally {
			fetchingMoreRef.current = false;
			setLoadingMore(false);
		}
	}, [fetchPage, loading, pageSize]);

	useEffect(() => {
		streamIdRef.current = activeStreamId;
		if (!activeStreamId) {
			setItems([]);
			setItemCount(0);
			return;
		}
		void fetchFirstPage(activeStreamId);
	}, [activeStreamId, fetchFirstPage]);

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
		active,
		items,
		itemCount,
		loading,
		loadingMore,
		onViewportScroll,
	};
}
