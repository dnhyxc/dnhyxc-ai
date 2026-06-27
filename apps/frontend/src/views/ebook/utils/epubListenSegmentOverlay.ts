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
	clearListenMarkHighlight,
	showListenMarkHighlight,
} from './epubListenMarkHighlight';
import {
	cfiFromDomRange,
	forEachTextNodeInRange,
	normalizeSelectionRangeForEpub,
	resolveCfiDomRange,
} from './epubRangeGeometry';
import {
	getEpubScrollContainer,
	scrollEpubRangeIntoView,
	scrollEpubRangeToViewCenter,
} from './epubScrolledNav';

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

function collectPlainStream(outer: Range): {
	plain: string;
	points: TextPoint[];
} {
	const points: TextPoint[] = [];
	let plain = '';
	let pendingSpace = false;

	forEachTextNodeInRange(outer, (node, start, end) => {
		if (!isVisibleTextNode(node)) return;
		for (let offset = start; offset < end; offset += 1) {
			const ch = node.data[offset];
			if (!ch) continue;
			if (/\s/u.test(ch)) {
				if (plain.length > 0) pendingSpace = true;
				continue;
			}
			if (pendingSpace) {
				plain += ' ';
				points.push({ node, offset });
				pendingSpace = false;
			}
			plain += ch;
			points.push({ node, offset });
		}
	});

	while (plain.endsWith(' ')) {
		plain = plain.slice(0, -1);
		points.pop();
	}

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

function buildDomSentenceIndex(outer: Range): {
	plain: string;
	sentences: DomListenSentence[];
} {
	const { plain, points } = collectPlainStream(outer);
	const trimmed = plain.trim();
	if (!trimmed) return { plain: '', sentences: [] };

	const lead = plain.length - plain.trimStart().length;
	const trimmedPoints = points.slice(lead, lead + trimmed.length);
	if (trimmedPoints.length !== trimmed.length) {
		return { plain: trimmed, sentences: sentencesWithoutAnchors(trimmed) };
	}

	const sentences: DomListenSentence[] = [];
	for (const { start, end } of buildSentenceOffsetSpans(trimmed)) {
		const spokenRaw = trimmed.slice(start, end).trim();
		if (!spokenRaw) continue;
		const anchor = anchorFromPoints(trimmedPoints, trimmed, start, end);
		sentences.push({ spokenRaw, anchor });
	}

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
