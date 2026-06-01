import { Toast } from '@ui/index';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	isEnglishTtsSupported,
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
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
 * 说明：封装练习阶段的 TTS 播放状态与播放控制逻辑，含听写模式三连播策略。
 * 1. 暴露 playing 播放态、副作用停止方法、playWord 主调用方法等。
 * 2. 保证异步播放可被主动终止（如用户再试、换题、点击暂停等）。
 * 3. 播放/暂停按钮文案自动随状态切换。
 */
export function usePracticePlayback(args: {
	mode: PracticeMode;
	answerText: string;
	t: (key: string) => string;
}) {
	const { mode, answerText, t } = args;
	const [playing, setPlaying] = useState(false);
	// 用于保证多轮异步播放时，若 runId 变化则中止后续音频
	const dictationPlayRunRef = useRef(0);

	/**
	 * 主动取消当前所有 English TTS 播放，并递增 runId 阻断异步流
	 */
	const cancelDictationPlay = useCallback(() => {
		dictationPlayRunRef.current += 1;
		stopAllEnglishPlayback();
	}, []);

	/**
	 * 听写模式三连播（带停顿），异步递归，runId 变化自动中止
	 * @param runId 当前播放 id，仅最新 runId 有效
	 */
	const playDictationSequence = useCallback(
		async (runId: number) => {
			for (let i = 0; i < DICTATION_PLAY_COUNT; i += 1) {
				// 若 runId 早于当前，立即中断
				if (dictationPlayRunRef.current !== runId) return;
				await playEnglishPreferred(answerText, { preferLocal: true });
				if (dictationPlayRunRef.current !== runId) return;
				// 非最后一次播放则等待间隔
				if (i < DICTATION_PLAY_COUNT - 1) {
					await sleepMs(DICTATION_PLAY_GAP_MS);
				}
			}
		},
		[answerText],
	);

	/**
	 * 练习主播报方法，根据模式/参数智能切为单次或三连播（dictation sequence），
	 * 并处理兼容性警告与状态切换
	 */
	const playWord = useCallback<PlayWordFn>(
		async (options) => {
			// 检查 TTS 支持，若不支持弹 warning
			if (!isEnglishTtsSupported()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			// 若当前正在播放，默认点击会暂停（force=true 时无视当前播放，直接重播）
			if (playing && !options?.force) {
				cancelDictationPlay();
				setPlaying(false);
				return;
			}

			dictationPlayRunRef.current += 1;
			const runId = dictationPlayRunRef.current;
			stopAllEnglishPlayback(); // 先停止所有 English 播放（防串音）
			setPlaying(true); // 标记当前为播放态

			// dictation 听写模式三连播：仅在 mode=“dictation” 且 sequence 明确 true
			const useDictationSequence =
				mode === 'dictation' && options?.sequence === true;

			try {
				if (useDictationSequence) {
					await playDictationSequence(runId);
				} else {
					await playEnglishPreferred(answerText, { preferLocal: true });
				}
			} catch {
				// 支持突然变不可用、或系统错误
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				// 若 runId 没变，则恢复为“未播放”状态
				if (dictationPlayRunRef.current === runId) {
					setPlaying(false);
				}
			}
		},
		[answerText, cancelDictationPlay, mode, playDictationSequence, playing, t],
	);

	// 提供最新 playWord 实例的 ref（便于传递与外部引用使用）
	const playWordRef = useRef(playWord);
	playWordRef.current = playWord;

	// 组件卸载时自动取消朗读
	useEffect(
		() => () => {
			cancelDictationPlay();
		},
		[cancelDictationPlay],
	);

	// 动态切换按钮文案：播时为“停止”，未播为“再听一遍”
	const playLabel = playing
		? t('englishLearning.tts.stop')
		: t('englishLearning.practice.playAgain');

	return {
		playing, // 播放状态
		setPlaying, // 可手动变更播放态（如需要自定义控制）
		playLabel, // 当前按钮文案
		playWord, // 主播报方法（带三连播/暂停逻辑）
		playWordRef, // playWord 最新引用
		cancelDictationPlay, // 强行中止播放
	};
}
