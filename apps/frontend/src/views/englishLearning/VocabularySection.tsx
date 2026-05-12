/**
 * 按主题拉取结构化单词资料（IPA / 释义 / 例句），逐词朗读。
 */
import { Button, Input, Spinner, Toast } from '@ui/index';
import {
	BookText,
	CircleChevronDown,
	CircleChevronRight,
	Square,
	Volume2,
} from 'lucide-react';
import {
	type UIEventHandler,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import {
	COUNT_PRESETS,
	SCROLL_LOAD_THRESHOLD_PX,
	VOCAB_COUNT_MAX,
	VOCAB_COUNT_MIN,
	VOCAB_HISTORY_PAGE_SIZE,
} from '@/constant';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type {
	EnglishVocabularyHistoryEntry,
	EnglishVocabularyItem,
} from '@/service';
import {
	getEnglishVocabularyHistoryDetail,
	listEnglishVocabularyHistory,
} from '@/service';
import { displayIpaWrapped, sanitizeCountDigits } from '@/utils';
import { streamEnglishVocabularyPack } from '@/utils/englishLearningPackSse';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { formatEnglishLearningAgentToolLine } from './agentToolStatusText';
import { VocabularyHistoryDrawer } from './VocabularyHistoryDrawer';

export type VocabProgressState = {
	collected: number;
	target: number;
	round: number;
};

function VocabularyPackSectionInner() {
	const { t } = useI18n();

	const [topic, setTopic] = useState('');
	const [countInput, setCountInput] = useState('');
	const [loading, setLoading] = useState(false);
	/** Agent 检索阶段工具状态（DeepSeek 开始出词后清空） */
	const [agentToolLine, setAgentToolLine] = useState<string | null>(null);
	const [progress, setProgress] = useState<VocabProgressState | null>(null);
	const [items, setItems] = useState<EnglishVocabularyItem[]>([]);
	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
	const [historyEntries, setHistoryEntries] = useState<
		EnglishVocabularyHistoryEntry[]
	>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
	const [loadingHistoryDetailId, setLoadingHistoryDetailId] = useState<
		string | null
	>(null);
	const [loadedStreamId, setLoadedStreamId] = useState<string | null>(null);
	/** 单词列表是否展开（默认展开） */
	const [listExpanded, setListExpanded] = useState(true);

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
		async (streamId: string) => {
			setLoadingHistoryDetailId(streamId);
			try {
				const res = await getEnglishVocabularyHistoryDetail(streamId);
				const d = res.data;
				if (d?.items?.length) {
					setItems(d.items);
					setListExpanded(true);
					setLoadedStreamId(streamId);
					setHistoryDrawerOpen(false);
					Toast({
						type: 'success',
						title: t('englishLearning.vocab.historyLoaded'),
					});
				} else {
					Toast({
						type: 'info',
						title: t('englishLearning.vocab.empty'),
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

		const myGen = ++genIdRef.current;
		abortRef.current?.();
		abortRef.current = null;

		setLoading(true);
		setAgentToolLine(null);
		setProgress({ collected: 0, target: effectiveTarget, round: 0 });
		setItems([]);
		setListExpanded(true);

		const abort = await streamEnglishVocabularyPack({
			body,
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
							title: t('englishLearning.vocab.empty'),
						});
					} else if (list.length < requested) {
						Toast({
							type: 'info',
							title: t('englishLearning.vocab.partialResult', {
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
						title: t('englishLearning.vocab.aborted'),
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
						title: t('englishLearning.vocab.streamDisconnected'),
					});
				},
			},
		});
		abortRef.current = abort;
	}, [topic, countInput, t, fetchHistoryFirstPage]);

	const toggleWordAudio = useCallback(
		async (word: string, key: string) => {
			if (playingKey === key) {
				stopAllEnglishPlayback();
				setPlayingKey(null);
				return;
			}
			stopAllEnglishPlayback();
			setPlayingKey(key);
			try {
				await playEnglishPreferred(word);
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
			return;
		}
		const n = Number.parseInt(countInput, 10);
		if (!Number.isFinite(n)) {
			setCountInput('');
			return;
		}
		const clamped = Math.min(VOCAB_COUNT_MAX, Math.max(VOCAB_COUNT_MIN, n));
		setCountInput(String(clamped));
	}, [countInput]);

	return (
		<div className="rounded-none p-4 pb-0 @container min-w-0">
			<div className="mb-4 flex items-start gap-3">
				<div className="bg-linear-to-r from-teal-500 to-cyan-600 @min-[26rem]:size-10 flex size-10 shrink-0 items-center justify-center rounded-md">
					<BookText
						className="text-white @min-[26rem]:size-6 size-6"
						aria-hidden
					/>
				</div>
				<div className="min-w-0 flex-1">
					<div className="text-textcolor font-semibold leading-tight">
						{t('englishLearning.vocab.title')}
					</div>
					<div className="text-textcolor/50 mt-1 text-xs leading-snug">
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
				onChange={(e) => setTopic(e.target.value)}
				placeholder={t('englishLearning.vocab.topicPlaceholder')}
				className="h-9 w-full border-theme/10 bg-theme/5 focus-visible:border-theme/10 focus-visible:ring-0 mt-0.5 mb-4"
				disabled={loading}
			/>

			<div className="mb-1 space-y-3">
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
						onChange={(e) => setCountInput(sanitizeCountDigits(e.target.value))}
						onBlur={normalizeCountOnBlur}
						disabled={loading}
						className="mt-0.5 h-9 w-full border-theme/10 bg-theme/5 focus-visible:border-theme/10 focus-visible:ring-0"
					/>
					<div
						id="english-vocab-count-hint"
						className="text-textcolor/40 mt-1.5 text-xs leading-snug"
					>
						{t('englishLearning.vocab.countHint')}
					</div>
					<div className="mt-2 mb-5.5 flex flex-wrap gap-2 justify-between">
						{COUNT_PRESETS.map((n) => (
							<Button
								key={n}
								size="sm"
								variant="outline"
								disabled={loading}
								onClick={() => setCountInput(String(n))}
								className={cn(
									'flex-1 rounded-md border bg-theme/5 px-2 py-1 text-xs font-medium transition-colors',
									countInput === String(n)
										? 'border-teal-500/35 bg-teal-500/10 text-textcolor'
										: 'border-theme/10 text-textcolor/65 hover:border-theme/20 hover:bg-theme-secondary/60',
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
							'hover:bg-linear-to-r hover:from-teal-400 hover:to-cyan-600',
							loading
								? 'border-red-500/20 bg-red-500/20 text-textcolor/80 hover:bg-red-500/25'
								: 'bg-linear-to-r from-teal-500 to-cyan-600',
						)}
					>
						{loading ? (
							<>
								<Spinner className="size-4 shrink-0 text-textcolor" />
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
						className="text-white hover:bg-linear-to-r hover:from-teal-400 hover:to-cyan-600 bg-linear-to-r from-teal-500 to-cyan-600 h-9 shrink-0 gap-1.5 whitespace-nowrap rounded-md px-2.5 sm:px-3"
						title={t('englishLearning.vocab.historyTitle')}
					>
						<span className="max-[340px]:sr-only">
							{t('englishLearning.vocab.historyOpenDrawer')}
						</span>
					</Button>
				</div>
				{loading && progress ? (
					<div className="border border-theme/10 space-y-2 rounded-md bg-theme-secondary/40 px-3 py-2.5">
						{agentToolLine ? (
							<div className="text-teal-600/90 dark:text-teal-400/90 text-xs leading-snug">
								{agentToolLine}
							</div>
						) : null}
						<div className="text-textcolor/70 text-xs leading-snug">
							{t('englishLearning.vocab.progress', {
								collected: progress.collected,
								target: progress.target,
								round: progress.round,
							})}
						</div>
						<div className="bg-theme/10 h-1.5 w-full overflow-hidden rounded-md">
							<div
								className="bg-teal-500/85 h-full rounded-md transition-[width] duration-300 ease-out"
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
					<div className="mt-5 flex min-h-8 items-center justify-between gap-2">
						<div className="text-textcolor/45 text-sm font-medium">
							{t('englishLearning.vocab.listHeading')}
						</div>
						<Button
							type="button"
							variant="link"
							size="sm"
							className="text-textcolor/55 hover:text-textcolor h-8 w-8 shrink-0 p-0! mt-0.5 -mr-2"
							onClick={() => setListExpanded((v) => !v)}
							aria-expanded={listExpanded}
							aria-label={
								listExpanded
									? t('englishLearning.vocab.collapseList')
									: t('englishLearning.vocab.expandList')
							}
							title={
								listExpanded
									? t('englishLearning.vocab.collapseList')
									: t('englishLearning.vocab.expandList')
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
						<div className="mt-1.5 grid grid-cols-1 gap-4 @min-[26rem]:grid-cols-2">
							{items.map((item, i) => {
								const key = `${i}-${item.word}`;
								const playing = playingKey === key;
								return (
									<div
										key={key}
										className="bg-theme/5 border border-theme/10 flex flex-col gap-1.5 rounded-md px-3 py-2.5 @min-[26rem]:p-3"
									>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<div className="truncate text-lg font-semibold text-textcolor @min-[26rem]:text-base">
													{item.word}
												</div>
												<div className="font-mono text-xs leading-snug text-teal-600/90 @min-[26rem]:text-xs dark:text-teal-400/90">
													{displayIpaWrapped(item.ipa)}
												</div>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => void toggleWordAudio(item.word, key)}
												className={cn(
													'w-7 h-7 shrink-0 rounded-md border p-2 transition-colors @min-[26rem]:border-theme/15 @min-[26rem]:p-1.5',
													playing
														? 'border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-400'
														: 'border-theme/10 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600 dark:hover:text-teal-400',
												)}
												aria-label={
													playing
														? t('englishLearning.tts.stop')
														: t('englishLearning.vocab.playWord')
												}
											>
												{playing ? (
													<Square className="size-3.5 fill-current" />
												) : (
													<Volume2 className="size-3.5" />
												)}
											</Button>
										</div>
										<div className="text-textcolor/95 text-sm leading-snug @min-[26rem]:text-sm">
											{item.translationZh}
										</div>
										<div className="text-textcolor/80 text-sm leading-relaxed italic @min-[26rem]:text-xs">
											{item.example}
										</div>
									</div>
								);
							})}
						</div>
					) : null}
				</div>
			) : null}
			<VocabularyHistoryDrawer
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

export const VocabularyPackSection = VocabularyPackSectionInner;
