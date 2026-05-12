/**
 * 按主题拉取英文经典语句（译文、出处、赏析），可朗读原句。
 */
import { Button, Input, Spinner, Toast } from '@ui/index';
import { BookMarked, Square, Volume2 } from 'lucide-react';
import {
	type UIEventHandler,
	useCallback,
	useEffect,
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
	EnglishClassicQuoteHistoryEntry,
	EnglishClassicQuoteItem,
} from '@/service';
import {
	getEnglishClassicQuotesHistoryDetail,
	listEnglishClassicQuotesHistory,
} from '@/service';
import { sanitizeCountDigits } from '@/utils';
import { streamEnglishClassicQuotes } from '@/utils/englishClassicQuotesSse';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { formatEnglishLearningAgentToolLine } from './agentToolStatusText';
import { ClassicQuotesHistoryDrawer } from './ClassicQuotesHistoryDrawer';

export type ClassicQuoteProgressState = {
	collected: number;
	target: number;
	round: number;
};

function ClassicQuotesSectionInner() {
	const { t } = useI18n();

	const [topic, setTopic] = useState('');
	const [countInput, setCountInput] = useState('10');
	const [loading, setLoading] = useState(false);
	const [agentToolLine, setAgentToolLine] = useState<string | null>(null);
	const [progress, setProgress] = useState<ClassicQuoteProgressState | null>(
		null,
	);
	const [items, setItems] = useState<EnglishClassicQuoteItem[]>([]);
	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
	const [historyEntries, setHistoryEntries] = useState<
		EnglishClassicQuoteHistoryEntry[]
	>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
	const [loadingHistoryDetailId, setLoadingHistoryDetailId] = useState<
		string | null
	>(null);
	const [loadedStreamId, setLoadedStreamId] = useState<string | null>(null);

	const historyOffsetRef = useRef(0);
	const historyHasMoreRef = useRef(true);
	const historyFetchingMoreRef = useRef(false);
	const historyDrawerOpenRef = useRef(false);

	const abortRef = useRef<((fromUser?: boolean) => void) | null>(null);
	const genIdRef = useRef(0);

	useEffect(() => {
		return () => {
			abortRef.current?.();
			abortRef.current = null;
		};
	}, []);

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
					setItems(d.items);
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

	const cancelGenerate = useCallback(() => {
		abortRef.current?.(true);
		abortRef.current = null;
		setLoading(false);
		setAgentToolLine(null);
		setProgress(null);
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
		const parsed =
			countInput.trim() === '' ? Number.NaN : Number.parseInt(countInput, 10);
		if (
			!Number.isFinite(parsed) ||
			parsed < QUOTE_COUNT_MIN ||
			parsed > QUOTE_COUNT_MAX
		) {
			Toast({
				type: 'warning',
				title: t('englishLearning.classic.countInvalid'),
			});
			return;
		}
		const count = parsed;
		const myGen = ++genIdRef.current;
		abortRef.current?.();
		abortRef.current = null;

		setLoading(true);
		setAgentToolLine(null);
		setProgress({ collected: 0, target: count, round: 0 });
		setItems([]);

		const abort = await streamEnglishClassicQuotes({
			body: { topic: req, count },
			callbacks: {
				onProgress: (p) => {
					if (genIdRef.current !== myGen) return;
					setProgress(p);
				},
				onAgentTool: (ev) => {
					if (genIdRef.current !== myGen) return;
					setAgentToolLine(formatEnglishLearningAgentToolLine(t, ev));
				},
				onChunk: ({ items: delta }) => {
					if (genIdRef.current !== myGen) return;
					if (!delta.length) return;
					setAgentToolLine(null);
					setItems((prev) => [...prev, ...delta]);
				},
				onDone: ({ items: list, requested }) => {
					if (genIdRef.current !== myGen) return;
					abortRef.current = null;
					setLoading(false);
					setAgentToolLine(null);
					setProgress(null);
					setItems(list);
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
					if (genIdRef.current !== myGen) return;
					abortRef.current = null;
					setLoading(false);
					setAgentToolLine(null);
					setProgress(null);
					Toast({ type: 'error', title: msg });
				},
				onUserAbort: () => {
					if (genIdRef.current !== myGen) return;
					abortRef.current = null;
					setLoading(false);
					setAgentToolLine(null);
					setProgress(null);
					Toast({
						type: 'info',
						title: t('englishLearning.classic.aborted'),
					});
				},
				onIncomplete: () => {
					if (genIdRef.current !== myGen) return;
					abortRef.current = null;
					setLoading(false);
					setAgentToolLine(null);
					setProgress(null);
					Toast({
						type: 'warning',
						title: t('englishLearning.classic.streamDisconnected'),
					});
				},
			},
		});
		abortRef.current = abort;
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

	const normalizeCountOnBlur = useCallback(() => {
		if (countInput.trim() === '') {
			setCountInput('10');
			return;
		}
		const n = Number.parseInt(countInput, 10);
		if (!Number.isFinite(n)) {
			setCountInput('10');
			return;
		}
		const clamped = Math.min(QUOTE_COUNT_MAX, Math.max(QUOTE_COUNT_MIN, n));
		setCountInput(String(clamped));
	}, [countInput]);

	return (
		<div className="rounded-none @container min-w-0 px-4 pb-0 pt-7.5">
			<div className="mb-4 flex items-start gap-3">
				<div className="bg-linear-to-r from-violet-500 to-indigo-600 @min-[26rem]:size-11 flex size-10 shrink-0 items-center justify-center rounded-md">
					<BookMarked className="text-textcolor size-6" aria-hidden />
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
				onChange={(e) => setTopic(e.target.value)}
				placeholder={t('englishLearning.classic.topicPlaceholder')}
				className="h-9 w-full border-theme/10 bg-theme/5 focus-visible:border-theme/10 focus-visible:ring-0 mt-0.5 mb-4"
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
						value={countInput}
						onChange={(e) => setCountInput(sanitizeCountDigits(e.target.value))}
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
					<div className="mt-2 mb-5.5 flex flex-wrap gap-2 justify-between">
						{COUNT_PRESETS.map((n: (typeof COUNT_PRESETS)[number]) => (
							<Button
								key={n}
								size="sm"
								variant="outline"
								disabled={loading}
								onClick={() => setCountInput(String(n))}
								className={cn(
									'flex-1 rounded-md border bg-theme/5 px-2 py-1 text-xs font-medium transition-colors',
									countInput === String(n)
										? 'border-violet-500/35 bg-violet-500/10 text-textcolor'
										: 'border-theme/12 text-textcolor/65 hover:border-theme/20 hover:bg-theme-secondary/60',
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
							'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-textcolor',
							loading
								? 'border-red-500/20 bg-red-500/20 text-textcolor/80 hover:bg-red-500/25'
								: 'bg-linear-to-r from-violet-600 to-indigo-600',
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
						size="sm"
						onClick={() => setHistoryDrawerOpen(true)}
						className="text-textcolor bg-linear-to-r from-indigo-500 to-indigo-600 h-9 shrink-0 gap-1.5 whitespace-nowrap rounded-md px-2.5 sm:px-3"
						title={t('englishLearning.classic.historyTitle')}
					>
						<span className="max-[340px]:sr-only">
							{t('englishLearning.classic.historyOpenDrawer')}
						</span>
					</Button>
				</div>
				{loading && progress ? (
					<div className="space-y-2 rounded-md bg-theme-secondary/40 px-3 py-2.5">
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
				<div>
					<div className="text-textcolor/45 mb-1.5 mt-5 text-sm font-medium">
						{t('englishLearning.classic.listHeading')}
					</div>
					<div className="grid grid-cols-1 gap-4 @min-[26rem]:grid-cols-2">
						{items.map((item, i) => {
							const key = `${i}-${item.english.slice(0, 48)}`;
							const playing = playingKey === key;
							return (
								<div
									key={key}
									className="bg-theme/5 border border-theme/10 flex flex-col gap-1.5 rounded-md px-3 py-2.5 @min-[26rem]:p-3"
								>
									<div className="flex items-start justify-between gap-2">
										<div className="text-textcolor min-w-0 flex-1 text-base font-medium leading-snug @min-[26rem]:text-lg">
											{item.english}
										</div>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => void toggleQuoteAudio(item.english, key)}
											className={cn(
												'w-7 h-7 shrink-0 rounded-md border p-2 transition-colors @min-[26rem]:border-theme/15 @min-[26rem]:p-1.5',
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
				</div>
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
		</div>
	);
}

export const ClassicQuotesSection = ClassicQuotesSectionInner;
