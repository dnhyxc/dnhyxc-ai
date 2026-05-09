/**
 * 按主题拉取结构化单词资料（IPA / 释义 / 例句），逐词朗读。
 */
import { Button, Toast } from '@ui/index';
import { BookText, History, Loader2, Square, Volume2 } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import englishAgentStore from '@/store/englishAgent';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { streamEnglishVocabularyPack } from '@/utils/englishVocabularySse';

/** 与后端 GenerateVocabularyDto 一致 */
const VOCAB_COUNT_MIN = 3;
const VOCAB_COUNT_MAX = 3000;
const COUNT_PRESETS = [10, 100, 500, 1000, 3000] as const;

function sanitizeCountDigits(raw: string): string {
	return raw.replace(/\D/g, '').slice(0, 4);
}

function formatHistoryLineDate(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

export type VocabProgressState = {
	collected: number;
	target: number;
	round: number;
};

export type VocabularyPackSectionProps = {
	layout?: 'default' | 'sidebar';
};

function VocabularyPackSectionInner({
	layout = 'default',
}: VocabularyPackSectionProps) {
	const { t } = useI18n();
	const levelTier = englishAgentStore.levelTier;

	const [topic, setTopic] = useState('');
	const [countInput, setCountInput] = useState('10');
	const [loading, setLoading] = useState(false);
	const [progress, setProgress] = useState<VocabProgressState | null>(null);
	const [items, setItems] = useState<EnglishVocabularyItem[]>([]);
	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [historyEntries, setHistoryEntries] = useState<
		EnglishVocabularyHistoryEntry[]
	>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [loadingHistoryDetailId, setLoadingHistoryDetailId] = useState<
		string | null
	>(null);
	const [loadedStreamId, setLoadedStreamId] = useState<string | null>(null);

	const abortRef = useRef<((fromUser?: boolean) => void) | null>(null);
	const genIdRef = useRef(0);

	useEffect(() => {
		return () => {
			abortRef.current?.();
			abortRef.current = null;
		};
	}, []);

	const loadHistory = useCallback(async () => {
		setHistoryLoading(true);
		try {
			const res = await listEnglishVocabularyHistory({
				limit: 30,
				offset: 0,
			});
			const list = res.data;
			setHistoryEntries(Array.isArray(list) ? list : []);
		} catch {
			setHistoryEntries([]);
		} finally {
			setHistoryLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadHistory();
	}, [loadHistory]);

	const openHistoryDetail = useCallback(
		async (streamId: string) => {
			setLoadingHistoryDetailId(streamId);
			try {
				const res = await getEnglishVocabularyHistoryDetail(streamId);
				const d = res.data;
				if (d?.items?.length) {
					setItems(d.items);
					setLoadedStreamId(streamId);
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
		const parsed =
			countInput.trim() === '' ? Number.NaN : Number.parseInt(countInput, 10);
		if (
			!Number.isFinite(parsed) ||
			parsed < VOCAB_COUNT_MIN ||
			parsed > VOCAB_COUNT_MAX
		) {
			Toast({
				type: 'warning',
				title: t('englishLearning.vocab.countInvalid'),
			});
			return;
		}
		const count = parsed;
		const myGen = ++genIdRef.current;
		abortRef.current?.();
		abortRef.current = null;

		setLoading(true);
		setProgress({ collected: 0, target: count, round: 0 });
		setItems([]);

		const abort = await streamEnglishVocabularyPack({
			body: { topic: req, count, level: levelTier },
			callbacks: {
				onProgress: (p) => {
					if (genIdRef.current !== myGen) return;
					setProgress(p);
				},
				onChunk: ({ items: delta }) => {
					if (genIdRef.current !== myGen) return;
					if (!delta.length) return;
					setItems((prev) => [...prev, ...delta]);
				},
				onDone: ({ items: list, requested }) => {
					if (genIdRef.current !== myGen) return;
					abortRef.current = null;
					setLoading(false);
					setProgress(null);
					setItems(list);
					setLoadedStreamId(null);
					void loadHistory();
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
					setProgress(null);
					Toast({ type: 'error', title: msg });
				},
				onUserAbort: () => {
					if (genIdRef.current !== myGen) return;
					abortRef.current = null;
					setLoading(false);
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
					setProgress(null);
					Toast({
						type: 'warning',
						title: t('englishLearning.vocab.streamDisconnected'),
					});
				},
			},
		});
		abortRef.current = abort;
	}, [topic, countInput, levelTier, t, loadHistory]);

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
			setCountInput('10');
			return;
		}
		const n = Number.parseInt(countInput, 10);
		if (!Number.isFinite(n)) {
			setCountInput('10');
			return;
		}
		const clamped = Math.min(VOCAB_COUNT_MAX, Math.max(VOCAB_COUNT_MIN, n));
		setCountInput(String(clamped));
	}, [countInput]);

	const cardShell = cn(
		'border-theme/10 bg-theme-background shadow-sm',
		'rounded-2xl border p-4',
		'ring-1 ring-black/3 dark:ring-white/6',
	);

	const countControlId =
		layout === 'sidebar'
			? 'english-vocab-count'
			: 'english-vocab-count-standalone';

	const progressBlock =
		loading && progress ? (
			<div className="border-theme/8 space-y-2 rounded-xl border bg-theme-secondary/40 px-3 py-2.5">
				<p className="text-textcolor/70 text-[11px] leading-snug">
					{t('englishLearning.vocab.progress', {
						collected: progress.collected,
						target: progress.target,
						round: progress.round,
					})}
				</p>
				<div className="bg-theme/10 h-1.5 w-full overflow-hidden rounded-full">
					<div
						className="bg-teal-500/85 h-full rounded-full transition-[width] duration-300 ease-out"
						style={{
							width: `${Math.min(
								100,
								(progress.collected / Math.max(1, progress.target)) * 100,
							)}%`,
						}}
					/>
				</div>
			</div>
		) : null;

	const historySection = (
		<div className="border-theme/10 space-y-2 rounded-xl border bg-theme-secondary/30 px-3 py-2.5">
			<div className="text-textcolor/70 flex items-center justify-between gap-2 text-[11px] font-medium">
				<span className="flex min-w-0 items-center gap-1.5">
					<History className="size-3.5 shrink-0 opacity-80" aria-hidden />
					{t('englishLearning.vocab.historyTitle')}
				</span>
				<button
					type="button"
					disabled={historyLoading}
					onClick={() => void loadHistory()}
					className="text-teal-600/90 hover:text-teal-500 dark:text-teal-400/95 shrink-0 text-[10px] font-medium underline-offset-2 hover:underline disabled:opacity-40"
				>
					{t('englishLearning.vocab.historyRefresh')}
				</button>
			</div>
			{historyLoading ? (
				<p className="text-textcolor/45 text-[11px]">
					{t('englishLearning.vocab.historyLoading')}
				</p>
			) : historyEntries.length === 0 ? (
				<p className="text-textcolor/45 text-[11px] leading-snug">
					{t('englishLearning.vocab.historyEmpty')}
				</p>
			) : (
				<ul className="max-h-44 space-y-1.5 overflow-y-auto overscroll-y-contain pr-0.5">
					{historyEntries.map((h) => {
						const active = loadedStreamId === h.streamId;
						const busy = loadingHistoryDetailId === h.streamId;
						return (
							<li key={h.streamId}>
								<button
									type="button"
									disabled={busy}
									onClick={() => void openHistoryDetail(h.streamId)}
									className={cn(
										'border-theme/10 flex w-full flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
										active
											? 'border-teal-500/35 bg-teal-500/10'
											: 'bg-theme-secondary/40 hover:bg-theme-secondary/60',
									)}
								>
									<span className="text-textcolor line-clamp-2 w-full text-[12px] font-medium leading-snug">
										{h.topic || '—'}
									</span>
									<span className="text-textcolor/45 flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
										<span>
											{t('englishLearning.vocab.historyWords', {
												count: h.wordCount,
											})}
										</span>
										<span className="tabular-nums">
											{formatHistoryLineDate(h.updatedAt)}
										</span>
										{busy ? (
											<Loader2
												className="size-3 shrink-0 animate-spin"
												aria-hidden
											/>
										) : null}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);

	const countBlock = (
		<div className="w-full min-w-0">
			<label
				htmlFor={countControlId}
				className={cn(
					'text-textcolor/45 mb-1.5 block font-medium',
					layout === 'sidebar' ? 'text-[11px]' : 'text-xs',
				)}
			>
				{t('englishLearning.vocab.count')}
			</label>
			<input
				id={countControlId}
				type="text"
				inputMode="numeric"
				autoComplete="off"
				aria-describedby={`${countControlId}-hint`}
				value={countInput}
				onChange={(e) => setCountInput(sanitizeCountDigits(e.target.value))}
				onBlur={normalizeCountOnBlur}
				disabled={loading}
				className="border-theme/12 bg-theme-secondary/40 text-textcolor h-10 w-full rounded-xl border px-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-teal-500/25"
			/>
			<p
				id={`${countControlId}-hint`}
				className="text-textcolor/40 mt-1.5 text-[10px] leading-snug"
			>
				{t('englishLearning.vocab.countHint')}
			</p>
			<div className="mt-2 flex flex-wrap gap-1.5">
				{COUNT_PRESETS.map((n) => (
					<button
						key={n}
						type="button"
						disabled={loading}
						onClick={() => setCountInput(String(n))}
						className={cn(
							'rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
							countInput === String(n)
								? 'border-teal-500/35 bg-teal-500/10 text-textcolor'
								: 'border-theme/12 text-textcolor/65 hover:border-theme/20 hover:bg-theme-secondary/60',
						)}
					>
						{n}
					</button>
				))}
			</div>
		</div>
	);

	if (layout === 'sidebar') {
		return (
			<div className={cardShell}>
				<div className="mb-4 flex items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-theme/12 bg-theme-secondary/60">
						<BookText className="text-textcolor/65 size-[18px]" aria-hidden />
					</div>
					<div className="min-w-0 flex-1">
						<h2 className="text-textcolor text-sm font-semibold leading-tight">
							{t('englishLearning.vocab.title')}
						</h2>
						<p className="text-textcolor/50 mt-1 text-[11px] leading-relaxed">
							{t('englishLearning.vocab.descShort')}
						</p>
					</div>
				</div>

				<label
					htmlFor="english-vocab-topic-sidebar"
					className="text-textcolor/45 mb-1.5 block text-[11px] font-medium"
				>
					{t('englishLearning.vocab.topicFieldLabel')}
				</label>
				<input
					id="english-vocab-topic-sidebar"
					type="text"
					value={topic}
					onChange={(e) => setTopic(e.target.value)}
					placeholder={t('englishLearning.vocab.topicPlaceholder')}
					className="border-theme/12 bg-theme-secondary/40 placeholder:text-textcolor/38 focus-visible:ring-teal-500/25 mb-4 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-shadow focus-visible:ring-2"
					disabled={loading}
				/>

				<div className="mb-1 space-y-3">
					{countBlock}
					<div className="flex gap-2">
						<Button
							type="button"
							size="sm"
							variant="default"
							disabled={loading}
							onClick={() => void onGenerate()}
							className="h-10 min-w-0 flex-1 gap-2 rounded-xl px-3"
						>
							{loading ? (
								<Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
							) : null}
							{t('englishLearning.vocab.generate')}
						</Button>
						{loading ? (
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="border-theme/18 text-textcolor/80 hover:bg-theme/8 h-10 shrink-0 px-3"
								onClick={cancelGenerate}
							>
								{t('englishLearning.vocab.cancel')}
							</Button>
						) : null}
					</div>
					{progressBlock}
					{historySection}
				</div>
				<p className="text-textcolor/40 mb-4 text-[10px]">
					{t('englishLearning.vocab.useLevel', {
						level: t(`englishLearning.level.${levelTier}`),
					})}
				</p>

				{items.length > 0 ? (
					<div>
						<p className="text-textcolor/45 mb-2 text-[11px] font-medium">
							{t('englishLearning.vocab.listHeading')}
						</p>
						<div className="space-y-2">
							{items.map((item, i) => {
								const key = `${i}-${item.word}`;
								const playing = playingKey === key;
								return (
									<div
										key={key}
										className="border-theme/8 flex flex-col gap-1.5 rounded-xl border bg-theme-secondary/35 px-3 py-2.5"
									>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<div className="truncate text-sm font-semibold text-textcolor">
													{item.word}
												</div>
												<div className="font-mono text-[11px] leading-snug text-teal-600/90 dark:text-teal-400/90">
													/{item.ipa}/
												</div>
											</div>
											<button
												type="button"
												onClick={() => void toggleWordAudio(item.word, key)}
												className={cn(
													'shrink-0 rounded-lg border p-2 transition-colors',
													playing
														? 'border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-400'
														: 'border-theme/12 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600 dark:hover:text-teal-400',
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
											</button>
										</div>
										<p className="text-textcolor/85 text-[13px] leading-snug">
											{item.translationZh}
										</p>
										<p className="text-textcolor/55 border-theme/6 border-l-2 pl-2 text-[11px] leading-relaxed italic">
											{item.example}
										</p>
									</div>
								);
							})}
						</div>
					</div>
				) : null}
			</div>
		);
	}

	return (
		<div className={cn(cardShell, 'mx-auto w-full max-w-3xl space-y-4 p-5')}>
			<div>
				<h2 className="text-textcolor text-base font-semibold tracking-tight">
					{t('englishLearning.vocab.title')}
				</h2>
				<p className="text-textcolor/55 mt-1 text-sm leading-relaxed">
					{t('englishLearning.vocab.desc')}
				</p>
			</div>
			<input
				type="text"
				value={topic}
				onChange={(e) => setTopic(e.target.value)}
				placeholder={t('englishLearning.vocab.topicPlaceholder')}
				className="border-theme/15 bg-theme-secondary/50 placeholder:text-textcolor/40 focus-visible:ring-teal-500/30 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus-visible:ring-2"
				disabled={loading}
			/>
			<div className="space-y-3">
				{countBlock}
				<div className="flex flex-wrap items-stretch gap-2">
					<Button
						type="button"
						size="default"
						variant="default"
						disabled={loading}
						onClick={() => void onGenerate()}
						className="h-10 min-w-0 flex-1 gap-2 rounded-xl sm:max-w-xs"
					>
						{loading ? (
							<Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
						) : null}
						{t('englishLearning.vocab.generate')}
					</Button>
					{loading ? (
						<Button
							type="button"
							size="default"
							variant="outline"
							className="border-theme/18 text-textcolor/80 hover:bg-theme/8 h-10 shrink-0 px-4"
							onClick={cancelGenerate}
						>
							{t('englishLearning.vocab.cancel')}
						</Button>
					) : null}
				</div>
				{progressBlock}
				{historySection}
			</div>
			<p className="text-textcolor/45 -mt-1 text-xs">
				{t('englishLearning.vocab.useLevel', {
					level: t(`englishLearning.level.${levelTier}`),
				})}
			</p>

			{items.length > 0 ? (
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{items.map((item, i) => {
						const key = `${i}-${item.word}`;
						const playing = playingKey === key;
						return (
							<div
								key={key}
								className="border-theme/10 flex flex-col gap-1.5 rounded-xl border bg-theme-secondary/40 p-3"
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										<div className="truncate text-base font-semibold text-textcolor">
											{item.word}
										</div>
										<div className="font-mono text-xs text-teal-600/90 dark:text-teal-400/95">
											/{item.ipa}/
										</div>
									</div>
									<button
										type="button"
										onClick={() => void toggleWordAudio(item.word, key)}
										className="border-theme/15 text-textcolor/75 hover:bg-theme/12 shrink-0 rounded-lg border p-1.5 transition-colors hover:text-teal-500"
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
									</button>
								</div>
								<div className="text-sm leading-snug text-textcolor/85">
									{item.translationZh}
								</div>
								<div className="text-xs leading-relaxed text-textcolor/65 italic">
									{item.example}
								</div>
							</div>
						);
					})}
				</div>
			) : null}
		</div>
	);
}

export const VocabularyPackSection = observer(VocabularyPackSectionInner);
