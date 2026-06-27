import { Toast } from '@ui/sonner';
import type { Rendition } from 'epubjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	applyActiveEnglishPlaybackRate,
	buildSentenceOffsetSpans,
	isEnglishPlaybackAvailable,
	playEnglishPreferred,
	prefetchCloudEnglishTts,
	primeEnglishPlaybackForUserGesture,
	stopAllEnglishPlayback,
	stripMarkdownForTts,
	warmupEnglishTtsVoices,
} from '@/utils/englishTts';
import {
	beginEpubListenOverlaySession,
	clearActiveListenHighlight,
	clearEpubListenSegmentOverlay,
	getEpubListenSentenceSpokenRaw,
	getEpubListenSessionMeta,
	getEpubListenSessionPlain,
	invokeStopChapterListen,
	registerQuoteListenStop,
	resolveEpubListenPlain,
	showEpubListenPlainSpan,
} from '../utils/epubListenSegmentOverlay';
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

function resolveSpokenAt(index: number, fallbackPlain: string): string | null {
	const fromSession = getEpubListenSentenceSpokenRaw(index);
	if (fromSession) return fromSession;
	const spans = buildSentenceOffsetSpans(fallbackPlain.trim());
	const span = spans[index];
	if (!span) return null;
	const raw = stripMarkdownForTts(
		fallbackPlain.slice(span.start, span.end),
	).trim();
	return raw || null;
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
		stopAllEnglishPlayback();
		clearEpubListenSegmentOverlay();
		setPlayingKey(null);
		setState(IDLE_STATE);
		stateRef.current = IDLE_STATE;
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

	// playFromCursor：从当前句指针（sentenceCursorRef.current）开始的逐句播放主循环，支持播放到末句或用户主动打断
	const playFromCursor = useCallback(
		async (gen: number): Promise<boolean> => {
			// 当前 EPUB rendition 实例，可能为 null
			const rend = getRenditionRef.current?.() ?? null;
			// 获取当前 listen 会话的元信息（分句等），可能为 null
			const meta = getEpubListenSessionMeta();
			// 实际要朗读的 plain 文本，优先取 meta.plain，否则用 fallback
			const plain = meta?.plain ?? fallbackPlainRef.current;
			// 分句总数，优先取 meta.sentenceCount，否则实时用构造函数分句
			const sentenceCount =
				meta?.sentenceCount ?? buildSentenceOffsetSpans(plain.trim()).length;

			// 空文本或无可播放句时，立即返回 false
			if (!plain.trim() || sentenceCount <= 0) return false;

			// 用于缓存句索引到云端 TTS 预取 Promise（避免重复请求）
			const prefetchedByIndex = new Map<
				number,
				ReturnType<typeof prefetchCloudEnglishTts>
			>();

			// 预取指定句 index 用的 TTS 音频（下一个句要用时更快）
			const schedulePrefetch = (index: number) => {
				// 判断：索引超界或已预取则不再处理
				if (index >= sentenceCount || prefetchedByIndex.has(index)) return;
				// 拿到本句要播放的原始文本
				const raw = resolveSpokenAt(index, plain);
				// 拿不到原文（容错）则跳过
				if (!raw) return;
				// 以 index 为 key 记录预取 Promise
				prefetchedByIndex.set(index, prefetchCloudEnglishTts(raw));
			};
			// 首次启动时预取下一句，优化流畅衔接
			schedulePrefetch(sentenceCursorRef.current + 1);

			// 主循环：从当前游标开始，播放到最后一句（或被打断/暂停提前终止）
			for (let si = sentenceCursorRef.current; si < sentenceCount; si += 1) {
				// 若当前 gen 失效/被暂停，提前终止循环（返回 false 退出）
				if (!isGenActive(gen) || pausedRef.current) return false;

				// 获取当前句要播放的原始文本，空句跳过
				const spokenRaw = resolveSpokenAt(si, plain);
				if (!spokenRaw) continue;

				// 更新当前句指针，推进 playback
				sentenceCursorRef.current = si;
				// 让外部 state 更新「正在播放第几句」状态
				syncState({
					status: 'playing',
					sentenceIndex: si,
					sentenceCount,
				});

				// 若有 rendition，显示淡黄高亮区块
				if (rend) showEpubListenPlainSpan(0, 0, si);

				// 提前预取下一句的音频资源（云端优先）
				schedulePrefetch(si + 1);

				try {
					// 播放当前句音频（本地或云端优选）；预取缓存注入提升命中率
					await playEnglishPreferred(spokenRaw, {
						speak: { rate: rateRef.current },
						prefetchedCloud: prefetchedByIndex.get(si) ?? null,
					});
				} catch {
					// 如果 gen 没失效，反馈 TTS 不支持的 toast
					if (isGenActive(gen)) {
						Toast({
							type: 'warning',
							title: tRef.current('englishLearning.tts.unsupported'),
						});
					}
					// 发生异常提前终止播放流程
					return false;
				}

				// 再度确认未被打断/暂停，始终谨慎提前退出
				if (!isGenActive(gen) || pausedRef.current) return false;
				// 清理当前的高亮 listen 区块
				if (rend) clearActiveListenHighlight(rend);
			}

			// 真正完整播放到尾时，返回 true，否则外部可据此做轮询保障
			return isGenActive(gen);
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
			const meta = getEpubListenSessionMeta();
			const labels = meta?.sentenceLabels ?? buildLabelsFromPlain(speakPlain);
			const sentenceCount = meta?.sentenceCount ?? labels.length;

			const gen = ++loopGenRef.current;
			pausedRef.current = false;
			rateRef.current = stateRef.current.rate || 1;
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
		void playFromCursor(gen).then((finished) => {
			if (finished && isGenActive(gen)) stopInternal();
			else if (!pausedRef.current && isGenActive(gen)) stopInternal();
		});
	}, [playFromCursor, stopInternal, syncState]);

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
		if (stateRef.current.status === 'playing') {
			pause();
			return;
		}
		if (stateRef.current.status === 'paused') {
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
