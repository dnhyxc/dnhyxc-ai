import { Toast } from '@ui/sonner';
import type { Rendition } from 'epubjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	applyActiveEnglishPlaybackRate,
	buildSentenceOffsetSpans,
	isEnglishPlaybackAvailable,
	pauseEnglishPlaybackSoft,
	primeEnglishPlaybackForUserGesture,
	registerEnglishPlaybackMediaHandlers,
	resumeEnglishPlaybackSoft,
	stopAllEnglishPlayback,
	stripMarkdownForTts,
	warmupEnglishTtsVoices,
} from '@/utils/englishTts';
import {
	buildParagraphUnits,
	type ParagraphUnit,
} from '../utils/epub/listen/epubListenParagraphs';
import { playListenUnitsFromCursor } from '../utils/epub/listen/epubListenPlayUnits';
import {
	beginEpubListenOverlaySession,
	clearActiveListenHighlight,
	clearEpubListenSegmentOverlay,
	getEpubListenSessionMeta,
	getEpubListenSessionPlain,
	invokeStopChapterListen,
	registerQuoteListenStop,
	resolveEpubListenPlain,
	showEpubListenPlainSpan,
} from '../utils/epub/listen/epubListenSegmentOverlay';
import type { ChapterListenStatus } from './useEpubChapterListen';

type QuoteListenState = {
	status: ChapterListenStatus;
	spineIndex: number;
	sentenceIndex: number;
	sentenceCount: number;
	sentenceLabels: string[];
	rate: number;
};

const IDLE_STATE: QuoteListenState = {
	status: 'idle',
	spineIndex: -1,
	sentenceIndex: 0,
	sentenceCount: 0,
	sentenceLabels: [],
	rate: 1,
};

function buildLabelsFromPlain(plain: string): string[] {
	const trimmed = plain.trim();
	if (!trimmed) return [];
	return buildSentenceOffsetSpans(trimmed).map(({ start, end }) => {
		const label = stripMarkdownForTts(trimmed.slice(start, end)).trim();
		return label || '…';
	});
}

/** 电子书引用/选区朗读：复用英语学习 TTS，并与听书共用底部播放条 */
export function useEbookQuoteListen(
	t: (key: string) => string,
	getRendition?: () => Rendition | null,
	onListenSessionEnd?: () => void,
	getSpineIndex?: () => number | undefined,
) {
	const [state, setState] = useState<QuoteListenState>(IDLE_STATE);
	const [playingKey, setPlayingKey] = useState<string | null>(null);

	const stateRef = useRef(state);
	stateRef.current = state;
	const tRef = useRef(t);
	tRef.current = t;
	const getRenditionRef = useRef(getRendition);
	getRenditionRef.current = getRendition;
	const getSpineIndexRef = useRef(getSpineIndex);
	getSpineIndexRef.current = getSpineIndex;
	const onSessionEndRef = useRef(onListenSessionEnd);
	onSessionEndRef.current = onListenSessionEnd;

	const loopGenRef = useRef(0);
	const pausedRef = useRef(false);
	const rateRef = useRef(1);
	const sentenceCursorRef = useRef(0);
	const playingKeyRef = useRef<string | null>(null);
	const fallbackPlainRef = useRef('');
	const paragraphsRef = useRef<ParagraphUnit[]>([]);
	const sentencesRef = useRef<Array<{ start: number; end: number }>>([]);

	const syncState = useCallback((patch: Partial<QuoteListenState>) => {
		setState((prev) => {
			const next = { ...prev, ...patch };
			stateRef.current = next;
			return next;
		});
	}, []);

	const stopInternal = useCallback((opts?: { notify?: boolean }) => {
		loopGenRef.current += 1;
		pausedRef.current = false;
		playingKeyRef.current = null;
		fallbackPlainRef.current = '';
		paragraphsRef.current = [];
		sentencesRef.current = [];
		stopAllEnglishPlayback();
		// 同步卸 Media Session，勿等 isActive effect：否则 macOS 仍残留进度条/控件
		registerEnglishPlaybackMediaHandlers(null);
		clearEpubListenSegmentOverlay();
		setPlayingKey(null);
		const idle = { ...IDLE_STATE, rate: rateRef.current };
		setState(idle);
		stateRef.current = idle;
		if (opts?.notify !== false) onSessionEndRef.current?.();
	}, []);

	useEffect(() => {
		warmupEnglishTtsVoices();
		registerQuoteListenStop(() => stopInternal({ notify: false }));
		return () => {
			registerQuoteListenStop(null);
			stopInternal({ notify: false });
		};
	}, [stopInternal]);

	const isGenActive = (gen: number) => gen === loopGenRef.current;

	/** 从当前句起播：首句逐句快出声，同段剩余与后续按段预取/合成 */
	const playFromCursor = useCallback(
		async (gen: number): Promise<boolean> => {
			const rend = getRenditionRef.current?.() ?? null;
			const meta = getEpubListenSessionMeta();
			const plain = meta?.plain ?? fallbackPlainRef.current;
			const sentences =
				sentencesRef.current.length > 0
					? sentencesRef.current
					: buildSentenceOffsetSpans(plain.trim());
			const units =
				paragraphsRef.current.length > 0
					? paragraphsRef.current
					: buildParagraphUnits(plain.trim(), sentences);
			const sentenceCount = sentences.length;

			if (!plain.trim() || sentenceCount <= 0 || units.length === 0) {
				return false;
			}

			sentencesRef.current = sentences;
			paragraphsRef.current = units;

			try {
				return await playListenUnitsFromCursor({
					plain,
					sentences,
					units,
					startSi: sentenceCursorRef.current,
					getRate: () => rateRef.current,
					isActive: () => isGenActive(gen) && !pausedRef.current,
					onSentence: (globalSi) => {
						sentenceCursorRef.current = globalSi;
						syncState({
							status: 'playing',
							sentenceIndex: globalSi,
							sentenceCount,
						});
						if (rend) showEpubListenPlainSpan(0, 0, globalSi);
					},
					onUnitIdle: () => {
						if (rend) clearActiveListenHighlight(rend);
					},
					onAwaitingCurrentTts: (waiting) => {
						if (!isGenActive(gen) || pausedRef.current) return;
						syncState({ status: waiting ? 'loading' : 'playing' });
					},
				});
			} catch (err) {
				if (
					isGenActive(gen) &&
					!(err as { cloudTtsNotified?: boolean }).cloudTtsNotified
				) {
					Toast({
						type: 'warning',
						title: tRef.current('englishLearning.tts.unsupported'),
					});
				}
				return false;
			}
		},
		[syncState],
	);

	const startPlayback = useCallback(
		async (
			text: string,
			key: string,
			cfiRange?: string,
			frozenRange?: Range | null,
		) => {
			const trimmed = text.trim();
			if (!trimmed) return;

			invokeStopChapterListen();
			if (!isEnglishPlaybackAvailable()) {
				Toast({
					type: 'warning',
					title: tRef.current('englishLearning.tts.unsupported'),
				});
				return;
			}

			primeEnglishPlaybackForUserGesture();
			stopAllEnglishPlayback();
			clearEpubListenSegmentOverlay();

			const rend = getRenditionRef.current?.() ?? null;
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
			if (!speakPlain.trim()) return;

			fallbackPlainRef.current = speakPlain;
			const sentences = buildSentenceOffsetSpans(speakPlain.trim());
			sentencesRef.current = sentences;
			paragraphsRef.current = buildParagraphUnits(speakPlain.trim(), sentences);

			const meta = getEpubListenSessionMeta();
			const labels = meta?.sentenceLabels ?? buildLabelsFromPlain(speakPlain);
			const sentenceCount = meta?.sentenceCount ?? labels.length;

			const gen = ++loopGenRef.current;
			pausedRef.current = false;
			sentenceCursorRef.current = 0;
			playingKeyRef.current = key;
			setPlayingKey(key);

			const spineIndex = getSpineIndexRef.current?.() ?? -1;
			syncState({
				status: 'loading',
				spineIndex,
				sentenceIndex: 0,
				sentenceCount,
				sentenceLabels: labels,
				rate: rateRef.current,
			});

			const finished = await playFromCursor(gen);
			if (finished && isGenActive(gen)) {
				stopInternal();
			} else if (!pausedRef.current && isGenActive(gen)) {
				stopInternal();
			}
		},
		[playFromCursor, stopInternal, syncState],
	);

	const toggleListen = useCallback(
		async (
			text: string,
			key: string,
			cfiRange?: string,
			frozenRange?: Range | null,
		) => {
			if (playingKeyRef.current === key && stateRef.current.status !== 'idle') {
				stopInternal();
				return;
			}
			await startPlayback(text, key, cfiRange, frozenRange);
		},
		[startPlayback, stopInternal],
	);

	const pause = useCallback(() => {
		const status = stateRef.current.status;
		if (status !== 'playing' && status !== 'loading') return;
		pausedRef.current = true;
		pauseEnglishPlaybackSoft();
		syncState({ status: 'paused' });
	}, [syncState]);

	const resume = useCallback(() => {
		if (stateRef.current.status !== 'paused') return;
		pausedRef.current = false;
		if (resumeEnglishPlaybackSoft()) {
			syncState({ status: 'playing' });
			return;
		}
		const gen = ++loopGenRef.current;
		syncState({ status: 'loading' });
		void playFromCursor(gen).then((finished) => {
			if (finished && isGenActive(gen)) stopInternal();
			else if (!pausedRef.current && isGenActive(gen)) stopInternal();
		});
	}, [playFromCursor, stopInternal, syncState]);

	const pauseRef = useRef(pause);
	pauseRef.current = pause;
	const resumeRef = useRef(resume);
	resumeRef.current = resume;

	const stop = useCallback(() => {
		stopInternal();
	}, [stopInternal]);

	const goToSentence = useCallback(
		(index: number) => {
			const count = stateRef.current.sentenceCount;
			if (count <= 0) return;
			const next = Math.min(count - 1, Math.max(0, index));
			sentenceCursorRef.current = next;
			loopGenRef.current += 1;
			stopAllEnglishPlayback();
			pausedRef.current = false;
			const gen = loopGenRef.current;
			syncState({ sentenceIndex: next, status: 'playing' });
			void playFromCursor(gen).then((finished) => {
				if (finished && isGenActive(gen)) stopInternal();
				else if (!pausedRef.current && isGenActive(gen)) stopInternal();
			});
		},
		[playFromCursor, stopInternal, syncState],
	);

	const seekSentence = useCallback(
		(delta: -1 | 1) => {
			goToSentence(sentenceCursorRef.current + delta);
		},
		[goToSentence],
	);

	const setRate = useCallback(
		(rate: number) => {
			rateRef.current = rate;
			applyActiveEnglishPlaybackRate(rate);
			syncState({ rate });
		},
		[syncState],
	);

	const togglePlay = useCallback(() => {
		const status = stateRef.current.status;
		if (status === 'playing' || status === 'loading') {
			pause();
			return;
		}
		if (status === 'paused') {
			resume();
		}
	}, [pause, resume]);

	const listenLabel = useCallback(
		(key: string, defaultLabel: string) =>
			playingKey === key ? t('englishLearning.tts.stop') : defaultLabel,
		[playingKey, t],
	);

	const isActive =
		state.status === 'loading' ||
		state.status === 'playing' ||
		state.status === 'paused';

	useEffect(() => {
		if (!isActive) return;
		registerEnglishPlaybackMediaHandlers({
			play: () => resumeRef.current(),
			pause: () => pauseRef.current(),
		});
		return () => registerEnglishPlaybackMediaHandlers(null);
	}, [isActive]);

	return {
		...state,
		isActive,
		toggleListen,
		playingKey,
		listenLabel,
		togglePlay,
		pause,
		resume,
		stop,
		prevSentence: () => seekSentence(-1),
		nextSentence: () => seekSentence(1),
		goToSentence,
		setRate,
	};
}
