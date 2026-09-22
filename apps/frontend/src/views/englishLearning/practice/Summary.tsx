/**
 * 练习结算页
 */
import { ScrollArea, Toast } from '@ui/index';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import {
	batchAddEnglishClassicQuoteMistakes,
	batchAddEnglishVocabularyMistakes,
	createEnglishPracticeReport,
	recordEnglishPracticeReviewAttempts,
} from '@/service';
import {
	isPlaybackAvailable,
	playPreferred,
	stopAllPlayback,
} from '@/utils/speech';
import { dispatchEnglishReviewSummaryRefresh } from '../sidebar';
import { PracticeCard } from './components/shell';
import {
	SummaryActions,
	SummaryStatsPanel,
	WrongListItem,
} from './components/summary';
import { practiceRoundListGridClass } from './constants';
import type { SummaryProps } from './types';
import { shufflePracticeItems } from './utils/grading';
import {
	getPracticeAnswerText,
	isPracticeClassicItem,
	isPracticeVocabItem,
} from './utils/item';
import { buildPracticeReportTitle } from './utils/reportTitle';

export function Summary({
	results,
	practicedTotal,
	config,
	continueLoading = false,
	onRetryWrong,
	onContinuePractice,
	onBackToSetup,
}: SummaryProps) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const correctCount = results.filter((r) => r.correct).length;
	const wrongCount = results.length - correctCount;
	const wrongResults = useMemo(
		() => results.filter((r) => !r.correct),
		[results],
	);
	const correctResults = useMemo(
		() => results.filter((r) => r.correct),
		[results],
	);
	const wrongItems = useMemo(
		() => wrongResults.map((r) => r.item),
		[wrongResults],
	);
	const accuracyPct =
		results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
	const hasWrongList = wrongResults.length > 0;
	const hasWordList = wrongResults.length > 0 || correctResults.length > 0;

	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [saveMistakesLoading, setSaveMistakesLoading] = useState(false);

	const reportSaveMode = config.reportSaveMode === 'auto' ? 'auto' : 'manual';
	const [reportSaveState, setReportSaveState] = useState<
		'idle' | 'saving' | 'saved'
	>(() => (reportSaveMode === 'auto' ? 'saving' : 'idle'));
	const reportIdRef = useRef<string | null>(null);
	const reportSavedRef = useRef(false);
	const reportSavingRef = useRef(false);

	const isReviewSession = config.source === 'review';
	const mistakesPath =
		config.contentKind === 'classic'
			? '/english-learning/mistakes?kind=classic'
			: '/english-learning/mistakes?kind=vocab';
	const reviewRecordedRef = useRef<string | null>(null);

	const savePracticeReportOnce = useCallback(async () => {
		if (
			results.length === 0 ||
			reportSavedRef.current ||
			reportSavingRef.current
		) {
			return;
		}
		reportSavingRef.current = true;
		setReportSaveState('saving');
		try {
			if (!reportIdRef.current) {
				reportIdRef.current = crypto.randomUUID();
			}
			const title = buildPracticeReportTitle(config, t);
			await createEnglishPracticeReport({
				reportId: reportIdRef.current,
				contentKind: config.contentKind,
				mode: config.mode,
				source: config.source,
				order: config.order,
				count: config.count,
				sourceTitle: config.sourceTitle,
				title,
				isRetryWrong: Boolean(config.isRetryWrong),
				saveMode: reportSaveMode,
				items: results.map((r) => ({
					itemKey: r.item.key,
					contentKind: r.item.contentKind,
					userInput: r.userInput,
					correct: r.correct,
					answerText: getPracticeAnswerText(r.item),
					translationZh: r.item.translationZh ?? '',
					...(isPracticeVocabItem(r.item) && r.item.ipa?.trim()
						? { ipa: r.item.ipa.trim() }
						: {}),
					...(isPracticeVocabItem(r.item) && r.item.pos?.trim()
						? { pos: r.item.pos.trim() }
						: {}),
				})),
			});
			reportSavedRef.current = true;
			setReportSaveState('saved');
		} catch {
			setReportSaveState('idle');
			Toast({
				type: 'warning',
				title: t('englishLearning.practice.saveReportFailed'),
			});
		} finally {
			reportSavingRef.current = false;
		}
	}, [config, reportSaveMode, results, t]);

	useEffect(() => {
		if (reportSaveMode !== 'auto' || results.length === 0) return;
		void savePracticeReportOnce();
	}, [reportSaveMode, results.length, savePracticeReportOnce]);

	const handleSaveMistakes = useCallback(async () => {
		if (isReviewSession || wrongItems.length === 0) return;
		setSaveMistakesLoading(true);
		try {
			const wrongResults = results.filter((r) => !r.correct);
			const res =
				config.contentKind === 'classic'
					? await batchAddEnglishClassicQuoteMistakes(
							wrongResults.map((r) => {
								if (!isPracticeClassicItem(r.item)) {
									throw new Error('invalid classic practice item');
								}
								return {
									english: r.item.english,
									translationZh: r.item.translationZh,
									source: r.item.source,
									noteZh: r.item.noteZh,
									lastUserInput: r.userInput,
								};
							}),
						)
					: await batchAddEnglishVocabularyMistakes(
							wrongResults.map((r) => {
								if (r.item.contentKind !== 'vocab') {
									throw new Error('invalid vocab practice item');
								}
								return {
									word: r.item.word,
									ipa: r.item.ipa,
									pos: r.item.pos,
									segmentation: r.item.segmentation,
									translationZh: r.item.translationZh,
									example: r.item.example,
									lastUserInput: r.userInput,
								};
							}),
						);
			const added = res.data?.added ?? 0;
			const updated = res.data?.updated ?? 0;
			const skipped = res.data?.skipped ?? 0;
			if (added === 0 && updated === 0 && skipped > 0) {
				Toast({
					type: 'info',
					title: t('englishLearning.practice.saveMistakesAllSkipped'),
				});
			} else {
				Toast({
					type: 'success',
					title: t('englishLearning.practice.saveMistakesSuccessTitle'),
					message: t('englishLearning.practice.saveMistakesSuccess', {
						added,
						updated,
						skipped,
					}),
				});
			}
		} finally {
			setSaveMistakesLoading(false);
		}
	}, [config.contentKind, isReviewSession, results, t, wrongItems.length]);

	useEffect(() => {
		if (!isReviewSession || results.length === 0) return;
		const signature = results
			.map((r) => `${r.item.key}:${r.correct ? 1 : 0}`)
			.join('|');
		if (reviewRecordedRef.current === signature) return;
		reviewRecordedRef.current = signature;

		let cancelled = false;
		void (async () => {
			try {
				await recordEnglishPracticeReviewAttempts(
					results.map((r) => ({
						contentKind: r.item.contentKind,
						itemKey: r.item.key,
						correct: r.correct,
					})),
				);
				if (!cancelled) {
					dispatchEnglishReviewSummaryRefresh();
				}
			} catch {
				if (!cancelled) {
					Toast({
						type: 'warning',
						title: t('englishLearning.practice.reviewRecordFailed'),
					});
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [isReviewSession, results, t]);

	const toggleWordPlay = useCallback(
		async (word: string, key: string) => {
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
				await playPreferred(word, { cloudSingleUtterance: true });
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

	useEffect(() => {
		return () => stopAllPlayback();
	}, []);

	const statLabels = {
		accuracy: t('englishLearning.practice.summaryAccuracy'),
		correct: t('englishLearning.practice.summaryStatCorrect'),
		wrong: t('englishLearning.practice.summaryStatWrong'),
		roundTotal: t('englishLearning.practice.summaryStatTotal'),
		practiced: t('englishLearning.practice.summaryStatPracticed'),
	};

	return (
		<div className="mx-auto flex h-full min-h-0 w-full flex-1 flex-col">
			<PracticeCard className="border-theme/10 flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0 shadow-sm">
				<SummaryStatsPanel
					compact={hasWordList}
					accuracyPct={accuracyPct}
					correctCount={correctCount}
					wrongCount={wrongCount}
					roundTotal={results.length}
					practicedTotal={practicedTotal}
					labels={statLabels}
				/>

				{hasWordList ? (
					<div className="flex min-h-0 flex-1 flex-col">
						<div className="border-theme/10 bg-theme/5 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5">
							<p className="text-textcolor text-xs font-semibold sm:text-sm">
								{t('englishLearning.practice.roundWordListTitle')}
							</p>
							<div className="flex shrink-0 items-center gap-1.5">
								{wrongCount > 0 ? (
									<span className="bg-rose-600/15 text-rose-500/80 rounded-md px-2 pt-0.5 pb-1 mt-0.5 text-xs font-semibold tabular-nums">
										{t('englishLearning.practice.roundWordListWrongCount', {
											count: wrongCount,
										})}
									</span>
								) : null}
								{correctCount > 0 ? (
									<span className="bg-teal-500/15 text-teal-500/85 rounded-sm px-2 pt-0.5 pb-1 text-xs font-semibold tabular-nums dark:text-teal-400">
										{t('englishLearning.practice.roundWordListCorrectCount', {
											count: correctCount,
										})}
									</span>
								) : null}
							</div>
						</div>
						<ScrollArea
							className="min-h-0 flex-1"
							viewportClassName="max-h-full"
						>
							<div className={practiceRoundListGridClass(config.contentKind)}>
								{wrongResults.map((r) => (
									<WrongListItem
										key={r.item.key}
										item={r.item}
										variant="wrong"
										userInput={r.userInput}
										playing={playingKey === r.item.key}
										onTogglePlay={() =>
											void toggleWordPlay(
												getPracticeAnswerText(r.item),
												r.item.key,
											)
										}
										playLabel={
											config.contentKind === 'classic'
												? t('englishLearning.classic.playQuote')
												: t('englishLearning.vocab.playWord')
										}
										stopLabel={t('englishLearning.tts.stop')}
									/>
								))}
								{correctResults.map((r) => (
									<WrongListItem
										key={r.item.key}
										item={r.item}
										variant="correct"
										userInput={r.userInput}
										playing={playingKey === r.item.key}
										onTogglePlay={() =>
											void toggleWordPlay(
												getPracticeAnswerText(r.item),
												r.item.key,
											)
										}
										playLabel={
											config.contentKind === 'classic'
												? t('englishLearning.classic.playQuote')
												: t('englishLearning.vocab.playWord')
										}
										stopLabel={t('englishLearning.tts.stop')}
									/>
								))}
							</div>
						</ScrollArea>
					</div>
				) : null}

				<div className="border-theme/10 mt-auto flex h-16.5 w-full shrink-0 items-center justify-between border-t bg-theme/5 p-2.5">
					<SummaryActions
						hasWrongItems={hasWrongList}
						continueLoading={continueLoading}
						saveMistakesLoading={saveMistakesLoading}
						reportSaveState={results.length === 0 ? 'hidden' : reportSaveState}
						labels={{
							retryWrong: t('englishLearning.practice.retryWrong'),
							practiceAgain: t('englishLearning.practice.practiceAgain'),
							continuePractice: isReviewSession
								? t('englishLearning.practice.continueReview')
								: t('englishLearning.practice.continuePractice'),
							openMistakes:
								config.contentKind === 'classic'
									? t('englishLearning.mistakes.classicNav')
									: t('englishLearning.mistakes.vocabNav'),
							saveMistakes: t('englishLearning.practice.saveMistakes'),
							saveReport: t('englishLearning.practice.saveReport'),
							reportSaved: t('englishLearning.practice.reportSaved'),
							viewReports: t('englishLearning.practice.viewReports'),
						}}
						onRetryWrong={() =>
							onRetryWrong(
								config.order === 'random'
									? shufflePracticeItems(wrongItems)
									: wrongItems,
							)
						}
						onBackToSetup={onBackToSetup}
						onContinuePractice={onContinuePractice}
						mistakesPath={mistakesPath}
						onSaveMistakes={
							isReviewSession ? undefined : () => void handleSaveMistakes()
						}
						onSaveReport={() => void savePracticeReportOnce()}
						onViewReports={() =>
							navigate(
								`/english-learning/practice/reports?kind=${config.contentKind}`,
							)
						}
					/>
				</div>
			</PracticeCard>
		</div>
	);
}
