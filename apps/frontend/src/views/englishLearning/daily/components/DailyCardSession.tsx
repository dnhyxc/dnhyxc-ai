/**
 * 今日记词 — 认读 / 四选一 / 反馈会话
 */
import { Button, Spinner } from '@ui/index';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { recordEnglishDailyMemorizeAttempts } from '@/service';
import { FavoriteToggleButton } from '../../components/FavoriteToggleButton';
import { SessionHeader } from '../../components/SessionHeader';
import { DictationPlayButton } from '../../practice/components/prompt/DictationPrompt';
import { SessionPromptPanel } from '../../practice/components/session/SessionPromptPanel';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../../practice/constants';
import { dispatchEnglishReviewSummaryRefresh } from '../../sidebar/reviewEvents';
import { QUIZ_OPTION_CLASS } from '../constants';
import { useDailyPlayback } from '../hooks/useDailyPlayback';
import { useDailySessionKeyboard } from '../hooks/useDailySessionKeyboard';
import type { DailyCardStep, DailyQuizOption, DailyVocabCard } from '../types';
import { buildQuizOptions } from '../utils/buildQuizOptions';
import { recordStarterMemorizeResult } from '../utils/localSrs';
import { DailyFeedback } from './DailyFeedback';
import { DailyPlayIconButton } from './DailyPlayIconButton';
import { DailyQuizWordBar } from './DailyQuizWordBar';
import { DailyWordHero } from './DailyWordHero';

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

	if (!card) {
		return (
			<div className="flex flex-1 items-center justify-center py-12">
				<Spinner className="text-textcolor" />
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 w-full flex-1 flex-col">
			<SessionHeader
				className="px-3.5"
				trailing={
					step === 'feedback' ? (
						<>
							<span
								className={cn(
									'flex min-w-0 items-center gap-1.5 pr-1.5 text-sm font-medium',
									lastCorrect
										? 'text-emerald-600 dark:text-lime-400'
										: 'text-destructive',
								)}
								role="status"
								aria-live="polite"
							>
								{lastCorrect ? (
									<CheckCircle2 className="size-4 shrink-0" aria-hidden />
								) : (
									<XCircle className="size-4 shrink-0" aria-hidden />
								)}
								<span className="truncate">{feedbackText}</span>
							</span>
							<FavoriteToggleButton kind="vocab" item={card} />
							<DailyPlayIconButton
								playing={playing}
								playLabel={playLabel}
								onPlay={() => void playWord()}
							/>
						</>
					) : null
				}
			>
				<span className="min-w-0 truncate">
					{t('englishLearning.daily.sectionLabel')}
				</span>
				<span className="shrink-0 tabular-nums">
					{index + 1}/{cards.length}
				</span>
			</SessionHeader>

			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
									onPlay={() => void playWord()}
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
						<DailyFeedback
							variant={lastCorrect ? 'correct' : 'wrong'}
							card={card}
							t={t}
						/>
					) : null}
				</div>

				{step === 'study' || step === 'feedback' ? (
					<Button
						type="button"
						className={cn(
							'mx-auto h-10 w-full max-w-4xl shrink-0 gap-2',
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
				) : null}
			</div>
		</div>
	);
}
