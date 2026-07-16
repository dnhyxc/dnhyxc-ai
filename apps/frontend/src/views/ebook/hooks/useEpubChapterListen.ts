import { Toast } from '@ui/sonner';
import type { Rendition } from 'epubjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	applyActivePlaybackRate,
	buildSentenceOffsetSpans,
	isPlaybackAvailable,
	pausePlaybackSoft,
	primePlaybackForUserGesture,
	registerPlaybackMediaHandlers,
	resumePlaybackSoft,
	stopAllPlayback,
	stripMarkdownForTts,
	warmupSpeechVoices,
} from '@/utils/speech';
import {
	clearChapterListenSentenceHighlight,
	extractListenSectionForDocument,
	extractVisibleListenSection,
	indexChapterSentenceRanges,
	listenSpineIndexFromRendition,
	resolveListenStartSentence,
	showChapterListenSentenceHighlight,
	teardownChapterListenHighlight,
	type VisibleListenSection,
	waitForNextSection,
} from '../utils/epub/listen/epubListenChapter';
import {
	buildParagraphUnits,
	type ParagraphUnit,
} from '../utils/epub/listen/epubListenParagraphs';
import { playListenUnitsFromCursor } from '../utils/epub/listen/epubListenPlayUnits';
import {
	beginChapterListenAutoFollow,
	clearEpubListenSegmentOverlay,
	invokeStopQuoteListen,
	registerChapterListenDomRemount,
	registerChapterListenStop,
} from '../utils/epub/listen/epubListenSegmentOverlay';
import {
	advanceScrollListenSection,
	isScrollListenMode,
} from '../utils/epub/listen/epubScrollListenAdvance';
import { cfiFromDomRange } from '../utils/epub/mark/epubRangeGeometry';

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
	paragraphs: ParagraphUnit[];
	sentenceRanges: Array<Range | null>;
	spineIndex: number;
	plainFrom: number;
	nextPlainFrom: number;
	hasMorePlain: boolean;
	/** 本段句 Range 索引起始 norm 游标 */
	normCursorStart: number;
	/** 本段索引结束后的 norm 游标（下一段起点） */
	normCursor: number;
};

function buildSentenceLabels(
	plain: string,
	sentences: Array<{ start: number; end: number }>,
): string[] {
	return sentences.map((sent) =>
		stripMarkdownForTts(plain.slice(sent.start, sent.end)).trim(),
	);
}

function isLiveDomRange(range: Range | null | undefined): range is Range {
	if (!range) return false;
	try {
		const node = range.startContainer;
		if (!node.isConnected) return false;
		const iframe = node.ownerDocument?.defaultView
			?.frameElement as HTMLElement | null;
		return !!iframe?.isConnected;
	} catch {
		return false;
	}
}

function ctxFromVisible(
	visible: VisibleListenSection,
	normCursorStart = 0,
): SectionCtx {
	const plain = visible.plain.trim();
	const sentences = buildSentenceOffsetSpans(plain);
	const { ranges, normCursor } = indexChapterSentenceRanges(
		visible.outerRange,
		plain,
		{ normCursor: normCursorStart },
	);
	return {
		plain,
		sentences,
		paragraphs: buildParagraphUnits(plain, sentences),
		sentenceRanges: ranges,
		spineIndex: visible.spineIndex,
		plainFrom: visible.plainFrom,
		nextPlainFrom: visible.nextPlainFrom,
		hasMorePlain: visible.hasMorePlain,
		normCursorStart,
		normCursor,
	};
}

/**
 * EPUB 从当前可见位置连续听书（innerText 抽正文 + playPreferred）
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
	/** 目录切章用 after，避免起播落在上一节末句；从当前位置听用 before */
	const resolveStartCfiModeRef = useRef<'before' | 'after'>('before');
	/** 听当前等：一次性覆盖 getCurrentCfi，供 applySection 定位起播句 */
	const startCfiOverrideRef = useRef<string | null>(null);
	/** 听当前：完整选区 Range（供 DOM 重叠提示） */
	const startRangeOverrideRef = useRef<Range | null>(null);
	/** 听当前：选区纯文（主定位，不依赖句级 DOM Range） */
	const startPlainOverrideRef = useRef<string | null>(null);
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
		resolveStartCfiModeRef.current = 'before';
		startCfiOverrideRef.current = null;
		startRangeOverrideRef.current = null;
		startPlainOverrideRef.current = null;
		sectionRef.current = null;
		sectionDocRef.current = null;
		stopAllPlayback();
		// 同步卸 Media Session，勿等 isActive effect：否则 macOS 仍残留进度条/控件
		registerPlaybackMediaHandlers(null);
		teardownChapterListenHighlight(getRenditionRef.current() ?? undefined);
		clearEpubListenSegmentOverlay();
		// 保留倍速：IDLE_STATE.rate=1 会把用户调速清掉
		const idle = { ...IDLE_STATE, rate: rateRef.current };
		setState(idle);
		stateRef.current = idle;
		if (opts?.notify !== false) onSessionEndRef.current?.();
	}, []);

	useEffect(() => {
		warmupSpeechVoices();
		registerChapterListenStop(() => stopInternal());
		return () => {
			registerChapterListenStop(null);
			stopInternal({ notify: false });
		};
	}, [stopInternal]);

	/** continuous trim 后重建当前章句 Range，供高亮/跟随继续跟着播放句走 */
	const rebindSectionDomRanges = useCallback((rend: Rendition): boolean => {
		const ctx = sectionRef.current;
		if (!ctx) return false;
		const visible =
			extractVisibleListenSection(rend, ctx.spineIndex, ctx.plainFrom) ??
			extractVisibleListenSection(rend, undefined, ctx.plainFrom);
		if (!visible?.outerRange) return false;
		const { ranges } = indexChapterSentenceRanges(
			visible.outerRange,
			ctx.plain,
			{ normCursor: ctx.normCursorStart },
		);
		sectionRef.current = { ...ctx, sentenceRanges: ranges };
		sectionDocRef.current = visible.outerRange.startContainer.ownerDocument;
		return ranges.some(isLiveDomRange);
	}, []);

	const remountListenDomAfterFollow = useCallback(() => {
		const rend = getRenditionRef.current();
		const ctx = sectionRef.current;
		if (!rend || !ctx) return;
		if (!rebindSectionDomRanges(rend)) return;
		const si = sentenceCursorRef.current;
		const range = sectionRef.current?.sentenceRanges[si];
		if (!range) return;
		showChapterListenSentenceHighlight(rend, range, {
			forceScroll: true,
			align: 'center',
		});
	}, [rebindSectionDomRanges]);

	useEffect(() => {
		registerChapterListenDomRemount(remountListenDomAfterFollow);
		return () => registerChapterListenDomRemount(null);
	}, [remountListenDomAfterFollow]);

	const isGenActive = (gen: number) => gen === loopGenRef.current;

	const applySection = useCallback(
		(
			rend: Rendition,
			visible: VisibleListenSection,
			normCursorStart = 0,
		): SectionCtx | null => {
			const ctx = ctxFromVisible(visible, normCursorStart);
			if (!ctx.sentences.length) return null;

			if (resolveStartCfiRef.current) {
				const cfi =
					startCfiOverrideRef.current?.trim() ||
					getCurrentCfiRef.current()?.trim() ||
					'';
				const anchorRange = startRangeOverrideRef.current;
				const selectionPlain = startPlainOverrideRef.current;
				startCfiOverrideRef.current = null;
				startRangeOverrideRef.current = null;
				startPlainOverrideRef.current = null;
				sentenceCursorRef.current = resolveListenStartSentence(
					rend,
					visible,
					cfi,
					{
						sentenceRanges: ctx.sentenceRanges,
						mode: resolveStartCfiModeRef.current,
						anchorRange,
						selectionPlain,
					},
				);
				resolveStartCfiRef.current = false;
				resolveStartCfiModeRef.current = 'before';
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
			const spineHint =
				getCurrentSpineIndexRef.current?.() ??
				listenSpineIndexFromRendition(rend);
			const prev = sectionRef.current;
			// 同 spine 续听/切句：保留 plain 分段，勿每次从 0 重切（否则分句列表在两段间循环）
			const reuse =
				prev && prev.spineIndex === spineHint && !resolveStartCfiRef.current
					? prev
					: null;
			const visible = extractVisibleListenSection(
				rend,
				spineHint,
				reuse?.plainFrom ?? 0,
			);
			if (!visible) return null;
			return applySection(rend, visible, reuse?.normCursorStart ?? 0);
		},
		[applySection],
	);

	/** 从当前句起播：首句逐句快出声，同段剩余与后续按段预取/合成 */
	const playSentencesFromCursor = useCallback(
		async (
			ctx: SectionCtx,
			gen: number,
			opts?: { scrollCenterOnFirst?: boolean },
		): Promise<boolean> => {
			const { plain, sentences, paragraphs } = ctx;
			const units =
				paragraphs.length > 0
					? paragraphs
					: buildParagraphUnits(plain, sentences);
			const rend = getRenditionRef.current();
			const loopStartSi = sentenceCursorRef.current;

			try {
				return await playListenUnitsFromCursor({
					plain,
					sentences,
					units,
					startSi: loopStartSi,
					getRate: () => rateRef.current,
					isActive: () => isGenActive(gen) && !pausedRef.current,
					scrollCenterOnFirst: opts?.scrollCenterOnFirst,
					onSentence: (globalSi, info) => {
						if (!isGenActive(gen) || pausedRef.current) return;
						sentenceCursorRef.current = globalSi;
						syncState({
							status: 'playing',
							sentenceIndex: globalSi,
							sentenceCount: sentences.length,
						});
						if (!rend) return;
						// 勿闭包钉死旧 sentenceRanges：跨章 trim 后须读 sectionRef 并按需重建
						let liveCtx = sectionRef.current;
						let domRange = liveCtx?.sentenceRanges[globalSi];
						if (!isLiveDomRange(domRange)) {
							if (!rebindSectionDomRanges(rend)) {
								clearChapterListenSentenceHighlight(rend);
								return;
							}
							liveCtx = sectionRef.current;
							domRange = liveCtx?.sentenceRanges[globalSi];
						}
						if (!isLiveDomRange(domRange)) {
							clearChapterListenSentenceHighlight(rend);
							return;
						}
						const jumpScroll = info.forceCenter
							? ({ forceScroll: true, align: 'center' as const } as const)
							: undefined;
						showChapterListenSentenceHighlight(rend, domRange, jumpScroll);
					},
					onUnitIdle: () => {
						if (rend) clearChapterListenSentenceHighlight(rend);
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
		[rebindSectionDomRanges, syncState],
	);

	/**
	 * 播完当前 plain 段后，若同文档还有截断剩余（MAX_PLAIN_CHARS），续切下一段再播，
	 * 避免误判「本书已播完」。
	 */
	const playSectionPlainChunks = useCallback(
		async (
			rend: Rendition,
			startCtx: SectionCtx,
			gen: number,
			opts?: { scrollCenterOnFirst?: boolean },
		): Promise<boolean> => {
			let ctx = startCtx;
			let scrollCenter = opts?.scrollCenterOnFirst;
			for (;;) {
				const finished = await playSentencesFromCursor(ctx, gen, {
					scrollCenterOnFirst: scrollCenter,
				});
				if (!finished) return false;
				if (!isGenActive(gen)) return false;
				if (!ctx.hasMorePlain) return true;

				const doc = sectionDocRef.current;
				if (!doc) return true;

				sentenceCursorRef.current = 0;
				resolveStartCfiRef.current = false;
				scrollSeekRef.current = true;
				syncState({ status: 'loading' });

				const visible = extractListenSectionForDocument(
					rend,
					doc,
					ctx.nextPlainFrom,
				);
				if (!visible) return true;
				const next = applySection(rend, visible, ctx.normCursor);
				if (!next) return true;
				ctx = next;
				scrollCenter = true;
			}
		},
		[applySection, playSentencesFromCursor, syncState],
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
			// 首次 / CFI：需要 prepare
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
					const prev = sectionRef.current;
					const reuse =
						prev && sectionDocRef.current === sectionDoc ? prev : null;
					// 提取该文档下的可朗读 Section（同文档保留 plainFrom）
					const visible = extractListenSectionForDocument(
						rend,
						sectionDoc,
						reuse?.plainFrom ?? 0,
					);
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
					ctx = applySection(rend, visible, reuse?.normCursorStart ?? 0);
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

				// 本节（含超长 plain 分段续听）播完
				const finished = await playSectionPlainChunks(rend, ctx, gen, {
					scrollCenterOnFirst: scrollCenter,
				});
				if (!finished) {
					// 世代已换新（切句/重开）或用户暂停：勿 stopInternal，以免误杀新会话
					if (!isGenActive(gen) || pausedRef.current) return;
					stopInternal();
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

				// 节内句子重置为 0，准备下一节（新节仍走逐句 kick）
				sentenceCursorRef.current = 0;
				resolveStartCfiRef.current = false;
				scrollSeekRef.current = true;

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
				sectionRef.current = null;
				sectionDoc = nextDoc;
				sectionDocRef.current = nextDoc;
			}
		},
		[
			applySection,
			playSectionPlainChunks,
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

				const finished = await playSectionPlainChunks(rend, ctx, gen);
				if (!finished) {
					if (!isGenActive(gen) || pausedRef.current) return;
					stopInternal();
					return;
				}

				if (!continueSections || !isGenActive(gen)) {
					stopInternal();
					return;
				}

				sentenceCursorRef.current = 0;
				resolveStartCfiRef.current = false;
				scrollSeekRef.current = true;
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
		[playSectionPlainChunks, prepareSection, stopInternal],
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
		primePlaybackForUserGesture();

		// 检查英文TTS能力是否可用（如浏览器支持等）
		if (!isPlaybackAvailable()) {
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
		stopAllPlayback();
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
		// 标记：未暂停、句子光标重置、起始Cfi解析、章节/文档引用空（倍速沿用 rateRef）
		pausedRef.current = false;
		sentenceCursorRef.current = 0;
		resolveStartCfiRef.current = true;
		resolveStartCfiModeRef.current = 'before';
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

	/**
	 * 从指定 CFI / 选区起听书并续读（微信读书「听当前」）。
	 * selectionPlain 为主定位；anchorRange 仅作并列歧义时的 DOM 提示。
	 */
	const startFromCfi = useCallback(
		(
			cfi: string,
			mode: 'before' | 'after' = 'after',
			anchorRange?: Range | null,
			selectionPlain?: string | null,
		) => {
			const trimmed = cfi.trim();
			const plain = selectionPlain?.trim() || '';
			if (!trimmed && !anchorRange && !plain) {
				startFromCurrentPosition();
				return;
			}

			primePlaybackForUserGesture();
			if (!isPlaybackAvailable()) {
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
			stopAllPlayback();
			clearEpubListenSegmentOverlay();
			beginChapterListenAutoFollow(rend);

			let anchor: Range | null = null;
			if (anchorRange) {
				try {
					anchor = anchorRange.cloneRange();
				} catch {
					anchor = null;
				}
			}

			const armStart = () => {
				startCfiOverrideRef.current = trimmed || null;
				startRangeOverrideRef.current = anchor;
				startPlainOverrideRef.current = plain || null;
				resolveStartCfiRef.current = true;
				resolveStartCfiModeRef.current = mode;
			};

			const beginWithPreview = (preview: VisibleListenSection): boolean => {
				if (!preview.plain.trim()) return false;
				armStart();
				const gen = ++loopGenRef.current;
				pausedRef.current = false;
				sentenceCursorRef.current = 0;
				sectionRef.current = null;
				sectionDocRef.current = preview.outerRange.startContainer.ownerDocument;
				const plain = preview.plain.trim();
				const sentences = buildSentenceOffsetSpans(plain);
				syncState({
					status: 'loading',
					spineIndex: preview.spineIndex,
					sentenceIndex: 0,
					sentenceCount: sentences.length,
					sentenceLabels: buildSentenceLabels(plain, sentences),
					rate: rateRef.current,
				});
				void runListenLoop(gen);
				return true;
			};

			const spineHint =
				getCurrentSpineIndexRef.current?.() ??
				listenSpineIndexFromRendition(rend);
			const visible = extractVisibleListenSection(rend, spineHint);
			if (visible && beginWithPreview(visible)) return;

			void (async () => {
				try {
					if (trimmed) await rend.display(trimmed);
				} catch {
					// display 失败仍尝试抽当前可见节
				}
				for (let attempt = 0; attempt < 25; attempt += 1) {
					if (attempt > 0) {
						await new Promise<void>((r) => {
							window.setTimeout(r, 80);
						});
					} else {
						await new Promise<void>((r) => {
							requestAnimationFrame(() => requestAnimationFrame(() => r()));
						});
					}
					const hint =
						getCurrentSpineIndexRef.current?.() ??
						listenSpineIndexFromRendition(rend);
					const preview =
						extractVisibleListenSection(rend, hint) ??
						extractVisibleListenSection(rend);
					if (preview && beginWithPreview(preview)) return;
				}
				startCfiOverrideRef.current = null;
				startRangeOverrideRef.current = null;
				startPlainOverrideRef.current = null;
				Toast({
					type: 'warning',
					title: tRef.current('ebook.read.listenBook.emptySection'),
				});
			})();
		},
		[runListenLoop, startFromCurrentPosition, syncState],
	);

	/**
	 * 目录/切章完成后重开听书：按跳转后 CFI 定位起播句（同 HTML 多节时非文件第 0 句）。
	 */
	const restartFromChapterStart = useCallback(() => {
		if (!isPlaybackAvailable()) {
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

		primePlaybackForUserGesture();
		const keepRate = rateRef.current;

		invokeStopQuoteListen();
		stopAllPlayback();
		clearEpubListenSegmentOverlay();
		beginChapterListenAutoFollow(rend);

		void (async () => {
			// 等跳转后的章文档可读（go 已 settle，再补几帧 + 重试）
			let preview: VisibleListenSection | null = null;
			for (let attempt = 0; attempt < 25; attempt += 1) {
				if (attempt > 0) {
					await new Promise<void>((r) => {
						window.setTimeout(r, 80);
					});
				} else {
					await new Promise<void>((r) => {
						requestAnimationFrame(() => requestAnimationFrame(() => r()));
					});
				}
				const spineHint =
					getCurrentSpineIndexRef.current?.() ??
					listenSpineIndexFromRendition(rend);
				preview =
					extractVisibleListenSection(rend, spineHint) ??
					extractVisibleListenSection(rend);
				if (preview?.plain.trim()) break;
				preview = null;
			}

			if (!preview?.plain.trim()) {
				Toast({
					type: 'warning',
					title: tRef.current('ebook.read.listenBook.emptySection'),
				});
				return;
			}

			const gen = ++loopGenRef.current;
			pausedRef.current = false;
			rateRef.current = keepRate;
			sentenceCursorRef.current = 0;
			// 目录 / 底栏切章：按目标 CFI「处或之后」第一句起播（勿取上一节末句）
			resolveStartCfiRef.current = true;
			resolveStartCfiModeRef.current = 'after';
			scrollSeekRef.current = true;
			sectionRef.current = null;
			// 置空 → usePrepare=true，与正常听书首段同一路径（勿钉死旧 sectionDoc）
			sectionDocRef.current = null;

			const plain = preview.plain.trim();
			const sentences = buildSentenceOffsetSpans(plain);
			syncState({
				status: 'loading',
				spineIndex: preview.spineIndex,
				sentenceIndex: 0,
				sentenceCount: sentences.length,
				sentenceLabels: buildSentenceLabels(plain, sentences),
				rate: keepRate,
			});

			void runListenLoop(gen);
		})();
	}, [runListenLoop, syncState]);

	const pause = useCallback(() => {
		const status = stateRef.current.status;
		if (status !== 'playing' && status !== 'loading') return;
		pausedRef.current = true;
		// 软暂停：不杀 loopGen / 不 abort TTS wait，续播从 currentTime 继续
		pausePlaybackSoft();
		syncState({ status: 'paused' });
	}, [syncState]);

	const resume = useCallback(() => {
		if (stateRef.current.status !== 'paused') return;
		pausedRef.current = false;
		if (resumePlaybackSoft()) {
			syncState({ status: 'playing' });
			return;
		}
		// 无已挂起音频（如暂停发生在合成返回前）：从当前句重开循环
		const gen = ++loopGenRef.current;
		syncState({ status: 'loading' });
		void runListenLoop(gen, { continueSections: true });
	}, [runListenLoop, syncState]);

	const pauseRef = useRef(pause);
	pauseRef.current = pause;
	const resumeRef = useRef(resume);
	resumeRef.current = resume;

	const stop = useCallback(
		(opts?: { notify?: boolean }) => {
			stopInternal(opts);
		},
		[stopInternal],
	);

	const goToSentence = useCallback(
		(index: number) => {
			const ctx = sectionRef.current;
			if (!ctx?.sentences.length) return;

			const next = Math.min(ctx.sentences.length - 1, Math.max(0, index));
			sentenceCursorRef.current = next;
			scrollSeekRef.current = true;
			stopAllPlayback();
			pausedRef.current = false;

			const gen = ++loopGenRef.current;
			syncState({
				sentenceIndex: next,
				sentenceCount: ctx.sentences.length,
				sentenceLabels: buildSentenceLabels(ctx.plain, ctx.sentences),
				status: 'playing',
			});

			// 先高亮目标句，避免 Range 未就绪时残留上一句大块背景
			const rend = getRenditionRef.current();
			const jumpRange = ctx.sentenceRanges[next];
			if (rend && isLiveDomRange(jumpRange)) {
				showChapterListenSentenceHighlight(rend, jumpRange, {
					forceScroll: true,
					align: 'center',
				});
			} else if (rend) {
				clearChapterListenSentenceHighlight(rend);
			}

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
			applyActivePlaybackRate(rate);
			syncState({ rate });
		},
		[syncState],
	);

	const togglePlay = useCallback(() => {
		const status = stateRef.current.status;
		// loading = 当前句 TTS 等待中，允许点暂停取消等待
		if (status === 'playing' || status === 'loading') {
			pause();
			return;
		}
		if (status === 'paused') {
			resume();
		}
	}, [pause, resume]);

	const isActive =
		state.status === 'loading' ||
		state.status === 'playing' ||
		state.status === 'paused';

	useEffect(() => {
		if (!isActive) return;
		registerPlaybackMediaHandlers({
			play: () => resumeRef.current(),
			pause: () => pauseRef.current(),
		});
		return () => registerPlaybackMediaHandlers(null);
	}, [isActive]);

	/** 当前分句播头 CFI：底栏上下章定位目录用（勿用阅读 relocated CFI，会滞后） */
	const getPlayheadCfi = useCallback((): string | undefined => {
		const rend = getRenditionRef.current();
		const ctx = sectionRef.current;
		const fallback = getCurrentCfiRef.current()?.trim() || undefined;
		if (!rend || !ctx) return fallback;
		const range = ctx.sentenceRanges[sentenceCursorRef.current];
		if (!range) return fallback;
		try {
			return cfiFromDomRange(rend, range)?.trim() || fallback;
		} catch {
			return fallback;
		}
	}, []);

	return {
		...state,
		isActive,
		toggleChapterListen,
		togglePlay,
		pause,
		resume,
		stop,
		restartFromChapterStart,
		startFromCfi,
		prevSentence: () => seekSentence(-1),
		nextSentence: () => seekSentence(1),
		goToSentence,
		setRate,
		getPlayheadCfi,
	};
}
