import { useEffect } from 'react';
import { isPracticeSpacePlayShortcut } from '../../practice/utils/keyboard';
import type { DailyCardStep } from '../types';

function isKeyboardTargetInField(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el) return false;
	const tag = el.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
	if (el.isContentEditable) return true;
	return Boolean(el.closest('[contenteditable="true"]'));
}

export function useDailySessionKeyboard(args: {
	step: DailyCardStep;
	submitting?: boolean;
	playWord: (options?: { force?: boolean }) => Promise<void>;
	onStartQuiz: () => void;
	onContinue: () => void | Promise<void>;
}) {
	const { step, submitting = false, playWord, onStartQuiz, onContinue } = args;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) return;
			const inField = isKeyboardTargetInField(e.target);

			if (isPracticeSpacePlayShortcut(e) && !inField) {
				if (step === 'study' || step === 'quiz' || step === 'feedback') {
					e.preventDefault();
					void playWord(step === 'quiz' ? { force: true } : undefined);
				}
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
	}, [step, submitting, playWord, onStartQuiz, onContinue]);
}
