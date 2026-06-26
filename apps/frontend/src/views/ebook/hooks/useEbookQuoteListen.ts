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
	clearActiveListenHighlight,
	clearEpubListenSegmentOverlay,
	getEpubListenSessionPlain,
	invokeStopChapterListen,
	registerQuoteListenStop,
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
		registerQuoteListenStop(() => {
			stopAllEnglishPlayback();
			clearEpubListenSegmentOverlay();
			setPlayingKey(null);
		});
		return () => {
			registerQuoteListenStop(null);
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
			invokeStopChapterListen();
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
			const { plain, selectionRange } = resolveEpubListenPlain(
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

			const speakPlain = getEpubListenSessionPlain() ?? plain;

			try {
				await playEnglishPreferred(speakPlain, {
					onCadenceChunk: (event) => {
						if (!rend) return;
						if (event.phase === 'end') {
							if (event.isLastInSentence) {
								clearActiveListenHighlight(rend);
							}
							return;
						}
						showEpubListenPlainSpan(
							event.sentencePlainStart,
							event.sentencePlainEnd,
							event.sentenceIndex,
						);
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
