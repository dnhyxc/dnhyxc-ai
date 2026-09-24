/**
 * 今日记词 — 认读四选一 / 听写·看中写词槽拼写 / 反馈（结算逻辑相同）
 */
import { Button, Spinner } from '@ui/index';
import { AudioLines, CheckCircle2, Tags, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Tooltip from '@/components/design/Tooltip';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { hasValidAuthToken } from '@/router/authPaths';
import {
	getEnglishDailyMemorizeSummary,
	recordEnglishDailyMemorizeAttempts,
} from '@/service';
import englishDailyStore from '@/store/englishDaily';
import { Toggle } from '../../components/favorite';
import { Head } from '../../components/shell';
import { DictationPlayButton } from '../../practice/components/prompt/DictationPrompt';
import { SessionPromptPanel } from '../../practice/components/session/SessionPromptPanel';
import { ClassicSpellingBoard } from '../../practice/components/slots';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../../practice/constants';
import {
	gradeSentenceSlots,
	segmentEnglishSentence,
} from '../../practice/utils/segmentSentence';
import { posAbbrToZh, splitPhraseIpa } from '../../practice/utils/wordMeta';
import { dispatchEnglishReviewSummaryRefresh } from '../../sidebar/reviewEvents';
import { QUIZ_OPTION_CLASS } from '../constants';
import { useDailyPlayback } from '../hooks/useDailyPlayback';
import { useDailySessionKeyboard } from '../hooks/useDailySessionKeyboard';
import type {
	DailyCardStep,
	DailyMemorizeMode,
	DailyQuizOption,
	DailySessionSummary,
	DailyVocabCard,
} from '../types';
import { buildQuizOptions } from '../utils/buildQuizOptions';
import {
	countStarterMemorized,
	recordStarterMemorizeResult,
} from '../utils/localSrs';
import { DAILY_STARTER_WORDS } from '../utils/starterWords';
import { DailyFeedback } from './DailyFeedback';
import { DailyPlayIconButton } from './DailyPlayIconButton';
import { DailyQuizWordBar } from './DailyQuizWordBar';
import { DailyWordHero } from './DailyWordHero';
import { ShortcutsMenu } from './ShortcutsMenu';

type PendingRecord = {
	key: string;
	correct: boolean;
	origin: DailyVocabCard['origin'];
};

const STAGE_ICON_BTN =
	'h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0 shadow-none transition-colors focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none';

export type DailyCardSessionProps = {
	cards: DailyVocabCard[];
	mode: DailyMemorizeMode;
	onComplete: (summary: DailySessionSummary) => void;
};

export function DailyCardSession({
	cards,
	mode,
	onComplete,
}: DailyCardSessionProps) {
	const { t } = useI18n();
	const isSpellMode = mode === 'dictation' || mode === 'spelling';
	const [index, setIndex] = useState(0);
	const [step, setStep] = useState<DailyCardStep>(
		isSpellMode ? 'quiz' : 'study',
	);
	const [quizOptions, setQuizOptions] = useState<DailyQuizOption[]>([]);
	const [slotValues, setSlotValues] = useState<string[]>([]);
	const [activeSlot, setActiveSlot] = useState(0);
	const [showPos, setShowPos] = useState(false);
	const [showIpa, setShowIpa] = useState(false);
	const [lastCorrect, setLastCorrect] = useState(false);
	const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const usedDistractorLabelsRef = useRef(new Set<string>());

	const card = cards[index];
	const tokens = useMemo(
		() => (card ? segmentEnglishSentence(card.word) : []),
		[card],
	);
	const metaByIndex = useMemo(() => {
		if (!card || tokens.length === 0) return [];
		const meta = {
			posZh: posAbbrToZh(card.pos || ''),
			ipa: card.ipa?.trim() || '',
			meaningZh: card.translationZh?.trim() || '',
		};
		if (!meta.posZh && !meta.ipa && !meta.meaningZh) {
			return tokens.map(() => null);
		}
		const ipaParts = splitPhraseIpa(meta.ipa, tokens.length);
		return tokens.map((_, i) => {
			if (i === 0) {
				return {
					...meta,
					ipa: ipaParts ? ipaParts[0]! : meta.ipa,
				};
			}
			if (!ipaParts) return null;
			return { posZh: '', ipa: ipaParts[i]!, meaningZh: '' };
		});
	}, [card, tokens]);
	const canToggleMeta = Boolean(card?.pos?.trim() || card?.ipa?.trim());

	const { playing, playWord, playLabel } = useDailyPlayback({
		word: card?.word ?? '',
		t,
	});

	useEffect(() => {
		usedDistractorLabelsRef.current.clear();
	}, [cards]);

	useEffect(() => {
		if (!card) return;
		setQuizOptions([]);
		setSlotValues(Array.from({ length: tokens.length }, () => ''));
		setActiveSlot(0);
		setShowPos(false);
		setShowIpa(false);
		if (isSpellMode) {
			setStep('quiz');
			if (mode === 'dictation') {
				void playWord({ force: true });
			}
		} else {
			setStep('study');
			void playWord({ force: true });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- 换词重置作答态
	}, [card?.key, mode, isSpellMode, tokens.length]);

	const onStartQuiz = useCallback(() => {
		if (!card || isSpellMode) return;
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
	}, [card, cards, isSpellMode]);

	const recordAnswer = useCallback(
		(correct: boolean) => {
			if (!card) return;
			setLastCorrect(correct);
			setPendingRecords((prev) => [
				...prev,
				{ key: card.key, correct, origin: card.origin },
			]);
			setStep('feedback');
		},
		[card],
	);

	const onPickOption = useCallback(
		(option: DailyQuizOption) => {
			if (!card || step !== 'quiz' || isSpellMode) return;
			recordAnswer(option.correct);
		},
		[card, isSpellMode, recordAnswer, step],
	);

	const onSubmitSpell = useCallback(() => {
		if (!card || step !== 'quiz' || !isSpellMode) return;
		const allFilled =
			tokens.length > 0 && tokens.every((_, i) => (slotValues[i] ?? '').trim());
		if (!allFilled) return;
		recordAnswer(gradeSentenceSlots(slotValues, tokens));
	}, [card, isSpellMode, recordAnswer, slotValues, step, tokens]);

	const onSlotChange = useCallback(
		(slotIndex: number, value: string) => {
			setSlotValues((prev) => {
				const len = Math.max(tokens.length, slotIndex + 1);
				const next = Array.from({ length: len }, (_, i) => prev[i] ?? '');
				next[slotIndex] = value;
				return next;
			});
		},
		[tokens.length],
	);

	const onSlotAdvance = useCallback(
		(fromIndex: number, nextValues?: string[]) => {
			if (fromIndex >= tokens.length - 1) {
				const values = nextValues ?? slotValues;
				if (gradeSentenceSlots(values, tokens)) {
					recordAnswer(true);
				}
				return;
			}
			setActiveSlot(fromIndex + 1);
		},
		[recordAnswer, slotValues, tokens],
	);

	const onContinue = useCallback(async () => {
		if (index >= cards.length - 1) {
			setSubmitting(true);
			let practicedTotal = pendingRecords.length;
			let poolTotal: number | undefined;
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
				if (hasValidAuthToken()) {
					const res = await getEnglishDailyMemorizeSummary({ silent: true });
					const memorized = res.data?.memorizedCount ?? practicedTotal;
					const remaining = res.data?.libraryCount ?? 0;
					practicedTotal = memorized;
					englishDailyStore.setMemorizedCount(memorized);
					englishDailyStore.setLibraryCount(remaining);
					// 与首页侧栏同口径：已练 + 待学 = 词库总量
					poolTotal = memorized + remaining;
				} else {
					practicedTotal = countStarterMemorized();
					englishDailyStore.setMemorizedCount(practicedTotal);
					englishDailyStore.setLibraryCount(
						DAILY_STARTER_WORDS.length - practicedTotal,
					);
					poolTotal = DAILY_STARTER_WORDS.length;
				}
			} finally {
				setSubmitting(false);
			}
			const correctCount = pendingRecords.filter((r) => r.correct).length;
			const wrongKeys = new Set(
				pendingRecords.filter((r) => !r.correct).map((r) => r.key),
			);
			const correctKeys = new Set(
				pendingRecords.filter((r) => r.correct).map((r) => r.key),
			);
			onComplete({
				correctCount,
				wrongCount: pendingRecords.length - correctCount,
				total: pendingRecords.length,
				practicedTotal,
				...(poolTotal != null && poolTotal > 0 ? { poolTotal } : {}),
				wrongCards: cards.filter((c) => wrongKeys.has(c.key)),
				correctCards: cards.filter((c) => correctKeys.has(c.key)),
			});
			return;
		}
		setIndex((i) => i + 1);
	}, [cards, cards.length, index, onComplete, pendingRecords]);

	useDailySessionKeyboard({
		step,
		submitting,
		spellBoard: isSpellMode,
		canToggleMeta,
		playWord,
		onStartQuiz,
		onContinue,
		onTogglePos: () => setShowPos((v) => !v),
		onToggleIpa: () => setShowIpa((v) => !v),
	});

	const feedbackText = useMemo(() => {
		return lastCorrect
			? t('englishLearning.daily.feedbackCorrect')
			: t('englishLearning.daily.feedbackWrong');
	}, [lastCorrect, t]);

	const canCheck =
		tokens.length > 0 && tokens.every((_, i) => (slotValues[i] ?? '').trim());

	if (!card) {
		return (
			<div className="flex flex-1 items-center justify-center py-12">
				<Spinner className="text-textcolor" />
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 w-full flex-1 flex-col">
			<Head
				className="pl-4 pr-2"
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
							{isSpellMode ? (
								<DailyPlayIconButton
									playing={playing}
									playLabel={playLabel}
									onPlay={() => void playWord()}
								/>
							) : null}
							<Toggle
								kind="vocab"
								item={card}
								className={STAGE_ICON_BTN}
								tabIndex={-1}
							/>
							<ShortcutsMenu mode={mode} />
						</>
					) : step === 'quiz' && isSpellMode ? (
						<>
							<DailyPlayIconButton
								playing={playing}
								playLabel={playLabel}
								onPlay={() => void playWord()}
							/>
							{canToggleMeta ? (
								<>
									<Tooltip
										side="top"
										content={t('englishLearning.practice.togglePos')}
									>
										<Button
											type="button"
											variant="link"
											size="sm"
											tabIndex={-1}
											aria-pressed={showPos}
											aria-label={t('englishLearning.practice.togglePos')}
											className={cn(
												STAGE_ICON_BTN,
												showPos ? 'text-teal-500' : 'text-textcolor/55',
											)}
											onClick={(e) => {
												setShowPos((v) => !v);
												e.currentTarget.blur();
											}}
										>
											<Tags className="size-4.5" aria-hidden />
										</Button>
									</Tooltip>
									<Tooltip
										side="top"
										content={t('englishLearning.practice.toggleIpa')}
									>
										<Button
											type="button"
											variant="link"
											size="sm"
											tabIndex={-1}
											aria-pressed={showIpa}
											aria-label={t('englishLearning.practice.toggleIpa')}
											className={cn(
												STAGE_ICON_BTN,
												showIpa ? 'text-teal-500' : 'text-textcolor/55',
											)}
											onClick={(e) => {
												setShowIpa((v) => !v);
												e.currentTarget.blur();
											}}
										>
											<AudioLines className="size-4.5" aria-hidden />
										</Button>
									</Tooltip>
								</>
							) : null}
							<Toggle
								kind="vocab"
								item={card}
								className={STAGE_ICON_BTN}
								tabIndex={-1}
							/>
							<ShortcutsMenu mode={mode} />
						</>
					) : (
						<>
							<Toggle
								kind="vocab"
								item={card}
								className={STAGE_ICON_BTN}
								tabIndex={-1}
							/>
							<ShortcutsMenu mode={mode} />
						</>
					)
				}
			>
				<span className="min-w-0 truncate">
					{t('englishLearning.daily.sectionLabel')}
				</span>
				<span className="shrink-0 tabular-nums">
					{index + 1}/{cards.length}
				</span>
			</Head>

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

					{step === 'quiz' && !isSpellMode ? (
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

					{step === 'quiz' && isSpellMode ? (
						<div className="flex min-h-0 flex-1 flex-col gap-4">
							<SessionPromptPanel
								fillHeight
								className="min-h-0 flex-1 justify-stretch overflow-hidden border-0 bg-transparent p-0 shadow-none"
							>
								<ClassicSpellingBoard
									translationZh={
										mode === 'dictation'
											? t('englishLearning.practice.dictationHint')
											: card.translationZh.trim() || '—'
									}
									headlineMuted={mode === 'dictation'}
									tokens={tokens}
									values={slotValues}
									activeIndex={activeSlot}
									showPos={showPos}
									showIpa={showIpa}
									phase="prompt"
									metaByIndex={metaByIndex}
									compactMeaning={false}
									onChange={onSlotChange}
									onActiveChange={setActiveSlot}
									onAdvance={onSlotAdvance}
									onSubmitAll={onSubmitSpell}
								/>
							</SessionPromptPanel>
							<form
								className="mx-auto w-full max-w-4xl shrink-0"
								onSubmit={(e) => {
									e.preventDefault();
									onSubmitSpell();
								}}
							>
								<Button
									type="submit"
									tabIndex={-1}
									className={cn(
										'h-10 w-full shrink-0',
										PRACTICE_PRIMARY_ACTION_BTN_CLASS,
									)}
									disabled={!canCheck}
								>
									{t('englishLearning.practice.slotCheck')}
								</Button>
							</form>
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
