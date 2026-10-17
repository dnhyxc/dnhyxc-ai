/**
 * 每日阅读列表：只展示已到发布日的篇目。生成在队列里，本页轮询状态。
 */
import Loading from '@design/Loading';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Button, Toast } from '@ui/index';
import { Spinner } from '@ui/spinner';
import {
	BookOpen,
	Check,
	Layers,
	Layers2,
	PanelTopClose,
	PanelTopOpen,
	WandSparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { HISTORY_PAGE_SIZE } from '@/constants';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	type EnglishDailyReadingItem,
	listEnglishDailyReadings,
} from '@/service';
import { LIBRARY_LIST_AT_BOTTOM_THRESHOLD_PX } from '../hooks/useListCornerFab';
import { PracticePageShell } from '../practice/components/shell';

type ReadingOrigin = 'day' | 'manual';

function parseOrigin(raw: string | null): ReadingOrigin {
	return raw === 'manual' ? 'manual' : 'day';
}

function OriginMenu({
	origin,
	onSelect,
}: {
	origin: ReadingOrigin;
	onSelect: (origin: ReadingOrigin) => void;
}) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const items: {
		id: ReadingOrigin;
		label: string;
		Icon: typeof Layers;
	}[] = [
		{
			id: 'day',
			label: t('englishLearning.dailyReading.day'),
			Icon: Layers,
		},
		{
			id: 'manual',
			label: t('englishLearning.dailyReading.manual'),
			Icon: Layers2,
		},
	];
	const current = items.find((item) => item.id === origin) ?? items[0]!;
	const TriggerIcon = open ? PanelTopClose : PanelTopOpen;
	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-label={current.label}
					aria-expanded={open}
					className={cn(
						'h-auto gap-1.5 px-0! py-0 text-sm font-medium text-teal-500 shadow-none',
						'has-[>svg]:px-0!',
						'hover:bg-transparent hover:text-teal-400',
						'focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none',
						'data-[state=open]:bg-transparent data-[state=open]:text-teal-400 data-[state=open]:ring-0',
					)}
				>
					<TriggerIcon className="size-4 shrink-0 opacity-90" aria-hidden />
					<span className="max-w-36 truncate">{current.label}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={6} className="min-w-36">
				{items.map((item) => {
					const active = origin === item.id;
					const Icon = item.Icon;
					return (
						<DropdownMenuItem
							key={item.id}
							className="gap-2"
							onSelect={() => onSelect(item.id)}
						>
							<Icon className="size-4 shrink-0 opacity-90" aria-hidden />
							<span className="min-w-0 flex-1 truncate">{item.label}</span>
							<Check
								className={cn(
									'size-3.5 shrink-0',
									active ? 'opacity-100' : 'opacity-0',
								)}
								aria-hidden
							/>
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const CARD =
	'border-theme/10 bg-theme/5 hover:border-teal-500/35 hover:bg-teal-500/10 flex min-w-0 cursor-pointer flex-col gap-1 rounded-md border px-3 py-3 text-left transition-colors';

const LINK_CLASS =
	'flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-medium text-teal-500 hover:text-teal-400';

const PAGE = HISTORY_PAGE_SIZE;

export default function DailyReadingListPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const origin = useMemo(
		() => parseOrigin(searchParams.get('origin')),
		[searchParams],
	);
	const [items, setItems] = useState<EnglishDailyReadingItem[]>([]);
	const [todayStatus, setTodayStatus] = useState<
		'ready' | 'generating' | 'failed' | null
	>(null);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [totalCount, setTotalCount] = useState(0);
	const started = useRef(false);
	const fetchingMoreRef = useRef(false);
	const hasMoreRef = useRef(false);
	const itemsRef = useRef<EnglishDailyReadingItem[]>([]);
	const loadedOriginRef = useRef(origin);
	const tailRef = useRef<HTMLDivElement>(null);
	const [watch, setWatch] = useState(0);
	const [pageError, setPageError] = useState<string | null>(null);
	const [retryLocked, setRetryLocked] = useState(false);

	const load = useCallback(
		async (offset: number, append: boolean) => {
			if (append) {
				if (fetchingMoreRef.current || !hasMoreRef.current) return;
				fetchingMoreRef.current = true;
				setLoadingMore(true);
			} else if (!started.current) setLoading(true);
			try {
				const res = await listEnglishDailyReadings({
					limit: PAGE,
					offset,
					origin,
					silent: true,
				});
				const data = res.data;
				const next = Array.isArray(data?.items) ? data.items : [];
				const total =
					typeof data?.totalCount === 'number' ? data.totalCount : null;
				const switched = loadedOriginRef.current !== origin;
				loadedOriginRef.current = origin;
				const prev = switched ? [] : itemsRef.current;
				const list = append
					? [...prev, ...next]
					: prev.length <= next.length
						? next
						: [
								...next,
								...prev.filter(
									(item) => !next.some((row) => row.id === item.id),
								),
							];
				const more = total == null ? next.length >= PAGE : list.length < total;
				setTodayStatus(data?.todayStatus ?? 'failed');
				setPageError(null);
				setTotalCount(total ?? list.length);
				hasMoreRef.current = more;
				setHasMore(more);
				itemsRef.current = list;
				setItems(list);
				started.current = true;
			} catch (e) {
				const message =
					e instanceof Error
						? e.message
						: t('englishLearning.dailyReading.loadFailed');
				if (!append) {
					setPageError(message);
				}
				Toast({ type: 'warning', title: message });
			} finally {
				if (append) fetchingMoreRef.current = false;
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[origin, t],
	);

	itemsRef.current = items;

	useEffect(() => {
		const node = tailRef.current;
		if (!node || !hasMore) return;
		const root = node.closest('[data-slot="scroll-area-viewport"]');
		if (!(root instanceof HTMLElement)) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				void load(itemsRef.current.length, true);
			},
			{
				root,
				rootMargin: `0px 0px ${LIBRARY_LIST_AT_BOTTOM_THRESHOLD_PX}px 0px`,
			},
		);
		io.observe(node);
		return () => io.disconnect();
	}, [hasMore, items.length, load]);

	useEffect(() => {
		void load(0, false);
	}, [load]);

	useEffect(() => {
		if (todayStatus !== 'failed') {
			setRetryLocked(false);
			return;
		}
		setRetryLocked(true);
		const timer = window.setTimeout(() => setRetryLocked(false), 5000);
		return () => window.clearTimeout(timer);
	}, [todayStatus]);

	const onSelectOrigin = useCallback(
		(next: ReadingOrigin) => {
			if (next === origin) return;
			itemsRef.current = [];
			setItems([]);
			started.current = false;
			hasMoreRef.current = false;
			setHasMore(false);
			setSearchParams(
				(prev) => {
					const params = new URLSearchParams(prev);
					params.set('origin', next);
					return params;
				},
				{ replace: true },
			);
		},
		[origin, setSearchParams],
	);

	useEffect(() => {
		if (origin !== 'day' || todayStatus !== 'generating') return;
		let n = 0;
		const timer = window.setInterval(() => {
			n += 1;
			if (n > 8) {
				window.clearInterval(timer);
				return;
			}
			void load(0, false);
		}, 5000);
		return () => window.clearInterval(timer);
	}, [origin, todayStatus, load, watch]);

	const preparingEmpty =
		origin === 'day' &&
		todayStatus === 'generating' &&
		!loading &&
		items.length === 0;
	const listEmpty =
		!loading && !pageError && items.length === 0 && !preparingEmpty;

	return (
		<PracticePageShell
			title={
				<>
					<span className="min-w-0 truncate">
						{t(
							origin === 'manual'
								? 'englishLearning.dailyReading.listHeadingManual'
								: 'englishLearning.dailyReading.listHeadingDay',
						)}
					</span>
					{items.length > 0 || (!loading && !pageError) ? (
						<span className="text-textcolor/50 shrink-0 text-sm font-normal">
							{t('englishLearning.dailyReading.listCount', {
								count: totalCount,
							})}{' '}
							/{' '}
							{t('common.loaded', {
								count: items.length,
								type: t('englishLearning.dailyReading.countUnit'),
							})}
						</span>
					) : null}
				</>
			}
			headerRight={
				<div className="flex items-center gap-3">
					<button
						type="button"
						className={LINK_CLASS}
						aria-label={t('englishLearning.dailyReading.settingsNav')}
						onClick={() => navigate('/english-learning/daily-reading/settings')}
					>
						<WandSparkles className="size-4 shrink-0" aria-hidden />
						<span>{t('englishLearning.dailyReading.settingsNav')}</span>
					</button>
					<OriginMenu origin={origin} onSelect={onSelectOrigin} />
				</div>
			}
			contentLayout={
				loading && items.length === 0
					? 'fill'
					: preparingEmpty || listEmpty
						? 'center'
						: 'start'
			}
		>
			{origin === 'day' && todayStatus === 'generating' && !preparingEmpty ? (
				<div className="mb-4 flex items-center gap-2 text-sm text-textcolor/70">
					<Spinner className="size-4" />
					{t('englishLearning.dailyReading.generating')}
				</div>
			) : null}
			{preparingEmpty ? (
				<div className="flex flex-col h-full justify-center items-center gap-3 text-center">
					<BookOpen
						className="size-16 text-textcolor opacity-60 animate-bounce"
						aria-hidden
					/>
					<p className="text-textcolor/60 text-sm">
						{t('englishLearning.dailyReading.generating')}
					</p>
				</div>
			) : null}
			{origin === 'day' && todayStatus === 'failed' ? (
				<div className="border-theme/10 bg-theme/5 mb-4 flex items-center justify-between gap-3 rounded-md border px-3 py-3 text-sm">
					<span>{t('englishLearning.dailyReading.failed')}</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={retryLocked}
						onClick={() => {
							setWatch((n) => n + 1);
							void load(0, false);
						}}
					>
						{t('englishLearning.dailyReading.retry')}
					</Button>
				</div>
			) : null}
			{loading && items.length === 0 ? <Loading /> : null}
			{!loading && pageError && items.length === 0 ? (
				<p className="text-textcolor/55 py-16 text-center text-sm">
					{pageError}
				</p>
			) : null}
			{listEmpty ? (
				<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
					<BookOpen
						className="size-16 text-textcolor opacity-60 animate-bounce"
						aria-hidden
					/>
					<p className="text-textcolor/60 text-sm">
						{t('englishLearning.dailyReading.empty')}
					</p>
				</div>
			) : null}
			{items.length > 0 ? (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">
					{items.map((item) => (
						<button
							key={item.id}
							type="button"
							className={CARD}
							onClick={() => {
								const params = new URLSearchParams({ title: item.titleEn });
								if (origin === 'manual') params.set('origin', 'manual');
								navigate(
									`/english-learning/daily-reading/${item.id}?${params}`,
								);
							}}
						>
							<span className="text-textcolor truncate text-sm font-semibold sm:text-base">
								{item.titleEn}
							</span>
							<span className="text-textcolor/50 truncate text-xs sm:text-sm">
								{item.publishDate}
								{item.level ? ` · ${item.level}` : ''}
								{item.length
									? ` · ${t(
											item.length === 'short'
												? 'englishLearning.dailyReading.lengthShort'
												: item.length === 'long'
													? 'englishLearning.dailyReading.lengthLong'
													: 'englishLearning.dailyReading.lengthMedium',
										)}`
									: ''}
								{item.titleZh ? ` · ${item.titleZh}` : ''}
							</span>
						</button>
					))}
				</div>
			) : null}
			{hasMore ? <div ref={tailRef} className="h-px" aria-hidden /> : null}
			{loadingMore ? (
				<div className="text-textcolor/50 flex items-center justify-center gap-1.5 py-4 text-xs">
					<Spinner className="size-3.5 text-textcolor/50" aria-hidden />
					{t('common.loadingMore')}
				</div>
			) : null}
		</PracticePageShell>
	);
}
