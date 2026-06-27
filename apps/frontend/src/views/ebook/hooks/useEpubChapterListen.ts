import { Toast } from '@ui/sonner';
import type { Rendition } from 'epubjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	applyActiveEnglishPlaybackRate,
	buildSentenceOffsetSpans,
	isEnglishPlaybackAvailable,
	playEnglishPreferred,
	primeEnglishPlaybackForUserGesture,
	stopAllEnglishPlayback,
	stripMarkdownForTts,
	warmupEnglishTtsVoices,
} from '@/utils/englishTts';
import {
	clearChapterListenSentenceHighlight,
	extractVisibleListenSection,
	indexChapterSentenceRanges,
	resolveListenStartSentence,
	showChapterListenSentenceHighlight,
	teardownChapterListenHighlight,
	waitForNextSection,
	waitForRelocated,
} from '../utils/epubListenChapter';
import {
	beginChapterListenAutoFollow,
	clearEpubListenSegmentOverlay,
	invokeStopQuoteListen,
	registerChapterListenStop,
} from '../utils/epubListenSegmentOverlay';

export type ChapterListenStatus = 'idle' | 'loading' | 'playing' | 'paused';

export const CHAPTER_LISTEN_RATES = [
	0.75, 1, 1.25, 1.5, 1.8, 2, 2.25, 2.5, 2.8, 3,
] as const;

type ChapterListenState = {
	status: ChapterListenStatus;
	spineIndex: number;
	sentenceIndex: number;
	sentenceCount: number;
	sentenceLabels: string[];
	rate: number;
};

const IDLE_STATE: ChapterListenState = {
	status: 'idle',
	spineIndex: -1,
	sentenceIndex: 0,
	sentenceCount: 0,
	sentenceLabels: [],
	rate: 1,
};

type SectionCtx = {
	plain: string;
	sentences: Array<{ start: number; end: number }>;
	sentenceRanges: Array<Range | null>;
	spineIndex: number;
};

function buildSentenceLabels(
	plain: string,
	sentences: Array<{ start: number; end: number }>,
): string[] {
	return sentences.map((sent) =>
		stripMarkdownForTts(plain.slice(sent.start, sent.end)).trim(),
	);
}

/**
 * EPUB 从当前可见位置连续听书（innerText 抽正文 + playEnglishPreferred）
 */
export function useEpubChapterListen(
	t: (key: string) => string,
	getRendition: () => Rendition | null,
	getCurrentCfi: () => string | undefined,
	onSessionEnd?: () => void,
	getCurrentSpineIndex?: () => number | undefined,
) {
	const [state, setState] = useState<ChapterListenState>(IDLE_STATE);
	const stateRef = useRef(state);
	stateRef.current = state;

	const tRef = useRef(t);
	tRef.current = t;
	const getRenditionRef = useRef(getRendition);
	getRenditionRef.current = getRendition;
	const getCurrentCfiRef = useRef(getCurrentCfi);
	getCurrentCfiRef.current = getCurrentCfi;
	const onSessionEndRef = useRef(onSessionEnd);
	onSessionEndRef.current = onSessionEnd;
	const getCurrentSpineIndexRef = useRef(getCurrentSpineIndex);
	getCurrentSpineIndexRef.current = getCurrentSpineIndex;

	const loopGenRef = useRef(0);
	const pausedRef = useRef(false);
	const rateRef = useRef(1);
	const sentenceCursorRef = useRef(0);
	const sectionRef = useRef<SectionCtx | null>(null);
	const resolveStartCfiRef = useRef(false);

	const syncState = useCallback((patch: Partial<ChapterListenState>) => {
		setState((prev) => {
			const next = { ...prev, ...patch };
			stateRef.current = next;
			return next;
		});
	}, []);

	const stopInternal = useCallback((opts?: { notify?: boolean }) => {
		loopGenRef.current += 1;
		pausedRef.current = false;
		resolveStartCfiRef.current = false;
		sectionRef.current = null;
		stopAllEnglishPlayback();
		teardownChapterListenHighlight(getRenditionRef.current() ?? undefined);
		clearEpubListenSegmentOverlay();
		setState(IDLE_STATE);
		stateRef.current = IDLE_STATE;
		if (opts?.notify !== false) onSessionEndRef.current?.();
	}, []);

	useEffect(() => {
		warmupEnglishTtsVoices();
		registerChapterListenStop(() => stopInternal());
		return () => {
			registerChapterListenStop(null);
			stopInternal({ notify: false });
		};
	}, [stopInternal]);

	const isGenActive = (gen: number) => gen === loopGenRef.current;

	const prepareSection = useCallback(
		(rend: Rendition, gen: number): SectionCtx | null => {
			const spineHint = getCurrentSpineIndexRef.current?.();
			const visible = extractVisibleListenSection(rend, spineHint);
			if (!visible) return null;

			const plain = visible.plain.trim();
			const sentences = buildSentenceOffsetSpans(plain);
			if (!sentences.length) return null;

			const sentenceRanges = indexChapterSentenceRanges(
				visible.outerRange,
				plain,
			);

			if (resolveStartCfiRef.current) {
				const cfi = getCurrentCfiRef.current()?.trim() ?? '';
				sentenceCursorRef.current = resolveListenStartSentence(
					rend,
					visible,
					cfi,
					sentenceRanges,
				);
				resolveStartCfiRef.current = false;
			}

			const ctx: SectionCtx = {
				plain,
				sentences,
				sentenceRanges,
				spineIndex: visible.spineIndex,
			};
			sectionRef.current = ctx;

			syncState({
				status: 'playing',
				spineIndex: visible.spineIndex,
				sentenceIndex: sentenceCursorRef.current,
				sentenceCount: sentences.length,
				sentenceLabels: buildSentenceLabels(plain, sentences),
				rate: rateRef.current,
			});

			return isGenActive(gen) ? ctx : null;
		},
		[syncState],
	);

	const playSentencesFromCursor = useCallback(
		async (
			ctx: SectionCtx,
			gen: number,
			opts?: { scrollCenterOnFirst?: boolean },
		): Promise<boolean> => {
			const { plain, sentences, sentenceRanges } = ctx;
			const rend = getRenditionRef.current();
			const startSi = sentenceCursorRef.current;

			for (let si = sentenceCursorRef.current; si < sentences.length; si += 1) {
				if (!isGenActive(gen) || pausedRef.current) return false;

				const sent = sentences[si]!;
				const spokenRaw = stripMarkdownForTts(
					plain.slice(sent.start, sent.end),
				);
				if (!spokenRaw.trim()) continue;

				sentenceCursorRef.current = si;
				syncState({
					status: 'playing',
					sentenceIndex: si,
					sentenceCount: sentences.length,
				});

				const domRange = sentenceRanges[si];
				const hasHighlight = !!(rend && domRange);
				if (hasHighlight) {
					const jumpScroll =
						opts?.scrollCenterOnFirst && si === startSi
							? ({ forceScroll: true, align: 'center' as const } as const)
							: undefined;
					showChapterListenSentenceHighlight(rend, domRange, jumpScroll);
				}

				try {
					await playEnglishPreferred(spokenRaw, {
						speak: { rate: rateRef.current },
					});
				} catch {
					if (isGenActive(gen)) {
						Toast({
							type: 'warning',
							title: tRef.current('englishLearning.tts.unsupported'),
						});
					}
					return false;
				}

				if (!isGenActive(gen) || pausedRef.current) return false;
				if (hasHighlight) clearChapterListenSentenceHighlight(rend);
			}

			return isGenActive(gen);
		},
		[syncState],
	);

	const runListenLoop = useCallback(
		async (gen: number, opts?: { continueSections?: boolean }) => {
			const rend = getRenditionRef.current();
			if (!rend) {
				stopInternal();
				return;
			}

			const continueSections = opts?.continueSections ?? true;

			for (;;) {
				if (!isGenActive(gen)) return;

				const ctx = prepareSection(rend, gen);
				if (!ctx) {
					Toast({
						type: 'warning',
						title: tRef.current('ebook.read.listenBook.emptySection'),
					});
					stopInternal();
					return;
				}

				const finished = await playSentencesFromCursor(ctx, gen);
				if (!finished) {
					if (pausedRef.current && isGenActive(gen)) return;
					if (isGenActive(gen)) stopInternal();
					return;
				}

				if (!continueSections || !isGenActive(gen)) {
					stopInternal();
					return;
				}

				sentenceCursorRef.current = 0;
				resolveStartCfiRef.current = false;
				sectionRef.current = null;

				const advanced = await waitForNextSection(rend, () => isGenActive(gen));
				if (!advanced || !isGenActive(gen)) {
					Toast({
						type: 'info',
						title: tRef.current('ebook.read.listenBook.finished'),
					});
					stopInternal();
					return;
				}
			}
		},
		[playSentencesFromCursor, prepareSection, stopInternal],
	);

	const startFromCurrentPosition = useCallback(() => {
		primeEnglishPlaybackForUserGesture();

		if (!isEnglishPlaybackAvailable()) {
			Toast({
				type: 'warning',
				title: tRef.current('englishLearning.tts.unsupported'),
			});
			return;
		}

		const rend = getRenditionRef.current();
		if (!rend) {
			Toast({
				type: 'warning',
				title: tRef.current('ebook.read.listenBook.notReady'),
			});
			return;
		}

		invokeStopQuoteListen();
		stopAllEnglishPlayback();
		clearEpubListenSegmentOverlay();
		beginChapterListenAutoFollow(rend);

		const spineHint = getCurrentSpineIndexRef.current?.();
		const preview = extractVisibleListenSection(rend, spineHint);
		if (!preview?.plain.trim()) {
			Toast({
				type: 'warning',
				title: tRef.current('ebook.read.listenBook.emptySection'),
			});
			return;
		}

		const gen = ++loopGenRef.current;
		pausedRef.current = false;
		rateRef.current = stateRef.current.rate || 1;
		sentenceCursorRef.current = 0;
		resolveStartCfiRef.current = true;

		const sentences = buildSentenceOffsetSpans(preview.plain.trim());
		const plain = preview.plain.trim();
		syncState({
			status: 'loading',
			spineIndex: preview.spineIndex,
			sentenceIndex: 0,
			sentenceCount: sentences.length,
			sentenceLabels: buildSentenceLabels(plain, sentences),
			rate: rateRef.current,
		});

		void runListenLoop(gen);
	}, [runListenLoop, syncState]);

	const toggleChapterListen = useCallback(() => {
		if (stateRef.current.status !== 'idle') {
			stopInternal();
			return;
		}
		startFromCurrentPosition();
	}, [startFromCurrentPosition, stopInternal]);

	const syncToCurrentView = useCallback(() => {
		if (stateRef.current.status === 'idle') return;

		const rend = getRenditionRef.current();
		if (!rend) return;

		const resumePlay =
			stateRef.current.status === 'playing' ||
			stateRef.current.status === 'loading';

		void (async () => {
			await waitForRelocated(rend);
			await new Promise<void>((r) => {
				requestAnimationFrame(() => requestAnimationFrame(() => r()));
			});

			if (stateRef.current.status === 'idle') return;

			stopAllEnglishPlayback();
			teardownChapterListenHighlight(rend);
			clearEpubListenSegmentOverlay();
			beginChapterListenAutoFollow(rend);
			loopGenRef.current += 1;
			const gen = ++loopGenRef.current;
			pausedRef.current = !resumePlay;
			sentenceCursorRef.current = 0;
			resolveStartCfiRef.current = true;
			sectionRef.current = null;

			const spineHint = getCurrentSpineIndexRef.current?.();
			const preview = extractVisibleListenSection(rend, spineHint);
			if (!preview?.plain.trim()) {
				Toast({
					type: 'warning',
					title: tRef.current('ebook.read.listenBook.emptySection'),
				});
				if (resumePlay) stopInternal();
				return;
			}

			const sentences = buildSentenceOffsetSpans(preview.plain.trim());
			const plain = preview.plain.trim();
			syncState({
				status: resumePlay ? 'loading' : 'paused',
				spineIndex: preview.spineIndex,
				sentenceIndex: 0,
				sentenceCount: sentences.length,
				sentenceLabels: buildSentenceLabels(plain, sentences),
				rate: rateRef.current,
			});

			if (resumePlay) {
				void runListenLoop(gen);
				return;
			}

			prepareSection(rend, gen);
			pausedRef.current = true;
			syncState({ status: 'paused' });
		})();
	}, [prepareSection, runListenLoop, stopInternal, syncState]);

	const pause = useCallback(() => {
		if (stateRef.current.status !== 'playing') return;
		pausedRef.current = true;
		loopGenRef.current += 1;
		stopAllEnglishPlayback();
		syncState({ status: 'paused' });
	}, [syncState]);

	const resume = useCallback(() => {
		if (stateRef.current.status !== 'paused') return;
		pausedRef.current = false;
		const gen = ++loopGenRef.current;
		syncState({ status: 'loading' });
		void runListenLoop(gen, { continueSections: true });
	}, [runListenLoop, syncState]);

	const stop = useCallback(() => {
		stopInternal();
	}, [stopInternal]);

	const goToSentence = useCallback(
		(index: number) => {
			const ctx = sectionRef.current;
			if (!ctx?.sentences.length) return;

			const next = Math.min(ctx.sentences.length - 1, Math.max(0, index));
			sentenceCursorRef.current = next;
			loopGenRef.current += 1;
			stopAllEnglishPlayback();
			pausedRef.current = false;

			const gen = loopGenRef.current;
			syncState({
				sentenceIndex: next,
				sentenceCount: ctx.sentences.length,
				sentenceLabels: buildSentenceLabels(ctx.plain, ctx.sentences),
				status: 'playing',
			});

			const rend = getRenditionRef.current();
			if (!rend) return;

			void playSentencesFromCursor(ctx, gen, { scrollCenterOnFirst: true });
		},
		[playSentencesFromCursor, syncState],
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
		if (stateRef.current.status === 'playing') {
			pause();
			return;
		}
		if (stateRef.current.status === 'paused') {
			resume();
		}
	}, [pause, resume]);

	const isActive =
		state.status === 'loading' ||
		state.status === 'playing' ||
		state.status === 'paused';

	return {
		...state,
		isActive,
		toggleChapterListen,
		togglePlay,
		pause,
		resume,
		stop,
		syncToCurrentView,
		prevSentence: () => seekSentence(-1),
		nextSentence: () => seekSentence(1),
		goToSentence,
		setRate,
	};
}
