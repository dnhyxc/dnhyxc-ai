/**
 * 单题练习界面
 */
import { Button, Input, Label, Toast } from '@ui/index';
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
import {
	isEnglishTtsSupported,
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { DictationPromptBody } from './components/dictation/DictationPrompt';
import { RevealedPanelInner } from './components/reveal';
import { SessionPromptPanel } from './components/session/SessionPromptPanel';
import { SessionStageHeader } from './components/session/SessionStageHeader';
import { DictationSoftWrongStage } from './components/session/SoftWrongStage';
import { PRACTICE_PAGE_CONTENT_CLASS, PracticeCard } from './components/shell';
import { SpellingPromptBody } from './components/spelling/SpellingPromptBody';
import type {
	PracticeAttemptResult,
	PracticeItemPhase,
	SessionProps,
} from './types';
import { gradeSpelling } from './utils/grading';
import { buildPracticeHintContent, hasPracticeHintContent } from './utils/hint';
import { getPracticeAnswerText, isPracticeClassicItem } from './utils/item';

/** 整张练习卡片锁定高度（听写/拼写 ↔ 错题切换时总高一致） */
const SESSION_CARD_H = 'h-[calc(14.625rem+min(14.5rem,38dvh))]';
/** 听写自动/手动播放：次数与间隔（毫秒） */
const DICTATION_PLAY_COUNT = 3;
const DICTATION_PLAY_GAP_MS = 3000;

function sleepMs(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}
/** 会话组件 */
export function Session({
	mode,
	item,
	isLastQuestion = false,
	onStepComplete,
}: SessionProps) {
	const { t } = useI18n();
	const [phase, setPhase] = useState<PracticeItemPhase>('prompt');
	const [input, setInput] = useState('');
	const [wrongAttemptCount, setWrongAttemptCount] = useState(0);
	const [lastWrong, setLastWrong] = useState<PracticeAttemptResult | null>(
		null,
	);
	const [playing, setPlaying] = useState(false);
	const [dictationSpellStepActive, setDictationSpellStepActive] =
		useState(false);
	const [hintOpen, setHintOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	/** 递增以取消进行中的听写连播（含间隔等待） */
	const dictationPlayRunRef = useRef(0);

	const answerText = getPracticeAnswerText(item);

	const cancelDictationPlay = useCallback(() => {
		dictationPlayRunRef.current += 1;
		stopAllEnglishPlayback();
	}, []);

	const playDictationSequence = useCallback(
		async (runId: number) => {
			for (let i = 0; i < DICTATION_PLAY_COUNT; i += 1) {
				if (dictationPlayRunRef.current !== runId) return;
				await playEnglishPreferred(answerText, { preferLocal: true });
				if (dictationPlayRunRef.current !== runId) return;
				if (i < DICTATION_PLAY_COUNT - 1) {
					await sleepMs(DICTATION_PLAY_GAP_MS);
				}
			}
		},
		[answerText],
	);

	const playWord = useCallback(
		async (options?: {
			/** 跳过「再点即停」，用于换题/再试后立刻开播 */
			force?: boolean;
			/** 听写三连播（进题自动播放、主播放钮未展开提示时） */
			sequence?: boolean;
		}) => {
			if (!isEnglishTtsSupported()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			// 说明：重试时 playing 可能尚未置 false，force 跳过「再点即停」分支
			if (playing && !options?.force) {
				cancelDictationPlay();
				setPlaying(false);
				return;
			}

			dictationPlayRunRef.current += 1;
			const runId = dictationPlayRunRef.current;
			stopAllEnglishPlayback();
			setPlaying(true);
			const useDictationSequence =
				mode === 'dictation' && options?.sequence === true;
			try {
				if (useDictationSequence) {
					await playDictationSequence(runId);
				} else {
					await playEnglishPreferred(answerText, { preferLocal: true });
				}
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				if (dictationPlayRunRef.current === runId) {
					setPlaying(false);
				}
			}
		},
		[answerText, cancelDictationPlay, mode, playDictationSequence, playing, t],
	);

	const playWordRef = useRef(playWord);
	playWordRef.current = playWord;

	/** 换题：停播并重置；听写作答页自动三连播，拼写/错题页不自动播 */
	useEffect(() => {
		cancelDictationPlay();
		setPlaying(false);
		setPhase('prompt');
		setInput('');
		setWrongAttemptCount(0);
		setLastWrong(null);
		setDictationSpellStepActive(false);
		setHintOpen(false);
		if (mode === 'dictation') {
			void playWordRef.current({ force: true, sequence: true });
		}
		requestAnimationFrame(() => inputRef.current?.focus());
	}, [item.key, mode, cancelDictationPlay]);

	useEffect(
		() => () => {
			cancelDictationPlay();
		},
		[cancelDictationPlay],
	);

	const completeStep = useCallback(
		(result: PracticeAttemptResult) => {
			cancelDictationPlay();
			setPlaying(false);
			onStepComplete(result);
		},
		[cancelDictationPlay, onStepComplete],
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
			wrongAttemptCount,
		],
	);

	const onNext = useCallback(() => {
		if (!lastWrong) return;
		cancelDictationPlay();
		setPlaying(false);
		completeStep(lastWrong);
	}, [cancelDictationPlay, completeStep, lastWrong]);

	/** 软揭示 → 完整揭示：仅切阶段，不 cancel，与两页共用 playing / playWord */
	const onRevealAnswer = useCallback(() => {
		setPhase('revealed');
	}, []);

	/** 答错后回到作答区重新作答（不换题、不记入结算） */
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
	}, [cancelDictationPlay, mode, playWord]);

	useEffect(() => {
		if (phase === 'soft_wrong' || phase === 'revealed') {
			inputRef.current?.blur();
		}
	}, [phase]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) return;
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

			// 听写作答页：← 与主播放钮一致（未展开提示时三连播）
			if (phase === 'prompt' && mode === 'dictation' && e.key === 'ArrowLeft') {
				e.preventDefault();
				void playWord({ sequence: !hintOpen });
				return;
			}

			if ((phase !== 'soft_wrong' && phase !== 'revealed') || !lastWrong) {
				return;
			}

			if (inField) return;

			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				void playWord();
				return;
			}

			if (phase === 'soft_wrong') {
				if (e.key === 'ArrowRight') {
					e.preventDefault();
					onRevealAnswer();
					return;
				}
				if (e.key === 'ArrowUp') {
					e.preventDefault();
					onRetryCurrent();
					return;
				}
				if (e.key === 'ArrowDown') {
					e.preventDefault();
					onNext();
				}
				return;
			}

			if (e.key === 'ArrowUp') {
				e.preventDefault();
				onRetryCurrent();
				return;
			}
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				onNext();
			}
		};

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [
		phase,
		lastWrong,
		mode,
		hintOpen,
		onNext,
		onRevealAnswer,
		onRetryCurrent,
		playWord,
	]);

	const playLabel = playing
		? t('englishLearning.tts.stop')
		: t('englishLearning.practice.playAgain');

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
							{/* 听写：DictationPromptBody；拼写：SpellingPromptBody 显示中文释义 */}
							<SessionPromptPanel
								fillHeight
								className={cn(
									mode === 'dictation' &&
										'justify-stretch overflow-hidden border-0 bg-transparent p-0 shadow-none',
									phase !== 'prompt' && 'hidden',
								)}
								aria-hidden={phase !== 'prompt'}
							>
								{/* 听写：DictationPromptBody，dictation 听写模式，spelling 拼写模式 */}
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
							{/* 软揭示：DictationSoftWrongStage */}
							<SessionPromptPanel
								fillHeight
								className={cn(
									phase !== 'soft_wrong' && 'hidden',
									'justify-stretch overflow-hidden border-0 bg-transparent p-0 shadow-none',
								)}
								aria-hidden={phase !== 'soft_wrong'}
							>
								<DictationSoftWrongStage
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
							{/* 完整揭示：RevealedPanelInner */}
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
									className="h-10 w-full transition-none"
									disabled={!input.trim()}
								>
									{t('englishLearning.practice.check')}
								</Button>
							</div>
						</div>
						<div
							className={cn(
								'grid grid-cols-2 gap-2 pt-4 transition-none',
								!showWrongActions && 'hidden',
							)}
						>
							<Button
								type="button"
								className="h-10 w-full transition-none"
								onClick={onRetryCurrent}
							>
								{t('englishLearning.practice.tryAgain')}
							</Button>
							<Button
								type="button"
								className="h-10 w-full transition-none"
								onClick={onNext}
							>
								{isLastQuestion
									? t('englishLearning.practice.viewResults')
									: t('englishLearning.practice.next')}
							</Button>
						</div>
					</form>
				</PracticeCard>
			) : null}
		</div>
	);
}
