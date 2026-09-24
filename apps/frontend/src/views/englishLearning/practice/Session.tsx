/**
 * 单题练习界面（词库 / 经典句统一词槽输入）
 */
import { Button } from '@ui/index';
import { AudioLines, Square, Tags, Volume2 } from 'lucide-react';
import {
	type FormEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import Tooltip from '@/components/design/Tooltip';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { Toggle } from '../components/favorite';
import { Head } from '../components/shell';
import { SessionPromptPanel } from './components/session/SessionPromptPanel';
import { SessionWrongActions } from './components/session/SessionWrongActions';
import { ClassicSpellingBoard } from './components/slots';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from './constants';
import { usePracticeItemReset } from './hooks/usePracticeItemReset';
import { usePracticePlayback } from './hooks/usePracticePlayback';
import { usePracticeSessionKeyboard } from './hooks/usePracticeSessionKeyboard';
import { useSentenceWordAnnotations } from './hooks/useSentenceWordAnnotations';
import type {
	PracticeAttemptResult,
	PracticeItemPhase,
	SessionProps,
} from './types';
import { hasPracticeHintContent } from './utils/hint';
import {
	getPracticeAnswerText,
	isPracticeClassicItem,
	isPracticeVocabItem,
	practiceToggleProps,
} from './utils/item';
import {
	gradeSentenceSlots,
	joinSlotInputs,
	type SentenceWordToken,
	segmentEnglishSentence,
} from './utils/segmentSentence';
import {
	posAbbrToZh,
	type SentenceWordMeta,
	splitPhraseIpa,
} from './utils/wordMeta';

const EMPTY_TOKENS: readonly SentenceWordToken[] = [];
const EMPTY_META: readonly (SentenceWordMeta | null)[] = [];

/** 顶栏图标钮：无边框 / 无 focus ring（Button 默认 focus-visible:border-ring） */
const STAGE_ICON_BTN =
	'h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0 shadow-none transition-colors focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none';

export function Session({
	mode,
	item,
	itemIndex,
	sourceTitle,
	onTtsPipelineKick,
	isLastQuestion = false,
	canGoPrevious = false,
	onGoPrevious,
	onStepComplete,
	progressLabel,
	headerExtra,
}: SessionProps) {
	const { t } = useI18n();
	const [phase, setPhase] = useState<PracticeItemPhase>('prompt');
	const [wrongAttemptCount, setWrongAttemptCount] = useState(0);
	const [lastWrong, setLastWrong] = useState<PracticeAttemptResult | null>(
		null,
	);
	const [lastCorrect, setLastCorrect] = useState<PracticeAttemptResult | null>(
		null,
	);
	const [hintOpen, setHintOpen] = useState(false);

	const isClassic = isPracticeClassicItem(item);
	const answerText = getPracticeAnswerText(item);
	const tokens = useMemo(
		() => segmentEnglishSentence(answerText),
		[answerText],
	);

	const classicAnnotate = useSentenceWordAnnotations({
		enabled: isClassic,
		english: isClassic ? answerText : '',
		tokens: isClassic ? tokens : EMPTY_TOKENS,
	});

	const vocabMetaByIndex = useMemo((): readonly (SentenceWordMeta | null)[] => {
		if (!isPracticeVocabItem(item) || tokens.length === 0) return EMPTY_META;
		const meta: SentenceWordMeta = {
			posZh: posAbbrToZh(item.pos || ''),
			ipa: item.ipa?.trim() || '',
			meaningZh: item.translationZh?.trim() || '',
		};
		if (!meta.posZh && !meta.ipa && !meta.meaningZh) {
			return tokens.map(() => null);
		}
		const ipaParts = splitPhraseIpa(meta.ipa, tokens.length);
		// 词性、释义是整条短语的；音标能按词切开才分到各槽
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
	}, [item, tokens]);

	const metaByIndex = isClassic
		? classicAnnotate.metaByIndex
		: vocabMetaByIndex;
	const metaLoading = isClassic ? classicAnnotate.loading : false;
	const metaError = isClassic ? classicAnnotate.error : false;

	const [slotValues, setSlotValues] = useState<string[]>([]);
	const [activeSlot, setActiveSlot] = useState(0);
	const [showPos, setShowPos] = useState(false);
	const [showIpa, setShowIpa] = useState(false);

	const {
		playing,
		setPlaying,
		playLabel,
		playWord,
		playWordRef,
		cancelDictationPlay,
	} = usePracticePlayback({
		mode,
		answerText,
		itemIndex,
		onPipelineKick: onTtsPipelineKick,
		t,
	});

	const resetItemState = useCallback(() => {
		setPhase('prompt');
		setWrongAttemptCount(0);
		setLastWrong(null);
		setLastCorrect(null);
		setHintOpen(false);
		setSlotValues(Array.from({ length: tokens.length }, () => ''));
		setActiveSlot(0);
		setShowPos(false);
		setShowIpa(false);
	}, [tokens.length]);

	useEffect(() => {
		setSlotValues(Array.from({ length: tokens.length }, () => ''));
		setActiveSlot(0);
	}, [tokens]);

	usePracticeItemReset({
		itemKey: item.key,
		mode,
		cancelDictationPlay,
		setPlaying,
		resetState: resetItemState,
		playWordRef,
	});

	const completeStep = useCallback(
		(result: PracticeAttemptResult) => {
			cancelDictationPlay();
			setPlaying(false);
			onStepComplete(result);
		},
		[cancelDictationPlay, onStepComplete, setPlaying],
	);

	const applyAttempt = useCallback(
		(userInput: string, correct: boolean) => {
			const attempt: PracticeAttemptResult = {
				item,
				userInput,
				correct,
			};
			if (correct) {
				setLastWrong(null);
				setLastCorrect(attempt);
				setPhase('correct_reveal');
				return;
			}
			cancelDictationPlay();
			setPlaying(false);
			setLastCorrect(null);
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
		[cancelDictationPlay, item, mode, setPlaying, wrongAttemptCount],
	);

	const onSubmit = useCallback(
		(e?: FormEvent) => {
			e?.preventDefault();
			if (phase !== 'prompt') return;
			const allFilled =
				tokens.length > 0 &&
				tokens.every((_, i) => (slotValues[i] ?? '').trim());
			if (!allFilled) return;
			const correct = gradeSentenceSlots(slotValues, tokens);
			applyAttempt(joinSlotInputs(slotValues), correct);
		},
		[applyAttempt, phase, slotValues, tokens],
	);

	const onSlotChange = useCallback(
		(index: number, value: string) => {
			setSlotValues((prev) => {
				const len = Math.max(tokens.length, index + 1);
				const next = Array.from({ length: len }, (_, i) => prev[i] ?? '');
				next[index] = value;
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
					applyAttempt(joinSlotInputs(values), true);
				}
				return;
			}
			setActiveSlot(fromIndex + 1);
		},
		[applyAttempt, slotValues, tokens],
	);

	const onNext = useCallback(() => {
		if (phase === 'correct_reveal' && lastCorrect) {
			cancelDictationPlay();
			setPlaying(false);
			completeStep(lastCorrect);
			return;
		}
		if (!lastWrong) return;
		cancelDictationPlay();
		setPlaying(false);
		completeStep(lastWrong);
	}, [
		cancelDictationPlay,
		completeStep,
		lastCorrect,
		lastWrong,
		phase,
		setPlaying,
	]);

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
		setLastCorrect(null);
		setPhase('prompt');
		setSlotValues(Array.from({ length: tokens.length }, () => ''));
		setActiveSlot(0);
		if (mode === 'dictation') {
			void playWord({ force: true, sequence: true });
		}
	}, [cancelDictationPlay, mode, playWord, setPlaying, tokens.length]);

	const canToggleSlotMeta =
		!metaLoading &&
		!metaError &&
		(isClassic ||
			(isPracticeVocabItem(item) &&
				Boolean(item.pos?.trim() || item.ipa?.trim())));

	usePracticeSessionKeyboard({
		phase,
		mode,
		hintOpen,
		slotBoard: true,
		canToggleMeta: canToggleSlotMeta,
		lastWrong,
		lastCorrect,
		canGoPrevious,
		playWord,
		onTogglePos: () => setShowPos((v) => !v),
		onToggleIpa: () => setShowIpa((v) => !v),
		onRetryCurrent,
		onPreviousQuestion,
		onRevealAnswer,
		onNext,
	});

	const showSessionCard =
		phase === 'prompt' ||
		phase === 'correct_reveal' ||
		((phase === 'soft_wrong' || phase === 'revealed') && lastWrong != null);

	const showWrongActions = phase === 'soft_wrong' || phase === 'revealed';
	const showCorrectActions = phase === 'correct_reveal' && lastCorrect != null;

	const softWrongGuidance = t('englishLearning.practice.softWrongHint');
	const showAnswerLabel = t('englishLearning.practice.showAnswer');

	const slotAllFilled =
		tokens.length > 0 && tokens.every((_, i) => (slotValues[i] ?? '').trim());
	const canCheck = slotAllFilled;

	const onSlotBoardPlay = useCallback(() => {
		void playWord(
			mode === 'dictation' && phase === 'prompt'
				? { sequence: !hintOpen }
				: undefined,
		);
	}, [hintOpen, mode, phase, playWord]);

	const dictationPromptHint = isClassic
		? t('englishLearning.practice.classicDictationHint')
		: t('englishLearning.practice.dictationHint');

	const renderBoard = (boardPhase: PracticeItemPhase) => (
		<ClassicSpellingBoard
			translationZh={
				// 听写答题态不展示中文，避免听写变看中写；错题/揭示/全对再展示
				mode === 'dictation' && boardPhase === 'prompt'
					? dictationPromptHint
					: item.translationZh
			}
			headlineMuted={mode === 'dictation' && boardPhase === 'prompt'}
			tokens={tokens}
			values={slotValues}
			activeIndex={activeSlot}
			showPos={showPos}
			showIpa={showIpa}
			phase={boardPhase}
			metaByIndex={metaByIndex}
			metaLoading={metaLoading}
			metaError={metaError}
			compactMeaning={isClassic}
			onChange={onSlotChange}
			onActiveChange={setActiveSlot}
			onAdvance={onSlotAdvance}
			onSubmitAll={() => onSubmit()}
		/>
	);

	return (
		<div className="flex h-full min-h-0 w-full flex-1 flex-col">
			{showSessionCard ? (
				<div
					className="flex min-h-0 flex-1 flex-col overflow-hidden"
					role={showWrongActions || showCorrectActions ? 'status' : undefined}
				>
					<Head
						className="pl-4 pr-2"
						trailing={
							<>
								{phase === 'correct_reveal' ? (
									<span className="pr-1.5 text-sm font-medium whitespace-nowrap text-emerald-500">
										{t('englishLearning.practice.correct')}
									</span>
								) : phase === 'soft_wrong' || phase === 'revealed' ? (
									<span className="text-destructive pr-1.5 text-sm font-medium whitespace-nowrap">
										{t('englishLearning.practice.incorrect')}
									</span>
								) : null}
								{metaLoading ? (
									<span className="text-textcolor/40 pr-1.5 text-xs whitespace-nowrap">
										标注中…
									</span>
								) : metaError ? (
									<span className="text-rose-500/90 pr-1.5 text-xs whitespace-nowrap">
										标注失败
									</span>
								) : null}
								<Tooltip side="top" content={playLabel}>
									<Button
										type="button"
										variant="link"
										size="sm"
										tabIndex={-1}
										onClick={(e) => {
											onSlotBoardPlay();
											e.currentTarget.blur();
										}}
										aria-label={playLabel}
										aria-pressed={playing}
										className={cn(
											STAGE_ICON_BTN,
											playing ? 'text-teal-500' : 'text-textcolor/55',
										)}
									>
										{playing ? (
											<Square className="size-4.5 fill-current" aria-hidden />
										) : (
											<Volume2 className="size-4.5" aria-hidden />
										)}
									</Button>
								</Tooltip>
								{canToggleSlotMeta ? (
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
									{...practiceToggleProps(item)}
									className={STAGE_ICON_BTN}
									tabIndex={-1}
								/>
								{headerExtra}
							</>
						}
					>
						<span className="truncate">
							{sourceTitle?.trim() ||
								t('englishLearning.practice.sourceResolving')}
						</span>
						{progressLabel ? (
							<span className="shrink-0 tabular-nums">{progressLabel}</span>
						) : null}
					</Head>
					<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
						<div className="grid min-h-0 flex-1 w-full transition-none *:col-start-1 *:row-start-1 *:h-full *:min-h-0">
							<SessionPromptPanel
								fillHeight
								className={cn(
									'justify-stretch overflow-hidden border-0 bg-transparent p-0 shadow-none',
									phase !== 'prompt' && 'hidden',
								)}
								aria-hidden={phase !== 'prompt'}
							>
								{phase === 'prompt' ? renderBoard('prompt') : null}
							</SessionPromptPanel>
							<SessionPromptPanel
								fillHeight
								className={cn(
									phase !== 'soft_wrong' && 'hidden',
									'justify-stretch overflow-hidden border-0 bg-transparent p-0 shadow-none',
								)}
								aria-hidden={phase !== 'soft_wrong'}
							>
								{phase === 'soft_wrong' ? (
									<div className="flex h-full min-h-0 flex-col">
										<div className="min-h-0 flex-1">
											{renderBoard('soft_wrong')}
										</div>
										<div className="mx-auto flex w-full max-w-4xl shrink-0 items-center justify-between gap-2 pt-3">
											<p className="text-textcolor/60 text-xs">
												{softWrongGuidance}
											</p>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												tabIndex={-1}
												className="text-teal-600"
												onClick={onRevealAnswer}
											>
												{showAnswerLabel}
											</Button>
										</div>
									</div>
								) : null}
							</SessionPromptPanel>
							<SessionPromptPanel
								fillHeight
								className={cn(
									phase !== 'revealed' && 'hidden',
									'justify-stretch overflow-hidden border-0 bg-transparent p-0 shadow-none',
								)}
								aria-hidden={phase !== 'revealed'}
							>
								{phase === 'revealed' ? renderBoard('revealed') : null}
							</SessionPromptPanel>
							<SessionPromptPanel
								fillHeight
								className={cn(
									phase !== 'correct_reveal' && 'hidden',
									'justify-stretch overflow-hidden border-0 bg-transparent p-0 shadow-none',
								)}
								aria-hidden={phase !== 'correct_reveal'}
							>
								{phase === 'correct_reveal'
									? renderBoard('correct_reveal')
									: null}
							</SessionPromptPanel>
						</div>
						<form
							className="mx-auto w-full max-w-4xl shrink-0 transition-none"
							onSubmit={onSubmit}
						>
							<div className={cn(phase !== 'prompt' && 'hidden')}>
								<Button
									type="submit"
									tabIndex={-1}
									className={cn(
										'h-10 w-full shrink-0 transition-none',
										PRACTICE_PRIMARY_ACTION_BTN_CLASS,
									)}
									disabled={!canCheck}
								>
									{t('englishLearning.practice.slotCheck')}
								</Button>
							</div>
							{/* 答对 / 答错共用：再试一次 | 上一题 | 下一题 */}
							<SessionWrongActions
								visible={showWrongActions || showCorrectActions}
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
					</div>
				</div>
			) : null}
		</div>
	);
}
