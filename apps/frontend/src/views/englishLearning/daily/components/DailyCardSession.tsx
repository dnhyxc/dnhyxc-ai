/**
 * 今日记词 — 认读 / 四选一 / 反馈会话
 */
import { Button, Spinner } from '@ui/index';
import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { recordEnglishDailyMemorizeAttempts } from '@/service';
import { DictationPlayButton } from '../../practice/components/prompt/DictationPrompt';
import { SessionPromptPanel } from '../../practice/components/session/SessionPromptPanel';
import { SessionStageHeader } from '../../practice/components/session/SessionStageHeader';
import { PracticeCard } from '../../practice/components/shell';
import {
	PRACTICE_PAGE_CONTENT_CLASS,
	PRACTICE_PRIMARY_ACTION_BTN_CLASS,
	SESSION_CARD_H,
} from '../../practice/constants';
import { dispatchEnglishReviewSummaryRefresh } from '../../sidebar/reviewEvents';
import { QUIZ_OPTION_CLASS } from '../constants';
import { useDailyPlayback } from '../hooks/useDailyPlayback';
import { useDailySessionKeyboard } from '../hooks/useDailySessionKeyboard';
import type { DailyCardStep, DailyQuizOption, DailyVocabCard } from '../types';
import { buildQuizOptions } from '../utils/buildQuizOptions';
import { recordStarterMemorizeResult } from '../utils/localSrs';
import { DailyCorrectFeedback } from './DailyCorrectFeedback';
import { DailyQuizWordBar } from './DailyQuizWordBar';
import { DailyWordHero } from './DailyWordHero';
import { DailyWrongFeedback } from './DailyWrongFeedback';

type PendingRecord = {
	key: string;
	correct: boolean;
	origin: DailyVocabCard['origin'];
};

export type DailyCardSessionProps = {
	cards: DailyVocabCard[];
	onComplete: () => void;
};

export function DailyCardSession({ cards, onComplete }: DailyCardSessionProps) {
	const { t } = useI18n();
	const [index, setIndex] = useState(0);
	const [step, setStep] = useState<DailyCardStep>('study');
	const [quizOptions, setQuizOptions] = useState<DailyQuizOption[]>([]);
	const [lastCorrect, setLastCorrect] = useState(false);
	const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const usedDistractorLabelsRef = useRef(new Set<string>());

	const card = cards[index];

	const { playing, playWord, playLabel } = useDailyPlayback({
		word: card?.word ?? '',
		t,
	});

	useEffect(() => {
		usedDistractorLabelsRef.current.clear();
	}, [cards]);

	useEffect(() => {
		if (!card) return;
		setStep('study');
		setQuizOptions([]);
		void playWord({ force: true });
		// eslint-disable-next-line react-hooks/exhaustive-deps -- 换词时自动播报
	}, [card?.key]);

	const onStartQuiz = useCallback(() => {
		if (!card) return;
		const options = buildQuizOptions(card, cards, {
			usedDistractorLabels: usedDistractorLabelsRef.current,
		});
		for (const opt of options) {
			if (!opt.correct) {
				usedDistractorLabelsRef.current.add(opt.label);
			}
		}
		setQuizOptions(options);
		setStep('quiz');
	}, [card, cards]);

	const onPickOption = useCallback(
		(option: DailyQuizOption) => {
			if (!card || step !== 'quiz') return;
			const correct = option.correct;
			setLastCorrect(correct);
			setPendingRecords((prev) => [
				...prev,
				{ key: card.key, correct, origin: card.origin },
			]);
			setStep('feedback');
		},
		[card, step],
	);

	const onContinue = useCallback(async () => {
		if (index >= cards.length - 1) {
			setSubmitting(true);
			try {
				const serverAttempts = pendingRecords
					.filter((r) => r.origin === 'server')
					.map((r) => ({
						contentKind: 'vocab' as const,
						itemKey: r.key,
						correct: r.correct,
					}));
				for (const r of pendingRecords) {
					if (r.origin === 'starter') {
						recordStarterMemorizeResult(r.key, r.correct);
					}
				}
				if (serverAttempts.length > 0) {
					const practicedKeys = new Set(
						pendingRecords
							.filter((r) => r.origin === 'server')
							.map((r) => r.key),
					);
					const vocabItems = cards
						.filter((c) => practicedKeys.has(c.key))
						.map((c) => ({
							word: c.word,
							ipa: c.ipa,
							pos: c.pos,
							segmentation: c.segmentation,
							translationZh: c.translationZh,
							example: c.example,
						}));
					await recordEnglishDailyMemorizeAttempts({
						source: 'library',
						attempts: serverAttempts,
						vocabItems,
					});
					dispatchEnglishReviewSummaryRefresh();
				}
			} finally {
				setSubmitting(false);
			}
			onComplete();
			return;
		}
		setIndex((i) => i + 1);
	}, [cards, cards.length, index, onComplete, pendingRecords]);

	useDailySessionKeyboard({
		step,
		submitting,
		playWord,
		onStartQuiz,
		onContinue,
	});

	const feedbackText = useMemo(() => {
		return lastCorrect
			? t('englishLearning.daily.feedbackCorrect')
			: t('englishLearning.daily.feedbackWrong');
	}, [lastCorrect, t]);

	const progressBadge = (
		<span className="inline-flex h-6 items-center justify-center rounded-sm bg-teal-500/15 px-2 text-xs font-semibold leading-none tabular-nums text-teal-600 dark:text-teal-400">
			{index + 1}/{cards.length}
		</span>
	);

	if (!card) {
		return (
			<div className="flex flex-1 items-center justify-center py-12">
				<Spinner />
			</div>
		);
	}

	return (
		<div className={cn(PRACTICE_PAGE_CONTENT_CLASS, 'flex flex-col gap-4')}>
			<PracticeCard
				className={cn(
					'border-theme/10 flex flex-col overflow-hidden p-0 shadow-sm',
					SESSION_CARD_H,
				)}
			>
				<SessionStageHeader
					icon={
						<Sparkles className="size-4 text-teal-600 dark:text-teal-400" />
					}
					title={t('englishLearning.daily.sessionTitleLibrary')}
					trailing={progressBadge}
				/>

				<div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
					{step === 'study' ? (
						<div className="flex min-h-0 flex-1 flex-col gap-3">
							<SessionPromptPanel
								fillHeight
								className="bg-theme/5 min-h-0 flex-1 gap-4 border-theme/10"
							>
								<DailyWordHero
									word={card.word}
									ipa={card.ipa}
									pos={card.pos}
									segmentation={card.segmentation}
									translationZh={card.translationZh}
									example={card.example}
								/>
								<div className="flex justify-center">
									<DictationPlayButton
										playing={playing}
										playLabel={playLabel}
										onPlay={() => void playWord()}
										size="medium"
									/>
								</div>
							</SessionPromptPanel>
						</div>
					) : null}

					{step === 'quiz' ? (
						<div className="flex min-h-0 flex-1 flex-col justify-between">
							<SessionPromptPanel className="bg-theme/5 shrink-0 border-theme/10 py-3.5">
								<DailyQuizWordBar
									word={card.word}
									ipa={card.ipa}
									pos={card.pos}
									playing={playing}
									playLabel={playLabel}
									onPlay={() => void playWord({ force: true })}
								/>
							</SessionPromptPanel>
							<div className="flex shrink-0 flex-col gap-3">
								<p className="text-textcolor/55 text-left text-sm leading-snug">
									{t('englishLearning.daily.quizHint')}
								</p>
								<div className="flex flex-col gap-2">
									{quizOptions.map((option) => (
										<Button
											key={option.id}
											type="button"
											variant="ghost"
											className={QUIZ_OPTION_CLASS}
											onClick={() => onPickOption(option)}
										>
											{option.label}
										</Button>
									))}
								</div>
							</div>
						</div>
					) : null}

					{step === 'feedback' ? (
						lastCorrect ? (
							<DailyCorrectFeedback
								feedbackText={feedbackText}
								card={card}
								playing={playing}
								playLabel={playLabel}
								onPlay={() => void playWord()}
								t={t}
							/>
						) : (
							<DailyWrongFeedback
								feedbackText={feedbackText}
								card={card}
								playing={playing}
								playLabel={playLabel}
								onPlay={() => void playWord()}
								t={t}
							/>
						)
					) : null}
				</div>

				{step === 'study' || step === 'feedback' ? (
					<div className="border-theme/10 shrink-0 border-t px-4 py-4">
						<Button
							type="button"
							className={cn(
								'h-10 w-full gap-2',
								PRACTICE_PRIMARY_ACTION_BTN_CLASS,
							)}
							disabled={step === 'feedback' && submitting}
							onClick={step === 'study' ? onStartQuiz : () => void onContinue()}
						>
							{step === 'study' ? (
								t('englishLearning.daily.startQuiz')
							) : submitting ? (
								<Spinner className="size-4 text-white" />
							) : index >= cards.length - 1 ? (
								t('englishLearning.daily.finish')
							) : (
								t('englishLearning.daily.nextWord')
							)}
						</Button>
					</div>
				) : null}
			</PracticeCard>
		</div>
	);
}
