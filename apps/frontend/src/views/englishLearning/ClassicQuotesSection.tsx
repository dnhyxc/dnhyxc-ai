/**
 * 按主题拉取英文经典语句（译文、出处、赏析），可朗读原句。
 */
import { Button, Input, Spinner, Toast } from '@ui/index';
import {
	BookMarked,
	Bookmark,
	CircleChevronDown,
	CircleChevronRight,
	Square,
	Star,
	Volume2,
} from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type UIEventHandler,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	COUNT_PRESETS,
	HISTORY_PAGE_SIZE,
	QUOTE_COUNT_MAX,
	QUOTE_COUNT_MIN,
	SCROLL_LOAD_THRESHOLD_PX,
} from '@/constant';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type {
	EnglishClassicQuoteFavoriteListEntry,
	EnglishClassicQuoteHistoryEntry,
	EnglishClassicQuoteItem,
} from '@/service';
import {
	addEnglishClassicQuoteFavorite,
	classicQuoteFavoriteContentKey,
	fetchEnglishClassicQuoteFavoriteStatus,
	getEnglishClassicQuotesHistoryDetail,
	listEnglishClassicQuoteFavorites,
	listEnglishClassicQuotesHistory,
	removeEnglishClassicQuoteFavorite,
} from '@/service';
import EnglishPackStore, {
	type EnglishPackUiProgress,
} from '@/store/englishPack';
import { sanitizeCountDigits } from '@/utils';
import { streamEnglishClassicQuotes } from '@/utils/englishLearningPackSse';
import { mergeEnglishPackWebSearchOrganics } from '@/utils/englishPackWebSearchMerge';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { formatEnglishLearningAgentToolLine } from './agentToolStatusText';
import { ClassicQuotesFavoritesDrawer } from './ClassicQuotesFavoritesDrawer';
import { ClassicQuotesHistoryDrawer } from './ClassicQuotesHistoryDrawer';
import { MasterWebSearchResultsBar } from './WebSearchResultsBar';

export type ClassicQuoteProgressState = EnglishPackUiProgress;

function ClassicQuotesSectionInner() {
	const { t } = useI18n();

	const loading = EnglishPackStore.classicLoading;
	const agentToolLine = EnglishPackStore.classicAgentToolLine;
	const masterSearchOrganic = EnglishPackStore.classicMasterSearchOrganic;
	const progress = EnglishPackStore.classicProgress;
	const items = EnglishPackStore.classicItems;

	const topic = EnglishPackStore.classicTopic;
	const countInput = EnglishPackStore.classicCountInput;

	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
	const [favoritesDrawerOpen, setFavoritesDrawerOpen] = useState(false);
	const [historyEntries, setHistoryEntries] = useState<
		EnglishClassicQuoteHistoryEntry[]
	>([]);
	const [favoriteDrawerEntries, setFavoriteDrawerEntries] = useState<
		EnglishClassicQuoteFavoriteListEntry[]
	>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
	const [favoriteDrawerLoading, setFavoriteDrawerLoading] = useState(false);
	const [favoriteDrawerLoadingMore, setFavoriteDrawerLoadingMore] =
		useState(false);
	const [loadingHistoryDetailId, setLoadingHistoryDetailId] = useState<
		string | null
	>(null);
	const [loadedStreamId, setLoadedStreamId] = useState<string | null>(null);
	/** 语句列表是否展开（默认展开） */
	const [listExpanded, setListExpanded] = useState(true);

	/** 已收藏句子的内容键（SHA256 hex，与后端 content_key 一致） */
	const [favoritedContentKeys, setFavoritedContentKeys] = useState<Set<string>>(
		() => new Set(),
	);
	const [favoriteActionKey, setFavoriteActionKey] = useState<string | null>(
		null,
	);

	const itemsEnglishSig = useMemo(
		() => items.map((it) => it.english).join('\u0001'),
		[items],
	);

	useEffect(() => {
		if (items.length === 0) {
			setFavoritedContentKeys(new Set());
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const res = await fetchEnglishClassicQuoteFavoriteStatus(
					items.map((i) => i.english),
				);
				if (cancelled) return;
				const keys = res.data?.favoritedContentKeys;
				setFavoritedContentKeys(new Set(Array.isArray(keys) ? keys : []));
			} catch {
				if (!cancelled) {
					setFavoritedContentKeys(new Set());
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [itemsEnglishSig]);

	const historyOffsetRef = useRef(0);
	const historyHasMoreRef = useRef(true);
	const historyFetchingMoreRef = useRef(false);
	const historyDrawerOpenRef = useRef(false);

	const favoriteDrawerOffsetRef = useRef(0);
	const favoriteDrawerHasMoreRef = useRef(true);
	const favoriteDrawerFetchingMoreRef = useRef(false);

	useEffect(() => {
		historyDrawerOpenRef.current = historyDrawerOpen;
	}, [historyDrawerOpen]);

	const fetchHistoryFirstPage = useCallback(async () => {
		historyFetchingMoreRef.current = false;
		setHistoryLoading(true);
		setHistoryLoadingMore(false);
		historyOffsetRef.current = 0;
		historyHasMoreRef.current = true;
		setHistoryEntries([]);
		try {
			const res = await listEnglishClassicQuotesHistory({
				limit: HISTORY_PAGE_SIZE,
				offset: 0,
			});
			const list = Array.isArray(res.data) ? res.data : [];
			setHistoryEntries(list);
			historyOffsetRef.current = list.length;
			historyHasMoreRef.current = list.length >= HISTORY_PAGE_SIZE;
		} catch {
			setHistoryEntries([]);
			historyHasMoreRef.current = false;
		} finally {
			setHistoryLoading(false);
		}
	}, []);

	const fetchHistoryMore = useCallback(async () => {
		if (
			!historyHasMoreRef.current ||
			historyFetchingMoreRef.current ||
			historyLoading
		) {
			return;
		}
		historyFetchingMoreRef.current = true;
		setHistoryLoadingMore(true);
		const offset = historyOffsetRef.current;
		try {
			const res = await listEnglishClassicQuotesHistory({
				limit: HISTORY_PAGE_SIZE,
				offset,
			});
			const chunk = Array.isArray(res.data) ? res.data : [];
			if (chunk.length === 0) {
				historyHasMoreRef.current = false;
				return;
			}
			setHistoryEntries((prev) => [...prev, ...chunk]);
			historyOffsetRef.current += chunk.length;
			historyHasMoreRef.current = chunk.length >= HISTORY_PAGE_SIZE;
		} catch {
			historyHasMoreRef.current = false;
		} finally {
			historyFetchingMoreRef.current = false;
			setHistoryLoadingMore(false);
		}
	}, [historyLoading]);

	useEffect(() => {
		if (!historyDrawerOpen) return;
		void fetchHistoryFirstPage();
	}, [historyDrawerOpen, fetchHistoryFirstPage]);

	const onHistoryViewportScroll = useCallback<UIEventHandler<HTMLDivElement>>(
		(e) => {
			const el = e.currentTarget;
			const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
			if (rest < SCROLL_LOAD_THRESHOLD_PX) {
				void fetchHistoryMore();
			}
		},
		[fetchHistoryMore],
	);

	const openHistoryDetail = useCallback(
		async (streamId: string) => {
			setLoadingHistoryDetailId(streamId);
			try {
				const res = await getEnglishClassicQuotesHistoryDetail(streamId);
				const d = res.data;
				if (d?.items?.length) {
					EnglishPackStore.classicLoadHistoryDetail(
						d.items,
						mergeEnglishPackWebSearchOrganics(d.webSearchRounds),
					);
					setListExpanded(true);
					setLoadedStreamId(streamId);
					setHistoryDrawerOpen(false);
					Toast({
						type: 'success',
						title: t('englishLearning.classic.historyLoaded'),
					});
				} else {
					Toast({
						type: 'info',
						title: t('englishLearning.classic.empty'),
					});
				}
			} finally {
				setLoadingHistoryDetailId(null);
			}
		},
		[t],
	);

	const fetchFavoriteDrawerFirstPage = useCallback(async () => {
		favoriteDrawerFetchingMoreRef.current = false;
		setFavoriteDrawerLoading(true);
		setFavoriteDrawerLoadingMore(false);
		favoriteDrawerOffsetRef.current = 0;
		favoriteDrawerHasMoreRef.current = true;
		setFavoriteDrawerEntries([]);
		try {
			const res = await listEnglishClassicQuoteFavorites({
				limit: HISTORY_PAGE_SIZE,
				offset: 0,
			});
			const list = Array.isArray(res.data) ? res.data : [];
			setFavoriteDrawerEntries(list);
			favoriteDrawerOffsetRef.current = list.length;
			favoriteDrawerHasMoreRef.current = list.length >= HISTORY_PAGE_SIZE;
		} catch {
			setFavoriteDrawerEntries([]);
			favoriteDrawerHasMoreRef.current = false;
		} finally {
			setFavoriteDrawerLoading(false);
		}
	}, []);

	const fetchFavoriteDrawerMore = useCallback(async () => {
		if (
			!favoriteDrawerHasMoreRef.current ||
			favoriteDrawerFetchingMoreRef.current ||
			favoriteDrawerLoading
		) {
			return;
		}
		favoriteDrawerFetchingMoreRef.current = true;
		setFavoriteDrawerLoadingMore(true);
		const offset = favoriteDrawerOffsetRef.current;
		try {
			const res = await listEnglishClassicQuoteFavorites({
				limit: HISTORY_PAGE_SIZE,
				offset,
			});
			const chunk = Array.isArray(res.data) ? res.data : [];
			if (chunk.length === 0) {
				favoriteDrawerHasMoreRef.current = false;
				return;
			}
			setFavoriteDrawerEntries((prev) => [...prev, ...chunk]);
			favoriteDrawerOffsetRef.current += chunk.length;
			favoriteDrawerHasMoreRef.current = chunk.length >= HISTORY_PAGE_SIZE;
		} catch {
			favoriteDrawerHasMoreRef.current = false;
		} finally {
			favoriteDrawerFetchingMoreRef.current = false;
			setFavoriteDrawerLoadingMore(false);
		}
	}, [favoriteDrawerLoading]);

	useEffect(() => {
		if (!favoritesDrawerOpen) return;
		void fetchFavoriteDrawerFirstPage();
	}, [favoritesDrawerOpen, fetchFavoriteDrawerFirstPage]);

	const onFavoriteDrawerViewportScroll = useCallback<
		UIEventHandler<HTMLDivElement>
	>(
		(e) => {
			const el = e.currentTarget;
			const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
			if (rest < SCROLL_LOAD_THRESHOLD_PX) {
				void fetchFavoriteDrawerMore();
			}
		},
		[fetchFavoriteDrawerMore],
	);

	const onBatchRemoveClassicFavorites = useCallback(
		async (selected: EnglishClassicQuoteFavoriteListEntry[]) => {
			if (selected.length === 0) return;
			await Promise.all(
				selected.map((it) => removeEnglishClassicQuoteFavorite(it.english)),
			);
			setFavoritedContentKeys((prev) => {
				const next = new Set(prev);
				for (const it of selected) {
					const ck = classicQuoteFavoriteContentKey(it.english);
					if (ck) next.delete(ck);
				}
				return next;
			});
			await fetchFavoriteDrawerFirstPage();
		},
		[fetchFavoriteDrawerFirstPage],
	);

	const cancelGenerate = useCallback(() => {
		EnglishPackStore.classicCancelByUser();
	}, []);

	const onGenerate = useCallback(async () => {
		const req = topic.trim();
		if (!req) {
			Toast({
				type: 'warning',
				title: t('englishLearning.classic.topicRequired'),
			});
			return;
		}
		let effectiveTarget = QUOTE_COUNT_MAX;
		const body: { topic: string; count?: number } = { topic: req };
		if (countInput.trim() !== '') {
			const n = Number.parseInt(countInput, 10);
			if (!Number.isFinite(n) || n < QUOTE_COUNT_MIN || n > QUOTE_COUNT_MAX) {
				Toast({
					type: 'warning',
					title: t('englishLearning.classic.countInvalid'),
				});
				return;
			}
			effectiveTarget = Math.min(QUOTE_COUNT_MAX, Math.max(QUOTE_COUNT_MIN, n));
			body.count = effectiveTarget;
		}

		const myGen = EnglishPackStore.startClassicStream(effectiveTarget);

		setListExpanded(true);

		const abort = await streamEnglishClassicQuotes({
			body,
			callbacks: {
				onProgress: (p) => {
					EnglishPackStore.classicOnProgress(myGen, p);
				},
				onAgentTool: (ev) => {
					if (ev.phase === 'organic' && ev.organic?.length) {
						EnglishPackStore.classicOnAgentTool(myGen, null, ev.organic);
						return;
					}
					EnglishPackStore.classicOnAgentTool(
						myGen,
						formatEnglishLearningAgentToolLine(t, ev),
						[],
					);
				},
				onChunk: ({ items: delta }) => {
					EnglishPackStore.classicOnChunk(myGen, delta);
				},
				onDone: ({ items: list, requested }) => {
					if (myGen !== EnglishPackStore.classicStreamGenId) return;
					EnglishPackStore.classicOnDone(myGen, list);
					setLoadedStreamId(null);
					if (historyDrawerOpenRef.current) {
						void fetchHistoryFirstPage();
					}
					if (list.length === 0) {
						Toast({
							type: 'info',
							title: t('englishLearning.classic.empty'),
						});
					} else if (list.length < requested) {
						Toast({
							type: 'info',
							title: t('englishLearning.classic.partialResult', {
								got: list.length,
								want: requested,
							}),
						});
					}
				},
				onError: (msg) => {
					if (myGen !== EnglishPackStore.classicStreamGenId) return;
					EnglishPackStore.classicOnError(myGen);
					Toast({ type: 'error', title: msg });
				},
				onUserAbort: () => {
					if (myGen !== EnglishPackStore.classicStreamGenId) return;
					EnglishPackStore.classicOnUserAbort(myGen);
					Toast({
						type: 'info',
						title: t('englishLearning.classic.aborted'),
					});
				},
				onIncomplete: () => {
					if (myGen !== EnglishPackStore.classicStreamGenId) return;
					EnglishPackStore.classicOnIncomplete(myGen);
					Toast({
						type: 'warning',
						title: t('englishLearning.classic.streamDisconnected'),
					});
				},
			},
		});
		if (myGen === EnglishPackStore.classicStreamGenId) {
			EnglishPackStore.setClassicAbort(abort);
		}
	}, [topic, countInput, t, fetchHistoryFirstPage]);

	const toggleQuoteAudio = useCallback(
		async (text: string, key: string) => {
			if (playingKey === key) {
				stopAllEnglishPlayback();
				setPlayingKey(null);
				return;
			}
			stopAllEnglishPlayback();
			setPlayingKey(key);
			try {
				await playEnglishPreferred(text);
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[playingKey, t],
	);

	const toggleClassicQuoteFavorite = useCallback(
		async (item: EnglishClassicQuoteItem, currentlyFavorited: boolean) => {
			const ck = classicQuoteFavoriteContentKey(item.english);
			if (!ck) return;
			setFavoriteActionKey(ck);
			try {
				if (currentlyFavorited) {
					await removeEnglishClassicQuoteFavorite(item.english);
					setFavoritedContentKeys((prev) => {
						const next = new Set(prev);
						next.delete(ck);
						return next;
					});
				} else {
					await addEnglishClassicQuoteFavorite(item);
					setFavoritedContentKeys((prev) => {
						const next = new Set(prev);
						next.add(ck);
						return next;
					});
				}
			} catch {
				// 错误提示由 http 客户端统一处理
			} finally {
				setFavoriteActionKey(null);
			}
		},
		[],
	);

	const normalizeCountOnBlur = useCallback(() => {
		if (countInput.trim() === '') {
			return;
		}
		const n = Number.parseInt(countInput, 10);
		if (!Number.isFinite(n)) {
			EnglishPackStore.setClassicCountInput('');
			return;
		}
		const clamped = Math.min(QUOTE_COUNT_MAX, Math.max(QUOTE_COUNT_MIN, n));
		EnglishPackStore.setClassicCountInput(String(clamped));
	}, [countInput]);

	return (
		<div className="rounded-none @container min-w-0 px-4 pb-0">
			<div className="mb-4 flex items-start gap-3">
				<div className="bg-linear-to-r from-violet-500 to-indigo-600 @min-[26rem]:size-11 flex size-10 shrink-0 items-center justify-center rounded-md">
					<BookMarked className="text-white size-6" aria-hidden />
				</div>
				<div className="min-w-0">
					<div className="text-textcolor leading-tight font-semibold tracking-tight">
						{t('englishLearning.classic.title')}
					</div>
					<div className="text-textcolor/50 @min-[26rem]:text-xs @min-[26rem]:mt-1.5 mt-1 text-xs leading-relaxed">
						{t('englishLearning.classic.descShort')}
					</div>
				</div>
			</div>

			<label
				htmlFor="english-classic-topic"
				className="text-textcolor/45 mb-1.5 block text-sm font-medium"
			>
				{t('englishLearning.classic.topicFieldLabel')}
			</label>
			<Input
				id="english-classic-topic"
				value={topic}
				onChange={(e) => EnglishPackStore.setClassicTopic(e.target.value)}
				placeholder={t('englishLearning.classic.topicPlaceholder')}
				className="h-9 w-full border-theme/10 bg-theme/5 focus-visible:border-theme/10 focus-visible:ring-0 mt-0.5 mb-3.5"
				disabled={loading}
			/>

			<div className="space-y-3">
				<div className="w-full min-w-0">
					<label
						htmlFor="english-classic-count"
						className="text-textcolor/45 mb-1.5 block text-sm font-medium"
					>
						{t('englishLearning.classic.count')}
					</label>
					<Input
						id="english-classic-count"
						autoComplete="off"
						aria-describedby="english-classic-count-hint"
						placeholder={t('englishLearning.classic.countPlaceholder')}
						value={countInput}
						onChange={(e) =>
							EnglishPackStore.setClassicCountInput(
								sanitizeCountDigits(e.target.value),
							)
						}
						onBlur={normalizeCountOnBlur}
						disabled={loading}
						className="mt-0.5 h-9 w-full border-theme/10 bg-theme/5 focus-visible:border-theme/10 focus-visible:ring-0"
					/>
					<div
						id="english-classic-count-hint"
						className="text-textcolor/40 mt-1.5 text-xs leading-snug"
					>
						{t('englishLearning.classic.countHint')}
					</div>
					<div className="mt-2 mb-5 flex flex-wrap gap-2 justify-between">
						{COUNT_PRESETS.map((n: (typeof COUNT_PRESETS)[number]) => (
							<Button
								key={n}
								size="sm"
								variant="outline"
								disabled={loading}
								onClick={() => EnglishPackStore.setClassicCountInput(String(n))}
								className={cn(
									'flex-1 rounded-md border bg-theme/5 px-2 py-1 text-xs font-medium transition-colors',
									countInput === String(n)
										? 'border-teal-500/35 text-teal-500'
										: 'border-theme/10 text-textcolor/65 hover:border-teal-500/20 hover:text-teal-500',
								)}
							>
								{n}
							</Button>
						))}
					</div>
				</div>
				<div className="flex min-w-0 items-stretch gap-2">
					<Button
						type="button"
						size="sm"
						variant={loading ? 'outline' : 'default'}
						onClick={() => (loading ? cancelGenerate() : void onGenerate())}
						className={cn(
							'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-white',
							loading
								? 'border-red-500/20 bg-red-500/20 text-textcolor/80 hover:bg-red-500/25'
								: 'bg-linear-to-r from-violet-600 to-indigo-600 hover:bg-linear-to-r hover:from-violet-400 hover:to-indigo-600',
						)}
					>
						{loading ? (
							<>
								<Spinner className="size-4 shrink-0 text-textcolor" />
								<span className="truncate">
									{t('englishLearning.classic.stop')}
								</span>
							</>
						) : (
							<span className="truncate">
								{t('englishLearning.classic.generate')}
							</span>
						)}
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={() => setHistoryDrawerOpen(true)}
						className="text-white hover:bg-linear-to-r hover:from-indigo-400 hover:to-indigo-600 bg-linear-to-r from-indigo-500 to-indigo-600 h-9 shrink-0 gap-1.5 whitespace-nowrap rounded-md px-2 sm:px-2.5"
						title={t('englishLearning.classic.historyOpenDrawer')}
					>
						<span className="max-[380px]:sr-only">
							{t('englishLearning.classic.historyOpenDrawer')}
						</span>
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={() => setFavoritesDrawerOpen(true)}
						className="text-white hover:bg-linear-to-r hover:from-indigo-400 hover:to-indigo-600 bg-linear-to-r from-indigo-500 to-indigo-600 h-9 w-9 shrink-0 gap-0 rounded-md px-0 sm:w-auto sm:gap-1.5 sm:px-2.5"
						title={t('englishLearning.classic.favoritesOpenDrawer')}
						aria-label={t('englishLearning.classic.favoritesOpenDrawer')}
					>
						<Bookmark className="size-4 shrink-0 sm:hidden" aria-hidden />
						<span className="hidden sm:inline max-[420px]:sr-only">
							{t('englishLearning.classic.favoritesOpenDrawer')}
						</span>
					</Button>
				</div>
				{loading && progress ? (
					<div className="border border-theme/10 space-y-2 rounded-md bg-theme-secondary/40 px-3 py-2.5">
						{agentToolLine ? (
							<div className="text-indigo-600/90 dark:text-indigo-400/90 text-xs leading-snug">
								{agentToolLine}
							</div>
						) : null}
						<div className="text-textcolor/70 text-xs leading-snug">
							{t('englishLearning.classic.progress', {
								collected: progress.collected,
								target: progress.target,
								round: progress.round,
							})}
						</div>
						<div className="bg-theme/10 h-1.5 w-full overflow-hidden rounded-md">
							<div
								className="bg-violet-500/85 h-full rounded-md transition-[width] duration-300 ease-out"
								style={{
									width: `${Math.min(
										100,
										(progress.collected / Math.max(1, progress.target)) * 100,
									)}%`,
								}}
							/>
						</div>
					</div>
				) : null}
			</div>

			{items.length > 0 ? (
				<>
					<div className="sticky -top-2.5 -mx-4 px-4 mt-2.5 pb-0.5 flex min-h-6 items-center justify-between gap-2 bg-theme-background/95 backdrop-blur-sm">
						<div className="flex items-center gap-2 text-textcolor/45 text-sm font-medium">
							<div className="flex items-center">
								{t('englishLearning.classic.listHeading')}
								<span className="mt-0.5">（{items.length}）</span>
							</div>
							{masterSearchOrganic.length > 0 ? (
								<MasterWebSearchResultsBar items={masterSearchOrganic} t={t} />
							) : null}
						</div>
						<Button
							type="button"
							variant="link"
							size="sm"
							className="text-textcolor/55 hover:text-textcolor h-8 w-8 shrink-0 p-0 mt-0.5 -mr-2"
							onClick={() => setListExpanded((v) => !v)}
							aria-expanded={listExpanded}
							aria-label={
								listExpanded
									? t('englishLearning.classic.collapseList')
									: t('englishLearning.classic.expandList')
							}
						>
							{listExpanded ? (
								<CircleChevronDown
									className="w-full h-full transition-transform duration-200"
									aria-hidden
								/>
							) : (
								<CircleChevronRight
									className="w-full h-full transition-transform duration-200"
									aria-hidden
								/>
							)}
						</Button>
					</div>
					{listExpanded ? (
						<div className="select-text grid grid-cols-1 gap-4 @min-[26rem]:grid-cols-2">
							{items.map((item, i) => {
								const contentKey = classicQuoteFavoriteContentKey(item.english);
								const key = `${i}-${contentKey || item.english.slice(0, 48)}`;
								const playing = playingKey === key;
								const isFavorited =
									contentKey.length > 0 && favoritedContentKeys.has(contentKey);
								const favBusy = favoriteActionKey === contentKey;
								return (
									<div
										key={key}
										className="bg-theme/5 border border-theme/10 flex flex-col gap-1.5 rounded-md px-3 py-2.5 @min-[26rem]:p-3"
									>
										<div className="flex items-start justify-between gap-2">
											<div className="text-textcolor min-w-0 flex-1 text-base font-medium leading-snug @min-[26rem]:text-lg">
												{item.english}
											</div>
											<div className="flex transition-opacity duration-200 shrink-0 items-center gap-1">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() =>
														void toggleQuoteAudio(item.english, key)
													}
													className={cn(
														'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors @min-[26rem]:border-theme/15 @min-[26rem]:p-1.5',
														playing
															? 'border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-400'
															: 'border-theme/12 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-violet-600 dark:hover:text-violet-400',
													)}
													aria-label={
														playing
															? t('englishLearning.tts.stop')
															: t('englishLearning.classic.playQuote')
													}
												>
													{playing ? (
														<Square className="size-3.5 fill-current" />
													) : (
														<Volume2 className="size-3.5" />
													)}
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													disabled={favBusy || !contentKey}
													onClick={() =>
														void toggleClassicQuoteFavorite(item, isFavorited)
													}
													className={cn(
														'h-7 w-7 shrink-0 rounded-md border p-0 transition-colors @min-[26rem]:h-8 @min-[26rem]:w-8 @min-[26rem]:border-theme/15',
														isFavorited
															? 'border-amber-400/45 bg-amber-400/12 text-amber-600 dark:text-amber-400'
															: 'border-theme/12 text-textcolor/55 hover:border-theme/20 hover:bg-theme/10 hover:text-amber-600',
													)}
													aria-pressed={isFavorited}
													aria-label={
														isFavorited
															? t('englishLearning.classic.unfavoriteQuote')
															: t('englishLearning.classic.favoriteQuote')
													}
													title={
														isFavorited
															? t('englishLearning.classic.unfavoriteQuote')
															: t('englishLearning.classic.favoriteQuote')
													}
												>
													<Star
														className={cn(
															'size-3.5',
															isFavorited && 'fill-current',
														)}
														aria-hidden
													/>
												</Button>
											</div>
										</div>
										<div className="text-textcolor/90 text-sm leading-snug">
											{item.translationZh}
										</div>
										<div className="text-textcolor/70 text-xs">
											{t('englishLearning.classic.sourceLabel')}
											{item.source || '—'}
										</div>
										<div className="text-textcolor/70 text-xs leading-relaxed italic">
											{item.noteZh}
										</div>
									</div>
								);
							})}
						</div>
					) : null}
				</>
			) : null}

			<ClassicQuotesHistoryDrawer
				open={historyDrawerOpen}
				onOpenChange={setHistoryDrawerOpen}
				entries={historyEntries}
				loading={historyLoading}
				loadingMore={historyLoadingMore}
				loadedStreamId={loadedStreamId}
				loadingDetailId={loadingHistoryDetailId}
				onViewportScroll={onHistoryViewportScroll}
				onSelectEntry={openHistoryDetail}
			/>
			<ClassicQuotesFavoritesDrawer
				open={favoritesDrawerOpen}
				onOpenChange={setFavoritesDrawerOpen}
				entries={favoriteDrawerEntries}
				loading={favoriteDrawerLoading}
				loadingMore={favoriteDrawerLoadingMore}
				onViewportScroll={onFavoriteDrawerViewportScroll}
				playingKey={playingKey}
				onTogglePlayQuote={toggleQuoteAudio}
				onBatchRemoveFavorites={onBatchRemoveClassicFavorites}
			/>
		</div>
	);
}

export const ClassicQuotesSection = observer(ClassicQuotesSectionInner);
