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
	clearChapterListenSentenceHighlight,
	extractListenSectionForDocument,
	extractVisibleListenSection,
	indexChapterSentenceRanges,
	resolveListenStartSentence,
	showChapterListenSentenceHighlight,
	teardownChapterListenHighlight,
	type VisibleListenSection,
	waitForNextSection,
	waitForRelocated,
} from '../utils/epub/listen/epubListenChapter';
import {
	beginChapterListenAutoFollow,
	clearEpubListenSegmentOverlay,
	invokeStopQuoteListen,
	registerChapterListenStop,
} from '../utils/epub/listen/epubListenSegmentOverlay';
import {
	advanceScrollListenSection,
	isScrollListenMode,
} from '../utils/epub/listen/epubScrollListenAdvance';

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

function ctxFromVisible(visible: VisibleListenSection): SectionCtx {
	const plain = visible.plain.trim();
	return {
		plain,
		sentences: buildSentenceOffsetSpans(plain),
		sentenceRanges: indexChapterSentenceRanges(visible.outerRange, plain),
		spineIndex: visible.spineIndex,
	};
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
	const sectionDocRef = useRef<Document | null>(null);
	const resolveStartCfiRef = useRef(false);
	const scrollSeekRef = useRef(false);

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
		sectionDocRef.current = null;
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

	const applySection = useCallback(
		(rend: Rendition, visible: VisibleListenSection): SectionCtx | null => {
			const ctx = ctxFromVisible(visible);
			if (!ctx.sentences.length) return null;

			if (resolveStartCfiRef.current) {
				const cfi = getCurrentCfiRef.current()?.trim() ?? '';
				sentenceCursorRef.current = resolveListenStartSentence(
					rend,
					visible,
					cfi,
					ctx.sentenceRanges,
				);
				resolveStartCfiRef.current = false;
			}

			sectionRef.current = ctx;
			sectionDocRef.current = visible.outerRange.startContainer.ownerDocument;

			syncState({
				status: 'playing',
				spineIndex: visible.spineIndex,
				sentenceIndex: sentenceCursorRef.current,
				sentenceCount: ctx.sentences.length,
				sentenceLabels: buildSentenceLabels(ctx.plain, ctx.sentences),
				rate: rateRef.current,
			});

			return ctx;
		},
		[syncState],
	);

	const prepareSection = useCallback(
		(rend: Rendition): SectionCtx | null => {
			const spineHint = getCurrentSpineIndexRef.current?.();
			const visible = extractVisibleListenSection(rend, spineHint);
			if (!visible) return null;
			return applySection(rend, visible);
		},
		[applySection],
	);

	// 播放从当前句子光标出发的连续句子朗读流程
	const playSentencesFromCursor = useCallback(
		async (
			ctx: SectionCtx,
			gen: number,
			opts?: { scrollCenterOnFirst?: boolean },
		): Promise<boolean> => {
			// 解构出当前节的纯文本、句子分割和每句对应的 DOM Range
			const { plain, sentences, sentenceRanges } = ctx;
			// 获取当前 EPUB 渲染器实例
			const rend = getRenditionRef.current();
			// 当前朗读开始的句子下标
			const startSi = sentenceCursorRef.current;
			// 预下载 TTS 语音结果的映射表（句子下标 -> Promise）
			const prefetchedByIndex = new Map<
				number,
				ReturnType<typeof prefetchCloudEnglishTts>
			>();

			// 根据句子下标提前启动云端 TTS 语音预取，避免播放卡顿
			const schedulePrefetch = (index: number) => {
				// 超出句子总数或已预取则跳过
				if (index >= sentences.length || prefetchedByIndex.has(index)) return;
				const sent = sentences[index];
				if (!sent) return;
				// 提取并净化当前句子文本
				const raw = stripMarkdownForTts(
					plain.slice(sent.start, sent.end),
				).trim();
				if (!raw) return;
				// 触发预取，并缓存 Promise
				prefetchedByIndex.set(index, prefetchCloudEnglishTts(raw));
			};
			// 初始预取下一句
			schedulePrefetch(startSi + 1);

			// 遍历每一句开始按顺序播放
			for (let si = sentenceCursorRef.current; si < sentences.length; si += 1) {
				// 若检测到已中断或暂停，则立即结束返回
				if (!isGenActive(gen) || pausedRef.current) return false;

				// 当前要播放的句子实体
				const sent = sentences[si]!;
				// 取出该句的纯文本内容并净化处理
				const spokenRaw = stripMarkdownForTts(
					plain.slice(sent.start, sent.end),
				);
				// 若为空句则跳过
				if (!spokenRaw.trim()) continue;

				// 移动句子光标到当前句
				sentenceCursorRef.current = si;
				// 状态同步，通知外部当前播放进度
				syncState({
					status: 'playing',
					sentenceIndex: si,
					sentenceCount: sentences.length,
				});

				// 查找当前句对应的高亮 DOM Range
				const domRange = sentenceRanges[si];
				// 若支持高亮则置为 true
				const hasHighlight = !!(rend && domRange);

				if (hasHighlight) {
					// 高亮当前句，并根据选项决定是否需跳转置中（如首句朗读时）
					const jumpScroll =
						opts?.scrollCenterOnFirst && si === startSi
							? ({ forceScroll: true, align: 'center' as const } as const)
							: undefined;
					showChapterListenSentenceHighlight(rend, domRange, jumpScroll);
				}

				// 预取下一句语音，播放衔接更顺畅
				schedulePrefetch(si + 1);

				try {
					// 播放此句文本，优先用预取的云端语音，未命中则在线合成
					await playEnglishPreferred(spokenRaw, {
						speak: { rate: rateRef.current },
						prefetchedCloud: prefetchedByIndex.get(si) ?? null,
					});
				} catch {
					// 若 TTS 播放失败，弹出提示（如不支持的语言或接口出错）
					if (isGenActive(gen)) {
						Toast({
							type: 'warning',
							title: tRef.current('englishLearning.tts.unsupported'),
						});
					}
					return false;
				}

				// 若中途被打断或暂停则退出循环，不继续后面句子
				if (!isGenActive(gen) || pausedRef.current) return false;
				// 朗读后移除高亮
				if (hasHighlight) clearChapterListenSentenceHighlight(rend);
			}

			// 循环完成，返回当前是否处于有效代次
			return isGenActive(gen);
		},
		[syncState],
	);

	/**
	 * 连续滚动：逐 iframe 播放，节末按槽位加载下一节
	 * 该函数负责在 scroll listen 模式下，逐 Section（通常对应每一个章节 iframe）依次朗读每个段落。
	 * 到达节末时会尝试加载下一个章节的文档，自动接续朗读，直到所有可用章节播放完毕、被用户中断或暂停。
	 */
	const runScrollSectionLoop = useCallback(
		async (gen: number) => {
			// 获取当前 epub.js 渲染器实例
			const rend = getRenditionRef.current();
			if (!rend) {
				// 若渲染器不存在，直接停止朗读过程
				stopInternal();
				return;
			}

			// 章节 iframe 的 document 对象（用于定位当前朗读的 Section）
			let sectionDoc = sectionDocRef.current;
			// 如果存在起始 CFI 或 sectionDoc 尚未初始化，需特殊处理首节准备逻辑
			let usePrepare = resolveStartCfiRef.current || !sectionDoc;

			// 循环进入每个 section，直至全部朗读完成/中断
			for (;;) {
				// 若已经不是当前激活代次（如被用户终止），直接退出循环
				if (!isGenActive(gen)) return;

				let ctx: SectionCtx | null;
				if (usePrepare) {
					// 需要准备新的 Section：如首次进入或 CFI 跳转
					ctx = prepareSection(rend);
					usePrepare = false;
					// 准备后刷新最新的 sectionDocRef（Section 定位可能已变化）
					sectionDoc = sectionDocRef.current;
				} else {
					// 否则根据当前 sectionDoc 构建 listen 节上下文
					if (!sectionDoc) {
						// 若 document 尚未可用，则停止朗读（理论不应发生）
						stopInternal();
						return;
					}
					// 提取该文档下的可朗读 Section（如正文内容等）
					const visible = extractListenSectionForDocument(rend, sectionDoc);
					if (!visible) {
						// 若当前 section 不可朗读（为空），弹 toast 提示，并停止
						Toast({
							type: 'warning',
							title: tRef.current('ebook.read.listenBook.emptySection'),
						});
						stopInternal();
						return;
					}
					// 构建朗读上下文（如分句、文本定位等）
					ctx = applySection(rend, visible);
				}

				// 再次检测 SectionCtx 是否可用
				if (!ctx) {
					// 若上下文生成失败，可能当前节为空，再次处理异常退出
					if (!isGenActive(gen)) return;
					Toast({
						type: 'warning',
						title: tRef.current('ebook.read.listenBook.emptySection'),
					});
					stopInternal();
					return;
				}

				// 判断本次播放前是否需要将第一句滚动居中（如人为拖动或首次进入节）
				const scrollCenter =
					scrollSeekRef.current || sentenceCursorRef.current === 0;
				// 将 scrollSeek 标志置为 false，避免下次误触发
				scrollSeekRef.current = false;

				// 调用逐句播放核心逻辑，开始从当前游标处依次播放本节所有句子
				const finished = await playSentencesFromCursor(ctx, gen, {
					scrollCenterOnFirst: scrollCenter,
				});
				if (!finished) {
					// 若播放未完整（被暂停、出错或人为中止），判断终止原因并退出
					if (!isGenActive(gen)) return;
					if (pausedRef.current) return; // 用户暂停则提前返回等待
					stopInternal(); // 朗读被意外中止需终止流程
					return;
				}

				// 朗读本节结束后再次确认是否为当前有效请求
				if (!isGenActive(gen)) return;

				// 更新 sectionDoc，优先使用最新 ref，若未变则沿用当前
				sectionDoc = sectionDocRef.current ?? sectionDoc;
				if (!sectionDoc) {
					// 若 sectionDoc 已丢失，则终止
					stopInternal();
					return;
				}

				// 节内句子重置为 0，准备下一节
				sentenceCursorRef.current = 0;
				// 清除起始 CFI 标记（已切换至 next 节）
				resolveStartCfiRef.current = false;

				// 同步设置界面 loading 状态，提示正在加载下一节
				syncState({ status: 'loading' });

				// 查找下一个可朗读的文档：按 scroll listen 模式推进章节 iframe
				const nextDoc = await advanceScrollListenSection(rend, sectionDoc);
				if (!nextDoc || !isGenActive(gen)) {
					// 若找不到新章，说明全部内容播放完毕，弹提示并终止朗读
					Toast({
						type: 'info',
						title: tRef.current('ebook.read.listenBook.finished'),
					});
					stopInternal();
					return;
				}

				// 成功推进后进入下一个章节文档，准备下轮播放
				sectionDoc = nextDoc;
				sectionDocRef.current = nextDoc;
			}
		},
		[
			applySection,
			playSentencesFromCursor,
			prepareSection,
			stopInternal,
			syncState,
		],
	);

	const runPaginatedListenLoop = useCallback(
		async (gen: number, opts?: { continueSections?: boolean }) => {
			const rend = getRenditionRef.current();
			if (!rend) {
				stopInternal();
				return;
			}

			const continueSections = opts?.continueSections ?? true;

			for (;;) {
				if (!isGenActive(gen)) return;

				const ctx = prepareSection(rend);
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
					if (!isGenActive(gen)) return;
					if (pausedRef.current) return;
					stopInternal();
					return;
				}

				if (!continueSections || !isGenActive(gen)) {
					stopInternal();
					return;
				}

				sentenceCursorRef.current = 0;
				resolveStartCfiRef.current = false;
				sectionRef.current = null;
				sectionDocRef.current = null;

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

	const runListenLoop = useCallback(
		async (gen: number, opts?: { continueSections?: boolean }) => {
			const rend = getRenditionRef.current();
			if (!rend) {
				stopInternal();
				return;
			}
			if (isScrollListenMode(rend)) {
				await runScrollSectionLoop(gen);
				return;
			}
			await runPaginatedListenLoop(gen, opts);
		},
		[runPaginatedListenLoop, runScrollSectionLoop, stopInternal],
	);

	// 从当前阅读位置开始 TTS 朗读章节
	const startFromCurrentPosition = useCallback(() => {
		// 触发用户手势相关的英文朗读准备
		primeEnglishPlaybackForUserGesture();

		// 检查英文TTS能力是否可用（如浏览器支持等）
		if (!isEnglishPlaybackAvailable()) {
			// 弹出警告：当前环境不支持英文TTS
			Toast({
				type: 'warning',
				title: tRef.current('englishLearning.tts.unsupported'),
			});
			return;
		}

		// 获取epub页面渲染器，如果未就绪则弹出警告
		const rend = getRenditionRef.current();
		if (!rend) {
			Toast({
				type: 'warning',
				title: tRef.current('ebook.read.listenBook.notReady'),
			});
			return;
		}

		// 停止引用听写、终止所有英文TTS播报、清除UI高亮、开启章节自动跟随
		invokeStopQuoteListen();
		stopAllEnglishPlayback();
		clearEpubListenSegmentOverlay();
		beginChapterListenAutoFollow(rend);

		// 获取当前spine索引（当前文档片段位置）
		const spineHint = getCurrentSpineIndexRef.current?.();
		// 提取可听的当前可见章节内容
		const preview = extractVisibleListenSection(rend, spineHint);
		// 若当前可见片段为空，提示“该章为空”，并退出
		if (!preview?.plain.trim()) {
			Toast({
				type: 'warning',
				title: tRef.current('ebook.read.listenBook.emptySection'),
			});
			return;
		}

		// 递增循环代数，确保本次朗读标识唯一
		const gen = ++loopGenRef.current;
		// 标记：未暂停、速率设定、句子光标重置、起始Cfi解析、章节/文档引用空
		pausedRef.current = false;
		rateRef.current = stateRef.current.rate || 1;
		sentenceCursorRef.current = 0;
		resolveStartCfiRef.current = true;
		sectionRef.current = null;
		// 记录本次朗读关联的文档节点
		sectionDocRef.current = preview.outerRange.startContainer.ownerDocument;

		// 构建该片段的句子偏移信息
		const sentences = buildSentenceOffsetSpans(preview.plain.trim());
		const plain = preview.plain.trim();

		// 同步状态为 loading，初始化句子/章节等信息
		syncState({
			status: 'loading',
			spineIndex: preview.spineIndex,
			sentenceIndex: 0,
			sentenceCount: sentences.length,
			sentenceLabels: buildSentenceLabels(plain, sentences),
			rate: rateRef.current,
		});

		// 启动章节朗读主循环
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
			sectionDocRef.current = null;

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

			sectionDocRef.current = preview.outerRange.startContainer.ownerDocument;

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

			prepareSection(rend);
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
			scrollSeekRef.current = true;
			stopAllEnglishPlayback();
			pausedRef.current = false;

			const gen = ++loopGenRef.current;
			syncState({
				sentenceIndex: next,
				sentenceCount: ctx.sentences.length,
				sentenceLabels: buildSentenceLabels(ctx.plain, ctx.sentences),
				status: 'playing',
			});

			void runListenLoop(gen);
		},
		[runListenLoop, syncState],
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
