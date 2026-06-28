/**
 * 本文件负责实现 EPUB 阅读器中与 CFI（EPUB 坐标）与 DOM 区间（Range）互相定位、映射及可视区域计算等相关的核心工具函数。
 *
 * 主要实现逻辑和能力如下：
 *
 * 1. CFI 与 Range 的双向解析与缓存
 *    - 提供根据 CFI 字符串解析出对应 DOM Range 的高性能工具，并支持 sync 阶段缓存，加速高频查找与高亮定位。
 *    - 支持根据 DOM Range 反推 EPUB CFI 区间，保证多 iframe、跨章节的范围都能严格按 EPUB 标准可定位与恢复。
 *
 * 2. 精确坐标与高亮区块计算
 *    - 实现了多场景下区分每一行文本的 getAccurateRangeLineClientRects，支持多容器、跨行的精准可视范围检测。
 *    - 对高亮或遮罩覆盖应用需求场景做了针对性优化（如：与用户手动选区、TTS 切句的区域精确对齐）。
 *
 * 3. 选区 Range 规范化处理
 *    - 提供 normalizeSelectionRangeForEpub 工具，对任意选区严格规范化，避免选区因 DOM 结构或空白影响 CFI 生成与后续恢复。
 *
 * 4. 利用多级缓存提升性能
 *    - 针对高频操作场景，利用缓存（如 syncAccurateClientRectCache、syncCfiRangeCache）显著减少重复 DOM/CFI 解析，保障交互丝滑。
 *    - 兼容多 iframe、章节并发处理，健壮性与性能兼备。
 *
 * 5. 其他辅助操作
 *    - 提供 Range 边界裁剪、逐字精确步进、遍历范围文本节点等基础能力，统一服务于高亮、注释、听读等外围功能。
 *
 * 适用场景涵盖：高亮渲染、注释业务、朗读高亮、区域同步、跨章节/跨 iframe 定位与 UI 覆盖等 EPUB 阅读核心复杂交互需求。
 */
import type { Rendition } from 'epubjs';
import {
	type EpubIframeContents,
	getRenditionContentsList,
} from './epubMarkShared';

export type { EpubIframeContents };
export { getRenditionContentsList };

export const EPUB_ANNOTATION_IGNORE_CLASS = 'epubjs-hl';

export type EpubRenditionView = {
	index?: number;
	contents?: { document?: Document };
};

/** epub.js views() 返回 Views 集合对象，须 .all() 展开为数组 */
export function getRenditionViewsList(rend?: Rendition): EpubRenditionView[] {
	if (!rend) return [];
	const raw = rend.views();
	if (!raw) return [];
	if (Array.isArray(raw)) return raw as EpubRenditionView[];
	return (raw as { all?: () => EpubRenditionView[] }).all?.() ?? [];
}

// 最大允许步进裁剪次数，防止死循环卡死（例如极端大文档或复杂边界情况）
const TRIM_BOUNDARY_MAX_STEPS = 8192;

/**
 * 裁剪 Range 边界，将起始或结束边界向内“步进”，跳过连续空白字符直至第一个非空白字符。
 * 原地修改传入的 range 对象，仅调整目标方向的边界（fromStart=true 处理起始边界，false 处理结束边界）。
 * 若边界已无可裁剪或步进超限，则终止不再处理。
 *
 * @param range     需要处理的 DOM Range 对象（会被直接修改，非新建对象）
 * @param fromStart 是否处理首部/起始边界（true=裁剪 start 边界，false=裁剪 end 边界）
 */
function trimBoundary(range: Range, fromStart: boolean): void {
	// 步进次数统计，防止极端情况死循环；每次 while 循环最多允许运行 TRIM_BOUNDARY_MAX_STEPS 次
	let steps = 0;
	while (steps++ < TRIM_BOUNDARY_MAX_STEPS) {
		// 获取当前 range 的字符串内容
		const text = range.toString();
		// 若 range 已经没有内容，说明已裁剪完毕，直接停止
		if (!text) return;

		// 取首字符或尾字符（根据 fromStart 决定），用于判定是否仍为空白需裁剪
		const edge = fromStart ? text[0] : text.at(-1);
		// 若当前边界字符不存在（理论上应已判断过），或已不是空白，则裁剪完成，提前返回
		if (!edge || !/\s/u.test(edge)) return;

		// 调用 stepRangeBoundary，将边界向内移动一步（逐字步进），若已到边界/不能再动，则提前返回
		if (!stepRangeBoundary(range, fromStart)) return;
	}
}

/**
 * 将 Range 的首/尾边界向前或向后精确移动一步（逐字符/节点步进），用于实现精准裁剪
 * 适用于去除空白等场景，例如把边界从空白字符“步进”到下一个有效字符或节点
 *
 * @param range - 需要调整边界的 DOM Range 对象（原地修改该 range，无需返回新的）
 * @param forward - true 表示调整起始（start）边界向后步进，false 表示调整结束（end）边界向前步进
 * @returns 是否实际移动了一步（true=成功移动，false=已到边界不能再移）
 */
function stepRangeBoundary(range: Range, forward: boolean): boolean {
	// 选取需要操作的 container 和 offset（forward=true 操作 start，false 操作 end）
	const container = forward ? range.startContainer : range.endContainer;
	const offset = forward ? range.startOffset : range.endOffset;

	// 情况 1：边界位于文本节点内
	if (container.nodeType === Node.TEXT_NODE) {
		// 获取文本内容，兼容 null
		const content = container.textContent ?? '';
		if (forward) {
			// 若 offset 已到文本末尾，不可再向后步进
			if (offset >= content.length) return false;
			// 将 start（起点）向后移动 1 个字符
			range.setStart(container, offset + 1);
			return true;
		}
		// 如果 offset 已在文本起始，不能再向前移
		if (offset <= 0) return false;
		// 将 end（终点）向前移动 1 个字符
		range.setEnd(container, offset - 1);
		return true;
	}

	// 情况 2：边界不是文本节点，且不是元素节点（常见于 Document/Comment 等，不处理直接返回）
	if (container.nodeType !== Node.ELEMENT_NODE) return false;

	// 获取当前 container 所属的 document，用于后续 createRange
	const doc = container.ownerDocument;
	if (!doc) return false;

	// 创建一个 probe range 作为“探针”，便于精确定位子节点
	const probe = doc.createRange();
	if (forward) {
		// 如果 offset 已经超出子节点最大序号，不能向后移动
		if (offset >= container.childNodes.length) return false;
		// 把 probe 设置为 offset 对应的下一个子节点左边界
		probe.setStart(container, offset);
		probe.setEnd(container, offset + 1);
		// collapse true 表示将 probe range 收缩到起始端（获得精确 start 位置信息）
		probe.collapse(true);
		// 将主 range 的 start 移动到 probe 的精确定位
		range.setStart(probe.startContainer, probe.startOffset);
		return true;
	}

	// 如果 offset 已在第一个子节点左侧，无法再向前移动
	if (offset <= 0) return false;
	// 把 probe 设置为 offset-1 到 offset 范围（即上一个子节点右边界）
	probe.setStart(container, offset - 1);
	probe.setEnd(container, offset);
	// collapse false 表示收缩到末尾端，获得精确 end 位置信息
	probe.collapse(false);
	// 将主 range 的 end 移动到 probe 的精确定位
	range.setEnd(probe.endContainer, probe.endOffset);
	return true;
}

/**
 * 去掉选区首尾空白，避免 CFI 比视觉选区更宽
 * 具体操作：对传入的 Range 执行 clone，分别裁剪首尾方向的无效（空白）字符。
 * 这样处理后，能够保证存储/传递的 CFI/mapping 选区和用户视觉选区范围一致，防止误判（多包裹了空白）。
 * @param range - 待处理的 Range 选区对象，原对象不会被修改
 * @returns 返回裁剪后的新 Range（无首尾空白）
 */
export function trimSelectionRange(range: Range): Range {
	// 先克隆一份 range 副本，避免直接修改原选区
	const trimmed = range.cloneRange();
	// 裁剪开头空白符（向前方向修剪）
	trimBoundary(trimmed, true);
	// 裁剪结尾空白符（向后方向修剪）
	trimBoundary(trimmed, false);
	// 返回修剪后结果
	return trimmed;
}

/**
 * 获取文档序（深度优先）下的下一个节点
 * 逻辑如下：优先取当前节点的第一个子节点，如有则直接返回；
 * 否则，沿父节点链向上回溯，查找下一个兄弟节点作为 next；
 * 若回溯到顶没有下一个兄弟节点，说明已至文档尾，返回 null。
 *
 * 示例（XML/DOM 树）：
 * <root>
 *   <a>
 *     <b />
 *     <c />
 *   </a>
 *   <d />
 * </root>
 * 对 <b /> 调用 nextNodeInDocumentOrder，会返回 <c />
 * 对 <c /> 调用，会返回 <d />
 * @param node - 当前节点
 * @returns 下一个节点（深度优先顺序），如已到文档尾则返回 null
 */
function nextNodeInDocumentOrder(node: Node): Node | null {
	// 如有子节点，优先 DFS 进入第一个子节点
	if (node.firstChild) return node.firstChild;
	// 初始化临时指针为当前节点，用于循环向上追溯 parent
	let current: Node | null = node;
	while (current) {
		// 如果还有下一个兄弟节点，则为下一个 DFS 顺序节点
		if (current.nextSibling) return current.nextSibling;
		// 否则上溯父节点，继续查找父节点的下一个兄弟节点
		current = current.parentNode;
	}
	// 若一路追溯到底都找不到，说明已遍历完毕
	return null;
}

/**
 * 获取 Range 选区起始的第一个实际节点（文本或元素），即文档序起点。
 * 常用于 forEachTextNodeInRange 的入口定位。
 * @param range - 选区 Range 对象
 * @returns 第一个可访问节点，或找不到时为 null
 */
function getFirstNodeInRange(range: Range): Node | null {
	// 解构获取选区的起始容器节点及其偏移
	const { startContainer, startOffset } = range;

	// 情况1：若起始节点本身为文本节点，直接返回此节点
	if (startContainer.nodeType === Node.TEXT_NODE) {
		return startContainer;
	}

	// 情况2：起始节点为元素，尝试取其第 startOffset 个子节点
	const child = startContainer.childNodes[startOffset];
	if (child) return child;

	// 情况3：如果偏移量大于0，说明光标可能处于 startContainer 的末尾
	// 此时取上一个子节点，并在文档序中找其下一个节点（即“下一实际节点”）
	if (startOffset > 0) {
		const prev = startContainer.childNodes[startOffset - 1];
		if (prev) return nextNodeInDocumentOrder(prev);
	}

	// 情况4：前述情况都未命中，则直接以 startContainer 为起点走文档序下一个节点
	return nextNodeInDocumentOrder(startContainer);
}

/**
 * 判断指定节点 node 是否在给定 Range 选区的“结束节点之后”（文档序）
 * 用于遍历时判定是否越界
 * @param node - 待检测节点
 * @param range - 目标 Range 区间
 * @returns 若 node 超过 Range 右界，返回 true，否则 false
 */
function isNodeAfterRangeEnd(node: Node, range: Range): boolean {
	const end = range.endContainer;
	// 若当前节点正好等于 endContainer，自然还在范围内
	if (node === end) return false;
	// compareDocumentPosition 判断 node 是否在 endContainer 之后
	// Node.DOCUMENT_POSITION_FOLLOWING 表示 node 位于 end 之后
	return Boolean(
		end.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
	);
}

/**
 * 沿文档序遍历 Range 内所有文本节点，对每个节点可指定起止 offset。
 * 复杂度 O(选区跨度)，高效跳过大段结构，仅遍历在选区覆盖内的文本节点，
 * 比章级 TreeWalker + intersectsNode 高效，且无额外依赖。
 *
 * @param range - 待遍历的选区 Range 对象
 * @param visit - 针对每个文本节点触发的回调(node, start, end)
 */
export function forEachTextNodeInRange(
	range: Range,
	visit: (node: Text, start: number, end: number) => void,
): void {
	// 获取选区终止节点及其偏移，循环过程需判断是否抵达终点
	const endContainer = range.endContainer;
	const endOffset = range.endOffset;

	// current 初始化为选区起点的首个可访问节点
	let current: Node | null = getFirstNodeInRange(range);

	// 循环遍历选区内的节点，方向为文档序（即先子后兄再父，深度优先）
	while (current) {
		// 若当前节点为 TEXT_NODE，处理其在选区内实际被命中的起止 offset
		if (current.nodeType === Node.TEXT_NODE) {
			const textNode = current as Text;
			// 起始 offset：若正好在选区起始节点，则从 Range 的 startOffset 起，否则从0
			const start = current === range.startContainer ? range.startOffset : 0;
			// 终止 offset：若正好在选区终止节点，则以 endOffset 截止，否则用文本节点全长
			const end = current === range.endContainer ? endOffset : textNode.length;
			// 若选中的范围内确有字符，调用回调函数通知调用方
			if (start < end) {
				visit(textNode, start, end);
			}
		}

		// 遍历到终止节点，则退出循环（已完成所有有效片段的处理）
		if (current === endContainer) break;

		// 获取当前节点在文档序下的下一个节点
		const next = nextNodeInDocumentOrder(current);
		// 若不存在下一个节点，或下一个节点已经超出 Range 结束点，则遍历终止
		if (!next || isNodeAfterRangeEnd(next, range)) break;
		// 进入下一轮处理
		current = next;
	}
}

/**
 * 将选区收拢到首尾非空白字符，跳过空行/块级边界。
 * 反向拖选到空行时 Range 的 commonAncestor 常升到章容器，不可再用整棵 TreeWalker。
 *
 * @param range 要进行首尾内容规整的 Range（选区）对象
 * @returns    若找到有效文本节点，则返回收拢后的新 Range；否则返回 null
 */
export function snapSelectionRangeToTextContent(range: Range): Range | null {
	// 获取 range 起点所在节点的 document 引用，用于创建新 Range
	const doc = range.startContainer.ownerDocument;
	// 若取不到 document，无法创建 Range，直接返回 null
	if (!doc) return null;

	// firstNode / firstOffset 记录选区内首个有效（非空白）字符所在文本节点/偏移
	let firstNode: Text | null = null;
	let firstOffset = 0;
	// lastNode / lastOffset 记录选区内最后一个有效（非空白）字符所在文本节点/偏移
	let lastNode: Text | null = null;
	let lastOffset = 0;

	// 遍历选区内的所有文本节点及其起止 offset（forEachTextNodeInRange 会跳过非文本节点，提高性能）
	forEachTextNodeInRange(range, (node, start, end) => {
		// 在该文本节点的有效范围内，逐字检查
		for (let offset = start; offset < end; offset++) {
			// 取出当前字符
			const ch = node.data[offset];
			// 若当前字符为空（越界）或为 Unicode 空白字符（\s），则跳过
			if (!ch || /\s/u.test(ch)) continue;
			// 若尚未找到首个有效字符节点，则本字符为首节点和首偏移
			if (!firstNode) {
				firstNode = node;
				firstOffset = offset;
			}
			// 不论是否为第一个，只要是有效字符，都视为新的末尾
			lastNode = node;
			lastOffset = offset + 1; // endOffset 语意，需 +1
		}
	});

	// 若未寻得任何有效字符（即选区为空白或无文本），直接返回 null
	if (!firstNode || !lastNode) return null;

	// 创建一个新的 Range，用发现的首/尾节点和偏移设置选区边界
	const snapped = doc.createRange();
	snapped.setStart(firstNode, firstOffset); // 起点/offset 是首个有效字符
	snapped.setEnd(lastNode, lastOffset); // 终点/offset 是最后一个有效字符之后
	return snapped;
}

/** 规范化文字选区：收拢正文边界并去掉首尾空白，供 CFI / PopBar 使用 */
export function normalizeSelectionRangeForEpub(range: Range): Range | null {
	// 首先调用 snapSelectionRangeToTextContent，将选区收拢到首尾非空白字符
	const snapped = snapSelectionRangeToTextContent(range);
	// 若收拢后未命中有效文本节点，则返回 null，代表无有效选区
	if (!snapped) return null;
	// 对 snap 后的 range 进行 trimSelectionRange，进一步去除首尾无效字符
	const trimmed = trimSelectionRange(snapped);
	// 若去除后字符串内容全为空，则认为选区无效，返回 null
	if (!trimmed.toString().trim()) return null;
	// 返回处理后的有效 range
	return trimmed;
}

// 获取光标所在位置的 DOMRect（用于定位 popover、菜单等 UI）
function getCaretClientRect(range: Range): DOMRect | null {
	// 获取 range 包含的所有 client rects，过滤掉太小（宽或高 <= 0.5）的 rect
	const rects = [...range.getClientRects()].filter(
		(r) => r.width > 0.5 || r.height > 0.5,
	);
	// 若存在有效 rect，返回第一个（即光标/选区起始位置）
	if (rects.length > 0) return rects[0] ?? null;
	// 若无有效 rect，退而求其次，取整个范围的 bounding rect
	const box = range.getBoundingClientRect();
	// 若 bounding rect 有实际尺寸，返回该 box
	if (box.width > 0 || box.height > 0) return box;
	// 全部获取失败，返回 null 表示无有效位置
	return null;
}

// 判断两个 DOMRect 是否在同一水平行（用于逐行判断是否为同一文本行）
function sameLine(a: DOMRect, b: DOMRect): boolean {
	// 比较 top 和 bottom 坐标，允许 1px 误差（适应不同分辨率或渲染差异）
	return Math.abs(a.top - b.top) < 1 && Math.abs(a.bottom - b.bottom) < 1;
}

// 判断 inner 矩形是否“嵌套包含于” outer 矩形，但不是完全重合或误判极小差异
function containsClientRect(outer: DOMRect, inner: DOMRect): boolean {
	return (
		// inner 的 left 不小于 outer.left - 0.5（允许浮点误差），right 不大于 outer.right + 0.5
		inner.left >= outer.left - 0.5 &&
		inner.right <= outer.right + 0.5 &&
		// inner 的 top/bottom 同理
		inner.top >= outer.top - 0.5 &&
		inner.bottom <= outer.bottom + 0.5 &&
		// 排除完全重合（各边距离小于 0.5），避免本身==本身的情况
		!(
			Math.abs(inner.left - outer.left) < 0.5 &&
			Math.abs(inner.right - outer.right) < 0.5 &&
			Math.abs(inner.top - outer.top) < 0.5 &&
			Math.abs(inner.bottom - outer.bottom) < 0.5
		)
	);
}

/**
 * 判断指定 Text 节点指定范围 [start, end) 内是否存在非空白字符
 * @param node 文本节点
 * @param start 起始偏移（包含）
 * @param end 结束偏移（不包含）
 * @returns 若至少存在一非空白字符则返回 true，否则返回 false
 */
function containsNonWhitespaceText(
	node: Text,
	start: number,
	end: number,
): boolean {
	// 遍历指定范围内的每一个字符
	for (let i = start; i < end; i++) {
		const ch = node.data[i]; // 取当前位置字符
		// 如果该字符存在且不是空白字符，则说明区间内存在有效字符
		if (ch && !/\s/u.test(ch)) return true;
	}
	// 整个区间都没有非空白字符，返回 false
	return false;
}

/**
 * 去掉 marks-pane 会误删的「大行块 rect」，保留逐行 client rect
 * 该函数用于筛选 rects 数组，仅保留最底层（叶节点级别、真实代表单行文本）的 rect。
 * 具体做法是：如果某个 rect 能完全包含另一个 rect，则它可能是大块区域，应被去除；
 * 只有那些没有包含其它 rect 的才被保留下来。
 * 这样做能够规避 EPUB 中某些 block/段落级 rect 实际上会包裹多行，导致高亮溢出现象。
 */
function preferLeafLineClientRects(rects: DOMRect[]): DOMRect[] {
	// 如果 rect 数量只有 0 或 1，无需筛选，直接返回原数组
	if (rects.length <= 1) return rects;

	// 过滤出“没有完全包含其它 rect”的 rect
	return rects.filter((rect, index) => {
		// 遍历所有其它 rect，判断当前 rect 是否包含任何其它 rect
		for (let i = 0; i < rects.length; i++) {
			// 跳过自己
			if (i === index) continue;
			// 当前 rect 如果包含了 rects[i]，则它不是最细的“行级” rect，应被舍弃
			if (containsClientRect(rect, rects[i]!)) {
				return false;
			}
		}
		// 没有包含任意其它 rect，则当前 rect 被保留
		return true;
	});
}

/**
 * 按 range 内各文本节点片段分别取 client rect
 * 这样可以避免使用 range.getClientRects() 时，包含整行/block 宽度，误把行尾空白也算在划线范围内
 * 该方法仅对 range 中真正有非空白字符的文本部分提取 rect，从而精准描出高亮范围
 * @param range 目标 Range 对象（选区范围）
 * @returns 精确代表文本实际显示区域的 DOMRect 数组
 */
function collectRangeTextClientRects(range: Range): DOMRect[] {
	// 获取当前 range 所属的 document，如果没有（理论上不会出现），直接返回空数组
	const doc = range.startContainer.ownerDocument;
	if (!doc) return [];

	// 用于收集所有有效的 rect
	const rects: DOMRect[] = [];

	// 遍历 range 涉及到的所有文本节点片段（通过 forEachTextNodeInRange 回调）
	forEachTextNodeInRange(range, (node, start, end) => {
		// 跳过本片段只有空白字符的情况（如选区含有段落间距、缩进或 span 内空白）
		if (!containsNonWhitespaceText(node, start, end)) return;

		// 针对当前片段，创建一个子范围 segment，只包裹该文本节点指定区间
		const segment = doc.createRange();
		segment.setStart(node, start); // 起始偏移
		segment.setEnd(node, end); // 结束偏移

		// 获取该 segment 的 client rects，代表文本实际占据的每一块区域
		for (const rect of segment.getClientRects()) {
			// 屏蔽无宽度或高度过小的 rect，避免收录渲染误差带来的异常小块
			if (rect.width > 0.5 && rect.height > 0.5) {
				rects.push(rect);
			}
		}
	});

	// 最后调用 preferLeafLineClientRects 筛除 block/大区域，只保留“最小行级”rect
	return preferLeafLineClientRects(rects);
}

/**
 * 判断坐标点 (clientX, clientY) 是否落在给定文本“条带”rect 内部（含下方可容忍距离）
 *
 * 设计目的：
 * - 用于高亮/监听等场景下，判断鼠标或触摸点是否确实“位于”正文文本处（常配合文本片段 rect 执行）。
 * - 允许 y 方向上点稍微落在行下区域（由 maxBelowPx 控制上限），提升误触容忍度与交互宽容性。
 *
 * @param rect       要检测的文本 band 区域 DOMRect
 * @param clientX    测试点的屏幕 X 坐标（相对 viewport 坐标系）
 * @param clientY    测试点的屏幕 Y 坐标
 * @param maxBelowPx 允许点落在 rect 下方的“最大像素容忍距离”（可用于点到文本下缘微出界时也视为命中）
 * @returns          布尔值，true 表示点命中 band 区域或下缘 buffer，false 表示未命中
 */
function pointInTextBandRect(
	rect: DOMRect,
	clientX: number,
	clientY: number,
	maxBelowPx: number,
): boolean {
	// 判断 Y 坐标是否在 rect 顶部到最大下边界容忍范围内（含边界，不含更下方）
	// 然后再判断 X 坐标是否在 rect 左右区间内
	return (
		clientY >= rect.top && // 点在 rect 顶部及以上
		clientY < rect.top + rect.height + maxBelowPx && // 点在 rect 底部（向下可溢出一定距离）
		clientX >= rect.left && // 点在 rect 左侧及右侧区间
		clientX < rect.left + rect.width
	);
}

/**
 * 判断用户点击（或触摸）坐标是否位于指定 range（正文段落）的文本条带行内
 * 使用文本片段 rect 来严格判定，避免因行尾/段尾空白而被误判为命中。
 * 支持嵌套于 iframe 时的相对定位修正。
 *
 * @param range      要判定的 DOM Range（一般为正文可见段落/句子/任意文本区间）
 * @param iframe     若 range 处于 iframe 中，则传入对应 <iframe> 元素，否则传 null
 * @param clientX    用户点击的屏幕 X 坐标（相对 viewport）
 * @param clientY    用户点击的屏幕 Y 坐标（相对 viewport）
 * @param maxBelowPx 判定时允许点击点落在文本 band 下方的最大像素容忍距离（避免微量误判）
 * @returns          true 表示点命中正文文本条带或下方 buffer，false 则未命中
 */
export function isPointInRangeTextBand(
	range: Range,
	iframe: Element | null,
	clientX: number,
	clientY: number,
	maxBelowPx: number,
): boolean {
	// 获取 range 对应的“精准行文本片段” rect，剔除行尾等空白
	const rects = getAccurateRangeLineClientRects(range);
	// 若无任何文本片段则直接返回 false（如选区为空内容/全是不可见字符）
	if (rects.length === 0) return false;

	// 遍历所有 rect，判断点击点是否命中任意文本行
	for (const r of rects) {
		// pointInTextBandRect 支持下缘微小容忍距离（maxBelowPx）
		if (pointInTextBandRect(r, clientX, clientY, maxBelowPx)) return true;
	}

	// 若未传 iframe，直接结束判定
	if (!iframe) return false;
	// 若 range 处于 iframe，需将 rect 投影到顶层页面坐标（消除 iframe offset）
	const offset = iframe.getBoundingClientRect();
	for (const r of rects) {
		// 将 rect 从 iframe 内部局部坐标“平移”到外部（顶层页面）坐标
		const local = new DOMRect(
			r.left - offset.left,
			r.top - offset.top,
			r.width,
			r.height,
		);
		// 再次用修正后的坐标判断命中
		if (pointInTextBandRect(local, clientX, clientY, maxBelowPx)) return true;
	}
	// 均不命中则返回 false
	return false;
}

/**
 * 为指定 range 获取“精准行文本片段” rect，避免划线包含行尾空白。
 * 逻辑：优先尝试基于文本节点收集的 rect，若失败则回退为传统 getClientRects，最后按照起止 caret 精修首尾行。
 * @param range 目标 Range 对象（选区范围）
 * @returns 精确代表文本实际显示区域的 DOMRect 数组
 */
export function getAccurateRangeLineClientRects(range: Range): DOMRect[] {
	// 先尝试通过 collectRangeTextClientRects 采集“只包含实际文本”的 rect 列表
	const fromText = collectRangeTextClientRects(range);
	// 若上述方式无法获取（如不含正常文本节点），则回退为 getClientRects，并筛掉极小 rect
	const raw =
		fromText.length > 0
			? fromText
			: preferLeafLineClientRects(
					[...range.getClientRects()].filter(
						(r) => r.width > 0.5 && r.height > 0.5,
					),
				);
	// 若无可用 rect，则直接返回空数组
	if (raw.length === 0) return raw;

	// 计算 range 首端 caret 的精确位置（真起点，非 line 的最左端）
	const startCaret = range.cloneRange();
	startCaret.collapse(true); // 折叠到 range 起点
	const startEdge = getCaretClientRect(startCaret);

	// 计算 range 末端 caret 的精确位置（真终点，非 line 的最右端）
	const endCaret = range.cloneRange();
	endCaret.collapse(false); // 折叠到 range 终点
	const endEdge = getCaretClientRect(endCaret);

	// 处理每一个 rect，首行和末行精剪起止 x 坐标以保证不划空白
	return (
		raw
			.map((rect, index) => {
				let left = rect.left; // 初始取 rect 本有边界
				let right = rect.right;

				// 对首行：若 caret 起点落在本 rect，左边取最大值，精修左端
				if (index === 0 && startEdge && sameLine(rect, startEdge)) {
					left = Math.max(left, startEdge.left);
				}
				// 对末行：若 caret 终点落在本 rect，右边取较小值
				if (index === raw.length - 1 && endEdge && sameLine(rect, endEdge)) {
					right = Math.min(right, endEdge.right);
				}

				const width = right - left; // 可能内容非常短需校验
				if (width <= 0.5) return null; // 小于阈值判为无效，抛弃
				// 返回裁剪后的准确 rect
				return new DOMRect(left, rect.top, width, rect.height);
			})
			// 过滤掉所有被抛弃的无效 rect
			.filter((rect): rect is DOMRect => rect !== null)
	);
}

// SvgLineSegment 类型表示一个 SVG 中的线段/矩形区域，
// 通常用于高亮、划线等场景，包含其局部坐标 (x, y) 及宽高 (width, height)
export type SvgLineSegment = {
	// 线段/矩形区域的左上角 x 坐标（SVG 局部坐标系）
	x: number;
	// 线段/矩形区域的左上角 y 坐标
	y: number;
	// 区域宽度
	width: number;
	// 区域高度
	height: number;
};

/**
 * 从给定的 SVG 分组（<g> 元素）向上查找最近的 SVG 根元素 (<svg>)。
 * 一般用于已知事件目标为 highlighter 的 group 时，反查所属 SVG 容器。
 *
 * @param group - 高亮区块所在的 SVG group 元素（如 <g>）
 * @returns 若存在最近的 SVGSVGElement，则返回该元素；否则返回 null。
 */
export function findMarksPaneSvgFromGroup(
	group: Element,
): SVGSVGElement | null {
	// 使用 Element.closest 方法查找最近的 <svg> 祖先节点
	const svg = group.closest('svg');
	// 判断找到的节点类型是否为 SVGSVGElement，若是则返回，否则返回 null
	return svg instanceof SVGSVGElement ? svg : null;
}

/**
 * 获取 SVG 元素外层的 HTML 容器元素。
 * 一般用于确定 SVG 置于文档中的父层级，便于坐标换算或定位。
 *
 * @param svg - 目标 SVG 根元素（SVGSVGElement）
 * @returns 若父节点为 HTMLElement，则返回该元素；否则返回 null
 */
export function findMarksPaneContainer(svg: SVGSVGElement): HTMLElement | null {
	// 取得 SVG 元素的父节点 parentElement
	const parent = svg.parentElement;
	// 检查父节点是否为 HTMLElement 类型，是则返回，否则返回 null
	return parent instanceof HTMLElement ? parent : null;
}

/**
 * 解析单个 SVGRectElement 并返回其在 SVG 局部坐标系下的区域对象（SvgLineSegment）。
 *
 * 用于高亮、划线等场景下，从 SVG <rect> 元素中提取其 x、y、width、height 属性并转换为数字类型，
 * 若属性缺失、非有限数值或宽高过小（≤0.5）则视为无效，返回 null。
 *
 * @param rect - SVG <rect> 元素，代表一个高亮/标记区域。
 * @returns SvgLineSegment 表示的局部区域对象，若无效则为 null。
 */
export function parseSvgMarkRect(rect: SVGRectElement): SvgLineSegment | null {
	// 读取 rect 的 x 坐标，若属性不存在则用 'NaN'，方便后续判断非法
	const x = Number.parseFloat(rect.getAttribute('x') ?? 'NaN');
	// 读取 rect 的 y 坐标
	const y = Number.parseFloat(rect.getAttribute('y') ?? 'NaN');
	// 读取 rect 的宽度
	const width = Number.parseFloat(rect.getAttribute('width') ?? 'NaN');
	// 读取 rect 的高度
	const height = Number.parseFloat(rect.getAttribute('height') ?? 'NaN');
	// 检查四个数值是否都为有限数，且宽高均 > 0.5（防止极细或无效 rect 参与高亮渲染）
	if (
		!Number.isFinite(x) || // x 坐标非法（缺失或无法转换为数值）
		!Number.isFinite(y) || // y 坐标非法
		!Number.isFinite(width) || // 宽度非法
		!Number.isFinite(height) || // 高度非法
		width <= 0.5 || // 区域宽度太小视为无效
		height <= 0.5 // 区域高度太小视为无效
	) {
		return null;
	}
	// 返回合法的局部区域对象
	return { x, y, width, height };
}

/**
 * 将 DOMRect 对象（一般为高亮/选区的 getClientRects 得到）转换为 SVG 区域的局部坐标线段（SvgLineSegment）。
 *
 * 调用场景：
 * - 获取 EPUB 阅读器内选中区域（高亮等）在 SVG 标记区域中的局部坐标，用于精确高亮 overlay。
 *
 * 核心思路：
 * - clientRect 是页面内的绝对窗口坐标（相对于 viewport，通常由 getClientRects 返回）。
 * - svg.getBoundingClientRect() 得到 SVG 根节点在页面的坐标偏移量。
 * - container.getBoundingClientRect() 得到 SVG 的父容器的偏移（有些布局下会包含 border/Padding 等影响）。
 * - 通过 clientRect - svgRect + containerRect，将全局窗口坐标系下的 clientRect 转换为 SVG 父容器的局部坐标。
 *   便于多 pane、嵌套布局下叠加高亮时能准确对齐。
 *
 * @param clientRect - 需要转换的 DOMRect（绝对窗口坐标），如选区、高亮行的 getClientRects 得到的单行/多行 rect。
 * @param svg - SVGSVGElement 对象，高亮线段的根 <svg> 元素。
 * @param container - HTML 容器元素，SVG 的外层父节点，用于坐标基准平移。
 * @returns SvgLineSegment - 转换到 SVG 父容器局部坐标系下的线段 {x, y, width, height}
 */
export function clientRectToSvgLocalSegment(
	clientRect: DOMRect,
	svg: SVGSVGElement,
	container: HTMLElement,
): SvgLineSegment {
	// 获取 SVG 元素在页面中的绝对位置和尺寸信息（即 SVG 的左上角坐标等）
	const offset = svg.getBoundingClientRect();
	// 获取 SVG 外层容器元素在页面中的绝对位置和尺寸信息
	const containerRect = container.getBoundingClientRect();
	// 计算 clientRect 在 SVG 容器坐标系内的位置
	// 公式：clientRect.left（全局左坐标）- svg.offset.left（svg左上角坐标）+ containerRect.left（容器偏移补偿）
	return {
		x: clientRect.left - offset.left + containerRect.left, // 局部 x 坐标（左上角）
		y: clientRect.top - offset.top + containerRect.top, // 局部 y 坐标（顶边）
		width: clientRect.width, // 区域宽度（横向跨度）
		height: clientRect.height, // 区域高度（纵向跨度）
	};
}

/**
 * 根据给定的 EPUB Rendition、高亮分组元素和 CFI 字符串，计算高亮所在的 SVG 局部线段（SvgLineSegment）数组。
 *
 * 主要流程：
 * 1. 首先检查 rendition 和 cfiRange，如果任一无效（如 reader 尚未初始化或范围为空），直接返回空数组。
 * 2. 利用 cfiRange 解析出真实的 DOM Range（即高亮文本对应的实际节点区间）—— 用 resolveCfiDomRange 实现。
 *    - resolveCfiDomRange 能根据 CFI 字符串和 rendition 对象定位 DOM Range，实现高亮的精确映射。
 *    - 如果解析失败（如超出范围或页面尚未渲染），返回空数组。
 * 3. 尝试对得到的 rawRange 做一次 EPUB 特定的范围归一化（比如修正 selection 边界至字词边缘、避免跨标签异常），
 *    - 若能归一化则用归一化结果；否则 fallback 到原始 rawRange。
 * 4. 最后，将最终的 DOM Range 转换为 SVG 局部线段数组（通过 resolveDomRangeSvgLineSegments 实现），
 *    - 这样每一行高亮或被选中的文本就会被映射到 group（一般为 SVG 容器）内部的正确几何位置（用于精确 overlay）。
 *
 * @param rend    EPUB Rendition 实例（提供 CFI → DOM 应用）
 * @param group   SVG 高亮线段的父容器元素
 * @param cfiRange 选中的 CFI 字符串（EPUB 标准定位范围，类似 dom range 路径）
 * @returns       该高亮的所有行对应的 SvgLineSegment 数组，一个 line 段一个 rect
 */
export function resolveHighlightSvgLineSegments(
	rend: Rendition | undefined,
	group: Element,
	cfiRange?: string,
): SvgLineSegment[] {
	// 防御：rendition 未初始化 或 cfiRange 为空时直接返回空数组，避免出错
	if (!rend || !cfiRange?.trim()) return [];

	// 用 cfiRange 结合 rendition 解析出高亮的真实 DOM Range
	const rawRange = resolveCfiDomRange(rend, cfiRange.trim());
	// 解析失败则直接返回空数组，说明当前高亮范围在现有渲染页中找不到
	if (!rawRange) return [];

	// 尝试进行 EPUB 特定的归一化（如修正跨标签等问题），失败则用原 range
	const range = normalizeSelectionRangeForEpub(rawRange) ?? rawRange;
	// 将 DOM Range 投影到 group 下的 SVG 局部线段（用于高亮 overlay 精准显示）
	return resolveDomRangeSvgLineSegments(group, range);
}

/**
 * 直接用 DOM Range 计算高亮区域的多行 rect；用于听书、热路径性能优化（避开 CFI 解析/回写），
 * 可直接将已知的 DOM Range 正确投影到所属 SVG 容器中用于 mark 高亮。
 *
 * 实现流程：
 * 1. 对 range 应用 EPUB 专用归一化（比如规整起止节点避免跨标签），
 *    如归一化失败则保持原 range。
 * 2. 定位 group 所在 mark 区块的 SVG 容器（findMarksPaneSvgFromGroup）；
 *    若找不到，直接 fallback 返回空数组，避免报错。
 * 3. 再定位 SVG 的外层容器节点（findMarksPaneContainer）。
 *    只有两者齐备，才能投影并换算出实际的局部坐标。
 * 4. 用 getAccurateRangeLineClientRects 拆解归一化 range 得到每一行的 ClientRect 区块，
 *    然后遍历这些 rect，通过 clientRectToSvgLocalSegment
 *    将每一行的绝对坐标映射到 SVG 内部的局部线段坐标系，最终返回全部 line 段的数学结构数组。
 *
 * @param group 高亮 mark 所在的 SVG group 元素
 * @param range 实际选中的 DOM Range 区段（已可直接用于 clientRects）
 * @returns     对应于 SVG 局部的高亮线段数组，每一行为一个单独 rect
 */
export function resolveDomRangeSvgLineSegments(
	group: Element,
	range: Range,
): SvgLineSegment[] {
	// 步骤1: 尝试归一化 DOM Range，规避边界问题，
	// 如未命中特殊修正，则直接用原 range
	const normalized = normalizeSelectionRangeForEpub(range) ?? range;

	// 步骤2: 查找当前 group 所属 SVG 容器
	const svg = findMarksPaneSvgFromGroup(group);
	// 步骤3: 若找到 SVG，再查找其顶层容器节点，
	// 用于计算相对 offset（如安全栏/书页外围边距补偿等）
	const container = svg ? findMarksPaneContainer(svg) : null;

	// 若 SVG 或外层容器无法获得，说明高亮无法安全投影，直接返回空，后续流程不会出错
	if (!svg || !container) return [];

	// 步骤4: 将归一化后的选区分拆为多行（viewport）rect，逐一映射为 SVG 局部线段
	return getAccurateRangeLineClientRects(normalized).map((rect) =>
		clientRectToSvgLocalSegment(rect, svg, container),
	);
}

/**
 * 从 mark 元素的 epub.js 已写入 SVG <rect> 元素中读取高亮线段信息
 * 用于性能热路径：省去 CFI→DOM→getClientRects 的慢路径，直接读取 SVG 上已有的几何
 * 典型场景：
 *   - epub.js 渲染高亮标注时，会在 group 下写入若干 <rect>
 *   - 每个 <rect> 对应页面上一根高亮线段
 *   - 此方法直接遍历这些 rect 并解析出必要的几何结构，极大加速批量绘制/校验
 *
 * @param group 高亮 mark 所在的 SVG <g> 元素
 * @returns     解析获得的 SVG 局部线段数组（每一行为一个 rect 结构体）
 */
export function readMarkSvgLineSegmentsFromRects(
	group: Element,
): SvgLineSegment[] {
	// 用于累积所有解析成功的线段对象
	const segments: SvgLineSegment[] = [];
	// 遍历 group 下所有 svg <rect> 节点（每个 rect 对应一行高亮覆盖）
	for (const node of group.querySelectorAll('rect')) {
		// 过滤，仅处理 SVGRectElement，跳过非 svg rect 节点
		if (!(node instanceof SVGRectElement)) continue;
		// 解析单个 svg rect 元素为 SvgLineSegment 结构
		const parsed = parseSvgMarkRect(node);
		// 只累加解析成功的（返回 null/undefined 说明异常格式，跳过）
		if (parsed) segments.push(parsed);
	}
	// 返回所有有效解析出的 svg 线段
	return segments;
}

/**
 * patch 阶段解析 mark 线段。
 * 跨段落选区时 epub.js rect 会含段落间空行；有 CFI 时用精确文本行几何校正。
 * 校正后 rect 行数稳定时仍走读 rect 快路径（滚动性能）。
 *
 * @param rend     当前 EPUB 的 Rendition 对象，若无则只走 SVG rect 解析
 * @param group    当前 mark 节点下的 SVG <g>（包含高亮 rect）
 * @param cfiRange 当前高亮选区的精确 CFI（可选）
 * @returns        SVG 局部线段数组，优先走热路径（rect），必要时用精确校正结果
 */
export function resolveMarkSvgLineSegments(
	rend: Rendition | undefined,
	group: Element,
	cfiRange?: string,
): SvgLineSegment[] {
	// 1. 先尝试直接读取 group 下所有 SVG <rect> 作为现有高亮（速度最快：热路径）
	const existing = readMarkSvgLineSegmentsFromRects(group);

	// 2. 若传入 rendition 对象与可用 cfiRange，尝试基于精确文本行几何再解析一次高亮线段
	if (rend && cfiRange?.trim()) {
		// 生成与文本实际内容严格对应的 SVG 线段数组（如 patch 空行/多余 rect）
		const accurate = resolveHighlightSvgLineSegments(rend, group, cfiRange);
		if (accurate.length > 0) {
			// 2.a 若 rect 行数与精确行数一致，且总宽度足够接近，说明 epub.js rect 已被修正，优先用热路径数据（提升滚动性能）
			if (
				existing.length === accurate.length &&
				segmentsRoughlyMatch(existing, accurate)
			) {
				return existing;
			}
			// 2.b 如行数/宽度不符，说明原 rect 包含多余空行或异常，直接返回校正后的精确数据
			return accurate;
		}
	}

	// 3. 若没有精确几何但已有 rect，直接返回 svg rect 结果（如无交叉覆盖等复杂场景）
	if (existing.length > 0) return existing;

	// 4. 极端情况：无 rect 或 rect 异常，仅剩精准 CFI 时最后兜底再走一次精确计算
	return resolveHighlightSvgLineSegments(rend, group, cfiRange);
}

/**
 * 判断两个 SVG 高亮线段数组（segments）在“行数量和宽度总量”上是否“足够接近”
 *
 * 设计目的：
 * - 用于对比 epub.js 预生成的 rects 与根据 CFI 校正后的精确 rects 是否可以视为“基本一致”
 * - 如果基本一致，则可直接复用现有 rect（提升性能/热路径），否则需用精确结果
 *
 * 判定规则：
 * 1. 首先要求两个 segments 数组的长度（即高亮行数）完全一致
 * 2. 其次比较两组所有线段的宽度总和，若它们的差值小于 1 像素，认为“接近”
 *
 * @param existing - 原始（epub.js 解析出的）高亮 SVG 线段数组
 * @param accurate - 基于精确文本行几何校正后的 SVG 线段数组
 * @returns 布尔值。true 表示两个 segments 在数量和宽度上几乎一样，可视为等价，false 表示差异较大
 */
function segmentsRoughlyMatch(
	existing: SvgLineSegment[],
	accurate: SvgLineSegment[],
): boolean {
	// 1. 若两组线段数量不一致，视为不匹配，直接返回 false
	if (existing.length !== accurate.length) return false;
	// 2. 计算辅助函数：求一组线段数组的宽度总和
	const sumWidth = (segments: SvgLineSegment[]) =>
		segments.reduce((sum, s) => sum + s.width, 0);
	// 3. 比较两组宽度和的绝对差值，若小于 1 像素，则认为“几乎一样”
	return Math.abs(sumWidth(existing) - sumWidth(accurate)) < 1;
}

// 维护 CFI 到 Range 的缓存变量，在批处理高亮或注释同步时启用，避免重复将相同 CFI 解析为 Range
let syncCfiRangeCache: Map<string, Range | null> | null = null;
// 维护精准 clientRect 数组的缓存变量，按唯一 key 存储 Range 的精确几何，优化 O(n²) 解析和后续复用
let syncAccurateClientRectCache: Map<string, DOMRect[]> | null = null;

/**
 * 启动 EPUB 批量注释/高亮同步缓存作用域（必须成对调用 end 方法释放）
 *
 * 实现说明：
 * - 初始化 CFI → Range 与 clientRect 的缓存对象
 * - 本函数需在批处理（如批量同步标注、想法、注释）起始前调用
 * - 期间所有 get*Cached 方法会优先查用这两份缓存，避免 N² 次 DOM 操作或 CFI 解析带来的性能瓶颈
 * - 同步任务完成后需调用 endEpubAnnotationSyncScope 释放，防止内存泄漏
 */
export function beginEpubAnnotationSyncScope(): void {
	// 初始化一个新的 CFI → Range 的映射缓存
	syncCfiRangeCache = new Map();
	// 初始化一个新的 CFI → 精确 client rects 的映射缓存
	syncAccurateClientRectCache = new Map();
}

/**
 * 结束 EPUB 批量注释同步时的缓存作用域
 *
 * 调用场景：
 * - 在同步/批处理高亮、注释、想法时，先 beginEpubAnnotationSyncScope() 启动缓存，
 *   同步过程结束后调用本方法清空缓存，避免 stale/内存泄漏。
 *
 * 实现说明：
 * - 将缓存分别置为 null（非 .clear()）有助于后续判定缓存作用域的启停，
 *   即：缓存生存期 = 不为 null 时启用，null 时禁用。
 * - 不做额外防御或副作用处理；纯粹依赖管理方按 begin/end 成对调用。
 */
export function endEpubAnnotationSyncScope(): void {
	// 清空 CFI 转 Range 的缓存，释放资源
	syncCfiRangeCache = null;
	// 清空精准 clientRect 缓存，防止内存泄漏
	syncAccurateClientRectCache = null;
}

/**
 * 获取（并缓存）Range 对应的精确 client rect 数组，用于“想法”高亮与划线重叠判定等场景的性能优化
 *
 * 实现要点与缓存策略说明：
 * - 在同步阶段（即批量注释/高亮等场景）syncAccurateClientRectCache 启用时，
 *   按传入 cfiKey 做 key，避免多次计算相同 Range 的精准几何信息
 * - 若缓存命中则直接复用结果（可能为 []，代表该 Range 无 rect；避免重复 DOM 查询）
 * - 若未命中则调用底层 getAccurateRangeLineClientRects 生成、缓存并返回
 * - 未启用缓存（平时操作）则始终实时计算，不做缓存
 *
 * @param cfiKey 当前 Range 所属唯一标识符（推荐 CFI 范围串），用作缓存 key
 * @param range  需获取 rects 的目标 Range；为 null 时直接返回空数组
 * @returns      表示 Range 上每条“分段线”的精准 DOMRect 数组（可用于绘制、碰撞判定等）
 */
export function getAccurateRangeLineClientRectsCached(
	cfiKey: string,
	range: Range | null,
): DOMRect[] {
	// 若 Range 为空，直接返回空数组，无需进一步处理
	if (!range) return [];
	// 判断当前是否启用批量同步缓存（优化性能，避免重复计算）
	if (syncAccurateClientRectCache) {
		// 检查当前 key 是否已有缓存命中
		const cached = syncAccurateClientRectCache.get(cfiKey);
		// 如已缓存，则直接复用
		if (cached) return cached;
		// 否则计算当前 Range 的精确 rect 列表
		const rects = getAccurateRangeLineClientRects(range);
		// 并将结果写入缓存，便于后续复用
		syncAccurateClientRectCache.set(cfiKey, rects);
		// 返回新计算的 rects
		return rects;
	}
	// 非同步缓存阶段，则每次都实时计算，直接返回
	return getAccurateRangeLineClientRects(range);
}

/**
 * 根据传入的 `range`，解析并返回其在当前 EPUB 渲染环境中的 CFI 范围字符串
 *
 * 实现思路：
 * 1. 首先对 range 进行归一化（标准化处理，确保用于生成 CFI 的 range 结构完整且准确）
 * 2. 获取 rend 的全部正文内容（EPUB 渲染的所有章节 iframe）
 * 3. 优先查找 window 匹配的 contents（即属于当前 iframe 的 contents），否则 fallback 到全部章节
 * 4. 遍历可选 chapters，尝试调用各自的 cfiFromRange，得到 range 对应的唯一 CFI 区间
 * 5. 如有章节能成功返回 cfi，则直接返回（首个命中的值）；全部失败则返回 undefined
 *
 * 适用场景：
 * - 高亮、注释、新建标记时，将用户选区转换为可持久化存储的 CFI 范围串
 *
 * @param rend epub.js 的 Rendition 对象，代表整个阅读器渲染状态
 * @param win  目标 range 所在 iframe 的 window 实例（可关联至具体章节）
 * @param range DOM Range 对象，表示用户当前选择的文本区间
 * @returns 返回 CFI 字符串（如解析不到则为 undefined）
 */
export function resolveSelectionCfiRange(
	rend: Rendition,
	win: Window,
	range: Range,
): string | undefined {
	// 对 range 结构做归一化，确保内部 text node/offset 合规
	const normalized = normalizeSelectionRangeForEpub(range);
	// 若归一化失败，则无法解析，直接返回 undefined
	if (!normalized) return undefined;

	// 获取当前 rendition 的全部内容实例（即所有章节的 contents）
	const raw = rend.getContents();
	// 整理为数组结构，无论 raw 是单个 contents 还是数组
	const list: EpubIframeContents[] = Array.isArray(raw)
		? (raw as EpubIframeContents[])
		: raw
			? [raw as EpubIframeContents]
			: [];

	// 筛选出 window 匹配的 contents（即：查找所属目标 iframe 的章节）
	const matching = list.filter((c) => c.window === win);
	// 若有符合的，则只在该章节查找；否则 fallback 到全部章节轮询
	const candidates = matching.length > 0 ? matching : list;

	// 逐个章节尝试调用 cfiFromRange，将标准 range 转成 CFI
	for (const contents of candidates) {
		try {
			// 若当前 contents 能成功返回 CFI，直接返回该结果
			return contents.cfiFromRange(normalized, EPUB_ANNOTATION_IGNORE_CLASS);
		} catch {
			// 如果本章节报错，继续尝试下一个章节/iframe
		}
	}
	// 若所有章节都无法解析，则返回 undefined（找不到有效 CFI）
	return undefined;
}

/**
 * 通过 cfiRange 定位并解析出对应的 DOM Range 区间
 * - 内部支持用 syncCfiRangeCache 做缓存，加速高频查找
 * - 先查缓存有无，如果已缓存则直接返回
 * - 否则尝试解析并写入缓存，最后返回解析结果
 * - 若缓存未启用，则直接走 uncached 逻辑
 * @param rend Rendition 实例（epubjs 渲染器）
 * @param cfiRange EPUB 的 CFI 字符串，标识具体文本区间
 * @returns 对应的 Range 对象，若无法解析则为 null
 */
export function resolveCfiDomRange(
	rend: Rendition,
	cfiRange: string,
): Range | null {
	// 去掉 CFI 字符串首尾空白，避免意外缓存 key 失效
	const key = cfiRange.trim();

	// 若当前在 annotation sync 阶段且有缓存
	if (syncCfiRangeCache && key) {
		// 查找缓存，命中直接返回缓存结果（可能为 null：显式表明“解析失败”也会缓存）
		if (syncCfiRangeCache.has(key)) {
			return syncCfiRangeCache.get(key) ?? null;
		}
		// 未命中缓存时解析，解析结果也写入缓存（容错：解析失败也缓存 null，避免重复尝试）
		const resolved = resolveCfiDomRangeUncached(rend, key);
		syncCfiRangeCache.set(key, resolved);
		return resolved;
	}
	// 非 sync 阶段跳过缓存，直接走 uncached 解析
	return resolveCfiDomRangeUncached(rend, cfiRange);
}

/**
 * 尝试通过 cfiRange（EPUB 定位字符串）解析得到对应的 DOM Range 区间
 * - 优先尝试直接通过 Rendition 实例的 getRange 方法解析
 * - 若 Rendition 级别解析失败，则遍历所有 iframe contents（多页/多章节），分别尝试解析
 * - 均失败时返回 null，表示未找到对应区间
 *
 * @param rend     EPUB.js 的 Rendition 实例，主控阅读器渲染
 * @param cfiRange EPUB 的 CFI 字符串，标识特定文本区间
 * @returns        解析成功则为该区间对应的 Range 对象，失败则为 null
 */
function resolveCfiDomRangeUncached(
	rend: Rendition,
	cfiRange: string,
): Range | null {
	// 首先尝试直接调用 Rendition 实例自带的 getRange（如存在）
	try {
		const range = (
			rend as Rendition & {
				getRange?: (cfi: string, ignoreClass?: string) => Range | null;
			}
		).getRange?.(cfiRange, EPUB_ANNOTATION_IGNORE_CLASS);
		// 若能正确解析并返回 Range，则直接返回
		if (range) return range;
	} catch {
		// 捕获并忽略 getRange 过程中的异常（如参数不支持/环境缺实现等），继续后续流程
	}

	// 若 Rendition 无法直接解析，则遍历所有 iframe contents 逐一尝试
	for (const contents of getRenditionContentsList(rend)) {
		try {
			const range = (
				contents as EpubIframeContents & {
					range?: (cfi: string, ignoreClass?: string) => Range | null;
				}
			).range?.(cfiRange, EPUB_ANNOTATION_IGNORE_CLASS);
			// 若当前章节 iframe 能正确解析出 Range，则立即返回
			if (range) return range;
		} catch {
			// 若该章节解析报错则自动跳过，继续尝试下一个 iframe
		}
	}
	// 所有可用方法均无法解析，返回 null 代表失败
	return null;
}

/**
 * 根据传入的 DOM Range，尝试在 EPUB Rendition 实例下生成对应的 CFI（EPUB 位置标识字符串）
 *
 * 工作原理：
 * - 通过 Range 的 startContainer 推断当前选区属于哪个 iframe（contents）
 * - 遍历当前 Rendition 所有内容窗口（每个章节/分页会对应不同的 iframe）
 * - 定位到目标 Range 所属的 document 后，调用该 iframe 提供的 cfiFromRange 方法返回 CFI
 * - 若无法找到或转换失败，则返回 undefined
 *
 * 应用场景：
 * - 标注、高亮、批注或跳转功能，需要用 CFI 持久化记录/复用选区位置
 *
 * @param rend EPUB.js 的 Rendition 实例（主阅读器对象）
 * @param range 选区的 DOM Range 对象（需生成对应 CFI 的区间）
 * @returns 匹配成功时返回对应的 CFI 字符串，失败返回 undefined
 */
export function cfiFromDomRange(
	rend: Rendition,
	range: Range,
): string | undefined {
	// 通过 Range 起点节点获取所属 document（对应具体 content iframe）
	const doc = range.startContainer.ownerDocument;
	// 若意外未找到 document（理论极少发生），视为无效，直接返回
	if (!doc) return undefined;

	// 遍历 Rendition 的所有内容窗口（章节 iframe 等）
	for (const contents of getRenditionContentsList(rend)) {
		// 只处理当前 Range 所在的 document，其他章节 iframe 跳过
		if (contents.document !== doc) continue;
		try {
			// 调用当前章节的 cfiFromRange 方法转为 CFI 字符串
			return contents.cfiFromRange(range, EPUB_ANNOTATION_IGNORE_CLASS);
		} catch {
			// 若转换失败（如方法缺失、参数异常等），忽略报错，继续尝试下一个 iframe
		}
	}
	// 若所有内容都未能成功转换，返回 undefined 标识失败
	return undefined;
}
