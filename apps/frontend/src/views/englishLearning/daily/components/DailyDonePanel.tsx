/**
 * 今日记词完成页 — 布局对齐练习结算（Board + Actions）
 */
import { Button, Toast } from '@ui/index';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	batchAddEnglishVocabularyMistakes,
	createEnglishPracticeReport,
} from '@/service';
import {
	Actions,
	Board,
	BoardMeta,
	type BoardRound,
} from '../../components/result';
import { Head } from '../../components/shell';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../../practice/constants';
import type { PracticeReportSaveMode } from '../../practice/types';
import {
	getPracticeAnswerText,
	toPracticeVocabItem,
} from '../../practice/utils/item';
import type {
	DailyMemorizeMode,
	DailySessionRound,
	DailySessionSummary,
	DailyVocabCard,
} from '../types';
import { ShortcutsMenu } from './ShortcutsMenu';

type DailyDonePanelProps = {
	mode: DailyMemorizeMode;
	summary: DailySessionSummary | null;
	/** 本会话已完成轮次；继续练习追加，重练错题就地改对不追加 */
	rounds?: DailySessionRound[];
	reportSaveMode?: PracticeReportSaveMode;
	/** 本场是否由「重练错题」进入（结算展示时已清掉） */
	isRetryWrong?: boolean;
	continueLoading?: boolean;
	onBackHome: () => void;
	onContinuePractice: () => void;
	onRetryWrong: () => void;
	onBackToSetup: () => void;
};

function toItem(card: DailyVocabCard) {
	return toPracticeVocabItem(card.word, {
		ipa: card.ipa,
		pos: card.pos,
		segmentation: card.segmentation,
		translationZh: card.translationZh,
		example: card.example,
		favoriteId: card.favoriteId ?? null,
	});
}

function dailyModeLabel(mode: DailyMemorizeMode, t: (key: string) => string) {
	if (mode === 'dictation') return t('englishLearning.daily.modeDictation');
	if (mode === 'spelling') return t('englishLearning.daily.modeSpelling');
	return t('englishLearning.daily.modeRecognition');
}

function buildDailyReportTitle(
	mode: DailyMemorizeMode,
	isRetryWrong: boolean,
	t: (key: string) => string,
): string {
	const kind = t('englishLearning.practice.reportKindVocab');
	const modeLabel = dailyModeLabel(mode, t);
	const source = t('route.englishLearning.daily.title');
	const base = `${kind}${modeLabel} · ${source}`;
	if (isRetryWrong) {
		return `${base} · ${t('englishLearning.practice.reportRetrySuffix')}`;
	}
	return base;
}

function cardsToReportItems(
	wrongCards: DailyVocabCard[],
	correctCards: DailyVocabCard[],
) {
	const toReportItem = (card: DailyVocabCard, correct: boolean) => {
		const item = toItem(card);
		return {
			itemKey: item.key,
			contentKind: 'vocab' as const,
			userInput: '',
			correct,
			answerText: getPracticeAnswerText(item),
			translationZh: item.translationZh ?? '',
			...(item.ipa?.trim() ? { ipa: item.ipa.trim() } : {}),
			...(item.pos?.trim() ? { pos: item.pos.trim() } : {}),
		};
	};
	return [
		...wrongCards.map((c) => toReportItem(c, false)),
		...correctCards.map((c) => toReportItem(c, true)),
	];
}

export function DailyDonePanel({
	mode,
	summary,
	rounds = [],
	reportSaveMode = 'manual',
	isRetryWrong = false,
	continueLoading = false,
	onBackHome,
	onContinuePractice,
	onRetryWrong,
	onBackToSetup,
}: DailyDonePanelProps) {
	const { t } = useI18n();
	const navigate = useNavigate();

	const displayRounds = useMemo(
		() => [...rounds].sort((a, b) => b.roundIndex - a.roundIndex),
		[rounds],
	);
	const latestRound = displayRounds[0];
	const latestWrong = latestRound?.wrongCards ?? summary?.wrongCards ?? [];
	const latestCorrect =
		latestRound?.correctCards ?? summary?.correctCards ?? [];
	const latestTotal = latestWrong.length + latestCorrect.length;
	const hasSummary = summary != null && summary.total > 0 && latestTotal > 0;

	const accuracyPct =
		latestTotal > 0
			? Math.round((latestCorrect.length / latestTotal) * 100)
			: 0;

	const allAttemptCount = useMemo(
		() =>
			rounds.reduce(
				(n, r) => n + r.wrongCards.length + r.correctCards.length,
				0,
			),
		[rounds],
	);
	const allCorrectCount = useMemo(
		() => rounds.reduce((n, r) => n + r.correctCards.length, 0),
		[rounds],
	);
	const overallAccuracyPct =
		rounds.length > 1 && allAttemptCount > 0
			? Math.round((allCorrectCount / allAttemptCount) * 100)
			: undefined;

	const boardRounds: BoardRound[] = useMemo(() => {
		const multi = displayRounds.length > 1;
		const out: BoardRound[] = [];
		for (const round of displayRounds) {
			const entries: BoardRound['entries'] = [
				...round.wrongCards.map((card) => {
					const item = toItem(card);
					return {
						key: item.key,
						item,
						correct: false as const,
						playText: getPracticeAnswerText(item),
					};
				}),
				...round.correctCards.map((card) => {
					const item = toItem(card);
					return {
						key: item.key,
						item,
						correct: true as const,
						playText: getPracticeAnswerText(item),
					};
				}),
			];
			if (entries.length === 0) continue;
			out.push(multi ? { roundIndex: round.roundIndex, entries } : { entries });
		}
		return out;
	}, [displayRounds]);

	const [saveMistakesLoading, setSaveMistakesLoading] = useState(false);
	const saveMode = reportSaveMode === 'auto' ? 'auto' : 'manual';
	const [reportSaveState, setReportSaveState] = useState<
		'idle' | 'saving' | 'saved'
	>(() => (saveMode === 'auto' ? 'saving' : 'idle'));
	const reportSavingRef = useRef(false);
	const reportIdRef = useRef<string | null>(null);
	const lastSavedSigRef = useRef('');
	const roundsSaveSig = useMemo(
		() =>
			rounds
				.map(
					(r) =>
						`${r.roundIndex}:${r.wrongCards.length}/${r.correctCards.length}`,
				)
				.join('|'),
		[rounds],
	);

	useEffect(() => {
		if (roundsSaveSig !== lastSavedSigRef.current) {
			setReportSaveState(saveMode === 'auto' ? 'saving' : 'idle');
		}
	}, [roundsSaveSig, saveMode]);

	const handleSaveMistakes = useCallback(async () => {
		const wrongCards = rounds.flatMap((r) => r.wrongCards);
		const unique = new Map<string, DailyVocabCard>();
		for (const card of wrongCards) {
			if (!unique.has(card.key)) unique.set(card.key, card);
		}
		if (unique.size === 0) return;
		setSaveMistakesLoading(true);
		try {
			const res = await batchAddEnglishVocabularyMistakes(
				[...unique.values()].map((card) => ({
					word: card.word,
					ipa: card.ipa,
					pos: card.pos,
					segmentation: card.segmentation,
					translationZh: card.translationZh,
					example: card.example,
					lastUserInput: '',
				})),
				{ source: 'dailyMemorize' },
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
	}, [rounds, t]);

	const handleSaveReport = useCallback(async () => {
		if (!summary || summary.total === 0 || reportSavingRef.current) return;
		if (rounds.length === 0) return;
		reportSavingRef.current = true;
		setReportSaveState('saving');
		const savingSig = roundsSaveSig;
		try {
			const reportId = reportIdRef.current ?? crypto.randomUUID();
			reportIdRef.current = reportId;
			const reportRounds = [...rounds]
				.sort((a, b) => a.roundIndex - b.roundIndex)
				.map((round) => ({
					roundIndex: round.roundIndex,
					completedAt: round.completedAt,
					items: cardsToReportItems(round.wrongCards, round.correctCards),
				}));
			const items = reportRounds.flatMap((r) => r.items);
			const sourceTitle = t('route.englishLearning.daily.title');
			await createEnglishPracticeReport({
				reportId,
				contentKind: 'vocab',
				mode,
				source: 'dailyMemorize',
				order: 'random',
				count: summary.total,
				sourceTitle,
				title: buildDailyReportTitle(mode, isRetryWrong, t),
				isRetryWrong,
				saveMode,
				items,
				rounds: reportRounds,
				sourceMeta: {
					...(summary.poolTotal != null && summary.poolTotal > 0
						? { poolTotal: summary.poolTotal }
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
	}, [isRetryWrong, mode, rounds, roundsSaveSig, saveMode, summary, t]);

	useEffect(() => {
		if (saveMode !== 'auto' || !summary || summary.total === 0) return;
		if (rounds.length === 0) return;
		if (roundsSaveSig === lastSavedSigRef.current) return;
		void handleSaveReport();
	}, [handleSaveReport, rounds.length, roundsSaveSig, saveMode, summary]);

	const emptyFooter = (
		<>
			<Button
				type="button"
				className={cn(
					'h-10 min-w-0 flex-1 gap-2',
					PRACTICE_PRIMARY_ACTION_BTN_CLASS,
				)}
				onClick={onBackHome}
			>
				{t('englishLearning.daily.backHome')}
			</Button>
			<Button
				type="button"
				className={cn(
					'h-10 min-w-0 flex-1 gap-2',
					PRACTICE_PRIMARY_ACTION_BTN_CLASS,
				)}
				onClick={() => navigate('/english-learning/daily/records')}
			>
				{t('englishLearning.daily.memorizedLink')}
			</Button>
		</>
	);

	const hasWrongAcrossRounds = rounds.some((r) => r.wrongCards.length > 0);

	const actionsFooter = hasSummary ? (
		<Actions
			hasWrongItems={hasWrongAcrossRounds}
			continueLoading={continueLoading}
			saveMistakesLoading={saveMistakesLoading}
			mistakesPath="/english-learning/mistakes?kind=vocab"
			reportSaveState={reportSaveState}
			labels={{
				retryWrong: t('englishLearning.practice.retryWrong'),
				practiceAgain: t('englishLearning.practice.practiceAgain'),
				continuePractice: t('englishLearning.practice.continuePractice'),
				openMistakes: t('englishLearning.mistakes.vocabNav'),
				saveMistakes: t('englishLearning.practice.saveMistakes'),
				saveReport: t('englishLearning.practice.saveReport'),
				reportSaved: t('englishLearning.practice.reportSaved'),
				viewReports: t('englishLearning.practice.viewReports'),
			}}
			onRetryWrong={onRetryWrong}
			onBackToSetup={onBackToSetup}
			onContinuePractice={onContinuePractice}
			onSaveMistakes={() => void handleSaveMistakes()}
			onSaveReport={() => void handleSaveReport()}
			onViewReports={() =>
				navigate('/english-learning/practice/reports?kind=vocab')
			}
		/>
	) : null;

	return (
		<div className="flex h-full min-h-0 w-full flex-1 flex-col">
			<Head className="pl-4 pr-2" trailing={<ShortcutsMenu mode={mode} />}>
				<span className="min-w-0 truncate">
					{t('englishLearning.practice.summaryTitle')}
				</span>
			</Head>
			<div className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden p-4">
				{hasSummary && summary ? (
					<Board
						contentKind="vocab"
						accuracyPct={accuracyPct}
						overallAccuracyPct={overallAccuracyPct}
						correctCount={latestCorrect.length}
						wrongCount={latestWrong.length}
						roundTotal={latestTotal}
						practicedTotal={summary.practicedTotal}
						poolTotal={summary.poolTotal}
						meta={<BoardMeta parts={[dailyModeLabel(mode, t)]} />}
						rounds={boardRounds}
						cloudSingleUtterance={false}
						emptyBody={
							<>
								<p className="text-textcolor text-lg font-semibold">
									{t('englishLearning.daily.doneAllCorrect')}
								</p>
								<p className="text-textcolor/55 max-w-sm text-sm leading-relaxed">
									{t('englishLearning.daily.doneDesc')}
								</p>
							</>
						}
						footer={actionsFooter}
					/>
				) : (
					<>
						<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
							<p className="text-textcolor text-lg font-semibold">
								{t('englishLearning.daily.doneTitle')}
							</p>
							<p className="text-textcolor/55 max-w-sm text-sm leading-relaxed">
								{t('englishLearning.daily.doneDesc')}
							</p>
						</div>
						<div className="mx-auto flex w-full max-w-4xl shrink-0 gap-2">
							{emptyFooter}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
