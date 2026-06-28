/**
 * 听书：可见节 innerText 抽取、节级句 DOM Range 索引、章节衔接等待。
 * 播放背景绘制与 autoFollow 见 epubListenSegmentOverlay + epubListenMarkHighlight。
 */
import type { Rendition } from 'epubjs';
import {
	buildSentenceOffsetSpans,
	stripMarkdownForTts,
} from '@/utils/englishTts';
import {
	getRenditionViewsList,
	resolveCfiDomRange,
} from '../mark/epubRangeGeometry';
import { getEpubScrollContainer } from '../reader/epubScrolledNav';
import { resolveSpineIndexForHref } from '../reader/epubSpineIndex';
import { clearListenMarkHighlight } from './epubListenMarkHighlight';
import { showEpubListenDomRange } from './epubListenSegmentOverlay';

// 最大可处理文本长度，超过此长度的文本会被裁剪（避免性能问题）
const MAX_PLAIN_CHARS = 50_000;
// 节跳转自动等待时长（ms），播放下一节时的超时时间
const SECTION_ADVANCE_MS = 4000;
// 章节 relocation 等待超时时间（ms），如分屏切换等
const RELOCATE_WAIT_MS = 900;

/**
 * 用于表示当前可见的待听节（听书章节段落）。
 */
export type VisibleListenSection = {
	plain: string; // 该节可读纯文本
	outerRange: Range; // 该节在文档中的整体 DOM Range
	spineIndex: number; // EPUB spine 索引
};

/**
 * 代表文本节点及其在节点内的偏移，用于字符级映射。
 */
type TextPos = { node: Text; offset: number };

/**
 * 对整个文档抽取纯文本（去 markdown/特殊标记），供 TTS 使用。
 */
function sectionPlain(doc: Document): string {
	return stripMarkdownForTts(
		doc.body?.innerText ?? doc.body?.textContent ?? '',
	).trim();
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
	}

	// 只有一个文档，直接返回
	if (docs.length === 1) return docs[0]!;

	// 多文档时，优先选择屏幕正中处的 iframe
	const host = getEpubScrollContainer(rend);
	const centerY = host
		? host.getBoundingClientRect().top + host.getBoundingClientRect().height / 2
		: window.innerHeight / 2;

	for (const doc of docs) {
		const frame = doc.defaultView?.frameElement as HTMLElement | undefined;
		if (!frame) continue;
		const rect = frame.getBoundingClientRect();
		if (rect.height <= 0) continue;
		// 判断 frame 是否跨越屏幕中心线（可视内容优先级最高）
		if (rect.top <= centerY && rect.bottom >= centerY) return doc;
	}

	// 兜底返回第一个有效文档
	return docs[0]!;
}

/**
 * 获取当前文档的 spine index（优先用传入 hint，否则兼容 epubjs 的 location/start/index）
 */
function spineIndexFromRendition(rend: Rendition, hint?: number): number {
	if (hint != null && Number.isFinite(hint) && hint >= 0) return hint;
	const loc = (
		rend as Rendition & { location?: { start?: { index?: number } } }
	).location;
	const idx = loc?.start?.index;
	return idx != null && Number.isFinite(idx) ? idx : 0;
}

/**
 * 抽取当前可见文档的朗读文本片段（用于听书的节级文本、以及 DOM Range）。
 * 截断超长文本，返回期望结构。
 */
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
 * @param rend     渲染器
 * @param doc      指定待抽取的 Document
 */
export function extractListenSectionForDocument(
	rend: Rendition,
	doc: Document,
): VisibleListenSection | null {
	// 若 document 不含 body 节点，无法进行节抽取，直接返回 null
	if (!doc.body) return null;

	// 尝试抽取经过 stripMarkdownForTts 处理的正文纯文本（兼容 innerText / textContent）
	let plain = stripMarkdownForTts(
		doc.body.innerText ?? doc.body.textContent ?? '',
	).trim();

	// 纯文本内容为空则说明无可读内容，返回 null
	if (!plain) return null;

	// 纯文本长度超限时裁剪，保证后续朗读性能及安全
	if (plain.length > MAX_PLAIN_CHARS) {
		plain = plain.slice(0, MAX_PLAIN_CHARS);
	}

	// 创建 DOM Range，选中整个 <body> 作为该节整体范围
	const outerRange = doc.createRange();
	try {
		// 尝试将 range 设置为覆盖 body 节点所有内容（内容节点全包围）
		outerRange.selectNodeContents(doc.body);
	} catch {
		// 处理某些异常结构下 selectNodeContents 失败的容错，直接判定无法朗读
		return null;
	}

	// 返回标准化 VisibleListenSection 结构（含文本、DOM 范围与 spineIndex）
	return {
		plain,
		outerRange,
		spineIndex: spineIndexForDocument(rend, doc),
	};
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
 * 对比匹配用，先去 markdown 和空白、压缩多余空格。
 */
function normForMatch(text: string): string {
	return stripMarkdownForTts(text).replace(/\s+/g, ' ').trim();
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
 * 句级语音跟随：对全节文本，预建立每个句子的 DOM Range。
 * 利用顺序映射方式，确保每一 TTS 句可唯一对应实际 DOM 片段（高亮、滚动）。
 * 复杂度较低。若找不到匹配则返回 null。
 * @param outerRange  整节对应 DOM Range
 * @param plain       本节净文本
 * @returns           按原句顺序匹配到的 DOM Range/未命中则为 null
 */
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
			// 针对长句，fallback：只搜索前一段文本
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
 * 根据 startCfi 对应位置，逆找所属的句子编号（第几句起播）（若找不到则回退到0）。
 * @param rend            epub 渲染实例
 * @param section         朗读节
 * @param startCfi        cfi 定位字符串
 * @param sentenceRanges  已索引的句子 DOM Range，可复用
 * @returns               起始句索引
 */
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

	// 从后往前找，定位最靠前且比 CFI 范围“在左边”的句
	for (let i = sentences.length - 1; i >= 0; i -= 1) {
		const r = ranges[i];
		if (!r) continue;
		if (r.compareBoundaryPoints(Range.END_TO_START, at) <= 0) return i;
	}
	return 0;
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
