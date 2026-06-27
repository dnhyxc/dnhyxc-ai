/**
 * 听书：可见节 innerText 抽取、节级句 DOM Range 索引、章节衔接等待。
 * 播放背景绘制与 autoFollow 见 epubListenSegmentOverlay + epubListenMarkHighlight。
 */
import type { Rendition } from 'epubjs';
import {
	buildSentenceOffsetSpans,
	stripMarkdownForTts,
} from '@/utils/englishTts';
import { clearListenMarkHighlight } from './epubListenMarkHighlight';
import { showEpubListenDomRange } from './epubListenSegmentOverlay';
import { getRenditionViewsList, resolveCfiDomRange } from './epubRangeGeometry';
import { getEpubScrollContainer } from './epubScrolledNav';

const MAX_PLAIN_CHARS = 50_000;
const SECTION_ADVANCE_MS = 4000;
const RELOCATE_WAIT_MS = 900;

export type VisibleListenSection = {
	plain: string;
	outerRange: Range;
	spineIndex: number;
};

type TextPos = { node: Text; offset: number };

function sectionPlain(doc: Document): string {
	return stripMarkdownForTts(
		doc.body?.innerText ?? doc.body?.textContent ?? '',
	).trim();
}

function listIframeDocuments(rend: Rendition): Document[] {
	const docs = new Set<Document>();
	const raw = rend.getContents();
	const items: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
	for (const item of items) {
		const doc = (item as { document?: Document }).document;
		if (doc?.body) docs.add(doc);
	}

	for (const view of getRenditionViewsList(rend)) {
		const doc = view.contents?.document;
		if (doc?.body) docs.add(doc);
	}

	getEpubScrollContainer(rend)
		?.querySelectorAll('iframe')
		.forEach((frame) => {
			try {
				const doc = (frame as HTMLIFrameElement).contentDocument;
				if (doc?.body) docs.add(doc);
			} catch {
				// 跨域 iframe
			}
		});

	return [...docs];
}

function pickDocumentForListen(
	rend: Rendition,
	spineHint?: number,
): Document | null {
	const docs = listIframeDocuments(rend).filter(
		(d) => sectionPlain(d).length > 0,
	);
	if (!docs.length) return null;

	if (spineHint != null && Number.isFinite(spineHint) && spineHint >= 0) {
		for (const view of getRenditionViewsList(rend)) {
			if (view.index !== spineHint) continue;
			const doc = view.contents?.document;
			if (doc?.body && sectionPlain(doc)) return doc;
		}
	}

	if (docs.length === 1) return docs[0]!;

	const host = getEpubScrollContainer(rend);
	const centerY = host
		? host.getBoundingClientRect().top + host.getBoundingClientRect().height / 2
		: window.innerHeight / 2;

	for (const doc of docs) {
		const frame = doc.defaultView?.frameElement as HTMLElement | undefined;
		if (!frame) continue;
		const rect = frame.getBoundingClientRect();
		if (rect.height <= 0) continue;
		if (rect.top <= centerY && rect.bottom >= centerY) return doc;
	}

	return docs[0]!;
}

function spineIndexFromRendition(rend: Rendition, hint?: number): number {
	if (hint != null && Number.isFinite(hint) && hint >= 0) return hint;
	const loc = (
		rend as Rendition & { location?: { start?: { index?: number } } }
	).location;
	const idx = loc?.start?.index;
	return idx != null && Number.isFinite(idx) ? idx : 0;
}

export function extractVisibleListenSection(
	rend: Rendition,
	spineHint?: number,
): VisibleListenSection | null {
	const doc = pickDocumentForListen(rend, spineHint);
	if (!doc?.body) return null;

	let plain = stripMarkdownForTts(
		doc.body.innerText ?? doc.body.textContent ?? '',
	).trim();
	if (!plain) return null;
	if (plain.length > MAX_PLAIN_CHARS) {
		plain = plain.slice(0, MAX_PLAIN_CHARS);
	}

	const outerRange = doc.createRange();
	try {
		outerRange.selectNodeContents(doc.body);
	} catch {
		return null;
	}

	return {
		plain,
		outerRange,
		spineIndex: spineIndexFromRendition(rend, spineHint),
	};
}

function bodyFromOuter(outerRange: Range): HTMLElement | null {
	const doc = outerRange.startContainer.ownerDocument;
	return doc?.body ?? null;
}

function listBodyTextPositions(body: HTMLElement): TextPos[] {
	const positions: TextPos[] = [];
	const walker = body.ownerDocument.createTreeWalker(
		body,
		NodeFilter.SHOW_TEXT,
	);
	let node = walker.nextNode() as Text | null;
	while (node) {
		for (let offset = 0; offset < node.length; offset += 1) {
			positions.push({ node, offset });
		}
		node = walker.nextNode() as Text | null;
	}
	return positions;
}

function normForMatch(text: string): string {
	return stripMarkdownForTts(text).replace(/\s+/g, ' ').trim();
}

function buildNormStream(positions: TextPos[]): {
	norm: string;
	map: number[];
} {
	let norm = '';
	const map: number[] = [];
	for (let pi = 0; pi < positions.length; pi += 1) {
		const ch = positions[pi]!.node.data[positions[pi]!.offset]!;
		if (/\s/u.test(ch)) {
			if (norm.length > 0 && norm.at(-1) !== ' ') {
				norm += ' ';
				map.push(pi);
			}
			continue;
		}
		norm += ch;
		map.push(pi);
	}
	return { norm, map };
}

function rangeFromPosSpan(
	positions: TextPos[],
	startPi: number,
	endPi: number,
): Range | null {
	const first = positions[startPi];
	const last = positions[endPi];
	if (!first || !last) return null;
	const doc = first.node.ownerDocument;
	if (!doc) return null;
	const range = doc.createRange();
	range.setStart(first.node, first.offset);
	range.setEnd(last.node, last.offset + 1);
	return range;
}

/** 节级一次遍历：为每句预建 DOM Range（顺序匹配 TTS 句文本） */
export function indexChapterSentenceRanges(
	outerRange: Range,
	plain: string,
): Array<Range | null> {
	const trimmed = plain.trim();
	const sentences = buildSentenceOffsetSpans(trimmed);
	if (!sentences.length) return [];

	const body = bodyFromOuter(outerRange);
	if (!body) return sentences.map(() => null);

	const positions = listBodyTextPositions(body);
	if (!positions.length) return sentences.map(() => null);

	const { norm, map } = buildNormStream(positions);
	if (!norm) return sentences.map(() => null);

	let cursor = 0;
	return sentences.map((sent) => {
		const needle = normForMatch(trimmed.slice(sent.start, sent.end));
		if (!needle) return null;

		let idx = norm.indexOf(needle, cursor);
		if (idx < 0 && needle.length >= 8) {
			const head = needle.slice(0, Math.min(24, needle.length));
			idx = norm.indexOf(head, cursor);
			if (idx >= 0 && norm.slice(idx, idx + needle.length) !== needle) {
				idx = -1;
			}
		}
		if (idx < 0) return null;

		const startPi = map[idx];
		const endPi = map[idx + needle.length - 1];
		if (startPi == null || endPi == null) return null;

		const range = rangeFromPosSpan(positions, startPi, endPi);
		if (range) cursor = idx + needle.length;
		return range;
	});
}

export function showChapterListenSentenceHighlight(
	rend: Rendition,
	range: Range,
	opts?: { forceScroll?: boolean; align?: 'center' | 'nearest' },
): void {
	showEpubListenDomRange(rend, range, opts);
}

export function clearChapterListenSentenceHighlight(rend?: Rendition): void {
	clearListenMarkHighlight(rend);
}

export function teardownChapterListenHighlight(rend?: Rendition): void {
	clearListenMarkHighlight(rend);
}

/** 根据 CFI 定位起始句 */
export function resolveListenStartSentence(
	rend: Rendition,
	section: VisibleListenSection,
	startCfi: string,
	sentenceRanges?: Array<Range | null>,
): number {
	const trimmed = section.plain.trim();
	const sentences = buildSentenceOffsetSpans(trimmed);
	if (!sentences.length) return 0;

	const cfi = startCfi.trim();
	if (!cfi) return 0;

	const at = resolveCfiDomRange(rend, cfi);
	if (!at) return 0;

	const sectionDoc = section.outerRange.startContainer.ownerDocument;
	if (at.startContainer.ownerDocument !== sectionDoc) return 0;

	const ranges =
		sentenceRanges ?? indexChapterSentenceRanges(section.outerRange, trimmed);

	for (let i = sentences.length - 1; i >= 0; i -= 1) {
		const r = ranges[i];
		if (!r) continue;
		if (r.compareBoundaryPoints(Range.END_TO_START, at) <= 0) return i;
	}
	return 0;
}

export function waitForRelocated(
	rend: Rendition,
	timeoutMs = RELOCATE_WAIT_MS,
): Promise<void> {
	return new Promise((resolve) => {
		let settled = false;
		const done = () => {
			if (settled) return;
			settled = true;
			try {
				rend.off('relocated', done);
			} catch {
				// rendition 已销毁
			}
			window.clearTimeout(timer);
			resolve();
		};
		rend.on('relocated', done);
		const timer = window.setTimeout(done, timeoutMs);
	});
}

export function waitForNextSection(
	rend: Rendition,
	isActive: () => boolean,
): Promise<boolean> {
	if (!isActive()) return Promise.resolve(false);

	return new Promise((resolve) => {
		let settled = false;
		const finish = (ok: boolean) => {
			if (settled) return;
			settled = true;
			try {
				rend.off('relocated', onRelocated);
			} catch {
				// rendition 已销毁
			}
			window.clearTimeout(timer);
			resolve(ok);
		};

		const onRelocated = () => finish(true);
		const timer = window.setTimeout(() => finish(false), SECTION_ADVANCE_MS);

		rend.on('relocated', onRelocated);
		void rend.next().catch(() => finish(false));
	});
}

if (buildSentenceOffsetSpans('测试。下一句。').length < 2) {
	throw new Error('[epubListenChapter] 句界拆分异常');
}
