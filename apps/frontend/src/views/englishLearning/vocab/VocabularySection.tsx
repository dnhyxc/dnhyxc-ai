/**
 * 按主题拉取结构化单词资料（IPA / 释义 / 例句），逐词朗读。
 */
import Confirm from '@design/Confirm';
import { Button, Input, Spinner, Toast } from '@ui/index';
import { BookText } from 'lucide-react';
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
	SCROLL_LOAD_THRESHOLD_PX,
	VOCAB_COUNT_MAX,
	VOCAB_COUNT_MIN,
	VOCAB_HISTORY_PAGE_SIZE,
} from '@/constant';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishVocabularyHistoryEntry } from '@/service';
import {
	deleteEnglishVocabularyPackHistory,
	listEnglishVocabularyHistory,
} from '@/service';
import EnglishPackStore, {
	type EnglishPackUiProgress,
} from '@/store/englishPack';
import { sanitizeCountDigits } from '@/utils';
import { streamEnglishVocabularyPack } from '@/utils/englishLearningPackSse';
import { formatEnglishLearningAgentToolLine } from '../agent/agentToolStatusText';
import { PackStreamLiveLink } from '../pack/components/PackStreamLiveLink';
import { VocabularyHistoryDrawer } from './VocabularyHistoryDrawer';

export type VocabProgressState = EnglishPackUiProgress;

function VocabularyPackSectionInner() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const location = useLocation();
	const loading = EnglishPackStore.vocabLoading;

	const topic = EnglishPackStore.vocabTopic;
	const countInput = EnglishPackStore.vocabCountInput;

	const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
	const [historyEntries, setHistoryEntries] = useState<
		EnglishVocabularyHistoryEntry[]
	>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
	const [loadedStreamId, setLoadedStreamId] = useState<string | null>(null);
	const [historyDeleteTarget, setHistoryDeleteTarget] =
		useState<EnglishVocabularyHistoryEntry | null>(null);
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

	/** 抽屉内历史列表：从第一页重拉（与知识库 refreshList 语义对齐） */
	const fetchHistoryFirstPage = useCallback(async () => {
		historyFetchingMoreRef.current = false;
		setHistoryLoading(true);
		setHistoryLoadingMore(false);
		historyOffsetRef.current = 0;
		historyHasMoreRef.current = true;
		setHistoryEntries([]);
		try {
			const res = await listEnglishVocabularyHistory({
				limit: VOCAB_HISTORY_PAGE_SIZE,
				offset: 0,
			});
			const list = Array.isArray(res.data) ? res.data : [];
			setHistoryEntries(list);
			historyOffsetRef.current = list.length;
			historyHasMoreRef.current = list.length >= VOCAB_HISTORY_PAGE_SIZE;
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
			const res = await listEnglishVocabularyHistory({
				limit: VOCAB_HISTORY_PAGE_SIZE,
				offset,
			});
			const chunk = Array.isArray(res.data) ? res.data : [];
			if (chunk.length === 0) {
				historyHasMoreRef.current = false;
				return;
			}
			setHistoryEntries((prev) => [...prev, ...chunk]);
			historyOffsetRef.current += chunk.length;
			historyHasMoreRef.current = chunk.length >= VOCAB_HISTORY_PAGE_SIZE;
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
				`/english-learning/stream?kind=vocab&streamId=${encodeURIComponent(streamId)}`,
			);
		},
		[navigate],
	);

	const requestDeleteHistory = useCallback(
		(entry: EnglishVocabularyHistoryEntry) => {
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
				EnglishPackStore.vocabActiveStreamId === target.streamId &&
				EnglishPackStore.vocabLoading
			) {
				EnglishPackStore.vocabCancelByUser();
			}
			await deleteEnglishVocabularyPackHistory(target.streamId);
			EnglishPackStore.vocabClearSessionIfDeleted(target.streamId);
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
		EnglishPackStore.vocabCancelByUser();
	}, []);

	// 拉取单词表
	const onGenerate = useCallback(async () => {
		const req = topic.trim();
		if (!req) {
			Toast({
				type: 'warning',
				title: t('englishLearning.vocab.topicRequired'),
			});
			return;
		}
		let effectiveTarget = VOCAB_COUNT_MAX;
		const body: { topic: string; count?: number } = { topic: req };
		if (countInput.trim() !== '') {
			const n = Number.parseInt(countInput, 10);
			if (!Number.isFinite(n) || n < VOCAB_COUNT_MIN || n > VOCAB_COUNT_MAX) {
				Toast({
					type: 'warning',
					title: t('englishLearning.vocab.countInvalid'),
				});
				return;
			}
			effectiveTarget = Math.min(VOCAB_COUNT_MAX, Math.max(VOCAB_COUNT_MIN, n));
			body.count = effectiveTarget;
		}

		const myGen = EnglishPackStore.startVocabStream(effectiveTarget);

		const abort = await streamEnglishVocabularyPack({
			body,
			callbacks: {
				onProgress: (p) => {
					EnglishPackStore.vocabNoteStreamId(p.streamId);
					EnglishPackStore.vocabOnProgress(myGen, p);
				},
				onAgentTool: (ev) => {
					if (ev.phase === 'organic' && ev.organic?.length) {
						EnglishPackStore.vocabOnAgentTool(myGen, null, ev.organic);
						return;
					}
					EnglishPackStore.vocabOnAgentTool(
						myGen,
						formatEnglishLearningAgentToolLine(t, ev),
						[],
					);
				},
				onChunk: ({ items: delta, streamId }) => {
					EnglishPackStore.vocabNoteStreamId(streamId);
					EnglishPackStore.vocabOnChunk(myGen, delta);
				},
				onDone: ({
					items: list,
					requested,
					fromDatabase,
					itemsOmitted,
					itemCount,
					streamId,
				}) => {
					EnglishPackStore.vocabNoteStreamId(streamId);
					if (myGen !== EnglishPackStore.vocabStreamGenId) return;
					const finalList =
						itemsOmitted &&
						list.length === 0 &&
						EnglishPackStore.vocabItems.length > 0
							? EnglishPackStore.vocabItems.slice(
									0,
									Number.isFinite(itemCount) ? itemCount : requested,
								)
							: list;
					EnglishPackStore.vocabOnDone(myGen, finalList);
					setLoadedStreamId(null);
					if (historyDrawerOpenRef.current) {
						void fetchHistoryFirstPage();
					}
					if (finalList.length === 0) {
						Toast({
							type: 'info',
							title: t('englishLearning.vocab.empty'),
						});
					} else if (fromDatabase) {
						Toast({
							type: 'success',
							title: t('englishLearning.vocab.fromDatabase', {
								count: String(finalList.length),
							}),
						});
					} else if (finalList.length < requested) {
						Toast({
							type: 'info',
							title: t('englishLearning.vocab.partialResult', {
								got: finalList.length,
								want: requested,
							}),
						});
					}
				},
				onError: (msg) => {
					if (myGen !== EnglishPackStore.vocabStreamGenId) return;
					EnglishPackStore.vocabOnError(myGen);
					Toast({ type: 'error', title: msg });
				},
				onUserAbort: () => {
					if (myGen !== EnglishPackStore.vocabStreamGenId) return;
					EnglishPackStore.vocabOnUserAbort(myGen);
					Toast({
						type: 'info',
						title: t('englishLearning.vocab.aborted'),
					});
				},
				onIncomplete: () => {
					if (myGen !== EnglishPackStore.vocabStreamGenId) return;
					EnglishPackStore.vocabOnIncomplete(myGen);
					Toast({
						type: 'warning',
						title: t('englishLearning.vocab.streamDisconnected'),
					});
				},
			},
		});
		if (myGen === EnglishPackStore.vocabStreamGenId) {
			EnglishPackStore.setVocabAbort(abort);
		}
	}, [topic, countInput, t, fetchHistoryFirstPage]);

	const normalizeCountOnBlur = useCallback(() => {
		if (countInput.trim() === '') {
			return;
		}
		const n = Number.parseInt(countInput, 10);
		if (!Number.isFinite(n)) {
			EnglishPackStore.setVocabCountInput('');
			return;
		}
		const clamped = Math.min(VOCAB_COUNT_MAX, Math.max(VOCAB_COUNT_MIN, n));
		EnglishPackStore.setVocabCountInput(String(clamped));
	}, [countInput]);

	return (
		<div className="rounded-none p-4 pb-0 @container min-w-0 mt-3.5 mb-7.5">
			<Confirm
				open={historyDeleteConfirmOpen}
				onOpenChange={(open) => {
					setHistoryDeleteConfirmOpen(open);
					if (!open) setHistoryDeleteTarget(null);
				}}
				title={t('englishLearning.packHistory.deleteConfirmTitle')}
				description={
					historyDeleteTarget
						? t('englishLearning.packHistory.deleteConfirmDesc', {
								topic: historyDeleteTarget.topic || '—',
								count: historyDeleteTarget.wordCount,
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
				<div className="bg-linear-to-r from-teal-500 to-cyan-600 @min-[26rem]:size-10 flex size-10 shrink-0 items-center justify-center rounded-md">
					<BookText
						className="text-white @min-[26rem]:size-6 size-6"
						aria-hidden
					/>
				</div>
				<div className="min-w-0 flex-1 flex flex-col justify-between">
					<div className="text-textcolor font-semibold leading-tight">
						{t('englishLearning.vocab.title')}
					</div>
					<div className="h-5 text-textcolor/50 mt-1 text-xs leading-relaxed">
						{t('englishLearning.vocab.descShort')}
					</div>
				</div>
			</div>

			<label
				htmlFor="english-vocab-topic"
				className="text-textcolor/45 mb-1.5 block text-sm font-medium"
			>
				{t('englishLearning.vocab.topicFieldLabel')}
			</label>
			<Input
				id="english-vocab-topic"
				value={topic}
				onChange={(e) => EnglishPackStore.setVocabTopic(e.target.value)}
				placeholder={t('englishLearning.vocab.topicPlaceholder')}
				className="h-9 w-full border-theme/5 bg-theme/5 focus-visible:border-theme/10 focus-visible:ring-0 mt-0.5 mb-3.5"
				disabled={loading}
			/>

			<div className="space-y-3">
				<div className="w-full min-w-0">
					<label
						htmlFor="english-vocab-count"
						className="text-textcolor/45 mb-1.5 block text-sm font-medium"
					>
						{t('englishLearning.vocab.count')}
					</label>
					<Input
						id="english-vocab-count"
						autoComplete="off"
						aria-describedby="english-vocab-count-hint"
						placeholder={t('englishLearning.vocab.countPlaceholder')}
						value={countInput}
						onChange={(e) =>
							EnglishPackStore.setVocabCountInput(
								sanitizeCountDigits(e.target.value),
							)
						}
						onBlur={normalizeCountOnBlur}
						disabled={loading}
						className="mt-0.5 h-9 w-full border-theme/5 bg-theme/5 focus-visible:border-theme/10 focus-visible:ring-0"
					/>
					<div
						id="english-vocab-count-hint"
						className="text-textcolor/40 mt-2 mb-0.5 text-xs leading-snug"
					>
						{t('englishLearning.vocab.countHint')}
					</div>
					<div className="mt-2 mb-5 flex flex-wrap gap-2 justify-between">
						{COUNT_PRESETS.map((n) => (
							<Button
								key={n}
								size="sm"
								variant="outline"
								disabled={loading}
								onClick={() =>
									EnglishPackStore.setVocabCountInput(
										countInput === String(n) ? '' : String(n),
									)
								}
								className={cn(
									'flex-1 rounded-md border bg-teal-500/15 hover:bg-teal-500/20 px-0 py-1 text-xs font-medium transition-colors',
									countInput === String(n)
										? 'border-teal-500/35 text-teal-500 bg-teal-500/20'
										: 'border-teal-500/10 text-textcolor hover:border-teal-500/20 hover:text-teal-500 hover:bg-teal-500/20',
								)}
							>
								{n}
							</Button>
						))}
					</div>
				</div>
				<div className="flex min-w-0 items-stretch gap-3.5">
					<Button
						type="button"
						size="sm"
						onClick={() => (loading ? cancelGenerate() : void onGenerate())}
						className={cn(
							'h-9 min-w-0 flex-1 rounded-md text-white',
							loading
								? 'bg-linear-to-r from-rose-600/80 to-rose-600/80 hover:bg-linear-to-r hover:from-rose-500/80 hover:to-rose-600/80'
								: 'bg-linear-to-r from-teal-500 to-cyan-600 hover:bg-linear-to-r hover:from-teal-400 hover:to-cyan-600',
						)}
					>
						{loading ? (
							<>
								<Spinner className="size-4 shrink-0 text-white" />
								<span className="truncate">
									{t('englishLearning.vocab.stop')}
								</span>
							</>
						) : (
							<span className="truncate">
								{t('englishLearning.vocab.generate')}
							</span>
						)}
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={() => setHistoryDrawerOpen(true)}
						className="flex-1 text-white hover:bg-linear-to-r hover:from-teal-400 hover:to-cyan-600 bg-linear-to-r from-teal-500 to-cyan-600 h-9 shrink-0 whitespace-nowrap rounded-md"
					>
						<span className="max-[380px]:sr-only">
							{t('englishLearning.vocab.historyOpenDrawer')}
						</span>
					</Button>
				</div>
				<PackStreamLiveLink kind="vocab" />
			</div>
			<VocabularyHistoryDrawer
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

export const VocabularyPackSection = observer(VocabularyPackSectionInner);
