/**
 * 听书：可见节 innerText 抽取、节级句 DOM Range 索引、章节衔接等待。
 * 播放背景绘制与 autoFollow 见 epubListenSegmentOverlay + epubListenMarkHighlight。
 */
import type { Rendition } from 'epubjs';
import { buildSentenceOffsetSpans, stripMarkdownForTts } from '@/utils/speech';
import {
	getRenditionViewsList,
	resolveCfiDomRange,
} from '../mark/epubRangeGeometry';
import { getEpubScrollContainer } from '../reader/epubScrolledNav';
import { resolveSpineIndexForHref } from '../reader/epubSpineIndex';
import { clearListenMarkHighlight } from './epubListenMarkHighlight';
import { showEpubListenDomRange } from './epubListenSegmentOverlay';

// 单次听书文本上限（超长章 HTML 分段续听，勿一次塞爆句索引）
const MAX_PLAIN_CHARS = 50_000;
// 节跳转自动等待时长（ms），播放下一节时的超时时间
const SECTION_ADVANCE_MS = 4000;
// 章节 relocation 等待超时时间（ms），如分屏切换等
const RELOCATE_WAIT_MS = 900;

/**
 * 用于表示当前可见的待听节（听书章节段落）。
 */
export type VisibleListenSection = {
	plain: string; // 该节可读纯文本（可能是长章中的一段）
	outerRange: Range; // 该节在文档中的整体 DOM Range
	spineIndex: number; // EPUB spine 索引
	/** 本段在全文 plain 中的起点 */
	plainFrom: number;
	/** 下一段起点；hasMorePlain 时用于同文档续听 */
	nextPlainFrom: number;
	/** 同文档全文在本段之后还有未听正文 */
	hasMorePlain: boolean;
};

/**
 * 代表文本节点及其在节点内的偏移，用于字符级映射。
 */
type TextPos = { node: Text; offset: number };

/**
 * 对整个文档抽取纯文本，供 TTS / 分句用。
 * 必须与 indexChapterSentenceRanges 的 buildNormStream 同源，否则短句会误匹配、高亮整段错位。
 */
function sectionPlain(doc: Document): string {
	const body = doc.body;
	if (!body) return '';
	const { norm } = buildNormStream(listBodyTextPositions(body));
	return norm.trim();
}

/** 从全文 offset 切一段听书 plain；尽量在句末断开 */
export function sliceListenPlainChunk(
	fullPlain: string,
	from = 0,
): { plain: string; nextFrom: number; hasMore: boolean } {
	const start = Math.max(0, Math.min(from, fullPlain.length));
	const rest = fullPlain.slice(start);
	if (!rest) {
		return { plain: '', nextFrom: start, hasMore: false };
	}
	if (rest.length <= MAX_PLAIN_CHARS) {
		return {
			plain: rest,
			nextFrom: start + rest.length,
			hasMore: false,
		};
	}
	let end = MAX_PLAIN_CHARS;
	const window = rest.slice(0, MAX_PLAIN_CHARS);
	// 在窗口后半段找句末，避免拦腰切断
	const minBreak = Math.floor(MAX_PLAIN_CHARS * 0.5);
	let breakAt = -1;
	for (const mark of ['。', '！', '？', '；', '\n'] as const) {
		const i = window.lastIndexOf(mark);
		if (i >= minBreak && i > breakAt) breakAt = i;
	}
	if (breakAt >= 0) end = breakAt + 1;
	const plain = rest.slice(0, end);
	return {
		plain,
		nextFrom: start + end,
		hasMore: start + end < fullPlain.length,
	};
}

function buildVisibleFromDoc(
	doc: Document,
	spineIndex: number,
	plainFrom = 0,
): VisibleListenSection | null {
	const full = sectionPlain(doc);
	if (!full) return null;
	const { plain, nextFrom, hasMore } = sliceListenPlainChunk(full, plainFrom);
	if (!plain.trim()) return null;

	const outerRange = doc.createRange();
	try {
		outerRange.selectNodeContents(doc.body!);
	} catch {
		return null;
	}

	return {
		plain,
		outerRange,
		spineIndex,
		plainFrom,
		nextPlainFrom: nextFrom,
		hasMorePlain: hasMore,
	};
}

/**
 * 枚举所有当前活跃的 iframe Document（包括主渲染视图与特殊/嵌套视图）。
 * - 兼容 epub.js 不同管理器/模式（单页、分页、连续滚动等）下的多种可能性。
 * - 适配所有在浏览器中以 iframe 挂载的 epub 文档实例，便于后续 DOM 操作与抽取。
 *
 * 具体收集步骤如下：
 * 1. 通过 rend.getContents() 获取 epub.js 当前内部分配的内容实例，适配分页/单页/多页等多情况。
 *    - 注意 getContents() 可能返回单个对象或对象数组，不同模式下类型不一致；
 *    - 只提取含有效 document.body 的文档，防止占位符/空页面混入。
 * 2. 通过 getRenditionViewsList(rend) 获取 epub.js 内部维护的所有视图（view）对象，进一步兼容各种页面切分和异步加载的情况。
 *    - 每个 view 的 contents?.document 才是真正挂载的 iframe Document；
 *    - 同样只提取具有 body 节点的文档。
 * 3. 直接遍历 scrollContainer 下所有 iframe 元素（SSR/preload/动态切槽时用于兜底）。
 *    - getEpubScrollContainer(rend) 获取 epub.js 渲染的顶层容器，可包含多个真正的 iframe（章节槽位）；
 *    - 通过 querySelectorAll('iframe') 拿到所有当前插入 DOM 的 iframe；
 *    - 尝试从每个 HTMLIFrameElement 拉取 contentDocument（注意可能因跨域被阻塞，需 try-catch 容错）；
 *    - 只收录含 body 的有效 iframe 文档。
 *
 * 所有收集到的 Document 会以 Set 集合去重，最后转为数组返回，确保无重复且顺序不重要。
 *
 * @param rend epub.js Rendition 渲染实例
 * @returns 所有当前可用 epub iframe Document 实例（无重复，已过滤无效）
 */
function listIframeDocuments(rend: Rendition): Document[] {
	// 用于去重，避免多路径收集到同一个文档
	const docs = new Set<Document>();

	// Step 1: 收集 getContents() 返回的内容对象
	const raw = rend.getContents();
	// 可能返回数组或单对象，需规范为数组使用
	const items: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
	for (const item of items) {
		// 类型宽松但只关心 .document 字段
		const doc = (item as { document?: Document }).document;
		// 仅收集有 body 节点的有效文档
		if (doc?.body) docs.add(doc);
	}

	// Step 2: 调用内部工具收集所有视图的 contents?.document
	for (const view of getRenditionViewsList(rend)) {
		const doc = view.contents?.document;
		if (doc?.body) docs.add(doc);
	}

	// Step 3: 兜底遍历 DOM 内所有 iframe 并取 contentDocument
	getEpubScrollContainer(rend)
		?.querySelectorAll('iframe')
		.forEach((frame) => {
			try {
				// 尝试获取每个 iframe 的 contentDocument
				const doc = (frame as HTMLIFrameElement).contentDocument;
				if (doc?.body) docs.add(doc);
			} catch {
				// 捕获跨域等访问异常，防止影响后续流程
			}
		});

	// 转化为数组返回所有有效、唯一 Document
	return [...docs];
}

/**
 * 选择当前应当用于“听书”朗读的 Document，优先跟 spineHint 匹配，否则基于可视优先策略。
 * @param rend          epub 渲染器
 * @param spineHint     指定应朗读的 spine 索引，优先使用
 * @returns             匹配到的文档或 null
 */
function pickDocumentForListen(
	rend: Rendition,
	spineHint?: number,
): Document | null {
	// 只选取包含正文内容的文档
	const docs = listIframeDocuments(rend).filter(
		(d) => sectionPlain(d).length > 0,
	);
	if (!docs.length) return null;

	// 若 spineHint 有效，优先查找该 spine index
	if (spineHint != null && Number.isFinite(spineHint) && spineHint >= 0) {
		for (const view of getRenditionViewsList(rend)) {
			if (view.index !== spineHint) continue;
			const doc = view.contents?.document;
			if (doc?.body && sectionPlain(doc)) return doc;
		}
		// continuous 下 views() 可能尚未带上目标章：继续走可视兜底
	}

	// 只有一个文档，直接返回
	if (docs.length === 1) return docs[0]!;

	// 多文档时，优先选择屏幕正中处的 iframe（目录跳转后目标章应在视口）
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

/**
 * 获取当前文档的 spine index（优先用传入 hint，否则兼容 epubjs 的 location/start/index）
 */
export function listenSpineIndexFromRendition(
	rend: Rendition,
	hint?: number,
): number {
	if (hint != null && Number.isFinite(hint) && hint >= 0) return hint;
	const loc = (
		rend as Rendition & { location?: { start?: { index?: number } } }
	).location;
	const idx = loc?.start?.index;
	return idx != null && Number.isFinite(idx) ? idx : 0;
}

function spineIndexFromRendition(rend: Rendition, hint?: number): number {
	return listenSpineIndexFromRendition(rend, hint);
}

/**
 * 抽取当前可见文档的朗读文本片段（用于听书的节级文本、以及 DOM Range）。
 * 超长章按 MAX_PLAIN_CHARS 分段；同文档续听传 plainFrom。
 */
export function extractVisibleListenSection(
	rend: Rendition,
	spineHint?: number,
	plainFrom = 0,
): VisibleListenSection | null {
	const doc = pickDocumentForListen(rend, spineHint);
	if (!doc?.body) return null;
	return buildVisibleFromDoc(
		doc,
		spineIndexFromRendition(rend, spineHint),
		plainFrom,
	);
}

/**
 * 更精确地为指定 document（通常用于多 iframe 或合并）定位其 spine index。
 * 1. 若在已加载的视图 match，则直接用 view.index
 * 2. 若存在 <link rel="canonical">，则尝试用 resolveSpineIndexForHref 查 spine
 * 3. 否则 fallback 通常法
 */
function spineIndexForDocument(rend: Rendition, doc: Document): number {
	for (const view of getRenditionViewsList(rend)) {
		if (view.contents?.document === doc && view.index != null) {
			return view.index;
		}
	}
	const canonical = doc
		.querySelector('link[rel="canonical"]')
		?.getAttribute('href');
	if (canonical) {
		const book = (rend as Rendition & { book?: { spine?: unknown } }).book;
		if (book) {
			const idx = resolveSpineIndexForHref(
				book as Parameters<typeof resolveSpineIndexForHref>[0],
				canonical,
			);
			if (idx != null) return idx;
		}
	}
	return spineIndexFromRendition(rend);
}

/**
 * 针对指定 document 抽取朗读节信息。主要用于连续滚动场景中节间衔接或跨文档定位。
 * @param rend      渲染器
 * @param doc       指定待抽取的 Document
 * @param plainFrom 同文档分段续听起点（strip 后全文偏移）
 */
export function extractListenSectionForDocument(
	rend: Rendition,
	doc: Document,
	plainFrom = 0,
): VisibleListenSection | null {
	if (!doc.body) return null;
	return buildVisibleFromDoc(doc, spineIndexForDocument(rend, doc), plainFrom);
}

/**
 * 从 outerRange 反取到当前可见文档的 <body> 元素。
 */
function bodyFromOuter(outerRange: Range): HTMLElement | null {
	const doc = outerRange.startContainer.ownerDocument;
	return doc?.body ?? null;
}

/**
 * 对 <body> 递归展开，列举所有文本节点及其每个 offset 的物理位置（字符索引）。
 * 用于后续字符级映射到 DOM。
 */
function listBodyTextPositions(body: HTMLElement): TextPos[] {
	// 存储所有文本节点及其 offset（字符级位置）的数组
	const positions: TextPos[] = [];
	// 创建 TreeWalker，仅遍历文本节点
	const walker = body.ownerDocument.createTreeWalker(
		body,
		NodeFilter.SHOW_TEXT,
	);
	// 取第一个文本节点
	let node = walker.nextNode() as Text | null;
	// 遍历所有文本节点
	while (node) {
		// 对该文本节点的每一个字符 offset 均加入到 positions
		for (let offset = 0; offset < node.length; offset += 1) {
			positions.push({ node, offset });
		}
		// 移动到下一个文本节点
		node = walker.nextNode() as Text | null;
	}
	// 返回所有文本节点的字符级位置信息
	return positions;
}

/**
 * 对比匹配用：只压空白。勿再 stripMarkdown——plain 已与 DOM norm 同源，再删 *** 会对不齐。
 */
function normForMatch(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/**
 * 生成标准化文本流，以及字符与 DOM 物理位置映射表。
 * - norm: 标准化纯文本串，合并/归一多余空白，仅用于后续语句/词定位（纯文本、可一一对应 DOM）。
 * - map:  norm[i] 的字符，对应 positions[map[i]]，即映射 norm 每个字符到原始 DOM 文本节点具体的字符 offset，便于后续高亮等。
 * @param positions 输入的 TextPos 数组，表示全书 body 中依序枚举出的每个文本节点和 offset
 * @returns
 *   norm: string          // 合并、压缩空格、去除多余后的纯文本流
 *   map:  number[]        // norm 每个字符在 positions 的下标，norm[i] 对应 positions[map[i]]
 */
function buildNormStream(positions: TextPos[]): {
	norm: string;
	map: number[];
} {
	let norm = ''; // 存放合成后的标准纯文本流
	const map: number[] = []; // 存放 norm 每个字符映射的原始 positions 索引

	// 遍历所有枚举到的字符位置
	for (let pi = 0; pi < positions.length; pi += 1) {
		// 拿到当前字符（确保每个 TextPos 都能安全读取字符）
		const ch = positions[pi]!.node.data[positions[pi]!.offset]!;
		// 判断是否为空白字符（包括空格、制表符、回车等）
		if (/\s/u.test(ch)) {
			// 对连续多个空白，仅在 norm 当前末尾不是空格时追加一个全局空格，完成归一
			if (norm.length > 0 && norm.at(-1) !== ' ') {
				norm += ' '; // 只保留一个空格
				map.push(pi); // 记录此标准化空格属于当前位置
			}
			// 跳过多余的空白字符
			continue;
		}
		// 普通可见字符均加入 norm 串
		norm += ch;
		map.push(pi); // 记录其在 positions 的下标，后续可反查
	}
	// 返回标准化文本流与映射表
	return { norm, map };
}

/**
 * 根据字符级 TextPos 起止索引生成实际 DOM Range
 * @param positions   全部 TextPos
 * @param startPi     起始字符 pos index
 * @param endPi       结束字符 pos index
 * @returns           实际高亮用 DOM Range
 */
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

/**
 * 将本段 plainNorm 对齐到 DOM norm：优先整段连续匹配，避免短句 indexOf 误命中前文重复台词。
 */
function alignPlainChunkToNorm(
	plainNorm: string,
	norm: string,
	from: number,
): { start: number; end: number } | null {
	if (!plainNorm) return { start: from, end: from };
	const startAt = Math.max(0, Math.min(from, norm.length));
	if (norm.slice(startAt, startAt + plainNorm.length) === plainNorm) {
		return { start: startAt, end: startAt + plainNorm.length };
	}
	const probeLen = Math.min(64, plainNorm.length);
	const probe = plainNorm.slice(0, probeLen);
	let start = norm.indexOf(probe, startAt);
	if (start < 0 && startAt > 0) {
		// 续听游标偶发偏差：允许在附近重锚定
		start = norm.indexOf(probe, Math.max(0, startAt - probeLen));
	}
	if (start < 0) return null;
	if (norm.slice(start, start + plainNorm.length) !== plainNorm) return null;
	return { start, end: start + plainNorm.length };
}

/**
 * 句级语音跟随：对全节文本，预建立每个句子的 DOM Range。
 * 利用顺序映射方式，确保每一 TTS 句可唯一对应实际 DOM 片段（高亮、滚动）。
 * @param outerRange  整节对应 DOM Range
 * @param plain       本节净文本（可为长章中的一段）
 * @param opts.normCursor  同文档上一段索引结束后的 norm 游标，避免续听段误匹配前文
 * @returns ranges + 本段结束后的 normCursor
 */
export function indexChapterSentenceRanges(
	outerRange: Range,
	plain: string,
	opts?: { normCursor?: number },
): { ranges: Array<Range | null>; normCursor: number } {
	const trimmed = plain.trim();
	const sentences = buildSentenceOffsetSpans(trimmed);
	if (!sentences.length)
		return { ranges: [], normCursor: opts?.normCursor ?? 0 };

	const body = bodyFromOuter(outerRange);
	if (!body) {
		return {
			ranges: sentences.map(() => null),
			normCursor: opts?.normCursor ?? 0,
		};
	}

	const positions = listBodyTextPositions(body);
	if (!positions.length) {
		return {
			ranges: sentences.map(() => null),
			normCursor: opts?.normCursor ?? 0,
		};
	}

	const { norm, map } = buildNormStream(positions);
	if (!norm) {
		return {
			ranges: sentences.map(() => null),
			normCursor: opts?.normCursor ?? 0,
		};
	}

	let cursor = Math.max(0, Math.min(opts?.normCursor ?? 0, norm.length));
	const plainNorm = normForMatch(trimmed);
	const aligned = alignPlainChunkToNorm(plainNorm, norm, cursor);
	if (aligned) {
		let localCursor = 0;
		const ranges = sentences.map((sent) => {
			const needle = normForMatch(trimmed.slice(sent.start, sent.end));
			if (!needle) return null;
			const local = plainNorm.indexOf(needle, localCursor);
			if (local < 0) return null;
			const idx = aligned.start + local;
			if (idx + needle.length > aligned.end) return null;
			const startPi = map[idx];
			const endPi = map[idx + needle.length - 1];
			if (startPi == null || endPi == null) return null;
			const range = rangeFromPosSpan(positions, startPi, endPi);
			if (range) localCursor = local + needle.length;
			return range;
		});
		return { ranges, normCursor: aligned.end };
	}

	// fallback：逐句顺序 indexOf（短句易误匹配，仅整段对齐失败时用）
	const ranges = sentences.map((sent) => {
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
	return { ranges, normCursor: cursor };
}

/**
 * 高亮显示当前句的 DOM 区间（外部调用）。
 * @param rend    epub 渲染实例
 * @param range   对应句子的 DOM Range
 * @param opts    滚动对齐方式等
 */
export function showChapterListenSentenceHighlight(
	rend: Rendition,
	range: Range,
	opts?: { forceScroll?: boolean; align?: 'center' | 'nearest' },
): void {
	showEpubListenDomRange(rend, range, opts);
}

/**
 * 清除 TTS 句子的高亮标记
 */
export function clearChapterListenSentenceHighlight(rend?: Rendition): void {
	clearListenMarkHighlight(rend);
}

/**
 * 清除节级的所有高亮
 */
export function teardownChapterListenHighlight(rend?: Rendition): void {
	clearListenMarkHighlight(rend);
}

/**
 * 用活 DOM 点定位起播句下标。
 * @param mode `before`：锚点左侧最后一句；`after`：含锚点或锚点之后第一句
 */
export function resolveListenStartAtDomRange(
	at: Range,
	sentenceRanges: Array<Range | null>,
	mode: 'before' | 'after' = 'after',
): number {
	if (mode === 'after') {
		// 先找「包含锚点」的句；勿与「起点在锚点之后」混在同一条件——
		// 中间句 Range 为 null 时后者会直接跳到下一句。
		for (let i = 0; i < sentenceRanges.length; i += 1) {
			const r = sentenceRanges[i];
			if (!r) continue;
			try {
				const startVs = r.compareBoundaryPoints(Range.START_TO_START, at);
				const endVs = r.compareBoundaryPoints(Range.END_TO_START, at);
				if (startVs <= 0 && endVs >= 0) return i;
			} catch {
				// 跨 document 等
			}
		}
		for (let i = 0; i < sentenceRanges.length; i += 1) {
			const r = sentenceRanges[i];
			if (!r) continue;
			try {
				if (r.compareBoundaryPoints(Range.START_TO_START, at) >= 0) return i;
			} catch {
				// 跨 document 等
			}
		}
		return 0;
	}

	for (let i = sentenceRanges.length - 1; i >= 0; i -= 1) {
		const r = sentenceRanges[i];
		if (!r) continue;
		try {
			if (r.compareBoundaryPoints(Range.END_TO_START, at) <= 0) return i;
		} catch {
			// 跨 document 等
		}
	}
	return 0;
}

/**
 * 听当前：取与选区重叠的第一句（选哪句就从哪句起，勿塌缩到句界后漂到下一句）。
 * @returns 命中下标；无重叠时 -1（由调用方再走 plain / 点定位）
 */
export function resolveListenStartOverlappingSelection(
	selection: Range,
	sentenceRanges: Array<Range | null>,
): number {
	for (let i = 0; i < sentenceRanges.length; i += 1) {
		const r = sentenceRanges[i];
		if (!r) continue;
		try {
			// 重叠：sel.start < sent.end && sel.end > sent.start
			const startBeforeSentEnd =
				selection.compareBoundaryPoints(Range.START_TO_END, r) < 0;
			const endAfterSentStart =
				selection.compareBoundaryPoints(Range.END_TO_START, r) > 0;
			if (startBeforeSentEnd && endAfterSentStart) return i;
		} catch {
			// 跨 document 等
		}
	}
	return -1;
}

/**
 * 听当前主路径：用选区纯文在节 plain 里找所在句（不依赖句级 DOM Range 是否 index 成功）。
 */
export function resolveListenStartBySelectionPlain(
	sectionPlain: string,
	selectionPlain: string,
	preferSi?: number,
): number | null {
	const trimmed = sectionPlain.trim();
	const needle = stripMarkdownForTts(selectionPlain).trim();
	if (!trimmed || !needle) return null;

	const sentences = buildSentenceOffsetSpans(trimmed);
	if (!sentences.length) return null;

	const hits: number[] = [];
	for (let i = 0; i < sentences.length; i += 1) {
		const sent = trimmed.slice(sentences[i]!.start, sentences[i]!.end);
		if (sent.includes(needle)) hits.push(i);
	}
	if (hits.length === 1) return hits[0]!;
	if (hits.length > 1) {
		if (preferSi != null && hits.includes(preferSi)) return preferSi;
		if (preferSi != null) {
			let best = hits[0]!;
			let bestDist = Math.abs(best - preferSi);
			for (const h of hits) {
				const d = Math.abs(h - preferSi);
				if (d < bestDist) {
					best = h;
					bestDist = d;
				}
			}
			return best;
		}
		return hits[0]!;
	}

	// 选区可能跨句或空白不一致：用 needle 在 plain 中的起点映射句下标
	const idx = trimmed.indexOf(needle);
	if (idx >= 0) {
		for (let i = sentences.length - 1; i >= 0; i -= 1) {
			if (idx >= sentences[i]!.start) return i;
		}
	}

	const compactNeedle = needle.replace(/\s+/g, '');
	if (compactNeedle.length < 2) return null;
	for (let i = 0; i < sentences.length; i += 1) {
		const sent = trimmed
			.slice(sentences[i]!.start, sentences[i]!.end)
			.replace(/\s+/g, '');
		if (sent.includes(compactNeedle) || compactNeedle.includes(sent)) {
			return i;
		}
	}
	return null;
}

/**
 * 根据 startCfi / 选区找起播句下标（找不到回退 0）。
 * @param mode `before`：CFI 左侧最后一句；`after`：CFI 处或之后第一句
 */
export function resolveListenStartSentence(
	rend: Rendition,
	section: VisibleListenSection,
	startCfi: string,
	opts?: {
		sentenceRanges?: Array<Range | null>;
		mode?: 'before' | 'after';
		/** 听当前完整选区（勿先 collapse） */
		anchorRange?: Range | null;
		/** 听当前选区纯文：优先于 DOM（句 Range 常 index 失败导致偏下一句） */
		selectionPlain?: string | null;
	},
): number {
	const trimmed = section.plain.trim();
	const sentences = buildSentenceOffsetSpans(trimmed);
	if (!sentences.length) return 0;

	const indexed =
		opts?.sentenceRanges != null
			? {
					ranges: opts.sentenceRanges,
					normCursor: 0,
				}
			: indexChapterSentenceRanges(section.outerRange, trimmed);
	const ranges = indexed.ranges;
	const startMode = opts?.mode ?? 'before';
	const sectionDoc = section.outerRange.startContainer.ownerDocument;

	let domHint = -1;
	const anchor = opts?.anchorRange;
	if (anchor && anchor.startContainer.ownerDocument === sectionDoc) {
		if (!anchor.collapsed) {
			domHint = resolveListenStartOverlappingSelection(anchor, ranges);
		} else {
			domHint = resolveListenStartAtDomRange(anchor, ranges, startMode);
		}
	}

	const byPlain = resolveListenStartBySelectionPlain(
		trimmed,
		opts?.selectionPlain ?? '',
		domHint >= 0 ? domHint : undefined,
	);
	if (byPlain != null) return byPlain;
	if (domHint >= 0) return domHint;

	if (anchor && anchor.startContainer.ownerDocument === sectionDoc) {
		const point = anchor.cloneRange();
		point.collapse(true);
		return resolveListenStartAtDomRange(point, ranges, startMode);
	}

	const cfi = startCfi.trim();
	if (!cfi) return 0;

	const at = resolveCfiDomRange(rend, cfi);
	if (!at) return 0;
	if (at.startContainer.ownerDocument !== sectionDoc) return 0;

	if (!at.collapsed) {
		const overlap = resolveListenStartOverlappingSelection(at, ranges);
		if (overlap >= 0) return overlap;
		const point = at.cloneRange();
		point.collapse(true);
		return resolveListenStartAtDomRange(point, ranges, startMode);
	}
	return resolveListenStartAtDomRange(at, ranges, startMode);
}

/**
 * 等待 epubjs rendition 触发 relocated 事件或超时（用于切换章节定位后再继续后续操作）
 * @param rend      epub 渲染器
 * @param timeoutMs 超时时长
 * @returns         relocated 后 resolve
 */
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

/**
 * 章节内自动跳转下一节（通过 epubjs.next()，监听 relocated 事件）
 * isActive 返回 false 可提前中断。若 relocated 发生则 resolve true，否则超时 false
 */
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

// ponytail: 开发态自检 — 超长 plain 须分段且 hasMore，否则会误报「本书已播完」
if (import.meta.env.DEV) {
	const long = `${'句。'.repeat(30_000)}尾段。`;
	const first = sliceListenPlainChunk(long, 0);
	if (!first.hasMore || first.nextFrom <= 0 || !first.plain.includes('句')) {
		throw new Error('sliceListenPlainChunk: expected truncated chunk');
	}
	const second = sliceListenPlainChunk(long, first.nextFrom);
	if (second.plain.length < 1) {
		throw new Error('sliceListenPlainChunk: empty continue chunk');
	}
}
