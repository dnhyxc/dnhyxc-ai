import { Toast } from '@ui/sonner';
import { useCallback, useEffect, useState } from 'react';
import {
	isEnglishPlaybackAvailable,
	playEnglishPreferred,
	stopAllEnglishPlayback,
	warmupEnglishTtsVoices,
} from '@/utils/englishTts';

/** 电子书引用/选区朗读：复用英语学习 TTS（本机 / 云端偏好） */
export function useEbookQuoteListen(t: (key: string) => string) {
	const [playingKey, setPlayingKey] = useState<string | null>(null);

	useEffect(() => {
		warmupEnglishTtsVoices();
		return () => stopAllEnglishPlayback();
	}, []);

	const toggleListen = useCallback(
		async (text: string, key: string) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			if (playingKey === key) {
				stopAllEnglishPlayback();
				setPlayingKey(null);
				return;
			}
			if (!isEnglishPlaybackAvailable()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			stopAllEnglishPlayback();
			setPlayingKey(key);
			try {
				await playEnglishPreferred(trimmed);
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[playingKey, t],
	);

	const listenLabel = useCallback(
		(key: string, defaultLabel: string) =>
			playingKey === key ? t('englishLearning.tts.stop') : defaultLabel,
		[playingKey, t],
	);

	return { toggleListen, playingKey, listenLabel };
}
