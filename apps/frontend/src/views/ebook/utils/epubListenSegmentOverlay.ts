import type { Rendition } from 'epubjs';
import {
	getAccurateRangeLineClientRects,
	normalizeSelectionRangeForEpub,
	resolveCfiDomRange,
} from './epubRangeGeometry';

/** 播放本段背景色（与产品指定一致，仅一层、不叠加） */
export const EPUB_LISTEN_SEGMENT_FILL = 'rgba(251, 231, 128, 0.28)';

const OVERLAY_ROOT_ID = 'moke-epub-listen-overlay';
const LEGACY_HIGHLIGHT_NAME = 'moke-epub-listen-seg';
const LEGACY_STYLE_ID = 'moke-epub-listen-seg-style';
const LEGACY_SVG_GROUP_CLASS = 'moke-epub-listen-seg';

type EpubIframeContents = {
	document: Document;
};

type CssHighlightRegistry = {
	delete(name: string): void;
};

type ListenOverlaySession = {
	rend: Rendition;
	epoch: number;
	sentenceRanges: Array<Range | null>;
	activeSentence: number;
};

let session: ListenOverlaySession | null = null;
let overlayEpoch = 0;
let relayoutRaf = 0;
let detachRelayout: (() => void) | null = null;
const paintedDocs = new Set<Document>();

function getRenditionDocs(rend?: Rendition | null): Document[] {
	if (!rend) return [];
	const raw = rend.getContents();
	const list = Array.isArray(raw)
		? (raw as EpubIframeContents[])
		: raw
			? [raw as EpubIframeContents]
			: [];
	const docs = new Set<Document>();
	for (const item of list) {
		if (item.document) docs.add(item.document);
	}
	return [...docs];
}

function getCssHighlights(win: Window | null): CssHighlightRegistry | null {
	const css = (win as Window & { CSS?: { highlights?: CssHighlightRegistry } })
		?.CSS?.highlights;
	return css ?? null;
}

function splitListenSentences(plain: string): string[] {
	const trimmed = plain.trim();
	if (!trimmed) return [];
	const parts = trimmed
		.split(/(?<=[.!?。！？])\s*/)
		.map((s) => s.trim())
		.filter(Boolean);
	return parts.length > 0 ? parts : [trimmed];
}

function normalizeComparableText(text: string): string {
	return text.replace(/\s+/gu, '');
}

/** 在选区 DOM 内按去空白序列定位子句（与 TTS plain 对齐） */
function locateSentenceInRange(outer: Range, sentence: string): Range | null {
	const q = normalizeComparableText(sentence);
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

		for (let offset = nodeStart; offset < nodeEnd; offset += 1) {
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

function clearListenOverlayInDoc(doc: Document): void {
	getCssHighlights(doc.defaultView)?.delete(LEGACY_HIGHLIGHT_NAME);
	doc.getElementById(LEGACY_STYLE_ID)?.remove();
	for (const node of doc.querySelectorAll(`g.${LEGACY_SVG_GROUP_CLASS}`)) {
		node.remove();
	}
	doc.getElementById(OVERLAY_ROOT_ID)?.remove();
}

function collectDocsForClear(rend: Rendition | null): Document[] {
	const docs = new Set<Document>(paintedDocs);
	for (const doc of getRenditionDocs(rend)) {
		docs.add(doc);
	}
	return [...docs];
}

function clearListenOverlayVisual(): void {
	for (const doc of paintedDocs) {
		try {
			clearListenOverlayInDoc(doc);
		} catch {
			// iframe 已卸载
		}
	}
	paintedDocs.clear();
}

function paintRangeOverlay(range: Range, epoch: number): void {
	if (epoch !== overlayEpoch || !session) return;

	const doc =
		range.commonAncestorContainer.nodeType === Node.DOCUMENT_NODE
			? (range.commonAncestorContainer as Document)
			: range.commonAncestorContainer.ownerDocument;
	if (!doc?.body) return;

	const rects = getAccurateRangeLineClientRects(range);
	if (!rects.length) return;

	clearListenOverlayInDoc(doc);
	if (epoch !== overlayEpoch) return;

	const root = doc.createElement('div');
	root.id = OVERLAY_ROOT_ID;
	root.style.cssText =
		'position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden';
	for (const rect of rects) {
		const block = doc.createElement('div');
		block.style.cssText = [
			'position:fixed',
			`left:${rect.left}px`,
			`top:${rect.top}px`,
			`width:${rect.width}px`,
			`height:${rect.height}px`,
			`background:${EPUB_LISTEN_SEGMENT_FILL}`,
			'pointer-events:none',
		].join(';');
		root.appendChild(block);
	}

	doc.body.appendChild(root);
	paintedDocs.add(doc);
}

function paintActiveSentence(epoch: number): void {
	if (!session || epoch !== overlayEpoch) return;
	const { activeSentence, sentenceRanges } = session;
	if (activeSentence < 0) return;
	const range = sentenceRanges[activeSentence];
	if (!range) return;
	paintRangeOverlay(range, epoch);
}

function attachRelayoutListeners(rend: Rendition, epoch: number): () => void {
	const schedule = () => {
		cancelAnimationFrame(relayoutRaf);
		relayoutRaf = requestAnimationFrame(() => paintActiveSentence(epoch));
	};

	const onRelocated = () => schedule();
	const onRendered = () => schedule();
	rend.on('relocated', onRelocated);
	rend.on('rendered', onRendered);

	return () => {
		cancelAnimationFrame(relayoutRaf);
		relayoutRaf = 0;
		try {
			rend.off('relocated', onRelocated);
			rend.off('rendered', onRendered);
		} catch {
			// rendition 已销毁
		}
	};
}

/** 朗读开始前：按 TTS plain 文本预解析各句 DOM 范围 */
export function beginEpubListenOverlaySession(
	rend: Rendition,
	cfiRange: string,
	plainText: string,
): void {
	const key = cfiRange.trim();
	const plain = plainText.trim();
	if (!key || !plain) return;

	clearEpubListenSegmentOverlay();
	overlayEpoch += 1;
	const epoch = overlayEpoch;

	const outer = resolveCfiDomRange(rend, key);
	if (!outer) return;
	const normalized = normalizeSelectionRangeForEpub(outer) ?? outer;
	const sentenceRanges = splitListenSentences(plain).map((sentence) =>
		locateSentenceInRange(normalized, sentence),
	);

	session = {
		rend,
		epoch,
		sentenceRanges,
		activeSentence: -1,
	};

	detachRelayout = attachRelayoutListeners(rend, epoch);
}

/** 当前句开始播放：仅高亮该句 */
export function showEpubListenSentence(sentenceIndex: number): void {
	if (!session || sentenceIndex < 0) return;
	session.activeSentence = sentenceIndex;
	paintActiveSentence(session.epoch);
}

/** 当前句播放结束：去除播放背景（不影响用户划线） */
export function clearEpubListenSentenceOverlay(): void {
	if (session) session.activeSentence = -1;
	clearListenOverlayVisual();
}

/** 朗读结束 / 停止：拆除会话并清除播放层 */
export function clearEpubListenSegmentOverlay(): void {
	overlayEpoch += 1;
	const rend = session?.rend ?? null;
	session = null;
	detachRelayout?.();
	detachRelayout = null;
	cancelAnimationFrame(relayoutRaf);
	relayoutRaf = 0;

	for (const doc of collectDocsForClear(rend)) {
		try {
			clearListenOverlayInDoc(doc);
		} catch {
			// iframe 已卸载
		}
	}
	paintedDocs.clear();
}

if (!EPUB_LISTEN_SEGMENT_FILL.includes('0.28')) {
	throw new Error('[epubListenSegmentOverlay] 播放背景色透明度异常');
}
