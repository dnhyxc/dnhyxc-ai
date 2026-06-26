/**
 * 听书播放背景：节级一次索引句 DOM Range，绘制走 epubListenMarkHighlight。
 * 正文用 innerText，句界与 TTS 同源（buildSentenceOffsetSpans）。
 */
import type { Rendition } from 'epubjs';
import {
	buildSentenceOffsetSpans,
	stripMarkdownForTts,
} from '@/utils/englishTts';
import { clearListenMarkHighlight } from './epubListenMarkHighlight';
import { syncChapterListenScrollSession } from './epubListenSegmentOverlay';

type TextPos = { node: Text; offset: number };

function bodyFromOuter(outerRange: Range): HTMLElement | null {
	const doc = outerRange.startContainer.ownerDocument;
	return doc?.body ?? null;
}

/** TreeWalker 收集 body 下全部文本字符位置 */
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

/** 与 TTS spokenRaw 对齐：stripMarkdown + 空白折叠为单空格 */
function normForMatch(text: string): string {
	return stripMarkdownForTts(text).replace(/\s+/g, ' ').trim();
}

/** 构建全文归一化流 + 每个 norm 字符对应的 TextPos 下标 */
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
): void {
	syncChapterListenScrollSession(rend, range);
}

export function clearChapterListenSentenceHighlight(rend?: Rendition): void {
	clearListenMarkHighlight(rend);
}

export function teardownChapterListenHighlight(rend?: Rendition): void {
	clearListenMarkHighlight(rend);
}
