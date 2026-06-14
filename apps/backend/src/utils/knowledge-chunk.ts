/** 按字符分片时避免在 UTF-16 surrogate 对中间切断 */
export function sliceUtf16Safe(
	text: string,
	start: number,
	end: number,
): string {
	let s = Math.max(0, start);
	let e = Math.min(text.length, end);
	if (s > 0 && s < text.length) {
		const lead = text.charCodeAt(s);
		if (lead >= 0xdc00 && lead <= 0xdfff) s++;
	}
	if (e > s && e <= text.length) {
		const trail = text.charCodeAt(e - 1);
		if (trail >= 0xd800 && trail <= 0xdbff) e--;
	}
	return text.slice(s, e);
}

const IDENT_CHAR = /[a-zA-Z0-9_$]/;

function isIdentChar(ch: string): boolean {
	return ch.length === 1 && IDENT_CHAR.test(ch);
}

/** 判断断点是否落在标识符内部（如 console.log、foo_bar、$x） */
export function isInsideIdentifier(text: string, breakAt: number): boolean {
	if (breakAt <= 0 || breakAt >= text.length) return false;
	const left = text[breakAt - 1]!;
	const right = text[breakAt]!;
	const leftPart =
		isIdentChar(left) ||
		(left === '.' &&
			breakAt >= 2 &&
			isIdentChar(text[breakAt - 2]!) &&
			isIdentChar(right));
	const rightPart =
		isIdentChar(right) ||
		(right === '.' &&
			isIdentChar(left) &&
			breakAt + 1 < text.length &&
			isIdentChar(text[breakAt + 1]!));
	return leftPart && rightPart;
}

function boundaryPriority(text: string, breakAt: number): number {
	if (breakAt <= 0) return 0;
	const before = text[breakAt - 1]!;
	const after = text[breakAt] ?? '';
	if (before === '\n' || after === '\n') return 5;
	if (/\s/.test(before)) return 4;
	if (/[;{})\]>，。；！？、]/.test(before)) return 3;
	if (!isInsideIdentifier(text, breakAt)) return 2;
	return 0;
}

/** 从 from 向前找第一个安全断点（换行、空格、分号等），上限 maxEnd */
function findChunkEndForward(
	text: string,
	from: number,
	maxEnd: number,
): number {
	const limit = Math.min(text.length, maxEnd);
	let best = from;
	for (let pos = from + 1; pos <= limit; pos++) {
		if (isInsideIdentifier(text, pos)) continue;
		const p = boundaryPriority(text, pos);
		if (p >= 5) return pos;
		if (p >= 3) return pos;
		if (p > boundaryPriority(text, best)) best = pos;
	}
	return best;
}

/**
 * 在 [minEnd, preferredEnd] 内向后寻找语义边界，避免 console.log → ole.log 这类断词。
 */
export function findChunkEndBoundary(
	text: string,
	preferredEnd: number,
	minEnd: number,
): number {
	if (preferredEnd >= text.length) return text.length;

	let best = preferredEnd;
	let bestPriority = boundaryPriority(text, preferredEnd);
	if (bestPriority >= 4 && !isInsideIdentifier(text, preferredEnd)) {
		return preferredEnd;
	}

	for (let pos = preferredEnd - 1; pos >= minEnd; pos--) {
		if (isInsideIdentifier(text, pos)) continue;
		const p = boundaryPriority(text, pos);
		if (p > bestPriority) {
			bestPriority = p;
			best = pos;
		}
	}

	if (!isInsideIdentifier(text, best)) return best;

	/** 禁止在标识符中间硬切：向后延伸到行尾/语句边界 */
	const extended = findChunkEndForward(
		text,
		preferredEnd,
		Math.min(text.length, preferredEnd + Math.max(64, preferredEnd - minEnd)),
	);
	if (!isInsideIdentifier(text, extended) && extended > preferredEnd) {
		return extended;
	}
	const nl = text.indexOf('\n', preferredEnd);
	if (nl !== -1 && nl < preferredEnd + 512) return nl + 1;
	return text.length;
}

/** overlap 起点：仅在 overlap 窗口内回退到行首，禁止跳到全文第一行 */
export function findSafeChunkStart(text: string, minPos: number): number {
	const min = Math.max(0, minPos);
	let pos = min;
	while (pos < text.length && isInsideIdentifier(text, pos)) {
		pos++;
	}
	if (pos <= min) return min;
	const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
	if (lineStart >= min && lineStart < pos) return lineStart;
	return pos;
}

/** 超长块按目标长度滑动切分，带 overlap 与词边界对齐 */
export function splitLongTextBlock(
	text: string,
	target: number,
	overlap: number,
): string[] {
	const chunks: string[] = [];
	let i = 0;
	while (i < text.length) {
		const chunkStart = i;
		const preferredEnd = Math.min(text.length, i + target);
		const minEnd = Math.min(
			text.length,
			i + Math.max(1, Math.floor(target * 0.5)),
		);
		const end =
			preferredEnd >= text.length
				? preferredEnd
				: findChunkEndBoundary(text, preferredEnd, minEnd);

		const piece = sliceUtf16Safe(text, i, end).trim();
		if (piece) chunks.push(piece);

		if (end >= text.length) break;

		i = findSafeChunkStart(text, end - overlap);
		if (i >= text.length) break;
		if (i <= chunkStart) i = end;
	}
	return chunks;
}

/** Markdown 代码围栏内按行打包，不在行内切断 */
export function splitByLinesOnly(
	text: string,
	target: number,
	overlap: number,
): string[] {
	const lines = text.split('\n');
	if (lines.length === 0) return [];

	const chunks: string[] = [];
	let startLine = 0;

	while (startLine < lines.length) {
		let endLine = startLine;
		let len = 0;

		while (endLine < lines.length) {
			const line = lines[endLine]!;
			const add = line.length + (endLine > startLine ? 1 : 0);
			if (endLine > startLine && len + add > target) break;
			len += add;
			endLine++;
		}

		if (endLine === startLine) {
			const lone = lines[startLine]!;
			if (lone.length > target) {
				chunks.push(...splitLongTextBlock(lone, target, overlap));
			} else if (lone) {
				chunks.push(lone);
			}
			startLine++;
			continue;
		}

		chunks.push(lines.slice(startLine, endLine).join('\n'));
		if (endLine >= lines.length) break;

		let back = 0;
		let olen = 0;
		while (back < endLine - startLine && olen < overlap) {
			back++;
			olen += lines[endLine - back]!.length + 1;
		}
		const nextStart = endLine - back;
		startLine = nextStart >= startLine ? nextStart : endLine;
	}

	return chunks;
}

export type MarkdownSection = { kind: 'prose' | 'code'; text: string };

function isOpeningFenceLine(line: string): boolean {
	return /^(`{3,}|~{3,})\s*[\w-]*\s*$/.test(line.trim());
}

/** 行尾 ```（常见于未写 opening fence 的闭合，如 `years old ```） */
function splitClosingFenceLine(
	line: string,
): { before: string; after: string } | null {
	const m = line.match(/^(.*?)`{3,}\s*(.*)$/);
	if (!m) return null;
	return { before: m[1] ?? '', after: m[2] ?? '' };
}

/** 按 ``` 围栏拆成正文与代码块（兼容行尾闭合围栏） */
export function splitMarkdownSections(text: string): MarkdownSection[] {
	const sections: MarkdownSection[] = [];
	const lines = text.split('\n');
	let mode: 'prose' | 'code' = 'prose';
	let buf: string[] = [];

	const push = () => {
		const t = buf.join('\n').trim();
		if (t) sections.push({ kind: mode, text: t });
		buf = [];
	};

	for (const line of lines) {
		if (isOpeningFenceLine(line)) {
			if (mode === 'prose') {
				push();
				mode = 'code';
				buf.push(line);
			} else {
				buf.push(line);
				push();
				mode = 'prose';
			}
			continue;
		}

		if (mode === 'prose') {
			const close = splitClosingFenceLine(line);
			if (close && /`{3,}/.test(line)) {
				const codeLines = [...buf];
				if (close.before.trim()) codeLines.push(close.before);
				const codeText = codeLines.join('\n').trim();
				if (codeText) sections.push({ kind: 'code', text: codeText });
				buf = [];
				if (close.after.trim()) buf.push(close.after);
				continue;
			}
		}

		if (mode === 'code' && /`{3,}/.test(line) && !isOpeningFenceLine(line)) {
			const close = splitClosingFenceLine(line);
			if (close) {
				if (close.before.trim()) buf.push(close.before);
				push();
				mode = 'prose';
				if (close.after.trim()) buf.push(close.after);
				continue;
			}
		}

		if (mode === 'code' && isOpeningFenceLine(line.trim())) {
			buf.push(line);
			push();
			mode = 'prose';
			continue;
		}

		buf.push(line);
	}
	push();
	return sections;
}

/** 多行内容优先按行切（代码示例更常见） */
function splitMultilineSection(
	text: string,
	target: number,
	overlap: number,
): string[] {
	if (!text.includes('\n')) {
		return splitLongTextBlock(text, target, overlap);
	}
	return splitByLinesOnly(text, target, overlap);
}

/** 按 Markdown 结构选择分片策略：代码围栏内仅按行切 */
export function splitMarkdownAwareBlock(
	text: string,
	target: number,
	overlap: number,
): string[] {
	if (!text) return [];
	if (text.length <= target) return [text];

	const chunks: string[] = [];
	for (const section of splitMarkdownSections(text)) {
		if (!section.text) continue;
		if (section.text.length <= target) {
			chunks.push(section.text);
			continue;
		}
		if (section.kind === 'code') {
			chunks.push(...splitByLinesOnly(section.text, target, overlap));
		} else {
			chunks.push(...splitMultilineSection(section.text, target, overlap));
		}
	}
	return chunks;
}
