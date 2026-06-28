import type { Rendition } from 'epubjs';
import type {
	EbookThought,
	EbookThoughtClickCluster,
	EbookUserHighlight,
	EpubHighlightColorId,
	EpubHighlightStyle,
} from '../../../types';
import {
	buildEpubPopBarPayloadFromCfiRange,
	type EpubSelectionPopBarPayload,
	suppressEpubSelectionPopBarDismiss,
} from '../reader/epubSelectionToolbarAttach';
import {
	extractCfiSpineHint,
	getRenditionContentsList,
	isDomRangeOverlapping,
	isDomRangeStrictlyContained,
	isDomRangeTouchingOrOverlapping,
	isQuoteStrictlyNested,
	setSvgAttrIfChanged,
} from './epubMarkShared';
import {
	beginEpubAnnotationSyncScope,
	cfiFromDomRange,
	EPUB_ANNOTATION_IGNORE_CLASS,
	endEpubAnnotationSyncScope,
	forEachTextNodeInRange,
	getAccurateRangeLineClientRects,
	getAccurateRangeLineClientRectsCached,
	isPointInRangeTextBand,
	parseSvgMarkRect,
	resolveCfiDomRange,
	resolveMarkSvgLineSegments,
	type SvgLineSegment,
	snapSelectionRangeToTextContent,
	trimSelectionRange,
} from './epubRangeGeometry';
import {
	applyEpubThoughtUnderlines,
	hasTextSelectionInRend,
	patchEpubThoughtUnderlineMarks,
	restackThoughtMarkGroups,
	setUserHighlightBlockerSourcesForThoughtPatch,
	type UserHighlightBlockerSource,
} from './epubThoughtAnnotations';
import {
	buildThoughtClickClusterFromCandidates,
	expandClusterFromMarkSeed,
} from './epubThoughtCluster';

type EpubIframeContents = {
	document: Document;
	window: Window;
};

export const EPUB_USER_HIGHLIGHT_CLASS = 'moke-epub-user-hl';

const STYLE_ID = 'moke-epub-user-hl-styles';
const DATA_STYLE = 'hlStyle';
const DATA_COLOR = 'hlColor';

export const EPUB_HIGHLIGHT_COLOR_OPTIONS: {
	id: EpubHighlightColorId;
	fill: string;
	stroke: string;
}[] = [
	// fill 仅用于背景高亮；保持原色相，降低透明度以免压住正文
	{ id: 'pink', fill: 'rgba(255, 107, 129, 0.28)', stroke: '#ff6b81' },
	{ id: 'purple', fill: 'rgba(155, 89, 182, 0.28)', stroke: '#9b59b6' },
	{ id: 'blue', fill: 'rgba(52, 152, 219, 0.28)', stroke: '#3498db' },
	{ id: 'green', fill: 'rgba(46, 204, 113, 0.28)', stroke: '#2ecc71' },
	{ id: 'yellow', fill: 'rgba(241, 196, 15, 0.32)', stroke: '#f1c40f' },
];

const COLOR_BY_ID = Object.fromEntries(
	EPUB_HIGHLIGHT_COLOR_OPTIONS.map((item) => [item.id, item]),
) as Record<
	EpubHighlightColorId,
	(typeof EPUB_HIGHLIGHT_COLOR_OPTIONS)[number]
>;

const UNDERLINE_OFFSET_PX = 2;
const MIN_USER_HIGHLIGHT_BLOCKER_PX = 2;
const WAVY_PATH_CLASS = 'moke-epub-user-hl-wave';
/** 一个完整波浪周期约等于一字宽（典型 EPUB 正文字号） */
const WAVY_WAVELENGTH_PX = 16;
const WAVY_AMPLITUDE_PX = 1.2;
const WAVY_SAMPLE_STEP_PX = 2;

/**
 * 沿 baseline 生成平滑正弦波浪下划线路径
 * @param startX 波浪线起点的 X 坐标（SVG 坐标系）
 * @param baseY  波浪线基线的 Y 坐标（SVG 坐标系，通常为行底部）
 * @param width  波浪线的总长度（即高亮文本宽度）
 * @returns      符合 SVG <path> d 属性规范的路径字符串
 *
 * 实现思路：
 * - 若宽度 width 非正，直接返回空字符串
 * - 路径起点先定位到 (startX, baseY)
 * - 按 WAVY_SAMPLE_STEP_PX 为采样步长，基于正弦函数周期平滑生成若干采样点
 * - 每一采样点都通过 L 指令连接到下一个波峰/波谷
 * - 波浪幅度 WAVY_AMPLITUDE_PX，周期 WAVY_WAVELENGTH_PX
 * - 最后一段若不是整步，则补一段精确到终点
 */
function buildWavyUnderlinePath(
	startX: number,
	baseY: number,
	width: number,
): string {
	// 若宽度为 0 或负数，不生成任何路径
	if (width <= 0) return '';
	// 起始路径：移动到起点 (startX, baseY)
	let d = `M ${startX} ${baseY}`;
	// 从起点累加 offset，按固定采样步长绘制每个波浪折线段
	for (
		let offset = WAVY_SAMPLE_STEP_PX;
		offset <= width;
		offset += WAVY_SAMPLE_STEP_PX
	) {
		// y = baseY + 振幅 * 正弦相位
		const y =
			baseY +
			WAVY_AMPLITUDE_PX * Math.sin((2 * Math.PI * offset) / WAVY_WAVELENGTH_PX);
		// 跳到 (startX + offset, y) 形成波浪
		d += ` L ${startX + offset} ${y}`;
	}
	// 处理最后一个不满整数采样步长的尾部（避免丢失残余段）
	const tail = width % WAVY_SAMPLE_STEP_PX;
	if (tail > 0.01) {
		// 终点 Y 坐标同理：根据 width 计算正弦相位
		const y =
			baseY +
			WAVY_AMPLITUDE_PX * Math.sin((2 * Math.PI * width) / WAVY_WAVELENGTH_PX);
		// 连线到最后终点
		d += ` L ${startX + width} ${y}`;
	}
	// 返回完整 SVG path d 字符串，可供 <path d={...} /> 渲染
	return d;
}

/** apply 时写入，供 patch 按 CFI 读取样式/颜色 */
let highlightMetaByCfi = new Map<string, EbookUserHighlight>();

const USER_HIGHLIGHT_SELECTOR = `g.${EPUB_USER_HIGHLIGHT_CLASS}, g[ref="${EPUB_USER_HIGHLIGHT_CLASS}"], g[ref*="${EPUB_USER_HIGHLIGHT_CLASS}"], g[class*="${EPUB_USER_HIGHLIGHT_CLASS}"]`;

/** 遍历当前 Rendition 下所有含用户划线 mark 的文档（包括主文档和各 EPUB iframe） */
function iterHighlightDocuments(rend: Rendition): Document[] {
	// 初始化文档集合，主页面 document 总是在内
	const docs = new Set<Document>([document]);
	// 遍历 rendition 的所有子内容（通常为每个 EPUB 页面对应的 iframe）
	for (const contents of getRenditionContentsList(rend)) {
		// 若有有效文档（内容尚在 DOM 中未被销毁），则加入集合
		if (contents.document) docs.add(contents.document);
	}
	// 转换为数组返回，确保每个文档独立、无重复
	return [...docs];
}

/**
 * 检查当前 renditon 中的某个 CFI 是否已存在对应的用户划线 mark
 * @param rend 当前电子书 rendition 实例
 * @param cfiRange 用户划线对应的 epubcfi 字符串（唯一定位标注）
 * @returns 是否存在对应 DOM mark
 */
function isUserHighlightMarkPresent(
	rend: Rendition,
	cfiRange: string,
): boolean {
	// 规范化 CFI（去除空白，避免因格式不一致匹配失败）
	const cfi = cfiRange.trim();
	// 若无有效 CFI，则视为不存在
	if (!cfi) return false;
	// 遍历所有相关文档（主文档+每个阅读 iframe 文档）
	for (const doc of iterHighlightDocuments(rend)) {
		// 查找所有可能的用户划线分组（用于 highlight mark 聚合，class/ref 等 selector）
		for (const group of doc.querySelectorAll(USER_HIGHLIGHT_SELECTOR)) {
			// 判断该 mark 是否与目标 CFI 匹配，dataset.epubcfi 标识对应 mark
			if ((group as SVGElement).dataset.epubcfi?.trim() === cfi) {
				// 找到即返回 true
				return true;
			}
		}
	}
	// 未找到任何匹配 mark
	return false;
}

/**
 * 直接移除 DOM 上与指定 CFI 匹配的所有用户划线 mark 分组
 * 用途：epub.js removeHighlight 漏删孤儿 mark 时补救——确保不会残留无主划线 mark
 * @param rend 当前电子书 rendition 实例，用于获取所有相关文档（主文档和各 iframe 子文档）
 * @param cfiRange 目标用户划线的 epubcfi 字符串（唯一定位标注，需与 mark dataset.epubcfi 一致）
 */
function removeUserHighlightMarkGroupsByCfi(
	rend: Rendition, // 电子书渲染上下文，用于查找所有主/子文档
	cfiRange: string, // 需移除的用户划线 CFI（如未传/空字符串则直接跳过）
): void {
	// 去除 CFI 首尾空白，统一格式，避免因前后多余空格导致无法匹配
	const cfi = cfiRange.trim();
	// 若未提供有效 CFI，直接返回，无需处理（防止误删全部划线 mark）
	if (!cfi) return;
	// 遍历当前 rendition 管理下的所有文档实例（主页面及所有 epub 的 iframe 子页面）
	for (const doc of iterHighlightDocuments(rend)) {
		// 在当前文档内查找所有用户划线分组（如 <g class="moke-epub-user-highlight-mark"> ... </g>）
		doc.querySelectorAll(USER_HIGHLIGHT_SELECTOR).forEach((group) => {
			// 取出 mark 分组上的 epubcfi 标识（唯一定位），去除空白再做比对
			if ((group as SVGElement).dataset.epubcfi?.trim() === cfi) {
				// 若该 mark 的 CFI 与目标一致，则从 DOM 树移除当前分组节点（彻底清理，不留空壳）
				group.remove();
			}
		});
	}
}

/**
 * 清理不在 keepCfis 内的孤儿 mark，并对同一 CFI 去重
 *
 * 作用：
 * 1. 删除所有不在 keepCfis 列表中的用户划线 mark 分组（即渲染层无配对数据的残留 DOM 元素，确保 DOM 状态与 highlight 数据一致，防止“孤儿”划线导致表现异常）。
 * 2. 对每个 CFI 保留至多一个 mark 分组（如果因渲染或旧残留出现同一 CFI 多 mark，去重只留第一个，避免叠加闪烁或点击异常）。
 *
 * @param rend       当前电子书 rendition 实例，迭代主文档与所有 iframe 子文档以遍历全部 mark 元素。
 * @param keepCfis   Set<string>，仅保留的有效 CFI 集合。只有在该集合内的 mark 会被保留，其余全部清理。
 */
function reconcileUserHighlightMarkDom(
	rend: Rendition,
	keepCfis: Set<string>,
): void {
	// 遍历当前电子书渲染上下文包含的所有文档（主文档以及每个章节/分页的 iframe 子文档）
	for (const doc of iterHighlightDocuments(rend)) {
		// 构建一个 Map：以 CFI 为键，记录每个 CFI 在文档下出现的所有 mark 分组数组
		const byCfi = new Map<string, Element[]>();
		// 查找该文档下的所有用户高亮 mark 分组（<g class="...">）
		doc.querySelectorAll(USER_HIGHLIGHT_SELECTOR).forEach((group) => {
			// 取出当前分组上的 CFI 属性、去除空白
			const cfi = (group as SVGElement).dataset.epubcfi?.trim() ?? '';
			// 没有有效 CFI（如 DOM 脏数据、结构异常等），直接删除该节点
			if (!cfi) {
				group.remove();
				return;
			}
			// 按 cfi 收集所有分组
			const list = byCfi.get(cfi) ?? [];
			list.push(group);
			byCfi.set(cfi, list);
		});
		// 遍历 Map 的每一组（每组同一 CFI 的所有分组）
		for (const [cfi, groups] of byCfi) {
			// 若当前 cfi 不在应保留集合内，则其所有分组均为“孤儿”，全部删除
			if (!keepCfis.has(cfi)) {
				groups.forEach((g) => {
					g.remove();
				});
				continue;
			}
			// 否则属于合法高亮，只保留第 0 个，其余 mark 为重复冗余，逐个删除
			for (let i = 1; i < groups.length; i += 1) {
				groups[i]!.remove();
			}
		}
	}
}

/**
 * 确保用户高亮（划线）SVG 样式已注入当前文档（用于规范高亮的外观风格，保证一致渲染体验）。
 *
 * - 作用：
 *   1. 仅为用户划线相关 SVG 元素注入特殊样式，防止 EPUB 内嵌样式或第三方 CSS 干扰表现。
 *   2. 标准化 rect、line、wavy path 线型形态（如透明描边/圆角/无填充/平滑连接）。
 * - 场景：
 *   - 主文档或每个章节 iframe 载入后调用，防止样式重复注入或遗漏。
 *
 * @param doc   当前操作的文档对象，默认为全局 document，也可传入分章节 iframe 的 document。
 */
function ensureUserHighlightStyles(doc: Document = document): void {
	// 取 head 节点。若无则取根元素（兼容部分旧式 EPUB）作为父节点
	const head = doc.head ?? doc.documentElement;
	// 若找不到可注入 style 的上级，直接退出
	if (!head) return;

	// 查询是否已存在指定 ID 的全局 style 节点，避免重复注入
	let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
	if (!style) {
		// 若未注入则新建 style 节点
		style = doc.createElement('style');
		style.id = STYLE_ID;
		head.appendChild(style);
	}

	// 注入/刷新用户高亮 SVG 样式表：
	// - <rect>: 隐藏描边（stroke），仅保留填充色（防止出现多余边框线，影响视觉一致性）
	// - <line>: 虚线两端采用圆角，保证收尾平滑
	// - <path .wavy>: 波浪线不填充，曲线连接圆滑自然
	style.textContent = `
${USER_HIGHLIGHT_SELECTOR} > rect {
	stroke: transparent !important;
	stroke-width: 0 !important;
}
${USER_HIGHLIGHT_SELECTOR} > line {
	stroke-linecap: round !important;
}
${USER_HIGHLIGHT_SELECTOR} > path.${WAVY_PATH_CLASS} {
	fill: none !important;
	stroke-linecap: round !important;
	stroke-linejoin: round !important;
}
`;
}

function buildHighlightClassName(_item: EbookUserHighlight): string {
	return EPUB_USER_HIGHLIGHT_CLASS;
}

function resolveHighlightMetaFromGroup(
	g: Element,
	metaByCfi: Map<string, EbookUserHighlight>,
): { style: EpubHighlightStyle; color: EpubHighlightColorId } {
	const el = g as SVGElement;
	const cfi = el.dataset.epubcfi;
	const fromMap = cfi ? metaByCfi.get(cfi) : undefined;
	if (fromMap) {
		return { style: fromMap.style, color: fromMap.color };
	}
	return {
		style: (el.dataset[DATA_STYLE] ?? 'highlight') as EpubHighlightStyle,
		color: (el.dataset[DATA_COLOR] ?? 'pink') as EpubHighlightColorId,
	};
}

// 批量修补（刷新）所有用户高亮 SVG 分组的标注样式和内容
function patchUserHighlightMarks(
	root: ParentNode = document, // SVG 根节点，默认整个文档
	metaByCfi: Map<string, EbookUserHighlight> = highlightMetaByCfi, // CFI 到高亮元数据的映射，默认全局
	rend?: Rendition, // 可选：epubjs 的渲染实例
): void {
	// 查找该区域内所有高亮分组 <g class="epub-user-highlight">
	const groups = root.querySelectorAll(USER_HIGHLIGHT_SELECTOR);

	// 逐个高亮分组进行处理
	groups.forEach((g) => {
		const groupEl = g as SVGElement;
		// 解析当前分组的展示样式（高亮/下划线/波浪线）和颜色
		const { style, color: colorId } = resolveHighlightMetaFromGroup(
			g,
			metaByCfi,
		);
		const palette = COLOR_BY_ID[colorId] ?? COLOR_BY_ID.pink;
		// 禁用事件穿透到高亮层，避免高亮遮挡影响文本操作
		if (groupEl.style.pointerEvents !== 'none') {
			groupEl.style.pointerEvents = 'none';
		}

		// 当前分组关联的 epubcfi 标记，唯一定位
		const cfi = groupEl.dataset.epubcfi?.trim();
		// 获取该分组的所有线段坐标信息（每一行高亮的几何数据）
		const segments = resolveMarkSvgLineSegments(rend, groupEl, cfi);
		// 按行创建/同步高亮矩形（每段文本一块 rect）
		const rects = syncHighlightMarkRects(groupEl, segments);

		// 获取所有下划线/波浪线的 <line> 元素
		const lines = groupEl.querySelectorAll('line');

		// 样式：扁平高亮块（高亮黄/粉/绿等）
		if (style === 'highlight') {
			// 波浪线路径全部清除（高亮块无需 path 线）
			groupEl.querySelectorAll(`path.${WAVY_PATH_CLASS}`).forEach((node) => {
				node.remove();
			});
			// 下划线全部隐藏（透明），仅保留高亮块
			lines.forEach((line) => {
				setSvgAttrIfChanged(line, 'stroke', 'transparent');
				setSvgAttrIfChanged(line, 'stroke-opacity', '0');
			});
		}
		// 样式：普通下划线（直线模式，非波浪线）
		else if (style === 'underline') {
			// 下划线同样需要清除波浪线 path，避免叠加
			groupEl.querySelectorAll(`path.${WAVY_PATH_CLASS}`).forEach((node) => {
				node.remove();
			});
		}

		// 实时再获取所有 path.wavy 元素，用于波浪线处理
		const wavyPaths = groupEl.querySelectorAll(`path.${WAVY_PATH_CLASS}`);

		// 遍历每一个高亮“行”对应的矩形和线
		rects.forEach((rect, index) => {
			const segment = readHighlightSegment(rect, segments[index]);
			const { x, y, width, height } = segment;
			const lineY = y + height + UNDERLINE_OFFSET_PX; // 下划线 y 坐标，位于行底部下方

			// 普通高亮块：设置填充色、全不透明、无边框，直接返回
			if (style === 'highlight') {
				setSvgAttrIfChanged(rect, 'fill', palette.fill);
				setSvgAttrIfChanged(rect, 'fill-opacity', '1');
				setSvgAttrIfChanged(rect, 'stroke', 'transparent');
				setSvgAttrIfChanged(rect, 'stroke-width', '0');
				return;
			}

			// 其它类型统一做成透明块，无边框、填充透明色，用于承载“下划线”或“波浪线”
			setSvgAttrIfChanged(rect, 'stroke', 'transparent');
			setSvgAttrIfChanged(rect, 'stroke-width', '0');
			setSvgAttrIfChanged(rect, 'fill', 'currentColor');
			setSvgAttrIfChanged(rect, 'fill-opacity', '0.001');

			// 波浪线模式：为每块生成/更新 path 曲线路径
			if (style === 'wavy') {
				const line = lines[index] as SVGLineElement | undefined;
				if (line) {
					// 若有原线，强制隐藏（仅显示波浪线）
					setSvgAttrIfChanged(line, 'stroke', 'transparent');
					setSvgAttrIfChanged(line, 'stroke-opacity', '0');
				}

				// 获取本“行”已存在的 path 元素，若无则新建之
				let path = wavyPaths[index] as SVGPathElement | undefined;
				if (!path) {
					path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
					path.classList.add(WAVY_PATH_CLASS);
					groupEl.appendChild(path);
				}
				const geometryKey = `${x}|${lineY}|${width}`;
				// 仅在几何数据变化时重设路径
				if (path.dataset.geometryKey !== geometryKey) {
					path.dataset.geometryKey = geometryKey;
					path.setAttribute('d', buildWavyUnderlinePath(x, lineY, width));
				}
				setSvgAttrIfChanged(path, 'stroke', palette.stroke);
				setSvgAttrIfChanged(path, 'stroke-opacity', '0.95');
				setSvgAttrIfChanged(path, 'stroke-width', '1.5');
				setSvgAttrIfChanged(path, 'fill', 'none');
				return;
			}

			// 其它类型：“普通下划线”处理（非波浪线）
			let line = lines[index] as SVGLineElement | undefined;
			if (!line) {
				// 若无已有 line，动态插入新的 line 元素
				line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
				groupEl.appendChild(line);
			}

			// 仅当线的 geometry 发生变化时，才重设其坐标属性
			const x2 = x + width;
			const lineGeometryKey = `${x}|${x2}|${lineY}`;
			if (line.dataset.geometryKey !== lineGeometryKey) {
				line.dataset.geometryKey = lineGeometryKey;
				line.setAttribute('x1', String(x));
				line.setAttribute('x2', String(x2));
				line.setAttribute('y1', String(lineY));
				line.setAttribute('y2', String(lineY));
			}
			// 按高亮指定颜色渲染主下划线（圆角，实线，略带透明度，宽度 2px）
			setSvgAttrIfChanged(line, 'stroke', palette.stroke);
			setSvgAttrIfChanged(line, 'stroke-opacity', '0.95');
			setSvgAttrIfChanged(line, 'stroke-width', '2');
			setSvgAttrIfChanged(line, 'stroke-dasharray', 'none');
			setSvgAttrIfChanged(line, 'stroke-linecap', 'round');
		});

		// 若标注类型是波浪线，则多余的 path（大于高亮行数）需要移除
		if (style === 'wavy') {
			groupEl
				.querySelectorAll(`path.${WAVY_PATH_CLASS}`)
				.forEach((node, index) => {
					if (index >= rects.length) node.remove();
				});
		}

		// 多出来的 line（高亮行数少于原有线数量），全部设为透明隐藏
		for (let index = rects.length; index < lines.length; index++) {
			const line = lines[index] as SVGLineElement;
			setSvgAttrIfChanged(line, 'stroke', 'transparent');
			setSvgAttrIfChanged(line, 'stroke-opacity', '0');
		}
	});
}

/**
 * 从 SVG 高亮 rect 元素中读取其几何信息，返回作为线段段落（SvgLineSegment）对象。
 * - 若提供 fallback，则直接返回 fallback（覆盖 rect 读取，常用于无有效 rect 时的回退）。
 * - 否则依次读取 x/y/width/height 属性，不存在则默认为 0。
 *
 * @param rect     SVGRectElement，需要读取坐标和尺寸属性的高亮矩形
 * @param fallback 可选回退对象，若传入则优先直接返回
 * @returns        包含 x/y/width/height 坐标与尺寸的线段结构体
 */
function readHighlightSegment(
	rect: SVGRectElement,
	fallback?: SvgLineSegment,
): SvgLineSegment {
	// 若传入 fallback，则不用判断 rect 属性，直接返回 fallback
	if (fallback) return fallback;
	// 从 rect 属性提取 x/y/width/height，全部以浮点数返回，缺省为 0
	return {
		x: Number.parseFloat(rect.getAttribute('x') ?? '0'),
		y: Number.parseFloat(rect.getAttribute('y') ?? '0'),
		width: Number.parseFloat(rect.getAttribute('width') ?? '0'),
		height: Number.parseFloat(rect.getAttribute('height') ?? '0'),
	};
}

/**
 * 同步高亮分组 group 内的 <rect> 高亮块，确保和 segments 长度与位置完全一致。
 * - 若原有 rect 数量不足，则补充新 rect 元素节点到 group。
 * - 若原有 rect 数量多余，则多余的 rect 会被移除。
 * - 遍历 segments 并设置 rect 的 x/y/width/height 四个属性，始终保持与 segments 对齐。
 *
 * @param group    SVG <g> 高亮分组元素（作为 rect 容器）
 * @param segments 每一行文本高亮对应的几何信息数组（段落线段）
 * @returns        rects 处理后的 <rect> 节点数组，顺序与 segments 一致
 */
function syncHighlightMarkRects(
	group: SVGElement,
	segments: SvgLineSegment[],
): SVGRectElement[] {
	// 获取当前 group 下所有 rect 节点，并只保留 SVGRectElement 类型（防止有其它自定义节点）
	const existing = [...group.querySelectorAll('rect')].filter(
		(rect): rect is SVGRectElement => rect instanceof SVGRectElement,
	);

	// 若 segments 为空（无高亮行），直接返回现有 rects，无需更改
	if (segments.length === 0) {
		return existing;
	}

	const rects: SVGRectElement[] = [];

	// 遍历每个高亮行 segment，依次同步 rect 节点及其几何属性
	for (let index = 0; index < segments.length; index++) {
		// 当前高亮段的几何信息
		const segment = segments[index]!;
		// 如果已有 rect 节点则复用，否则新建
		let rect = existing[index];
		if (!rect) {
			// 不足时创建新的 <rect>，并插入 group（放在最前，避免后续节点遮盖）
			rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			group.insertBefore(rect, group.firstChild);
		}
		// 更新/设定 rect 的 x/y/width/height 属性
		setSvgAttrIfChanged(rect, 'x', String(segment.x));
		setSvgAttrIfChanged(rect, 'y', String(segment.y));
		setSvgAttrIfChanged(rect, 'width', String(segment.width));
		setSvgAttrIfChanged(rect, 'height', String(segment.height));
		rects.push(rect);
	}

	// 多出来的旧 rects（比 segments 多），全部移除
	for (let index = segments.length; index < existing.length; index++) {
		existing[index]?.remove();
	}

	// 返回所有与 segments 对齐的新 rects
	return rects;
}

function patchAllUserHighlightMarks(rend?: Rendition): void {
	const meta = highlightMetaByCfi;
	const docs = new Set<Document>([document]);
	for (const contents of getRenditionContentsList(rend)) {
		if (contents.document) docs.add(contents.document);
	}
	for (const doc of docs) {
		try {
			ensureUserHighlightStyles(doc);
			patchUserHighlightMarks(doc, meta, rend);
		} catch {
			// iframe 卸载时忽略
		}
	}
}

function buildHighlightStyles(
	item: EbookUserHighlight,
): Record<string, string> {
	const palette = COLOR_BY_ID[item.color] ?? COLOR_BY_ID.pink;
	if (item.style === 'highlight') {
		return {
			fill: palette.fill,
			'fill-opacity': '1',
			stroke: 'transparent',
			'stroke-width': '0',
			'mix-blend-mode': 'normal',
		};
	}
	return {
		stroke: palette.stroke,
		'stroke-opacity': '0.95',
		'stroke-width': '2',
		'stroke-dasharray': 'none',
		'mix-blend-mode': 'normal',
	};
}

function buildHighlightData(item: EbookUserHighlight): Record<string, string> {
	return {
		highlightId: item.id,
		[DATA_STYLE]: item.style,
		[DATA_COLOR]: item.color,
	};
}

/** apply 时注入，供 annotation cb 与 iframe 正文点击共用 */
let userHighlightClickRouter: ((highlight: EbookUserHighlight) => void) | null =
	null;

function buildUserHighlightClickHandler(item: EbookUserHighlight): () => void {
	return () => {
		userHighlightClickRouter?.(item);
	};
}

type ContentsWithCfi = EpubIframeContents & {
	cfiFromRange: (range: Range, ignoreClass?: string) => string;
};

function isClickRangeInsideHighlight(
	clickRange: Range,
	highlightRange: Range,
): boolean {
	try {
		return (
			highlightRange.compareBoundaryPoints(Range.START_TO_START, clickRange) <=
				0 &&
			highlightRange.compareBoundaryPoints(Range.END_TO_END, clickRange) >= 0
		);
	} catch {
		return false;
	}
}

type ContentsWithRange = EpubIframeContents & {
	range: (cfi: string) => Range | null;
};

function isCfiResolvedRangeWithinHighlight(
	rend: Rendition,
	pointCfi: string,
	highlight: EbookUserHighlight,
	doc?: Document,
): boolean {
	const outerRange = resolveCfiDomRange(rend, highlight.cfiRange);
	if (!outerRange) return false;
	if (doc && outerRange.startContainer.ownerDocument !== doc) return false;

	const raw = rend.getContents();
	const list: ContentsWithRange[] = Array.isArray(raw)
		? (raw as ContentsWithRange[])
		: raw
			? [raw as ContentsWithRange]
			: [];

	for (const contents of list) {
		if (doc && contents.document !== doc) continue;
		try {
			const pointRange = contents.range?.(pointCfi);
			if (pointRange && isClickRangeInsideHighlight(pointRange, outerRange)) {
				return true;
			}
		} catch {
			// ignore
		}
	}
	return false;
}

type ReaderClickPoint = {
	document: Document;
	clientX: number;
	clientY: number;
	at: number;
};

let lastReaderClickPoint: ReaderClickPoint | null = null;

function rememberReaderClickPoint(
	doc: Document,
	clientX: number,
	clientY: number,
): void {
	lastReaderClickPoint = { document: doc, clientX, clientY, at: Date.now() };
}

function getContentsWithCfiForDocument(
	rend: Rendition,
	doc: Document,
): ContentsWithCfi | null {
	const raw = rend.getContents();
	const list: ContentsWithCfi[] = Array.isArray(raw)
		? (raw as ContentsWithCfi[])
		: raw
			? [raw as ContentsWithCfi]
			: [];
	return list.find((item) => item.document === doc) ?? null;
}

function caretRangeFromPoint(
	doc: Document,
	x: number,
	y: number,
): Range | null {
	if (doc.caretRangeFromPoint) {
		return doc.caretRangeFromPoint(x, y);
	}
	const docWithCaret = doc as Document & {
		caretPositionFromPoint?: (
			px: number,
			py: number,
		) => { offsetNode: Node; offset: number } | null;
	};
	const pos = docWithCaret.caretPositionFromPoint?.(x, y);
	if (!pos) return null;
	const range = doc.createRange();
	range.setStart(pos.offsetNode, pos.offset);
	range.collapse(true);
	return range;
}

/** 点击是否落在划线正文行内（限制行高向下延伸的空白；用文本片段 rect 避免行尾空白） */
function isPointInHighlightTextBand(
	range: Range,
	iframe: Element | null,
	clientX: number,
	clientY: number,
	maxBelowPx: number,
): boolean {
	return isPointInRangeTextBand(range, iframe, clientX, clientY, maxBelowPx);
}

function highlightClickSlopBelow(item: EbookUserHighlight): number {
	if (item.style === 'underline' || item.style === 'wavy') return 8;
	return 2;
}

function isHighlightHitAtClickPoint(
	rend: Rendition,
	contents: ContentsWithCfi,
	clientX: number,
	clientY: number,
	highlight: EbookUserHighlight,
): boolean {
	const iframe = contents.window.frameElement;

	const highlightRange = resolveCfiDomRange(rend, highlight.cfiRange);
	if (
		!highlightRange ||
		highlightRange.startContainer.ownerDocument !== contents.document
	) {
		return false;
	}

	const slop = highlightClickSlopBelow(highlight);
	if (
		!isPointInHighlightTextBand(highlightRange, iframe, clientX, clientY, slop)
	) {
		return false;
	}

	const clickRange = caretRangeFromPoint(contents.document, clientX, clientY);
	if (!clickRange) return false;

	try {
		return isClickRangeInsideHighlight(clickRange, highlightRange);
	} catch {
		return false;
	}
}

function isHighlightHitAtRecentClick(
	rend: Rendition,
	highlight: EbookUserHighlight,
): boolean {
	const click = lastReaderClickPoint;
	if (!click || Date.now() - click.at > 800) return false;
	const contents = getContentsWithCfiForDocument(rend, click.document);
	if (!contents) return false;
	return isHighlightHitAtClickPoint(
		rend,
		contents,
		click.clientX,
		click.clientY,
		highlight,
	);
}

/** 仅当点击落在划线正文 DOM 区域内才命中（不用 SVG mark 行高） */
function findUserHighlightAtClickPoint(
	rend: Rendition,
	contents: ContentsWithCfi,
	clientX: number,
	clientY: number,
	highlights: EbookUserHighlight[],
): EbookUserHighlight | null {
	const iframe = contents.window.frameElement;
	if (!iframe) return null;

	const matched = highlights.filter((highlight) =>
		isHighlightHitAtClickPoint(rend, contents, clientX, clientY, highlight),
	);
	if (matched.length === 0) return null;

	return sortHighlightsForStack(matched).at(-1) ?? matched[0] ?? null;
}

/**
 * iframe 内 click：仅正文 DOM 命中，markClicked 路径需配合 mousedown 坐标校验。
 */
function attachUserHighlightReaderClickListener(
	rend: Rendition,
	getHighlights: () => EbookUserHighlight[],
	getThoughts: () => EbookThought[],
	onThoughtClusterClick: (cluster: EbookThoughtClickCluster) => void,
	onHighlightHit: (
		highlight: EbookUserHighlight,
		anchor?: HighlightHitAnchor,
	) => void,
): () => void {
	const cleanups = new Map<Document, () => void>();

	const dispatch = (event: MouseEvent, contents: ContentsWithCfi) => {
		if (event.button !== 0 || event.defaultPrevented) return;
		if (hasTextSelectionInRend(rend)) return;

		rememberReaderClickPoint(contents.document, event.clientX, event.clientY);

		const thoughts = getThoughts();
		const thoughtCandidates = findThoughtsAtClickPoint(
			rend,
			contents,
			event.clientX,
			event.clientY,
			thoughts,
		);
		if (thoughtCandidates.length > 0) {
			scheduleThoughtClusterClick(
				rend,
				thoughts,
				thoughtCandidates,
				false,
				onThoughtClusterClick,
			);
			return;
		}

		const highlights = getHighlights();
		if (highlights.length === 0) return;

		const hit = findUserHighlightAtClickPoint(
			rend,
			contents,
			event.clientX,
			event.clientY,
			highlights,
		);
		if (!hit) return;

		onHighlightHit(hit, {
			clientX: event.clientX,
			clientY: event.clientY,
			contents,
		});
	};

	const bindContents = (contents: EpubIframeContents) => {
		if (cleanups.has(contents.document)) return;
		const doc = contents.document;
		const contentsWithCfi = contents as ContentsWithCfi;

		const onClick = (e: MouseEvent) => dispatch(e, contentsWithCfi);
		const onMouseDown = (e: MouseEvent) => {
			if (e.button !== 0) return;
			rememberReaderClickPoint(doc, e.clientX, e.clientY);
		};

		doc.addEventListener('mousedown', onMouseDown, true);
		doc.addEventListener('click', onClick, false);

		cleanups.set(contents.document, () => {
			doc.removeEventListener('mousedown', onMouseDown, true);
			doc.removeEventListener('click', onClick, false);
		});
	};

	rend.hooks.content.register(bindContents);
	const existing = rend.getContents();
	if (Array.isArray(existing)) {
		for (const item of existing) bindContents(item as EpubIframeContents);
	} else if (existing) {
		bindContents(existing as EpubIframeContents);
	}

	return () => {
		try {
			rend.hooks.content.deregister(bindContents);
		} catch {
			// ignore
		}
		for (const fn of cleanups.values()) fn();
		cleanups.clear();
	};
}

function highlightSpanLength(item: EbookUserHighlight): number {
	const quote = item.quote?.trim();
	if (quote && quote.length > 0) return quote.length;
	return item.cfiRange.length;
}

/** 判断 inner 划线是否被 outer 严格包含（对齐想法下划线的嵌套判定） */
export function isHighlightCfiStrictlyContained(
	inner: Pick<EbookUserHighlight, 'cfiRange' | 'quote'>,
	outer: Pick<EbookUserHighlight, 'cfiRange' | 'quote'>,
	rend?: Rendition,
): boolean {
	const innerCfi = inner.cfiRange.trim();
	const outerCfi = outer.cfiRange.trim();
	if (!innerCfi || !outerCfi || innerCfi === outerCfi) return false;

	if (rend) {
		const innerRange = resolveCfiDomRange(rend, innerCfi);
		const outerRange = resolveCfiDomRange(rend, outerCfi);
		if (innerRange && outerRange) {
			return isDomRangeStrictlyContained(innerRange, outerRange);
		}
	}

	const innerQuote = inner.quote?.trim() ?? '';
	const outerQuote = outer.quote?.trim() ?? '';
	if (!isQuoteStrictlyNested(innerQuote, outerQuote)) return false;
	return extractCfiSpineHint(innerCfi) === extractCfiSpineHint(outerCfi);
}

/** 计算应绘制可见样式的划线 CFI（被更大选区严格包含的内层不绘制） */
export function computeVisibleHighlightCfis(
	highlights: EbookUserHighlight[],
	rend: Rendition,
): Set<string> {
	const visible = new Set<string>();
	for (const item of highlights) {
		const cfi = item.cfiRange.trim();
		if (!cfi) continue;
		const contained = highlights.some(
			(other) =>
				other.cfiRange.trim() !== cfi &&
				isHighlightCfiStrictlyContained(item, other, rend),
		);
		if (!contained) visible.add(cfi);
	}
	return visible;
}

/** 找出被新选区严格包含、应被后续划线取代的旧划线（持久化层清理用） */
export function findHighlightsStrictlyContainedIn(
	outer: Pick<EbookUserHighlight, 'cfiRange' | 'quote'>,
	highlights: EbookUserHighlight[],
): EbookUserHighlight[] {
	const outerCfi = outer.cfiRange.trim();
	return highlights.filter(
		(item) =>
			item.cfiRange.trim() !== outerCfi &&
			isHighlightCfiStrictlyContained(item, outer),
	);
}

function sortHighlightsForStack(
	highlights: EbookUserHighlight[],
): EbookUserHighlight[] {
	return [...highlights].sort((a, b) => {
		const spanDiff = highlightSpanLength(b) - highlightSpanLength(a);
		if (spanDiff !== 0) return spanDiff;
		return a.cfiRange.length - b.cfiRange.length;
	});
}

function buildHighlightApplySignature(item: EbookUserHighlight): string {
	return `${item.style}|${item.color}|${item.id}`;
}

type HighlightRenderPlan = {
	coalesced: EbookUserHighlight[];
	visibleCfis: Set<string>;
	sortedHighlights: EbookUserHighlight[];
	keepCfis: Set<string>;
};

function buildHighlightRenderPlan(
	rend: Rendition,
	highlights: EbookUserHighlight[],
): HighlightRenderPlan {
	const coalesced = coalesceOverlappingHighlightsForRender(rend, highlights);
	const visibleCfis = computeVisibleHighlightCfis(coalesced, rend);
	const sortedHighlights = sortHighlightsForStack(coalesced);
	const keepCfis = new Set(
		sortedHighlights
			.filter((item) => visibleCfis.has(item.cfiRange))
			.map((item) => item.cfiRange),
	);
	return { coalesced, visibleCfis, sortedHighlights, keepCfis };
}

function purgeStaleUserHighlightAnnotations(
	rend: Rendition,
	rawHighlights: EbookUserHighlight[],
	visibleCfis: Set<string>,
	appliedRef: Map<string, string>,
): void {
	const keepCfis = new Set(
		[...visibleCfis].filter((cfi) => cfi.trim().length > 0),
	);

	for (const item of rawHighlights) {
		const cfi = item.cfiRange.trim();
		if (!cfi || keepCfis.has(cfi)) continue;
		removeUserHighlightAnnotation(rend, cfi, appliedRef);
	}

	for (const cfiRange of [...appliedRef.keys()]) {
		if (!keepCfis.has(cfiRange)) {
			removeUserHighlightAnnotation(rend, cfiRange, appliedRef);
		}
	}

	reconcileUserHighlightMarkDom(rend, keepCfis);
}

export function applyEpubUserHighlights(
	rend: Rendition,
	highlights: EbookUserHighlight[],
	appliedRef: Map<string, string>,
	plan?: HighlightRenderPlan,
): void {
	try {
		ensureUserHighlightStyles();
	} catch {
		return;
	}

	const renderPlan = plan ?? buildHighlightRenderPlan(rend, highlights);
	const { visibleCfis, sortedHighlights, keepCfis } = renderPlan;

	highlightMetaByCfi = new Map(
		sortedHighlights
			.filter((item) => visibleCfis.has(item.cfiRange))
			.map((item) => [item.cfiRange, item]),
	);

	purgeStaleUserHighlightAnnotations(rend, highlights, keepCfis, appliedRef);

	for (const item of sortedHighlights) {
		if (!visibleCfis.has(item.cfiRange)) continue;

		const nextSig = buildHighlightApplySignature(item);
		if (
			appliedRef.get(item.cfiRange) === nextSig &&
			isUserHighlightMarkPresent(rend, item.cfiRange)
		) {
			continue;
		}

		removeUserHighlightAnnotation(rend, item.cfiRange, appliedRef);
		try {
			// 统一 highlight 类型，与想法 underline 批注槽位分离；点击走 markClicked + iframe click
			rend.annotations.highlight(
				item.cfiRange,
				buildHighlightData(item),
				buildUserHighlightClickHandler(item),
				buildHighlightClassName(item),
				buildHighlightStyles(item),
			);
			appliedRef.set(item.cfiRange, nextSig);
		} catch {
			appliedRef.delete(item.cfiRange);
		}
	}
}

function removeUserHighlightAnnotation(
	rend: Rendition,
	cfiRange: string,
	appliedRef: Map<string, string>,
): void {
	try {
		// 用户划线统一用 highlight 类型，避免 remove(underline) 误删想法虚线
		rend.annotations.remove(cfiRange, 'highlight');
	} catch {
		// ignore
	}
	removeUserHighlightMarkGroupsByCfi(rend, cfiRange);
	appliedRef.delete(cfiRange);
}

export function teardownAppliedUserHighlights(
	rend: Rendition,
	appliedRef: Map<string, string>,
): void {
	for (const cfiRange of [...appliedRef.keys()]) {
		removeUserHighlightAnnotation(rend, cfiRange, appliedRef);
	}
	appliedRef.clear();
}

export function invalidateAppliedUserHighlightsMissingDom(
	rend: Rendition,
	appliedRef: Map<string, string>,
): void {
	for (const cfi of [...appliedRef.keys()]) {
		if (!isUserHighlightMarkPresent(rend, cfi)) {
			appliedRef.delete(cfi);
		}
	}
}

export function findUserHighlightByCfi(
	highlights: EbookUserHighlight[],
	cfiRange?: string,
): EbookUserHighlight | undefined {
	if (!cfiRange) return undefined;
	return highlights.find((item) => item.cfiRange === cfiRange);
}

/**
 * 侧栏/想法引用是否被某条划线覆盖。
 * 与 PopBar 一致：有 rendition 时只认 CFI/DOM，不用 quote 文本跨位置命中
 * （同章两处「司马懿的第四子」不会互相误匹配）。
 */
function doesUserHighlightCoverSubject(
	item: EbookUserHighlight,
	subject: { cfiRange: string; quote: string },
	rend?: Rendition,
): boolean {
	const key = subject.cfiRange.trim();
	const itemCfi = item.cfiRange.trim();
	if (!key || !itemCfi) return false;
	if (itemCfi === key) return true;

	const itemQuote = item.quote?.trim() ?? '';

	if (isHighlightCfiStrictlyContained(subject, item, rend)) return true;
	if (
		isHighlightCfiStrictlyContained(
			{ cfiRange: itemCfi, quote: itemQuote },
			subject,
			rend,
		)
	) {
		return true;
	}

	if (!rend) return false;

	if (isCfiResolvedRangeWithinHighlight(rend, key, item)) return true;

	const subjectRange = resolveCfiDomRange(rend, key);
	const highlightRange = resolveCfiDomRange(rend, itemCfi);
	if (!subjectRange || !highlightRange) return false;

	if (
		subjectRange.startContainer.ownerDocument !==
		highlightRange.startContainer.ownerDocument
	) {
		return false;
	}

	return doDomRangesOverlapForMerge(subjectRange, highlightRange);
}

/** 与当前引用 CFI/选区存在重叠的全部用户划线（删除时需一并清理） */
export function findAllUserHighlightsCoveringCfi(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): EbookUserHighlight[] {
	const key = cfiRange.trim();
	if (!key || highlights.length === 0) return [];

	const subject = { cfiRange: key, quote: quote?.trim() ?? '' };
	return highlights.filter((item) =>
		doesUserHighlightCoverSubject(item, subject, rend),
	);
}

/** 精确 CFI、严格包含或 DOM/引用重叠：想法侧栏/PopBar 判定当前引用是否已有用户划线 */
export function findUserHighlightCoveringCfi(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): EbookUserHighlight | undefined {
	return findAllUserHighlightsCoveringCfi(highlights, cfiRange, quote, rend)[0];
}

/** 选区 PopBar：仅 DOM 相交/包含时命中，避免 quote 子串（如「司马亮和卫瓘」）误匹配 distant 划线 */
function doesUserHighlightMatchSelection(
	item: EbookUserHighlight,
	subject: { cfiRange: string; quote: string },
	rend?: Rendition,
): boolean {
	const key = subject.cfiRange.trim();
	const itemCfi = item.cfiRange.trim();
	if (!key || !itemCfi) return false;
	if (itemCfi === key) return true;

	const itemQuote = item.quote?.trim() ?? '';

	if (isHighlightCfiStrictlyContained(subject, item, rend)) return true;
	if (
		isHighlightCfiStrictlyContained(
			{ cfiRange: itemCfi, quote: itemQuote },
			subject,
			rend,
		)
	) {
		return true;
	}

	if (!rend) return false;

	const subjectRange = resolveCfiDomRange(rend, key);
	const highlightRange = resolveCfiDomRange(rend, itemCfi);
	if (!subjectRange || !highlightRange) {
		return false;
	}

	if (
		subjectRange.startContainer.ownerDocument !==
		highlightRange.startContainer.ownerDocument
	) {
		return false;
	}

	if (isDomRangeContainedIn(subjectRange, highlightRange)) {
		const subjectNorm = normalizeComparableText(subject.quote);
		const itemNorm = normalizeComparableText(itemQuote);
		if (!subjectNorm || !itemNorm || itemNorm.includes(subjectNorm)) {
			return true;
		}
	}

	return doDomRangesOverlapForSelection(subjectRange, highlightRange);
}

/** 当前文字选区命中的全部用户划线（删除时需一并清理选区内划线） */
export function findAllUserHighlightsForSelection(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): EbookUserHighlight[] {
	const key = cfiRange.trim();
	if (!key || highlights.length === 0) return [];

	const subject = { cfiRange: key, quote: quote?.trim() ?? '' };
	return highlights.filter((item) =>
		doesUserHighlightMatchSelection(item, subject, rend),
	);
}

/** 当前文字选区是否已有用户划线（供选区 PopBar 展示删除/样式状态） */
export function findUserHighlightForSelection(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): EbookUserHighlight | undefined {
	const matched = findAllUserHighlightsForSelection(
		highlights,
		cfiRange,
		quote,
		rend,
	);
	if (matched.length === 0) return undefined;
	if (matched.length === 1) return matched[0];
	return sortHighlightsForStack(matched).at(-1) ?? matched[0];
}

function isDomPointInsideRange(
	container: Node,
	offset: number,
	range: Range,
): boolean {
	try {
		const doc = range.startContainer.ownerDocument;
		if (!doc) return false;
		const point = doc.createRange();
		point.setStart(container, offset);
		point.collapse(true);
		return (
			range.compareBoundaryPoints(Range.START_TO_START, point) <= 0 &&
			range.compareBoundaryPoints(Range.END_TO_END, point) >= 0
		);
	} catch {
		return false;
	}
}

function isDomPointInsideAnyRange(
	container: Node,
	offset: number,
	ranges: Range[],
): boolean {
	return ranges.some((range) =>
		isDomPointInsideRange(container, offset, range),
	);
}

function normalizeComparableText(text: string): string {
	return text.replace(/\s+/gu, '');
}

function clipRangeToOuterBounds(inner: Range, outer: Range): Range | null {
	try {
		if (
			inner.startContainer.ownerDocument !== outer.startContainer.ownerDocument
		) {
			return null;
		}
		if (!doDomRangesOverlapForSelection(inner, outer)) return null;

		const clipped = inner.cloneRange();
		if (clipped.compareBoundaryPoints(Range.START_TO_START, outer) < 0) {
			clipped.setStart(outer.startContainer, outer.startOffset);
		}
		if (clipped.compareBoundaryPoints(Range.END_TO_END, outer) > 0) {
			clipped.setEnd(outer.endContainer, outer.endOffset);
		}
		if (clipped.collapsed) return null;
		return clipped;
	} catch {
		return null;
	}
}

/** 在 outer 内按 quote 文本定位 DOM 子 Range；多命中时优先与 hintRange 重叠最多者 */
function locateQuoteInRange(
	outer: Range,
	quote: string,
	hintRange?: Range,
): Range | null {
	const q = quote.trim();
	if (!q) return null;

	const doc = outer.startContainer.ownerDocument;
	if (!doc) return null;

	const containerText = outer.toString();
	const indices: number[] = [];
	let searchFrom = 0;
	while (searchFrom <= containerText.length) {
		const index = containerText.indexOf(q, searchFrom);
		if (index < 0) break;
		indices.push(index);
		searchFrom = index + 1;
	}
	if (indices.length === 0) return null;

	const pickIndex =
		indices.length === 1 || !hintRange
			? indices[0]!
			: (() => {
					let bestIndex = indices[0]!;
					let bestScore = -1;
					for (const index of indices) {
						const candidate = charOffsetsToRange(
							doc,
							outer,
							index,
							index + q.length,
						);
						if (!candidate) continue;
						const score = rangeOverlapScore(candidate, hintRange);
						if (score > bestScore) {
							bestScore = score;
							bestIndex = index;
						}
					}
					return bestIndex;
				})();

	return charOffsetsToRange(doc, outer, pickIndex, pickIndex + q.length);
}

/** quote 与 DOM 空白不一致时，按去空白字符序列在 outer 内定位 */
function locateQuoteInNormalizedRange(
	outer: Range,
	quote: string,
): Range | null {
	const q = normalizeComparableText(quote);
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

		for (let offset = nodeStart; offset < nodeEnd; offset++) {
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

function charOffsetsToRange(
	doc: Document,
	outer: Range,
	startIndex: number,
	endIndex: number,
): Range | null {
	let cursor = 0;
	let startNode: Node | null = null;
	let startOffset = 0;
	let endNode: Node | null = null;
	let endOffset = 0;
	let hasStart = false;

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

		for (let offset = nodeStart; offset < nodeEnd; offset++) {
			if (!hasStart && cursor === startIndex) {
				startNode = node;
				startOffset = offset;
				hasStart = true;
			}
			if (hasStart && cursor === endIndex) {
				endNode = node;
				endOffset = offset;
				const range = doc.createRange();
				range.setStart(startNode!, startOffset);
				range.setEnd(endNode, endOffset);
				return range;
			}
			cursor++;
		}
	}

	if (hasStart && cursor === endIndex) {
		const range = doc.createRange();
		range.setStart(startNode!, startOffset);
		range.setEnd(outer.endContainer, outer.endOffset);
		return range;
	}

	return null;
}

function rangeOverlapScore(a: Range, b: Range): number {
	try {
		if (!doDomRangesOverlapForSelection(a, b)) return 0;
		const start =
			a.compareBoundaryPoints(Range.START_TO_START, b) >= 0
				? a.cloneRange()
				: b.cloneRange();
		start.collapse(true);
		const end =
			a.compareBoundaryPoints(Range.END_TO_END, b) <= 0
				? a.cloneRange()
				: b.cloneRange();
		end.collapse(false);
		const probe = a.cloneRange();
		probe.setStart(start.startContainer, start.startOffset);
		probe.setEnd(end.endContainer, end.endOffset);
		return probe.toString().length;
	} catch {
		return 0;
	}
}

/** 按归一化下标从 quote 截取与选区对应的原文片段 */
function extractQuoteSubstringByNormalizedSpan(
	quote: string,
	normStart: number,
	normLength: number,
): string | null {
	if (normLength <= 0) return null;

	let normCursor = 0;
	let start = -1;
	let end = -1;

	for (let i = 0; i < quote.length; i++) {
		const ch = quote[i];
		if (!ch || /\s/u.test(ch)) continue;

		if (normCursor === normStart) start = i;
		normCursor++;
		if (normCursor === normStart + normLength) {
			end = i + 1;
			break;
		}
	}

	if (start < 0 || end < 0 || end <= start) return null;
	return quote.slice(start, end);
}

function isDomRangeContainedIn(inner: Range, outer: Range): boolean {
	try {
		return (
			inner.compareBoundaryPoints(Range.START_TO_START, outer) >= 0 &&
			inner.compareBoundaryPoints(Range.END_TO_END, outer) <= 0
		);
	} catch {
		return false;
	}
}

/** 在选区与划线的交集中，用 quote 精确定位真实覆盖范围（绝不退回整段选区） */
function locateHighlightQuoteCoverInSelection(
	trimmedClipped: Range,
	quote: string,
	highlightRange: Range,
): Range | null {
	const located =
		locateQuoteInRange(trimmedClipped, quote, highlightRange) ??
		locateQuoteInNormalizedRange(trimmedClipped, quote);
	if (located) return trimSelectionRange(located);

	const clippedNorm = normalizeComparableText(trimmedClipped.toString());
	const quoteNorm = normalizeComparableText(quote);
	if (!quoteNorm || !clippedNorm) return null;

	// 选区是更大划线 quote 的连续子串（在大段划线内拖选子集，且该子集均已划线）
	if (quoteNorm.includes(clippedNorm)) {
		const index = quoteNorm.indexOf(clippedNorm);
		if (
			index >= 0 &&
			quoteNorm.slice(index, index + clippedNorm.length) === clippedNorm
		) {
			const subQuote = extractQuoteSubstringByNormalizedSpan(
				quote,
				index,
				clippedNorm.length,
			);
			if (subQuote) {
				const subLocated = locateQuoteInNormalizedRange(
					trimmedClipped,
					subQuote,
				);
				if (subLocated) return trimSelectionRange(subLocated);
			}
		}
	}

	return null;
}

/**
 * 计算单条划线在选区内的有效覆盖 DOM Range。
 * - 混选（选区伸出划线外）：仅 quote 定位到的片段计入覆盖
 * - 子选区（选区完全落在大段划线 DOM 内且文本属于 quote）：整段选区视为已覆盖
 */
function buildHighlightCoverRangeInSelection(
	item: EbookUserHighlight,
	selectionRange: Range,
	rend: Rendition,
): Range | null {
	const highlightRange = resolveCfiDomRange(rend, item.cfiRange.trim());
	if (!highlightRange) return null;

	const clipped = clipRangeToOuterBounds(highlightRange, selectionRange);
	if (!clipped) return null;

	const trimmedClipped = trimSelectionRange(clipped);
	const quote = item.quote?.trim();
	if (!quote) {
		return trimmedClipped;
	}

	const normalizedSelection = trimSelectionRange(selectionRange);
	const selectionNorm = normalizeComparableText(normalizedSelection.toString());
	const clippedNorm = normalizeComparableText(trimmedClipped.toString());
	const quoteNorm = normalizeComparableText(quote);

	const selectionWithinHighlightDom =
		isDomRangeContainedIn(normalizedSelection, highlightRange) &&
		clippedNorm.length > 0 &&
		clippedNorm === selectionNorm &&
		quoteNorm.includes(clippedNorm);

	const located = locateHighlightQuoteCoverInSelection(
		trimmedClipped,
		quote,
		highlightRange,
	);
	if (located) return located;

	if (selectionWithinHighlightDom) {
		return trimmedClipped;
	}

	return null;
}

function buildHighlightCoverRangesInSelection(
	matched: EbookUserHighlight[],
	selectionRange: Range,
	rend: Rendition,
): Range[] {
	const ranges: Range[] = [];
	for (const item of matched) {
		const cover = buildHighlightCoverRangeInSelection(
			item,
			selectionRange,
			rend,
		);
		if (cover) ranges.push(cover);
	}
	return ranges;
}

/** 选区每个非空白字符是否都落在给定划线 DOM 范围内 */
function isDomRangeFullyCoveredByHighlightRanges(
	outer: Range,
	covers: Range[],
): boolean {
	if (covers.length === 0) return false;

	let fullyCovered = true;
	forEachTextNodeInRange(outer, (node, start, end) => {
		if (!fullyCovered) return;
		for (let offset = start; offset < end; offset++) {
			const ch = node.data[offset];
			if (ch && /\s/u.test(ch)) continue;
			if (!isDomPointInsideAnyRange(node, offset, covers)) {
				fullyCovered = false;
				return;
			}
		}
	});
	return fullyCovered;
}

export type SelectionHighlightCoverage = 'none' | 'partial' | 'full';

/** PopBar 是否应展示「删除划线」（选区非空白正文均已划线） */
export function isSelectionFullyHighlighted(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): boolean {
	return (
		resolveSelectionHighlightCoverage(highlights, cfiRange, quote, rend) ===
		'full'
	);
}

/**
 * 判断选区与用户划线的覆盖关系（微信读书式）：
 * - none：选区无命中划线 → PopBar「划线」
 * - partial：选区含未划线正文 → PopBar「划线」（可增量合并）
 * - full：选区每个非空白字都在命中划线的有效覆盖范围内 → PopBar「删除划线」
 */
export function resolveSelectionHighlightCoverage(
	highlights: EbookUserHighlight[],
	cfiRange: string,
	quote?: string,
	rend?: Rendition,
): SelectionHighlightCoverage {
	const matched = findAllUserHighlightsForSelection(
		highlights,
		cfiRange,
		quote,
		rend,
	);
	if (matched.length === 0) return 'none';
	if (!rend) return 'partial';

	const subjectRange = resolveCfiDomRange(rend, cfiRange.trim());
	if (!subjectRange) return 'partial';

	const normalized =
		snapSelectionRangeToTextContent(subjectRange) ??
		trimSelectionRange(subjectRange);
	const coverRanges = buildHighlightCoverRangesInSelection(
		matched,
		normalized,
		rend,
	);
	if (coverRanges.length === 0) return 'partial';

	return isDomRangeFullyCoveredByHighlightRanges(normalized, coverRanges)
		? 'full'
		: 'partial';
}

function mergeDomRangeUnion(ranges: Range[]): Range | null {
	if (ranges.length === 0) return null;
	try {
		const union = ranges[0].cloneRange();
		for (let i = 1; i < ranges.length; i++) {
			const range = ranges[i];
			if (union.compareBoundaryPoints(Range.START_TO_START, range) > 0) {
				union.setStart(range.startContainer, range.startOffset);
			}
			if (union.compareBoundaryPoints(Range.END_TO_END, range) < 0) {
				union.setEnd(range.endContainer, range.endOffset);
			}
		}
		return union;
	} catch {
		return null;
	}
}

function doClientRectsOverlapForMerge(a: Range, b: Range): boolean {
	const rectsA = getAccurateRangeLineClientRects(a);
	const rectsB = getAccurateRangeLineClientRects(b);
	for (const rectA of rectsA) {
		for (const rectB of rectsB) {
			if (rectA.bottom <= rectB.top + 0.5 || rectA.top >= rectB.bottom - 0.5) {
				continue;
			}
			if (rectA.right <= rectB.left + 0.5 || rectA.left >= rectB.right - 0.5) {
				continue;
			}
			return true;
		}
	}
	return false;
}

function doDomRangesOverlapForMerge(a: Range, b: Range): boolean {
	if (
		isDomRangeTouchingOrOverlapping(a, b) ||
		isDomRangeStrictlyContained(a, b) ||
		isDomRangeStrictlyContained(b, a)
	) {
		return true;
	}
	return doClientRectsOverlapForMerge(a, b);
}

/** 选区 PopBar 用：仅真实相交/包含，不含端点相接（避免选区末尾误命中下一段划线） */
function doDomRangesOverlapForSelection(a: Range, b: Range): boolean {
	if (
		isDomRangeOverlapping(a, b) ||
		isDomRangeStrictlyContained(a, b) ||
		isDomRangeStrictlyContained(b, a)
	) {
		return true;
	}
	return doClientRectsOverlapForMerge(a, b);
}

export type MergedOverlappingHighlightTarget = {
	cfiRange: string;
	quote: string;
	/** 与本次选区存在交集、合并后应删除的旧划线 */
	removeHighlightIds: string[];
};

/** 两次划线存在交集时合并为并集选区；调用方以最新 style/color 创建唯一划线并删除旧记录。 */
export function resolveMergedOverlappingHighlight(
	rend: Rendition,
	cfiRange: string,
	quote: string,
	highlights: EbookUserHighlight[],
	excludeHighlightId?: string,
): MergedOverlappingHighlightTarget {
	const trimmedCfi = cfiRange.trim();
	const trimmedQuote = quote.trim();
	const seedRange = resolveCfiDomRange(rend, trimmedCfi);

	if (!seedRange) {
		return {
			cfiRange: trimmedCfi,
			quote: trimmedQuote,
			removeHighlightIds: [],
		};
	}

	const mergedIds = new Set<string>();
	const ranges: Range[] = [seedRange.cloneRange()];
	let changed = true;

	while (changed) {
		changed = false;
		for (const item of highlights) {
			if (!item.id || mergedIds.has(item.id)) continue;
			if (excludeHighlightId && item.id === excludeHighlightId) continue;

			const itemRange = resolveCfiDomRange(rend, item.cfiRange.trim());
			if (!itemRange) continue;

			const sameDoc =
				itemRange.startContainer.ownerDocument ===
				seedRange.startContainer.ownerDocument;
			if (!sameDoc) continue;

			const domMerge = ranges.some((range) =>
				doDomRangesOverlapForMerge(range, itemRange),
			);
			if (!domMerge) continue;

			mergedIds.add(item.id);
			ranges.push(itemRange);
			changed = true;
		}
	}

	if (mergedIds.size === 0) {
		return {
			cfiRange: trimmedCfi,
			quote: trimmedQuote,
			removeHighlightIds: [],
		};
	}

	const union = mergeDomRangeUnion(ranges);
	if (!union) {
		return {
			cfiRange: trimmedCfi,
			quote: trimmedQuote,
			removeHighlightIds: [...mergedIds],
		};
	}

	return {
		cfiRange: cfiFromDomRange(rend, union) ?? trimmedCfi,
		quote: union.toString().trim() || trimmedQuote,
		removeHighlightIds: [...mergedIds],
	};
}

/** 将新选区与待删除旧划线合并成并集 CFI/quote（保存层用） */
export function buildMergedHighlightTarget(
	rend: Rendition,
	cfiRange: string,
	quote: string,
	mergeTargets: EbookUserHighlight[],
): { cfiRange: string; quote: string } {
	const ranges: Range[] = [];
	const seedRange = resolveCfiDomRange(rend, cfiRange.trim());
	if (seedRange) ranges.push(seedRange);

	for (const item of mergeTargets) {
		const itemRange = resolveCfiDomRange(rend, item.cfiRange.trim());
		if (itemRange) ranges.push(itemRange);
	}

	if (ranges.length === 0) {
		return { cfiRange: cfiRange.trim(), quote: quote.trim() };
	}

	const union = mergeDomRangeUnion(ranges);
	if (!union) {
		return { cfiRange: cfiRange.trim(), quote: quote.trim() };
	}

	return {
		cfiRange: cfiFromDomRange(rend, union) ?? cfiRange.trim(),
		quote: union.toString().trim() || quote.trim(),
	};
}

/** 渲染时将交集划线折叠为一条（样式取组内 updatedAt 最新） */
function coalesceOverlappingHighlightsForRender(
	rend: Rendition,
	highlights: EbookUserHighlight[],
): EbookUserHighlight[] {
	const items = highlights.filter((item) => item.id);
	if (items.length <= 1) return highlights;

	const parent = new Map(items.map((item) => [item.id, item.id]));
	const rangeCache = new Map<string, Range | null>();
	const resolveItemRange = (item: EbookUserHighlight): Range | null => {
		if (!rangeCache.has(item.id)) {
			rangeCache.set(item.id, resolveCfiDomRange(rend, item.cfiRange.trim()));
		}
		return rangeCache.get(item.id) ?? null;
	};

	const findRoot = (id: string): string => {
		let root = parent.get(id) ?? id;
		while (root !== parent.get(root)) {
			const next = parent.get(root)!;
			parent.set(root, next);
			root = next;
		}
		parent.set(id, root);
		return root;
	};

	const unite = (leftId: string, rightId: string) => {
		const leftRoot = findRoot(leftId);
		const rightRoot = findRoot(rightId);
		if (leftRoot !== rightRoot) {
			parent.set(leftRoot, rightRoot);
		}
	};

	for (let i = 0; i < items.length; i++) {
		const rangeI = resolveItemRange(items[i]!);
		if (!rangeI) continue;
		for (let j = i + 1; j < items.length; j++) {
			const rangeJ = resolveItemRange(items[j]!);
			if (!rangeJ) continue;
			if (
				rangeI.startContainer.ownerDocument !==
				rangeJ.startContainer.ownerDocument
			) {
				continue;
			}
			if (doDomRangesOverlapForMerge(rangeI, rangeJ)) {
				unite(items[i]!.id, items[j]!.id);
			}
		}
	}

	const grouped = new Map<string, EbookUserHighlight[]>();
	for (const item of items) {
		const root = findRoot(item.id);
		const list = grouped.get(root) ?? [];
		list.push(item);
		grouped.set(root, list);
	}

	const result: EbookUserHighlight[] = [];
	for (const group of grouped.values()) {
		if (group.length === 1) {
			result.push(group[0]!);
			continue;
		}

		const ranges = group
			.map((item) => resolveItemRange(item))
			.filter((range): range is Range => range !== null);
		const union = mergeDomRangeUnion(ranges);
		const latest = group.reduce((best, item) =>
			item.updatedAt >= best.updatedAt ? item : best,
		);
		result.push({
			...latest,
			cfiRange: union
				? (cfiFromDomRange(rend, union) ?? latest.cfiRange)
				: latest.cfiRange,
			quote: union?.toString().trim() || latest.quote,
		});
	}

	return result.length > 0 ? result : highlights;
}

/** 用户划线 mark 点击时关联的想法（同 CFI 或该用户划线被想法选区覆盖） */
export function findThoughtsForHighlightMark(
	thoughts: EbookThought[],
	highlight: EbookUserHighlight,
	rend: Rendition,
): EbookThought[] {
	const highlightCfi = highlight.cfiRange.trim();
	const byExact = thoughts.filter((t) => t.cfiRange.trim() === highlightCfi);
	if (byExact.length > 0) return byExact;

	return thoughts.filter(
		(t) =>
			isThoughtCfiCoveredByUserHighlight(t.cfiRange, highlight, rend) ||
			isHighlightCfiStrictlyContained(
				highlight,
				{ cfiRange: t.cfiRange, quote: t.quote },
				rend,
			),
	);
}

const THOUGHT_CLICK_SLOP_BELOW_PX = 8;

/** 当前 iframe 章节 spine hint，用于点击命中时过滤其它章节想法 */
function getContentsSpineHint(contents: ContentsWithCfi): string | null {
	try {
		const doc = contents.document;
		const body = doc.body ?? doc.documentElement;
		const range = doc.createRange();
		range.selectNodeContents(body);
		range.collapse(true);
		const cfi = contents.cfiFromRange(range, EPUB_ANNOTATION_IGNORE_CLASS);
		return extractCfiSpineHint(cfi);
	} catch {
		return null;
	}
}

function isClickInThoughtCfiRange(
	rend: Rendition,
	contents: ContentsWithCfi,
	clientX: number,
	clientY: number,
	cfiRange: string,
): boolean {
	const thoughtRange = resolveCfiDomRange(rend, cfiRange);
	if (
		!thoughtRange ||
		thoughtRange.startContainer.ownerDocument !== contents.document
	) {
		return false;
	}

	const iframe = contents.window.frameElement;
	if (
		!isPointInRangeTextBand(
			thoughtRange,
			iframe,
			clientX,
			clientY,
			THOUGHT_CLICK_SLOP_BELOW_PX,
		)
	) {
		return false;
	}

	const clickRange = caretRangeFromPoint(contents.document, clientX, clientY);
	if (!clickRange) return false;

	try {
		return isClickRangeInsideHighlight(clickRange, thoughtRange);
	} catch {
		return false;
	}
}

function findThoughtsAtClickPoint(
	rend: Rendition,
	contents: ContentsWithCfi,
	clientX: number,
	clientY: number,
	thoughts: EbookThought[],
): EbookThought[] {
	const grouped = new Map<string, EbookThought[]>();
	for (const thought of thoughts) {
		const cfi = thought.cfiRange.trim();
		if (!cfi) continue;
		const list = grouped.get(cfi) ?? [];
		list.push(thought);
		grouped.set(cfi, list);
	}

	const matched: EbookThought[] = [];
	const spineHint = getContentsSpineHint(contents);
	for (const [, group] of grouped) {
		const cfi = group[0]?.cfiRange.trim();
		if (!cfi) continue;
		if (spineHint && extractCfiSpineHint(cfi) !== spineHint) continue;
		if (isClickInThoughtCfiRange(rend, contents, clientX, clientY, cfi)) {
			matched.push(...group);
		}
	}
	return matched;
}

/** 同一点命中多组想法时，聚合为连通 cluster（引用区取全部 CFI 的 DOM 并集） */
function resolveThoughtClickCluster(
	rend: Rendition,
	allThoughts: EbookThought[],
	candidates: EbookThought[],
	fromMarkSeed: boolean,
): EbookThoughtClickCluster | null {
	if (candidates.length === 0) return null;

	if (fromMarkSeed) {
		const click = lastReaderClickPoint;
		const contents =
			click && Date.now() - click.at <= 800
				? getContentsWithCfiForDocument(rend, click.document)
				: null;
		const isClickInCfi =
			contents && click
				? (cfi: string) =>
						isClickInThoughtCfiRange(
							rend,
							contents,
							click.clientX,
							click.clientY,
							cfi,
						)
				: undefined;
		return expandClusterFromMarkSeed(
			rend,
			allThoughts,
			candidates,
			isClickInCfi,
		);
	}

	return buildThoughtClickClusterFromCandidates(rend, allThoughts, candidates);
}

/** 下一帧再聚类并打开列表，避免在 pointer 回调里长时间占用主线程 */
function scheduleThoughtClusterClick(
	rend: Rendition,
	allThoughts: EbookThought[],
	candidates: EbookThought[],
	fromMarkSeed: boolean,
	onThoughtClusterClick: (cluster: EbookThoughtClickCluster) => void,
): void {
	requestAnimationFrame(() => {
		const cluster = resolveThoughtClickCluster(
			rend,
			allThoughts,
			candidates,
			fromMarkSeed,
		);
		if (cluster && cluster.allThoughts.length > 0) {
			onThoughtClusterClick(cluster);
		}
	});
}

type HighlightHitAnchor = {
	clientX: number;
	clientY: number;
	contents: EpubIframeContents;
};

function tryDispatchUserHighlightAtRecentClick(
	rend: Rendition,
	highlights: EbookUserHighlight[],
	onHighlightHit: (
		highlight: EbookUserHighlight,
		anchor?: HighlightHitAnchor,
	) => void,
): boolean {
	const click = lastReaderClickPoint;
	if (!click || Date.now() - click.at > 800) return false;

	const contents = getContentsWithCfiForDocument(rend, click.document);
	if (!contents) return false;

	const hit = findUserHighlightAtClickPoint(
		rend,
		contents,
		click.clientX,
		click.clientY,
		highlights,
	);
	if (!hit) return false;

	onHighlightHit(hit, {
		clientX: click.clientX,
		clientY: click.clientY,
		contents,
	});
	return true;
}

function buildPopBarPayloadForHighlightHit(
	rend: Rendition,
	highlight: EbookUserHighlight,
): EpubSelectionPopBarPayload {
	return buildEpubPopBarPayloadFromCfiRange(
		rend,
		highlight.cfiRange,
		highlight.quote,
		resolveCfiDomRange,
	);
}

export type EpubReadingMarkClickOptions = {
	getThoughts: () => EbookThought[];
	getHighlights: () => EbookUserHighlight[];
	onThoughtClusterClick: (cluster: EbookThoughtClickCluster) => void;
	onUserHighlightPopBar: (
		payload: EpubSelectionPopBarPayload,
		highlight: EbookUserHighlight,
	) => void;
};

/** 统一点击：用户划线与想法相同走 marks-pane 几何命中 + markClicked */
export function installEpubReadingMarkClickListeners(
	rend: Rendition,
	options: EpubReadingMarkClickOptions,
): () => void {
	const handleUserHighlightHit = (
		highlight: EbookUserHighlight,
		anchor?: HighlightHitAnchor,
	) => {
		if (hasTextSelectionInRend(rend)) return;

		const thoughts = options.getThoughts();
		const click = lastReaderClickPoint;
		const contents =
			anchor?.contents ??
			(click ? getContentsWithCfiForDocument(rend, click.document) : null);
		const clientX = anchor?.clientX ?? click?.clientX;
		const clientY = anchor?.clientY ?? click?.clientY;

		if (contents && clientX != null && clientY != null) {
			const atClick = findThoughtsAtClickPoint(
				rend,
				contents as ContentsWithCfi,
				clientX,
				clientY,
				thoughts,
			);
			if (atClick.length > 0) {
				scheduleThoughtClusterClick(
					rend,
					thoughts,
					atClick,
					false,
					options.onThoughtClusterClick,
				);
				return;
			}
		}

		const payload = buildPopBarPayloadForHighlightHit(rend, highlight);
		options.onUserHighlightPopBar(payload, highlight);
	};

	let lastHitHighlightId = '';
	let lastHitAt = 0;
	const dispatchHighlightHit = (
		highlight: EbookUserHighlight,
		anchor?: HighlightHitAnchor,
	) => {
		suppressEpubSelectionPopBarDismiss();
		if (anchor) {
			if (
				!isHighlightHitAtClickPoint(
					rend,
					anchor.contents as ContentsWithCfi,
					anchor.clientX,
					anchor.clientY,
					highlight,
				)
			) {
				return;
			}
		} else if (!isHighlightHitAtRecentClick(rend, highlight)) {
			return;
		}
		const now = Date.now();
		if (lastHitHighlightId === highlight.id && now - lastHitAt < 400) {
			return;
		}
		lastHitHighlightId = highlight.id;
		lastHitAt = now;
		handleUserHighlightHit(highlight, anchor);
	};

	userHighlightClickRouter = dispatchHighlightHit;

	const detachReaderClick = attachUserHighlightReaderClickListener(
		rend,
		options.getHighlights,
		options.getThoughts,
		options.onThoughtClusterClick,
		dispatchHighlightHit,
	);

	const onMarkClicked = (
		cfiRange: string,
		data: { thoughtIds?: string[]; highlightId?: string; hlStyle?: string },
	) => {
		if (hasTextSelectionInRend(rend)) return;

		const highlights = options.getHighlights();
		const isUserMark = Boolean(
			data?.highlightId ||
				data?.hlStyle ||
				(data as Record<string, string | undefined>)?.[DATA_STYLE],
		);

		if (isUserMark) {
			const highlight =
				(data?.highlightId
					? highlights.find((h) => h.id === data.highlightId)
					: undefined) ?? findUserHighlightByCfi(highlights, cfiRange);
			if (highlight) {
				dispatchHighlightHit(highlight);
			}
			return;
		}

		const thoughts = options.getThoughts();
		const thoughtIds = data?.thoughtIds ?? [];
		const matchedThoughts =
			thoughtIds.length > 0
				? thoughts.filter((t) => thoughtIds.includes(t.id))
				: thoughts.filter((t) => t.cfiRange.trim() === cfiRange.trim());

		if (matchedThoughts.length > 0) {
			scheduleThoughtClusterClick(
				rend,
				thoughts,
				matchedThoughts,
				true,
				options.onThoughtClusterClick,
			);
			return;
		}

		tryDispatchUserHighlightAtRecentClick(
			rend,
			highlights,
			dispatchHighlightHit,
		);
	};

	rend.on('markClicked', onMarkClicked);

	return () => {
		userHighlightClickRouter = null;
		detachReaderClick();
		try {
			rend.off('markClicked', onMarkClicked);
		} catch {
			// rendition 已销毁
		}
	};
}

/** 导出供侧栏 PopBar 锚定阅读区正文位置 */
export { resolveCfiDomRange };

export function syncEpubReadingAnnotations(
	rend: Rendition,
	thoughts: EbookThought[],
	highlights: EbookUserHighlight[],
	appliedThoughtsRef: Map<string, string>,
	appliedHighlightsRef: Map<string, string>,
): void {
	beginEpubAnnotationSyncScope();
	try {
		invalidateAppliedUserHighlightsMissingDom(rend, appliedHighlightsRef);
		setUserHighlightBlockerSourcesForThoughtPatch([]);
		const highlightPlan = buildHighlightRenderPlan(rend, highlights);
		applyEpubUserHighlights(
			rend,
			highlights,
			appliedHighlightsRef,
			highlightPlan,
		);
		applyEpubThoughtUnderlines(rend, thoughts, appliedThoughtsRef);
		setUserHighlightBlockerSourcesForThoughtPatch(
			collectUserHighlightBlockerSources(rend),
		);
		runEpubReadingAnnotationPatch(rend);
	} finally {
		endEpubAnnotationSyncScope();
	}
}

let readingAnnotationPatchRaf = 0;
let pendingReadingAnnotationFullPatch = false;

function runEpubReadingAnnotationPatch(rend: Rendition): void {
	try {
		patchAllUserHighlightMarks(rend);
		setUserHighlightBlockerSourcesForThoughtPatch(
			collectUserHighlightBlockerSources(rend),
		);
		patchEpubThoughtUnderlineMarks(rend);
		restackThoughtMarkGroups(rend);
		restackUserHighlightMarkGroups(rend);
	} catch {
		// rendition 已销毁
	}
}

export function resetEpubReadingAnnotationSyncState(): void {
	// 保留导出供 EpubPane 卸载时调用
}

function isDomRangeFullyCoveredByHighlightClientRects(
	thoughtCfi: string,
	thoughtRange: Range,
	highlightCfi: string,
	highlightRange: Range,
): boolean {
	const thoughtRects = getAccurateRangeLineClientRectsCached(
		`thought:${thoughtCfi}`,
		thoughtRange,
	);
	const highlightRects = getAccurateRangeLineClientRectsCached(
		`highlight:${highlightCfi}`,
		highlightRange,
	);
	if (thoughtRects.length === 0 || highlightRects.length === 0) return false;

	return thoughtRects.every((thoughtRect) =>
		highlightRects.some((highlightRect) => {
			if (
				thoughtRect.bottom <= highlightRect.top + 0.5 ||
				thoughtRect.top >= highlightRect.bottom - 0.5
			) {
				return false;
			}
			return (
				thoughtRect.left >= highlightRect.left - 1 &&
				thoughtRect.right <= highlightRect.right + 1
			);
		}),
	);
}

function collectUserHighlightBlockerSources(
	rend: Rendition,
): UserHighlightBlockerSource[] {
	const sources: UserHighlightBlockerSource[] = [];
	const docs = new Set<Document>([document]);
	for (const contents of getRenditionContentsList(rend)) {
		if (contents.document) docs.add(contents.document);
	}

	for (const doc of docs) {
		try {
			doc.querySelectorAll(USER_HIGHLIGHT_SELECTOR).forEach((group) => {
				const cfi = (group as SVGElement).dataset.epubcfi?.trim() ?? '';
				const el = group as SVGElement;
				const style = (el.dataset[DATA_STYLE] ??
					'highlight') as EpubHighlightStyle;
				const rects = [...group.querySelectorAll('rect')]
					.map((rect) => parseSvgMarkRect(rect as SVGRectElement))
					.filter((rect): rect is NonNullable<typeof rect> => rect !== null);
				// ponytail: 波浪线用 path 扣减；下划线只用 rect（epub.js 遗留 line 常比 rect 更宽，会误扣想法虚线）
				if (style === 'wavy') {
					for (const node of group.querySelectorAll(
						`path.${WAVY_PATH_CLASS}`,
					)) {
						if (!(node instanceof SVGPathElement)) continue;
						const box = node.getBBox();
						if (box.width >= MIN_USER_HIGHLIGHT_BLOCKER_PX && box.height > 0) {
							rects.push({
								x: box.x,
								y: box.y,
								width: box.width,
								height: box.height,
							});
						}
					}
				}
				if (rects.length > 0) {
					sources.push({ cfi, rects });
				}
			});
		} catch {
			// iframe 卸载时忽略
		}
	}

	return sources;
}

/** 用户划线置于想法 mark 之上，重叠处由用户 stroke 盖住想法虚线 */
export function restackUserHighlightMarkGroups(rend?: Rendition): void {
	const docs = new Set<Document>([document]);
	for (const contents of getRenditionContentsList(rend)) {
		if (contents.document) docs.add(contents.document);
	}

	for (const doc of docs) {
		try {
			for (const pane of doc.querySelectorAll('.marks-pane')) {
				for (const group of pane.querySelectorAll(USER_HIGHLIGHT_SELECTOR)) {
					pane.appendChild(group);
				}
			}
		} catch {
			// iframe 卸载时忽略
		}
	}
}

/** 滚动/翻页后仅 patch 样式，不 remove+readd（避免闪烁） */
export function patchEpubReadingAnnotations(
	rend: Rendition,
	options?: { defer?: boolean; sync?: boolean },
): void {
	if (options?.sync) {
		cancelAnimationFrame(readingAnnotationPatchRaf);
		readingAnnotationPatchRaf = 0;
		pendingReadingAnnotationFullPatch = false;
		runEpubReadingAnnotationPatch(rend);
		return;
	}

	if (options?.defer) {
		pendingReadingAnnotationFullPatch = true;
	}

	cancelAnimationFrame(readingAnnotationPatchRaf);
	readingAnnotationPatchRaf = requestAnimationFrame(() => {
		if (pendingReadingAnnotationFullPatch) {
			pendingReadingAnnotationFullPatch = false;
			readingAnnotationPatchRaf = requestAnimationFrame(() => {
				runEpubReadingAnnotationPatch(rend);
			});
			return;
		}
		runEpubReadingAnnotationPatch(rend);
	});
}

/** 判断想法 CFI 是否被用户划线覆盖（同 CFI 或 DOM 严格包含；不做 quote 子串推断，避免误伤） */
export function isThoughtCfiCoveredByUserHighlight(
	thoughtCfi: string,
	highlight: EbookUserHighlight,
	rend: Rendition,
): boolean {
	const thoughtKey = thoughtCfi.trim();
	const highlightKey = highlight.cfiRange.trim();
	if (!thoughtKey || !highlightKey) return false;
	if (thoughtKey === highlightKey) return true;

	const thoughtRange = resolveCfiDomRange(rend, thoughtKey);
	const highlightRange = resolveCfiDomRange(rend, highlightKey);
	if (thoughtRange && highlightRange) {
		if (isDomRangeStrictlyContained(thoughtRange, highlightRange)) return true;
		if (
			isDomRangeFullyCoveredByHighlightClientRects(
				thoughtKey,
				thoughtRange,
				highlightKey,
				highlightRange,
			)
		) {
			return true;
		}
	}
	return false;
}

export function installEpubUserHighlightPatchListeners(
	rend: Rendition,
): () => void {
	const schedulePatch = (defer = false) => {
		patchEpubReadingAnnotations(rend, defer ? { defer: true } : undefined);
	};

	const onContent = () => schedulePatch(true);
	rend.hooks.content.register(onContent);

	const onRelocated = () => schedulePatch(false);
	rend.on('relocated', onRelocated);

	const onRendered = () => schedulePatch(true);
	rend.on('rendered', onRendered);

	schedulePatch(true);

	return () => {
		cancelAnimationFrame(readingAnnotationPatchRaf);
		readingAnnotationPatchRaf = 0;
		pendingReadingAnnotationFullPatch = false;
		try {
			rend.hooks.content.deregister(onContent);
			rend.off('relocated', onRelocated);
			rend.off('rendered', onRendered);
		} catch {
			// rendition 已销毁
		}
	};
}
