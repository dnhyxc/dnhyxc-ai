import { Toast } from '@ui/index';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	isPlaybackAvailable,
	playPreferred,
	prefetchCloudTts,
	stopAllPlayback,
	type TtsSentencePrefetch,
} from '@/utils/speech';
import { DICTATION_PLAY_COUNT, DICTATION_PLAY_GAP_MS } from '../constants';
import type { PracticeMode } from '../types';

function sleepMs(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

export type PlayWordOptions = {
	/** 跳过「再点即停」，用于换题/再试后立刻开播 */
	force?: boolean;
	/** 听写三连播（进题自动播放、主播放钮未展开提示时） */
	sequence?: boolean;
};

export type PlayWordFn = (options?: PlayWordOptions) => Promise<void>;

/**
 * usePracticePlayback
 * 当前句预取 + 出声后 kick 滑动窗口管道（后续题分批预取）。
 */
export function usePracticePlayback(args: {
	mode: PracticeMode;
	answerText: string;
	/** 当前题在本场 queue 中的下标 */
	itemIndex: number;
	/** 出声后 / 拼写延迟：通知父级 Pipe.kick(cursor) */
	onPipelineKick?: (cursorIndex: number) => void;
	t: (key: string) => string;
}) {
	const { mode, answerText, itemIndex, onPipelineKick, t } = args;
	const [playing, setPlaying] = useState(false);
	const dictationPlayRunRef = useRef(0);
	const prefetchedCloudRef = useRef<Promise<TtsSentencePrefetch> | null>(null);
	const itemIndexRef = useRef(itemIndex);
	itemIndexRef.current = itemIndex;
	const onPipelineKickRef = useRef(onPipelineKick);
	onPipelineKickRef.current = onPipelineKick;

	const kickPipeline = useCallback(() => {
		onPipelineKickRef.current?.(itemIndexRef.current);
	}, []);

	// 进题 / 换句：只预取当前句；后续由 Pipe 在出声后补窗
	useEffect(() => {
		const text = answerText.trim();
		if (!text) {
			prefetchedCloudRef.current = null;
			return;
		}
		prefetchedCloudRef.current = prefetchCloudTts(text, { whole: true });
		// 拼写无自动播：短暂延迟后再 kick，避免与当前句首包抢带宽
		if (mode !== 'dictation') {
			const timer = window.setTimeout(() => kickPipeline(), 300);
			return () => window.clearTimeout(timer);
		}
	}, [answerText, mode, kickPipeline]);

	const cancelDictationPlay = useCallback(() => {
		dictationPlayRunRef.current += 1;
		stopAllPlayback();
	}, []);

	const playDictationSequence = useCallback(
		async (runId: number) => {
			for (let i = 0; i < DICTATION_PLAY_COUNT; i += 1) {
				if (dictationPlayRunRef.current !== runId) return;
				await playPreferred(answerText, {
					cloudSingleUtterance: true,
					prefetchedCloud: i === 0 ? prefetchedCloudRef.current : null,
					onPlaybackStart: i === 0 ? kickPipeline : undefined,
				});
				if (dictationPlayRunRef.current !== runId) return;
				if (i < DICTATION_PLAY_COUNT - 1) {
					await sleepMs(DICTATION_PLAY_GAP_MS);
				}
			}
		},
		[answerText, kickPipeline],
	);

	const playWord = useCallback<PlayWordFn>(
		async (options) => {
			if (!isPlaybackAvailable()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			if (playing && !options?.force) {
				cancelDictationPlay();
				setPlaying(false);
				return;
			}

			dictationPlayRunRef.current += 1;
			const runId = dictationPlayRunRef.current;
			stopAllPlayback();
			setPlaying(true);

			const useDictationSequence =
				mode === 'dictation' && options?.sequence === true;

			try {
				if (useDictationSequence) {
					await playDictationSequence(runId);
				} else {
					await playPreferred(answerText, {
						cloudSingleUtterance: true,
						prefetchedCloud: prefetchedCloudRef.current,
						onPlaybackStart: kickPipeline,
					});
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
		[
			answerText,
			cancelDictationPlay,
			kickPipeline,
			mode,
			playDictationSequence,
			playing,
			t,
		],
	);

	const playWordRef = useRef(playWord);
	playWordRef.current = playWord;

	useEffect(
		() => () => {
			cancelDictationPlay();
		},
		[cancelDictationPlay],
	);

	const playLabel = playing
		? t('englishLearning.tts.stop')
		: t('englishLearning.practice.playAgain');

	return {
		playing,
		setPlaying,
		playLabel,
		playWord,
		playWordRef,
		cancelDictationPlay,
	};
}
