/**
 * 练习/记词/报告共用结算板：统计条 + 作答明细 + footer 插槽
 */
import { ScrollArea, Toast } from '@ui/index';
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { useI18n } from '@/hooks';
import {
	isPlaybackAvailable,
	playPreferred,
	stopAllPlayback,
} from '@/utils/speech';
import { PracticeCard } from '../../practice/components/shell';
import { practiceRoundListGridClass } from '../../practice/constants';
import type { PracticeContentKind, PracticeItem } from '../../practice/types';
import { Entry } from './Entry';
import { Filter, type FilterKind, toggleFilter } from './Filter';
import { Stats } from './Stats';

export type BoardEntry = {
	key: string;
	item: PracticeItem;
	correct: boolean;
	userInput?: string;
	playText: string;
};

export type BoardRound = {
	/** 有值则展示「第 N 轮」；单场可省略 */
	roundIndex?: number;
	entries: BoardEntry[];
};

export type BoardProps = {
	contentKind: PracticeContentKind;
	accuracyPct: number;
	overallAccuracyPct?: number;
	correctCount: number;
	wrongCount: number;
	roundTotal: number;
	practicedTotal: number;
	poolTotal?: number;
	/** 作答明细标题旁：模式 · 顺序 · 时间等 */
	meta?: ReactNode;
	rounds: BoardRound[];
	/** 无条目时的中间区；有条目时不渲染 */
	emptyBody?: ReactNode;
	footer: ReactNode;
	cloudSingleUtterance?: boolean;
	/** 是否包 PracticeCard，默认 true */
	withCard?: boolean;
	className?: string;
};

export function Board({
	contentKind,
	accuracyPct,
	overallAccuracyPct,
	correctCount,
	wrongCount,
	roundTotal,
	practicedTotal,
	poolTotal,
	meta,
	rounds,
	emptyBody,
	footer,
	cloudSingleUtterance = true,
	withCard = true,
	className,
}: BoardProps) {
	const { t } = useI18n();
	const [listFilter, setListFilter] = useState<FilterKind>('all');
	const [playingKey, setPlayingKey] = useState<string | null>(null);

	const allEntries = useMemo(() => rounds.flatMap((r) => r.entries), [rounds]);
	const attemptWrongCount = useMemo(
		() => allEntries.filter((e) => !e.correct).length,
		[allEntries],
	);
	const attemptCorrectCount = allEntries.length - attemptWrongCount;
	const hasWordList = allEntries.length > 0;

	const playLabel =
		contentKind === 'classic'
			? t('englishLearning.classic.playQuote')
			: t('englishLearning.vocab.playWord');
	const stopLabel = t('englishLearning.tts.stop');

	const statLabels = useMemo(
		() => ({
			accuracy:
				overallAccuracyPct != null
					? t('englishLearning.practice.summaryAccuracyRound')
					: t('englishLearning.practice.summaryAccuracy'),
			...(overallAccuracyPct != null
				? {
						overallAccuracy: t(
							'englishLearning.practice.summaryAccuracyOverall',
						),
					}
				: {}),
			correct: t('englishLearning.practice.summaryStatCorrect'),
			wrong: t('englishLearning.practice.summaryStatWrong'),
			roundTotal: t('englishLearning.practice.summaryStatTotal'),
			practiced: t('englishLearning.practice.summaryStatPracticed'),
		}),
		[overallAccuracyPct, t],
	);

	const onToggleFilter = useCallback((next: 'wrong' | 'correct') => {
		setListFilter((prev) => toggleFilter(prev, next));
	}, []);

	const togglePlay = useCallback(
		async (text: string, key: string) => {
			if (playingKey === key) {
				stopAllPlayback();
				setPlayingKey(null);
				return;
			}
			if (!isPlaybackAvailable()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			stopAllPlayback();
			setPlayingKey(key);
			try {
				await playPreferred(
					text,
					cloudSingleUtterance ? { cloudSingleUtterance: true } : undefined,
				);
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[cloudSingleUtterance, playingKey, t],
	);

	useEffect(() => () => stopAllPlayback(), []);

	const body = (
		<>
			<Stats
				compact={hasWordList}
				accuracyPct={accuracyPct}
				overallAccuracyPct={overallAccuracyPct}
				correctCount={correctCount}
				wrongCount={wrongCount}
				roundTotal={roundTotal}
				practicedTotal={practicedTotal}
				poolTotal={poolTotal}
				labels={statLabels}
			/>

			{hasWordList ? (
				<div className="flex min-h-0 flex-1 flex-col">
					<div className="border-theme/10 bg-theme/5 flex shrink-0 items-center justify-between gap-2 border-b px-2.5 py-1.5">
						<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
							<p className="text-textcolor mr-2 shrink-0 text-sm font-semibold">
								{t('englishLearning.practice.roundWordListTitle')}
							</p>
							{meta}
						</div>
						<Filter
							filter={listFilter}
							wrongCount={attemptWrongCount}
							correctCount={attemptCorrectCount}
							wrongLabel={t(
								'englishLearning.practice.roundWordListWrongCount',
								{ count: attemptWrongCount },
							)}
							correctLabel={t(
								'englishLearning.practice.roundWordListCorrectCount',
								{ count: attemptCorrectCount },
							)}
							onToggle={onToggleFilter}
						/>
					</div>
					<ScrollArea className="min-h-0 flex-1" viewportClassName="max-h-full">
						<div className="flex flex-col gap-4 p-2.5">
							{rounds.map((round, ri) => {
								const wrong =
									listFilter === 'correct'
										? []
										: round.entries.filter((e) => !e.correct);
								const correct =
									listFilter === 'wrong'
										? []
										: round.entries.filter((e) => e.correct);
								if (wrong.length === 0 && correct.length === 0) return null;
								const roundKey = round.roundIndex ?? ri;
								return (
									<div key={roundKey} className="flex flex-col gap-3">
										{round.roundIndex != null ? (
											<p className="text-textcolor/80 text-sm font-semibold">
												{t('englishLearning.practice.sessionRoundLabel', {
													n: round.roundIndex,
												})}
											</p>
										) : null}
										{wrong.length > 0 ? (
											<div className="flex flex-col gap-2">
												<p className="text-rose-500/80 text-sm font-semibold tabular-nums">
													{t(
														'englishLearning.practice.roundWordListWrongCount',
														{ count: wrong.length },
													)}
												</p>
												<div
													className={practiceRoundListGridClass(contentKind)}
												>
													{wrong.map((e) => {
														const playKey = `w-${roundKey}-${e.key}`;
														return (
															<Entry
																key={playKey}
																item={e.item}
																variant="wrong"
																userInput={e.userInput}
																playing={playingKey === playKey}
																onTogglePlay={() =>
																	void togglePlay(e.playText, playKey)
																}
																playLabel={playLabel}
																stopLabel={stopLabel}
															/>
														);
													})}
												</div>
											</div>
										) : null}
										{correct.length > 0 ? (
											<div className="flex flex-col gap-2">
												<p className="text-teal-500/85 text-sm font-semibold tabular-nums dark:text-teal-400">
													{t(
														'englishLearning.practice.roundWordListCorrectCount',
														{ count: correct.length },
													)}
												</p>
												<div
													className={practiceRoundListGridClass(contentKind)}
												>
													{correct.map((e) => {
														const playKey = `c-${roundKey}-${e.key}`;
														return (
															<Entry
																key={playKey}
																item={e.item}
																variant="correct"
																userInput={e.userInput}
																playing={playingKey === playKey}
																onTogglePlay={() =>
																	void togglePlay(e.playText, playKey)
																}
																playLabel={playLabel}
																stopLabel={stopLabel}
															/>
														);
													})}
												</div>
											</div>
										) : null}
									</div>
								);
							})}
						</div>
					</ScrollArea>
				</div>
			) : emptyBody ? (
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
					{emptyBody}
				</div>
			) : null}

			<div className="border-theme/10 mt-auto flex h-16.5 w-full shrink-0 items-center justify-between gap-2 border-t bg-theme/5 p-2.5">
				{footer}
			</div>
		</>
	);

	if (!withCard) return <div className={className}>{body}</div>;

	return (
		<PracticeCard
			className={
				className ??
				'border-theme/10 flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0 shadow-sm'
			}
		>
			{body}
		</PracticeCard>
	);
}

/** 元信息片段：`听写 · 随机 · 时间` */
export function BoardMeta({
	parts,
}: {
	parts: Array<string | null | undefined>;
}) {
	const shown = parts.map((p) => p?.trim()).filter(Boolean) as string[];
	if (shown.length === 0) return null;
	return (
		<>
			{shown.map((part, i) => (
				<span key={`${part}-${i}`} className="contents">
					{i > 0 ? (
						<span className="text-textcolor/35 text-sm" aria-hidden>
							·
						</span>
					) : null}
					<span className="text-textcolor/55 min-w-0 truncate text-sm tabular-nums">
						{part}
					</span>
				</span>
			))}
		</>
	);
}
