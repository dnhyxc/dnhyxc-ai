import { Toast } from '@ui/sonner';
import type { Rendition } from 'epubjs';
import { useCallback, useEffect, useState } from 'react';
import {
	isEnglishPlaybackAvailable,
	playEnglishPreferred,
	stopAllEnglishPlayback,
	warmupEnglishTtsVoices,
} from '@/utils/englishTts';
import {
	beginEpubListenOverlaySession,
	clearEpubListenSegmentOverlay,
	clearEpubListenSentenceOverlay,
	resolveEpubListenPlain,
	showEpubListenPlainSpan,
} from '../utils/epubListenSegmentOverlay';

/** 电子书引用/选区朗读：复用英语学习 TTS（本机 / 云端偏好） */
export function useEbookQuoteListen(
	t: (key: string) => string,
	getRendition?: () => Rendition | null,
	onListenSessionEnd?: () => void,
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
		async (
			text: string,
			key: string,
			cfiRange?: string,
			frozenRange?: Range | null,
		) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			if (playingKey === key) {
				stopAllEnglishPlayback();
				clearEpubListenSegmentOverlay();
				onListenSessionEnd?.();
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
			const cfi = cfiRange?.trim() ?? '';
			const { plain, selectionRange, spokenRaw } = resolveEpubListenPlain(
				rend,
				trimmed,
				frozenRange,
			);

			if (rend && plain) {
				beginEpubListenOverlaySession(rend, plain, {
					cfi,
					selectionRange,
				});
			}

			try {
				await playEnglishPreferred(spokenRaw, {
					onCadenceChunk: (event) => {
						if (!rend) return;
						if (event.phase === 'start') {
							showEpubListenPlainSpan(
								event.sentencePlainStart,
								event.sentencePlainEnd,
							);
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
				onListenSessionEnd?.();
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[getRendition, onListenSessionEnd, playingKey, t],
	);

	const listenLabel = useCallback(
		(key: string, defaultLabel: string) =>
			playingKey === key ? t('englishLearning.tts.stop') : defaultLabel,
		[playingKey, t],
	);

	return { toggleListen, playingKey, listenLabel };
}
