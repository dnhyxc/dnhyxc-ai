/**
 * 单题练习界面
 */
import { Button, Input, Label } from '@ui/index';
import { Headphones, Languages, Lightbulb } from 'lucide-react';
import {
	type FormEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { DictationPromptBody, SpellingPromptBody } from './components/prompt';
import { RevealedPanelInner } from './components/reveal';
import { SessionPromptPanel } from './components/session/SessionPromptPanel';
import { SessionStageHeader } from './components/session/SessionStageHeader';
import { SessionWrongActions } from './components/session/SessionWrongActions';
import { SoftWrongStage } from './components/session/SoftWrongStage';
import { PracticeCard } from './components/shell';
import {
	PRACTICE_PAGE_CONTENT_CLASS,
	PRACTICE_PRIMARY_ACTION_BTN_CLASS,
	SESSION_CARD_H,
} from './constants';
import { usePracticeItemReset } from './hooks/usePracticeItemReset';
import { usePracticePlayback } from './hooks/usePracticePlayback';
import { usePracticeSessionKeyboard } from './hooks/usePracticeSessionKeyboard';
import type {
	PracticeAttemptResult,
	PracticeItemPhase,
	SessionProps,
} from './types';
import { gradeSpelling } from './utils/grading';
import { buildPracticeHintContent, hasPracticeHintContent } from './utils/hint';
import { getPracticeAnswerText, isPracticeClassicItem } from './utils/item';

export function Session({
	mode,
	item,
	isLastQuestion = false,
	canGoPrevious = false,
	onGoPrevious,
	onStepComplete,
}: SessionProps) {
	const { t } = useI18n();
	const [phase, setPhase] = useState<PracticeItemPhase>('prompt');
	const [input, setInput] = useState('');
	const [wrongAttemptCount, setWrongAttemptCount] = useState(0);
	const [lastWrong, setLastWrong] = useState<PracticeAttemptResult | null>(
		null,
	);
	const [dictationSpellStepActive, setDictationSpellStepActive] =
		useState(false);
	const [hintOpen, setHintOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const answerText = getPracticeAnswerText(item);

	const {
		playing,
		setPlaying,
		playLabel,
		playWord,
		playWordRef,
		cancelDictationPlay,
	} = usePracticePlayback({ mode, answerText, t });

	const resetItemState = useCallback(() => {
		setPhase('prompt');
		setInput('');
		setWrongAttemptCount(0);
		setLastWrong(null);
		setDictationSpellStepActive(false);
		setHintOpen(false);
	}, []);

	usePracticeItemReset({
		itemKey: item.key,
		mode,
		cancelDictationPlay,
		setPlaying,
		resetState: resetItemState,
		playWordRef,
		inputRef,
	});

	const completeStep = useCallback(
		(result: PracticeAttemptResult) => {
			cancelDictationPlay();
			setPlaying(false);
			onStepComplete(result);
		},
		[cancelDictationPlay, onStepComplete, setPlaying],
	);

	const onSubmit = useCallback(
		(e?: FormEvent) => {
			e?.preventDefault();
			if (phase !== 'prompt') return;
			const trimmed = input.trim();
			if (!trimmed) return;
			const correct = gradeSpelling(trimmed, answerText, {
				compareAsSentence: isPracticeClassicItem(item),
			});
			const attempt: PracticeAttemptResult = {
				item,
				userInput: trimmed,
				correct,
			};
			if (correct) {
				completeStep(attempt);
				return;
			}
			cancelDictationPlay();
			setPlaying(false);
			setLastWrong(attempt);
			const nextAttempt = wrongAttemptCount + 1;
			setWrongAttemptCount(nextAttempt);
			if (nextAttempt >= 2) {
				setPhase('revealed');
			} else {
				setPhase('soft_wrong');
				if (hasPracticeHintContent(item, mode)) {
					setHintOpen(true);
				}
			}
		},
		[
			answerText,
			cancelDictationPlay,
			completeStep,
			input,
			item,
			mode,
			phase,
			setPlaying,
			wrongAttemptCount,
		],
	);

	const onNext = useCallback(() => {
		if (!lastWrong) return;
		cancelDictationPlay();
		setPlaying(false);
		completeStep(lastWrong);
	}, [cancelDictationPlay, completeStep, lastWrong, setPlaying]);

	const onPreviousQuestion = useCallback(() => {
		if (!canGoPrevious || !onGoPrevious) return;
		cancelDictationPlay();
		setPlaying(false);
		onGoPrevious();
	}, [canGoPrevious, cancelDictationPlay, onGoPrevious, setPlaying]);

	const onRevealAnswer = useCallback(() => {
		setPhase('revealed');
	}, []);

	const onRetryCurrent = useCallback(() => {
		cancelDictationPlay();
		setPlaying(false);
		setLastWrong(null);
		setPhase('prompt');
		setInput('');
		setDictationSpellStepActive(false);
		if (mode === 'dictation') {
			void playWord({ force: true, sequence: true });
		}
		requestAnimationFrame(() => inputRef.current?.focus());
	}, [cancelDictationPlay, mode, playWord, setPlaying]);

	useEffect(() => {
		if (phase === 'soft_wrong' || phase === 'revealed') {
			inputRef.current?.blur();
		}
	}, [phase]);

	usePracticeSessionKeyboard({
		phase,
		mode,
		hintOpen,
		lastWrong,
		canGoPrevious,
		playWord,
		onRetryCurrent,
		onPreviousQuestion,
		onRevealAnswer,
		onNext,
	});

	const showSessionCard =
		phase === 'prompt' ||
		((phase === 'soft_wrong' || phase === 'revealed') && lastWrong != null);

	const showWrongActions = phase === 'soft_wrong' || phase === 'revealed';

	const modeIcon =
		mode === 'dictation' ? (
			<Headphones className="size-4" />
		) : (
			<Languages className="size-4" />
		);
	const isClassic = isPracticeClassicItem(item);

	const modeTitle =
		mode === 'dictation'
			? isClassic
				? t('englishLearning.practice.modeDictationClassic')
				: t('englishLearning.practice.modeDictationVocab')
			: isClassic
				? t('englishLearning.practice.modeSpellingClassic')
				: t('englishLearning.practice.modeSpellingVocab');

	const hintContent = useMemo(() => buildPracticeHintContent(item), [item]);

	const canHint = hasPracticeHintContent(item, mode);
	const hintButtonLabel = hintOpen
		? t('englishLearning.practice.hintHide')
		: t('englishLearning.practice.hintShow');

	const yourAnswerLabel = t('englishLearning.practice.yourAnswerLabel');
	const correctAnswerLabel = t('englishLearning.practice.correctAnswer');
	const revealedWrongInput = lastWrong?.userInput || input.trim() || '\u00A0';

	const softWrongGuidance = t('englishLearning.practice.softWrongHint');
	const showAnswerLabel = t('englishLearning.practice.showAnswer');

	return (
		<div className={cn(PRACTICE_PAGE_CONTENT_CLASS, 'flex flex-col gap-4')}>
			{showSessionCard ? (
				<PracticeCard
					className={cn(
						'border-theme/10 flex flex-col overflow-hidden p-0 shadow-sm',
						SESSION_CARD_H,
					)}
					role={showWrongActions ? 'status' : undefined}
				>
					<SessionStageHeader
						icon={modeIcon}
						title={modeTitle}
						trailing={
							phase === 'prompt' ? (
								<Button
									variant="link"
									disabled={!canHint}
									aria-pressed={hintOpen}
									aria-label={
										canHint
											? hintButtonLabel
											: t('englishLearning.practice.hintUnavailable')
									}
									className="px-0! text-teal-600 hover:text-teal-500 dark:text-teal-400 h-8 shrink-0 gap-1"
									onClick={() => setHintOpen((v) => !v)}
								>
									<Lightbulb className="size-3.5" aria-hidden />
									<span className="max-w-24 truncate text-sm font-medium">
										{hintButtonLabel}
									</span>
								</Button>
							) : (
								<span className="text-destructive min-w-16 text-right text-sm font-medium">
									{t('englishLearning.practice.incorrect')}
								</span>
							)
						}
					/>
					<div
						className={cn(
							'flex min-h-0 flex-1 flex-col',
							phase === 'soft_wrong' || phase === 'revealed' ? 'p-3' : 'p-4',
						)}
					>
						<div className="grid min-h-0 flex-1 w-full transition-none *:col-start-1 *:row-start-1 *:h-full *:min-h-0">
							<SessionPromptPanel
								fillHeight
								className={cn(
									mode === 'dictation' &&
										'justify-stretch overflow-hidden border-0 bg-transparent p-0 shadow-none',
									phase !== 'prompt' && 'hidden',
								)}
								aria-hidden={phase !== 'prompt'}
							>
								{mode === 'dictation' ? (
									<DictationPromptBody
										hint={
											isClassic
												? t('englishLearning.practice.classicDictationHint')
												: t('englishLearning.practice.dictationHint')
										}
										hintOpen={hintOpen}
										hintContent={hintContent}
										stepListen={t(
											'englishLearning.practice.dictationStepListen',
										)}
										stepSpell={t('englishLearning.practice.dictationStepSpell')}
										spellStepActive={dictationSpellStepActive}
										playing={playing}
										playLabel={playLabel}
										onPlay={() => void playWord({ sequence: !hintOpen })}
									/>
								) : (
									<SpellingPromptBody
										promptLabel={
											isClassic
												? t('englishLearning.practice.classicSpellingPrompt')
												: t('englishLearning.practice.spellingPrompt')
										}
										translationZh={item.translationZh}
										pos={isClassic ? undefined : item.pos}
										hintOpen={hintOpen}
										hintContent={hintContent}
										playing={playing}
										playLabel={playLabel}
										onPlay={() => void playWord()}
									/>
								)}
							</SessionPromptPanel>
							<SessionPromptPanel
								fillHeight
								className={cn(
									phase !== 'soft_wrong' && 'hidden',
									'justify-stretch overflow-hidden border-0 bg-transparent p-0 shadow-none',
								)}
								aria-hidden={phase !== 'soft_wrong'}
							>
								<SoftWrongStage
									answerLabel={yourAnswerLabel}
									wrongInput={revealedWrongInput}
									hintContent={canHint ? hintContent : {}}
									playing={playing}
									playLabel={playLabel}
									onPlay={() => void playWord()}
									guidance={softWrongGuidance}
									showAnswerLabel={showAnswerLabel}
									onShowAnswer={onRevealAnswer}
								/>
							</SessionPromptPanel>
							<SessionPromptPanel
								fillHeight
								className={cn(
									phase !== 'revealed' && 'hidden',
									'justify-stretch overflow-hidden border-0 bg-transparent p-0 shadow-none',
								)}
								aria-hidden={phase !== 'revealed'}
							>
								<RevealedPanelInner
									answerLabel={yourAnswerLabel}
									wrongInput={revealedWrongInput}
									item={item}
									correctAnswerLabel={correctAnswerLabel}
									playing={playing}
									playLabel={playLabel}
									onPlay={() => void playWord()}
								/>
							</SessionPromptPanel>
						</div>
					</div>
					<form
						className="border-theme/10 shrink-0 border-t px-4 pb-4 transition-none"
						onSubmit={onSubmit}
					>
						<div className={cn(phase !== 'prompt' && 'hidden')}>
							<div className="flex flex-col gap-3 pt-3">
								<div className="flex flex-col gap-2.5">
									<Label
										htmlFor="practice-spelling-input"
										className="text-textcolor/70 text-sm font-medium"
									>
										{t('englishLearning.practice.inputLabel')}
									</Label>
									<Input
										id="practice-spelling-input"
										ref={inputRef}
										value={input}
										onChange={(e) => setInput(e.target.value)}
										onFocus={() => {
											if (mode === 'dictation') {
												setDictationSpellStepActive(true);
											}
										}}
										onBlur={() => setDictationSpellStepActive(false)}
										placeholder={
											isClassic
												? t('englishLearning.practice.classicInputPlaceholder')
												: t('englishLearning.practice.inputPlaceholder')
										}
										spellCheck={false}
										autoComplete="off"
										autoCapitalize="off"
										className="border-theme/20 border bg-theme-background h-10 text-base shadow-none transition-none focus-visible:shadow-none focus-visible:ring-0"
									/>
								</div>
								<Button
									type="submit"
									className={cn(
										'h-10 w-full transition-none',
										PRACTICE_PRIMARY_ACTION_BTN_CLASS,
									)}
									disabled={!input.trim()}
								>
									{t('englishLearning.practice.check')}
								</Button>
							</div>
						</div>
						<SessionWrongActions
							visible={showWrongActions}
							canGoPrevious={canGoPrevious}
							tryAgainLabel={t('englishLearning.practice.tryAgain')}
							previousLabel={t('englishLearning.practice.previous')}
							nextLabel={
								isLastQuestion
									? t('englishLearning.practice.viewResults')
									: t('englishLearning.practice.next')
							}
							onRetry={onRetryCurrent}
							onPrevious={onPreviousQuestion}
							onNext={onNext}
						/>
					</form>
				</PracticeCard>
			) : null}
		</div>
	);
}
