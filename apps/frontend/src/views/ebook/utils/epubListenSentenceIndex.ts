/**
 * 听书句表：DOM 正向字符流 → 句界锚点（Text+offset）。
 * 播放时由锚点还原 Range，不做文本搜索、不用 afterRange、不依赖 plain 重映射。
 */
import { buildSentenceOffsetSpans } from '@/utils/englishTts';
import { forEachTextNodeInRange } from './epubRangeGeometry';

/** 句在 DOM 中的首尾锚点（endOffset 为 Range 式开区间） */
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

/** 可见正文逐字流（plain 与 points 严格 1:1） */
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

/** 锚点 → live Range（节点断开时返回 null） */
export function anchorToRange(anchor: DomTextAnchor): Range | null {
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

export function sentenceToRange(sentence: DomListenSentence): Range | null {
	if (!sentence.anchor) return null;
	return anchorToRange(sentence.anchor);
}

/** 句表与 TTS buildSentenceOffsetSpans 等长 */
function sentencesWithoutAnchors(trimmed: string): DomListenSentence[] {
	return buildSentenceOffsetSpans(trimmed)
		.map(({ start, end }) => ({
			spokenRaw: trimmed.slice(start, end).trim(),
			anchor: null,
		}))
		.filter((s) => s.spokenRaw);
}

export function buildDomSentenceIndex(outer: Range): {
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

if (buildSentenceOffsetSpans('测试。下一句。').length < 2) {
	throw new Error('[epubListenSentenceIndex] 句界拆分异常');
}

if (buildSentenceOffsetSpans('段落末......下一段').length < 2) {
	throw new Error('[epubListenSentenceIndex] ASCII 省略号句界异常');
}

if (buildSentenceOffsetSpans('消亡…杨广').length < 2) {
	throw new Error('[epubListenSentenceIndex] 单省略号句界异常');
}
