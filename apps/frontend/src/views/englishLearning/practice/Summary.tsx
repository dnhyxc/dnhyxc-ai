/**
 * 练习结算页（支持多轮：新→旧，轮内错→对）
 */
import { Toast } from '@ui/index';
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
	Actions,
	Board,
	BoardMeta,
	type BoardRound,
} from '../components/result';
import { dispatchEnglishReviewSummaryRefresh } from '../sidebar';
import type { PracticeAttemptResult, SummaryProps } from './types';
import { shufflePracticeItems } from './utils/grading';
import { getPracticeAnswerText, isPracticeClassicItem } from './utils/item';
import {
	buildPracticeReportTitle,
	practiceModeShortLabel,
	practiceOrderShortLabel,
} from './utils/reportTitle';
import { serializeSessionRounds } from './utils/serializeRounds';

export function Summary({
	rounds,
	practicedTotal,
	config,
	sessionReportId,
	onSessionReportId,
	continueLoading = false,
	onRetryWrong,
	onContinuePractice,
	onBackToSetup,
}: SummaryProps) {
	const { t } = useI18n();
	const navigate = useNavigate();

	const displayRounds = useMemo(
		() => [...rounds].sort((a, b) => b.roundIndex - a.roundIndex),
		[rounds],
	);
	const latestResults = displayRounds[0]?.results ?? [];
	const allResults = useMemo(() => rounds.flatMap((r) => r.results), [rounds]);

	const correctCount = latestResults.filter((r) => r.correct).length;
	const wrongCount = latestResults.length - correctCount;
	const accuracyPct =
		latestResults.length > 0
			? Math.round((correctCount / latestResults.length) * 100)
			: 0;
	const overallAccuracyPct =
		rounds.length > 1 && allResults.length > 0
			? Math.round(
					(allResults.filter((r) => r.correct).length / allResults.length) *
						100,
				)
			: undefined;

	const allWrongResults = useMemo(
		() => allResults.filter((r) => !r.correct),
		[allResults],
	);
	const wrongItems = useMemo(() => {
		const seen = new Set<string>();
		const out: PracticeAttemptResult[] = [];
		for (const r of allWrongResults) {
			if (seen.has(r.item.key)) continue;
			seen.add(r.item.key);
			out.push(r);
		}
		return out;
	}, [allWrongResults]);

	const hasWrongList = wrongItems.length > 0;

	const boardRounds: BoardRound[] = useMemo(
		() =>
			displayRounds.map((round) => ({
				roundIndex: round.roundIndex,
				entries: round.results.map((r) => ({
					key: r.item.key,
					item: r.item,
					correct: r.correct,
					userInput: r.userInput,
					playText: getPracticeAnswerText(r.item),
				})),
			})),
		[displayRounds],
	);

	const [saveMistakesLoading, setSaveMistakesLoading] = useState(false);
	const reportSaveMode = config.reportSaveMode === 'auto' ? 'auto' : 'manual';
	const [reportSaveState, setReportSaveState] = useState<
		'idle' | 'saving' | 'saved'
	>(() => (reportSaveMode === 'auto' ? 'saving' : 'idle'));
	const reportSavingRef = useRef(false);
	const lastSavedSigRef = useRef('');
	/** 轮次数或就地改对都会变，用于触发自动/手动保存态 */
	const roundsSaveSig = useMemo(
		() =>
			rounds
				.map(
					(r) =>
						`${r.roundIndex}:${r.results.map((x) => (x.correct ? '1' : '0')).join('')}`,
				)
				.join('|'),
		[rounds],
	);

	const isReviewSession = config.source === 'review';
	const mistakesPath =
		config.contentKind === 'classic'
			? '/english-learning/mistakes?kind=classic'
			: '/english-learning/mistakes?kind=vocab';
	const reviewRecordedRef = useRef<string | null>(null);

	useEffect(() => {
		if (roundsSaveSig !== lastSavedSigRef.current) {
			setReportSaveState(reportSaveMode === 'auto' ? 'saving' : 'idle');
		}
	}, [reportSaveMode, roundsSaveSig]);

	const savePracticeReportOnce = useCallback(async () => {
		if (allResults.length === 0 || reportSavingRef.current) return;
		reportSavingRef.current = true;
		setReportSaveState('saving');
		const savingSig = roundsSaveSig;
		try {
			const reportId = sessionReportId ?? crypto.randomUUID();
			if (!sessionReportId) onSessionReportId(reportId);
			const title = buildPracticeReportTitle(config, t);
			const { rounds: reportRounds, items } = serializeSessionRounds(rounds);
			await createEnglishPracticeReport({
				reportId,
				contentKind: config.contentKind,
				mode: config.mode,
				source: config.source,
				order: config.order,
				count: config.count,
				sourceTitle: config.sourceTitle,
				title,
				isRetryWrong: Boolean(config.isRetryWrong),
				saveMode: reportSaveMode,
				items,
				rounds: reportRounds,
				sourceMeta: {
					...(config.libraryId ? { libraryId: config.libraryId } : {}),
					...(config.streamId ? { streamId: config.streamId } : {}),
					...(config.poolTotal != null && config.poolTotal > 0
						? { poolTotal: config.poolTotal }
						: {}),
				},
			});
			lastSavedSigRef.current = savingSig;
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
	}, [
		allResults.length,
		config,
		onSessionReportId,
		reportSaveMode,
		rounds,
		roundsSaveSig,
		sessionReportId,
		t,
	]);

	useEffect(() => {
		if (reportSaveMode !== 'auto' || allResults.length === 0) return;
		if (roundsSaveSig === lastSavedSigRef.current) return;
		void savePracticeReportOnce();
	}, [
		allResults.length,
		reportSaveMode,
		roundsSaveSig,
		savePracticeReportOnce,
	]);

	const handleSaveMistakes = useCallback(async () => {
		if (isReviewSession || wrongItems.length === 0) return;
		setSaveMistakesLoading(true);
		try {
			const res =
				config.contentKind === 'classic'
					? await batchAddEnglishClassicQuoteMistakes(
							wrongItems.map((r) => {
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
							wrongItems.map((r) => {
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
							{ source: 'practice' },
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
	}, [config.contentKind, isReviewSession, t, wrongItems]);

	useEffect(() => {
		if (!isReviewSession || allResults.length === 0) return;
		const signature = allResults
			.map((r) => `${r.item.key}:${r.correct ? 1 : 0}`)
			.join('|');
		if (reviewRecordedRef.current === signature) return;
		reviewRecordedRef.current = signature;

		let cancelled = false;
		void (async () => {
			try {
				await recordEnglishPracticeReviewAttempts(
					allResults.map((r) => ({
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
	}, [allResults, isReviewSession, t]);

	return (
		<div className="mx-auto flex h-full min-h-0 w-full flex-1 flex-col">
			<Board
				contentKind={config.contentKind}
				accuracyPct={accuracyPct}
				overallAccuracyPct={overallAccuracyPct}
				correctCount={correctCount}
				wrongCount={wrongCount}
				roundTotal={latestResults.length}
				practicedTotal={practicedTotal}
				poolTotal={config.poolTotal}
				meta={
					<BoardMeta
						parts={[
							practiceModeShortLabel(config.mode, t),
							practiceOrderShortLabel(config.order, t),
						]}
					/>
				}
				rounds={boardRounds}
				footer={
					<Actions
						hasWrongItems={hasWrongList}
						continueLoading={continueLoading}
						saveMistakesLoading={saveMistakesLoading}
						mistakesPath={mistakesPath}
						reportSaveState={
							allResults.length === 0 ? 'hidden' : reportSaveState
						}
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
						onRetryWrong={() => {
							const items = wrongItems.map((r) => r.item);
							onRetryWrong(
								config.order === 'random' ? shufflePracticeItems(items) : items,
							);
						}}
						onBackToSetup={onBackToSetup}
						onContinuePractice={onContinuePractice}
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
				}
			/>
		</div>
	);
}
