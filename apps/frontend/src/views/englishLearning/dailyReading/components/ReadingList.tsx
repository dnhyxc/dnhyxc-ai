import Loading from '@design/Loading';
import { ScrollArea, Toast } from '@ui/index';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HISTORY_PAGE_SIZE } from '@/constants';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	type EnglishDailyReadingItem,
	listEnglishDailyReadings,
} from '@/service';
import type { ReadingOrigin } from '../utils/origin';
import { OriginMenu } from './OriginMenu';

const PAGE = HISTORY_PAGE_SIZE;

export function ReadingList({
	currentId,
	origin,
	onOrigin,
	onOpen,
}: {
	currentId: string;
	origin: ReadingOrigin;
	onOrigin: (next: ReadingOrigin) => void;
	onOpen: (item: EnglishDailyReadingItem) => void;
}) {
	const { t } = useI18n();
	const [items, setItems] = useState<EnglishDailyReadingItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const itemsRef = useRef<EnglishDailyReadingItem[]>([]);
	const hasMoreRef = useRef(false);
	const fetching = useRef(false);
	const gen = useRef(0);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const tailRef = useRef<HTMLDivElement>(null);

	const load = useCallback(
		async (offset: number) => {
			const append = offset > 0;
			if (append) {
				if (fetching.current || !hasMoreRef.current) return;
				fetching.current = true;
				setLoadingMore(true);
			} else {
				gen.current += 1;
				setLoading(true);
			}
			const ticket = gen.current;
			try {
				const res = await listEnglishDailyReadings({
					limit: PAGE,
					offset,
					origin,
					silent: true,
				});
				if (ticket !== gen.current) return;
				const next = Array.isArray(res.data?.items) ? res.data.items : [];
				const total =
					typeof res.data?.totalCount === 'number' ? res.data.totalCount : null;
				const list = append ? [...itemsRef.current, ...next] : next;
				const more = total == null ? next.length >= PAGE : list.length < total;
				itemsRef.current = list;
				hasMoreRef.current = more;
				setItems(list);
				setHasMore(more);
			} catch (e) {
				if (ticket !== gen.current) return;
				const message =
					e instanceof Error
						? e.message
						: t('englishLearning.dailyReading.loadFailed');
				Toast({ type: 'warning', title: message });
			} finally {
				if (append) fetching.current = false;
				if (ticket === gen.current) {
					setLoading(false);
					setLoadingMore(false);
				}
			}
		},
		[origin, t],
	);

	useEffect(() => {
		itemsRef.current = [];
		hasMoreRef.current = false;
		setItems([]);
		setHasMore(false);
		void load(0);
	}, [load]);

	useEffect(() => {
		const node = tailRef.current;
		const root = scrollerRef.current;
		if (!node || !root || !hasMore) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				void load(itemsRef.current.length);
			},
			{ root, rootMargin: '80px' },
		);
		io.observe(node);
		return () => io.disconnect();
	}, [hasMore, items.length, load]);

	return (
		<aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-theme/10 bg-theme-background">
			<div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4 pb-2">
				<span className="min-w-0 truncate text-sm font-medium">
					{t(
						origin === 'manual'
							? 'englishLearning.dailyReading.listHeadingManual'
							: 'englishLearning.dailyReading.listHeadingDay',
					)}
				</span>
				<OriginMenu
					origin={origin}
					onSelect={(next) => {
						if (next !== origin) onOrigin(next);
					}}
				/>
			</div>
			<ScrollArea ref={scrollerRef} className="min-h-0 flex-1 pb-4">
				{loading && items.length === 0 ? <Loading /> : null}
				{!loading && items.length === 0 ? (
					<p className="text-textcolor/60 py-8 text-center text-sm">
						{t('englishLearning.dailyReading.empty')}
					</p>
				) : null}
				{items.length > 0 ? (
					<div className="flex flex-col gap-0.5 px-4">
						{items.map((item) => {
							const selected = item.id === currentId;
							return (
								<button
									key={item.id}
									type="button"
									className={cn(
										'-mx-2 w-[calc(100%+1rem)] cursor-pointer rounded-md px-2 py-1.5 text-left',
										selected ? 'bg-theme/10' : 'hover:bg-theme/10',
									)}
									onClick={() => {
										if (item.id !== currentId) onOpen(item);
									}}
								>
									<span className="block truncate text-sm font-medium">
										{item.titleEn}
									</span>
									<span className="text-textcolor/50 mt-0.5 block truncate text-xs">
										{item.publishDate}
										{item.titleZh ? ` · ${item.titleZh}` : ''}
									</span>
								</button>
							);
						})}
					</div>
				) : null}
				{hasMore ? <div ref={tailRef} className="h-px" aria-hidden /> : null}
				{loadingMore ? (
					<p className="text-textcolor/50 py-2 text-center text-xs">
						{t('common.loadingMore')}
					</p>
				) : null}
			</ScrollArea>
		</aside>
	);
}
