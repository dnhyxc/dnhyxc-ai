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

			// 听写答题：Shift + 空格（输入框内也可触发）
			if (
				phase === 'prompt' &&
				mode === 'dictation' &&
				isPracticeShiftSpacePlayShortcut(e)
			) {
				e.preventDefault();
				void playWord({ sequence: !hintOpen });
				return;
			}

			// 拼写答题：仅开启提示后可用 Shift+空格 / 空格播放（未开提示不播，避免泄题）
			if (phase === 'prompt' && mode === 'spelling' && hintOpen) {
				if (isPracticeShiftSpacePlayShortcut(e)) {
					e.preventDefault();
					void playWord();
					return;
				}
				if (!inField && isPracticeSpacePlayShortcut(e)) {
					e.preventDefault();
					void playWord();
					return;
				}
			}

			// 听写 / 拼写：错题与完整揭示用空格播放（非输入框焦点；与听写一致）
			if (
				(phase === 'soft_wrong' || phase === 'revealed') &&
				lastWrong &&
				!inField &&
				isPracticeSpacePlayShortcut(e)
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

		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
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
