/**
 * 按主题拉取英文经典语句（译文、出处、赏析），可朗读原句。
 */
import Confirm from '@design/Confirm';
import { Button, Input, Spinner, Toast } from '@ui/index';
import { BookMarked } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type UIEventHandler,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
	COUNT_PRESETS,
	HISTORY_PAGE_SIZE,
	QUOTE_COUNT_MAX,
	QUOTE_COUNT_MIN,
	SCROLL_LOAD_THRESHOLD_PX,
} from '@/constant';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishClassicQuoteHistoryEntry } from '@/service';
import {
	deleteEnglishClassicQuotesPackHistory,
	listEnglishClassicQuotesHistory,
} from '@/service';
import EnglishPackStore, {
	type EnglishPackUiProgress,
} from '@/store/englishPack';
import { sanitizeCountDigits } from '@/utils';
import { streamEnglishClassicQuotes } from '@/utils/englishLearningPackSse';
import { formatEnglishLearningAgentToolLine } from '../agent/agentToolStatusText';
import { PackStreamLiveLink } from '../pack/PackStreamLiveLink';
import { ClassicQuotesHistoryDrawer } from './ClassicQuotesHistoryDrawer';

export type ClassicQuoteProgressState = EnglishPackUiProgress;

function ClassicQuotesSectionInner() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const location = useLocation();

	const loading = EnglishPackStore.classicLoading;
	const topic = EnglishPackStore.classicTopic;
	const countInput = EnglishPackStore.classicCountInput;

	const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
	const [historyEntries, setHistoryEntries] = useState<
		EnglishClassicQuoteHistoryEntry[]
	>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
	const [loadedStreamId, setLoadedStreamId] = useState<string | null>(null);
	const [historyDeleteTarget, setHistoryDeleteTarget] =
		useState<EnglishClassicQuoteHistoryEntry | null>(null);
	const [historyDeleteConfirmOpen, setHistoryDeleteConfirmOpen] =
		useState(false);
	const [deletingHistoryStreamId, setDeletingHistoryStreamId] = useState<
		string | null
	>(null);

	const historyOffsetRef = useRef(0);
	const historyHasMoreRef = useRef(true);
	const historyFetchingMoreRef = useRef(false);
	const historyDrawerOpenRef = useRef(false);

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
		(streamId: string) => {
			setLoadedStreamId(streamId);
			setHistoryDrawerOpen(false);
			navigate(
				`/english-learning/stream?kind=classic&streamId=${encodeURIComponent(streamId)}`,
			);
		},
		[navigate],
	);

	const requestDeleteHistory = useCallback(
		(entry: EnglishClassicQuoteHistoryEntry) => {
			setHistoryDeleteTarget(entry);
			setHistoryDeleteConfirmOpen(true);
		},
		[],
	);

	const executeDeleteHistory = useCallback(async () => {
		const target = historyDeleteTarget;
		if (!target) {
			setHistoryDeleteConfirmOpen(false);
			return;
		}
		setDeletingHistoryStreamId(target.streamId);
		try {
			if (
				EnglishPackStore.classicActiveStreamId === target.streamId &&
				EnglishPackStore.classicLoading
			) {
				EnglishPackStore.classicCancelByUser();
			}
			await deleteEnglishClassicQuotesPackHistory(target.streamId);
			EnglishPackStore.classicClearSessionIfDeleted(target.streamId);
			setHistoryEntries((prev) =>
				prev.filter((e) => e.streamId !== target.streamId),
			);
			if (loadedStreamId === target.streamId) {
				setLoadedStreamId(null);
			}
			if (
				location.pathname.includes('/english-learning/stream') &&
				new URLSearchParams(location.search).get('streamId') === target.streamId
			) {
				navigate('/english-learning', { replace: true });
			}
			Toast({
				type: 'success',
				title: t('englishLearning.packHistory.deleteSuccess'),
			});
		} catch {
			// 错误由 http 层 Toast
		} finally {
			setDeletingHistoryStreamId(null);
			setHistoryDeleteConfirmOpen(false);
			setHistoryDeleteTarget(null);
		}
	}, [
		historyDeleteTarget,
		loadedStreamId,
		location.pathname,
		location.search,
		navigate,
		t,
	]);

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

		const abort = await streamEnglishClassicQuotes({
			body,
			callbacks: {
				onProgress: (p) => {
					EnglishPackStore.classicNoteStreamId(p.streamId);
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
				onChunk: ({ items: delta, streamId }) => {
					EnglishPackStore.classicNoteStreamId(streamId);
					EnglishPackStore.classicOnChunk(myGen, delta);
				},
				onDone: ({
					items: list,
					requested,
					fromDatabase,
					itemsOmitted,
					itemCount,
					streamId,
				}) => {
					EnglishPackStore.classicNoteStreamId(streamId);
					if (myGen !== EnglishPackStore.classicStreamGenId) return;
					const finalList =
						itemsOmitted &&
						list.length === 0 &&
						EnglishPackStore.classicItems.length > 0
							? EnglishPackStore.classicItems.slice(
									0,
									Number.isFinite(itemCount) ? itemCount : requested,
								)
							: list;
					EnglishPackStore.classicOnDone(myGen, finalList);
					setLoadedStreamId(null);
					if (historyDrawerOpenRef.current) {
						void fetchHistoryFirstPage();
					}
					if (finalList.length === 0) {
						Toast({
							type: 'info',
							title: t('englishLearning.classic.empty'),
						});
					} else if (fromDatabase) {
						Toast({
							type: 'success',
							title: t('englishLearning.classic.fromDatabase', {
								count: String(finalList.length),
							}),
						});
					} else if (finalList.length < requested) {
						Toast({
							type: 'info',
							title: t('englishLearning.classic.partialResult', {
								got: finalList.length,
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
			<Confirm
				open={historyDeleteConfirmOpen}
				onOpenChange={(open) => {
					setHistoryDeleteConfirmOpen(open);
					if (!open) setHistoryDeleteTarget(null);
				}}
				title={t('englishLearning.packHistory.deleteConfirmTitle')}
				description={
					historyDeleteTarget
						? t('englishLearning.packHistory.deleteConfirmDescClassic', {
								topic: historyDeleteTarget.topic || '—',
								count: historyDeleteTarget.quoteCount,
							})
						: '\u00a0'
				}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.packHistory.deleteConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void executeDeleteHistory()}
			/>
			<div className="mb-3.5 flex items-start gap-3">
				<div className="bg-linear-to-r from-violet-500 to-indigo-600 @min-[26rem]:size-11 flex size-10 shrink-0 items-center justify-center rounded-md">
					<BookMarked className="text-white size-6" aria-hidden />
				</div>
				<div className="min-w-0 flex-1 flex flex-col justify-between">
					<div className="text-textcolor leading-tight font-semibold tracking-tight">
						{t('englishLearning.classic.title')}
					</div>
					<div className="h-5 text-textcolor/50 mt-1 text-xs leading-relaxed">
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
				className="h-9 w-full border-theme/5 bg-theme/5 focus-visible:border-theme/10 focus-visible:ring-0 mt-0.5 mb-3.5"
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
						className="mt-0.5 h-9 w-full border-theme/5 bg-theme/5 focus-visible:border-theme/10 focus-visible:ring-0"
					/>
					<div
						id="english-classic-count-hint"
						className="text-textcolor/40 mt-2 mb-0.5 text-xs leading-snug"
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
								onClick={() =>
									EnglishPackStore.setClassicCountInput(
										countInput === String(n) ? '' : String(n),
									)
								}
								className={cn(
									'flex-1 rounded-md border bg-violet-500/15 hover:bg-violet-500/20 px-0 py-1 text-xs font-medium transition-colors',
									countInput === String(n)
										? 'border-violet-500/35 text-violet-500 bg-violet-500/20'
										: 'border-violet-500/10 text-textcolor hover:border-violet-500/20 hover:text-violet-500 hover:bg-violet-500/20',
								)}
							>
								{n}
							</Button>
						))}
					</div>
				</div>
				<div className="flex min-w-0 items-stretch gap-3.5">
					<Button
						size="sm"
						onClick={() => (loading ? cancelGenerate() : void onGenerate())}
						className={cn(
							'h-9 min-w-0 flex-1 rounded-md text-white',
							loading
								? 'bg-linear-to-r from-rose-600/80 to-rose-600/80 hover:bg-linear-to-r hover:from-rose-500/80 hover:to-rose-600/80'
								: 'bg-linear-to-r from-violet-600 to-indigo-600 hover:bg-linear-to-r hover:from-violet-400 hover:to-indigo-600',
						)}
					>
						{loading ? (
							<>
								<Spinner className="size-4 shrink-0 text-white" />
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
						className="flex-1 text-white hover:bg-linear-to-r hover:from-indigo-400 hover:to-indigo-600 bg-linear-to-r from-violet-600 to-indigo-600 h-9 shrink-0 whitespace-nowrap rounded-md"
					>
						<span className="max-[380px]:sr-only">
							{t('englishLearning.classic.historyOpenDrawer')}
						</span>
					</Button>
				</div>
				<PackStreamLiveLink kind="classic" />
			</div>

			<ClassicQuotesHistoryDrawer
				open={historyDrawerOpen}
				onOpenChange={setHistoryDrawerOpen}
				entries={historyEntries}
				loading={historyLoading}
				loadingMore={historyLoadingMore}
				loadedStreamId={loadedStreamId}
				loadingDetailId={null}
				deletingStreamId={deletingHistoryStreamId}
				onViewportScroll={onHistoryViewportScroll}
				onSelectEntry={openHistoryDetail}
				onDeleteEntry={requestDeleteHistory}
				practiceReturnTo="home"
			/>
		</div>
	);
}

export const ClassicQuotesSection = observer(ClassicQuotesSectionInner);
