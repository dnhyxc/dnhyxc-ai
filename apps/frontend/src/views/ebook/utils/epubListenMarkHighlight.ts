/**
 * 听书播放背景：单例浮层（marks-pane SVG 或 iframe 绝对定位），换句先清空再绘制。
 * 不用 CSS Highlight / epub annotation（二者在 …… 等字符上易残留堆叠）。
 * 导致换句时高亮残留问题。
 */
import type { Rendition } from 'epubjs';
import {
	clientRectToSvgLocalSegment,
	getAccurateRangeLineClientRects,
	getRenditionViewsList,
	normalizeSelectionRangeForEpub,
	type SvgLineSegment,
} from './epubRangeGeometry';
import { getEpubScrollContainer } from './epubScrolledNav';

export const EPUB_LISTEN_SEGMENT_FILL = 'rgba(251, 231, 128, 0.28)';
export const EPUB_LISTEN_HIGHLIGHT_CLASS = 'moke-epub-listen-bg';

const LISTEN_MARK_SELECTOR = `g.${EPUB_LISTEN_HIGHLIGHT_CLASS}, g[class*="${EPUB_LISTEN_HIGHLIGHT_CLASS}"]`;
const IFRAME_LAYER_ID = 'moke-epub-listen-iframe-layer';
/** legacy CSS Highlight 名（清除旧会话残留） */
const LEGACY_CSS_HIGHLIGHT = 'moke-epub-listen-seg';

type PaintMode = 'svg' | 'iframe';

type ActiveListenMark = {
	rend: Rendition;
	range: Range;
	doc: Document;
	mode: PaintMode;
	group: SVGElement | null;
};

let active: ActiveListenMark | null = null;
let detachRelayout: (() => void) | null = null;
let relayoutRaf = 0;
const paintedDocs = new Set<Document>();

function isRangeConnected(range: Range | null): range is Range {
	if (!range) return false;
	try {
		void range.startContainer.nodeName;
		return true;
	} catch {
		return false;
	}
}

function listListenDocuments(rend: Rendition): Document[] {
	const docs = new Set<Document>();
	const raw = rend.getContents();
	const items: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
	for (const item of items) {
		const doc = (item as { document?: Document }).document;
		if (doc) docs.add(doc);
	}
	getEpubScrollContainer(rend)
		?.querySelectorAll('iframe')
		.forEach((frame) => {
			try {
				const doc = (frame as HTMLIFrameElement).contentDocument;
				if (doc) docs.add(doc);
			} catch {
				// 跨域 iframe
			}
		});
	return [...docs];
}

function isListenAnnotationClass(className: string | undefined): boolean {
	if (!className) return false;
	return (
		className === EPUB_LISTEN_HIGHLIGHT_CLASS ||
		className.includes('moke-epub-listen')
	);
}

/** 清除 epub.js 听书 annotation + DOM mark（换句必须全量扫） */
function purgeListenAnnotations(rend: Rendition): void {
	const annApi = rend.annotations as Rendition['annotations'] & {
		_annotations?: Record<
			string,
			{
				className?: string;
				sectionIndex: number;
				detach: (v: { index: number }) => void;
			}
		>;
		_annotationsBySectionIndex?: Record<string, string[]>;
	};
	const store = annApi._annotations;
	const views = getRenditionViewsList(rend);

	if (store) {
		for (const hash of Object.keys({ ...store })) {
			const ann = store[hash];
			if (!isListenAnnotationClass(ann?.className)) continue;
			try {
				rend.annotations.remove(hash, 'highlight');
			} catch {
				// ignore
			}
			for (const view of views) {
				const idx = view.index;
				if (idx !== undefined && ann.sectionIndex === idx) {
					ann.detach({ index: idx });
				}
			}
			delete store[hash];
			const bySection = annApi._annotationsBySectionIndex;
			if (bySection?.[ann.sectionIndex]) {
				bySection[ann.sectionIndex] = bySection[ann.sectionIndex]!.filter(
					(h) => h !== hash,
				);
			}
		}
	}

	for (const doc of listListenDocuments(rend)) {
		doc.querySelectorAll(LISTEN_MARK_SELECTOR).forEach((g) => {
			g.remove();
		});
	}
}

function purgeLegacyCssHighlight(doc: Document): void {
	try {
		doc.defaultView?.CSS?.highlights?.delete(LEGACY_CSS_HIGHLIGHT);
	} catch {
		// ignore
	}
	doc.getElementById('moke-epub-listen-css-hl-style')?.remove();
}

function purgeDocListenLayers(doc: Document): void {
	purgeLegacyCssHighlight(doc);
	doc.querySelectorAll(LISTEN_MARK_SELECTOR).forEach((g) => {
		g.remove();
	});
	doc.getElementById(IFRAME_LAYER_ID)?.remove();
}

function collectPurgeDocs(rend?: Rendition): Set<Document> {
	const docs = new Set<Document>(paintedDocs);
	if (active?.doc) docs.add(active.doc);
	if (rend) {
		for (const doc of listListenDocuments(rend)) docs.add(doc);
	}
	return docs;
}

function setSvgAttr(el: Element, name: string, value: string): void {
	if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/**
 * 听书专用行盒：段首（如 …… 后）getAccurateRangeLineClientRects 可能带上一条误检行，
 * 将首行 top 对齐句首 caret，避免背景整体上移一行。
 */
function listenLineRects(range: Range): DOMRect[] {
	const rects = getAccurateRangeLineClientRects(range);
	if (!rects.length) return rects;

	const caret = range.cloneRange();
	caret.collapse(true);
	const caretRect =
		[...caret.getClientRects()].find((r) => r.height > 0.5) ??
		caret.getBoundingClientRect();
	if (caretRect.height < 0.5) return rects;

	let lines = rects.filter((r) => r.bottom > caretRect.top + 0.5);
	if (!lines.length) lines = rects;

	const first = lines[0]!;
	const shiftUp = caretRect.top - first.top;
	const lineH = first.height > 0.5 ? first.height : caretRect.height;
	if (shiftUp > 0.5 && shiftUp <= lineH * 1.15) {
		lines = [
			new DOMRect(first.left, caretRect.top, first.width, first.height),
			...lines.slice(1),
		];
	}
	return lines;
}

function listenRangeToSvgSegments(
	group: SVGElement,
	range: Range,
): SvgLineSegment[] {
	const normalized = normalizeSelectionRangeForEpub(range) ?? range;
	const svg = group.closest('svg');
	const container = svg?.parentElement;
	if (!(svg instanceof SVGSVGElement) || !(container instanceof HTMLElement)) {
		return [];
	}
	return listenLineRects(normalized).map((rect) =>
		clientRectToSvgLocalSegment(rect, svg, container),
	);
}

function syncMarkRects(group: SVGElement, segments: SvgLineSegment[]): void {
	const ownerDoc = group.ownerDocument;
	group.replaceChildren();
	for (const seg of segments) {
		const rect = ownerDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');
		setSvgAttr(rect, 'x', String(seg.x));
		setSvgAttr(rect, 'y', String(seg.y));
		setSvgAttr(rect, 'width', String(seg.width));
		setSvgAttr(rect, 'height', String(seg.height));
		setSvgAttr(rect, 'fill', EPUB_LISTEN_SEGMENT_FILL);
		setSvgAttr(rect, 'fill-opacity', '1');
		setSvgAttr(rect, 'stroke', 'transparent');
		setSvgAttr(rect, 'stroke-width', '0');
		group.appendChild(rect);
	}
	group.style.pointerEvents = 'none';
}

function findMarksPaneSvg(doc: Document): SVGSVGElement | null {
	for (const pane of doc.querySelectorAll('.marks-pane')) {
		const svg = pane.querySelector('svg');
		if (svg instanceof SVGSVGElement) return svg;
	}
	return null;
}

function ensureListenMarkGroup(doc: Document): SVGElement | null {
	const svg = findMarksPaneSvg(doc);
	if (!svg) return null;

	let group = svg.querySelector(LISTEN_MARK_SELECTOR);
	if (!(group instanceof SVGElement)) {
		const created = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
		created.setAttribute('class', EPUB_LISTEN_HIGHLIGHT_CLASS);
		svg.appendChild(created);
		group = created;
	}
	return group instanceof SVGElement ? group : null;
}

function paintDirectSvg(group: SVGElement, range: Range): boolean {
	const segments = listenRangeToSvgSegments(group, range);
	if (!segments.length) return false;
	syncMarkRects(group, segments);
	return true;
}

function paintIframeOverlay(doc: Document, range: Range): boolean {
	const rects = listenLineRects(range);
	if (!rects.length) return false;

	const root = doc.documentElement;
	const scrollX = doc.defaultView?.pageXOffset ?? 0;
	const scrollY = doc.defaultView?.pageYOffset ?? 0;

	let layer = doc.getElementById(IFRAME_LAYER_ID);
	if (!layer) {
		layer = doc.createElement('div');
		layer.id = IFRAME_LAYER_ID;
		Object.assign(layer.style, {
			position: 'absolute',
			left: '0',
			top: '0',
			width: '100%',
			height: '100%',
			pointerEvents: 'none',
			zIndex: '2',
			overflow: 'visible',
		});
		root.appendChild(layer);
	}

	layer.replaceChildren();
	for (const rect of rects) {
		const div = doc.createElement('div');
		Object.assign(div.style, {
			position: 'absolute',
			left: `${rect.left + scrollX}px`,
			top: `${rect.top + scrollY}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`,
			background: EPUB_LISTEN_SEGMENT_FILL,
			pointerEvents: 'none',
		});
		layer.appendChild(div);
	}
	return true;
}

function repaintActive(): void {
	if (!active || !isRangeConnected(active.range)) return;
	const normalized =
		normalizeSelectionRangeForEpub(active.range) ?? active.range;
	if (active.mode === 'svg' && active.group?.isConnected) {
		paintDirectSvg(active.group, normalized);
	} else {
		paintIframeOverlay(active.doc, normalized);
	}
}

function schedulePatch(rend: Rendition): void {
	if (!active || active.rend !== rend) return;
	cancelAnimationFrame(relayoutRaf);
	relayoutRaf = requestAnimationFrame(() => {
		relayoutRaf = 0;
		if (!active || active.rend !== rend) return;
		repaintActive();
	});
}

function attachRelayout(rend: Rendition): void {
	detachRelayout?.();
	const onRelayout = () => schedulePatch(rend);
	rend.on('relocated', onRelayout);
	rend.on('rendered', onRelayout);
	detachRelayout = () => {
		cancelAnimationFrame(relayoutRaf);
		relayoutRaf = 0;
		try {
			rend.off('relocated', onRelayout);
			rend.off('rendered', onRelayout);
		} catch {
			// rendition 已销毁
		}
	};
}

/** 绘制当前句背景（内部先全量清除） */
export function showListenMarkHighlight(rend: Rendition, range: Range): void {
	if (!isRangeConnected(range)) return;
	const normalized = normalizeSelectionRangeForEpub(range) ?? range;
	const doc = normalized.startContainer.ownerDocument;
	if (!doc) return;

	clearListenMarkHighlight(rend);

	const group = ensureListenMarkGroup(doc);
	let mode: PaintMode = 'iframe';
	let painted = false;

	if (group && paintDirectSvg(group, normalized)) {
		mode = 'svg';
		painted = true;
		active = {
			rend,
			range: normalized.cloneRange(),
			doc,
			mode,
			group,
		};
	} else if (paintIframeOverlay(doc, normalized)) {
		painted = true;
		active = {
			rend,
			range: normalized.cloneRange(),
			doc,
			mode: 'iframe',
			group: null,
		};
	}

	if (!painted) return;

	paintedDocs.add(doc);
	attachRelayout(rend);
	schedulePatch(rend);
}

/** 句播完 / 换节 / 停止：清除所有听书层（与 …… / —— 无关，全量扫） */
export function clearListenMarkHighlight(rend?: Rendition): void {
	cancelAnimationFrame(relayoutRaf);
	relayoutRaf = 0;
	detachRelayout?.();
	detachRelayout = null;

	const target = rend ?? active?.rend;
	if (target) purgeListenAnnotations(target);

	for (const doc of collectPurgeDocs(target)) {
		purgeDocListenLayers(doc);
	}
	paintedDocs.clear();
	active = null;

	if (target) {
		getEpubScrollContainer(target)
			?.querySelectorAll('#moke-epub-listen-host-overlay')
			.forEach((root) => {
				root.replaceChildren();
			});
	}
}

if (!EPUB_LISTEN_SEGMENT_FILL.includes('0.28')) {
	throw new Error('[epubListenMarkHighlight] 播放背景色透明度异常');
}
