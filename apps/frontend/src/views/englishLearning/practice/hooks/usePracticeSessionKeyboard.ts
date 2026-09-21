import { useEffect } from 'react';
import type {
	PracticeAttemptResult,
	PracticeItemPhase,
	PracticeMode,
} from '../types';
import {
	isPracticeShiftSpacePlayShortcut,
	isPracticeToggleIpaShortcut,
	isPracticeTogglePosShortcut,
} from '../utils/keyboard';
import type { PlayWordFn } from './usePracticePlayback';

export function usePracticeSessionKeyboard(args: {
	phase: PracticeItemPhase;
	mode: PracticeMode;
	hintOpen: boolean;
	/** 经典词槽：顶栏可播，作答中 Shift+空格不依赖提示开关 */
	slotBoard?: boolean;
	/** 标注就绪时可切词性/音标 */
	canToggleMeta?: boolean;
	lastWrong: PracticeAttemptResult | null;
	lastCorrect?: PracticeAttemptResult | null;
	canGoPrevious: boolean;
	playWord: PlayWordFn;
	onTogglePos?: () => void;
	onToggleIpa?: () => void;
	onRetryCurrent: () => void;
	onPreviousQuestion: () => void;
	onRevealAnswer: () => void;
	onNext: () => void;
}) {
	const {
		phase,
		mode,
		hintOpen,
		slotBoard = false,
		canToggleMeta = false,
		lastWrong,
		lastCorrect,
		canGoPrevious,
		playWord,
		onTogglePos,
		onToggleIpa,
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

			// 经典词槽：Ctrl+Shift+P / Ctrl+Shift+I（输入框内也可）
			if (slotBoard && canToggleMeta) {
				if (onTogglePos && isPracticeTogglePosShortcut(e)) {
					e.preventDefault();
					e.stopImmediatePropagation();
					onTogglePos();
					return;
				}
				if (onToggleIpa && isPracticeToggleIpaShortcut(e)) {
					e.preventDefault();
					e.stopImmediatePropagation();
					onToggleIpa();
					return;
				}
			}

			// 作答中 Shift+空格：听写始终；经典词槽始终；普通拼写仅开提示后（防泄题）
			if (phase === 'prompt' && isPracticeShiftSpacePlayShortcut(e)) {
				const canPlay =
					mode === 'dictation' ||
					slotBoard ||
					(mode === 'spelling' && hintOpen);
				if (canPlay) {
					e.preventDefault();
					// 必须停掉，否则词槽 input 仍会把空格当成「跳下一格」
					e.stopImmediatePropagation();
					void playWord(
						mode === 'dictation' ? { sequence: !hintOpen } : undefined,
					);
					return;
				}
			}

			// 全对 / 错题 / 看答案：统一 Shift+空格播放（与作答中一致，不用单独空格）
			if (
				(phase === 'correct_reveal' && lastCorrect) ||
				((phase === 'soft_wrong' || phase === 'revealed') && lastWrong)
			) {
				if (isPracticeShiftSpacePlayShortcut(e)) {
					e.preventDefault();
					e.stopImmediatePropagation();
					void playWord();
					return;
				}
			}

			// 全对中间态：左再试、上上一题、下/Enter 下一题
			if (phase === 'correct_reveal' && lastCorrect) {
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
				if (e.key === 'ArrowDown' || e.key === 'Enter') {
					e.preventDefault();
					onNext();
				}
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
		canToggleMeta,
		phase,
		lastWrong,
		lastCorrect,
		mode,
		hintOpen,
		slotBoard,
		onNext,
		onPreviousQuestion,
		onRevealAnswer,
		onRetryCurrent,
		onToggleIpa,
		onTogglePos,
		playWord,
	]);
}
