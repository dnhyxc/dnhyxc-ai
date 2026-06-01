import { useEffect } from 'react';
import type {
	PracticeAttemptResult,
	PracticeItemPhase,
	PracticeMode,
} from '../types';
import {
	isPracticeShiftSpacePlayShortcut,
	isPracticeSpacePlayShortcut,
} from '../utils/keyboard';
import type { PlayWordFn } from './usePracticePlayback';

export function usePracticeSessionKeyboard(args: {
	phase: PracticeItemPhase;
	mode: PracticeMode;
	hintOpen: boolean;
	lastWrong: PracticeAttemptResult | null;
	canGoPrevious: boolean;
	playWord: PlayWordFn;
	onRetryCurrent: () => void;
	onPreviousQuestion: () => void;
	onRevealAnswer: () => void;
	onNext: () => void;
}) {
	const {
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
	} = args;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) return;
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

			// 听写作答页：Shift + 空格（输入框内也响应）
			if (phase === 'prompt' && isPracticeShiftSpacePlayShortcut(e)) {
				if (mode === 'dictation') {
					e.preventDefault();
					void playWord({ sequence: !hintOpen });
					return;
				}
				if (mode === 'spelling') {
					e.preventDefault();
					void playWord();
					return;
				}
			}

			// 听写错题 / 完整揭示：空格（非输入框焦点）
			if (
				mode === 'dictation' &&
				(phase === 'soft_wrong' || phase === 'revealed') &&
				lastWrong &&
				!inField &&
				isPracticeSpacePlayShortcut(e)
			) {
				e.preventDefault();
				void playWord();
				return;
			}

			// 拼写错题 / 揭示：仍用 Shift + 空格
			if (
				mode === 'spelling' &&
				(phase === 'soft_wrong' || phase === 'revealed') &&
				lastWrong &&
				isPracticeShiftSpacePlayShortcut(e)
			) {
				e.preventDefault();
				void playWord();
				return;
			}

			if ((phase !== 'soft_wrong' && phase !== 'revealed') || !lastWrong) {
				return;
			}

			if (inField) return;

			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				onRetryCurrent();
				return;
			}

			if (e.key === 'ArrowUp' && canGoPrevious) {
				e.preventDefault();
				onPreviousQuestion();
				return;
			}

			if (phase === 'soft_wrong' && e.key === 'ArrowRight') {
				e.preventDefault();
				onRevealAnswer();
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
		canGoPrevious,
		phase,
		lastWrong,
		mode,
		hintOpen,
		onNext,
		onPreviousQuestion,
		onRevealAnswer,
		onRetryCurrent,
		playWord,
	]);
}
