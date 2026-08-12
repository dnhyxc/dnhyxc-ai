import { useCallback, useEffect, useRef, useState } from 'react';
import {
	applyActivePlaybackRate,
	buildSentenceOffsetSpans,
	isPlaybackAvailable,
	pausePlaybackSoft,
	resumePlaybackSoft,
	stopAllPlayback,
	stripMarkdownForTts,
} from '@/utils/speech';
import { playListenPlainText } from '@/views/ebook/utils/epub/listen/playListenPlainText';

export type SelectionSpeakStatus = 'idle' | 'loading' | 'playing' | 'paused';

const RATE_MIN = 0.5;
const RATE_MAX = 3;

function clampRate(rate: number): number {
	return Math.min(RATE_MAX, Math.max(RATE_MIN, Number(rate.toFixed(1))));
}

function previewOf(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/**
 * 选区朗读会话：听当前同款按段 TTS + 软暂停/倍速。
 * `preview` 随当前句更新，供悬浮条展示。
 */
export function useSelectionSpeak() {
	const [status, setStatus] = useState<SelectionSpeakStatus>('idle');
	const [rate, setRateState] = useState(1);
	const [preview, setPreview] = useState('');

	const seqRef = useRef(0);
	const pausedRef = useRef(false);
	const rateRef = useRef(1);
	const textRef = useRef('');
	const plainRef = useRef('');
	const sentencesRef = useRef<Array<{ start: number; end: number }>>([]);
	const statusRef = useRef<SelectionSpeakStatus>('idle');

	statusRef.current = status;

	const applySentence = useCallback((si: number) => {
		const span = sentencesRef.current[si];
		if (!span) return;
		setPreview(previewOf(plainRef.current.slice(span.start, span.end)));
	}, []);

	const stop = useCallback(() => {
		seqRef.current += 1;
		pausedRef.current = false;
		textRef.current = '';
		plainRef.current = '';
		sentencesRef.current = [];
		stopAllPlayback();
		setStatus('idle');
		setPreview('');
	}, []);

	useEffect(() => () => stop(), [stop]);

	const start = useCallback(
		(rawText: string) => {
			const text = rawText.trim();
			if (!text) return false;
			if (!isPlaybackAvailable()) return false;

			const plain = stripMarkdownForTts(text);
			if (!plain) return false;
			const sentences = buildSentenceOffsetSpans(plain);

			const seq = ++seqRef.current;
			pausedRef.current = false;
			textRef.current = text;
			plainRef.current = plain;
			sentencesRef.current = sentences;
			stopAllPlayback();
			applySentence(0);
			setStatus('loading');

			void (async () => {
				try {
					const ok = await playListenPlainText(plain, {
						isActive: () => seq === seqRef.current && !pausedRef.current,
						getRate: () => rateRef.current,
						onAwaitingCurrentTts: (waiting) => {
							if (seq !== seqRef.current || pausedRef.current) return;
							setStatus(waiting ? 'loading' : 'playing');
						},
						onSentence: (si) => {
							if (seq !== seqRef.current) return;
							applySentence(si);
						},
					});
					if (seq !== seqRef.current) return;
					if (ok && !pausedRef.current) {
						setStatus('idle');
						setPreview('');
						textRef.current = '';
						plainRef.current = '';
						sentencesRef.current = [];
					} else if (!ok && statusRef.current !== 'paused') {
						setStatus('idle');
						setPreview('');
						textRef.current = '';
						plainRef.current = '';
						sentencesRef.current = [];
					}
				} catch {
					if (seq !== seqRef.current) return;
					setStatus('idle');
					setPreview('');
					textRef.current = '';
					plainRef.current = '';
					sentencesRef.current = [];
				}
			})();

			return true;
		},
		[applySentence],
	);

	const pause = useCallback(() => {
		const s = statusRef.current;
		if (s !== 'playing' && s !== 'loading') return;
		pausedRef.current = true;
		pausePlaybackSoft();
		setStatus('paused');
	}, []);

	const resume = useCallback(() => {
		if (statusRef.current !== 'paused') return;
		pausedRef.current = false;
		if (resumePlaybackSoft()) {
			setStatus('playing');
			return;
		}
		const text = textRef.current;
		if (!text) {
			setStatus('idle');
			return;
		}
		start(text);
	}, [start]);

	const togglePlay = useCallback(() => {
		const s = statusRef.current;
		if (s === 'playing' || s === 'loading') {
			pause();
			return;
		}
		if (s === 'paused') resume();
	}, [pause, resume]);

	const setRate = useCallback((next: number) => {
		const clamped = clampRate(next);
		rateRef.current = clamped;
		applyActivePlaybackRate(clamped);
		setRateState(clamped);
	}, []);

	return {
		status,
		rate,
		preview,
		visible: status !== 'idle',
		start,
		stop,
		togglePlay,
		setRate,
	};
}
