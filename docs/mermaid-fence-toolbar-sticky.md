# Mermaid 围栏工具条：吸顶与双态样式

本文说明助手流式正文（`StreamingMarkdownBody`）中，**每块 ` ```mermaid ` 围栏**上方工具条的实现思路：为何用 **`position: sticky`**、如何用 **哨兵（sentinel）+ `IntersectionObserver`** 区分「自然位置 / 已粘顶」两套样式，以及为何**不**走与 Markdown 代码块相同的 **Portal 浮动条**方案。实现代码位于 **`apps/frontend/src/components/design/MermaidFenceToolbar/index.tsx`**，组装逻辑在 **`apps/frontend/src/components/design/ChatAssistantMessage/StreamingMarkdownBody.tsx`**。**§9、§10** 收录上述文件的**完整源码**及**逐段详细注释表**（含 Markdown 围栏转义说明）。**§12** 补充 **Monaco `ParserMarkdownPreviewPane`**（知识库等通过 **`MarkdownEditor`** 复用的预览）如何对齐同一套工具条与吸顶，及与聊天侧的细微差异。

相关文档：

- 代码块全局浮动吸顶（Portal + 几何计算）：[`use-chat-code-floating-toolbar.md`](./use-chat-code-floating-toolbar.md)、[`@/utils/chatCodeToolbar`](../apps/frontend/src/utils/chatCodeToolbar.ts)
- Mermaid 岛与流式渲染总览：[`mermaid-markdown-zoom-and-preview.md`](./mermaid-markdown-zoom-and-preview.md) 路径 B

---

## 1. 需求与约束

| 目标 | 说明 |
| ---- | ---- |
| 吸顶 | 在聊天主列表 **ScrollArea Viewport** 内滚动时，Mermaid 块上方的操作栏（切换代码/图表、复制、预览）能贴在滚动区域顶部，便于长图操作。 |
| 粘顶时样式 | 与 **`ChatCodeToolbarFloating`**（[`ChatCodeToolBar/index.tsx`](../apps/frontend/src/components/design/ChatCodeToolBar/index.tsx)）一致：圆角块、浅底、阴影、`backdrop-blur`。 |
| 未粘顶时样式 | 与历史一致：仅 **`rounded-t-md`** + **`bg-theme-background/50`**，无额外水平内边距、无阴影、无毛玻璃，与下方图表区域视觉上「顶边圆角衔接」。 |
| 不影响流式 | **不得**改变 **`MermaidFenceIsland`** 的 props、DOM 层级或离屏 stage 逻辑；工具条仅包裹在岛外同级/上方，避免 `overflow` / Portal 破坏测量或引发多余重挂载。 |

---

## 2. 为何不用代码块同款 Portal 吸顶

Markdown **围栏代码块**的工具栏在 **`@/utils/chatCodeToolbar`** 中通过 **`layoutChatCodeToolbars(viewport)`** 扫描 **`[data-chat-code-block]`** 等节点，把几何写入 store，再由 **`ChatCodeToolbarFloating`** 用 **`createPortal`** 挂到 **`document.body`**。原因是：在 **ScrollArea** 子树里若对子元素用 **`position: fixed`**，参照系容易与「视口内看到的滚动区域」不一致（见 `chatCodeToolbar.ts` 文件头注释）。

Mermaid 工具条**没有**复用该套机制，主要考虑：

1. **注册成本**：Portal 方案需要把每块 mermaid 纳入同一套 pin/slot 布局或另开一套 store；Mermaid 块无 **`data-chat-code-block`** 结构，硬接会扩大 `chatCodeToolbar` 职责。
2. **sticky 在 Viewport 内可用**：聊天列表的滚动节点是 Radix **`ScrollAreaPrimitive.Viewport`**（`data-slot="scroll-area-viewport"`）。**`sticky`** 的滚动容器正是该 viewport 时，**在滚动子树内即可正确粘顶**，无需挂 body。
3. **流式与预览 DOM**：预览按钮依赖 **`data-mermaid-preview-scope`** 下 **`.markdown-mermaid-wrap .mermaid svg`**。工具条留在同一 React 子树内，**`closest` 查询范围不变**；若改为独立 Portal，需额外传 ref/坐标，易错。

因此采用 **纯 CSS `sticky` + 轻量 JS 仅用于切换 class**，与 **`MermaidFenceIsland`** 解耦。

---

## 3. 总体数据流

```text
StreamingMarkdownBody.renderMermaidPart
    ↓
<MermaidFenceToolbar blockId={blockId}>  ← 子组件：哨兵 + sticky 容器 + children（按钮区）
    ↓
（可选）代码模式：mermaidStreamingFallbackHtml
    ↓
diagram 模式：MermaidFenceIsland（code / isStreaming 等不变）
```

- 外层 **`[data-mermaid-preview-scope={blockId}]`** 仍包一整块（工具条 + 内容），**`className="mt-4.5"`** 保留块与块之间的垂直间距（原先在工具条上的 **`mt-4.5`** 挪到容器，避免写在 sticky 节点上导致边距与粘滞边界怪异）。

---

## 4. `MermaidFenceToolbar` 实现要点

### 4.1 双套 class（常量）

| 常量 | 作用 |
| ---- | ---- |
| **`MERMAID_TOOLBAR_RESTING_CHROME`** | 未粘顶：`rounded-t-md bg-theme-background/50`。 |
| **`MERMAID_TOOLBAR_PINNED_CHROME`** | 已粘顶：与浮动代码条对齐的 `rounded-md`、阴影、`backdrop-blur`（具体 Tailwind 与 `ChatCodeToolbarFloating` 中 node 的 `className` 对齐）。 |

### 4.2 哨兵 + `IntersectionObserver`

浏览器**没有**稳定的「`:stuck`」伪类可用来切换样式。常见做法是：

1. 在 **sticky 元素正上方** 放置 **1px 高**、**不占交互**的 **`div`**（哨兵）。
2. **`IntersectionObserver`** 的 **`root`** 设为滚动容器（此处为 **`sentinel.closest('[data-slot="scroll-area-viewport"]')`**），对哨兵观察 **`isIntersecting`**。
3. 当用户向下滚动、sticky 条贴顶时，哨兵会先移出滚动根的可见区域 → **`isIntersecting === false`** → 认为 **已粘顶**，切换为 **`MERMAID_TOOLBAR_PINNED_CHROME`**。

**`blockId` 作为 `useLayoutEffect` 依赖**：同一块在流式过程中可能从「开放尾」id 切到「内容 hash」id（或索引变化），Observer 需 **`disconnect` 后重建**，避免观察过期节点。

**`root` 为 `null`**：若页面不在 ScrollArea 内（例如部分预览），`closest` 得到 **`null`**，按规范等价于以 **视口** 为 root；此时 sticky 的滚动参照仍可能为其它祖先，粘顶判定在少数布局下可能不完全一致，主场景为聊天 **ScrollArea**。

### 4.3 sticky 容器上的其它 class

- **`sticky top-0 z-10`**：`z-10` 保证条在**同一块**内盖过下方 SVG，避免滚动时图表盖住按钮。
- **`flex h-8 select-none items-center justify-between gap-2`**：与历史工具条布局一致；粘顶与否只切换「皮肤」常量，**不动子节点结构**。

### 4.4 哨兵节点属性

- **`h-px w-full shrink-0`**：占高度极小，宽度撑满，flex 下不收缩。
- **`pointer-events-none`**：不抢点击。
- **`aria-hidden`**：辅助技术忽略装饰性节点。

---

## 5. `StreamingMarkdownBody` 中的组装（相关片段）

每块 mermaid 的 **`blockId`** 仍由 **`part.complete`**、**`hashText(part.text)`** 或 **`openMermaidId`** 决定；**`header`** 仅为 **`MermaidFenceToolbar`** 包裹原有 **`Button`** 树，**`onPreview`** 仍通过 **`closest(\`[data-mermaid-preview-scope="${blockId}"]\`)`** 在作用域内查 SVG。

**diagram 模式**注释强调：闭合/未闭合均交给 **`MermaidFenceIsland`**，岛内「成功才提交」策略**未因工具条改动而改变**。

---

## 6. 与代码块浮动条的对比小结

| 维度 | 代码块 `ChatCodeToolbarFloating` | Mermaid `MermaidFenceToolbar` |
| ---- | -------------------------------- | ------------------------------- |
| 定位方式 | `fixed` + Portal 到 body | `sticky` 在 ScrollArea viewport 内 |
| 几何 | `layoutChatCodeToolbars` 算 top/left/width | 无需 JS 算位置 |
| 粘顶样式切换 | 始终「浮动条」外观；原位条可 `display` 隐藏 | 哨兵 + IO 切换 resting / pinned 两套 class |
| 与流式关系 | 扫描 DOM 中代码块 | 不侵入 `MermaidFenceIsland` |

---

## 7. 维护时注意点

1. **修改 Radix Viewport 的 `data-slot`** 时，需同步更新 **`MermaidFenceToolbar`** 里 **`closest`** 的选择器，否则粘顶判定会失效。
2. **Pinned 样式**应与 **`ChatCodeToolBar/index.tsx`** 内浮动节点保持视觉一致；若只改一处，记得对照另一处。
3. **新增「必须在 document 上 fixed」的全局层** 时，勿把 **`MermaidFenceIsland`** 包进会裁切 `fixed` 子代的 **`overflow: hidden`** 容器；当前实现未引入此类包裹。

---

## 8. 源码索引（仓库内路径）

| 路径 | 说明 |
| ---- | ---- |
| `apps/frontend/src/components/design/MermaidFenceToolbar/index.tsx` | 哨兵、Observer、sticky、双态 class。 |
| `apps/frontend/src/components/design/ChatAssistantMessage/StreamingMarkdownBody.tsx` | `renderMermaidPart` 内组装 `MermaidFenceToolbar` 与 `MermaidFenceIsland`。 |
| `apps/frontend/src/components/design/MermaidFenceIsland/index.tsx` | 离屏渲染与流式提交逻辑（本功能未改其行为）。 |
| `apps/frontend/src/components/design/ChatCodeToolBar/index.tsx` | 浮动代码条样式参照。 |
| `apps/frontend/src/components/ui/scroll-area.tsx` | Viewport 上 `data-slot="scroll-area-viewport"` 与 ref 转发。 |
| `apps/frontend/src/components/design/Monaco/preview.tsx` | `ParserMarkdownPreviewPane`：`renderMermaidPreviewPart` 与聊天侧一致组装 **`MermaidFenceToolbar`** + **`MermaidFenceIsland`**（知识库 / 分屏预览）。 |

---

## 9. 完整实现代码（`MermaidFenceToolbar`）

> **与仓库对齐**：以下正文中的源码块为文档编写时从仓库拷贝的完整文件内容。若与当前分支不一致，以 **`apps/frontend/src/components/design/MermaidFenceToolbar/index.tsx`** 为准。

### 9.1 源文件全文

```tsx
/**
 * Mermaid 围栏顶栏：在 ScrollArea viewport 内 `sticky` 吸顶；粘顶后与代码块浮动工具条视觉对齐。
 * 设计背景、哨兵 + IntersectionObserver 约定及与 Portal 方案对比见仓库根目录文档：
 * `docs/mermaid-fence-toolbar-sticky.md`
 */
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** 吸顶后与 ChatCodeFloatingToolbar（`ChatCodeToolBar/index.tsx`）工具条视觉一致 */
const MERMAID_TOOLBAR_PINNED_CHROME =
	'rounded-md bg-theme-background/50 shadow-[0_4px_10px_-4px_color-mix(in_oklch,var(--theme-background)_40%,black)] backdrop-blur-[2px]';

/** 未吸顶时与历史实现一致（仅圆角与背景，无阴影/毛玻璃/额外内边距） */
const MERMAID_TOOLBAR_RESTING_CHROME = 'rounded-t-md bg-theme-background/50';

export type MermaidFenceToolbarProps = {
	/** 用于 Observer 在 block 切换时重建 */
	blockId: string;
	children: ReactNode;
};

/**
 * 通过哨兵节点判断是否已 sticky 粘顶，仅在粘顶时切换为与代码块浮动工具条一致的样式。
 */
export function MermaidFenceToolbar({
	blockId,
	children,
}: MermaidFenceToolbarProps) {
	const sentinelRef = useRef<HTMLDivElement>(null);
	const [isPinned, setIsPinned] = useState(false);

	useLayoutEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;
		// 与 ChatBotView 消息列表一致：滚动容器为 Radix ScrollArea 的 Viewport
		const root = sentinel.closest<HTMLElement>(
			'[data-slot="scroll-area-viewport"]',
		);
		const io = new IntersectionObserver(
			([e]) => {
				// 哨兵先于 sticky 条离开 root 可见区 → 条已贴在滚动区域顶边
				setIsPinned(!e.isIntersecting);
			},
			// root 为 null 时按规范等价于视口，非 ScrollArea 场景下粘顶判定可能略偏差
			{ root, rootMargin: '0px', threshold: 0 },
		);
		io.observe(sentinel);
		return () => io.disconnect();
	}, [blockId]);

	return (
		<>
			<div
				ref={sentinelRef}
				className="h-px w-full shrink-0 pointer-events-none"
				aria-hidden
			/>
			<div
				className={cn(
					'sticky top-0 z-10 flex h-8 select-none items-center justify-between gap-2',
					isPinned
						? MERMAID_TOOLBAR_PINNED_CHROME
						: MERMAID_TOOLBAR_RESTING_CHROME,
				)}
			>
				{children}
			</div>
		</>
	);
}
```

### 9.2 逐段详细注释（符号级说明）

| 位置 | 代码 / 符号 | 详细说明 |
| ---- | ----------- | -------- |
| 1–5 | 文件头 JSDoc | 说明组件职责（sticky + 双态视觉）与权威设计文档路径，便于在 IDE 中跳转后仍能找到长文说明。 |
| 6–7 | `import` | `ReactNode`：工具条子内容为任意 React 节点；`useLayoutEffect`：在浏览器绘制前订阅 IO，减少首帧闪烁；`useRef`：持有哨兵 DOM；`useState`：粘顶布尔态驱动 class 切换。 |
| 7 | `cn` | `tailwind-merge` 风格工具，合并 `sticky` 布局 class 与「皮肤」常量，避免字符串拼接冲突。 |
| 9–11 | `MERMAID_TOOLBAR_PINNED_CHROME` | **粘顶态皮肤**：`rounded-md` 四角圆角（条已浮在内容之上，不再要求仅顶圆角）；`shadow-*` 与 `backdrop-blur` 与 `ChatCodeToolbarFloating` 浮动条一致，形成视觉统一。 |
| 13–14 | `MERMAID_TOOLBAR_RESTING_CHROME` | **自然态皮肤**：`rounded-t-md` 与下方图表区顶边衔接；仅半透明背景，无阴影/毛玻璃，与改吸顶前的历史样式一致。 |
| 16–20 | `MermaidFenceToolbarProps` | `blockId`：流式过程中围栏 id 可能变化，作为 effect 依赖以重建 Observer；`children`：由宿主传入左侧「代码/图表」切换与右侧「复制/预览」按钮。 |
| 25–28 | 组件签名与 hooks | `sentinelRef` 绑定哨兵 div；`isPinned` 初值 `false`（首帧假定未粘顶，首帧后由 IO 校正）。 |
| 32–49 | `useLayoutEffect` | **挂载/依赖变更时**：取哨兵节点；无则直接返回（防御）。`closest` 查找 Radix Viewport 作为 IO 的 `root`，使「可见」与用户在聊天列表里看到的滚动区域一致。创建 `IntersectionObserver`：`threshold: 0` 表示任意像素交叉即触发；回调里 `!e.isIntersecting` 表示哨兵已完全离开 root 的交集区域 → 判定粘顶。`observe(sentinel)` 只观察哨兵，不观察 sticky 条本身。清理函数 `disconnect` 防止泄漏与重复订阅。 |
| 35–38 | `closest('[data-slot="scroll-area-viewport"]')` | 与 `apps/frontend/src/components/ui/scroll-area.tsx` 中 Viewport 的 `data-slot` 约定一致；若将来改名，须三处同步（ScrollArea、本组件、本文档）。 |
| 44–45 | IO 第三参注释 | 明确 `root === null` 时的规范行为与边缘场景风险。 |
| 51–68 | `return` JSX | **Fragment**：避免多余包裹节点影响 flex/间距。哨兵 `div`：`h-px` 占 1 CSS 像素高度；`w-full` 在横向与工具条对齐；`shrink-0` 防止在 flex 父级中被压扁；`pointer-events-none` 不拦截点击；`aria-hidden` 对读屏隐藏装饰节点。工具条容器：`sticky top-0` 相对最近滚动容器粘顶；`z-10` 叠在下方 SVG 之上；`flex` + `justify-between` 与历史布局一致；`cn(...)` 在 `isPinned` 两态间切换皮肤常量。`children` 原样渲染，本组件不耦合具体按钮。 |

---

## 10. 完整实现代码（宿主 `StreamingMarkdownBody`）

> **说明**：吸顶功能在宿主侧体现为 **引入 `MermaidFenceToolbar`**、在 **`renderMermaidPart`** 中用其包裹原有按钮，并保持 **`data-mermaid-preview-scope`** 与 **`MermaidFenceIsland`** 的兄弟关系。下列为 **`apps/frontend/src/components/design/ChatAssistantMessage/StreamingMarkdownBody.tsx`** 全文，便于对照拆分逻辑、状态与预览链路。

### 10.1 源文件全文

> 外层使用 **四个反引号** 包裹，避免 JSDoc 中出现的 `` ``` `` 提前结束 Markdown 代码围栏。

````tsx
/**
 * 正文：优先用 `MarkdownParser.splitForMermaidIslands`（markdown-it parse）拆出 ```mermaid 岛，
 * 普通 markdown 段仍走 `parser.render`，保证列表内代码块等边界与渲染器一致。
 *
 * 流式尾部「未闭合 mermaid 围栏」不会产生 fence token：用按行围栏解析规则仅探测尾部开放 mermaid，
 * 将其从 markdown 段中剥离出来交给 MermaidFenceIsland，既能边输出边出图，也不会破坏普通代码块渲染。
 */

import { MermaidFenceIsland } from '@design/MermaidFenceIsland';
import { MermaidFenceToolbar } from '@design/MermaidFenceToolbar';
import type {
	MarkdownMermaidSplitPart,
	MarkdownParser,
} from '@dnhyxc-ai/tools';
import { Button } from '@ui/index';
import { CheckCircle, Code2, Copy, Eye } from 'lucide-react';
import {
	type MouseEvent as ReactMouseEvent,
	type RefObject,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useMermaidImagePreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/utils/clipboard';
import { mermaidSvgToPreviewDataUrl } from '@/utils/mermaidImagePreview';
import {
	hashText,
	mermaidStreamingFallbackHtml,
	splitForMermaidIslandsWithOpenTail,
} from '@/utils/splitMarkdownFences';

const COPY_FEEDBACK_MS = 1600;

export type StreamingMarkdownBodyProps = {
	markdown: string;
	parser: MarkdownParser;
	className?: string;
	preferDark: boolean;
	isStreaming: boolean;
	/** 每块 Mermaid 的默认展示模式（不传则默认图）；每块仍可独立切换 */
	defaultMermaidViewMode?: 'diagram' | 'code';
	containerRef?: RefObject<HTMLDivElement | null>;
};

export function StreamingMarkdownBody({
	markdown,
	parser,
	className,
	preferDark,
	isStreaming,
	defaultMermaidViewMode = 'diagram',
	containerRef,
}: StreamingMarkdownBodyProps) {
	const { parts, openMermaidId } = useMemo(
		() =>
			splitForMermaidIslandsWithOpenTail({
				markdown,
				parser,
				enableOpenTail: isStreaming,
				openMermaidIdPrefix: 'mmd-open-line-',
			}),
		[markdown, parser, isStreaming],
	);

	// 每块 Mermaid 独立切换：blockId -> mode
	const [mermaidModeById, setMermaidModeById] = useState<
		Record<string, 'diagram' | 'code'>
	>({});
	// 每块 Mermaid 独立复制反馈：blockId -> copied
	const [copiedById, setCopiedById] = useState<Record<string, boolean>>({});
	const copiedTimersRef = useRef<Record<string, number>>({});

	const { openMermaidPreview, mermaidImagePreviewModal } =
		useMermaidImagePreview();

	const markCopied = (blockId: string) => {
		const prevTid = copiedTimersRef.current[blockId];
		if (prevTid) window.clearTimeout(prevTid);
		setCopiedById((prev) => ({ ...prev, [blockId]: true }));
		copiedTimersRef.current[blockId] = window.setTimeout(() => {
			setCopiedById((prev) => ({ ...prev, [blockId]: false }));
		}, COPY_FEEDBACK_MS);
	};

	const renderMermaidPart = (
		part: Extract<MarkdownMermaidSplitPart, { type: 'mermaid' }>,
		i: number,
	) => {
		// Mermaid：每块独立切换（图/代码）
		const blockId = part.complete
			? `mmd-${hashText(part.text)}`
			: (openMermaidId ?? `mmd-open-${i}`);
		const mode = mermaidModeById[blockId] ?? defaultMermaidViewMode;
		const toggle = () => {
			setMermaidModeById((prev) => ({
				...prev,
				[blockId]: mode === 'diagram' ? 'code' : 'diagram',
			}));
		};
		const copied = copiedById[blockId] === true;
		const onCopy = () => {
			void (async () => {
				await copyToClipboard(`\`\`\`mermaid\n${part.text}\n\`\`\``);
				markCopied(blockId);
			})();
		};

		const onPreview = (e: ReactMouseEvent<HTMLButtonElement>) => {
			const btn = e.currentTarget;
			const scope = btn.closest<HTMLElement>(
				`[data-mermaid-preview-scope="${blockId}"]`,
			);
			if (!scope) return;
			const svg = scope.querySelector('.markdown-mermaid-wrap .mermaid svg');
			if (!(svg instanceof SVGElement)) return;
			const url = mermaidSvgToPreviewDataUrl(svg);
			if (url) openMermaidPreview(url);
		};

		// Mermaid 工具条：独立组件内 sticky + 粘顶双态样式，不包裹 MermaidFenceIsland，避免影响流式/离屏渲染（见 docs/mermaid-fence-toolbar-sticky.md）
		const header = (
			<MermaidFenceToolbar blockId={blockId}>
				<Button variant="link" size="sm" className="h-7 px-2" onClick={toggle}>
					<Code2 size={16} />
					<span>{mode === 'diagram' ? '代码' : '图表'}</span>
				</Button>
				<div className="flex items-center justify-end">
					<Button variant="link" size="sm" onClick={onCopy}>
						{copied ? <CheckCircle className="text-teal-400" /> : <Copy />}
						<span className={cn(copied ? 'text-teal-400' : '', 'text-sm')}>
							{copied ? '已复制' : '复制'}
						</span>
					</Button>
					<Button
						variant="link"
						size="sm"
						onClick={onPreview}
						disabled={mode !== 'diagram'}
					>
						<Eye size={16} />
						<span className="text-sm">预览</span>
					</Button>
				</div>
			</MermaidFenceToolbar>
		);

		if (mode === 'code') {
			return (
				<div
					key={`mm-wrap-${blockId}`}
					data-mermaid-preview-scope={blockId}
					className="mt-4.5"
				>
					{header}
					<div
						dangerouslySetInnerHTML={{
							__html: mermaidStreamingFallbackHtml(part.text),
						}}
					/>
				</div>
			);
		}

		// diagram 模式：闭合/未闭合都交给 MermaidFenceIsland；岛内“成功才提交”避免流式错误 SVG 闪烁
		return (
			<div
				key={`mm-wrap-${blockId}`}
				data-mermaid-preview-scope={blockId}
				className="mt-4.5"
			>
				{header}
				<MermaidFenceIsland
					code={part.text}
					preferDark={preferDark}
					isStreaming={isStreaming || !part.complete}
					openMermaidPreview={openMermaidPreview}
				/>
			</div>
		);
	};

	return (
		<div ref={containerRef} className={cn('streaming-md-body', className)}>
			{parts.map((part: MarkdownMermaidSplitPart, i: number) => {
				if (part.type === 'markdown') {
					return (
						<div
							key={`md-${i}`}
							dangerouslySetInnerHTML={{ __html: parser.render(part.text) }}
						/>
					);
				}
				return renderMermaidPart(part, i);
			})}
			{mermaidImagePreviewModal}
		</div>
	);
}
````

### 10.2 与工具条 / 吸顶相关的逐段详细注释

| 位置 | 代码要点 | 详细说明 |
| ---- | -------- | -------- |
| 9–10 | `MermaidFenceIsland` / `MermaidFenceToolbar` | 岛负责 **DSL → SVG** 与流式策略；工具条仅 UI 壳，二者 **同级兄弟**（先条后岛），不把岛包进 sticky，避免滚动层叠与离屏测量受未知 `overflow` 影响。 |
| 56–65 | `useMemo` + `splitForMermaidIslandsWithOpenTail` | 将正文拆成 markdown / mermaid 交替片段；`enableOpenTail: isStreaming` 在流式时允许尾部未闭合 mermaid 单独成岛，供 `MermaidFenceIsland` 增量渲染。 |
| 67–73 | `mermaidModeById` / `copiedById` / `copiedTimersRef` | 每块围栏用 **`blockId`** 做 key，互不影响；复制反馈用定时器复位，与工具条 UI 解耦。 |
| 75–76 | `useMermaidImagePreview` | 提供 **`openMermaidPreview`** 与全屏预览 Modal；预览按钮在 diagram 模式且存在有效 SVG 时使用。 |
| 92–94 | `blockId` 计算 | **闭合围栏**：`hashText(part.text)` 稳定标识内容；**开放尾**：用解析器给出的 **`openMermaidId`** 或回退 **`mmd-open-${i}`**。`blockId` 变化会导致 **`MermaidFenceToolbar` 内 IO 重建**（见 9.2 表）。 |
| 110–120 | `onPreview` | 从按钮 **`closest`** 到带 **`data-mermaid-preview-scope`** 的包裹层，再 **`querySelector`** 取 SVG；因此 **工具条必须与岛同在该 scope 内**，且不能用 Portal 把条挪到 body 而破坏该查找链。 |
| 122–147 | `header` + **`MermaidFenceToolbar`** | **`blockId` 传入子组件** 仅用于 effect 依赖；子内容为原有 shadcn **`Button`** 树。`disabled={mode !== 'diagram'}`：仅图表模式可预览（与 SVG 存在性一致）。 |
| 151–154 / 168–171 | 外层 `div` + **`mt-4.5`** | 块级上外边距放在 **非 sticky** 容器上，避免把 margin 挂在 sticky 根节点引发与「粘滞约束」相关的布局歧义；**`data-mermaid-preview-scope`** 与预览、`blockId` 一致。 |
| 149–163 | `mode === 'code'` | 代码模式无 SVG，用 **`mermaidStreamingFallbackHtml`** 做只读高亮/纯展示；**同样渲染 `header`**，保证两种模式下吸顶与按钮一致。 |
| 166–180 | diagram 分支 | **`MermaidFenceIsland`** 接收 **`isStreaming \|\| !part.complete`**：流式中或未闭合时走岛内节流与「成功才提交」；**工具条不参与**这些 props。 |
| 184–199 | 根 `map` | markdown 段 **`parser.render`**；mermaid 段走 **`renderMermaidPart`**；末尾挂载 **`mermaidImagePreviewModal`**。 |

### 10.3 与工具条无直接耦合但需知的上下文

| 位置 | 说明 |
| ---- | ---- |
| 1–7 | 文件头注释描述 **整条正文** 的拆分与流式开放尾策略，吸顶功能不改变此策略。 |
| 36–45 | **`containerRef`** 等 props 供父级（如 IO 懒挂载）使用，**与 `MermaidFenceToolbar` 内查找 ScrollArea 的 `closest` 相互独立**：后者从哨兵 DOM 向上找 viewport。 |
| 34 | **`COPY_FEEDBACK_MS`**：复制按钮文案反馈时长，与粘顶无关。 |

---

## 11. 粘顶样式参照：`ChatCodeToolbarFloating` 中的 `className`

Mermaid 粘顶态常量 **`MERMAID_TOOLBAR_PINNED_CHROME`** 与下方浮动节点上的 **背景 / 圆角 / 阴影 / 毛玻璃** 对齐；代码块工具条另含 **`pl-3.5 pr-1`** 与 **`flex` 布局**（Mermaid 条在 **`MermaidFenceToolbar`** 外层已写 **`flex`**，水平内边距可按设计再对齐）。下列为 **`apps/frontend/src/components/design/ChatCodeToolBar/index.tsx`** 中 **`node`** 的 JSX 摘录，便于 diff。

```tsx
	const node = (
		<div
			className="flex items-center justify-between gap-2 pl-3.5 pr-1 rounded-md bg-theme-background/50 shadow-[0_4px_10px_-4px_color-mix(in_oklch,var(--theme-background)_40%,black)] backdrop-blur-[2px]"
			style={{
				position: 'fixed',
				top: state.top,
				left: state.left,
				width: state.width,
				zIndex: 1,
				boxSizing: 'border-box',
			}}
			role="toolbar"
			aria-label="代码块工具栏"
		>
			<span className="text-sm text-textcolor/80">{state.lang}</span>
			<div className="flex items-center h-8">
				<button type="button" className="p-0 text-sm rounded-[5px] h-6 w-11 hover:bg-theme/10 cursor-pointer text-textcolor/80 hover:text-textcolor" onClick={onCopy}>
					{copied ? '已复制' : '复制'}
				</button>
				<button type="button" className="p-0 text-sm rounded-[5px] h-6 w-11 hover:bg-theme/10 cursor-pointer text-textcolor/80 hover:text-textcolor" onClick={onDownload}>
					下载
				</button>
			</div>
		</div>
	);
```

| 符号 / 属性 | 说明 |
| ----------- | ---- |
| `position: 'fixed'` + `top/left/width` | 由 **`layoutChatCodeToolbars`** 写入视口相对几何；Mermaid 条用 **`sticky`**，**不**需要这些 style。 |
| `className` 中与 Mermaid 共用的片段 | `rounded-md`、`bg-theme-background/50`、`shadow-[...]`、`backdrop-blur-[2px]` 应与 **`MERMAID_TOOLBAR_PINNED_CHROME`** 保持一致（维护时对照修改）。 |
| `role` / `aria-label` | 浮动条可访问性；Mermaid 工具条若需同等语义，可在 **`MermaidFenceToolbar`** 外层 **`div`** 上补 **`role="toolbar"`** 等（当前未强制）。 |

---

## 12. Monaco 预览与知识库：`ParserMarkdownPreviewPane`

知识库、Monaco Markdown 分屏等场景**不**在 `views/knowledge` 内单独实现 Markdown 渲染，而是统一使用 **`apps/frontend/src/components/design/Monaco/index.tsx`** 中的 **`MarkdownEditor`**，其预览子组件为 **`ParserMarkdownPreviewPane`**（**`Monaco/preview.tsx`**）。因此「与聊天一致的 Mermaid 顶栏 + 吸顶」在该文件内实现即可覆盖知识库，无需重复改路由页。

### 12.1 实现思路

| 步骤 | 说明 |
| ---- | ---- |
| 1. 拆分不变 | 仍用 **`splitForMermaidIslandsWithOpenTail`**（`parserNoMermaid`、`enableOpenTail: enableMermaid`），得到 **`fenceParts`** 与 **`openMermaidId`**，与改工具条前一致。 |
| 2. 合并 mermaid 分支 | 原先「`!part.complete` 仅 `dangerouslySetInnerHTML` fallback」与「`complete` 仅 `MermaidFenceIsland`」两条分支合并为单一 **`renderMermaidPreviewPart(part, i)`**，与 **`StreamingMarkdownBody.renderMermaidPart`** 同构：先 **`MermaidFenceToolbar`**，再按 **`mode`** 选代码 fallback 或 **`MermaidFenceIsland`**。 |
| 3. 状态与聊天对齐 | **`mermaidModeById`**、**`copiedById`**、**`copiedTimersRef`**、**`markCopied`**、常量 **`COPY_FEEDBACK_MS`**，语义与聊天正文一致。 |
| 4. 文档切换重置 | 依赖 **`documentIdentity`**（`MarkdownEditor` 在知识库等场景传入逻辑文档 id）：**`useEffect`** 在切换文档时清空模式/复制态并 **`clearTimeout`**，避免上一篇的「图表/代码」或「已复制」残留在下一篇。 |
| 5. 流式标志 | 预览无「整条消息 isStreaming」：岛内使用 **`isStreaming={!part.complete}`**，仅在围栏**未闭合**（编辑中尾部 mermaid）时走 **`MermaidFenceIsland`** 的流式合并策略；闭合块为 `false`，与聊天非流式消息行为一致。 |
| 6. 吸顶 | **`MermaidFenceToolbar`** 不变；预览根仍在 **`ScrollArea` Viewport** 内，**`closest('[data-slot="scroll-area-viewport"]')`** 生效。 |
| 7. 其它预览能力 | **`ChatCodeFloatingToolbar`**、**`useChatCodeFloatingToolbar`**、**`useMermaidDiagramClickPreview`**、**`mermaidImagePreviewModal`** 保持原有注册与触发，不删减。 |

### 12.2 与 `StreamingMarkdownBody` 的差异对照

| 项目 | 聊天 `StreamingMarkdownBody` | Monaco `ParserMarkdownPreviewPane` |
| ---- | ---------------------------- | ----------------------------------- |
| 默认图/代码 | `defaultMermaidViewMode` prop，默认 `'diagram'` | 写死 **`mermaidModeById[blockId] ?? 'diagram'`**（无 prop，与聊天默认一致）。 |
| 岛内 `isStreaming` | `isStreaming \|\| !part.complete`（消息级流式 **或** 未闭合围栏） | **`!part.complete`**（仅围栏未闭合时视为流式）。 |
| 文档切换 | 随消息气泡 remount 或换条消息自然换新 state | 显式依赖 **`documentIdentity`** 清空 state。 |
| React `key` | **`mm-wrap-${blockId}`** | **`pv-mm-wrap-${blockId}`**（前缀 `pv-` 与预览其它 **`pv-${i}`** key 区分，避免冲突）。 |
| `MermaidFenceIsland` | 无额外 `className` | **`className="monaco-preview-mode-mermaid"`** 保留，供样式或调试定位。 |
| 按钮外观 | 以 `Button` + `h-7` 等为准 | 预览侧可为 **`text-textcolor/80`**、**`teal-500`** 等与编辑器主题更贴近的微调（逻辑不变）。 |

### 12.3 核心代码摘录（`preview.tsx`）

> 外层使用 **四个反引号**，避免字符串中的 **fence 反引号** 破坏 Markdown。

````tsx
const COPY_FEEDBACK_MS = 1600;

// … useMermaidImagePreview 之后 …

	// 与 StreamingMarkdownBody 一致：每块 mermaid 独立图/代码模式与复制反馈
	const [mermaidModeById, setMermaidModeById] = useState<
		Record<string, 'diagram' | 'code'>
	>({});
	const [copiedById, setCopiedById] = useState<Record<string, boolean>>({});
	const copiedTimersRef = useRef<Record<string, number>>({});

	const markCopied = useCallback((blockId: string) => {
		const prevTid = copiedTimersRef.current[blockId];
		if (prevTid) window.clearTimeout(prevTid);
		setCopiedById((prev) => ({ ...prev, [blockId]: true }));
		copiedTimersRef.current[blockId] = window.setTimeout(() => {
			setCopiedById((prev) => ({ ...prev, [blockId]: false }));
		}, COPY_FEEDBACK_MS);
	}, []);

	// 切换知识库文档等逻辑文档时清空，避免沿用上一条的切换/复制态
	useEffect(() => {
		setMermaidModeById({});
		setCopiedById({});
		for (const k of Object.keys(copiedTimersRef.current)) {
			window.clearTimeout(copiedTimersRef.current[k]);
		}
		copiedTimersRef.current = {};
	}, [documentIdentity]);

	const renderMermaidPreviewPart = useCallback(
		(
			part: Extract<MarkdownMermaidSplitPart, { type: 'mermaid' }>,
			i: number,
		) => {
			const blockId = part.complete
				? `mmd-${hashText(part.text)}`
				: (openMermaidId ?? `mmd-open-${i}`);
			const mode = mermaidModeById[blockId] ?? 'diagram';
			// toggle / onCopy / onPreview：与 StreamingMarkdownBody 相同（复制为带 ```mermaid 围栏的纯文本）
			// header：<MermaidFenceToolbar blockId={blockId}> + 三个 Button
			// mode === 'code' → mermaidStreamingFallbackHtml；否则 → MermaidFenceIsland（isStreaming={!part.complete}）
		},
		[
			copiedById,
			markCopied,
			mermaidModeById,
			openMermaidId,
			openMermaidPreview,
			theme,
		],
	);

// … JSX：hasMermaidIslandLayout 时 fenceParts.map，mermaid 段 return renderMermaidPreviewPart(part, i)
````

完整函数体（含 **`header`** JSX、**`copyToClipboard`** 模板字符串）以仓库 **`preview.tsx`** 为准；上表用注释占位缩短篇幅，避免与 **§10** 重复粘贴整文件。

### 12.4 `preview.tsx` 中与 Mermaid 工具条相关的逐段注释

| 位置（约） | 代码要点 | 详细说明 |
| ---------- | -------- | -------- |
| 1–50 | `import` 与常量 | 在原有 **`MermaidFenceIsland`**、**`splitForMermaidIslandsWithOpenTail`** 基础上增加 **`MermaidFenceToolbar`**、**`Button`**、**`MarkdownMermaidSplitPart`**、**`hashText`**、**`copyToClipboard`**、**`mermaidSvgToPreviewDataUrl`** 及图标；**`COPY_FEEDBACK_MS`** 与聊天侧一致。 |
| 71–74 | 组件 JSDoc | 标明知识库等场景与 **`StreamingMarkdownBody`** 共用 **`MermaidFenceToolbar`** 吸顶方案。 |
| 266–280 | 状态 + **`markCopied`** | 与 **§10.2** 表中「每块 Mermaid 独立切换 / 复制反馈」一致；**`useCallback`** 稳定 **`markCopied`** 引用，供 **`renderMermaidPreviewPart`** 依赖。 |
| 282–290 | **`documentIdentity` effect** | 聊天侧通常随消息 id 重挂载；预览侧单组件长驻，必须用逻辑文档 id **显式重置**，否则切换知识库条目后仍显示上一篇的「代码模式」或复制勾号。 |
| 292–405 | **`renderMermaidPreviewPart`** | **`blockId`** 规则与聊天完全相同；**`onPreview`** 仍依赖 **`data-mermaid-preview-scope`** + **`.markdown-mermaid-wrap .mermaid svg`**；**`useCallback`** 依赖包含 **`mermaidModeById` / `copiedById`** 以便切换模式或复制后子树重渲染。 |
| 363–377 | `mode === 'code'` | 与聊天一致：**`mermaidStreamingFallbackHtml`** 注入，便于核对 DSL。 |
| 380–395 | diagram 分支 | **`MermaidFenceIsland`**：**`isStreaming={!part.complete}`** 为预览场景下的「编辑中流式尾块」；**`preferDark={theme === 'black'}`** 与全局主题一致。 |
| 505–518 | **`fenceParts.map`** | **`markdown`** 段仍 **`parserNoMermaid.render`**；**`mermaid`** 段统一 **`return renderMermaidPreviewPart(part, i)`**，删除原先对 **`!part.complete`** 的单独 **`dangerouslySetInnerHTML`** 分支，避免无工具栏的半截围栏。 |

### 12.5 入口与调用链（便于排查）

```text
views/knowledge/index.tsx（或其它使用 Markdown 的页面）
    ↓
MarkdownEditor（Monaco/index.tsx）
    ↓
ParserMarkdownPreviewPane（preview.tsx，documentIdentity / enableMermaid 等 props）
    ↓
hasMermaidIslandLayout ? fenceParts.map : 整段 html
    ↓
mermaid 段 → renderMermaidPreviewPart → MermaidFenceToolbar + MermaidFenceIsland | fallback
```
