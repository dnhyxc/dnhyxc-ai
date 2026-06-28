/**
 * 听当前/听书 session：句表索引、autoFollow 滚入视口、PopBar 选区记忆、互斥 stop。
 * 视觉高亮由 epubListenMarkHighlight 负责。
 */
import type { Rendition } from 'epubjs';
import {
	buildSentenceOffsetSpans,
	stripMarkdownForTts,
} from '@/utils/englishTts';
import {
	cfiFromDomRange,
	forEachTextNodeInRange,
	normalizeSelectionRangeForEpub,
	resolveCfiDomRange,
} from '../mark/epubRangeGeometry';
import {
	getEpubScrollContainer,
	scrollEpubRangeIntoView,
	scrollEpubRangeToViewCenter,
} from '../reader/epubScrolledNav';
import {
	clearListenMarkHighlight,
	showListenMarkHighlight,
} from './epubListenMarkHighlight';

export {
	EPUB_LISTEN_HIGHLIGHT_CLASS,
	EPUB_LISTEN_SEGMENT_FILL,
} from './epubListenMarkHighlight';

// --- 听当前：选区 DOM 字符流 → 句锚点（原 epubListenSentenceIndex）---

export type DomTextAnchor = {
	startNode: Text;
	startOffset: number;
	endNode: Text;
	endOffset: number;
};

export type DomListenSentence = {
	spokenRaw: string;
	anchor: DomTextAnchor | null;
};

type TextPoint = { node: Text; offset: number };

function isVisibleTextNode(node: Text): boolean {
	const el = node.parentElement;
	if (!el) return false;
	return !el.closest('script, style, noscript, [hidden], svg');
}

/**
 * 提取 Range 区间内的纯文本流及字符到 DOM Text 节点的映射点列表
 * - 跳过不可见文本节点
 * - 合并所有空白字符为单一空格
 * - points 中的每项与 plain 的每个字符一一对应
 * - 空白合并保证 TTS（语音合成）所需的 plain、位置与原 DOM 匹配
 *
 * @param outer - 要遍历的 DOM Range 区间
 * @returns 纯文本流 plain 及其每一字符对应的 DOM Text 节点与 offset（points）
 */
function collectPlainStream(outer: Range): {
	plain: string;
	points: TextPoint[];
} {
	// points: 纯文本每一字符对应的 { node, offset } 映射
	const points: TextPoint[] = [];
	// plain: 去除多余空白后的纯文本
	let plain = '';
	// pendingSpace: 标记上一次遇到空白，等待下个非空字符合并为 1 个空格
	let pendingSpace = false;

	// 遍历 outer Range 内的所有文本节点 (每次传入节点及本节点区间范围)
	forEachTextNodeInRange(outer, (node, start, end) => {
		// 跳过 script/style/svg/隐藏节点等不可见 text
		if (!isVisibleTextNode(node)) return;
		// 遍历该文本节点的每个字符索引
		for (let offset = start; offset < end; offset += 1) {
			const ch = node.data[offset];
			if (!ch) continue; // 防御
			// 如遇 unicode 空白字符则等待合并
			if (/\s/u.test(ch)) {
				if (plain.length > 0) pendingSpace = true;
				continue;
			}
			// 若之前遇到空白，遇到第一个非空白字符时合并为 1 个空格，并记录其点
			if (pendingSpace) {
				plain += ' ';
				points.push({ node, offset });
				pendingSpace = false;
			}
			// 添加当前字符及其位置
			plain += ch;
			points.push({ node, offset });
		}
	});

	// 末尾多余空格与点剔除，保证纯文本尾部无多余空间
	while (plain.endsWith(' ')) {
		plain = plain.slice(0, -1);
		points.pop();
	}

	// 返回合并空白后的纯文本及其对应字符点映射
	return { plain, points };
}

function anchorFromPoints(
	points: TextPoint[],
	plain: string,
	spanStart: number,
	spanEnd: number,
): DomTextAnchor | null {
	if (points.length !== plain.length) return null;
	if (spanStart < 0 || spanEnd > plain.length || spanStart >= spanEnd)
		return null;

	const first = points[spanStart]!;
	const last = points[spanEnd - 1]!;
	return {
		startNode: first.node,
		startOffset: first.offset,
		endNode: last.node,
		endOffset: last.offset + 1,
	};
}

function anchorToRange(anchor: DomTextAnchor): Range | null {
	try {
		if (!anchor.startNode.isConnected || !anchor.endNode.isConnected) {
			return null;
		}
		const doc = anchor.startNode.ownerDocument;
		if (!doc) return null;
		const range = doc.createRange();
		range.setStart(anchor.startNode, anchor.startOffset);
		range.setEnd(anchor.endNode, anchor.endOffset);
		return range;
	} catch {
		return null;
	}
}

function sentenceToRange(sentence: DomListenSentence): Range | null {
	if (!sentence.anchor) return null;
	return anchorToRange(sentence.anchor);
}

function sentencesWithoutAnchors(trimmed: string): DomListenSentence[] {
	return buildSentenceOffsetSpans(trimmed)
		.map(({ start, end }) => ({
			spokenRaw: trimmed.slice(start, end).trim(),
			anchor: null,
		}))
		.filter((s) => s.spokenRaw);
}

/**
 * 根据传入的 Range，提取纯文本和每句话（带锚点）的列表
 * @param outer - DOM Range，待分句的文本区间
 * @returns 包含去空白的纯文本以及按句切分的数组，含每句在原 DOM 的锚点信息
 */
function buildDomSentenceIndex(outer: Range): {
	plain: string;
	sentences: DomListenSentence[];
} {
	// 从 Range 中提取所有文本及其对应 DOM 位置点
	const { plain, points } = collectPlainStream(outer);
	// 去除前后空白，获得 trimmed 纯文本
	const trimmed = plain.trim();
	// 若去空白后文本为空，直接返回空结构
	if (!trimmed) return { plain: '', sentences: [] };

	// 计算前导空白字符数量
	const lead = plain.length - plain.trimStart().length;
	// 修剪 points，使其只覆盖 trimmed 部分（去除前后空白对应的点）
	const trimmedPoints = points.slice(lead, lead + trimmed.length);
	// 如果修正后 points 长度与 trimmed 不符，放弃锚点，仅返回纯文本分句
	if (trimmedPoints.length !== trimmed.length) {
		return { plain: trimmed, sentences: sentencesWithoutAnchors(trimmed) };
	}

	// 存储分句及其锚点
	const sentences: DomListenSentence[] = [];
	// 对 trimmed 进行分句，遍历每个句子的起止 offset
	for (const { start, end } of buildSentenceOffsetSpans(trimmed)) {
		// 提取该句的原始文本并去除前后空白
		const spokenRaw = trimmed.slice(start, end).trim();
		// 如果句子内容为空，跳过
		if (!spokenRaw) continue;
		// 尝试根据 points 计算该句的锚点
		const anchor = anchorFromPoints(trimmedPoints, trimmed, start, end);
		// 将结果加入 sentences 数组
		sentences.push({ spokenRaw, anchor });
	}

	// 返回最终的纯文本和分句数组
	return { plain: trimmed, sentences };
}

// --- session / autoFollow ---
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

/**
 * 通知所有订阅者自动跟随状态
 * 该函数会根据当前 session 状态构造 autoFollow 状态对象，并逐一调用监听队列中的回调函数
 */
function emitAutoFollowState(): void {
	// 构造当前自动跟随状态
	const state: EpubListenAutoFollowState = {
		// active 表示当前 session 是否存在
		active: session != null,
		// autoFollow 表示当前自动跟随状态，若 session 为空则默认为 true
		autoFollow: session?.autoFollow ?? true,
	};
	// 依次将状态对象传递给所有订阅的监听器
	for (const fn of followListeners) fn(state);
}

// 订阅听书自动跟随状态变化：传入回调函数，每当自动跟随状态更新时会调用该函数
export function subscribeEpubListenAutoFollow(
	listener: (state: EpubListenAutoFollowState) => void, // 订阅者回调，参数为当前的跟随状态对象
): () => void {
	// 将传入的回调加入监听队列
	followListeners.add(listener);
	// 立即触发一次回调，通知最新状态
	emitAutoFollowState();
	// 返回取消订阅的方法，外部可用于移除监听
	return () => followListeners.delete(listener);
}

/**
 * 判断传入的 Range 是否仍然连接到当前 DOM 树
 * 若 range 为 null 或其节点已经被移除（失去连接），则返回 false
 * 机制：尝试访问 range.startContainer.nodeName，
 * 若节点已被移除会抛出异常，此时捕获并返回 false
 * 否则返回 true，表示该 Range 仍然与当前文档结构关联
 * @param range 需要校验的 DOM Range
 * @returns 布尔值，true 表示已连接，false 表示无效或断开
 */
function isRangeConnected(range: Range | null): range is Range {
	// 若 range 为 null，则立即返回 false
	if (!range) return false;
	try {
		// 尝试访问 startContainer 的 nodeName 属性
		// 若节点已断开，这里会异常
		void range.startContainer.nodeName;
		// 未抛出异常，说明 Range 有效且连接
		return true;
	} catch {
		// 捕获异常，Range 已与 DOM 脱离
		return false;
	}
}

/**
 * 获取 EPUB Rendition 实例下所有的内容窗口（contents）
 * 若返回为数组，直接返回数组；若为单个对象则封装为数组；若为空则返回空数组
 * 常用于多 iframe 场景下遍历所有内容窗口（如多页面分页或多 chapter）
 *
 * @param rend - EPUB.js 的 Rendition 实例（代表 reader 渲染器）
 * @returns 一个对象数组，每个对象包含 document（文档对象）和 window（窗口对象）
 */
function getContents(
	rend: Rendition,
): Array<{ document: Document; window: Window }> {
	// 调用 rendition 的 getContents 获取内容窗口。可能是数组、单个对象或 undefined
	const raw = rend.getContents();
	// 若 getContents 返回数组，则直接返回
	return Array.isArray(raw)
		? raw
		: // 若返回为对象（单 iframe），则封装为数组返回
			raw
			? [raw as { document: Document; window: Window }]
			: // 若返回为空，则返回空数组
				[];
}

/**
 * 克隆当前 EPUB 选区（Range），用于后续定位或操作
 * 遍历所有 EPUB Rendition 的内容窗口（iframe），找到第一个有效的 Selection
 * - 若 Selection 为空、已折叠、无 Range，则跳过
 * - 若选中内容仅为空白字符串，也跳过
 * - 优先尝试用 normalizeSelectionRangeForEpub 标准化选区
 * - 若无法标准化，则直接克隆原始 Range
 * - 若所有窗口均无有效选区，则返回 null
 *
 * @param rend EPUB.js 的 Rendition（阅读器渲染实例）
 * @returns 标准化后的选区 Range 对象或 null
 */
export function cloneActiveEpubSelection(rend: Rendition): Range | null {
	// 遍历所有内容 iframe/window
	for (const { window: w } of getContents(rend)) {
		// 获取当前窗口 selection
		const sel = w.getSelection();
		// 若无 selection 或为折叠状态（即无选区）或 range 数为 0，跳过
		if (!sel || sel.isCollapsed || !sel.rangeCount) continue;
		// 取第一个 Range（一般 EPUB 只允许单 range 选中）
		const raw = sel.getRangeAt(0);
		// 若选中内容全是空白，跳过
		if (!raw.toString().trim()) continue;
		// 优先用标准化工具处理（不同环境、跨 iframe、兼容性场景）
		// 若不可用就直接 clone
		return normalizeSelectionRangeForEpub(raw) ?? raw.cloneRange();
	}
	// 所有内容窗口均无有效选区
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

function rangesEqual(a: Range, b: Range): boolean {
	try {
		return (
			a.startContainer === b.startContainer &&
			a.startOffset === b.startOffset &&
			a.endContainer === b.endContainer &&
			a.endOffset === b.endOffset
		);
	} catch {
		return false;
	}
}

function resolveActiveListenDomRange(): Range | null {
	if (!session) return null;
	if (session.lastSentenceIndex >= 0) {
		return resolveSentenceRange(session, session.lastSentenceIndex);
	}
	if (isRangeConnected(session.activeDomRange)) {
		return session.activeDomRange.cloneRange();
	}
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

function ensureChapterDomListenSession(rend: Rendition): ListenSession {
	if (
		session?.rend === rend &&
		!session.plain &&
		!session.outerRange &&
		!session.sentences.length
	) {
		return session;
	}
	const preserveAutoFollow = session?.autoFollow ?? true;
	clearEpubListenSegmentOverlay();
	overlayEpoch += 1;
	session = {
		rend,
		plain: '',
		cfi: '',
		outerRange: null,
		sentences: [],
		epoch: overlayEpoch,
		autoFollow: preserveAutoFollow,
		lastSentenceIndex: -1,
		activeDomRange: null,
	};
	detachScrollGuard = attachListenScrollGuard(rend);
	emitAutoFollowState();
	return session;
}

export function showEpubListenDomRange(
	rend: Rendition,
	range: Range,
	opts?: { forceScroll?: boolean; align?: 'center' | 'nearest' },
): void {
	if (!isRangeConnected(range)) return;
	const snapped =
		normalizeSelectionRangeForEpub(range.cloneRange()) ?? range.cloneRange();

	const active = ensureChapterDomListenSession(rend);
	const prev = active.activeDomRange;
	const isNew = !prev || !rangesEqual(prev, snapped);
	active.lastSentenceIndex = -1;
	active.activeDomRange = snapped.cloneRange();
	if (isNew) clearListenMarkHighlight(rend);
	showListenMarkHighlight(rend, snapped);

	if (opts?.forceScroll) {
		void withProgrammaticScroll(async () => {
			if (opts.align === 'center') {
				await scrollEpubRangeToViewCenter(rend, snapped, active.cfi);
				return;
			}
			await scrollEpubRangeIntoView(rend, snapped, active.cfi);
		});
		return;
	}

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

/** 听当前播放条：句数与预览文案 */
export function getEpubListenSessionMeta(): {
	plain: string;
	sentenceCount: number;
	sentenceLabels: string[];
} | null {
	// 如果当前没有 session，则返回 null，表示没有正在播放的内容
	if (!session) return null;
	// 对每个句子，去除 Markdown 标记后作为标签；如为空则显示为省略号
	const sentenceLabels = session.sentences.map((s) => {
		// 用 stripMarkdownForTts 去除句子的 Markdown 标记，并去除首尾空白
		const label = stripMarkdownForTts(s.spokenRaw).trim();
		// 若清理后为空字符串，则使用 '…' 代替
		return label || '…';
	});
	// 返回包括纯文本、句子数、预览标签等 meta 信息
	return {
		plain: session.plain, // 当前播放的纯文本内容
		sentenceCount: session.sentences.length, // 句子的总数量
		sentenceLabels, // 每一句的清理后预览标签
	};
}

/** 获取指定句子的 TTS 原始文本（去除 Markdown 标记）
 * @param index - 句子的索引（从 0 开始）
 * @returns 经 stripMarkdownForTts 处理、已去空白的字符串；若无该句则返回 null
 */
export function getEpubListenSentenceSpokenRaw(index: number): string | null {
	// 从 session 中获取第 index 个句子
	const sent = session?.sentences[index];
	// 如果不存在该句，返回 null
	if (!sent) return null;
	// 去除 Markdown 标记并去除首尾空白
	const raw = stripMarkdownForTts(sent.spokenRaw).trim();
	// 若清理后为空字符串，返回 null，否则返回处理后的文本
	return raw || null;
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

// --- 听当前 / 听书互斥 ---

type StopFn = () => void;

let stopQuoteListen: StopFn | null = null;
let stopChapterListen: StopFn | null = null;

export function registerQuoteListenStop(fn: StopFn | null): void {
	stopQuoteListen = fn;
}

export function registerChapterListenStop(fn: StopFn | null): void {
	stopChapterListen = fn;
}

export function invokeStopQuoteListen(): void {
	stopQuoteListen?.();
}

export function invokeStopChapterListen(): void {
	stopChapterListen?.();
}
