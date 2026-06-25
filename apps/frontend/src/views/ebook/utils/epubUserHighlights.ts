import type { Rendition } from 'epubjs';
import type {
	EbookThought,
	EbookThoughtClickCluster,
	EbookUserHighlight,
	EpubHighlightColorId,
	EpubHighlightStyle,
} from '../types';
import {
	beginEpubAnnotationSyncScope,
	cfiFromDomRange,
	EPUB_ANNOTATION_IGNORE_CLASS,
	endEpubAnnotationSyncScope,
	forEachTextNodeInRange,
	getAccurateRangeLineClientRects,
	getAccurateRangeLineClientRectsCached,
	isPointInRangeTextBand,
	resolveCfiDomRange,
	resolveMarkSvgLineSegments,
	type SvgLineSegment,
	snapSelectionRangeToTextContent,
	trimSelectionRange,
} from './epubRangeGeometry';
import {
	buildEpubPopBarPayloadFromCfiRange,
	type EpubSelectionPopBarPayload,
	suppressEpubSelectionPopBarDismiss,
} from './epubSelectionToolbarAttach';
import {
	applyEpubThoughtUnderlines,
	hasTextSelectionInRend,
	parseSvgMarkRect,
	patchEpubThoughtUnderlineMarks,
	restackThoughtMarkGroups,
	setUserHighlightBlockerSourcesForThoughtPatch,
	type UserHighlightBlockerSource,
} from './epubThoughtAnnotations';
import {
	buildThoughtClickClusterFromCandidates,
	expandClusterFromMarkSeed,
} from './epubThoughtCluster';

type EpubIframeContents = {
	document: Document;
	window: Window;
};

export const EPUB_USER_HIGHLIGHT_CLASS = 'moke-epub-user-hl';

const STYLE_ID = 'moke-epub-user-hl-styles';
const DATA_STYLE = 'hlStyle';
const DATA_COLOR = 'hlColor';

export const EPUB_HIGHLIGHT_COLOR_OPTIONS: {
	id: EpubHighlightColorId;
	fill: string;
	stroke: string;
}[] = [
	// fill 仅用于背景高亮；保持原色相，降低透明度以免压住正文
	{ id: 'pink', fill: 'rgba(255, 107, 129, 0.28)', stroke: '#ff6b81' },
	{ id: 'purple', fill: 'rgba(155, 89, 182, 0.28)', stroke: '#9b59b6' },
	{ id: 'blue', fill: 'rgba(52, 152, 219, 0.28)', stroke: '#3498db' },
	{ id: 'green', fill: 'rgba(46, 204, 113, 0.28)', stroke: '#2ecc71' },
	{ id: 'yellow', fill: 'rgba(241, 196, 15, 0.32)', stroke: '#f1c40f' },
];

const COLOR_BY_ID = Object.fromEntries(
	EPUB_HIGHLIGHT_COLOR_OPTIONS.map((item) => [item.id, item]),
) as Record<
	EpubHighlightColorId,
	(typeof EPUB_HIGHLIGHT_COLOR_OPTIONS)[number]
>;

const UNDERLINE_OFFSET_PX = 2;
const MIN_USER_HIGHLIGHT_BLOCKER_PX = 2;
const WAVY_PATH_CLASS = 'moke-epub-user-hl-wave';
/** 一个完整波浪周期约等于一字宽（典型 EPUB 正文字号） */
const WAVY_WAVELENGTH_PX = 16;
const WAVY_AMPLITUDE_PX = 1.2;
const WAVY_SAMPLE_STEP_PX = 2;

/** 沿 baseline 生成平滑正弦波浪下划线路径 */
function buildWavyUnderlinePath(
	startX: number,
	baseY: number,
	width: number,
): string {
	if (width <= 0) return '';
	let d = `M ${startX} ${baseY}`;
	for (
		let offset = WAVY_SAMPLE_STEP_PX;
		offset <= width;
		offset += WAVY_SAMPLE_STEP_PX
	) {
		const y =
			baseY +
			WAVY_AMPLITUDE_PX * Math.sin((2 * Math.PI * offset) / WAVY_WAVELENGTH_PX);
		d += ` L ${startX + offset} ${y}`;
	}
	const tail = width % WAVY_SAMPLE_STEP_PX;
	if (tail > 0.01) {
		const y =
			baseY +
			WAVY_AMPLITUDE_PX * Math.sin((2 * Math.PI * width) / WAVY_WAVELENGTH_PX);
		d += ` L ${startX + width} ${y}`;
	}
	return d;
}

/** apply 时写入，供 patch 按 CFI 读取样式/颜色 */
let highlightMetaByCfi = new Map<string, EbookUserHighlight>();

const USER_HIGHLIGHT_SELECTOR = `g.${EPUB_USER_HIGHLIGHT_CLASS}, g[ref="${EPUB_USER_HIGHLIGHT_CLASS}"], g[ref*="${EPUB_USER_HIGHLIGHT_CLASS}"], g[class*="${EPUB_USER_HIGHLIGHT_CLASS}"]`;

function getRenditionContentsList(rend?: Rendition): EpubIframeContents[] {
	if (!rend) return [];
	const raw = rend.getContents();
	return Array.isArray(raw)
		? (raw as EpubIframeContents[])
		: raw
			? [raw as EpubIframeContents]
			: [];
}

function ensureUserHighlightStyles(doc: Document = document): void {
	const head = doc.head ?? doc.documentElement;
	if (!head) return;

	let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
	if (!style) {
		style = doc.createElement('style');
		style.id = STYLE_ID;
		head.appendChild(style);
	}

	style.textContent = `
${USER_HIGHLIGHT_SELECTOR} > rect {
	stroke: transparent !important;
	stroke-width: 0 !important;
}
${USER_HIGHLIGHT_SELECTOR} > line {
	stroke-linecap: round !important;
}
${USER_HIGHLIGHT_SELECTOR} > path.${WAVY_PATH_CLASS} {
	fill: none !important;
	stroke-linecap: round !important;
	stroke-linejoin: round !important;
}
`;
}

function buildHighlightClassName(_item: EbookUserHighlight): string {
	return EPUB_USER_HIGHLIGHT_CLASS;
}

function resolveHighlightMetaFromGroup(
	g: Element,
	metaByCfi: Map<string, EbookUserHighlight>,
): { style: EpubHighlightStyle; color: EpubHighlightColorId } {
	const el = g as SVGElement;
	const cfi = el.dataset.epubcfi;
	const fromMap = cfi ? metaByCfi.get(cfi) : undefined;
	if (fromMap) {
		return { style: fromMap.style, color: fromMap.color };
	}
	return {
		style: (el.dataset[DATA_STYLE] ?? 'highlight') as EpubHighlightStyle,
		color: (el.dataset[DATA_COLOR] ?? 'pink') as EpubHighlightColorId,
	};
}

function setSvgAttrIfChanged(el: Element, name: string, value: string): void {
	if (el.getAttribute(name) !== value) {
		el.setAttribute(name, value);
	}
}

function patchUserHighlightMarks(
	root: ParentNode = document,
	metaByCfi: Map<string, EbookUserHighlight> = highlightMetaByCfi,
	rend?: Rendition,
): void {
	const groups = root.querySelectorAll(USER_HIGHLIGHT_SELECTOR);

	groups.forEach((g) => {
		const groupEl = g as SVGElement;
		const { style, color: colorId } = resolveHighlightMetaFromGroup(
			g,
			metaByCfi,
		);
		const palette = COLOR_BY_ID[colorId] ?? COLOR_BY_ID.pink;
		if (groupEl.style.pointerEvents !== 'none') {
			groupEl.style.pointerEvents = 'none';
		}

		const cfi = groupEl.dataset.epubcfi?.trim();
		const segments = resolveMarkSvgLineSegments(rend, groupEl, cfi);
		const rects = syncHighlightMarkRects(groupEl, segments);

		const lines = groupEl.querySelectorAll('line');

		if (style === 'highlight') {
			groupEl.querySelectorAll(`path.${WAVY_PATH_CLASS}`).forEach((node) => {
				node.remove();
			});
			lines.forEach((line) => {
				setSvgAttrIfChanged(line, 'stroke', 'transparent');
				setSvgAttrIfChanged(line, 'stroke-opacity', '0');
			});
		} else if (style === 'underline') {
			groupEl.querySelectorAll(`path.${WAVY_PATH_CLASS}`).forEach((node) => {
				node.remove();
			});
		}

		const wavyPaths = groupEl.querySelectorAll(`path.${WAVY_PATH_CLASS}`);

		rects.forEach((rect, index) => {
			const segment = readHighlightSegment(rect, segments[index]);
			const { x, y, width, height } = segment;
			const lineY = y + height + UNDERLINE_OFFSET_PX;

			if (style === 'highlight') {
				setSvgAttrIfChanged(rect, 'fill', palette.fill);
				setSvgAttrIfChanged(rect, 'fill-opacity', '1');
				setSvgAttrIfChanged(rect, 'stroke', 'transparent');
				setSvgAttrIfChanged(rect, 'stroke-width', '0');
				return;
			}

			setSvgAttrIfChanged(rect, 'stroke', 'transparent');
			setSvgAttrIfChanged(rect, 'stroke-width', '0');
			setSvgAttrIfChanged(rect, 'fill', 'currentColor');
			setSvgAttrIfChanged(rect, 'fill-opacity', '0.001');

			if (style === 'wavy') {
				const line = lines[index] as SVGLineElement | undefined;
				if (line) {
					setSvgAttrIfChanged(line, 'stroke', 'transparent');
					setSvgAttrIfChanged(line, 'stroke-opacity', '0');
				}

				let path = wavyPaths[index] as SVGPathElement | undefined;
				if (!path) {
					path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
					path.classList.add(WAVY_PATH_CLASS);
					groupEl.appendChild(path);
				}
				const geometryKey = `${x}|${lineY}|${width}`;
				if (path.dataset.geometryKey !== geometryKey) {
					path.dataset.geometryKey = geometryKey;
					path.setAttribute('d', buildWavyUnderlinePath(x, lineY, width));
				}
				setSvgAttrIfChanged(path, 'stroke', palette.stroke);
				setSvgAttrIfChanged(path, 'stroke-opacity', '0.95');
				setSvgAttrIfChanged(path, 'stroke-width', '1.5');
				setSvgAttrIfChanged(path, 'fill', 'none');
				return;
			}

			let line = lines[index] as SVGLineElement | undefined;
			if (!line) {
				line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
				groupEl.appendChild(line);
			}

			const x2 = x + width;
			const lineGeometryKey = `${x}|${x2}|${lineY}`;
			if (line.dataset.geometryKey !== lineGeometryKey) {
				line.dataset.geometryKey = lineGeometryKey;
				line.setAttribute('x1', String(x));
				line.setAttribute('x2', String(x2));
				line.setAttribute('y1', String(lineY));
				line.setAttribute('y2', String(lineY));
			}
			setSvgAttrIfChanged(line, 'stroke', palette.stroke);
			setSvgAttrIfChanged(line, 'stroke-opacity', '0.95');
			setSvgAttrIfChanged(line, 'stroke-width', '2');
			setSvgAttrIfChanged(line, 'stroke-dasharray', 'none');
			setSvgAttrIfChanged(line, 'stroke-linecap', 'round');
		});

		if (style === 'wavy') {
			groupEl
				.querySelectorAll(`path.${WAVY_PATH_CLASS}`)
				.forEach((node, index) => {
					if (index >= rects.length) node.remove();
				});
		}

		for (let index = rects.length; index < lines.length; index++) {
			const line = lines[index] as SVGLineElement;
			setSvgAttrIfChanged(line, 'stroke', 'transparent');
			setSvgAttrIfChanged(line, 'stroke-opacity', '0');
		}
	});
}

function readHighlightSegment(
	rect: SVGRectElement,
	fallback?: SvgLineSegment,
): SvgLineSegment {
	if (fallback) return fallback;
	return {
		x: Number.parseFloat(rect.getAttribute('x') ?? '0'),
		y: Number.parseFloat(rect.getAttribute('y') ?? '0'),
		width: Number.parseFloat(rect.getAttribute('width') ?? '0'),
		height: Number.parseFloat(rect.getAttribute('height') ?? '0'),
	};
}

function syncHighlightMarkRects(
	group: SVGElement,
	segments: SvgLineSegment[],
): SVGRectElement[] {
	const existing = [...group.querySelectorAll('rect')].filter(
		(rect): rect is SVGRectElement => rect instanceof SVGRectElement,
	);
	if (segments.length === 0) {
		return existing;
	}

	const rects: SVGRectElement[] = [];

	for (let index = 0; index < segments.length; index++) {
		const segment = segments[index]!;
		let rect = existing[index];
		if (!rect) {
			rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			group.insertBefore(rect, group.firstChild);
		}
		setSvgAttrIfChanged(rect, 'x', String(segment.x));
		setSvgAttrIfChanged(rect, 'y', String(segment.y));
		setSvgAttrIfChanged(rect, 'width', String(segment.width));
		setSvgAttrIfChanged(rect, 'height', String(segment.height));
		rects.push(rect);
	}

	for (let index = segments.length; index < existing.length; index++) {
		existing[index]?.remove();
	}

	return rects;
}

function patchAllUserHighlightMarks(rend?: Rendition): void {
	const meta = highlightMetaByCfi;
	const docs = new Set<Document>([document]);
	for (const contents of getRenditionContentsList(rend)) {
		if (contents.document) docs.add(contents.document);
	}
	for (const doc of docs) {
		try {
			ensureUserHighlightStyles(doc);
			patchUserHighlightMarks(doc, meta, rend);
		} catch {
			// iframe 卸载时忽略
		}
	}
}

function buildHighlightStyles(
	item: EbookUserHighlight,
): Record<string, string> {
	const palette = COLOR_BY_ID[item.color] ?? COLOR_BY_ID.pink;
	if (item.style === 'highlight') {
		return {
			fill: palette.fill,
			'fill-opacity': '1',
			stroke: 'transparent',
			'stroke-width': '0',
			'mix-blend-mode': 'normal',
		};
	}
	return {
		stroke: palette.stroke,
		'stroke-opacity': '0.95',
		'stroke-width': '2',
		'stroke-dasharray': 'none',
		'mix-blend-mode': 'normal',
	};
}

function buildHighlightData(item: EbookUserHighlight): Record<string, string> {
	return {
		highlightId: item.id,
		[DATA_STYLE]: item.style,
		[DATA_COLOR]: item.color,
	};
}

/** apply 时注入，供 annotation cb 与 iframe 正文点击共用 */
let userHighlightClickRouter: ((highlight: EbookUserHighlight) => void) | null =
	null;

function buildUserHighlightClickHandler(item: EbookUserHighlight): () => void {
	return () => {
		userHighlightClickRouter?.(item);
	};
}

type ContentsWithCfi = EpubIframeContents & {
	cfiFromRange: (range: Range, ignoreClass?: string) => string;
};

function isClickRangeInsideHighlight(
	clickRange: Range,
	highlightRange: Range,
): boolean {
	try {
		return (
			highlightRange.compareBoundaryPoints(Range.START_TO_START, clickRange) <=
				0 &&
			highlightRange.compareBoundaryPoints(Range.END_TO_END, clickRange) >= 0
		);
	} catch {
		return false;
	}
}

type ContentsWithRange = EpubIframeContents & {
	range: (cfi: string) => Range | null;
};

function isCfiResolvedRangeWithinHighlight(
	rend: Rendition,
	pointCfi: string,
	highlight: EbookUserHighlight,
	doc?: Document,
): boolean {
	const outerRange = resolveCfiDomRange(rend, highlight.cfiRange);
	if (!outerRange) return false;
	if (doc && outerRange.startContainer.ownerDocument !== doc) return false;

	const raw = rend.getContents();
	const list: ContentsWithRange[] = Array.isArray(raw)
		? (raw as ContentsWithRange[])
		: raw
			? [raw as ContentsWithRange]
			: [];

	for (const contents of list) {
		if (doc && contents.document !== doc) continue;
		try {
			const pointRange = contents.range?.(pointCfi);
			if (pointRange && isClickRangeInsideHighlight(pointRange, outerRange)) {
				return true;
			}
		} catch {
			// ignore
		}
	}
	return false;
}

type ReaderClickPoint = {
	document: Document;
	clientX: number;
	clientY: number;
	at: number;
};

let lastReaderClickPoint: ReaderClickPoint | null = null;

function rememberReaderClickPoint(
	doc: Document,
	clientX: number,
	clientY: number,
): void {
	lastReaderClickPoint = { document: doc, clientX, clientY, at: Date.now() };
}

function getContentsWithCfiForDocument(
	rend: Rendition,
	doc: Document,
): ContentsWithCfi | null {
	const raw = rend.getContents();
	const list: ContentsWithCfi[] = Array.isArray(raw)
		? (raw as ContentsWithCfi[])
		: raw
			? [raw as ContentsWithCfi]
			: [];
	return list.find((item) => item.document === doc) ?? null;
}

function caretRangeFromPoint(
	doc: Document,
	x: number,
	y: number,
): Range | null {
	if (doc.caretRangeFromPoint) {
		return doc.caretRangeFromPoint(x, y);
	}
	const docWithCaret = doc as Document & {
		caretPositionFromPoint?: (
			px: number,
			py: number,
		) => { offsetNode: Node; offset: number } | null;
	};
	const pos = docWithCaret.caretPositionFromPoint?.(x, y);
	if (!pos) return null;
	const range = doc.createRange();
	range.setStart(pos.offsetNode, pos.offset);
	range.collapse(true);
	return range;
}

/** 点击是否落在划线正文行内（限制行高向下延伸的空白；用文本片段 rect 避免行尾空白） */
function isPointInHighlightTextBand(
	range: Range,
	iframe: Element | null,
	clientX: number,
	clientY: number,
	maxBelowPx: number,
): boolean {
	return isPointInRangeTextBand(range, iframe, clientX, clientY, maxBelowPx);
}

function highlightClickSlopBelow(item: EbookUserHighlight): number {
	if (item.style === 'underline' || item.style === 'wavy') return 8;
	return 2;
}

function isHighlightHitAtClickPoint(
	rend: Rendition,
	contents: ContentsWithCfi,
	clientX: number,
	clientY: number,
	highlight: EbookUserHighlight,
): boolean {
	const iframe = contents.window.frameElement;

	const highlightRange = resolveCfiDomRange(rend, highlight.cfiRange);
	if (
		!highlightRange ||
		highlightRange.startContainer.ownerDocument !== contents.document
	) {
		return false;
	}

	const slop = highlightClickSlopBelow(highlight);
	if (
		!isPointInHighlightTextBand(highlightRange, iframe, clientX, clientY, slop)
	) {
		return false;
	}

	const clickRange = caretRangeFromPoint(contents.document, clientX, clientY);
	if (!clickRange) return false;

	try {
		return isClickRangeInsideHighlight(clickRange, highlightRange);
	} catch {
		return false;
	}
}

function isHighlightHitAtRecentClick(
	rend: Rendition,
	highlight: EbookUserHighlight,
): boolean {
	const click = lastReaderClickPoint;
	if (!click || Date.now() - click.at > 800) return false;
	const contents = getContentsWithCfiForDocument(rend, click.document);
	if (!contents) return false;
	return isHighlightHitAtClickPoint(
		rend,
		contents,
		click.clientX,
		click.clientY,
		highlight,
	);
}

/** 仅当点击落在划线正文 DOM 区域内才命中（不用 SVG mark 行高） */
function findUserHighlightAtClickPoint(
	rend: Rendition,
	contents: ContentsWithCfi,
	clientX: number,
	clientY: number,
	highlights: EbookUserHighlight[],
): EbookUserHighlight | null {
	const iframe = contents.window.frameElement;
	if (!iframe) return null;

	const matched = highlights.filter((highlight) =>
		isHighlightHitAtClickPoint(rend, contents, clientX, clientY, highlight),
	);
	if (matched.length === 0) return null;

	return sortHighlightsForStack(matched).at(-1) ?? matched[0] ?? null;
}

/**
 * iframe 内 click：仅正文 DOM 命中，markClicked 路径需配合 mousedown 坐标校验。
 */
function attachUserHighlightReaderClickListener(
	rend: Rendition,
	getHighlights: () => EbookUserHighlight[],
	getThoughts: () => EbookThought[],
	onThoughtClusterClick: (cluster: EbookThoughtClickCluster) => void,
	onHighlightHit: (
		highlight: EbookUserHighlight,
		anchor?: HighlightHitAnchor,
	) => void,
): () => void {
	const cleanups = new Map<Document, () => void>();

	const dispatch = (event: MouseEvent, contents: ContentsWithCfi) => {
		if (event.button !== 0 || event.defaultPrevented) return;
		if (hasTextSelectionInRend(rend)) return;

		rememberReaderClickPoint(contents.document, event.clientX, event.clientY);

		const thoughts = getThoughts();
		const thoughtCandidates = findThoughtsAtClickPoint(
			rend,
			contents,
			event.clientX,
			event.clientY,
			thoughts,
		);
		if (thoughtCandidates.length > 0) {
			scheduleThoughtClusterClick(
				rend,
				thoughts,
				thoughtCandidates,
				false,
				onThoughtClusterClick,
			);
			return;
		}

		const highlights = getHighlights();
		if (highlights.length === 0) return;

		const hit = findUserHighlightAtClickPoint(
			rend,
			contents,
			event.clientX,
			event.clientY,
			highlights,
		);
		if (!hit) return;

		onHighlightHit(hit, {
			clientX: event.clientX,
			clientY: event.clientY,
			contents,
		});
	};

	const bindContents = (contents: EpubIframeContents) => {
		if (cleanups.has(contents.document)) return;
		const doc = contents.document;
		const contentsWithCfi = contents as ContentsWithCfi;

		const onClick = (e: MouseEvent) => dispatch(e, contentsWithCfi);
		const onMouseDown = (e: MouseEvent) => {
			if (e.button !== 0) return;
			rememberReaderClickPoint(doc, e.clientX, e.clientY);
		};

		doc.addEventListener('mousedown', onMouseDown, true);
		doc.addEventListener('click', onClick, false);

		cleanups.set(contents.document, () => {
			doc.removeEventListener('mousedown', onMouseDown, true);
			doc.removeEventListener('click', onClick, false);
		});
	};

	rend.hooks.content.register(bindContents);
	const existing = rend.getContents();
	if (Array.isArray(existing)) {
		for (const item of existing) bindContents(item as EpubIframeContents);
	} else if (existing) {
		bindContents(existing as EpubIframeContents);
	}

	return () => {
		try {
			rend.hooks.content.deregister(bindContents);
		} catch {
			// ignore
		}
		for (const fn of cleanups.values()) fn();
		cleanups.clear();
	};
}

function extractCfiSpineHint(cfiRange: string): string {
	const match = cfiRange.match(/epubcfi\(([^!]+)!/);
	return match?.[1] ?? cfiRange;
}

function isQuoteStrictlyNested(
	innerQuote: string,
	outerQuote: string,
): boolean {
	if (!innerQuote || !outerQuote || innerQuote === outerQuote) return false;
	return outerQuote.includes(innerQuote);
}

function isDomRangeOverlapping(a: Range, b: Range): boolean {
	try {
		if (a.startContainer.ownerDocument !== b.startContainer.ownerDocument) {
			return false;
		}
		return (
			a.compareBoundaryPoints(Range.END_TO_START, b) > 0 &&
			a.compareBoundaryPoints(Range.START_TO_END, b) < 0
		);
	} catch {
		return false;
	}
}

/** 相交或端点相接（「…杨广死」+「死于…」共享「死」边界） */
function isDomRangeTouchingOrOverlapping(a: Range, b: Range): boolean {
	try {
		if (a.startContainer.ownerDocument !== b.startContainer.ownerDocument) {
			return false;
		}
		return (
			a.compareBoundaryPoints(Range.END_TO_START, b) >= 0 &&
			a.compareBoundaryPoints(Range.START_TO_END, b) <= 0
		);
	} catch {
		return false;
	}
}

function highlightSpanLength(item: EbookUserHighlight): number {
	const quote = item.quote?.trim();
	if (quote && quote.length > 0) return quote.length;
	return item.cfiRange.length;
}

/** 判断 inner 划线是否被 outer 严格包含（对齐想法下划线的嵌套判定） */
export function isHighlightCfiStrictlyContained(
	inner: Pick<EbookUserHighlight, 'cfiRange' | 'quote'>,
	outer: Pick<EbookUserHighlight, 'cfiRange' | 'quote'>,
	rend?: Rendition,
): boolean {
	const innerCfi = inner.cfiRange.trim();
	const outerCfi = outer.cfiRange.trim();
	if (!innerCfi || !outerCfi || innerCfi === outerCfi) return false;

	if (rend) {
		const innerRange = resolveCfiDomRange(rend, innerCfi);
		const outerRange = resolveCfiDomRange(rend, outerCfi);
		if (innerRange && outerRange) {
			return isDomRangeStrictlyContained(innerRange, outerRange);
		}
	}

	const innerQuote = inner.quote?.trim() ?? '';
	const outerQuote = outer.quote?.trim() ?? '';
	if (!isQuoteStrictlyNested(innerQuote, outerQuote)) return false;
	return extractCfiSpineHint(innerCfi) === extractCfiSpineHint(outerCfi);
}

/** 计算应绘制可见样式的划线 CFI（被更大选区严格包含的内层不绘制） */
export function computeVisibleHighlightCfis(
	highlights: EbookUserHighlight[],
	rend: Rendition,
): Set<string> {
	const visible = new Set<string>();
	for (const item of highlights) {
		const cfi = item.cfiRange.trim();
		if (!cfi) continue;
		const contained = highlights.some(
			(other) =>
				other.cfiRange.trim() !== cfi &&
				isHighlightCfiStrictlyContained(item, other, rend),
		);
		if (!contained) visible.add(cfi);
	}
	return visible;
}

/** 找出被新选区严格包含、应被后续划线取代的旧划线（持久化层清理用） */
export function findHighlightsStrictlyContainedIn(
	outer: Pick<EbookUserHighlight, 'cfiRange' | 'quote'>,
	highlights: EbookUserHighlight[],
): EbookUserHighlight[] {
	const outerCfi = outer.cfiRange.trim();
	return highlights.filter(
		(item) =>
			item.cfiRange.trim() !== outerCfi &&
			isHighlightCfiStrictlyContained(item, outer),
	);
}

function sortHighlightsForStack(
	highlights: EbookUserHighlight[],
): EbookUserHighlight[] {
	return [...highlights].sort((a, b) => {
		const spanDiff = highlightSpanLength(b) - highlightSpanLength(a);
		if (spanDiff !== 0) return spanDiff;
		return a.cfiRange.length - b.cfiRange.length;
	});
}

function buildHighlightApplySignature(item: EbookUserHighlight): string {
	return `${item.style}|${item.color}|${item.id}`;
}

type HighlightRenderPlan = {
	coalesced: EbookUserHighlight[];
	visibleCfis: Set<string>;
	sortedHighlights: EbookUserHighlight[];
	keepCfis: Set<string>;
};

function buildHighlightRenderPlan(
	rend: Rendition,
	highlights: EbookUserHighlight[],
): HighlightRenderPlan {
	const coalesced = coalesceOverlappingHighlightsForRender(rend, highlights);
	const visibleCfis = computeVisibleHighlightCfis(coalesced, rend);
	const sortedHighlights = sortHighlightsForStack(coalesced);
	const keepCfis = new Set(
		sortedHighlights
			.filter((item) => visibleCfis.has(item.cfiRange))
			.map((item) => item.cfiRange),
	);
	return { coalesced, visibleCfis, sortedHighlights, keepCfis };
}

function purgeStaleUserHighlightAnnotations(
	rend: Rendition,
	rawHighlights: EbookUserHighlight[],
	visibleCfis: Set<string>,
	appliedRef: Map<string, string>,
): void {
	const keepCfis = new Set(
		[...visibleCfis].filter((cfi) => cfi.trim().length > 0),
	);

	for (const item of rawHighlights) {
		const cfi = item.cfiRange.trim();
		if (!cfi || keepCfis.has(cfi)) continue;
		removeUserHighlightAnnotation(rend, cfi, appliedRef);
	}

	for (const cfiRange of [...appliedRef.keys()]) {
		if (!keepCfis.has(cfiRange)) {
			removeUserHighlightAnnotation(rend, cfiRange, appliedRef);
		}
	}
}

export function applyEpubUserHighlights(
	rend: Rendition,
	highlights: EbookUserHighlight[],
	appliedRef: Map<string, string>,
	plan?: HighlightRenderPlan,
): void {
	try {
		ensureUserHighlightStyles();
	} catch {
		return;
	}

	const renderPlan = plan ?? buildHighlightRenderPlan(rend, highlights);
	const { visibleCfis, sortedHighlights, keepCfis } = renderPlan;

	highlightMetaByCfi = new Map(
		sortedHighlights
			.filter((item) => visibleCfis.has(item.cfiRange))
			.map((item) => [item.cfiRange, item]),
	);

	purgeStaleUserHighlightAnnotations(rend, highlights, keepCfis, appliedRef);

	for (const item of sortedHighlights) {
		if (!visibleCfis.has(item.cfiRange)) continue;

		const nextSig = buildHighlightApplySignature(item);
		if (appliedRef.get(item.cfiRange) === nextSig) continue;

		removeUserHighlightAnnotation(rend, item.cfiRange, appliedRef);
		try {
			// 统一 highlight 类型，与想法 underline 批注槽位分离；点击走 markClicked + iframe click
			rend.annotations.highlight(
				item.cfiRange,
				buildHighlightData(item),
				buildUserHighlightClickHandler(item),
				buildHighlightClassName(item),
				buildHighlightStyles(item),
			);
			appliedRef.set(item.cfiRange, nextSig);
		} catch {
			appliedRef.delete(item.cfiRange);
		}
	}
}

function removeUserHighlightAnnotation(
	rend: Rendition,
	cfiRange: string,
	appliedRef: Map<string, string>,
): void {
	try {
		// 用户划线统一用 highlight 类型，避免 remove(underline) 误删想法虚线
		rend.annotations.remove(cfiRange, 'highlight');
	} catch {
		// ignore
	}
	appliedRef.delete(cfiRange);
}

export function teardownAppliedUserHighlights(
	rend: Rendition,
	appliedRef: Map<string, string>,
): void {
	for (const cfiRange of [...appliedRef.keys()]) {
		removeUserHighlightAnnotation(rend, cfiRange, appliedRef);
	}
	appliedRef.clear();
}

export function findUserHighlightByCfi(
	highlights: EbookUserHighlight[],
	cfiRange?: string,
): EbookUserHighlight | undefined {
	if (!cfiRange) return undefined;
	return highlights.find((item) => item.cfiRange === cfiRange);
}

/**
 * 侧栏/想法引用是否被某条划线覆盖。
 * 与 PopBar 一致：有 rendition 时只认 CFI/DOM，不用 quote 文本跨位置命中
 * （同章两处「司马懿的第四子」不会互相误匹配）。
 */
function doesUserHighlightCoverSubject(
	item: EbookUserHighlight,
	subject: { cfiRange: string; quote: string },
	rend?: Rendition,
): boolean {
	const key = subject.cfiRange.trim();
	const itemCfi = item.cfiRange.trim();
	if (!key || !itemCfi) return false;
	if (itemCfi === key) return true;

	const itemQuote = item.quote?.trim() ?? '';

	if (isHighlightCfiStrictlyContained(subject, item, rend)) return true;
	if (
		isHighlightCfiStrictlyContained(
			{ cfiRange: itemCfi, quote: itemQuote },
			subject,
			rend,
		)
	) {
		return true;
	}

	if (!rend) return false;

	if (isCfiResolvedRangeWithinHighlight(rend, key, item)) return true;

	const subjectRange = resolveCfiDomRange(rend, key);
	const highlightRange = resolveCfiDomRange(rend, itemCfi);
	if (!subjectRange || !highlightRange) return false;

	if (
		subjectRange.startContainer.ownerDocument !==
		highlightRange.startContainer.ownerDocument
	) {
		return false;
	}

	return doDomRangesOverlapForMerge(subjectRange, highlightRange);
}

/** 与当前引用 CFI/选区存在重叠的全部用户划线（删除时需一并清理） */
export function findAllUserHighlightsCoveringCfi(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): EbookUserHighlight[] {
	const key = cfiRange.trim();
	if (!key || highlights.length === 0) return [];

	const subject = { cfiRange: key, quote: quote?.trim() ?? '' };
	return highlights.filter((item) =>
		doesUserHighlightCoverSubject(item, subject, rend),
	);
}

/** 精确 CFI、严格包含或 DOM/引用重叠：想法侧栏/PopBar 判定当前引用是否已有用户划线 */
export function findUserHighlightCoveringCfi(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): EbookUserHighlight | undefined {
	return findAllUserHighlightsCoveringCfi(highlights, cfiRange, quote, rend)[0];
}

/** 选区 PopBar：仅 DOM 相交/包含时命中，避免 quote 子串（如「司马亮和卫瓘」）误匹配 distant 划线 */
function doesUserHighlightMatchSelection(
	item: EbookUserHighlight,
	subject: { cfiRange: string; quote: string },
	rend?: Rendition,
): boolean {
	const key = subject.cfiRange.trim();
	const itemCfi = item.cfiRange.trim();
	if (!key || !itemCfi) return false;
	if (itemCfi === key) return true;

	const itemQuote = item.quote?.trim() ?? '';

	if (isHighlightCfiStrictlyContained(subject, item, rend)) return true;
	if (
		isHighlightCfiStrictlyContained(
			{ cfiRange: itemCfi, quote: itemQuote },
			subject,
			rend,
		)
	) {
		return true;
	}

	if (!rend) return false;

	const subjectRange = resolveCfiDomRange(rend, key);
	const highlightRange = resolveCfiDomRange(rend, itemCfi);
	if (!subjectRange || !highlightRange) {
		return false;
	}

	if (
		subjectRange.startContainer.ownerDocument !==
		highlightRange.startContainer.ownerDocument
	) {
		return false;
	}

	if (isDomRangeContainedIn(subjectRange, highlightRange)) {
		const subjectNorm = normalizeComparableText(subject.quote);
		const itemNorm = normalizeComparableText(itemQuote);
		if (!subjectNorm || !itemNorm || itemNorm.includes(subjectNorm)) {
			return true;
		}
	}

	return doDomRangesOverlapForSelection(subjectRange, highlightRange);
}

/** 当前文字选区命中的全部用户划线（删除时需一并清理选区内划线） */
export function findAllUserHighlightsForSelection(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): EbookUserHighlight[] {
	const key = cfiRange.trim();
	if (!key || highlights.length === 0) return [];

	const subject = { cfiRange: key, quote: quote?.trim() ?? '' };
	return highlights.filter((item) =>
		doesUserHighlightMatchSelection(item, subject, rend),
	);
}

/** 当前文字选区是否已有用户划线（供选区 PopBar 展示删除/样式状态） */
export function findUserHighlightForSelection(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): EbookUserHighlight | undefined {
	const matched = findAllUserHighlightsForSelection(
		highlights,
		cfiRange,
		quote,
		rend,
	);
	if (matched.length === 0) return undefined;
	if (matched.length === 1) return matched[0];
	return sortHighlightsForStack(matched).at(-1) ?? matched[0];
}

function isDomPointInsideRange(
	container: Node,
	offset: number,
	range: Range,
): boolean {
	try {
		const doc = range.startContainer.ownerDocument;
		if (!doc) return false;
		const point = doc.createRange();
		point.setStart(container, offset);
		point.collapse(true);
		return (
			range.compareBoundaryPoints(Range.START_TO_START, point) <= 0 &&
			range.compareBoundaryPoints(Range.END_TO_END, point) >= 0
		);
	} catch {
		return false;
	}
}

function isDomPointInsideAnyRange(
	container: Node,
	offset: number,
	ranges: Range[],
): boolean {
	return ranges.some((range) =>
		isDomPointInsideRange(container, offset, range),
	);
}

function normalizeComparableText(text: string): string {
	return text.replace(/\s+/gu, '');
}

function clipRangeToOuterBounds(inner: Range, outer: Range): Range | null {
	try {
		if (
			inner.startContainer.ownerDocument !== outer.startContainer.ownerDocument
		) {
			return null;
		}
		if (!doDomRangesOverlapForSelection(inner, outer)) return null;

		const clipped = inner.cloneRange();
		if (clipped.compareBoundaryPoints(Range.START_TO_START, outer) < 0) {
			clipped.setStart(outer.startContainer, outer.startOffset);
		}
		if (clipped.compareBoundaryPoints(Range.END_TO_END, outer) > 0) {
			clipped.setEnd(outer.endContainer, outer.endOffset);
		}
		if (clipped.collapsed) return null;
		return clipped;
	} catch {
		return null;
	}
}

/** 在 outer 内按 quote 文本定位 DOM 子 Range；多命中时优先与 hintRange 重叠最多者 */
function locateQuoteInRange(
	outer: Range,
	quote: string,
	hintRange?: Range,
): Range | null {
	const q = quote.trim();
	if (!q) return null;

	const doc = outer.startContainer.ownerDocument;
	if (!doc) return null;

	const containerText = outer.toString();
	const indices: number[] = [];
	let searchFrom = 0;
	while (searchFrom <= containerText.length) {
		const index = containerText.indexOf(q, searchFrom);
		if (index < 0) break;
		indices.push(index);
		searchFrom = index + 1;
	}
	if (indices.length === 0) return null;

	const pickIndex =
		indices.length === 1 || !hintRange
			? indices[0]!
			: (() => {
					let bestIndex = indices[0]!;
					let bestScore = -1;
					for (const index of indices) {
						const candidate = charOffsetsToRange(
							doc,
							outer,
							index,
							index + q.length,
						);
						if (!candidate) continue;
						const score = rangeOverlapScore(candidate, hintRange);
						if (score > bestScore) {
							bestScore = score;
							bestIndex = index;
						}
					}
					return bestIndex;
				})();

	return charOffsetsToRange(doc, outer, pickIndex, pickIndex + q.length);
}

/** quote 与 DOM 空白不一致时，按去空白字符序列在 outer 内定位 */
function locateQuoteInNormalizedRange(
	outer: Range,
	quote: string,
): Range | null {
	const q = normalizeComparableText(quote);
	if (!q) return null;

	const doc = outer.startContainer.ownerDocument;
	if (!doc) return null;

	const points: Array<{ node: Text; offset: number; ch: string }> = [];
	const walker = doc.createTreeWalker(
		outer.commonAncestorContainer,
		NodeFilter.SHOW_TEXT,
		{
			acceptNode(node) {
				try {
					return outer.intersectsNode(node)
						? NodeFilter.FILTER_ACCEPT
						: NodeFilter.FILTER_REJECT;
				} catch {
					return NodeFilter.FILTER_REJECT;
				}
			},
		},
	);

	for (
		let node = walker.nextNode() as Text | null;
		node;
		node = walker.nextNode() as Text | null
	) {
		const nodeStart = node === outer.startContainer ? outer.startOffset : 0;
		const nodeEnd = node === outer.endContainer ? outer.endOffset : node.length;

		for (let offset = nodeStart; offset < nodeEnd; offset++) {
			const ch = node.data[offset];
			if (!ch || /\s/u.test(ch)) continue;
			points.push({ node, offset, ch });
		}
	}

	const compact = points.map((point) => point.ch).join('');
	const index = compact.indexOf(q);
	if (index < 0) return null;

	const start = points[index]!;
	const end = points[index + q.length - 1]!;
	const range = doc.createRange();
	range.setStart(start.node, start.offset);
	range.setEnd(end.node, end.offset + 1);
	return range;
}

function charOffsetsToRange(
	doc: Document,
	outer: Range,
	startIndex: number,
	endIndex: number,
): Range | null {
	let cursor = 0;
	let startNode: Node | null = null;
	let startOffset = 0;
	let endNode: Node | null = null;
	let endOffset = 0;
	let hasStart = false;

	const walker = doc.createTreeWalker(
		outer.commonAncestorContainer,
		NodeFilter.SHOW_TEXT,
		{
			acceptNode(node) {
				try {
					return outer.intersectsNode(node)
						? NodeFilter.FILTER_ACCEPT
						: NodeFilter.FILTER_REJECT;
				} catch {
					return NodeFilter.FILTER_REJECT;
				}
			},
		},
	);

	for (
		let node = walker.nextNode() as Text | null;
		node;
		node = walker.nextNode() as Text | null
	) {
		const nodeStart = node === outer.startContainer ? outer.startOffset : 0;
		const nodeEnd = node === outer.endContainer ? outer.endOffset : node.length;

		for (let offset = nodeStart; offset < nodeEnd; offset++) {
			if (!hasStart && cursor === startIndex) {
				startNode = node;
				startOffset = offset;
				hasStart = true;
			}
			if (hasStart && cursor === endIndex) {
				endNode = node;
				endOffset = offset;
				const range = doc.createRange();
				range.setStart(startNode!, startOffset);
				range.setEnd(endNode, endOffset);
				return range;
			}
			cursor++;
		}
	}

	if (hasStart && cursor === endIndex) {
		const range = doc.createRange();
		range.setStart(startNode!, startOffset);
		range.setEnd(outer.endContainer, outer.endOffset);
		return range;
	}

	return null;
}

function rangeOverlapScore(a: Range, b: Range): number {
	try {
		if (!doDomRangesOverlapForSelection(a, b)) return 0;
		const start =
			a.compareBoundaryPoints(Range.START_TO_START, b) >= 0
				? a.cloneRange()
				: b.cloneRange();
		start.collapse(true);
		const end =
			a.compareBoundaryPoints(Range.END_TO_END, b) <= 0
				? a.cloneRange()
				: b.cloneRange();
		end.collapse(false);
		const probe = a.cloneRange();
		probe.setStart(start.startContainer, start.startOffset);
		probe.setEnd(end.endContainer, end.endOffset);
		return probe.toString().length;
	} catch {
		return 0;
	}
}

/** 按归一化下标从 quote 截取与选区对应的原文片段 */
function extractQuoteSubstringByNormalizedSpan(
	quote: string,
	normStart: number,
	normLength: number,
): string | null {
	if (normLength <= 0) return null;

	let normCursor = 0;
	let start = -1;
	let end = -1;

	for (let i = 0; i < quote.length; i++) {
		const ch = quote[i];
		if (!ch || /\s/u.test(ch)) continue;

		if (normCursor === normStart) start = i;
		normCursor++;
		if (normCursor === normStart + normLength) {
			end = i + 1;
			break;
		}
	}

	if (start < 0 || end < 0 || end <= start) return null;
	return quote.slice(start, end);
}

function isDomRangeContainedIn(inner: Range, outer: Range): boolean {
	try {
		return (
			inner.compareBoundaryPoints(Range.START_TO_START, outer) >= 0 &&
			inner.compareBoundaryPoints(Range.END_TO_END, outer) <= 0
		);
	} catch {
		return false;
	}
}

/** 在选区与划线的交集中，用 quote 精确定位真实覆盖范围（绝不退回整段选区） */
function locateHighlightQuoteCoverInSelection(
	trimmedClipped: Range,
	quote: string,
	highlightRange: Range,
): Range | null {
	const located =
		locateQuoteInRange(trimmedClipped, quote, highlightRange) ??
		locateQuoteInNormalizedRange(trimmedClipped, quote);
	if (located) return trimSelectionRange(located);

	const clippedNorm = normalizeComparableText(trimmedClipped.toString());
	const quoteNorm = normalizeComparableText(quote);
	if (!quoteNorm || !clippedNorm) return null;

	// 选区是更大划线 quote 的连续子串（在大段划线内拖选子集，且该子集均已划线）
	if (quoteNorm.includes(clippedNorm)) {
		const index = quoteNorm.indexOf(clippedNorm);
		if (
			index >= 0 &&
			quoteNorm.slice(index, index + clippedNorm.length) === clippedNorm
		) {
			const subQuote = extractQuoteSubstringByNormalizedSpan(
				quote,
				index,
				clippedNorm.length,
			);
			if (subQuote) {
				const subLocated = locateQuoteInNormalizedRange(
					trimmedClipped,
					subQuote,
				);
				if (subLocated) return trimSelectionRange(subLocated);
			}
		}
	}

	return null;
}

/**
 * 计算单条划线在选区内的有效覆盖 DOM Range。
 * - 混选（选区伸出划线外）：仅 quote 定位到的片段计入覆盖
 * - 子选区（选区完全落在大段划线 DOM 内且文本属于 quote）：整段选区视为已覆盖
 */
function buildHighlightCoverRangeInSelection(
	item: EbookUserHighlight,
	selectionRange: Range,
	rend: Rendition,
): Range | null {
	const highlightRange = resolveCfiDomRange(rend, item.cfiRange.trim());
	if (!highlightRange) return null;

	const clipped = clipRangeToOuterBounds(highlightRange, selectionRange);
	if (!clipped) return null;

	const trimmedClipped = trimSelectionRange(clipped);
	const quote = item.quote?.trim();
	if (!quote) {
		return trimmedClipped;
	}

	const normalizedSelection = trimSelectionRange(selectionRange);
	const selectionNorm = normalizeComparableText(normalizedSelection.toString());
	const clippedNorm = normalizeComparableText(trimmedClipped.toString());
	const quoteNorm = normalizeComparableText(quote);

	const selectionWithinHighlightDom =
		isDomRangeContainedIn(normalizedSelection, highlightRange) &&
		clippedNorm.length > 0 &&
		clippedNorm === selectionNorm &&
		quoteNorm.includes(clippedNorm);

	const located = locateHighlightQuoteCoverInSelection(
		trimmedClipped,
		quote,
		highlightRange,
	);
	if (located) return located;

	if (selectionWithinHighlightDom) {
		return trimmedClipped;
	}

	return null;
}

function buildHighlightCoverRangesInSelection(
	matched: EbookUserHighlight[],
	selectionRange: Range,
	rend: Rendition,
): Range[] {
	const ranges: Range[] = [];
	for (const item of matched) {
		const cover = buildHighlightCoverRangeInSelection(
			item,
			selectionRange,
			rend,
		);
		if (cover) ranges.push(cover);
	}
	return ranges;
}

/** 选区每个非空白字符是否都落在给定划线 DOM 范围内 */
function isDomRangeFullyCoveredByHighlightRanges(
	outer: Range,
	covers: Range[],
): boolean {
	if (covers.length === 0) return false;

	let fullyCovered = true;
	forEachTextNodeInRange(outer, (node, start, end) => {
		if (!fullyCovered) return;
		for (let offset = start; offset < end; offset++) {
			const ch = node.data[offset];
			if (ch && /\s/u.test(ch)) continue;
			if (!isDomPointInsideAnyRange(node, offset, covers)) {
				fullyCovered = false;
				return;
			}
		}
	});
	return fullyCovered;
}

export type SelectionHighlightCoverage = 'none' | 'partial' | 'full';

/** PopBar 是否应展示「删除划线」（选区非空白正文均已划线） */
export function isSelectionFullyHighlighted(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): boolean {
	return (
		resolveSelectionHighlightCoverage(highlights, cfiRange, quote, rend) ===
		'full'
	);
}

/**
 * 判断选区与用户划线的覆盖关系（微信读书式）：
 * - none：选区无命中划线 → PopBar「划线」
 * - partial：选区含未划线正文 → PopBar「划线」（可增量合并）
 * - full：选区每个非空白字都在命中划线的有效覆盖范围内 → PopBar「删除划线」
 */
export function resolveSelectionHighlightCoverage(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): SelectionHighlightCoverage {
	const matched = findAllUserHighlightsForSelection(
		highlights,
		cfiRange,
		quote,
		rend,
	);
	if (matched.length === 0) return 'none';
	if (!rend) return 'partial';

	const subjectRange = resolveCfiDomRange(rend, cfiRange.trim());
	if (!subjectRange) return 'partial';

	const normalized =
		snapSelectionRangeToTextContent(subjectRange) ??
		trimSelectionRange(subjectRange);
	const coverRanges = buildHighlightCoverRangesInSelection(
		matched,
		normalized,
		rend,
	);
	if (coverRanges.length === 0) return 'partial';

	return isDomRangeFullyCoveredByHighlightRanges(normalized, coverRanges)
		? 'full'
		: 'partial';
}

function mergeDomRangeUnion(ranges: Range[]): Range | null {
	if (ranges.length === 0) return null;
	try {
		const union = ranges[0].cloneRange();
		for (let i = 1; i < ranges.length; i++) {
			const range = ranges[i];
			if (union.compareBoundaryPoints(Range.START_TO_START, range) > 0) {
				union.setStart(range.startContainer, range.startOffset);
			}
			if (union.compareBoundaryPoints(Range.END_TO_END, range) < 0) {
				union.setEnd(range.endContainer, range.endOffset);
			}
		}
		return union;
	} catch {
		return null;
	}
}

function doClientRectsOverlapForMerge(a: Range, b: Range): boolean {
	const rectsA = getAccurateRangeLineClientRects(a);
	const rectsB = getAccurateRangeLineClientRects(b);
	for (const rectA of rectsA) {
		for (const rectB of rectsB) {
			if (rectA.bottom <= rectB.top + 0.5 || rectA.top >= rectB.bottom - 0.5) {
				continue;
			}
			if (rectA.right <= rectB.left + 0.5 || rectA.left >= rectB.right - 0.5) {
				continue;
			}
			return true;
		}
	}
	return false;
}

function doDomRangesOverlapForMerge(a: Range, b: Range): boolean {
	if (
		isDomRangeTouchingOrOverlapping(a, b) ||
		isDomRangeStrictlyContained(a, b) ||
		isDomRangeStrictlyContained(b, a)
	) {
		return true;
	}
	return doClientRectsOverlapForMerge(a, b);
}

/** 选区 PopBar 用：仅真实相交/包含，不含端点相接（避免选区末尾误命中下一段划线） */
function doDomRangesOverlapForSelection(a: Range, b: Range): boolean {
	if (
		isDomRangeOverlapping(a, b) ||
		isDomRangeStrictlyContained(a, b) ||
		isDomRangeStrictlyContained(b, a)
	) {
		return true;
	}
	return doClientRectsOverlapForMerge(a, b);
}

export type MergedOverlappingHighlightTarget = {
	cfiRange: string;
	quote: string;
	/** 与本次选区存在交集、合并后应删除的旧划线 */
	removeHighlightIds: string[];
};

/** 两次划线存在交集时合并为并集选区；调用方以最新 style/color 创建唯一划线并删除旧记录。 */
export function resolveMergedOverlappingHighlight(
	rend: Rendition,
	cfiRange: string,
	quote: string,
	highlights: EbookUserHighlight[],
	excludeHighlightId?: string,
): MergedOverlappingHighlightTarget {
	const trimmedCfi = cfiRange.trim();
	const trimmedQuote = quote.trim();
	const seedRange = resolveCfiDomRange(rend, trimmedCfi);

	if (!seedRange) {
		return {
			cfiRange: trimmedCfi,
			quote: trimmedQuote,
			removeHighlightIds: [],
		};
	}

	const mergedIds = new Set<string>();
	const ranges: Range[] = [seedRange.cloneRange()];
	let changed = true;

	while (changed) {
		changed = false;
		for (const item of highlights) {
			if (!item.id || mergedIds.has(item.id)) continue;
			if (excludeHighlightId && item.id === excludeHighlightId) continue;

			const itemRange = resolveCfiDomRange(rend, item.cfiRange.trim());
			if (!itemRange) continue;

			const sameDoc =
				itemRange.startContainer.ownerDocument ===
				seedRange.startContainer.ownerDocument;
			if (!sameDoc) continue;

			const domMerge = ranges.some((range) =>
				doDomRangesOverlapForMerge(range, itemRange),
			);
			if (!domMerge) continue;

			mergedIds.add(item.id);
			ranges.push(itemRange);
			changed = true;
		}
	}

	if (mergedIds.size === 0) {
		return {
			cfiRange: trimmedCfi,
			quote: trimmedQuote,
			removeHighlightIds: [],
		};
	}

	const union = mergeDomRangeUnion(ranges);
	if (!union) {
		return {
			cfiRange: trimmedCfi,
			quote: trimmedQuote,
			removeHighlightIds: [...mergedIds],
		};
	}

	return {
		cfiRange: cfiFromDomRange(rend, union) ?? trimmedCfi,
		quote: union.toString().trim() || trimmedQuote,
		removeHighlightIds: [...mergedIds],
	};
}

/** 将新选区与待删除旧划线合并成并集 CFI/quote（保存层用） */
export function buildMergedHighlightTarget(
	rend: Rendition,
	cfiRange: string,
	quote: string,
	mergeTargets: EbookUserHighlight[],
): { cfiRange: string; quote: string } {
	const ranges: Range[] = [];
	const seedRange = resolveCfiDomRange(rend, cfiRange.trim());
	if (seedRange) ranges.push(seedRange);

	for (const item of mergeTargets) {
		const itemRange = resolveCfiDomRange(rend, item.cfiRange.trim());
		if (itemRange) ranges.push(itemRange);
	}

	if (ranges.length === 0) {
		return { cfiRange: cfiRange.trim(), quote: quote.trim() };
	}

	const union = mergeDomRangeUnion(ranges);
	if (!union) {
		return { cfiRange: cfiRange.trim(), quote: quote.trim() };
	}

	return {
		cfiRange: cfiFromDomRange(rend, union) ?? cfiRange.trim(),
		quote: union.toString().trim() || quote.trim(),
	};
}

/** 渲染时将交集划线折叠为一条（样式取组内 updatedAt 最新） */
function coalesceOverlappingHighlightsForRender(
	rend: Rendition,
	highlights: EbookUserHighlight[],
): EbookUserHighlight[] {
	const items = highlights.filter((item) => item.id);
	if (items.length <= 1) return highlights;

	const parent = new Map(items.map((item) => [item.id, item.id]));
	const rangeCache = new Map<string, Range | null>();
	const resolveItemRange = (item: EbookUserHighlight): Range | null => {
		if (!rangeCache.has(item.id)) {
			rangeCache.set(item.id, resolveCfiDomRange(rend, item.cfiRange.trim()));
		}
		return rangeCache.get(item.id) ?? null;
	};

	const findRoot = (id: string): string => {
		let root = parent.get(id) ?? id;
		while (root !== parent.get(root)) {
			const next = parent.get(root)!;
			parent.set(root, next);
			root = next;
		}
		parent.set(id, root);
		return root;
	};

	const unite = (leftId: string, rightId: string) => {
		const leftRoot = findRoot(leftId);
		const rightRoot = findRoot(rightId);
		if (leftRoot !== rightRoot) {
			parent.set(leftRoot, rightRoot);
		}
	};

	for (let i = 0; i < items.length; i++) {
		const rangeI = resolveItemRange(items[i]!);
		if (!rangeI) continue;
		for (let j = i + 1; j < items.length; j++) {
			const rangeJ = resolveItemRange(items[j]!);
			if (!rangeJ) continue;
			if (
				rangeI.startContainer.ownerDocument !==
				rangeJ.startContainer.ownerDocument
			) {
				continue;
			}
			if (doDomRangesOverlapForMerge(rangeI, rangeJ)) {
				unite(items[i]!.id, items[j]!.id);
			}
		}
	}

	const grouped = new Map<string, EbookUserHighlight[]>();
	for (const item of items) {
		const root = findRoot(item.id);
		const list = grouped.get(root) ?? [];
		list.push(item);
		grouped.set(root, list);
	}

	const result: EbookUserHighlight[] = [];
	for (const group of grouped.values()) {
		if (group.length === 1) {
			result.push(group[0]!);
			continue;
		}

		const ranges = group
			.map((item) => resolveItemRange(item))
			.filter((range): range is Range => range !== null);
		const union = mergeDomRangeUnion(ranges);
		const latest = group.reduce((best, item) =>
			item.updatedAt >= best.updatedAt ? item : best,
		);
		result.push({
			...latest,
			cfiRange: union
				? (cfiFromDomRange(rend, union) ?? latest.cfiRange)
				: latest.cfiRange,
			quote: union?.toString().trim() || latest.quote,
		});
	}

	return result.length > 0 ? result : highlights;
}

/** 用户划线 mark 点击时关联的想法（同 CFI 或该用户划线被想法选区覆盖） */
export function findThoughtsForHighlightMark(
	thoughts: EbookThought[],
	highlight: EbookUserHighlight,
	rend: Rendition,
): EbookThought[] {
	const highlightCfi = highlight.cfiRange.trim();
	const byExact = thoughts.filter((t) => t.cfiRange.trim() === highlightCfi);
	if (byExact.length > 0) return byExact;

	return thoughts.filter(
		(t) =>
			isThoughtCfiCoveredByUserHighlight(t.cfiRange, highlight, rend) ||
			isHighlightCfiStrictlyContained(
				highlight,
				{ cfiRange: t.cfiRange, quote: t.quote },
				rend,
			),
	);
}

const THOUGHT_CLICK_SLOP_BELOW_PX = 8;

/** 当前 iframe 章节 spine hint，用于点击命中时过滤其它章节想法 */
function getContentsSpineHint(contents: ContentsWithCfi): string | null {
	try {
		const doc = contents.document;
		const body = doc.body ?? doc.documentElement;
		const range = doc.createRange();
		range.selectNodeContents(body);
		range.collapse(true);
		const cfi = contents.cfiFromRange(range, EPUB_ANNOTATION_IGNORE_CLASS);
		return extractCfiSpineHint(cfi);
	} catch {
		return null;
	}
}

function isClickInThoughtCfiRange(
	rend: Rendition,
	contents: ContentsWithCfi,
	clientX: number,
	clientY: number,
	cfiRange: string,
): boolean {
	const thoughtRange = resolveCfiDomRange(rend, cfiRange);
	if (
		!thoughtRange ||
		thoughtRange.startContainer.ownerDocument !== contents.document
	) {
		return false;
	}

	const iframe = contents.window.frameElement;
	if (
		!isPointInRangeTextBand(
			thoughtRange,
			iframe,
			clientX,
			clientY,
			THOUGHT_CLICK_SLOP_BELOW_PX,
		)
	) {
		return false;
	}

	const clickRange = caretRangeFromPoint(contents.document, clientX, clientY);
	if (!clickRange) return false;

	try {
		return isClickRangeInsideHighlight(clickRange, thoughtRange);
	} catch {
		return false;
	}
}

function findThoughtsAtClickPoint(
	rend: Rendition,
	contents: ContentsWithCfi,
	clientX: number,
	clientY: number,
	thoughts: EbookThought[],
): EbookThought[] {
	const grouped = new Map<string, EbookThought[]>();
	for (const thought of thoughts) {
		const cfi = thought.cfiRange.trim();
		if (!cfi) continue;
		const list = grouped.get(cfi) ?? [];
		list.push(thought);
		grouped.set(cfi, list);
	}

	const matched: EbookThought[] = [];
	const spineHint = getContentsSpineHint(contents);
	for (const [, group] of grouped) {
		const cfi = group[0]?.cfiRange.trim();
		if (!cfi) continue;
		if (spineHint && extractCfiSpineHint(cfi) !== spineHint) continue;
		if (isClickInThoughtCfiRange(rend, contents, clientX, clientY, cfi)) {
			matched.push(...group);
		}
	}
	return matched;
}

/** 同一点命中多组想法时，聚合为连通 cluster（引用区取全部 CFI 的 DOM 并集） */
function resolveThoughtClickCluster(
	rend: Rendition,
	allThoughts: EbookThought[],
	candidates: EbookThought[],
	fromMarkSeed: boolean,
): EbookThoughtClickCluster | null {
	if (candidates.length === 0) return null;

	if (fromMarkSeed) {
		const click = lastReaderClickPoint;
		const contents =
			click && Date.now() - click.at <= 800
				? getContentsWithCfiForDocument(rend, click.document)
				: null;
		const isClickInCfi =
			contents && click
				? (cfi: string) =>
						isClickInThoughtCfiRange(
							rend,
							contents,
							click.clientX,
							click.clientY,
							cfi,
						)
				: undefined;
		return expandClusterFromMarkSeed(
			rend,
			allThoughts,
			candidates,
			isClickInCfi,
		);
	}

	return buildThoughtClickClusterFromCandidates(rend, allThoughts, candidates);
}

/** 下一帧再聚类并打开列表，避免在 pointer 回调里长时间占用主线程 */
function scheduleThoughtClusterClick(
	rend: Rendition,
	allThoughts: EbookThought[],
	candidates: EbookThought[],
	fromMarkSeed: boolean,
	onThoughtClusterClick: (cluster: EbookThoughtClickCluster) => void,
): void {
	requestAnimationFrame(() => {
		const cluster = resolveThoughtClickCluster(
			rend,
			allThoughts,
			candidates,
			fromMarkSeed,
		);
		if (cluster && cluster.allThoughts.length > 0) {
			onThoughtClusterClick(cluster);
		}
	});
}

type HighlightHitAnchor = {
	clientX: number;
	clientY: number;
	contents: EpubIframeContents;
};

function tryDispatchUserHighlightAtRecentClick(
	rend: Rendition,
	highlights: EbookUserHighlight[],
	onHighlightHit: (
		highlight: EbookUserHighlight,
		anchor?: HighlightHitAnchor,
	) => void,
): boolean {
	const click = lastReaderClickPoint;
	if (!click || Date.now() - click.at > 800) return false;

	const contents = getContentsWithCfiForDocument(rend, click.document);
	if (!contents) return false;

	const hit = findUserHighlightAtClickPoint(
		rend,
		contents,
		click.clientX,
		click.clientY,
		highlights,
	);
	if (!hit) return false;

	onHighlightHit(hit, {
		clientX: click.clientX,
		clientY: click.clientY,
		contents,
	});
	return true;
}

function buildPopBarPayloadForHighlightHit(
	rend: Rendition,
	highlight: EbookUserHighlight,
): EpubSelectionPopBarPayload {
	return buildEpubPopBarPayloadFromCfiRange(
		rend,
		highlight.cfiRange,
		highlight.quote,
		resolveCfiDomRange,
	);
}

export type EpubReadingMarkClickOptions = {
	getThoughts: () => EbookThought[];
	getHighlights: () => EbookUserHighlight[];
	onThoughtClusterClick: (cluster: EbookThoughtClickCluster) => void;
	onUserHighlightPopBar: (
		payload: EpubSelectionPopBarPayload,
		highlight: EbookUserHighlight,
	) => void;
};

/** 统一点击：用户划线与想法相同走 marks-pane 几何命中 + markClicked */
export function installEpubReadingMarkClickListeners(
	rend: Rendition,
	options: EpubReadingMarkClickOptions,
): () => void {
	const handleUserHighlightHit = (
		highlight: EbookUserHighlight,
		anchor?: HighlightHitAnchor,
	) => {
		if (hasTextSelectionInRend(rend)) return;

		const thoughts = options.getThoughts();
		const click = lastReaderClickPoint;
		const contents =
			anchor?.contents ??
			(click ? getContentsWithCfiForDocument(rend, click.document) : null);
		const clientX = anchor?.clientX ?? click?.clientX;
		const clientY = anchor?.clientY ?? click?.clientY;

		if (contents && clientX != null && clientY != null) {
			const atClick = findThoughtsAtClickPoint(
				rend,
				contents as ContentsWithCfi,
				clientX,
				clientY,
				thoughts,
			);
			if (atClick.length > 0) {
				scheduleThoughtClusterClick(
					rend,
					thoughts,
					atClick,
					false,
					options.onThoughtClusterClick,
				);
				return;
			}
		}

		const payload = buildPopBarPayloadForHighlightHit(rend, highlight);
		options.onUserHighlightPopBar(payload, highlight);
	};

	let lastHitHighlightId = '';
	let lastHitAt = 0;
	const dispatchHighlightHit = (
		highlight: EbookUserHighlight,
		anchor?: HighlightHitAnchor,
	) => {
		suppressEpubSelectionPopBarDismiss();
		if (anchor) {
			if (
				!isHighlightHitAtClickPoint(
					rend,
					anchor.contents as ContentsWithCfi,
					anchor.clientX,
					anchor.clientY,
					highlight,
				)
			) {
				return;
			}
		} else if (!isHighlightHitAtRecentClick(rend, highlight)) {
			return;
		}
		const now = Date.now();
		if (lastHitHighlightId === highlight.id && now - lastHitAt < 400) {
			return;
		}
		lastHitHighlightId = highlight.id;
		lastHitAt = now;
		handleUserHighlightHit(highlight, anchor);
	};

	userHighlightClickRouter = dispatchHighlightHit;

	const detachReaderClick = attachUserHighlightReaderClickListener(
		rend,
		options.getHighlights,
		options.getThoughts,
		options.onThoughtClusterClick,
		dispatchHighlightHit,
	);

	const onMarkClicked = (
		cfiRange: string,
		data: { thoughtIds?: string[]; highlightId?: string; hlStyle?: string },
	) => {
		if (hasTextSelectionInRend(rend)) return;

		const highlights = options.getHighlights();
		const isUserMark = Boolean(
			data?.highlightId ||
				data?.hlStyle ||
				(data as Record<string, string | undefined>)?.[DATA_STYLE],
		);

		if (isUserMark) {
			const highlight =
				(data?.highlightId
					? highlights.find((h) => h.id === data.highlightId)
					: undefined) ?? findUserHighlightByCfi(highlights, cfiRange);
			if (highlight) {
				dispatchHighlightHit(highlight);
			}
			return;
		}

		const thoughts = options.getThoughts();
		const thoughtIds = data?.thoughtIds ?? [];
		const matchedThoughts =
			thoughtIds.length > 0
				? thoughts.filter((t) => thoughtIds.includes(t.id))
				: thoughts.filter((t) => t.cfiRange.trim() === cfiRange.trim());

		if (matchedThoughts.length > 0) {
			scheduleThoughtClusterClick(
				rend,
				thoughts,
				matchedThoughts,
				true,
				options.onThoughtClusterClick,
			);
			return;
		}

		tryDispatchUserHighlightAtRecentClick(
			rend,
			highlights,
			dispatchHighlightHit,
		);
	};

	rend.on('markClicked', onMarkClicked);

	return () => {
		userHighlightClickRouter = null;
		detachReaderClick();
		try {
			rend.off('markClicked', onMarkClicked);
		} catch {
			// rendition 已销毁
		}
	};
}

/** 导出供侧栏 PopBar 锚定阅读区正文位置 */
export { resolveCfiDomRange };

function isDomRangeStrictlyContained(inner: Range, outer: Range): boolean {
	try {
		const startsAfterOrEqual =
			inner.compareBoundaryPoints(Range.START_TO_START, outer) >= 0;
		const endsBeforeOrEqual =
			inner.compareBoundaryPoints(Range.END_TO_END, outer) <= 0;
		if (!startsAfterOrEqual || !endsBeforeOrEqual) return false;
		const sameStart =
			inner.compareBoundaryPoints(Range.START_TO_START, outer) === 0;
		const sameEnd = inner.compareBoundaryPoints(Range.END_TO_END, outer) === 0;
		return !(sameStart && sameEnd);
	} catch {
		return false;
	}
}

export function syncEpubReadingAnnotations(
	rend: Rendition,
	thoughts: EbookThought[],
	highlights: EbookUserHighlight[],
	appliedThoughtsRef: Map<string, string>,
	appliedHighlightsRef: Map<string, string>,
): void {
	beginEpubAnnotationSyncScope();
	try {
		setUserHighlightBlockerSourcesForThoughtPatch([]);
		const highlightPlan = buildHighlightRenderPlan(rend, highlights);
		applyEpubUserHighlights(
			rend,
			highlights,
			appliedHighlightsRef,
			highlightPlan,
		);
		applyEpubThoughtUnderlines(rend, thoughts, appliedThoughtsRef);
		setUserHighlightBlockerSourcesForThoughtPatch(
			collectUserHighlightBlockerSources(rend),
		);
		runEpubReadingAnnotationPatch(rend);
	} finally {
		endEpubAnnotationSyncScope();
	}
}

let readingAnnotationPatchRaf = 0;
let pendingReadingAnnotationFullPatch = false;

function runEpubReadingAnnotationPatch(rend: Rendition): void {
	try {
		patchAllUserHighlightMarks(rend);
		setUserHighlightBlockerSourcesForThoughtPatch(
			collectUserHighlightBlockerSources(rend),
		);
		patchEpubThoughtUnderlineMarks(rend);
		restackThoughtMarkGroups(rend);
		restackUserHighlightMarkGroups(rend);
	} catch {
		// rendition 已销毁
	}
}

export function resetEpubReadingAnnotationSyncState(): void {
	// 保留导出供 EpubPane 卸载时调用
}

function isDomRangeFullyCoveredByHighlightClientRects(
	thoughtCfi: string,
	thoughtRange: Range,
	highlightCfi: string,
	highlightRange: Range,
): boolean {
	const thoughtRects = getAccurateRangeLineClientRectsCached(
		`thought:${thoughtCfi}`,
		thoughtRange,
	);
	const highlightRects = getAccurateRangeLineClientRectsCached(
		`highlight:${highlightCfi}`,
		highlightRange,
	);
	if (thoughtRects.length === 0 || highlightRects.length === 0) return false;

	return thoughtRects.every((thoughtRect) =>
		highlightRects.some((highlightRect) => {
			if (
				thoughtRect.bottom <= highlightRect.top + 0.5 ||
				thoughtRect.top >= highlightRect.bottom - 0.5
			) {
				return false;
			}
			return (
				thoughtRect.left >= highlightRect.left - 1 &&
				thoughtRect.right <= highlightRect.right + 1
			);
		}),
	);
}

function collectUserHighlightBlockerSources(
	rend: Rendition,
): UserHighlightBlockerSource[] {
	const sources: UserHighlightBlockerSource[] = [];
	const docs = new Set<Document>([document]);
	for (const contents of getRenditionContentsList(rend)) {
		if (contents.document) docs.add(contents.document);
	}

	for (const doc of docs) {
		try {
			doc.querySelectorAll(USER_HIGHLIGHT_SELECTOR).forEach((group) => {
				const cfi = (group as SVGElement).dataset.epubcfi?.trim() ?? '';
				const el = group as SVGElement;
				const style = (el.dataset[DATA_STYLE] ??
					'highlight') as EpubHighlightStyle;
				const rects = [...group.querySelectorAll('rect')]
					.map((rect) => parseSvgMarkRect(rect as SVGRectElement))
					.filter((rect): rect is NonNullable<typeof rect> => rect !== null);
				// ponytail: 波浪线用 path 扣减；下划线只用 rect（epub.js 遗留 line 常比 rect 更宽，会误扣想法虚线）
				if (style === 'wavy') {
					for (const node of group.querySelectorAll(
						`path.${WAVY_PATH_CLASS}`,
					)) {
						if (!(node instanceof SVGPathElement)) continue;
						const box = node.getBBox();
						if (box.width >= MIN_USER_HIGHLIGHT_BLOCKER_PX && box.height > 0) {
							rects.push({
								x: box.x,
								y: box.y,
								width: box.width,
								height: box.height,
							});
						}
					}
				}
				if (rects.length > 0) {
					sources.push({ cfi, rects });
				}
			});
		} catch {
			// iframe 卸载时忽略
		}
	}

	return sources;
}

/** 用户划线置于想法 mark 之上，重叠处由用户 stroke 盖住想法虚线 */
export function restackUserHighlightMarkGroups(rend?: Rendition): void {
	const docs = new Set<Document>([document]);
	for (const contents of getRenditionContentsList(rend)) {
		if (contents.document) docs.add(contents.document);
	}

	for (const doc of docs) {
		try {
			for (const pane of doc.querySelectorAll('.marks-pane')) {
				for (const group of pane.querySelectorAll(USER_HIGHLIGHT_SELECTOR)) {
					pane.appendChild(group);
				}
			}
		} catch {
			// iframe 卸载时忽略
		}
	}
}

/** 滚动/翻页后仅 patch 样式，不 remove+readd（避免闪烁） */
export function patchEpubReadingAnnotations(
	rend: Rendition,
	options?: { defer?: boolean; sync?: boolean },
): void {
	if (options?.sync) {
		cancelAnimationFrame(readingAnnotationPatchRaf);
		readingAnnotationPatchRaf = 0;
		pendingReadingAnnotationFullPatch = false;
		runEpubReadingAnnotationPatch(rend);
		return;
	}

	if (options?.defer) {
		pendingReadingAnnotationFullPatch = true;
	}

	cancelAnimationFrame(readingAnnotationPatchRaf);
	readingAnnotationPatchRaf = requestAnimationFrame(() => {
		if (pendingReadingAnnotationFullPatch) {
			pendingReadingAnnotationFullPatch = false;
			readingAnnotationPatchRaf = requestAnimationFrame(() => {
				runEpubReadingAnnotationPatch(rend);
			});
			return;
		}
		runEpubReadingAnnotationPatch(rend);
	});
}

/** 判断想法 CFI 是否被用户划线覆盖（同 CFI 或 DOM 严格包含；不做 quote 子串推断，避免误伤） */
export function isThoughtCfiCoveredByUserHighlight(
	thoughtCfi: string,
	highlight: EbookUserHighlight,
	rend: Rendition,
): boolean {
	const thoughtKey = thoughtCfi.trim();
	const highlightKey = highlight.cfiRange.trim();
	if (!thoughtKey || !highlightKey) return false;
	if (thoughtKey === highlightKey) return true;

	const thoughtRange = resolveCfiDomRange(rend, thoughtKey);
	const highlightRange = resolveCfiDomRange(rend, highlightKey);
	if (thoughtRange && highlightRange) {
		if (isDomRangeStrictlyContained(thoughtRange, highlightRange)) return true;
		if (
			isDomRangeFullyCoveredByHighlightClientRects(
				thoughtKey,
				thoughtRange,
				highlightKey,
				highlightRange,
			)
		) {
			return true;
		}
	}
	return false;
}

export function installEpubUserHighlightPatchListeners(
	rend: Rendition,
): () => void {
	const schedulePatch = (defer = false) => {
		patchEpubReadingAnnotations(rend, defer ? { defer: true } : undefined);
	};

	const onContent = () => schedulePatch(true);
	rend.hooks.content.register(onContent);

	const onRelocated = () => schedulePatch(false);
	rend.on('relocated', onRelocated);

	const onRendered = () => schedulePatch(true);
	rend.on('rendered', onRendered);

	schedulePatch(true);

	return () => {
		cancelAnimationFrame(readingAnnotationPatchRaf);
		readingAnnotationPatchRaf = 0;
		pendingReadingAnnotationFullPatch = false;
		try {
			rend.hooks.content.deregister(onContent);
			rend.off('relocated', onRelocated);
			rend.off('rendered', onRendered);
		} catch {
			// rendition 已销毁
		}
	};
}
