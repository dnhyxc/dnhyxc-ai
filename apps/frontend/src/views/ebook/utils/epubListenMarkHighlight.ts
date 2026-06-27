/**
 * 听书播放背景：单例浮层（marks-pane SVG 或 iframe 绝对定位），换句先清空再绘制。
 * 不用 CSS Highlight / epub annotation（二者在 …… 等字符上易残留堆叠）。
 * 导致换句时高亮残留问题。
 */
import type { Rendition } from 'epubjs';
import {
	findMarksPaneSvgInDocument,
	getRenditionContentsList,
	setSvgAttrIfChanged,
} from './epubMarkShared';
import {
	clientRectToSvgLocalSegment,
	findMarksPaneContainer,
	findMarksPaneSvgFromGroup,
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
	for (const item of getRenditionContentsList(rend)) {
		if (item.document) docs.add(item.document);
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
	const svg = findMarksPaneSvgFromGroup(group);
	const container = svg ? findMarksPaneContainer(svg) : null;
	if (!svg || !container) return [];
	return listenLineRects(normalized).map((rect) =>
		clientRectToSvgLocalSegment(rect, svg, container),
	);
}

function syncMarkRects(group: SVGElement, segments: SvgLineSegment[]): void {
	const ownerDoc = group.ownerDocument;
	group.replaceChildren();
	for (const seg of segments) {
		const rect = ownerDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');
		setSvgAttrIfChanged(rect, 'x', String(seg.x));
		setSvgAttrIfChanged(rect, 'y', String(seg.y));
		setSvgAttrIfChanged(rect, 'width', String(seg.width));
		setSvgAttrIfChanged(rect, 'height', String(seg.height));
		setSvgAttrIfChanged(rect, 'fill', EPUB_LISTEN_SEGMENT_FILL);
		setSvgAttrIfChanged(rect, 'fill-opacity', '1');
		setSvgAttrIfChanged(rect, 'stroke', 'transparent');
		setSvgAttrIfChanged(rect, 'stroke-width', '0');
		group.appendChild(rect);
	}
	group.style.pointerEvents = 'none';
}

function ensureListenMarkGroup(doc: Document): SVGElement | null {
	const svg = findMarksPaneSvgInDocument(doc);
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

/**
 * 重绘当前激活的“听书高亮”标记
 * 场景：包括听书激活/换句/resize等（需保证mark层或SVG重建后能重新绘制）
 * 优先SVG方式绘制背景；SVG不可用时兜底用iframe内div overlay绘制
 */
function repaintActive(): void {
	// 若无激活高亮或高亮Range已失效（被移除），直接返回
	if (!active || !isRangeConnected(active.range)) return;

	// 标准化选区Range（消除跨iframe等异常情况）
	const normalized =
		normalizeSelectionRangeForEpub(active.range) ?? active.range;

	// 获取Range所属的Document（用于后续节点操作）
	const doc = normalized.startContainer.ownerDocument;
	if (!doc) return;

	// resize后 marks-pane SVG 可能被重建，不能复用上次的group，需重新查找/挂载SVG <g>
	const group = ensureListenMarkGroup(doc);

	// 若能找到SVG group且能正常画高亮，则采用SVG方案
	if (group && paintDirectSvg(group, normalized)) {
		active.mode = 'svg'; // 标记当前模式为svg
		active.group = group; // 存储本次使用的group
		active.doc = doc; // 记录doc，方便后续复用判断
		return;
	}
	// 若SVG失败（group挂载失败或paint失败），则 fallback 到iframe内div绘制 overlay
	if (paintIframeOverlay(doc, normalized)) {
		active.mode = 'iframe'; // 标记当前模式为iframe
		active.group = null; // 本次不用group
		active.doc = doc;
	}
}

// 安排高亮重绘的调度任务（带防抖，防止重复执行），每次只有一个动画帧回调在队列中
function schedulePatch(rend: Rendition): void {
	// 若当前无激活高亮或 rend 对象不符，则直接返回
	if (!active || active.rend !== rend) return;
	// 取消之前已挂起的动画帧，以防止积压
	cancelAnimationFrame(relayoutRaf);
	// 新建一个动画帧用于高亮重绘
	relayoutRaf = requestAnimationFrame(() => {
		// 回调进入后先重置标记，表示当前无 pending 动画帧
		relayoutRaf = 0;
		// 若激活状态有变（如已解绑或更换页面），终止重绘
		if (!active || active.rend !== rend) return;
		// 实际执行高亮重绘
		repaintActive();
	});
}

/**
 * 监听并自动重绘高亮背景（窗口尺寸/EPUB重排/容器滚动/渲染事件时）
 * @param rend EPUB.js 的 Rendition 实例
 */
function attachRelayout(rend: Rendition): void {
	// 清理前一次监听，避免重复监听或内存泄露
	detachRelayout?.();

	// 定义重排回调，统一调度 schedulePatch
	const onRelayout = () => schedulePatch(rend);

	// 绑定 EPUB 渲染相关事件，重排要求
	rend.on('relocated', onRelayout);
	rend.on('rendered', onRelayout);

	// 存储需要后续清理的回调（如 ResizeObserver）
	const resizeCleanups: (() => void)[] = [];
	// 获取滚动容器（区分不同渲染布局模式）
	const scrollContainer = getEpubScrollContainer(rend);
	if (scrollContainer) {
		// 监听页面尺寸变化，自动重绘高亮
		const ro = new ResizeObserver(() => onRelayout());
		ro.observe(scrollContainer);
		resizeCleanups.push(() => ro.disconnect());
		// 若容器的父级节点存在，额外监听父容器尺寸变化，处理分栏/窗口变更
		const host = scrollContainer.parentElement;
		if (host) {
			const roHost = new ResizeObserver(() => onRelayout());
			roHost.observe(host);
			resizeCleanups.push(() => roHost.disconnect());
		}
	}

	// 定义 detachRelayout，用于后续解绑监听与清理 observer
	detachRelayout = () => {
		// 取消帧动画回调
		cancelAnimationFrame(relayoutRaf);
		relayoutRaf = 0;
		// 依次执行所有 observer 清理函数
		for (const cleanup of resizeCleanups) cleanup();
		try {
			// 解绑 EPUB 渲染事件
			rend.off('relocated', onRelayout);
			rend.off('rendered', onRelayout);
		} catch {
			// rendition 已销毁，无需额外处理
		}
	};
}

/** 阅读区宽度变化后重绘当前句播放背景（分栏拖拽、侧栏开关等） */
export function relayoutListenMarkHighlight(rend: Rendition): void {
	schedulePatch(rend);
	// soft resize 后 marks-pane 偶发晚一帧就绪
	requestAnimationFrame(() => schedulePatch(rend));
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
