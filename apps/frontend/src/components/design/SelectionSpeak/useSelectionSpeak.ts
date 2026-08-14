import { useCallback, useEffect, useRef, useState } from 'react';
import {
	applyActivePlaybackRate,
	buildSentenceOffsetSpans,
	detachPlaybackMediaHandlers,
	isPlaybackAvailable,
	pausePlaybackSoft,
	registerPlaybackMediaHandlers,
	resumePlaybackSoft,
	setPlaybackMediaSessionState,
	stopAllPlayback,
	stripMarkdownForTts,
	suppressPlaybackMediaChromeForLoading,
} from '@/utils/speech';
import { playListenPlainText } from '@/views/ebook/utils/epub/listen/playListenPlainText';

/** 选区朗读状态机：空闲 / 等 TTS / 播放中 / 已暂停 */
export type SelectionSpeakStatus = 'idle' | 'loading' | 'playing' | 'paused';

/** 语速下限（与播放器可设范围对齐） */
const RATE_MIN = 0.5;
/** 语速上限 */
const RATE_MAX = 3;
/** 与 speech.ts CLOUD_CADENCE_LEAD_SEC 一致：无真实进度时抵消听书估句提前量 */
const CADENCE_LEAD_SEC = 0.35;

/** 将语速钳到 [RATE_MIN, RATE_MAX]，并保留一位小数，避免浮点抖动 */
function clampRate(rate: number): number {
	return Math.min(RATE_MAX, Math.max(RATE_MIN, Number(rate.toFixed(1))));
}

/** 预览文案：折叠空白并去首尾空格，便于 UI 单行展示当前句 */
function previewOf(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/**
 * 选区朗读：TTS 仍走听书按段链路；预览跟听书同一套 cadence 句下标（含中英权重）。
 * loading（声音未就绪）：不挂 Touch Bar；playing / paused 再接线。
 */
export function useSelectionSpeak() {
	const [status, setStatus] = useState<SelectionSpeakStatus>('idle');
	const [rate, setRateState] = useState(1);
	/** 当前高亮/展示的那一句纯文本预览 */
	const [preview, setPreview] = useState('');

	/** 会话序号：每次 start/stop 递增，用于作废过期的异步回调 */
	const seqRef = useRef(0);
	/** 是否处于用户暂停（与 status 同步，供 isActive 闭包读取） */
	const pausedRef = useRef(false);
	/** 当前语速镜像，供播放链路 getRate 同步读取，避免闭包陈旧 */
	const rateRef = useRef(1);
	/** 原始选区文本（含 markdown），resume 软恢复失败时整段重播用 */
	const textRef = useRef('');
	/** 去 markdown 后的 TTS 纯文本，切片预览用 */
	const plainRef = useRef('');
	/** plain 上的句子 offset 列表，与 applySentence 下标对应 */
	const sentencesRef = useRef<Array<{ start: number; end: number }>>([]);
	/** status 的 ref 镜像，供异步收尾判断是否仍处于 paused */
	const statusRef = useRef<SelectionSpeakStatus>('idle');
	/** 当前已展示的句下标，避免重复 setPreview */
	const shownSiRef = useRef(0);
	/** 已拿到 duration>0 的真实进度；之后忽略带 lead 的 onSentence */
	const audioClockRef = useRef(false);
	/** 是否正在等待当前段 TTS（loading）；等待期间不用估句回调 */
	const waitingRef = useRef(false);
	/** 无真实进度时，延迟应用 onSentence 的定时器句柄 */
	const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// 每次 render 把最新 status 写入 ref，供异步路径读取
	statusRef.current = status;

	/** 按句下标更新 preview；越界或与当前句相同则跳过 */
	const applySentence = useCallback((si: number) => {
		const span = sentencesRef.current[si];
		if (!span) return;
		if (si === shownSiRef.current) return;
		shownSiRef.current = si;
		setPreview(previewOf(plainRef.current.slice(span.start, span.end)));
	}, []);

	/** 清掉 cadence 补偿用的延迟定时器，防止停/切会话后仍改 preview */
	const clearDelay = useCallback(() => {
		if (delayTimerRef.current == null) return;
		clearTimeout(delayTimerRef.current);
		delayTimerRef.current = null;
	}, []);

	/** 停止朗读：作废会话、清状态与预览，并硬停底层播放 */
	const stop = useCallback(() => {
		seqRef.current += 1;
		pausedRef.current = false;
		audioClockRef.current = false;
		waitingRef.current = false;
		shownSiRef.current = 0;
		clearDelay();
		textRef.current = '';
		plainRef.current = '';
		sentencesRef.current = [];
		stopAllPlayback();
		// 与听书一致：同步卸 Media Session，避免 macOS Touch Bar / 控制中心残留
		registerPlaybackMediaHandlers(null);
		setStatus('idle');
		setPreview('');
	}, [clearDelay]);

	// 组件卸载时确保停播并释放定时器
	useEffect(() => () => stop(), [stop]);

	/**
	 * 开始朗读选区文本。
	 * @returns false 表示文本无效或播放能力不可用；true 表示已发起异步播放
	 */
	const start = useCallback(
		(rawText: string) => {
			const text = rawText.trim();
			if (!text) return false;
			if (!isPlaybackAvailable()) return false;

			// TTS 前去掉 markdown 标记，避免读出符号
			const plain = stripMarkdownForTts(text);
			if (!plain) return false;
			const sentences = buildSentenceOffsetSpans(plain);

			// 新会话：递增 seq，重置暂停/时钟/等待与展示句
			const seq = ++seqRef.current;
			pausedRef.current = false;
			audioClockRef.current = false;
			waitingRef.current = false;
			// -1 使 applySentence(0) 一定会写入首句预览
			shownSiRef.current = -1;
			clearDelay();
			textRef.current = text;
			plainRef.current = plain;
			sentencesRef.current = sentences;
			// 先停掉可能残留的全局播放，再展示首句并进入 loading
			stopAllPlayback();
			suppressPlaybackMediaChromeForLoading();
			applySentence(0);
			setStatus('loading');

			void (async () => {
				try {
					const ok = await playListenPlainText(plain, {
						// 仅当前会话且未暂停时继续拉流/播下一段
						isActive: () => seq === seqRef.current && !pausedRef.current,
						getRate: () => rateRef.current,
						// TTS 排队/出声：waiting 时回 loading，并清掉不可靠的估句时钟
						onAwaitingCurrentTts: (waiting) => {
							if (seq !== seqRef.current || pausedRef.current) return;
							waitingRef.current = waiting;
							if (waiting) {
								audioClockRef.current = false;
								clearDelay();
								// 同步卸键+丢 <audio>：中途仅 detach 时 macOS 常残留 Touch Bar
								suppressPlaybackMediaChromeForLoading();
								setStatus('loading');
								return;
							}
							// 仅离开 loading；勿在 paused 时被迟到的 false 打成 playing
							if (statusRef.current === 'loading') setStatus('playing');
						},
						// 真实音频时钟：优先用 speech 与听书同一套 cadence 句下标（中英权重）
						onAudioTime: ({ baseSi, duration, sentenceIndex }) => {
							if (seq !== seqRef.current) return;
							if (!(duration > 0) || !Number.isFinite(duration)) {
								// 出声瞬间尚无 duration：只钉到本段首句，不锁死 audioClock
								applySentence(baseSi);
								return;
							}
							audioClockRef.current = true;
							clearDelay();
							const clipSi =
								typeof sentenceIndex === 'number' &&
								Number.isFinite(sentenceIndex)
									? Math.max(0, sentenceIndex)
									: 0;
							applySentence(baseSi + clipSi);
						},
						// 估句回调：仅在无真实进度时作降级；并延迟 CADENCE_LEAD 抵消提前量
						onSentence: (si, info) => {
							if (seq !== seqRef.current) return;
							// 首包 80% 提前切句：下一句音频还没出
							if (info.early) return;
							// 已有真实进度则完全交给 onAudioTime
							if (audioClockRef.current || waitingRef.current) return;
							// 本机等无 progress：抵消 cadence 的 0.35s lead（随语速缩短延迟）
							clearDelay();
							const delayMs =
								(CADENCE_LEAD_SEC / Math.max(RATE_MIN, rateRef.current)) * 1000;
							delayTimerRef.current = setTimeout(() => {
								delayTimerRef.current = null;
								if (seq !== seqRef.current) return;
								// 延迟期间若已拿到真实时钟，则丢弃这次估句
								if (audioClockRef.current) return;
								applySentence(si);
							}, delayMs);
						},
					});
					// 会话已切换（stop/重新 start）则不再改 UI
					if (seq !== seqRef.current) return;
					if (ok && !pausedRef.current) {
						// 正常播完：回到 idle 并清空文本缓存
						setStatus('idle');
						setPreview('');
						textRef.current = '';
						plainRef.current = '';
						sentencesRef.current = [];
					} else if (!ok && statusRef.current !== 'paused') {
						// 失败且不是用户暂停导致的中断：同样复位
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
		[applySentence, clearDelay],
	);

	/** 软暂停：仅已出声的 playing 可进（loading 时无 Touch Bar / 条上播控禁用） */
	const pause = useCallback(() => {
		if (statusRef.current !== 'playing') return;
		pausedRef.current = true;
		clearDelay();
		pausePlaybackSoft();
		setStatus('paused');
	}, [clearDelay]);

	/**
	 * 从 paused 恢复：优先软 resume；失败则用缓存原文重新 start。
	 * 无缓存文本时直接回 idle。
	 */
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

	const pauseRef = useRef(pause);
	pauseRef.current = pause;
	const resumeRef = useRef(resume);
	resumeRef.current = resume;

	/** 仅 playing ↔ paused；loading 禁止播控 */
	const togglePlay = useCallback(() => {
		const s = statusRef.current;
		if (s === 'loading') return;
		if (s === 'playing') {
			pause();
			return;
		}
		if (s === 'paused') resume();
	}, [pause, resume]);

	/** 更新语速：钳制后写 ref、应用到当前活跃播放，并同步 React state */
	const setRate = useCallback((next: number) => {
		const clamped = clampRate(next);
		rateRef.current = clamped;
		applyActivePlaybackRate(clamped);
		setRateState(clamped);
	}, []);

	/** 声音未就绪前不挂 Touch Bar；仅 playing / paused 接线 */
	const mediaReady = status === 'playing' || status === 'paused';

	useEffect(() => {
		if (!mediaReady) {
			detachPlaybackMediaHandlers();
			return;
		}
		registerPlaybackMediaHandlers({
			play: () => resumeRef.current(),
			pause: () => pauseRef.current(),
		});
		return () => detachPlaybackMediaHandlers();
	}, [mediaReady]);

	useEffect(() => {
		if (status === 'playing') setPlaybackMediaSessionState('playing');
		else if (status === 'paused') setPlaybackMediaSessionState('paused');
	}, [status]);

	return {
		status,
		rate,
		preview,
		/** 非 idle 时展示选区朗读条 */
		visible: status !== 'idle',
		start,
		stop,
		togglePlay,
		setRate,
	};
}
