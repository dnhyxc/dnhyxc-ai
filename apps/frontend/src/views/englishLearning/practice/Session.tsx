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
import { displayIpaWrapped } from '@/utils';
import {
	isEnglishTtsSupported,
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import {
	DictationEqualizer,
	DictationPlayButton,
	DictationPlaySlot,
	DictationPromptBody,
	DictationSoftWrongHintBlock,
} from './components/dictation/DictationPrompt';
import { RevealedPanelInner, VocabWordPlayButton } from './components/reveal';
import { SessionPromptPanel } from './components/session/SessionPromptPanel';
import { SessionStageHeader } from './components/session/SessionStageHeader';
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
	const autoPlayedKeyRef = useRef<string | null>(null);
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
		async (options?: { force?: boolean }) => {
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
			try {
				if (mode === 'dictation') {
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

	useEffect(() => {
		dictationPlayRunRef.current += 1;
		setPlaying(false);
		setPhase('prompt');
		setInput('');
		setWrongAttemptCount(0);
		setLastWrong(null);
		setDictationSpellStepActive(false);
		setHintOpen(false);
		autoPlayedKeyRef.current = null;
		requestAnimationFrame(() => inputRef.current?.focus());
	}, [item.key]);

	useEffect(() => {
		if (mode !== 'dictation') return;
		if (autoPlayedKeyRef.current === item.key) return;
		autoPlayedKeyRef.current = item.key;
		void playWord();
	}, [item.key, mode, playWord]);

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
		if (lastWrong) {
			completeStep(lastWrong);
		}
	}, [completeStep, lastWrong]);

	/** 软揭示态：主动查看正确答案 */
	const onRevealAnswer = useCallback(() => {
		cancelDictationPlay();
		setPlaying(false);
		setPhase('revealed');
	}, [cancelDictationPlay]);

	/** 答错后回到作答区重新作答（不换题、不记入结算） */
	const onRetryCurrent = useCallback(() => {
		cancelDictationPlay();
		setPlaying(false);
		setLastWrong(null);
		setPhase('prompt');
		setInput('');
		setDictationSpellStepActive(false);
		if (mode === 'dictation') {
			void playWord({ force: true });
		}
		requestAnimationFrame(() => inputRef.current?.focus());
	}, [cancelDictationPlay, mode, playWord]);

	useEffect(() => {
		if ((phase !== 'soft_wrong' && phase !== 'revealed') || !lastWrong) return;

		inputRef.current?.blur();

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) return;
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

			if (phase === 'soft_wrong') {
				if (e.key === 'ArrowLeft') {
					e.preventDefault();
					void playWord();
					return;
				}
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
	const modeTitle =
		mode === 'dictation'
			? t('englishLearning.practice.modeDictation')
			: t('englishLearning.practice.modeSpelling');

	const hintContent = useMemo(() => buildPracticeHintContent(item), [item]);
	const isClassic = isPracticeClassicItem(item);

	const spellingHintIpa = hintContent.ipa?.trim();
	const spellingHintSource = hintContent.source?.trim();
	const spellingHintNote = hintContent.noteZh?.trim();

	const canHint = hasPracticeHintContent(item, mode);
	const hintButtonLabel = hintOpen
		? t('englishLearning.practice.hintHide')
		: t('englishLearning.practice.hintShow');

	const yourAnswerPrefix = t('englishLearning.practice.yourAnswer', {
		answer: '',
	});
	const correctAnswerLabel = t('englishLearning.practice.correctAnswer');
	const revealedWrongInput = lastWrong?.userInput || input.trim() || '\u00A0';

	const wordPlayButton = (
		<VocabWordPlayButton
			playing={playing}
			playAriaLabel={t('englishLearning.vocab.playWord')}
			stopAriaLabel={t('englishLearning.tts.stop')}
			onPlay={() => void playWord()}
		/>
	);

	const softWrongPlayBlock = (
		<DictationPlaySlot>
			<DictationPlayButton
				playing={playing}
				playLabel={playLabel}
				onPlay={() => void playWord()}
				size="medium"
			/>
			<DictationEqualizer playing={playing} className="h-4 w-32" />
		</DictationPlaySlot>
	);

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
					<div className="flex min-h-0 flex-1 flex-col p-4">
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
										onPlay={() => void playWord()}
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
									'items-center border-0 bg-transparent p-0 shadow-none',
								)}
								aria-hidden={phase !== 'soft_wrong'}
							>
								<div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 py-2">
									<div className="mx-auto flex h-full w-full max-w-sm flex-col items-center justify-between text-center">
										<p className="text-textcolor/80 flex w-full shrink-0 flex-wrap items-baseline justify-center gap-x-1.5 text-sm leading-snug">
											<span>{yourAnswerPrefix}</span>
											<span className="text-base font-medium text-rose-500">
												{revealedWrongInput}
											</span>
										</p>
										<div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center py-1">
											{canHint && hintOpen ? (
												mode === 'dictation' ? (
													<DictationSoftWrongHintBlock
														hintContent={hintContent}
														playing={playing}
														playLabel={playLabel}
														onPlay={() => void playWord()}
													/>
												) : (
													<div
														className="flex max-h-full w-full min-h-0 flex-col items-center gap-2"
														aria-live="polite"
													>
														{softWrongPlayBlock}
														<div className="flex w-full min-h-0 flex-col items-center gap-1 overflow-hidden text-center">
															{spellingHintIpa ? (
																<p className="w-full shrink-0 text-center font-mono text-xs leading-snug text-teal-600/90 line-clamp-1 dark:text-teal-400/90">
																	{displayIpaWrapped(spellingHintIpa)}
																</p>
															) : null}
															{spellingHintSource || spellingHintNote ? (
																<p className="text-textcolor/60 w-full shrink-0 text-center text-[11px] leading-snug italic line-clamp-2">
																	{[spellingHintSource, spellingHintNote]
																		.filter(Boolean)
																		.join(' · ')}
																</p>
															) : null}
														</div>
													</div>
												)
											) : (
												softWrongPlayBlock
											)}
										</div>
										<div className="flex w-full shrink-0 flex-col items-center gap-1">
											<p className="text-textcolor/55 mx-auto max-w-68 text-center text-[11px] leading-snug line-clamp-2">
												{t('englishLearning.practice.softWrongHint')}
											</p>
											<Button
												type="button"
												variant="link"
												className="text-teal-600 hover:text-teal-500 dark:text-teal-400 h-7 shrink-0 px-0! text-sm"
												onClick={onRevealAnswer}
											>
												{t('englishLearning.practice.showAnswer')}
											</Button>
										</div>
									</div>
								</div>
							</SessionPromptPanel>
							<SessionPromptPanel
								scrollable
								fillHeight
								className={cn(phase !== 'revealed' && 'hidden')}
								aria-hidden={phase !== 'revealed'}
							>
								<RevealedPanelInner
									yourAnswerPrefix={yourAnswerPrefix}
									wrongInput={revealedWrongInput}
									item={item}
									correctAnswerLabel={correctAnswerLabel}
									playButton={wordPlayButton}
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
