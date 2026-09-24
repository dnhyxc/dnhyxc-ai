import { useEffect } from 'react';
import {
	isPracticeShiftSpacePlayShortcut,
	isPracticeSpacePlayShortcut,
	isPracticeToggleIpaShortcut,
	isPracticeTogglePosShortcut,
} from '../../practice/utils/keyboard';
import type { DailyCardStep } from '../types';

function isKeyboardTargetInField(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el) return false;
	const tag = el.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
	if (el.isContentEditable) return true;
	return Boolean(el.closest('[contenteditable="true"]'));
}

export type DailySessionKeyboardArgs = {
	step: DailyCardStep;
	submitting?: boolean;
	/** 听写/看中写词槽：Shift+空格播报、Ctrl+Shift+P/I 切换词性/音标 */
	spellBoard?: boolean;
	canToggleMeta?: boolean;
	playWord: (options?: { force?: boolean }) => Promise<void>;
	onStartQuiz: () => void;
	onContinue: () => void | Promise<void>;
	onTogglePos?: () => void;
	onToggleIpa?: () => void;
};

export function useDailySessionKeyboard(args: DailySessionKeyboardArgs) {
	const {
		step,
		submitting = false,
		spellBoard = false,
		canToggleMeta = false,
		playWord,
		onStartQuiz,
		onContinue,
		onTogglePos,
		onToggleIpa,
	} = args;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) return;
			const inField = isKeyboardTargetInField(e.target);

			if (
				spellBoard &&
				step === 'quiz' &&
				isPracticeShiftSpacePlayShortcut(e)
			) {
				e.preventDefault();
				void playWord();
				return;
			}

			if (isPracticeSpacePlayShortcut(e) && !inField) {
				if (step === 'study' || step === 'quiz' || step === 'feedback') {
					e.preventDefault();
					void playWord();
				}
				return;
			}

			if (
				spellBoard &&
				step === 'quiz' &&
				canToggleMeta &&
				isPracticeTogglePosShortcut(e)
			) {
				e.preventDefault();
				onTogglePos?.();
				return;
			}

			if (
				spellBoard &&
				step === 'quiz' &&
				canToggleMeta &&
				isPracticeToggleIpaShortcut(e)
			) {
				e.preventDefault();
				onToggleIpa?.();
				return;
			}

			if (
				e.key === 'Enter' &&
				!e.shiftKey &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				!inField &&
				step === 'study'
			) {
				e.preventDefault();
				onStartQuiz();
				return;
			}

			if (
				e.key === 'ArrowDown' &&
				!e.shiftKey &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				!inField &&
				step === 'feedback' &&
				!submitting
			) {
				e.preventDefault();
				void onContinue();
			}
		};

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [
		canToggleMeta,
		onContinue,
		onStartQuiz,
		onToggleIpa,
		onTogglePos,
		playWord,
		spellBoard,
		step,
		submitting,
	]);
}
