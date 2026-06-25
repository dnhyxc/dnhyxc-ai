/**
 * EPUB「听当前」播放背景
 *
 * 绘制优先级：CSS Highlight API → epub.js highlight（独立 class，按 Annotation detach）
 * → iframe body 浮层。禁止 rend.annotations.remove(cfi,'highlight')，避免误删用户划线。
 */
import type { Rendition } from 'epubjs';
import { stripMarkdownForTts } from '@/utils/englishTts';
import {
	cfiFromDomRange,
	forEachTextNodeInRange,
	getAccurateRangeLineClientRects,
	normalizeSelectionRangeForEpub,
	resolveCfiDomRange,
} from './epubRangeGeometry';
import { scrollEpubRangeIntoView } from './epubScrolledNav';

export const EPUB_LISTEN_SEGMENT_FILL = 'rgba(251, 231, 128, 0.28)';

export const EPUB_LISTEN_HIGHLIGHT_CLASS = 'moke-epub-listen-bg';

const LISTEN_CSS_HIGHLIGHT_NAME = 'moke-epub-listen-seg';
const LISTEN_STYLE_ID = 'moke-epub-listen-seg-style';
const LISTEN_OVERLAY_ID = 'moke-epub-listen-overlay';

const LISTEN_HIGHLIGHT_STYLES: Record<string, string> = {
	fill: EPUB_LISTEN_SEGMENT_FILL,
	'fill-opacity': '1',
	stroke: 'transparent',
	'stroke-width': '0',
	'mix-blend-mode': 'normal',
};

const LISTEN_DOM_SELECTOR = `g.${EPUB_LISTEN_HIGHLIGHT_CLASS}, g[ref="${EPUB_LISTEN_HIGHLIGHT_CLASS}"]`;

type EpubContents = { document: Document; window: Window };

type EpubListenAnnotation = {
	cfiRange: string;
	type: string;
	sectionIndex: number;
	detach: (view: { index: number }) => void;
};

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
};

let session: ListenSession | null = null;
let overlayEpoch = 0;
let relayoutRaf = 0;
let detachRelayout: (() => void) | null = null;
let activeListenAnnotation: EpubListenAnnotation | null = null;
let rememberedPopBarRange: Range | null = null;

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

type CssHighlightRegistry = {
	set: (name: string, value: unknown) => void;
	delete: (name: string) => void;
};

function getCssHighlightRegistry(doc: Document): CssHighlightRegistry | null {
	const css = (
		doc.defaultView as Window & { CSS?: { highlights?: CssHighlightRegistry } }
	)?.CSS;
	return css?.highlights ?? null;
}

function ensureListenCssHighlightStyle(doc: Document): void {
	const head = doc.head ?? doc.documentElement;
	if (!head || doc.getElementById(LISTEN_STYLE_ID)) return;
	const style = doc.createElement('style');
	style.id = LISTEN_STYLE_ID;
	style.textContent = `
::highlight(${LISTEN_CSS_HIGHLIGHT_NAME}) {
	background-color: ${EPUB_LISTEN_SEGMENT_FILL};
	color: inherit;
}
`;
	head.appendChild(style);
}

function clearCssListenHighlight(rend: Rendition): void {
	for (const { document: doc } of getContents(rend)) {
		getCssHighlightRegistry(doc)?.delete(LISTEN_CSS_HIGHLIGHT_NAME);
	}
}

function paintCssListenHighlight(range: Range): boolean {
	const doc = range.startContainer.ownerDocument;
	if (!doc) return false;
	const registry = getCssHighlightRegistry(doc);
	const HighlightCtor = (
		doc.defaultView as Window & {
			Highlight?: new (...ranges: Range[]) => unknown;
		}
	)?.Highlight;
	if (!registry || !HighlightCtor) return false;

	ensureListenCssHighlightStyle(doc);
	registry.set(LISTEN_CSS_HIGHLIGHT_NAME, new HighlightCtor(range));
	return true;
}

function removeListenDomGroups(rend: Rendition): void {
	for (const { document: doc } of getContents(rend)) {
		doc.querySelectorAll(LISTEN_DOM_SELECTOR).forEach((g) => {
			g.remove();
		});
	}
}

/** 仅 detach 播放批注对象，不走 annotations.remove(cfi,'highlight') */
function detachActiveListenAnnotation(rend: Rendition): void {
	const ann = activeListenAnnotation;
	activeListenAnnotation = null;
	if (!ann) return;

	const views = (
		rend as Rendition & { views?: () => Array<{ index: number }> }
	).views?.();
	views?.forEach((view) => {
		const viewIndex = (view as { index?: number }).index;
		if (viewIndex === undefined || ann.sectionIndex !== viewIndex) return;
		ann.detach({ index: viewIndex });
	});

	const store = (
		rend.annotations as Rendition['annotations'] & {
			_annotations?: Record<string, unknown>;
			_annotationsBySectionIndex?: Record<string, string[]>;
		}
	)._annotations;
	const hash = encodeURI(`${ann.cfiRange}${ann.type}`);
	if (store && hash in store) {
		delete store[hash];
		const bySection = (
			rend.annotations as Rendition['annotations'] & {
				_annotationsBySectionIndex?: Record<string, string[]>;
			}
		)._annotationsBySectionIndex;
		const section = bySection?.[ann.sectionIndex];
		if (section) {
			bySection[ann.sectionIndex] = section.filter((h) => h !== hash);
		}
	}
}

function clearDivListenOverlay(rend: Rendition): void {
	for (const { document: doc } of getContents(rend)) {
		doc.getElementById(LISTEN_OVERLAY_ID)?.remove();
	}
}

function clearListenPaint(rend: Rendition): void {
	clearCssListenHighlight(rend);
	detachActiveListenAnnotation(rend);
	removeListenDomGroups(rend);
	clearDivListenOverlay(rend);
}

function applyListenAnnotation(rend: Rendition, range: Range): boolean {
	const cfi = cfiFromDomRange(rend, range);
	if (!cfi) return false;

	try {
		const ann = rend.annotations.highlight(
			cfi,
			{ listen: '1' },
			() => {},
			EPUB_LISTEN_HIGHLIGHT_CLASS,
			LISTEN_HIGHLIGHT_STYLES,
		) as unknown as EpubListenAnnotation;
		activeListenAnnotation = ann;
		return true;
	} catch {
		return false;
	}
}

function paintDivListenOverlay(range: Range): boolean {
	const doc = range.startContainer.ownerDocument;
	if (!doc?.body) return false;

	const rects = getAccurateRangeLineClientRects(range);
	if (!rects.length) return false;

	let root = doc.getElementById(LISTEN_OVERLAY_ID);
	if (!root) {
		root = doc.createElement('div');
		root.id = LISTEN_OVERLAY_ID;
		root.style.cssText =
			'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible;';
		doc.body.appendChild(root);
	}
	root.replaceChildren();

	const win = doc.defaultView;
	const scrollX = win?.scrollX ?? 0;
	const scrollY = win?.scrollY ?? 0;

	for (const rect of rects) {
		const block = doc.createElement('div');
		block.style.cssText = `position:absolute;background:${EPUB_LISTEN_SEGMENT_FILL};pointer-events:none;border-radius:1px;`;
		block.style.left = `${rect.left + scrollX}px`;
		block.style.top = `${rect.top + scrollY}px`;
		block.style.width = `${rect.width}px`;
		block.style.height = `${rect.height}px`;
		root.appendChild(block);
	}
	return true;
}

function paintListenRange(rend: Rendition, range: Range): void {
	clearListenPaint(rend);
	if (paintCssListenHighlight(range)) return;
	if (applyListenAnnotation(rend, range)) return;
	paintDivListenOverlay(range);
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

	const outer = resolveSessionOuter(session);
	if (!outer) return;

	const map = buildPlainCompactMap(outer, session.plain);
	if (!map) return;

	const range = plainSliceToRange(map, plainStart, plainEnd);
	if (!range) return;

	const isNewSpan =
		session.plainStart !== plainStart || session.plainEnd !== plainEnd;

	paintListenRange(session.rend, range);
	session.plainStart = plainStart;
	session.plainEnd = plainEnd;

	if (isNewSpan) {
		const { rend, cfi, epoch } = session;
		void scrollEpubRangeIntoView(rend, range, cfi).then((ok) => {
			if (!ok || !session || session.epoch !== epoch) return;
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
	};

	detachRelayout = attachRelayoutListeners(rend);
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
): void {
	if (!session) return;
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
	activeListenAnnotation = null;
	detachRelayout?.();
	detachRelayout = null;
	cancelAnimationFrame(relayoutRaf);
	relayoutRaf = 0;
}

if (!EPUB_LISTEN_SEGMENT_FILL.includes('0.28')) {
	throw new Error('[epubListenSegmentOverlay] 播放背景色透明度异常');
}
