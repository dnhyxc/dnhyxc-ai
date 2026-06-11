import { Toast } from '@ui/index';
import { useCallback, useEffect, useState } from 'react';
import {
	isEnglishPlaybackAvailable,
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';

type PlayOptions = { force?: boolean };

export function useDailyPlayback(args: {
	word: string;
	t: (key: string) => string;
}) {
	const { word, t } = args;
	const [playing, setPlaying] = useState(false);

	useEffect(() => {
		return () => {
			stopAllEnglishPlayback();
		};
	}, []);

	const playWord = useCallback(
		async (options?: PlayOptions) => {
			if (!word.trim()) return;
			if (!isEnglishPlaybackAvailable()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			if (playing && !options?.force) {
				stopAllEnglishPlayback();
				setPlaying(false);
				return;
			}
			stopAllEnglishPlayback();
			setPlaying(true);
			try {
				await playEnglishPreferred(word);
			} finally {
				setPlaying(false);
			}
		},
		[playing, t, word],
	);

	const playLabel = playing
		? t('englishLearning.tts.stop')
		: t('englishLearning.vocab.playWord');

	return { playing, playWord, playLabel };
}
