/** 从 EPUB 选区 DOM 提取带计算样式的书摘片段，供分享卡 Canvas 绘制 */

export type QuoteShareRun = {
	text: string;
	fontSize: number;
	fontWeight: string;
	fontFamily: string;
	fontStyle: string;
};

export type QuoteShareStyledLine = {
	runs: Array<QuoteShareRun & { width: number }>;
	width: number;
	lineHeight: number;
};

const BLOCK_TAGS = new Set([
	'P',
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'H6',
	'DIV',
	'LI',
	'BLOCKQUOTE',
	'SECTION',
	'ARTICLE',
]);

function isRenderableTextNode(textNode: Text, win: Window): boolean {
	const el = textNode.parentElement;
	if (!el) return true;
	const cs = win.getComputedStyle(el);
	if (cs.visibility === 'hidden' || cs.display === 'none') return false;
	if (cs.writingMode.includes('vertical')) return false;
	return true;
}

function blockAncestor(node: Node): Element | null {
	let el: Element | null =
		node.nodeType === Node.ELEMENT_NODE
			? (node as Element)
			: node.parentElement;
	while (el) {
		if (BLOCK_TAGS.has(el.tagName)) return el;
		el = el.parentElement;
	}
	return null;
}

function styleFromTextNode(
	textNode: Text,
	win: Window,
): Omit<QuoteShareRun, 'text'> {
	const el = textNode.parentElement;
	if (!el) {
		return {
			fontSize: 16,
			fontWeight: '400',
			fontFamily: 'sans-serif',
			fontStyle: 'normal',
		};
	}
	const cs = win.getComputedStyle(el);
	return {
		fontSize: Number.parseFloat(cs.fontSize) || 16,
		fontWeight: cs.fontWeight || '400',
		fontStyle: cs.fontStyle || 'normal',
		fontFamily: cs.fontFamily || 'sans-serif',
	};
}

function sameRunStyle(
	a: Omit<QuoteShareRun, 'text'>,
	b: Omit<QuoteShareRun, 'text'>,
): boolean {
	return (
		a.fontSize === b.fontSize &&
		a.fontWeight === b.fontWeight &&
		a.fontFamily === b.fontFamily &&
		a.fontStyle === b.fontStyle
	);
}

function pushRun(segments: QuoteShareRun[], run: QuoteShareRun): void {
	if (!run.text) return;
	const last = segments.at(-1);
	if (last && sameRunStyle(last, run)) {
		last.text += run.text;
		return;
	}
	segments.push(run);
}

function textSliceInRange(textNode: Text, range: Range): string {
	if (range.startContainer === textNode && range.endContainer === textNode) {
		return textNode.data.slice(range.startOffset, range.endOffset);
	}
	if (range.startContainer === textNode) {
		return textNode.data.slice(range.startOffset);
	}
	if (range.endContainer === textNode) {
		return textNode.data.slice(0, range.endOffset);
	}
	return textNode.data;
}

function textNodesInRange(range: Range): Text[] {
	const root = range.commonAncestorContainer;
	const doc = root.ownerDocument;
	if (!doc) return [];

	const nodes: Text[] = [];
	const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			const text = node as Text;
			if (!range.intersectsNode(text)) return NodeFilter.FILTER_REJECT;
			if (!text.data.length) return NodeFilter.FILTER_REJECT;
			const win = text.ownerDocument?.defaultView;
			if (win && !isRenderableTextNode(text, win)) {
				return NodeFilter.FILTER_REJECT;
			}
			return NodeFilter.FILTER_ACCEPT;
		},
	});

	let current = walker.nextNode();
	while (current) {
		nodes.push(current as Text);
		current = walker.nextNode();
	}
	return nodes;
}

function hasBrBetween(doc: Document, a: Text, b: Text): boolean {
	const probe = doc.createRange();
	probe.setStartAfter(a);
	probe.setEndBefore(b);
	if (probe.collapsed) return false;
	const fragment = probe.cloneContents();
	return Boolean(fragment.querySelector('br'));
}

/** 从选区 Range 提取保留字号/字重/字体的文本片段 */
export function extractQuoteSegmentsFromRange(
	range: Range,
	win: Window,
): QuoteShareRun[] {
	const segments: QuoteShareRun[] = [];
	const nodes = textNodesInRange(range);
	if (!nodes.length) return segments;

	const doc = nodes[0].ownerDocument;
	if (!doc) return segments;

	let prev: Text | null = null;
	for (const node of nodes) {
		if (prev) {
			const blockBreak =
				blockAncestor(prev) !== blockAncestor(node) ||
				hasBrBetween(doc, prev, node);
			if (blockBreak)
				pushRun(segments, { text: '\n', ...styleFromTextNode(node, win) });
		}

		const slice = textSliceInRange(node, range);
		if (!slice) {
			prev = node;
			continue;
		}

		pushRun(segments, { text: slice, ...styleFromTextNode(node, win) });
		prev = node;
	}

	return segments;
}

function buildCanvasFont(run: QuoteShareRun): string {
	return `${run.fontStyle} ${run.fontWeight} ${run.fontSize}px ${run.fontFamily}`;
}

/** Canvas 统一用分享卡字体族度量，仅保留字号/字重比例 */
export function normalizeSegmentsForCanvas(
	segments: QuoteShareRun[],
	baseFontSize: number,
	fontFamily: string,
): QuoteShareRun[] {
	return scaleQuoteSegments(segments, baseFontSize).map((s) => ({
		...s,
		fontFamily,
	}));
}

function measureRunWidth(
	ctx: CanvasRenderingContext2D,
	run: QuoteShareRun,
): number {
	ctx.font = buildCanvasFont(run);
	return ctx.measureText(run.text).width;
}

/** 按卡片宽度折行，保留各片段样式 */
export function layoutStyledQuoteLines(
	ctx: CanvasRenderingContext2D,
	segments: QuoteShareRun[],
	maxWidth: number,
	lineHeightRatio = 1.45,
): QuoteShareStyledLine[] {
	const lines: QuoteShareStyledLine[] = [];
	let current: QuoteShareStyledLine = { runs: [], width: 0, lineHeight: 0 };

	const flushLine = () => {
		if (current.runs.length) lines.push(current);
		current = { runs: [], width: 0, lineHeight: 0 };
	};

	const appendToLine = (run: QuoteShareRun) => {
		const width = measureRunWidth(ctx, run);
		current.runs.push({ ...run, width });
		current.width += width;
		current.lineHeight = Math.max(
			current.lineHeight,
			run.fontSize * lineHeightRatio,
		);
	};

	const wrapRun = (run: QuoteShareRun) => {
		if (!run.text) return;
		if (run.text === '\n') {
			flushLine();
			return;
		}

		ctx.font = buildCanvasFont(run);
		let chunk = '';
		for (const char of run.text) {
			if (char === '\n') {
				if (chunk) {
					appendToLine({ ...run, text: chunk });
					chunk = '';
				}
				flushLine();
				continue;
			}

			const probe = chunk + char;
			const probeWidth = ctx.measureText(probe).width;
			const charWidth = ctx.measureText(char).width;

			if (chunk && current.width + probeWidth > maxWidth) {
				appendToLine({ ...run, text: chunk });
				chunk = char;
				if (current.width + charWidth > maxWidth) flushLine();
				continue;
			}

			if (
				!chunk &&
				current.runs.length &&
				current.width + charWidth > maxWidth
			) {
				flushLine();
			}

			chunk = probe;
		}

		if (!chunk) return;

		if (
			current.runs.length &&
			current.width + ctx.measureText(chunk).width > maxWidth
		) {
			flushLine();
		}
		appendToLine({ ...run, text: chunk });
	};

	for (const segment of segments) wrapRun(segment);
	flushLine();
	return lines;
}

/** 将 iframe 内绝对字号缩放到分享卡基准字号，保留相对比例 */
export function scaleQuoteSegments(
	segments: QuoteShareRun[],
	baseFontSize: number,
): QuoteShareRun[] {
	if (!segments.length) return segments;
	const ref =
		segments.find((s) => s.text.trim() && s.text !== '\n')?.fontSize ??
		baseFontSize;
	if (!ref || ref <= 0) return segments;
	const ratio = baseFontSize / ref;
	return segments.map((s) => ({
		...s,
		fontSize: Math.max(10, Math.round(s.fontSize * ratio)),
	}));
}

export function drawStyledQuoteLines(
	ctx: CanvasRenderingContext2D,
	lines: QuoteShareStyledLine[],
	centerX: number,
	startY: number,
	fillStyle: string,
): number {
	const prevAlign = ctx.textAlign;
	ctx.textAlign = 'left';
	ctx.fillStyle = fillStyle;
	ctx.textBaseline = 'top';
	let y = startY;

	for (const line of lines) {
		let x = centerX - line.width / 2;
		for (const run of line.runs) {
			ctx.font = buildCanvasFont(run);
			ctx.fillText(run.text, x, y);
			x += run.width;
		}
		y += line.lineHeight;
	}

	ctx.textAlign = prevAlign;
	return y;
}

export function measureStyledQuoteHeight(
	lines: QuoteShareStyledLine[],
): number {
	return lines.reduce((sum, line) => sum + line.lineHeight, 0);
}
