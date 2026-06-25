/**
 * EPUB「听当前」播放背景
 *
 * 在 epub.js 滚动容器上挂单一浮层（不写入 iframe annotation / CSS Highlight），
 * 换句时 replaceChildren 整层替换，避免跨段落 mark 残留。
 */
import type { Rendition } from 'epubjs';
import { stripMarkdownForTts } from '@/utils/englishTts';
import {
	forEachTextNodeInRange,
	getAccurateRangeLineClientRects,
	normalizeSelectionRangeForEpub,
	resolveCfiDomRange,
} from './epubRangeGeometry';
import {
	getEpubScrollContainer,
	scrollEpubRangeIntoView,
} from './epubScrolledNav';

export const EPUB_LISTEN_SEGMENT_FILL = 'rgba(251, 231, 128, 0.28)';

export const EPUB_LISTEN_HIGHLIGHT_CLASS = 'moke-epub-listen-bg';

const LISTEN_ROOT_ID = 'moke-epub-listen-host-overlay';
const LISTEN_OVERLAY_ID = 'moke-epub-listen-overlay';

const LISTEN_DOM_SELECTOR = `g.${EPUB_LISTEN_HIGHLIGHT_CLASS}, g[ref="${EPUB_LISTEN_HIGHLIGHT_CLASS}"], g[ref*="${EPUB_LISTEN_HIGHLIGHT_CLASS}"], g[class*="${EPUB_LISTEN_HIGHLIGHT_CLASS}"]`;

type EpubContents = { document: Document; window: Window };

type PlainCompactMap = {
	trimmed: string;
	anchor: number;
	compact: string;
	points: Array<{ node: Text; offset: number; ch: string }>;
};

type ListenSession = {
	rend: Rendition;
	plain: string;
	cfi: string;
	selectionRange: Range | null;
	epoch: number;
	plainStart: number;
	plainEnd: number;
	/** 为 false 时播放换句不再自动滚入视口（用户手动滚动后） */
	autoFollow: boolean;
	/** 与 TTS sentenceIndex 对齐，用于换句时清上一句背景 */
	lastSentenceIndex: number;
};

export type EpubListenAutoFollowState = {
	active: boolean;
	autoFollow: boolean;
};

let session: ListenSession | null = null;
let overlayEpoch = 0;
let relayoutRaf = 0;
let detachRelayout: (() => void) | null = null;
let detachScrollGuard: (() => void) | null = null;
let rememberedPopBarRange: Range | null = null;
let programmaticScroll = 0;
/** 递增以丢弃过期的滚动后重绘 */
let paintSerial = 0;

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

function pauseListenAutoFollow(): void {
	if (!session?.autoFollow) return;
	session.autoFollow = false;
	emitAutoFollowState();
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

function attachListenScrollGuard(rend: Rendition): () => void {
	const cleanups: (() => void)[] = [];

	const onUserScrollIntent = () => {
		if (programmaticScroll > 0) return;
		pauseListenAutoFollow();
	};

	const bindScrollTarget = (target: EventTarget | null | undefined) => {
		if (!target) return;
		target.addEventListener('scroll', onUserScrollIntent, { passive: true });
		cleanups.push(() =>
			target.removeEventListener('scroll', onUserScrollIntent),
		);
	};

	const container = getEpubScrollContainer(rend);
	if (container) {
		bindScrollTarget(container);
		container.addEventListener('wheel', onUserScrollIntent, { passive: true });
		cleanups.push(() =>
			container.removeEventListener('wheel', onUserScrollIntent),
		);
	}

	const bindContents = (contents: EpubContents) => {
		const doc = contents.document;
		bindScrollTarget(doc.scrollingElement ?? doc.documentElement);
	};

	rend.hooks.content.register(bindContents);
	for (const item of getContents(rend)) bindContents(item);

	return () => {
		for (const fn of cleanups) fn();
	};
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

function getContents(rend?: Rendition | null): EpubContents[] {
	if (!rend) return [];
	const raw = rend.getContents();
	return Array.isArray(raw)
		? (raw as EpubContents[])
		: raw
			? [raw as EpubContents]
			: [];
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

function normalizeComparable(text: string): string {
	return text
		.normalize('NFKC')
		.replace(/[\u200B-\u200D\uFEFF]/g, '')
		.replace(/\s+/gu, '');
}

export function cloneActiveEpubSelection(rend: Rendition): Range | null {
	for (const { window: win } of getContents(rend)) {
		const sel = win.getSelection?.();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) continue;
		const raw = sel.getRangeAt(0);
		const normalized = normalizeSelectionRangeForEpub(raw) ?? raw;
		if (!normalized.toString().trim()) continue;
		return normalized.cloneRange();
	}
	return null;
}

/** @deprecated 使用 cloneActiveEpubSelection */
export function cloneEpubListenSelectionRange(
	rend: Rendition,
	plain: string,
): Range | null {
	void plain;
	return cloneActiveEpubSelection(rend);
}

function collectListenDocuments(rend: Rendition): Set<Document> {
	const docs = new Set<Document>([document]);
	for (const { document: doc } of getContents(rend)) {
		if (doc) docs.add(doc);
	}
	return docs;
}

function resolveListenOverlayHost(rend: Rendition): HTMLElement | null {
	return (
		getEpubScrollContainer(rend) ??
		(rend as unknown as { manager?: { container?: HTMLElement } }).manager
			?.container ??
		null
	);
}

function rangeLineRectsInHost(
	range: Range,
	host: HTMLElement,
): Array<{ left: number; top: number; width: number; height: number }> {
	const lineRects = getAccurateRangeLineClientRects(range);
	if (!lineRects.length) return [];

	const doc = range.startContainer.ownerDocument;
	const iframe = doc?.defaultView?.frameElement as HTMLIFrameElement | null;
	const iframeRect = iframe?.getBoundingClientRect();
	const hostRect = host.getBoundingClientRect();

	return lineRects.map((r) => {
		const viewportLeft = iframeRect ? r.left + iframeRect.left : r.left;
		const viewportTop = iframeRect ? r.top + iframeRect.top : r.top;
		return {
			left: viewportLeft - hostRect.left + host.scrollLeft,
			top: viewportTop - hostRect.top + host.scrollTop,
			width: r.width,
			height: r.height,
		};
	});
}

function ensureListenOverlayRoot(rend: Rendition): HTMLElement | null {
	const host = resolveListenOverlayHost(rend);
	if (!host) return null;

	if (getComputedStyle(host).position === 'static') {
		host.style.position = 'relative';
	}

	let root = host.querySelector<HTMLElement>(`#${LISTEN_ROOT_ID}`);
	if (!root) {
		root = document.createElement('div');
		root.id = LISTEN_ROOT_ID;
		root.style.cssText =
			'position:absolute;left:0;top:0;pointer-events:none;z-index:5;overflow:visible;';
		host.appendChild(root);
	}

	root.style.width = `${Math.max(host.scrollWidth, host.clientWidth)}px`;
	root.style.height = `${Math.max(host.scrollHeight, host.clientHeight)}px`;
	return root;
}

/** 清掉历史 annotation / CSS Highlight / iframe 内旧实现残留 */
function purgeLegacyListenLayers(rend: Rendition): void {
	const cssName = 'moke-epub-listen-seg';
	for (const doc of collectListenDocuments(rend)) {
		const css = (
			doc.defaultView as Window & {
				CSS?: { highlights?: { delete: (n: string) => void } };
			}
		)?.CSS;
		css?.highlights?.delete(cssName);
		doc.getElementById(LISTEN_STYLE_ID)?.remove();
	}

	purgeAllListenAnnotations(rend);

	for (const doc of collectListenDocuments(rend)) {
		try {
			doc.querySelectorAll(LISTEN_DOM_SELECTOR).forEach((g) => {
				g.remove();
			});
			for (const pane of doc.querySelectorAll('.marks-pane')) {
				pane.querySelectorAll(LISTEN_DOM_SELECTOR).forEach((g) => {
					g.remove();
				});
			}
			doc.getElementById(LISTEN_OVERLAY_ID)?.remove();
		} catch {
			// iframe 卸载时忽略
		}
	}
}

const LISTEN_STYLE_ID = 'moke-epub-listen-seg-style';

function purgeAllListenAnnotations(rend: Rendition): void {
	const annApi = rend.annotations as Rendition['annotations'] & {
		_annotations?: Record<
			string,
			{
				className?: string;
				sectionIndex: number;
				detach: (view: { index: number }) => void;
			}
		>;
		_annotationsBySectionIndex?: Record<string, string[]>;
	};
	const store = annApi._annotations;
	if (!store) return;

	const views =
		(
			rend as Rendition & { views?: () => Array<{ index: number }> }
		).views?.() ?? [];

	for (const hash of Object.keys({ ...store })) {
		const ann = store[hash];
		if (ann?.className !== EPUB_LISTEN_HIGHLIGHT_CLASS) continue;
		for (const view of views) {
			const idx = (view as { index?: number }).index;
			if (idx !== undefined && ann.sectionIndex === idx) {
				ann.detach({ index: idx });
			}
		}
		delete store[hash];
		const bySection = annApi._annotationsBySectionIndex;
		if (bySection?.[ann.sectionIndex]) {
			bySection[ann.sectionIndex] = bySection[ann.sectionIndex].filter(
				(h) => h !== hash,
			);
		}
	}
}

function clearListenPaint(rend: Rendition): void {
	purgeLegacyListenLayers(rend);
	resolveListenOverlayHost(rend)
		?.querySelector(`#${LISTEN_ROOT_ID}`)
		?.replaceChildren();
}

function paintListenRange(rend: Rendition, range: Range): void {
	clearListenPaint(rend);

	const root = ensureListenOverlayRoot(rend);
	const host = resolveListenOverlayHost(rend);
	if (!root || !host) return;

	const rects = rangeLineRectsInHost(range, host);
	for (const rect of rects) {
		const block = document.createElement('div');
		block.style.cssText = `position:absolute;background:${EPUB_LISTEN_SEGMENT_FILL};pointer-events:none;border-radius:1px;`;
		block.style.left = `${rect.left}px`;
		block.style.top = `${rect.top}px`;
		block.style.width = `${rect.width}px`;
		block.style.height = `${rect.height}px`;
		root.appendChild(block);
	}
}

function buildCompactIndex(outer: Range): {
	compact: string;
	points: Array<{ node: Text; offset: number; ch: string }>;
} {
	const doc = outer.startContainer.ownerDocument;
	if (!doc) return { compact: '', points: [] };

	const points: Array<{ node: Text; offset: number; ch: string }> = [];
	forEachTextNodeInRange(outer, (node, start, end) => {
		for (let offset = start; offset < end; offset += 1) {
			const ch = node.data[offset];
			if (!ch || /\s/u.test(ch)) continue;
			points.push({ node, offset, ch: normalizeComparable(ch) });
		}
	});
	return { compact: points.map((p) => p.ch).join(''), points };
}

function buildPlainCompactMap(
	outer: Range,
	plain: string,
): PlainCompactMap | null {
	const trimmed = plain.trim();
	const plainNorm = normalizeComparable(trimmed);
	if (!plainNorm) return null;

	const { compact, points } = buildCompactIndex(outer);
	if (!compact) return null;

	let anchor = compact.indexOf(plainNorm);
	if (anchor < 0) {
		for (let len = plainNorm.length; len >= 16; len -= 12) {
			anchor = compact.indexOf(plainNorm.slice(0, len));
			if (anchor >= 0) break;
		}
	}
	if (anchor < 0) return null;

	return { trimmed, anchor, compact, points };
}

function plainSliceToRange(
	map: PlainCompactMap,
	start: number,
	end: number,
): Range | null {
	if (start >= end || end > map.trimmed.length) return null;

	const beforeLen = normalizeComparable(map.trimmed.slice(0, start)).length;
	const sliceNorm = normalizeComparable(map.trimmed.slice(start, end));
	if (!sliceNorm) return null;

	const cStart = map.anchor + beforeLen;
	if (map.compact.slice(cStart, cStart + sliceNorm.length) !== sliceNorm) {
		return null;
	}

	const first = map.points[cStart];
	const last = map.points[cStart + sliceNorm.length - 1];
	if (!first || !last) return null;

	const doc = first.node.ownerDocument;
	if (!doc) return null;

	const range = doc.createRange();
	range.setStart(first.node, first.offset);
	range.setEnd(last.node, last.offset + 1);
	return range;
}

function resolveSessionOuter(active: ListenSession): Range | null {
	if (isRangeConnected(active.selectionRange)) {
		return active.selectionRange;
	}
	active.selectionRange = null;

	const cfi = active.cfi.trim();
	if (!cfi) return cloneActiveEpubSelection(active.rend);

	const fromCfi = resolveCfiDomRange(active.rend, cfi);
	if (fromCfi) {
		return normalizeSelectionRangeForEpub(fromCfi) ?? fromCfi;
	}
	return cloneActiveEpubSelection(active.rend);
}

function paintPlainSpan(plainStart: number, plainEnd: number): void {
	if (!session || plainStart >= plainEnd) return;

	const isNewSpan =
		session.plainStart !== plainStart || session.plainEnd !== plainEnd;

	// 新句/新 span 前先清掉旧层（避免跨段时上一句 mark 残留）
	if (isNewSpan) {
		clearListenPaint(session.rend);
	}

	const outer = resolveSessionOuter(session);
	if (!outer) return;

	const map = buildPlainCompactMap(outer, session.plain);
	if (!map) return;

	const range = plainSliceToRange(map, plainStart, plainEnd);
	if (!range) return;

	paintListenRange(session.rend, range);
	session.plainStart = plainStart;
	session.plainEnd = plainEnd;

	if (isNewSpan && session.autoFollow) {
		const { rend, cfi, epoch } = session;
		const serial = ++paintSerial;
		void withProgrammaticScroll(async () => {
			const ok = await scrollEpubRangeIntoView(rend, range, cfi);
			if (!ok || !session || session.epoch !== epoch) return;
			if (serial !== paintSerial) return;
			if (session.plainStart !== plainStart || session.plainEnd !== plainEnd) {
				return;
			}
			paintPlainSpan(plainStart, plainEnd);
		});
	}
}

function relayoutActive(): void {
	if (!session || session.plainStart >= session.plainEnd) return;
	paintPlainSpan(session.plainStart, session.plainEnd);
}

function attachRelayoutListeners(rend: Rendition): () => void {
	const schedule = () => {
		cancelAnimationFrame(relayoutRaf);
		relayoutRaf = requestAnimationFrame(relayoutActive);
	};
	rend.on('relocated', schedule);
	rend.on('rendered', schedule);
	return () => {
		cancelAnimationFrame(relayoutRaf);
		relayoutRaf = 0;
		try {
			rend.off('relocated', schedule);
			rend.off('rendered', schedule);
		} catch {
			// rendition 已销毁
		}
	};
}

export function beginEpubListenOverlaySession(
	rend: Rendition,
	plainText: string,
	opts?: { cfi?: string; selectionRange?: Range | null },
): void {
	const plain = plainText.trim();
	if (!plain) return;

	clearEpubListenSegmentOverlay();
	overlayEpoch += 1;

	const selectionRange =
		opts?.selectionRange && isRangeConnected(opts.selectionRange)
			? opts.selectionRange.cloneRange()
			: (() => {
					const cfi = opts?.cfi?.trim() ?? '';
					if (!cfi) return null;
					const fromCfi = resolveCfiDomRange(rend, cfi);
					return fromCfi ? fromCfi.cloneRange() : null;
				})();

	session = {
		rend,
		plain,
		cfi: opts?.cfi?.trim() ?? '',
		selectionRange,
		epoch: overlayEpoch,
		plainStart: -1,
		plainEnd: -1,
		autoFollow: true,
		lastSentenceIndex: -1,
	};

	detachRelayout = attachRelayoutListeners(rend);
	detachScrollGuard = attachListenScrollGuard(rend);
	emitAutoFollowState();
}

/** 恢复播放内容自动滚入视口，并立即滚到当前句 */
export function resumeEpubListenAutoFollow(): void {
	if (!session) return;
	session.autoFollow = true;
	emitAutoFollowState();

	const { plainStart, plainEnd } = session;
	if (plainStart < 0 || plainEnd <= plainStart) return;

	const outer = resolveSessionOuter(session);
	if (!outer) return;
	const map = buildPlainCompactMap(outer, session.plain);
	if (!map) return;
	const range = plainSliceToRange(map, plainStart, plainEnd);
	if (!range) return;

	const { rend, cfi, epoch } = session;
	void withProgrammaticScroll(async () => {
		await scrollEpubRangeIntoView(rend, range, cfi);
		if (!session || session.epoch !== epoch) return;
		if (session.plainStart !== plainStart || session.plainEnd !== plainEnd)
			return;
		paintPlainSpan(plainStart, plainEnd);
	});
}

export function resolveEpubListenPlain(
	rend: Rendition | null,
	fallbackText: string,
	frozenRange?: Range | null,
): { plain: string; selectionRange: Range | null; spokenRaw: string } {
	const trimmed = fallbackText.trim();
	const selectionRange =
		frozenRange && isRangeConnected(frozenRange)
			? frozenRange.cloneRange()
			: (getRememberedEpubPopBarSelectionRange() ??
				(rend ? cloneActiveEpubSelection(rend) : null));
	const spokenRaw = selectionRange?.toString().trim() || trimmed;
	const plain = stripMarkdownForTts(spokenRaw);
	return { plain, selectionRange, spokenRaw };
}

export function showEpubListenPlainSpan(
	plainStart: number,
	plainEnd: number,
	sentenceIndex = 0,
): void {
	if (!session) return;
	if (
		session.lastSentenceIndex >= 0 &&
		sentenceIndex !== session.lastSentenceIndex
	) {
		paintSerial += 1;
		clearListenPaint(session.rend);
		session.plainStart = -1;
		session.plainEnd = -1;
	}
	session.lastSentenceIndex = sentenceIndex;
	paintPlainSpan(plainStart, plainEnd);
}

export function showEpubListenSentence(
	sentenceIndex: number,
	_chunkText?: string,
): void {
	void sentenceIndex;
	void _chunkText;
}

export function clearEpubListenSentenceOverlay(): void {
	if (!session) return;
	clearListenPaint(session.rend);
	session.plainStart = -1;
	session.plainEnd = -1;
}

export function clearEpubListenSegmentOverlay(): void {
	const rend = session?.rend ?? null;
	if (rend) clearListenPaint(rend);

	overlayEpoch += 1;
	session = null;
	detachRelayout?.();
	detachRelayout = null;
	detachScrollGuard?.();
	detachScrollGuard = null;
	cancelAnimationFrame(relayoutRaf);
	relayoutRaf = 0;
	emitAutoFollowState();
}

if (!EPUB_LISTEN_SEGMENT_FILL.includes('0.28')) {
	throw new Error('[epubListenSegmentOverlay] 播放背景色透明度异常');
}
