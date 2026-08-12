import { Toast } from '@ui/index';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	isPlaybackAvailable,
	playPreferred,
	stopAllPlayback,
} from '@/utils/speech';

type PlayOptions = { force?: boolean };

export function useDailyPlayback(args: {
	word: string;
	t: (key: string) => string;
}) {
	const { word, t } = args;
	const [playing, setPlaying] = useState(false);
	const playRunRef = useRef(0);

	const cancelPlay = useCallback(() => {
		playRunRef.current += 1;
		stopAllPlayback();
	}, []);

	useEffect(() => {
		return () => {
			cancelPlay();
		};
	}, [cancelPlay]);

	const playWord = useCallback(
		async (options?: PlayOptions) => {
			if (!word.trim()) return;
			if (!isPlaybackAvailable()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			if (playing && !options?.force) {
				cancelPlay();
				setPlaying(false);
				return;
			}

			playRunRef.current += 1;
			const runId = playRunRef.current;
			stopAllPlayback();
			setPlaying(true);
			try {
				await playPreferred(word);
			} finally {
				if (playRunRef.current === runId) {
					setPlaying(false);
				}
			}
		},
		[cancelPlay, playing, t, word],
	);

	const playLabel = playing
		? t('englishLearning.tts.stop')
		: t('englishLearning.vocab.playWord');

	return { playing, playWord, playLabel };
}
