# Mermaid 在 Markdown 中的缩放与预览：实现说明

本文说明在应用内渲染 `mermaid` 围栏后，**工具栏缩放 / 平移**（可选模块）与**点击弹出 ImagePreview 大图预览**（当前前端已接入）的完整思路、DOM 约定、数据流与代码级注释。

---

## 1. 总体架构

当前仓库存在 **两条并列的 Mermaid 渲染路径**（由「正文里是否出现 ```mermaid 围栏」与宿主 UI 决定）：

### 路径 A：整段 HTML 占位 + 根级扫描（无围栏拆分）

适用于 **Monaco 预览** 在正文 **不含** mermaid 围栏时，或其它仍使用「单次 `parser.render` + 整块 `innerHTML`」的页面。

```text
Markdown 源码
    ↓
MarkdownParser.patchMermaidFence → 占位 HTML（.markdown-mermaid-wrap + .mermaid）
    ↓
dangerouslySetInnerHTML 写入预览根节点
    ↓
useMermaidInMarkdownRoot（双 rAF）→ runMermaidInMarkdownRoot → mermaid.run({ nodes })
    ↓
[可选] attachMermaidZoomUiInRoot：工具栏 + viewport + transform
    ↓
useMermaidDiagramClickPreview：点击 SVG → data URL → ImagePreview
```

### 路径 B：围栏拆分 + Mermaid 岛（聊天流式、Monaco 含 mermaid 时）

适用于 **助手消息流式**（`StreamingMarkdownBody`）以及 **Monaco `ParserMarkdownPreviewPane`** 在 `enableMermaid === true` 且 `splitMarkdownByCodeFences` 检出 mermaid 段时。动机是避免 **整段 `innerHTML` 替换** 冲掉已渲染的 SVG，或与 `mermaid.run` 的时序竞态。

```text
Markdown 源码
    ↓
splitMarkdownByCodeFences → 交替的 { markdown 段 | mermaid 段 }
    ↓
markdown 段：MarkdownParser（enableMermaid: false）→ 小段 innerHTML（无 mermaid 占位）
    ↓
mermaid 段（已闭合）：MermaidFenceIsland → 岛内写入占位 DOM → runMermaidInMarkdownRoot
    ↓
mermaid 段（流式未闭合）：mermaidStreamingFallbackHtml → 仅代码高亮样式，不执行 mermaid.run
    ↓
useMermaidDiagramClickPreview（岛 host 或预览根）：点击 SVG → ImagePreview
```

- **渲染入口（路径 A）**：`MarkdownParser` 在 `enableMermaid !== false` 时对 ` ```mermaid ` 输出占位节点；`escapeHtml` 之前经 **`normalizeMermaidFenceBody`** 做换行统一与部分方括号文案补引号（见 **§7.5**）。
- **渲染入口（路径 B）**：岛内用 **`textContent = normalizeMermaidFenceBody(code)`** 写入 DSL，再 **`runMermaidInMarkdownRoot(host)`**；根节点上的 **`useMermaidInMarkdownRoot` 通过 `parser.enableMermaid: false` 关闭**，避免重复扫描。
- **全局队列**：`mermaid-in-markdown.ts` 内 `runQueue` 串行化 `mermaid.run`。
- **缩放（可选）**：见 **§3、§4** 参考实现（带缩放壳 DOM）。
- **预览（当前仓库）**：`mermaidSvgToPreviewDataUrl` + `ImagePreview`；点击委托忽略 `.markdown-mermaid-zoom-chrome`（**§6**）。

> **与当前仓库对齐**：`packages/tools` 为「单层 `wrap` + `.mermaid`」的 `patchMermaidFence` + `normalizeMermaidFenceBody`；`mermaid-in-markdown.ts` 为精简版。**§3、§4** 为「带缩放壳」的参考实现。**§7** 描述 **围栏拆分 + `MermaidFenceIsland`** 的完整实现与逐行注释代码。**§8** 描述 **Monaco `ParserMarkdownPreviewPane`** 如何在路径 A / B 间切换。

---

## 2. 占位 DOM 约定（缩放版）

缩放能力要求 **不要把 `.mermaid` 直接放在 `overflow` 容器里硬裁切**，而是：

| 层级   | class                                        | 作用                                                 |
| ------ | -------------------------------------------- | ---------------------------------------------------- |
| 根     | `markdown-mermaid-wrap` + `data-mermaid="1"` | 与 `mermaid.run` 选择器一致；一块图一个 wrap         |
| 工具栏 | `markdown-mermaid-zoom-chrome`               | 放 − / 恢复 / + 按钮                                 |
| 视口   | `markdown-mermaid-zoom-viewport`             | `overflow: hidden`，限制可见区域与最大高度           |
| 舞台   | `markdown-mermaid-zoom-stage`                | `transform: translate + scale`，拖拽与缩放作用在此层 |
| 内容   | `.mermaid`                                   | Mermaid 官方约定入口，`mermaid.run` 只往这里写 SVG   |

**简化版（当前 parser 常见输出）**：仅 `wrap > .mermaid`，无工具栏；此时只能依赖外层 CSS（如 `overflow-x: auto`）或另做「点击预览」。

---

## 3. 围栏 HTML 生成（参考：`mermaid-fence-html`）

下列函数与 **markdown-it fence** 中 `escapeHtml(body)` 后的字符串拼接等价，**逐行注释**说明每一行字符串的职责。

```typescript
/**
 * Mermaid 围栏占位：预置工具栏槽、viewport、stage，便于缩放/拖拽只绑事件、不移动 .mermaid 节点。
 */

export function buildMermaidFenceHtml(escapedBody: string): string {
	return (
		'<div class="markdown-mermaid-wrap" data-mermaid="1">' + // 外层：run 与 attach 扫描的块根节点
		'<div class="markdown-mermaid-zoom-chrome" data-mermaid-zoom-chrome="1"></div>' + // 工具栏容器（初始空，由 JS 填按钮）
		'<div class="markdown-mermaid-zoom-viewport">' + // 裁剪视口，大图只在此区域内可见
		'<div class="markdown-mermaid-zoom-stage">' + // 应用 translate/scale 的层
		'<div class="mermaid">' + // Mermaid 写入 SVG 的目标节点
		escapedBody + // 已转义的 DSL 文本，防 XSS
		"</div></div></div></div>\n" // 依次闭合 mermaid / stage / viewport / wrap
	);
}

/** 空 DSL 容器；与 buildMermaidFenceHtml 结构一致（聊天流式「岛」用 innerHTML 再填 text） */
export const MERMAID_ISLAND_SHELL_HTML =
	'<div class="markdown-mermaid-wrap" data-mermaid="1">' +
	'<div class="markdown-mermaid-zoom-chrome" data-mermaid-zoom-chrome="1"></div>' +
	'<div class="markdown-mermaid-zoom-viewport">' +
	'<div class="markdown-mermaid-zoom-stage">' +
	'<div class="mermaid"></div>' +
	"</div></div></div>";
```

在 `MarkdownParser.patchMermaidFence` 中，将 ` ```mermaid ` 分支的 `return` 改为调用 `buildMermaidFenceHtml(body)` 即可与缩放脚本对齐。

---

## 4. 缩放 UI 脚本（参考：`mermaid-zoom-ui.ts`）逐行说明

逻辑要点：

1. **`WeakSet<HTMLElement> wiredWraps`**：每个 `wrap` 只 `wireZoomUi` 一次，幂等；失败时从 Set 删除以便重试。
2. **`setupWrap`**：若已有 viewport/stage（来自 HTML），补全 chrome 后绑定；否则从「旧结构 wrap > .mermaid」升级为四层结构（与历史 HTML 兼容）。
3. **`wireZoomUi`**：`ensureToolbar` 创建 − / ⌂ / +；`scale` 用乘法因子步进；`scale === 1` 时清零平移并去掉拖拽样式。
4. **无 `wheel` 监听**：避免与页面滚动抢事件。

下列为 **带行尾 `//` 注释** 的参考实现（可直接粘贴为 `mermaid-zoom-ui.ts` 再按项目微调）；与历史分支中的完整实现一致。

```typescript
const VIEWPORT_CLS = "markdown-mermaid-zoom-viewport"; // 视口节点 class，与 HTML/CSS 一致
const STAGE_CLS = "markdown-mermaid-zoom-stage"; // 舞台节点 class，transform 作用目标
const CHROME_CLS = "markdown-mermaid-zoom-chrome"; // 工具栏容器 class
const BTN_CLS = "markdown-mermaid-zoom-btn"; // 按钮统一 class，便于主题覆盖
const MIN_SCALE = 0.25; // 最小缩放比例
const MAX_SCALE = 4; // 最大缩放比例
const ZOOM_FACTOR = 1.15; // 每次放大/缩小乘以或除以的因子
const SCALE_EPS = 1e-4; // 与 1 比较的浮点容差

const wiredWraps = new WeakSet<HTMLElement>(); // 已绑定 UI 的 wrap，防止重复 addEventListener

function isZoomed(scale: number): boolean {
	return Math.abs(scale - 1) > SCALE_EPS; // 是否视为「已缩放」，用于开启拖拽与 UI 状态
}

function getDirectMermaidChild(wrap: HTMLElement): HTMLElement | null {
	for (let i = 0; i < wrap.children.length; i++) {
		const el = wrap.children[i]; // 只认「直接子节点」中的 .mermaid（兼容未包 viewport 的旧 DOM）
		if (el instanceof HTMLElement && el.classList.contains("mermaid"))
			return el;
	}
	return null;
}

function ensureToolbar(chrome: HTMLElement) {
	// 若 HTML 已带三个按钮则复用，否则清空并创建 − / 恢复 / +
	let btnOut = chrome.querySelector<HTMLButtonElement>(
		'button[data-mermaid-zoom-action="out"]',
	);
	let btnReset = chrome.querySelector<HTMLButtonElement>(
		'button[data-mermaid-zoom-action="reset"]',
	);
	let btnIn = chrome.querySelector<HTMLButtonElement>(
		'button[data-mermaid-zoom-action="in"]',
	);
	if (btnOut && btnReset && btnIn) return { btnOut, btnReset, btnIn };
	chrome.textContent = ""; // 清空占位
	chrome.setAttribute("role", "toolbar"); // 无障碍
	chrome.setAttribute("aria-label", "Mermaid 图表缩放");
	// 以下 style 保证条可见、可点、横向右对齐（具体项目可迁到 CSS）
	chrome.style.cssText =
		"display:flex!important;gap:6px;justify-content:flex-end;align-items:center;margin:0 0 8px;flex-shrink:0;position:relative;z-index:20;pointer-events:auto;width:100%;box-sizing:border-box;min-height:36px;visibility:visible!important;opacity:1!important;";
	const dark =
		typeof document !== "undefined" &&
		document.body?.classList.contains("dark");
	const mk = (
		action: string,
		label: string,
		text: string,
	): HTMLButtonElement => {
		const b = document.createElement("button");
		b.type = "button"; // 避免表单提交
		b.className = BTN_CLS;
		b.dataset.mermaidZoomAction = action; // out | reset | in
		b.title = label;
		b.setAttribute("aria-label", label);
		b.textContent = text;
		b.style.cssText = dark
			? "box-sizing:border-box;min-width:32px;height:32px;padding:0 8px;font-size:15px;line-height:1;border:1px solid rgba(200,200,200,.45);background:rgba(45,45,50,.96);color:#f0f0f0;cursor:pointer;border-radius:6px;opacity:1!important;"
			: "box-sizing:border-box;min-width:32px;height:32px;padding:0 8px;font-size:15px;line-height:1;border:1px solid rgba(100,100,100,.55);background:rgba(240,240,245,.95);color:#1a1a1a;cursor:pointer;border-radius:6px;opacity:1!important;";
		return b;
	};
	btnOut = mk("out", "缩小", "−");
	btnReset = mk("reset", "恢复", "⌂");
	btnIn = mk("in", "放大", "+");
	chrome.append(btnOut, btnReset, btnIn);
	return { btnOut, btnReset, btnIn };
}

function wireZoomUi(
	viewport: HTMLElement,
	stage: HTMLElement,
	chrome: HTMLElement,
): void {
	const { btnOut, btnReset, btnIn } = ensureToolbar(chrome);
	viewport.style.overflow = "hidden"; // 裁剪溢出 SVG
	viewport.style.minHeight = "120px"; // 空图时占位高度
	viewport.style.maxHeight = "min(70vh, 560px)"; // 限制单图最大高度，避免撑满屏
	viewport.style.boxSizing = "border-box"; // 含 border 的尺寸计算
	viewport.style.borderRadius = "6px"; // 圆角与描边在 CSS 或下行补充
	viewport.style.border = document.body?.classList.contains("dark")
		? "1px solid rgba(200,200,200,.35)" // 暗色主题描边
		: "1px solid rgba(100,100,100,.35)"; // 亮色主题描边
	stage.style.transformOrigin = "0 0"; // 缩放锚点在左上，便于与 translate 组合

	let scale = 1; // 当前缩放比例，1 为原始大小
	let tx = 0; // 舞台水平平移（像素）
	let ty = 0; // 舞台垂直平移（像素）

	const applyTransform = (): void => {
		stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`; // 先平移后缩放
	};

	const syncInteractionChrome = (): void => {
		const zoomed = isZoomed(scale);
		viewport.classList.toggle("is-mermaid-zoom-draggable", zoomed); // CSS 中 cursor: grab
		if (!zoomed) {
			viewport.classList.remove("is-mermaid-zoom-dragging");
			tx = 0;
			ty = 0;
			applyTransform(); // 恢复 = 归一化平移
		}
	};

	const zoomAtCenter = (nextScale: number): void => {
		const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
		const cx = viewport.clientWidth / 2; // 以视口中心为锚做近似 zoom-to-center（可按项目细化）
		const cy = viewport.clientHeight / 2;
		const k = clamped / scale;
		tx = cx - (cx - tx) * k;
		ty = cy - (cy - ty) * k;
		scale = clamped;
		applyTransform();
		syncInteractionChrome();
	};

	btnOut.addEventListener("click", () => zoomAtCenter(scale / ZOOM_FACTOR)); // 缩小一档
	btnIn.addEventListener("click", () => zoomAtCenter(scale * ZOOM_FACTOR)); // 放大一档
	btnReset.addEventListener("click", () => {
		scale = 1; // 比例复位
		tx = 0; // 平移复位
		ty = 0;
		applyTransform();
		syncInteractionChrome();
	});

	let dragging = false; // 是否处于拖拽中
	let startX = 0; // pointerdown 时指针 X
	let startY = 0; // pointerdown 时指针 Y
	let startTx = 0; // pointerdown 时已有的 tx
	let startTy = 0; // pointerdown 时已有的 ty

	viewport.addEventListener("pointerdown", (e) => {
		if (!isZoomed(scale)) return; // 仅缩放后可拖
		if (e.button !== 0) return; // 仅主键
		dragging = true;
		viewport.setPointerCapture(e.pointerId); // 拖出视口仍收事件
		startX = e.clientX;
		startY = e.clientY;
		startTx = tx;
		startTy = ty;
		viewport.classList.add("is-mermaid-zoom-dragging");
	});

	viewport.addEventListener("pointermove", (e) => {
		if (!dragging || !isZoomed(scale)) return;
		tx = startTx + (e.clientX - startX);
		ty = startTy + (e.clientY - startY);
		applyTransform();
	});

	const endDrag = (e: PointerEvent): void => {
		if (!dragging) return;
		dragging = false;
		viewport.classList.remove("is-mermaid-zoom-dragging");
		try {
			viewport.releasePointerCapture(e.pointerId);
		} catch {
			/* 忽略重复 release */
		}
	};
	viewport.addEventListener("pointerup", endDrag);
	viewport.addEventListener("pointercancel", endDrag);

	applyTransform();
	syncInteractionChrome();
}

function setupWrap(wrap: HTMLElement): void {
	if (wiredWraps.has(wrap)) return; // 已处理过则跳过

	let viewport = wrap.querySelector<HTMLElement>(`.${VIEWPORT_CLS}`);
	let stage = wrap.querySelector<HTMLElement>(`.${STAGE_CLS}`);
	let chrome = wrap.querySelector<HTMLElement>(`.${CHROME_CLS}`);

	if (viewport && stage) {
		if (!chrome) {
			chrome = document.createElement("div");
			chrome.className = CHROME_CLS;
			chrome.setAttribute("data-mermaid-zoom-chrome", "1");
			wrap.insertBefore(chrome, viewport); // 工具栏在视口上方
		}
		wiredWraps.add(wrap);
		try {
			wireZoomUi(viewport, stage, chrome);
		} catch {
			wiredWraps.delete(wrap); // 绑定失败允许下次重试
		}
		return;
	}

	const mermaidEl = getDirectMermaidChild(wrap); // 旧结构：wrap 下直接 .mermaid
	if (!mermaidEl) return;

	chrome = document.createElement("div");
	chrome.className = CHROME_CLS;
	chrome.setAttribute("data-mermaid-zoom-chrome", "1");
	viewport = document.createElement("div");
	viewport.className = VIEWPORT_CLS;
	stage = document.createElement("div");
	stage.className = STAGE_CLS;
	wrap.removeChild(mermaidEl); // 从 wrap 摘下 .mermaid
	stage.appendChild(mermaidEl); // 放入 stage
	viewport.appendChild(stage);
	wrap.appendChild(chrome); // 先条后图或按设计 insertBefore
	wrap.appendChild(viewport);
	wiredWraps.add(wrap);
	try {
		wireZoomUi(viewport, stage, chrome);
	} catch {
		wiredWraps.delete(wrap);
	}
}

/** 在 root 子树内为每个 .markdown-mermaid-wrap 挂载缩放条与视口交互（幂等） */
export function attachMermaidZoomUiInRoot(root: HTMLElement): void {
	const wraps = root.querySelectorAll<HTMLElement>(".markdown-mermaid-wrap"); // 子树内所有 Mermaid 块
	for (let i = 0; i < wraps.length; i++) {
		setupWrap(wraps[i]); // 每块独立 wiredWraps 记录，互不干扰
	}
}
```

### 4.0 配套样式（参考：`mermaid-zoom-ui.css`）逐行说明

```css
/* Mermaid：按钮缩放 + 仅缩放后可拖拽（无滚轮缩放） */

.markdown-mermaid-wrap[data-mermaid="1"] {
	position: relative; /* 子元素 z-index、定位参照 */
}

.markdown-mermaid-zoom-chrome {
	display: flex; /* 横向排列按钮 */
	gap: 6px;
	justify-content: flex-end; /* 工具栏靠右 */
	align-items: center;
	margin: 0 0 8px; /* 与下方视口间距 */
	min-height: 36px;
	pointer-events: auto; /* 防止被父级 pointer-events:none 误伤 */
	position: relative;
	z-index: 20;
	flex-shrink: 0;
	width: 100%;
	box-sizing: border-box;
}

.markdown-mermaid-zoom-btn:hover {
	filter: brightness(0.95); /* 轻微悬停反馈 */
}

.markdown-mermaid-zoom-viewport {
	overflow: hidden; /* 裁剪放大后的 SVG */
	cursor: default;
	min-height: 120px;
	max-height: min(70vh, 560px);
	border-radius: 6px;
	border: 1px solid color-mix(in srgb, currentColor 14%, transparent); /* 随正文色弱描边 */
	box-sizing: border-box;
}

.markdown-mermaid-zoom-viewport.is-mermaid-zoom-draggable {
	cursor: grab; /* 可拖提示 */
	touch-action: none; /* 避免触屏滚动抢走拖拽 */
	user-select: none;
	-webkit-user-select: none;
}

.markdown-mermaid-zoom-viewport.is-mermaid-zoom-dragging {
	cursor: grabbing; /* 拖拽中 */
}

.markdown-mermaid-zoom-stage {
	transform-origin: 0 0; /* 与 JS 一致 */
	will-change: transform; /* 提示合成层，拖拽更顺 */
}

.markdown-mermaid-zoom-viewport .markdown-mermaid-zoom-stage svg {
	max-width: none !important; /* 覆盖正文里对 svg 的 max-width，否则放大被压扁 */
	height: auto;
	display: block;
}

body.dark .markdown-mermaid-zoom-chrome button.markdown-mermaid-zoom-btn {
	border-color: rgba(200, 200, 200, 0.45) !important;
	background: rgba(45, 45, 45, 0.96) !important;
	color: #f0f0f0 !important;
}
```

### 4.1 与 `runMermaidInMarkdownRoot` 的衔接（参考）

在 `runMermaidInMarkdownRoot` **开头**与 **`await runQueue` 之后**各调用一次 `attachMermaidZoomUiInRoot(root)`（且由 `enableMermaidZoomUi !== false` 控制），可减轻「全局队列排队导致工具栏晚于 SVG 出现」的观感问题；并在 `useMermaidInMarkdownRoot` 的 `useLayoutEffect` 内、**双 rAF 之前**对 `rootRef.current` 再调一次，保证与 `innerHTML` 同一帧尽量挂上条。

导出：`packages/tools/src/react/index.ts` 导出 `attachMermaidZoomUiInRoot`；样式 `mermaid-zoom-ui.css` 经 `scripts/build-mk-css.js` 并入 `markdown-base.css` / `markdown-styles.css`，宿主另可 `import '@dnhyxc-ai/tools/mermaid-zoom-ui.css'`（以 `package.json` exports 为准）。

### 4.2 助手气泡内可点击（参考：`index.css`）

若外层对 `.markdown-body a` 等设置了 `pointer-events: none`，需对 **`.markdown-mermaid-zoom-chrome` 及其 button** 设回 `pointer-events: auto !important`，否则缩放按钮无法点击。

---

## 5. 工具函数：`mermaidSvgToPreviewDataUrl`（仓库：`apps/frontend/src/utils/mermaidImagePreview.ts`）

逐行说明（与源文件一致）。

```typescript
/**
 * Mermaid 图表点击放大预览：将 DOM 中的 SVG 转为 ImagePreview（<img>）可用的 data URL。
 */

/** 将 Mermaid 渲染得到的 SVG 转为可在 ImagePreview（<img>）中使用的 data URL */
export function mermaidSvgToPreviewDataUrl(svg: SVGElement): string | null {
	try {
		const clone = svg.cloneNode(true) as SVGSVGElement; // 克隆，避免改动页面上正在显示的节点
		if (!clone.getAttribute("xmlns")) {
			clone.setAttribute("xmlns", "http://www.w3.org/2000/svg"); // 独立成 XML 片段时补默认命名空间
		}
		const xml = new XMLSerializer().serializeToString(clone); // 序列化为字符串
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`; // 编码后作为 img.src，避免裸 XML 断行问题
	} catch {
		return null; // 克隆或序列化失败则放弃预览
	}
}
```

---

## 6. Hooks：`useMermaidImagePreview` / `useMermaidDiagramClickPreview`（仓库：`apps/frontend/src/hooks/useMermaidImagePreview.tsx`）

```typescript
import ImagePreview from '@design/ImagePreview'; // 全屏/弹层图片预览组件
import {
	type ReactNode, // 模态节点类型
	type RefObject, // React ref 类型
	useCallback, // 稳定回调引用
	useEffect, // 浏览器端绑定 click
	useRef, // 保存最新 open 函数，避免 effect 频繁依赖变化
	useState, // 预览用 data URL
} from 'react';
import { mermaidSvgToPreviewDataUrl } from '@/utils/mermaidImagePreview'; // SVG → data URL

export type UseMermaidImagePreviewResult = {
	openMermaidPreview: (dataUrl: string) => void; // 外部或委托逻辑调用以打开弹层
	mermaidImagePreviewModal: ReactNode; // 需渲染到组件树中的 ImagePreview
};

export function useMermaidImagePreview(): UseMermaidImagePreviewResult {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null); // null 表示关闭

	const openMermaidPreview = useCallback((dataUrl: string) => {
		setPreviewUrl(dataUrl); // 写入当前预览图 URL
	}, []);

	const onPreviewVisibleChange = useCallback((visible: boolean) => {
		if (!visible) setPreviewUrl(null); // 关闭时释放 URL，避免残留状态
	}, []);

	const onDownload = useCallback((image: { url: string }) => {
		const a = document.createElement('a'); // 触发浏览器下载
		a.href = image.url; // data URL 亦可下载为文件
		a.download = 'mermaid-diagram.svg'; // 建议文件名
		a.rel = 'noopener';
		a.click();
	}, []);

	const mermaidImagePreviewModal = (
		<ImagePreview
			visible={previewUrl !== null} // 有 URL 即显示
			selectedImage={previewUrl ? { url: previewUrl } : { url: '' }} // 组件内部需非 undefined 时可给空串
			onVisibleChange={onPreviewVisibleChange} // 与 Model 关闭联动
			title="Mermaid 图表预览" // 标题文案
			showPrevAndNext={false} // 单图无需切换
			download={onDownload} // 使用 SVG 友好文件名
		/>
	);

	return { openMermaidPreview, mermaidImagePreviewModal };
}

export function useMermaidDiagramClickPreview(
	rootRef: RefObject<HTMLElement | null>, // 委托根：Monaco 预览 div 或 Mermaid 岛 host
	openMermaidPreview: (dataUrl: string) => void, // 来自 useMermaidImagePreview
	enabled: boolean, // 是否启用（如 enableMermaid）
	rebindWhen: unknown, // html / code 等变化时重新绑定，确保 innerHTML 刷新后监听仍有效
): void {
	const openRef = useRef(openMermaidPreview);
	openRef.current = openMermaidPreview; // 始终调用最新 open，无需把 open 放进 effect 依赖

	useEffect(() => {
		if (!enabled) return; // 未启用 Mermaid 则不监听
		const root = rootRef.current;
		if (!root) return; // ref 未挂载

		const onClick = (e: MouseEvent) => {
			const el = e.target as HTMLElement | null;
			if (!el) return;
			if (el.closest('.markdown-mermaid-zoom-chrome')) return; // 缩放工具栏点击不打开 ImagePreview

			const wrap = el.closest('.markdown-mermaid-wrap'); // 多图时定位到当前块
			if (!wrap) return;

			const svg = wrap.querySelector('.mermaid svg') as SVGSVGElement | null; // Mermaid 输出多为 svg
			if (!svg || !svg.contains(el)) return; // 必须点在 SVG 子树上

			const url = mermaidSvgToPreviewDataUrl(svg);
			if (url) openRef.current(url);
		};

		root.addEventListener('click', onClick);
		return () => root.removeEventListener('click', onClick);
	}, [enabled, rebindWhen, rootRef]);
}
```

---

## 7. 围栏拆分与 Mermaid 岛：完整实现思路与逐行注释代码

本节对应 **路径 B**（见 **§1**）：聊天助手 **流式正文** 与 **Monaco Markdown 预览** 在检测到 ```mermaid 围栏时，将 Mermaid 从「整页 `innerHTML`」中拆出，用独立 React 子树（**岛**）承载 DOM 与 `runMermaidInMarkdownRoot`，从而：

- 避免父级频繁 `dangerouslySetInnerHTML` **整段替换**导致已生成的 SVG 被清空或闪烁；
- 让每一块图的 **DSL 变更** 只触发 **本岛** 的 `useLayoutEffect`，与 `useMermaidInMarkdownRoot` 的全局扫描解耦；
- **未闭合** 的 mermaid 围栏（流式尾部）只显示静态代码，不调用 `mermaid.run`。

**模块关系**：`splitMarkdownByCodeFences`（纯函数拆分）→ `StreamingMarkdownBody` / `ParserMarkdownPreviewPane`（按段渲染）→ `MermaidFenceIsland`（单块图）→ `normalizeMermaidFenceBody`（DSL 预处理）→ `runMermaidInMarkdownRoot` → `mermaid.run`。

---

### 7.1 `splitMarkdownByCodeFences`（`apps/frontend/src/utils/splitMarkdownFences.ts`）

仅识别 **顶格** ` ``` ` 围栏（与 markdown-it 常见写法一致）。`mermaid` 且缺少闭合围栏时，`complete: false`。

```typescript
/**
 * 按顶格代码围栏拆分 Markdown，将 mermaid 与其它内容分离。
 * 用于聊天流式：Mermaid 单独 React 岛渲染，避免整段 dangerouslySetInnerHTML 冲掉已生成的 SVG。
 */

export type MarkdownFencePart =
	| { type: 'markdown'; text: string } // 非 mermaid 围栏聚合后的正文片段
	| { type: 'mermaid'; text: string; complete: boolean }; // mermaid 围栏 body；complete 表示是否已闭合

function coalesceMarkdownParts(
	parts: MarkdownFencePart[],
): MarkdownFencePart[] {
	const out: MarkdownFencePart[] = [];
	for (const p of parts) {
		if (p.type === 'markdown' && p.text === '') continue; // 去掉空 md 段，减少无效节点
		const last = out[out.length - 1];
		if (p.type === 'markdown' && last?.type === 'markdown') {
			last.text += p.text; // 相邻 md 段合并，稳定 map key 与 DOM 块数
		} else {
			out.push(
				p.type === 'markdown' ? { type: 'markdown', text: p.text } : { ...p },
			);
		}
	}
	return out;
}

/**
 * 扫描 ```lang 围栏；mermaid 且未闭合时 `complete: false`（流式尾部）。
 */
export function splitMarkdownByCodeFences(source: string): MarkdownFencePart[] {
	const out: MarkdownFencePart[] = [];
	let i = 0; // 当前扫描指针
	const n = source.length;

	while (i < n) {
		const fenceStart = source.indexOf('```', i); // 下一个围栏起点
		if (fenceStart === -1) {
			const tail = source.slice(i);
			if (tail) out.push({ type: 'markdown', text: tail }); // 剩余全是 md
			break;
		}
		if (fenceStart > i) {
			out.push({ type: 'markdown', text: source.slice(i, fenceStart) }); // 围栏前的 md
		}
		const langEnd = source.indexOf('\n', fenceStart + 3); // 语言行结束
		if (langEnd === -1) {
			out.push({ type: 'markdown', text: source.slice(fenceStart) }); // 畸形：无换行，整段当 md
			break;
		}
		const lang = source
			.slice(fenceStart + 3, langEnd)
			.trim()
			.toLowerCase(); // 围栏语言标记，如 mermaid
		const bodyStart = langEnd + 1; // body 起始（跳过首 newline）
		const closeIdx = source.indexOf('```', bodyStart); // 闭合围栏
		if (closeIdx === -1) {
			if (lang === 'mermaid') {
				out.push({
					type: 'mermaid',
					text: source.slice(bodyStart),
					complete: false, // 流式未闭合：不跑 Mermaid
				});
			} else {
				out.push({ type: 'markdown', text: source.slice(fenceStart) }); // 其它语言未闭合：保持原样 md
			}
			break;
		}
		const body = source.slice(bodyStart, closeIdx); // 围栏内原文（不含 ```）
		if (lang === 'mermaid') {
			out.push({ type: 'mermaid', text: body, complete: true });
		} else {
			out.push({
				type: 'markdown',
				text: source.slice(fenceStart, closeIdx + 3), // 非 mermaid 围栏整体保留为 md，交给 MarkdownParser
			});
		}
		i = closeIdx + 3; // 继续扫描闭合 ``` 之后
	}

	if (out.length === 0 && source) {
		out.push({ type: 'markdown', text: source }); // 全文无围栏
	}
	return coalesceMarkdownParts(out);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** 未闭合 mermaid 围栏：纯代码预览（不跑 Mermaid，避免语法不完整报错与整页重绘） */
export function mermaidStreamingFallbackHtml(code: string): string {
	const esc = escapeHtml(code);
	return `<div class="markdown-body"><pre class="chat-md-mermaid-streaming"><code class="language-mermaid">${esc}</code></pre></div>`;
}
```

---

### 7.2 `MermaidFenceIsland`（`apps/frontend/src/components/design/MermaidFenceIsland.tsx`）

单块闭合 mermaid 的 **宿主 div**：在 `useLayoutEffect` 内写入与 `patchMermaidFence` **同构**的最简占位 HTML，再用 **`textContent`** 写入预处理后的 DSL（避免 XSS），最后 **双 `requestAnimationFrame`** 后调用 `runMermaidInMarkdownRoot(host)`，与 `useMermaidInMarkdownRoot` 的节拍一致。

```typescript
/**
 * 单块 ```mermaid 围栏：独立 DOM 岛 + runMermaidInMarkdownRoot，
 * 避免父级整段 dangerouslySetInnerHTML 替换冲掉 SVG。
 */

import { normalizeMermaidFenceBody } from '@dnhyxc-ai/tools'; // DSL 预处理（换行、部分方括号补引号）
import { runMermaidInMarkdownRoot } from '@dnhyxc-ai/tools/react'; // 在 host 子树内 mermaid.run
import { memo, useLayoutEffect, useRef } from 'react';
import { useMermaidDiagramClickPreview } from '@/hooks/useMermaidImagePreview'; // 点击 SVG → 大图预览
import { cn } from '@/lib/utils';

export type MermaidFenceIslandProps = {
	code: string; // 单块围栏 body（不含 ```）
	preferDark: boolean; // 与主题联动，传入 mermaid.initialize 风格由 run 内部处理
	/** 流式中间态时抑制 Mermaid 报错闪烁 */
	isStreaming?: boolean;
	openMermaidPreview?: (dataUrl: string) => void; // 可选：启用点击放大
};

const noopOpenPreview = (_dataUrl: string) => {}; // 无回调时给 hook 的稳定函数

export const MermaidFenceIsland = memo(function MermaidFenceIsland({
	code,
	preferDark,
	isStreaming = false,
	openMermaidPreview,
}: MermaidFenceIslandProps) {
	const hostRef = useRef<HTMLDivElement>(null); // 外层宿主，innerHTML 重建 wrap
	const genRef = useRef(0); // 代数，用于作废过期的 rAF 回调
	/** 不参与 effect 依赖，避免停流时整岛 innerHTML 重跑导致闪屏 */
	const isStreamingRef = useRef(isStreaming);
	isStreamingRef.current = isStreaming; // 每次渲染同步最新流式标志

	const previewEnabled = Boolean(openMermaidPreview); // 是否注册点击预览

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		host.innerHTML =
			'<div class="markdown-mermaid-wrap" data-mermaid="1"><div class="mermaid"></div></div>'; // 与 MarkdownParser 占位一致
		const inner = host.querySelector('.mermaid') as HTMLElement | null;
		if (!inner) return;
		inner.textContent = normalizeMermaidFenceBody(code); // 文本节点写入 DSL

		const runId = ++genRef.current;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (runId !== genRef.current) return; // 快速连续更新时只保留最后一次
				void runMermaidInMarkdownRoot(host, {
					preferDark,
					suppressErrors: isStreamingRef.current, // 流式 true 时抑制错误占位闪烁
				});
			});
		});
	}, [code, preferDark]);

	useMermaidDiagramClickPreview(
		hostRef,
		openMermaidPreview ?? noopOpenPreview,
		previewEnabled,
		code, // rebindWhen：code 变则 DOM 已换，需重绑捕获
	);

	return (
		<div
			ref={hostRef}
			className={cn(
				'mermaid-island-root w-full',
				previewEnabled && '[&_.markdown-mermaid-wrap_.mermaid]:cursor-zoom-in',
			)}
		/>
	);
});
```

---

### 7.3 `StreamingMarkdownBody`（`apps/frontend/src/components/design/ChatAssistantMessage/StreamingMarkdownBody.tsx`）

助手消息 **不再内联** 岛组件实现，而是 **import `MermaidFenceIsland`**；`parser` 仍用于各 **markdown 段**（通常 `enableMermaid: false`，避免与岛重复占位，见聊天侧 `ChatAssistantMessage` 配置）。

```typescript
/**
 * 将正文按围栏拆块：普通 Markdown 仍用 innerHTML，mermaid 用独立 DOM 岛 + runMermaidInMarkdownRoot，
 * 避免流式时整段替换冲掉 SVG、造成全文闪烁。
 */

import { MermaidFenceIsland } from '@design/MermaidFenceIsland'; // 共享岛组件
import type { MarkdownParser } from '@dnhyxc-ai/tools';
import { type RefObject, useMemo } from 'react';
import { useMermaidImagePreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';
import {
	mermaidStreamingFallbackHtml,
	splitMarkdownByCodeFences,
} from '@/utils/splitMarkdownFences';

export type StreamingMarkdownBodyProps = {
	markdown: string;
	parser: MarkdownParser;
	className?: string;
	preferDark: boolean;
	isStreaming: boolean;
	containerRef?: RefObject<HTMLDivElement | null>;
};

export function StreamingMarkdownBody({
	markdown,
	parser,
	className,
	preferDark,
	isStreaming,
	containerRef,
}: StreamingMarkdownBodyProps) {
	const parts = useMemo(() => splitMarkdownByCodeFences(markdown), [markdown]); // 拆块结果缓存
	const { openMermaidPreview, mermaidImagePreviewModal } =
		useMermaidImagePreview(); // 单条消息一个 ImagePreview 弹层

	return (
		<div ref={containerRef} className={cn('streaming-md-body', className)}>
			{parts.map((part, i) => {
				if (part.type === 'markdown') {
					return (
						<div
							key={`md-${i}`}
							dangerouslySetInnerHTML={{ __html: parser.render(part.text) }}
						/>
					);
				}
				if (!part.complete) {
					return (
						<div
							key={`mm-open-${i}`}
							dangerouslySetInnerHTML={{
								__html: mermaidStreamingFallbackHtml(part.text),
							}}
						/>
					);
				}
				return (
					<MermaidFenceIsland
						key={`mm-done-${i}`}
						code={part.text}
						preferDark={preferDark}
						isStreaming={isStreaming}
						openMermaidPreview={openMermaidPreview}
					/>
				);
			})}
			{mermaidImagePreviewModal}
		</div>
	);
}
```

---

### 7.4 `normalizeMermaidFenceBody` 与 `patchMermaidFence`（`packages/tools/src/markdown-parser.ts`）

- **`normalizeMermaidFenceBody`**：导出函数；`\r\n`/`\r` → `\n`；对 **未加引号** 且含 **`/`** 或 **`+`** 的 `subgraph … […]` / `nodeId[…]` 自动包一层双引号（跳过 `[/…/]` 梯形节点外观）。降低 Mermaid 解析失败导致预览只剩 DSL 文本的概率。
- **`patchMermaidFence`**：在 `escapeHtml` **之前**调用 `normalizeMermaidFenceBody(token.content)`，再写入占位 div（**路径 A** 的 HTML 输出与岛内 `textContent` 使用同一套预处理）。

下列为相关函数与 fence 分支的 **逐行注释摘录**（与源文件顺序一致）。

```typescript
/** 梯形等节点：[/.../]，勿对其中的 / 做自动加引号 */
function mermaidBracketLabelLooksTrapezoid(label: string): boolean {
	const t = label.trim();
	return t.length >= 3 && t.startsWith('/') && t.endsWith('/');
}

const MERMAID_FLOWCHART_ID_SKIP = new Set([
	'subgraph',
	'end',
	'flowchart',
	'graph',
	'direction',
	'classDef',
	'class',
	'linkStyle',
	'click',
	'style',
	'break',
	'continue',
]);

function escapeMermaidDoubleQuotedLabelInner(raw: string): string {
	return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * 为未加引号且含 / 或 + 的方括号文案补双引号，减轻 Mermaid 解析失败（预览区只剩 DSL 文本）。
 * 不改变已带引号的片段；跳过梯形 [/.../]。
 */
function relaxMermaidBracketLabels(body: string): string {
	let text = body;
	text = text.replace(
		/(^|\n)([\t ]*subgraph\s+\S+\s+)\[([^\]\r\n]+)\]/g,
		(full, lead, pre, title) => {
			const raw = title as string;
			const t = raw.trim();
			if (t.startsWith('"') || mermaidBracketLabelLooksTrapezoid(raw)) {
				return full;
			}
			if (t.includes('/') || t.includes('+')) {
				return `${lead}${pre}["${escapeMermaidDoubleQuotedLabelInner(raw)}"]`;
			}
			return full;
		},
	);
	text = text.replace(
		/\b([A-Za-z_][\w]*)\[([^\]\r\n]*)\]/g,
		(full, id, label) => {
			if (MERMAID_FLOWCHART_ID_SKIP.has(id)) return full;
			const raw = label as string;
			const t = raw.trim();
			if (t.startsWith('"') || mermaidBracketLabelLooksTrapezoid(raw)) {
				return full;
			}
			if (t.includes('/') || t.includes('+')) {
				return `${id}["${escapeMermaidDoubleQuotedLabelInner(raw)}"]`;
			}
			return full;
		},
	);
	return text;
}

/**
 * Mermaid 围栏源码预处理：统一换行，并对含 /、+ 的未加引号方括号文案补引号。
 * 供 MarkdownParser 与流式 Mermaid 岛等共用。
 */
export function normalizeMermaidFenceBody(body: string): string {
	const eol = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	return relaxMermaidBracketLabels(eol);
}

// —— 以下为类内 patchMermaidFence 中与预处理衔接的片段 ——

private patchMermaidFence(): void {
	const md = this.md;
	const prev = md.renderer.rules.fence;
	if (!prev) return;
	md.renderer.rules.fence = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		const info = token.info
			? md.utils.unescapeAll(String(token.info)).trim()
			: '';
		const langName = info.split(/\s+/g)[0] || '';
		if (langName.toLowerCase() === 'mermaid') {
			const body = md.utils.escapeHtml(
				normalizeMermaidFenceBody(token.content),
			);
			return (
				'<div class="markdown-mermaid-wrap" data-mermaid="1">' +
				'<div class="mermaid">' +
				body +
				'</div></div>\n'
			);
		}
		return prev(tokens, idx, options, env, self);
	};
}
```

---

## 8. Monaco 预览：`ParserMarkdownPreviewPane`（`apps/frontend/src/components/design/Monaco/index.tsx`）

### 8.1 行为概要

- **`fenceParts`**：`splitMarkdownByCodeFences(markdown)`。
- **`hasMermaidIslandLayout`**：`enableMermaid && fenceParts` 中存在 `type === 'mermaid'`。为 true 时走 **路径 B**（与聊天一致：按段 map + `MermaidFenceIsland`）；为 false 时走 **路径 A**（整段 `parser.render` + 子节点单层 `dangerouslySetInnerHTML`）。
- **`parserNoMermaid`**：`enableMermaid: false`，仅用于 **路径 B** 下的 markdown 段，避免围栏内再输出 mermaid 占位（围栏已被拆出）。
- **`html`**：路径 B 时为 `''`（占位，避免无意义全量 render）；路径 A 时为 `parser.render(markdown)`。
- **`mermaidRootScanParser`**：`{ enableMermaid: enableMermaid && !hasMermaidIslandLayout }`。路径 B 下为 false，`useMermaidInMarkdownRoot` 早退，**不在预览根上重复** `mermaid.run`。
- **`useMermaidInMarkdownRoot`**：`trigger` 在路径 B 用 **`markdown`**（内容变则 effect 依赖仍更新），路径 A 用 **`html`**。
- **`useMermaidDiagramClickPreview`**：`rebindWhen` 同步为 **`hasMermaidIslandLayout ? markdown : html`**，保证岛或整页替换后点击委托重建。
- **预览根 `className`**：仍含 `[&_.markdown-mermaid-wrap_.mermaid]:cursor-zoom-in`（岛内结构一致）。
- **分屏标题同步**：`buildHeadingScrollCache` 使用 `viewport.querySelectorAll('[data-md-heading-line]')`，多块 `.markdown-body` 仍在同一视口内，行为保持有效。

### 8.2 关键代码（逐行注释摘录）

下列从 `ParserMarkdownPreviewPane` 内部截取 **围栏判定、双 parser、hook 与 JSX 分支**，行尾注释说明意图。

```typescript
const fenceParts = useMemo(
	() => splitMarkdownByCodeFences(markdown),
	[markdown],
);
const hasMermaidIslandLayout = Boolean(
	enableMermaid && fenceParts.some((p) => p.type === 'mermaid'),
);

const parser = useMemo(
	() =>
		new MarkdownParser({
			highlightTheme: getChatMarkdownHighlightTheme(theme),
			enableChatCodeFenceToolbar: true,
			enableHeadingSourceLineAttr: true,
			enableHeadingAnchorIds: true,
			enableMermaid,
		}),
	[theme, enableMermaid],
);

const parserNoMermaid = useMemo(
	() =>
		new MarkdownParser({
			highlightTheme: getChatMarkdownHighlightTheme(theme),
			enableChatCodeFenceToolbar: true,
			enableHeadingSourceLineAttr: true,
			enableHeadingAnchorIds: true,
			enableMermaid: false,
		}),
	[theme],
);

const html = useMemo(() => {
	if (hasMermaidIslandLayout) return '';
	return parser.render(markdown);
}, [hasMermaidIslandLayout, parser, markdown]);

const mermaidRootScanParser = useMemo(
	() => ({
		enableMermaid: enableMermaid && !hasMermaidIslandLayout,
	}),
	[enableMermaid, hasMermaidIslandLayout],
);

useMermaidInMarkdownRoot({
	rootRef: previewHtmlRootRef,
	preferDark: theme === 'black',
	trigger: hasMermaidIslandLayout ? markdown : html,
	parser: mermaidRootScanParser,
});

const { openMermaidPreview, mermaidImagePreviewModal } =
	useMermaidImagePreview();

useMermaidDiagramClickPreview(
	previewHtmlRootRef,
	openMermaidPreview,
	enableMermaid,
	hasMermaidIslandLayout ? markdown : html,
);

// —— 预览内容区（缩略外层 ScrollArea，仅示 ref 与 innerHTML 分支）——

<div ref={previewHtmlRootRef} className={cn(/* …与 Mermaid 光标样式… */)}>
	{hasMermaidIslandLayout ? (
		fenceParts.map((part, i) => {
			if (part.type === 'markdown') {
				return (
					<div
						key={`pv-${i}`}
						dangerouslySetInnerHTML={{
							__html: parserNoMermaid.render(part.text),
						}}
					/>
				);
			}
			if (!part.complete) {
				return (
					<div
						key={`pv-${i}`}
						dangerouslySetInnerHTML={{
							__html: mermaidStreamingFallbackHtml(part.text),
						}}
					/>
				);
			}
			return (
				<MermaidFenceIsland
					key={`pv-${i}`}
					code={part.text}
					preferDark={theme === 'black'}
					openMermaidPreview={openMermaidPreview}
				/>
			);
		})
	) : (
		<div dangerouslySetInnerHTML={{ __html: html }} />
	)}
</div>
```

同文件根部仍渲染 `{mermaidImagePreviewModal}`，与 **§6** 一致。

---

## 9. 构建与开发注意事项

- **`@dnhyxc-ai/tools`**：修改 `src` 后执行 `pnpm --filter @dnhyxc-ai/tools run build`，前端才能读到最新 `dist`。
- **Vite**：若将 `@dnhyxc-ai/tools/react` 放入 `optimizeDeps.include`，包内**新增导出**后可能缓存旧预构建，出现 `Importing binding ... is not found`；可对 `@dnhyxc-ai/tools/react` 使用 `optimizeDeps.exclude` 或清 `node_modules/.vite` 并 `--force`。
- **流式未闭合** ` ```mermaid `：仅展示代码 fallback，**不**执行 `mermaid.run`，因此无 SVG、无预览/缩放块——属预期。

---

## 10. 文件索引（便于检索）

| 能力                       | 典型路径                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Fence 占位 + DSL 预处理    | `packages/tools/src/markdown-parser.ts`（`patchMermaidFence`、`normalizeMermaidFenceBody` 等）        |
| `normalizeMermaidFenceBody` 导出 | `packages/tools/src/index.ts`（再导出供前端 `@dnhyxc-ai/tools` 引用）                             |
| `mermaid.run` 与队列       | `packages/tools/src/mermaid-in-markdown.ts`                                                            |
| React 调度                 | `packages/tools/src/react/use-mermaid-in-markdown-root.ts`                                             |
| 按围栏拆分                 | `apps/frontend/src/utils/splitMarkdownFences.ts`                                                       |
| 单块 Mermaid 岛            | `apps/frontend/src/components/design/MermaidFenceIsland.tsx`                                           |
| 缩放 UI（参考）            | `mermaid-zoom-ui.ts` + `mermaid-zoom-ui.css`（若存在于分支）                                           |
| SVG → data URL             | `apps/frontend/src/utils/mermaidImagePreview.ts`                                                       |
| 预览 Hooks                 | `apps/frontend/src/hooks/useMermaidImagePreview.tsx`                                                   |
| 聊天流式正文               | `apps/frontend/src/components/design/ChatAssistantMessage/StreamingMarkdownBody.tsx`                   |
| Monaco Markdown 预览       | `apps/frontend/src/components/design/Monaco/index.tsx`（`ParserMarkdownPreviewPane`）                    |

---

_文档与仓库具体文件可能随分支差异略有不同；以当前 `git` 树为准。缺失的缩放模块可按 §3～§4 参考实现补回。_
