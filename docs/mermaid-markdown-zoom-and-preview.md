# Mermaid 在 Markdown 中的缩放与预览：实现说明

本文说明在应用内渲染 `mermaid` 围栏后，**工具栏缩放 / 平移**（可选模块）与**点击弹出 ImagePreview 大图预览**（当前前端已接入）的完整思路、DOM 约定、数据流与代码级注释。

---

## 1. 总体架构

```text
Markdown 源码
    ↓
MarkdownParser（markdown-it fence 覆写）→ 输出占位 HTML（.markdown-mermaid-wrap + .mermaid）
    ↓
dangerouslySetInnerHTML / 流式「Mermaid 岛」写入 DOM
    ↓
useMermaidInMarkdownRoot（双 rAF）→ runMermaidInMarkdownRoot → mermaid.run({ nodes })
    ↓
[可选] attachMermaidZoomUiInRoot：为每块 wrap 挂工具栏 + viewport + transform 拖拽
    ↓
[可选] useMermaidDiagramClickPreview：点击 SVG 区域 → data URL → ImagePreview
```

- **渲染入口**：`@dnhyxc-ai/tools` 的 `MarkdownParser` 在 `enableMermaid !== false` 时对 ` ```mermaid ` 输出固定 class / data 的占位节点；`@dnhyxc-ai/tools/react` 的 `useMermaidInMarkdownRoot` / `runMermaidInMarkdownRoot` 在浏览器里执行 `mermaid.run`。
- **全局队列**：`mermaid-in-markdown.ts` 内用 `runQueue` 串行化多次 `mermaid.run`，避免并发打乱 Mermaid 内部状态。
- **缩放（可选）**：在占位 HTML 中预置「工具栏槽 + 视口 + 舞台」三层结构，由独立脚本绑定按钮与 `transform`，**不使用滚轮缩放**；仅当 `scale ≠ 1` 时在视口内 **pointer 拖拽**平移。
- **预览（当前仓库）**：`mermaidSvgToPreviewDataUrl` 将 SVG 序列化为 `data:image/svg+xml`，交给 `ImagePreview`；点击委托需 **忽略** `.markdown-mermaid-zoom-chrome`，避免与缩放按钮冲突。

> **与当前仓库对齐**：截至文档编写时，`packages/tools` 中 **可能仅有**「单层 `wrap` + `.mermaid`」的 parser 输出与精简版 `mermaid-in-markdown.ts`。下文 **§3、§4** 给出「带缩放壳」时的**参考实现**（可单独恢复为 `mermaid-fence-html.ts`、`mermaid-zoom-ui.ts` 等）。**§5～§8** 与现有文件 `apps/frontend/src/utils/mermaidImagePreview.ts`、`hooks/useMermaidImagePreview.tsx` 等一致。

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

## 7. 聊天流式：`StreamingMarkdownBody`（仓库：`.../ChatAssistantMessage/StreamingMarkdownBody.tsx`）逐行注释版

下列与当前源文件结构一致；行尾注释说明该行职责。

```typescript
/**
 * 将正文按围栏拆块：普通 Markdown 仍用 innerHTML，mermaid 用独立 DOM 岛 + runMermaidInMarkdownRoot，
 * 避免流式时整段替换冲掉 SVG、造成全文闪烁。
 */

import type { MarkdownParser } from '@dnhyxc-ai/tools'; // 解析器类型（enableMermaid 等）
import { runMermaidInMarkdownRoot } from '@dnhyxc-ai/tools/react'; // 在已挂载 DOM 上执行 mermaid.run
import {
	memo, // 岛组件避免父级重渲时无谓刷新
	type RefObject,
	useLayoutEffect, // 在浏览器绘制前写入 innerHTML 并调度 rAF
	useMemo, // 拆分围栏结果缓存
	useRef,
} from 'react';
import {
	useMermaidDiagramClickPreview, // 点击 SVG → 打开 ImagePreview
	useMermaidImagePreview, // 弹层状态 + ImagePreview 节点
} from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils'; // className 合并
import {
	mermaidStreamingFallbackHtml, // 未闭合 mermaid 围栏的静态 HTML
	splitMarkdownByCodeFences, // 按代码围栏切分正文
} from '@/utils/splitMarkdownFences';

type MermaidIslandProps = {
	code: string; // 单块 mermaid DSL
	preferDark: boolean; // 传给 mermaid 主题
	isStreaming: boolean; // 流式中 suppressErrors
	openMermaidPreview?: (dataUrl: string) => void; // 父级注入：打开大图预览
};

const noopOpenPreview = (_dataUrl: string) => {}; // 未传预览回调时的占位，避免 hook 报 undefined

const MermaidIsland = memo(function MermaidIsland({
	code,
	preferDark,
	isStreaming,
	openMermaidPreview,
}: MermaidIslandProps) {
	const hostRef = useRef<HTMLDivElement>(null); // 命令式 DOM 根
	const genRef = useRef(0); // 代数：作废过期的双 rAF
	const isStreamingRef = useRef(isStreaming); // 闭包内读最新流式状态
	isStreamingRef.current = isStreaming;

	const previewEnabled = Boolean(openMermaidPreview); // 是否挂载点击预览

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		host.innerHTML =
			'<div class="markdown-mermaid-wrap" data-mermaid="1"><div class="mermaid"></div></div>'; // 与 parser 输出结构一致（无缩放壳时为最简）
		const inner = host.querySelector('.mermaid') as HTMLElement | null;
		if (!inner) return;
		inner.textContent = code; // 文本方式写入 DSL，避免 HTML 注入

		const runId = ++genRef.current;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (runId !== genRef.current) return; // 已过期则放弃
				void runMermaidInMarkdownRoot(host, {
					preferDark,
					suppressErrors: isStreamingRef.current, // 流式中间态减少报错闪烁
				});
			});
		});
	}, [code, preferDark]);

	useMermaidDiagramClickPreview(
		hostRef,
		openMermaidPreview ?? noopOpenPreview,
		previewEnabled,
		code, // code 变 → 重绑监听（innerHTML 已换）
	);

	return (
		<div
			ref={hostRef}
			className={cn(
				'mermaid-island-root w-full',
				previewEnabled &&
					'[&_.markdown-mermaid-wrap_.mermaid]:cursor-zoom-in', // 提示可点击预览
			)}
		/>
	);
});

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
	const parts = useMemo(() => splitMarkdownByCodeFences(markdown), [markdown]); // md 段 + mermaid 段
	const { openMermaidPreview, mermaidImagePreviewModal } =
		useMermaidImagePreview(); // 整块消息共用一个预览弹层

	return (
		<div ref={containerRef} className={cn('streaming-md-body', className)}>
			{parts.map((part, i) => {
				if (part.type === 'markdown') {
					return (
						<div
							key={`md-${i}`}
							dangerouslySetInnerHTML={{ __html: parser.render(part.text) }} // 普通 Markdown 一段
						/>
					);
				}
				if (!part.complete) {
					return (
						<div
							key={`mm-open-${i}`}
							dangerouslySetInnerHTML={{
								__html: mermaidStreamingFallbackHtml(part.text), // 流式未闭合：只显示代码
							}}
						/>
					);
				}
				return (
					<MermaidIsland
						key={`mm-done-${i}`}
						code={part.text}
						preferDark={preferDark}
						isStreaming={isStreaming}
						openMermaidPreview={openMermaidPreview}
					/>
				);
			})}
			{mermaidImagePreviewModal} // ImagePreview 挂在流式容器内
		</div>
	);
}
```

---

## 8. Monaco 预览：`ParserMarkdownPreviewPane` 接线要点（仓库：`.../Monaco/index.tsx`）

- `useMermaidInMarkdownRoot({ rootRef: previewHtmlRootRef, trigger: html, … })`：与 `dangerouslySetInnerHTML` 同层的 ref，保证扫描到 `.mermaid`。
- `useMermaidImagePreview` + `useMermaidDiagramClickPreview(previewHtmlRootRef, openMermaidPreview, enableMermaid, html)`：**rebindWhen 使用 `html`**，编辑时预览更新后监听重建。
- 预览容器 `className` 在 `enableMermaid` 时追加 `[&_.markdown-mermaid-wrap_.mermaid]:cursor-zoom-in`。
- 在预览面板根部渲染 `{mermaidImagePreviewModal}`。

---

## 9. 构建与开发注意事项

- **`@dnhyxc-ai/tools`**：修改 `src` 后执行 `pnpm --filter @dnhyxc-ai/tools run build`，前端才能读到最新 `dist`。
- **Vite**：若将 `@dnhyxc-ai/tools/react` 放入 `optimizeDeps.include`，包内**新增导出**后可能缓存旧预构建，出现 `Importing binding ... is not found`；可对 `@dnhyxc-ai/tools/react` 使用 `optimizeDeps.exclude` 或清 `node_modules/.vite` 并 `--force`。
- **流式未闭合** ` ```mermaid `：仅展示代码 fallback，**不**执行 `mermaid.run`，因此无 SVG、无预览/缩放块——属预期。

---

## 10. 文件索引（便于检索）

| 能力                 | 典型路径                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Fence 占位 HTML      | `packages/tools/src/markdown-parser.ts`（`patchMermaidFence`）；扩展时可用独立 `mermaid-fence-html.ts` |
| `mermaid.run` 与队列 | `packages/tools/src/mermaid-in-markdown.ts`                                                            |
| React 调度           | `packages/tools/src/react/use-mermaid-in-markdown-root.ts`                                             |
| 缩放 UI（参考）      | `mermaid-zoom-ui.ts` + `mermaid-zoom-ui.css`（若存在于分支）                                           |
| SVG → data URL       | `apps/frontend/src/utils/mermaidImagePreview.ts`                                                       |
| 预览 Hooks           | `apps/frontend/src/hooks/useMermaidImagePreview.tsx`                                                   |
| 聊天                 | `apps/frontend/src/components/design/ChatAssistantMessage/StreamingMarkdownBody.tsx`                   |
| 编辑器预览           | `apps/frontend/src/components/design/Monaco/index.tsx`                                                 |

---

_文档与仓库具体文件可能随分支差异略有不同；以当前 `git` 树为准，缺失模块可按 §3～§4 参考实现补回。_
