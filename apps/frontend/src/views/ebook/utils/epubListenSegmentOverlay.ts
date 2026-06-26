/**
 * EPUB 听书/听当前段落「句级滚动」管理模块
 *
 * 主要功能：
 * 1. 维护当前听书（或听当前）会话，基于 plain 文本句表精准定位与管理章节内所有句子的 Range。
 * 2. 支持自动跟随（autoFollow）：每句播放时监听句索引变化，确保当前句 DOM Range 自动滚入 EPUB 视口。
 * 3. 仅负责句表索引与滚动逻辑，不处理任何视觉高亮、背景渲染；所有高亮完全交由 epubListenMarkHighlight
 *    实现（包括 SVG patch 或 epub.js annotation）。
 * 4. 提供 session 生命周期管理：句表初始化、句索引跳转、Range 记忆和恢复、滚动控制、防止滚动冲突等辅助能力。
 *
 * 使用说明：
 * - 外部调用 showListenMarkHighlight/clearListenMarkHighlight 控制句级高亮。
 * - 调整 autoFollow 状态及当前播放索引，可自动滚动目标句。
 * - 内部自动协调与 EPUB 滚动容器的交互，避免过度触发 scroll 事件影响阅读体验。
 *
 * 设计边界：
 * - 本模块绝不直接操作视觉高亮（包括样式注入、SVG 绘制等）。
 * - 仅当句表合理初始化/同步时，方提供精确的句级滚动能力。
 * - 非句表（如全文 TTS）或 DOM 缺失时不会影响主流程，但部分滚动功能受限。
 */
import type { Rendition } from 'epubjs';
import { stripMarkdownForTts } from '@/utils/englishTts';
import {
	clearListenMarkHighlight,
	showListenMarkHighlight,
} from './epubListenMarkHighlight';
import {
	anchorToRange,
	buildDomSentenceIndex,
	type DomListenSentence,
	sentenceToRange,
} from './epubListenSentenceIndex';
import {
	cfiFromDomRange,
	normalizeSelectionRangeForEpub,
	resolveCfiDomRange,
} from './epubRangeGeometry';
import {
	getEpubScrollContainer,
	scrollEpubRangeIntoView,
} from './epubScrolledNav';

export {
	EPUB_LISTEN_HIGHLIGHT_CLASS,
	EPUB_LISTEN_SEGMENT_FILL,
} from './epubListenMarkHighlight';

export type EpubListenAutoFollowState = {
	active: boolean;
	autoFollow: boolean;
};

type ListenSession = {
	rend: Rendition;
	plain: string;
	cfi: string;
	outerRange: Range | null;
	sentences: DomListenSentence[];
	epoch: number;
	autoFollow: boolean;
	lastSentenceIndex: number;
	/** 听书等无句表 session：直接存当前句 DOM Range 供滚入视口 */
	activeDomRange: Range | null;
};

let session: ListenSession | null = null;
let overlayEpoch = 0;
let detachScrollGuard: (() => void) | null = null;
let rememberedPopBarRange: Range | null = null;
let programmaticScroll = 0;
let userScrolling = false;
let scrollSettleTimer = 0;
let pendingFollowScroll = false;
const followListeners = new Set<(state: EpubListenAutoFollowState) => void>();

function emitAutoFollowState(): void {
	const state: EpubListenAutoFollowState = {
		active: session != null,
		autoFollow: session?.autoFollow ?? true,
	};
	for (const fn of followListeners) fn(state);
}

export function subscribeEpubListenAutoFollow(
	listener: (state: EpubListenAutoFollowState) => void,
): () => void {
	followListeners.add(listener);
	emitAutoFollowState();
	return () => followListeners.delete(listener);
}

function isRangeConnected(range: Range | null): range is Range {
	if (!range) return false;
	try {
		void range.startContainer.nodeName;
		return true;
	} catch {
		return false;
	}
}

function getContents(
	rend: Rendition,
): Array<{ document: Document; window: Window }> {
	const raw = rend.getContents();
	return Array.isArray(raw)
		? raw
		: raw
			? [raw as { document: Document; window: Window }]
			: [];
}

export function cloneActiveEpubSelection(rend: Rendition): Range | null {
	for (const { window: w } of getContents(rend)) {
		const sel = w.getSelection();
		if (!sel || sel.isCollapsed || !sel.rangeCount) continue;
		const raw = sel.getRangeAt(0);
		if (!raw.toString().trim()) continue;
		return normalizeSelectionRangeForEpub(raw) ?? raw.cloneRange();
	}
	return null;
}

export function rememberEpubPopBarSelectionRange(range: Range | null): void {
	rememberedPopBarRange =
		range && isRangeConnected(range) ? range.cloneRange() : null;
}

export function getRememberedEpubPopBarSelectionRange(): Range | null {
	if (!isRangeConnected(rememberedPopBarRange)) {
		rememberedPopBarRange = null;
		return null;
	}
	return rememberedPopBarRange.cloneRange();
}

function rebuildSessionSentences(active: ListenSession): void {
	if (!active.outerRange?.startContainer.isConnected) return;
	const stale = active.sentences.some(
		(s) => s.anchor && !anchorToRange(s.anchor),
	);
	if (!stale && active.sentences.length > 0) return;
	const index = buildDomSentenceIndex(active.outerRange);
	active.sentences = index.sentences;
	if (index.plain) active.plain = index.plain;
}

function resolveSentenceRange(
	active: ListenSession,
	sentenceIndex: number,
): Range | null {
	if (!active.outerRange?.startContainer.isConnected) return null;

	rebuildSessionSentences(active);

	const sent = active.sentences[sentenceIndex];
	if (!sent) return null;
	return sentenceToRange(sent);
}

/**
 * 判断两个 DOM Range 是否“等价”（即起止节点和偏移量均一致）。
 * 适用于比较某一选区是否与当前活跃 Range 为同一 DOM 区段，
 * 针对跨文档、不可访问或处于异常状态的 range，捕获异常并安全返回 false。
 *
 * @param a 第一个 Range 对象
 * @param b 第二个 Range 对象
 * @returns 两 Range 的起止节点和偏移量完全一致时返回 true，否则返回 false
 */
function rangesEqual(a: Range, b: Range): boolean {
	try {
		// 判断 start/end 节点引用及 offset 是否完全一致
		return (
			a.startContainer === b.startContainer && // 起始节点相同
			a.startOffset === b.startOffset && // 起始偏移量相同
			a.endContainer === b.endContainer && // 终止节点相同
			a.endOffset === b.endOffset // 终止偏移量相同
		);
	} catch {
		// 若任一 Range 已被销毁或跨域异常，安全降级为不等价
		return false;
	}
}

/**
 * 获取当前活跃的朗读（听书）DOM Range。
 * 优先返回当前句子的区间，否则若无句索引，但有活跃 DOM Range，则返回其克隆。
 * 主要用于朗读进度关联的可视区选取。
 *
 * 1. 若 session 不存在，直接返回 null。
 * 2. 若 session.lastSentenceIndex ≥ 0，返回当前句（lastSentenceIndex 所指向）的 Range，优先保证句级定位。
 * 3. 如无可用句索引但 activeDomRange 仍然连接在文档结构上，则克隆并返回该 Range（避免 Range 被外部改动影响）。
 * 4. 均不满足则返回 null。
 *
 * @returns {Range | null} 当前朗读句子的 DOM Range，或未激活时为 null
 */
function resolveActiveListenDomRange(): Range | null {
	// 若无 session（未启动朗读），无法确定活跃 Range，直接返回 null
	if (!session) return null;

	// 若当前有有效句索引，则直接解析该句对应的 DOM Range
	if (session.lastSentenceIndex >= 0) {
		return resolveSentenceRange(session, session.lastSentenceIndex);
	}

	// 若没有句索引，但 session 记录了一个仍连接在文档的 Range，返回其副本
	if (isRangeConnected(session.activeDomRange)) {
		return session.activeDomRange.cloneRange();
	}

	// 以上条件均不满足（无句索引，无有效 DOM Range），返回 null
	return null;
}

async function withProgrammaticScroll<T>(run: () => Promise<T>): Promise<T> {
	programmaticScroll += 1;
	try {
		return await run();
	} finally {
		requestAnimationFrame(() => {
			programmaticScroll = Math.max(0, programmaticScroll - 1);
		});
	}
}

function scrollActiveListenIntoView(): void {
	if (!session) return;
	const range = resolveActiveListenDomRange();
	if (!range) return;
	const { rend, cfi, epoch } = session;
	void withProgrammaticScroll(async () => {
		await scrollEpubRangeIntoView(rend, range, cfi);
		if (!session || session.epoch !== epoch) return;
	});
}

function pauseListenAutoFollow(): void {
	if (!session?.autoFollow) return;
	session.autoFollow = false;
	emitAutoFollowState();
}

function scheduleScrollSettle(): void {
	clearTimeout(scrollSettleTimer);
	scrollSettleTimer = window.setTimeout(() => {
		userScrolling = false;
		if (!pendingFollowScroll || !session?.autoFollow) {
			pendingFollowScroll = false;
			return;
		}
		pendingFollowScroll = false;
		scrollActiveListenIntoView();
	}, 150);
}

function attachListenScrollGuard(rend: Rendition): () => void {
	const cleanups: (() => void)[] = [];
	const onUserScrollIntent = () => {
		if (programmaticScroll > 0) return;
		userScrolling = true;
		pauseListenAutoFollow();
		scheduleScrollSettle();
	};
	const bind = (target: EventTarget | null | undefined) => {
		if (!target) return;
		target.addEventListener('scroll', onUserScrollIntent, { passive: true });
		cleanups.push(() =>
			target.removeEventListener('scroll', onUserScrollIntent),
		);
	};
	const container = getEpubScrollContainer(rend);
	if (container) {
		bind(container);
		container.addEventListener('wheel', onUserScrollIntent, { passive: true });
		cleanups.push(() =>
			container.removeEventListener('wheel', onUserScrollIntent),
		);
	}
	const bindContents = (contents: { document: Document }) => {
		bind(
			contents.document.scrollingElement ?? contents.document.documentElement,
		);
	};
	rend.hooks.content.register(bindContents);
	for (const item of getContents(rend)) bindContents(item);
	return () => {
		for (const fn of cleanups) fn();
	};
}

function requestListenAutoFollowScroll(): void {
	if (!session?.autoFollow) return;
	if (userScrolling) {
		pendingFollowScroll = true;
		scheduleScrollSettle();
		return;
	}
	scrollActiveListenIntoView();
}

function resolveListenSessionSelectionRange(
	rend: Rendition,
	opts?: { cfi?: string; selectionRange?: Range | null },
): Range | null {
	if (opts?.selectionRange && isRangeConnected(opts.selectionRange)) {
		return opts.selectionRange.cloneRange();
	}
	const cfi = opts?.cfi?.trim() ?? '';
	if (!cfi) return null;
	const fromCfi = resolveCfiDomRange(rend, cfi);
	return fromCfi ? fromCfi.cloneRange() : null;
}

function paintSentence(sentenceIndex: number): void {
	if (!session || sentenceIndex < 0) return;

	const range = resolveSentenceRange(session, sentenceIndex);
	if (!range) return;

	const isNew = session.lastSentenceIndex !== sentenceIndex;
	session.lastSentenceIndex = sentenceIndex;
	// 换句先清再画，避免 …… 句与中间句叠层
	if (isNew) clearListenMarkHighlight(session.rend);
	showListenMarkHighlight(session.rend, range);
	if (isNew && session.autoFollow) requestListenAutoFollowScroll();
}

export function beginEpubListenOverlaySession(
	rend: Rendition,
	plainText: string,
	opts?: { cfi?: string; selectionRange?: Range | null },
): void {
	const preserveAutoFollow = session?.autoFollow ?? true;
	clearEpubListenSegmentOverlay();

	const outerRange = resolveListenSessionSelectionRange(rend, opts);
	let plain = plainText.trim();
	let sentences: DomListenSentence[] = [];
	if (outerRange) {
		const index = buildDomSentenceIndex(outerRange);
		sentences = index.sentences;
		if (index.plain) plain = index.plain;
	}
	if (!plain) return;

	overlayEpoch += 1;
	session = {
		rend,
		plain,
		cfi:
			opts?.cfi?.trim() ??
			(outerRange ? (cfiFromDomRange(rend, outerRange) ?? '') : ''),
		outerRange,
		sentences,
		epoch: overlayEpoch,
		autoFollow: preserveAutoFollow,
		lastSentenceIndex: -1,
		activeDomRange: null,
	};
	detachScrollGuard = attachListenScrollGuard(rend);
	emitAutoFollowState();
}

export function resumeEpubListenAutoFollow(): void {
	if (!session) return;
	session.autoFollow = true;
	pendingFollowScroll = false;
	emitAutoFollowState();
	scrollActiveListenIntoView();
}

/**
 * 确保章节级 DOM 听书 Session 存在（如果不存在则新建）。
 *
 * 主要用途：
 * - 章节/区段高亮（非句级）场景下维护一个 session 状态，以便后续操作（如滚动、高亮等）有据可循。
 * - 若 session 已存在且符合条件（相同 Rendition 且内容字段均为空），则直接复用当前 session。
 * - 否则清理上一次的 session，并初始化一个空的章节级 session。
 *
 * @param rend - 当前章节对应的 EPUB Rendition 实例
 * @returns 新建或复用的章节级 ListenSession 对象
 */
function ensureChapterDomListenSession(rend: Rendition): ListenSession {
	// 若当前 session 已初始化且：
	// 1. rend 与期望相同
	// 2. 没有句表（plain/outerRange 均为空，sentences 长度为 0）
	// 则复用已有 session，无需重新构建
	if (
		session?.rend === rend &&
		!session.plain &&
		!session.outerRange &&
		!session.sentences.length
	) {
		return session;
	}
	// 记录 autoFollow 现有状态，后续初始化需保留
	const preserveAutoFollow = session?.autoFollow ?? true;
	// 清除旧的听书区段 overlay（保证唯一性）
	clearEpubListenSegmentOverlay();
	// 更新全局 epoch（用于标记 session 版本/变更）
	overlayEpoch += 1;
	// 构建新的章节 ListenSession（所有内容清空，适用于段/区块高亮模式）
	session = {
		rend, // 关联的 EPUB Rendition
		plain: '', // 不涉及原文句表（空字符串）
		cfi: '', // 不涉及 CFI（空字符串）
		outerRange: null, // 不涉及章节主外层选区
		sentences: [], // 不涉及句子列表（空数组）
		epoch: overlayEpoch, // 版本标记
		autoFollow: preserveAutoFollow, // 恢复 autoFollow 状态
		lastSentenceIndex: -1, // 没有句索引，设为 -1
		activeDomRange: null, // 活动区段 DOM Range 清空
	};
	// 重新绑定滚动拦截器（用于 autoFollow、用户手动滚动检测）
	detachScrollGuard = attachListenScrollGuard(rend);
	// 向监听方同步 autoFollow 状态
	emitAutoFollowState();
	// 返回当前 session
	return session;
}

/**
 * 将指定 DOM Range 显示为当前 EPUB 听书“活跃区段”/高亮句。
 *
 * 整体步骤：
 * 1. 检查目标 Range 是否仍挂载在文档内（避免已被移除的区段）。
 * 2. 对目标 Range 进行标准化（兼容 epub.js 的特殊选区），以获得规范的区段用于后续高亮。
 * 3. 通过 ensureChapterDomListenSession 获取或初始化当前章节的听书/听段 session 信息。
 * 4. 判断本次要高亮的 snapspped Range 是否与 session 记录的上一次区段（activeDomRange）等价，
 *    - 不等价或首次高亮时，清除历史残留高亮（clearListenMarkHighlight），保证当前高亮唯一。
 * 5. 无论新旧都更新 session 信息（active.lastSentenceIndex 置为 -1，activeDomRange 替换为最新副本）。
 * 6. 始终显示区段高亮（showListenMarkHighlight）。
 * 7. 若为新高亮且自动跟随（autoFollow）启用，则请求自动滚动目标区段进视口。
 *
 * @param rend    EPUB Rendition 实例
 * @param range   需高亮的 DOM 区段
 */
export function showEpubListenDomRange(rend: Rendition, range: Range): void {
	// 若目标区段已失联，则不做任何操作
	if (!isRangeConnected(range)) return;

	// 规范化 Range，确保选区具有一致坐标（去除 HTML markup、跨文档副本等差异性）
	const snapped =
		normalizeSelectionRangeForEpub(range.cloneRange()) ?? range.cloneRange();

	// 获取当前章节的 session，若无则初始化一个 Dummy Session
	const active = ensureChapterDomListenSession(rend);

	// 记录本次高亮前的 activeDomRange 用于对比是否要重置高亮
	const prev = active.activeDomRange;

	// 若 activeDomRange 尚未存在，或与当前 snapped 区段不完全等价，认为是“新的高亮”需要清除旧高亮
	const isNew = !prev || !rangesEqual(prev, snapped);

	// 清零句索引（本模式为段/选区高亮，不对应具体句；如需句索引由外层逻辑维护）
	active.lastSentenceIndex = -1;

	// 更新 session 中当前活跃的 DOM Range，存副本避免受后续外部更改污染
	active.activeDomRange = snapped.cloneRange();

	// 若是新高亮，需要清除所有上一次的视觉高亮以避免重影/残留
	if (isNew) clearListenMarkHighlight(rend);

	// 显示当前 snapped 区段的高亮效果（具体渲染交由 epubListenMarkHighlight 实现）
	showListenMarkHighlight(rend, snapped);

	// 若新高亮且处于自动跟随（autoFollow）状态，则请求自动滚动，确保区段近视口
	if (isNew && active.autoFollow) requestListenAutoFollowScroll();
}

/** 听书启动：注册滚动监听，首句高亮前即可响应用户打断与 FAB */
export function beginChapterListenAutoFollow(rend: Rendition): void {
	const active = ensureChapterDomListenSession(rend);
	active.autoFollow = true;
	emitAutoFollowState();
}

export function syncChapterListenScrollSession(
	rend: Rendition,
	range: Range,
): void {
	showEpubListenDomRange(rend, range);
}

/**
 * 获取 EPUB 听书可用于 TTS（文本转语音）的纯文本字符串，并返回相关 Range。
 *
 * 依据优先级，决定最终使用的选区范围和用于朗读的文本：
 * 1. 若传入的 frozenRange 存在且已连接到文档，优先选用其克隆副本；
 * 2. 否则尝试恢复上次存储的 PopBar 选区 Range；
 * 3. 如均无，则若传入 rend，克隆此 Rendition 内当前的 Selection；
 * 4. 若最终无 Range（如无选区），则回退为 fallbackText 原始文本（去除空白）。
 *
 * 处理后会将 Range (selectionRange) 与其提取的原始文本 (spokenRaw)，再对文本做 stripMarkdownForTts，得到最终可 TTS 的 plain 纯文本。
 *
 * @param rend        目标 EPUB Rendition 实例，用于跨文档查找当前选区
 * @param fallbackText 默认回退字符串（例如无选区或不可用时）
 * @param frozenRange  固定（已捕获或记忆）的 DOM Range，用于优先选取朗读目标区间
 * @returns { plain, selectionRange, spokenRaw }
 *   plain           ：处理后的、去除Markdown等杂质的 TTS 纯文本
 *   selectionRange  ：实际用于提取文本的 Range，可能为 null
 *   spokenRaw       ：从 Range 提取出的原始文本（或 fallbackText 去空白）
 */
export function resolveEpubListenPlain(
	rend: Rendition | null,
	fallbackText: string,
	frozenRange?: Range | null,
): { plain: string; selectionRange: Range | null; spokenRaw: string } {
	// 先对传入 fallbackText 去掉首尾空白
	const trimmed = fallbackText.trim();

	// 尝试获取优先级最高的 Range：已连接的 frozenRange > 记忆的 PopBar 选区 > 当前 rendition 的选区 > null
	const selectionRange =
		frozenRange && isRangeConnected(frozenRange)
			? // 如果 frozenRange 存在且已接入 DOM，则克隆此 Range
				frozenRange.cloneRange()
			: // 否则尝试回退
				(getRememberedEpubPopBarSelectionRange() ?? // 优先取记忆中的 PopBar 选区
				(rend ? cloneActiveEpubSelection(rend) : null)); // 再看是否能从当前 Rendition 得到活跃选区

	// 用选区 Range 提取原始文本（若无 Range 或选区内容为空，则使用 fallbackText.trim()）
	const spokenRaw = selectionRange?.toString().trim() || trimmed;

	// 去掉 Markdown 标记等杂质，得到最终用于 TTS 的纯文本 plain
	const plain = stripMarkdownForTts(spokenRaw);

	// 返回最终提取结果
	return { plain, selectionRange, spokenRaw };
}

export function showEpubListenPlainSpan(
	_plainStart: number,
	_plainEnd: number,
	sentenceIndex = 0,
): void {
	void _plainStart;
	void _plainEnd;
	if (!session) return;
	paintSentence(sentenceIndex);
}

export function showEpubListenSentence(
	sentenceIndex: number,
	_chunkText?: string,
): void {
	void sentenceIndex;
	void _chunkText;
}

export function getEpubListenSessionPlain(): string | null {
	return session?.plain ?? null;
}

export function clearActiveListenHighlight(rend?: Rendition): void {
	const target = rend ?? session?.rend;
	if (!target) return;
	clearListenMarkHighlight(target);
	if (session) {
		session.lastSentenceIndex = -1;
		session.activeDomRange = null;
	}
}

export function clearEpubListenSentenceOverlay(): void {
	clearActiveListenHighlight();
}

export function clearEpubListenSegmentOverlay(): void {
	const rend = session?.rend ?? null;
	clearListenMarkHighlight(rend ?? undefined);
	overlayEpoch += 1;
	session = null;
	detachScrollGuard?.();
	detachScrollGuard = null;
	clearTimeout(scrollSettleTimer);
	scrollSettleTimer = 0;
	userScrolling = false;
	pendingFollowScroll = false;
	emitAutoFollowState();
}
