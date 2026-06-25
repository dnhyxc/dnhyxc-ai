import { Toast } from '@ui/sonner';
import type { Rendition } from 'epubjs';
import { useCallback, useEffect, useState } from 'react';
import {
	isEnglishPlaybackAvailable,
	playEnglishPreferred,
	stopAllEnglishPlayback,
	stripMarkdownForTts,
	warmupEnglishTtsVoices,
} from '@/utils/englishTts';
import {
	beginEpubListenOverlaySession,
	clearEpubListenSegmentOverlay,
	clearEpubListenSentenceOverlay,
	showEpubListenSentence,
} from '../utils/epubListenSegmentOverlay';

/** 电子书引用/选区朗读：复用英语学习 TTS（本机 / 云端偏好） */
export function useEbookQuoteListen(
	t: (key: string) => string,
	getRendition?: () => Rendition | null,
) {
	const [playingKey, setPlayingKey] = useState<string | null>(null);

	useEffect(() => {
		warmupEnglishTtsVoices();
		return () => {
			stopAllEnglishPlayback();
			clearEpubListenSegmentOverlay();
		};
	}, []);

	const toggleListen = useCallback(
		async (text: string, key: string, cfiRange?: string) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			if (playingKey === key) {
				stopAllEnglishPlayback();
				clearEpubListenSegmentOverlay();
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
			clearEpubListenSegmentOverlay();
			setPlayingKey(key);

			const rend = getRendition?.() ?? null;
			const cfi = cfiRange?.trim();
			const plain = stripMarkdownForTts(trimmed);
			if (rend && cfi && plain) {
				beginEpubListenOverlaySession(rend, cfi, plain);
			}

			try {
				await playEnglishPreferred(trimmed, {
					onCadenceChunk: (event) => {
						if (!rend || !cfi) return;
						if (event.phase === 'start') {
							showEpubListenSentence(event.sentenceIndex);
							return;
						}
						if (event.isLastInSentence) {
							clearEpubListenSentenceOverlay();
						}
					},
				});
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				clearEpubListenSegmentOverlay();
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[getRendition, playingKey, t],
	);

	const listenLabel = useCallback(
		(key: string, defaultLabel: string) =>
			playingKey === key ? t('englishLearning.tts.stop') : defaultLabel,
		[playingKey, t],
	);

	return { toggleListen, playingKey, listenLabel };
}
