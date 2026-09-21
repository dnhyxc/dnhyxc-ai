import { useEffect } from 'react';
import type { PracticeMode } from '../types';
import type { PlayWordFn } from './usePracticePlayback';

/** 换题：停播并重置单题状态；听写作答页自动三连播 */
export function usePracticeItemReset(args: {
	itemKey: string;
	mode: PracticeMode;
	cancelDictationPlay: () => void;
	setPlaying: (playing: boolean) => void;
	resetState: () => void;
	playWordRef: { current: PlayWordFn };
	/** 整词输入框；词槽模式可不传（由词槽自行聚焦） */
	inputRef?: { current: HTMLInputElement | null };
}) {
	const {
		itemKey,
		mode,
		cancelDictationPlay,
		setPlaying,
		resetState,
		playWordRef,
		inputRef,
	} = args;

	useEffect(() => {
		cancelDictationPlay();
		setPlaying(false);
		resetState();
		if (mode === 'dictation') {
			void playWordRef.current({ force: true, sequence: true });
		}
		requestAnimationFrame(() => inputRef?.current?.focus());
	}, [
		itemKey,
		mode,
		cancelDictationPlay,
		setPlaying,
		resetState,
		playWordRef,
		inputRef,
	]);
}
