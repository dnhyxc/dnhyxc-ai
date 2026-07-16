import { Toast } from '@ui/sonner';
import type { Rendition } from 'epubjs';
import { useCallback, useEffect, useRef } from 'react';
import {
	isPlaybackAvailable,
	primePlaybackForUserGesture,
	warmupSpeechVoices,
} from '@/utils/speech';
import { resolveEpubListenPlain } from '../utils/epub/listen/epubListenSegmentOverlay';
import {
	cfiFromDomRange,
	resolveCfiDomRange,
} from '../utils/epub/mark/epubRangeGeometry';
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

export type QuoteListenChapterBridge = {
	startFromCfi: (
		cfi: string,
		mode?: 'before' | 'after',
		anchorRange?: Range | null,
		selectionPlain?: string | null,
	) => void;
};

/**
 * 选区/CFI → 完整选区 Range（供重叠定位起播句）+ 起点 CFI（供 display）。
 * 注意：anchor 不要 collapse，否则句末选区会偏到下一句。
 */
function resolveListenAnchor(
	rend: Rendition | null,
	text: string,
	cfiRange?: string,
	frozenRange?: Range | null,
): { cfi: string; anchor: Range | null } {
	const { selectionRange } = resolveEpubListenPlain(rend, text, frozenRange);

	let anchor: Range | null = null;
	if (selectionRange) {
		try {
			anchor = selectionRange.cloneRange();
		} catch {
			anchor = null;
		}
	}

	if (!anchor && rend && cfiRange?.trim()) {
		const resolved = resolveCfiDomRange(rend, cfiRange.trim());
		if (resolved) {
			try {
				anchor = resolved.cloneRange();
			} catch {
				anchor = null;
			}
		}
	}

	let cfi = '';
	if (rend && anchor) {
		try {
			const start = anchor.cloneRange();
			start.collapse(true);
			cfi = cfiFromDomRange(rend, start)?.trim() ?? '';
		} catch {
			cfi = '';
		}
	}
	if (!cfi) cfi = cfiRange?.trim() ?? '';

	return { cfi, anchor };
}

/**
 * 听当前入口：每次点击都从选区切入听书并续读（微信读书：无暂停/继续态，暂停用底栏）。
 */
export function useEbookQuoteListen(
	t: (key: string) => string,
	getRendition?: () => Rendition | null,
	_onListenSessionEnd?: () => void,
	_getSpineIndex?: () => number | undefined,
	chapterBridge?: QuoteListenChapterBridge,
) {
	const tRef = useRef(t);
	tRef.current = t;
	const getRenditionRef = useRef(getRendition);
	getRenditionRef.current = getRendition;
	const bridgeRef = useRef(chapterBridge);
	bridgeRef.current = chapterBridge;

	useEffect(() => {
		warmupSpeechVoices();
	}, []);

	const startFromSelection = useCallback(
		(
			text: string,
			_key: string,
			cfiRange?: string,
			frozenRange?: Range | null,
		) => {
			const trimmed = text.trim();
			if (!trimmed) return;

			const bridge = bridgeRef.current;
			if (!bridge) {
				Toast({
					type: 'warning',
					title: tRef.current('ebook.read.listenBook.notReady'),
				});
				return;
			}

			if (!isPlaybackAvailable()) {
				Toast({
					type: 'warning',
					title: tRef.current('englishLearning.tts.unsupported'),
				});
				return;
			}

			primePlaybackForUserGesture();
			const rend = getRenditionRef.current?.() ?? null;
			const { cfi, anchor } = resolveListenAnchor(
				rend,
				trimmed,
				cfiRange,
				frozenRange,
			);
			if (!cfi && !anchor) {
				Toast({
					type: 'warning',
					title: tRef.current('ebook.read.listenBook.notReady'),
				});
				return;
			}

			bridge.startFromCfi(cfi, 'after', anchor, trimmed);
		},
		[],
	);

	/** 固定文案，无播放态（暂停/继续只在底栏） */
	const listenLabel = useCallback(
		(_key: string, defaultLabel: string) => defaultLabel,
		[],
	);

	return {
		...IDLE_STATE,
		status: 'idle' as ChapterListenStatus,
		isActive: false,
		toggleListen: startFromSelection,
		playingKey: null as string | null,
		listenLabel,
		togglePlay: () => {},
		pause: () => {},
		resume: () => {},
		stop: () => {},
		prevSentence: () => {},
		nextSentence: () => {},
		goToSentence: (_index: number) => {},
		setRate: (_rate: number) => {},
	};
}
