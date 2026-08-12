# 英语 Agent 选区右键菜单 + 选区朗读

> **文档角色**：为英语 Agent 消息正文新增「选中文本 → 右键弹出菜单 → 朗读/复制」能力；抽取通用 `useSelectionContextMenu` hook + `PositionedQuickMenu` 组件供 `ChatAssistantMessage` / `Markdown` 预览 / EPUB 右键菜单复用；朗读复用听书同款按段云端 TTS 链路（`playListenPlainText`），悬浮条支持拖动、倍速、软暂停。
> **延伸阅读**：[epub-listen-cadence-lead.md](../ebook/epub-listen-cadence-lead.md)（朗读切句时序优化，为本篇朗读预览服务）；[epub-assistant-context-menu.md](../ebook/epub-assistant-context-menu.md)（EPUB 选区菜单底座）；[english-tts-playback.md](./english-tts-playback.md)（云端 TTS 播放链路）

## 1. 背景与目标

**问题**：英语 Agent 消息正文此前只支持系统默认右键菜单，无法对选中段落直接朗读；用户想在 Agent 回复中「听一段」必须切到其它入口。

**目标**：
1. 选中消息正文后右键，弹出自定义菜单（朗读 / 复制）；未选中文本时不拦截系统菜单。
2. 朗读复用听书同款按段云端 TTS（`cloudSingleUtterance`）链路，首句快出声、逐句预览。
3. 朗读期间在输入框上方显示悬浮控制条：播放/暂停、停止、倍速、当前句预览；悬浮条可拖动。
4. 抽取通用「锚定坐标的声明式菜单」与「选区右键 hook」，供 `ChatAssistantMessage` / `Markdown` 预览 / EPUB 右键菜单复用，消除 `EpubReaderContextMenu` 内的重复实现。

## 2. 改动范围

| 路径 | 变更类型 | 说明 |
|------|----------|------|
| `apps/frontend/src/components/design/ContextMenu/PositionedQuickMenu.tsx` | 新增 | 锚定鼠标坐标的声明式菜单（从 `EpubReaderContextMenu` 抽取） |
| `apps/frontend/src/components/design/ContextMenu/useSelectionContextMenu.tsx` | 新增 | 选区右键 hook：pointerdown 快照 + contextmenu 捕获阶段拦截 |
| `apps/frontend/src/components/design/ContextMenu/index.tsx` | 修改 | barrel 导出新增 `PositionedQuickMenu` / `useSelectionContextMenu` |
| `apps/frontend/src/views/ebook/components/reader/EpubReaderContextMenu.tsx` | 修改 | 删除内部 `MenuEntries` / `anchorStyle`，改用 `PositionedQuickMenu` |
| `apps/frontend/src/components/design/Assistant/types.ts` | 修改 | 新增 `floatAbove` / `getSelectionContextMenuItems` 字段 |
| `apps/frontend/src/components/design/Assistant/Footer.tsx` | 修改 | 渲染 `floatAbove` 悬浮层 |
| `apps/frontend/src/components/design/Assistant/utils.ts` | 修改 | `select-auto` → `select-text`，确保消息正文可选中 |
| `apps/frontend/src/components/design/Assistant/MessageRow.tsx` | 修改 | 透传 `getSelectionContextMenuItems` 到消息气泡 |
| `apps/frontend/src/components/design/ChatAssistantMessage/index.tsx` | 修改 | 集成 `useSelectionContextMenu` + 新增 `getSelectionContextMenuItems` prop |
| `apps/frontend/src/components/design/Markdown/index.tsx` | 修改 | 预览组件集成 `useSelectionContextMenu` + 新增 prop |
| `apps/frontend/src/views/englishLearning/agent/selectionContextMenu.ts` | 新增 | 英语 Agent 选区菜单项工厂（朗读 + 复制） |
| `apps/frontend/src/views/englishLearning/agent/useSelectionSpeak.ts` | 新增 | 选区朗读会话 hook（状态机 + 倍速 + 软暂停） |
| `apps/frontend/src/views/englishLearning/agent/SelectionSpeakBar.tsx` | 新增 | 朗读悬浮条（拖动 + 倍速菜单 + 句预览） |
| `apps/frontend/src/views/englishLearning/agent/index.tsx` | 修改 | Agent 面板装配选区菜单 + 悬浮条；新会话时停止朗读 |
| `apps/frontend/src/views/ebook/utils/epub/listen/playListenPlainText.ts` | 新增 | 无 EPUB 高亮的听当前同款播法入口，供选区朗读复用 |
| `apps/frontend/src/i18n/locales/zh-CN.ts` | 修改 | 新增 `englishLearning.selection.*` 5 个 key |
| `apps/frontend/src/i18n/locales/en-US.ts` | 修改 | 同上英文 |

## 3. 实现思路

| # | 要点 | 说明 |
|---|------|------|
| 1 | 选区右键可靠性（macOS） | `pointerdown(button=2)` 先快照选区（系统右键常会改写/点词选中）；`contextmenu` 用**捕获阶段**并尽早 `preventDefault`，优先用快照文本，避免系统改写后误判无选区 |
| 2 | 声明式锚定菜单 | `PositionedQuickMenu` 用一个 1×1 `pointer-events:none` 的 fixed `<span>` 作 `DropdownMenuTrigger`，把 Radix Dropdown 锚到鼠标坐标；解决 iframe / 选区右键无法用 Trigger 包裹的问题 |
| 3 | 通用 hook 设计 | `useSelectionContextMenu(getItems?)`：未传 `getItems` 时返回 `undefined`/`null`（默认关闭，零开销）；传入时返回 `onContextMenuCapture` / `onPointerDownCapture` / `menu` 三件套，使用方挂到容器即可 |
| 4 | 菜单能力由使用方决定 | hook 只负责「选中文本 + 弹菜单」，菜单项（朗读/复制等）由 `getItems(selectedText, ctx)` 回调返回；`ChatAssistantMessage` / `Markdown` 均新增同名 prop 透传 |
| 5 | 朗读复用听书链路 | `playListenPlainText` 入口 = `stripMarkdownForTts` + `buildSentenceOffsetSpans` + `buildParagraphUnits` + `playListenUnitsFromCursor`；选区朗读与听书共享同一套按段云端 TTS、预取、软暂停 |
| 6 | 朗读会话状态机 | `useSelectionSpeak` 维护 `idle/loading/playing/paused`；`seqRef` 世代号防止旧播放回调污染新会话；`pausedRef` 软暂停标志传给 `isActive` |
| 7 | 悬浮条拖动 | 默认挂在 Footer 内 `absolute bottom-full`；拖动后切 `fixed` 并用 ref 直接改 DOM（避免每帧 setState 重渲染含 ScrollArea/菜单的整条）；`ResizeObserver` 在面板尺寸变化时重新 clamp |
| 8 | 新会话停止朗读 | `handleNewChat` 包裹 `onNewChat`，先 `selectionSpeak.stop()` 再开新会话，避免朗读残留 |
| 9 | 消息正文可选 | `messageLabelClass` 把 `select-auto` 改为 `select-text`，确保用户能拖选消息正文 |

## 4. 关键代码对比与注释

### 4.1 `useSelectionContextMenu` — 选区右键 hook（纯新增）

**对比范围**：`useSelectionContextMenu.tsx` 整个文件。纯新增（见 `code-before-after.md` §4 例外），仅贴新增实现。

**新增** · `apps/frontend/src/components/design/ContextMenu/useSelectionContextMenu.tsx`（当前，约 L31–L58）

```typescript
// 读取 root 内的当前选区，返回文本与克隆后的 Range（contextmenu 时原生选区可能已被系统改写）
function readSelectionIn(root: HTMLElement): SelSnap {
	// 取 window 选区
	const sel = window.getSelection();
	// 无选区 / 折叠 / 无 range → 返回空
	if (!sel || sel.isCollapsed || sel.rangeCount < 1) {
		return { text: '', range: null };
	}
	// 取第一个 range
	const range = sel.getRangeAt(0);
	// range 的公共祖先节点
	const ancestor = range.commonAncestorContainer;
	// 判断选区是否落在 root 内：自身相等 / root 包含祖先 / range 与 root 相交
	const inRoot =
		// root 即祖先
		root === ancestor ||
		// root 包含祖先节点
		root.contains(ancestor) ||
		// 兜底：用 intersectsNode 判断相交（try/catch 防止跨 shadow DOM 抛错）
		(() => {
			try {
				return range.intersectsNode(root);
			} catch {
				return false;
			}
		})();
	// 选区不在 root 内 → 返回空
	if (!inRoot) return { text: '', range: null };
	// 取选区纯文本并 trim
	const text = sel.toString().trim();
	// 文本为空 → 返回空
	if (!text) return { text: '', range: null };
	// 克隆 range 供后续定位使用
	let cloned: Range | null = null;
	try {
		// cloneRange 可能抛异常（跨 shadow DOM）
		cloned = range.cloneRange();
	} catch {
		// 失败则置 null
		cloned = null;
	}
	// 返回文本与克隆 range
	return { text, range: cloned };
}
```

**新增** · `apps/frontend/src/components/design/ContextMenu/useSelectionContextMenu.tsx`（当前，约 L71–L141）

```typescript
// 选区右键 hook：选中文本后右键才弹菜单；getItems 未传则无行为（默认关闭）
export function useSelectionContextMenu(
	// 菜单项工厂，由使用方传入；未传则 hook 不启用
	getItems?: SelectionContextMenuItemsFn,
	// 返回三件套：捕获阶段事件处理器 + 菜单 ReactNode
): {
	// contextmenu 捕获阶段处理器（挂到容器 onContextMenuCapture）
	onContextMenuCapture:
		| ((e: ReactMouseEvent<HTMLElement>) => void)
		| undefined;
	// pointerdown 捕获阶段处理器（挂到容器 onPointerDownCapture）
	onPointerDownCapture:
		| ((e: ReactPointerEvent<HTMLElement>) => void)
		| undefined;
	// 菜单 ReactNode，渲染到容器内
	menu: ReactNode;
} {
	// 菜单状态：坐标 + open + items
	const [menu, setMenu] = useState<MenuState | null>(null);
	// 右键按下瞬间的选区快照；contextmenu 时优先用它
	const snapRef = useRef<SelSnap | null>(null);

	// pointerdown 捕获：button=2（右键）时快照选区
	const onPointerDownCapture = useCallback(
		(e: ReactPointerEvent<HTMLElement>) => {
			// 未传 getItems → 不启用
			if (!getItems) return;
			// 非右键不处理
			if (e.button !== 2) return;
			// 快照当前选区（系统右键常会改写）
			snapRef.current = readSelectionIn(e.currentTarget);
		},
		// 依赖 getItems
		[getItems],
	);

	// contextmenu 捕获：决定是否弹自定义菜单
	const onContextMenuCapture = useCallback(
		(e: ReactMouseEvent<HTMLElement>) => {
			// 未传 getItems → 不启用
			if (!getItems) return;

			// 取 contextmenu 时刻的实时选区
			const live = readSelectionIn(e.currentTarget);
			// 取 pointerdown 快照
			const snap = snapRef.current;
			// 清空快照（一次性）
			snapRef.current = null;

			// 优先用右键按下前的快照（用户拖选）；避免系统点词覆盖后误判无选区
			const text = (snap?.text || live.text).trim();
			// 无文本 → 不弹自定义菜单，放行系统菜单
			if (!text) return;

			// range 优先用快照的
			const range = snap?.text ? snap.range : live.range;
			// 调用使用方工厂获取菜单项
			const items = getItems(text, { range });
			// 无菜单项 → 不弹
			if (!items?.length) return;

			// 已确认要弹自定义菜单：拦住系统菜单（须在捕获阶段尽早调用）
			e.preventDefault();
			// 停止冒泡，避免上层重复处理
			e.stopPropagation();
			// 设置菜单状态：open + 鼠标坐标 + items
			setMenu({ open: true, x: e.clientX, y: e.clientY, items });
		},
		// 依赖 getItems
		[getItems],
	);

	// 未传 getItems → 返回 undefined / null（零开销，默认关闭）
	if (!getItems) {
		return {
			// 不挂 contextmenu 处理器
			onContextMenuCapture: undefined,
			// 不挂 pointerdown 处理器
			onPointerDownCapture: undefined,
			// 不渲染菜单
			menu: null,
		};
	}

	// 启用态：返回处理器 + PositionedQuickMenu
	return {
		// contextmenu 捕获处理器
		onContextMenuCapture,
		// pointerdown 捕获处理器
		onPointerDownCapture,
		// 菜单 JSX
		menu: (
			// 声明式锚定菜单
			<PositionedQuickMenu
				// 菜单状态（坐标 + open）
				state={menu}
				// 菜单项
				items={menu?.items ?? []}
				// 开关回调
				onOpenChange={(open) => {
					// 关闭时清空整个 menu 状态
					if (!open) setMenu(null);
					// 打开时保留现有状态（仅同步 open）
					else setMenu((m) => (m ? { ...m, open } : m));
				}}
			/>
		),
	};
}
```

---

### 4.2 `PositionedQuickMenu` — 锚定坐标的声明式菜单（纯新增，自 `EpubReaderContextMenu` 抽取）

**对比范围**：`PositionedQuickMenu.tsx` 整个文件。纯新增；同逻辑原存在于 `EpubReaderContextMenu.tsx` 内（4.3 节展示其删除前后对比）。

**新增** · `apps/frontend/src/components/design/ContextMenu/PositionedQuickMenu.tsx`（当前，约 L28–L106）

```typescript
// 菜单项递归渲染：separator / sub / item 三类
function MenuEntries({
	// 菜单项数组
	entries,
}: {
	// 入参类型
	entries: readonly QuickContextMenuEntry[];
}) {
	// 遍历每一项
	return entries.map((entry, index) => {
		// 分隔线
		if (entry.type === 'separator') {
			// 渲染分隔线，key 用 id 或索引
			return <DropdownMenuSeparator key={entry.id ?? `sep-${index}`} />;
		}
		// 子菜单
		if (entry.type === 'sub') {
			return (
				// DropdownMenuSub 容器
				<DropdownMenuSub key={entry.id}>
					{/* 子菜单触发器 */}
					<DropdownMenuSubTrigger disabled={entry.disabled} inset={entry.inset}>
						{/* 子菜单标题 */}
						{entry.label}
					</DropdownMenuSubTrigger>
					{/* 子菜单内容 */}
					<DropdownMenuSubContent>
						{/* 递归渲染子菜单项 */}
						<MenuEntries entries={entry.items} />
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			);
		}
		// 普通可点击项
		return (
			<DropdownMenuItem
				// key 用 id
				key={entry.id}
				// 禁用态
				disabled={entry.disabled}
				// 缩进
				inset={entry.inset}
				// 样式变体（default/destructive）
				variant={entry.variant}
				// 选中回调
				onSelect={entry.onSelect}
			>
				{/* 标签 */}
				{entry.label}
				{/* 快捷键（非空才渲染） */}
				{entry.shortcut != null && entry.shortcut !== '' ? (
					<DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>
				) : null}
			</DropdownMenuItem>
		);
	});
}

// 锚定在鼠标坐标的声明式菜单（iframe / 选区右键等无法用 Trigger 包裹时用）
export function PositionedQuickMenu({
	// 菜单状态（null 表示不渲染）
	state,
	// 菜单项
	items,
	// 开关回调
	onOpenChange,
	// 内容区 className（默认 min-w-44）
	contentClassName = 'min-w-44',
}: Props) {
	// 锚点样式：fixed 1×1 无指针事件，定位到鼠标坐标
	const anchorStyle = useMemo(
		() =>
			// 有 state 才生成样式
			state
				? ({
						// 固定定位
						position: 'fixed',
						// 鼠标 x
						left: state.x,
						// 鼠标 y
						top: state.y,
						// 1px 宽
						width: 1,
						// 1px 高
						height: 1,
						// 不响应指针事件
						pointerEvents: 'none',
					} as const)
				: // 无 state 返回 undefined
					undefined,
		// 依赖 state
		[state],
	);

	// 无 state → 不渲染
	if (!state) return null;

	return (
		// DropdownMenu 受控（open + onOpenChange），modal 模式
		<DropdownMenu open={state.open} onOpenChange={onOpenChange} modal>
			{/* Trigger 用 asChild 包一个 1×1 span 作锚点 */}
			<DropdownMenuTrigger asChild>
				<span aria-hidden style={anchorStyle} />
			</DropdownMenuTrigger>
			{/* 菜单内容 */}
			<DropdownMenuContent
				// 内容 className
				className={contentClassName}
				// 对齐方式
				align="start"
				// 弹出方向
				side="right"
			>
				{/* 渲染菜单项 */}
				<MenuEntries entries={items} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
```

---

### 4.3 `EpubReaderContextMenu` — 改用 `PositionedQuickMenu`（重构）

**对比范围**：`EpubReaderContextMenu.tsx` 整个文件。删除内部 `MenuEntries` 与 `anchorStyle`，改用 4.2 抽取的 `PositionedQuickMenu`。

**改动前** · `apps/frontend/src/views/ebook/components/reader/EpubReaderContextMenu.tsx`（基线 `HEAD`，约 L1–L88）

```typescript
// 旧版：直接 import Radix Dropdown 原语与 QuickContextMenuEntry 类型
import type { QuickContextMenuEntry } from '@design/ContextMenu';
import { useMemo } from 'react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// 旧版：菜单状态类型自建（open/x/y + hasSelection）
export type EpubReaderContextMenuState = {
	open: boolean;
	x: number;
	y: number;
	hasSelection: boolean;
};
// ...（旧版 MenuEntries 函数：约 40 行，与 4.2 新抽取的 MenuEntries 完全一致）
// ...（旧版 anchorStyle useMemo：与 4.2 完全一致）
// ...（旧版 EpubReaderContextMenu 函数体：直接拼 DropdownMenu + Trigger span + Content + MenuEntries）
```

**改动后** · `apps/frontend/src/views/ebook/components/reader/EpubReaderContextMenu.tsx`（当前，约 L1–L25）

```typescript
// 新版：从 @design/ContextMenu 复用 PositionedQuickMenu 与类型
import {
	// 声明式锚定菜单组件
	PositionedQuickMenu,
	// 菜单状态类型（open/x/y）
	type PositionedQuickMenuState,
	// 菜单项类型
	type QuickContextMenuEntry,
} from '@design/ContextMenu';

// 新版：菜单状态复用 PositionedQuickMenuState，扩展 hasSelection
export type EpubReaderContextMenuState = PositionedQuickMenuState & {
	// 是否有选区（EPUB 用来决定菜单项集合）
	hasSelection: boolean;
};

// 新版：Props 不变
type Props = {
	state: EpubReaderContextMenuState | null;
	items: readonly QuickContextMenuEntry[];
	onOpenChange: (open: boolean) => void;
};

// 新版：函数体仅一行——委托给 PositionedQuickMenu
export function EpubReaderContextMenu({ state, items, onOpenChange }: Props) {
	return (
		// 直接渲染 PositionedQuickMenu，透传 state/items/onOpenChange
		<PositionedQuickMenu
			state={state}
			items={items}
			onOpenChange={onOpenChange}
		/>
	);
}
```

**变更摘要**：删除 `EpubReaderContextMenu` 内约 70 行重复的 `MenuEntries` / `anchorStyle` / `DropdownMenu` 拼装逻辑，改为复用 `PositionedQuickMenu`；`EpubReaderContextMenuState` 改为 `PositionedQuickMenuState & { hasSelection }` 复用基础类型。

---

### 4.4 `ContextMenu/index.tsx` — barrel 导出新增

**对比范围**：`ContextMenu/index.tsx` 整个文件。

**改动前** · `apps/frontend/src/components/design/ContextMenu/index.tsx`（基线 `HEAD`，约 L5–L14）

```typescript
// 旧版：仅导出 ContextMenuUi / primitives / QuickContextMenu / types
export * as ContextMenuUi from '@/components/ui/context-menu';
export * from './primitives';
export {
	QuickContextMenu,
	type QuickContextMenuProps,
} from './QuickContextMenu';
export * from './types';
```

**改动后** · `apps/frontend/src/components/design/ContextMenu/index.tsx`（当前，约 L5–L22）

```typescript
// 新版：新增 PositionedQuickMenu 与 useSelectionContextMenu 导出
export * as ContextMenuUi from '@/components/ui/context-menu';
// 新增：PositionedQuickMenu 组件 + 状态类型
export {
	PositionedQuickMenu,
	type PositionedQuickMenuState,
} from './PositionedQuickMenu';
export * from './primitives';
export {
	QuickContextMenu,
	type QuickContextMenuProps,
} from './QuickContextMenu';
export * from './types';
// 新增：useSelectionContextMenu hook + 类型
export {
	useSelectionContextMenu,
	type SelectionContextMenuCtx,
	type SelectionContextMenuItemsFn,
} from './useSelectionContextMenu';
```

**变更摘要**：barrel 新增 `PositionedQuickMenu`、`useSelectionContextMenu` 及配套类型导出，供 `ChatAssistantMessage` / `Markdown` / `EpubReaderContextMenu` 消费。

---

### 4.5 `ChatAssistantMessage` — 集成选区右键菜单

**对比范围**：`ChatAssistantMessage/index.tsx` 的 props 定义、组件内 hook 调用、容器事件绑定、菜单渲染、memo 相等函数。

**改动前** · `apps/frontend/src/components/design/ChatAssistantMessage/index.tsx`（基线 `HEAD`，约 L148–L162）

```typescript
// 旧版：props 无选区菜单字段
interface AssistantMessageProps {
	// ...（其它字段未改动）
	scrollViewportRef?: React.RefObject<HTMLElement | null>;
	className?: string;
}

function ChatAssistantMessageInner({
	// ...（其它字段未改动）
	scrollViewportRef,
	className,
}: AssistantMessageProps) {
	const { theme: appTheme } = useTheme();
	// 挂在外层 div，作为 IntersectionObserver 的 observe 目标
	const shellRef = useRef<HTMLDivElement>(null);
	// 旧版：无选区右键 hook
	const bodyMarkdownRef = useRef<HTMLDivElement>(null);
```

**改动后** · `apps/frontend/src/components/design/ChatAssistantMessage/index.tsx`（当前，约 L4–L9、L152–L177）

```typescript
// 新增 import：选区菜单 hook + 类型
import {
	// 选区菜单项工厂类型
	type SelectionContextMenuItemsFn,
	// 选区菜单 hook
	useSelectionContextMenu,
} from '@design/ContextMenu';
// ...（其它 import 未改动）

// 新版：props 新增 getSelectionContextMenuItems
interface AssistantMessageProps {
	// ...（其它字段未改动）
	scrollViewportRef?: React.RefObject<HTMLElement | null>;
	className?: string;
	// 新增：选中消息正文后右键菜单；不传则关闭（默认）
	getSelectionContextMenuItems?: SelectionContextMenuItemsFn;
}

function ChatAssistantMessageInner({
	// ...（其它字段未改动）
	scrollViewportRef,
	className,
	// 新增：解构选区菜单工厂
	getSelectionContextMenuItems,
}: AssistantMessageProps) {
	const { theme: appTheme } = useTheme();
	// 挂在外层 div，作为 IntersectionObserver 的 observe 目标，覆盖整条助手气泡
	const shellRef = useRef<HTMLDivElement>(null);
	// 新增：选区右键 hook 三件套
	const {
		// contextmenu 捕获处理器
		onContextMenuCapture: onSelectionContextMenuCapture,
		// pointerdown 捕获处理器
		onPointerDownCapture: onSelectionPointerDownCapture,
		// 菜单 ReactNode
		menu: selectionContextMenu,
	} = useSelectionContextMenu(getSelectionContextMenuItems);
	const bodyMarkdownRef = useRef<HTMLDivElement>(null);
```

**改动前** · `apps/frontend/src/components/design/ChatAssistantMessage/index.tsx`（基线 `HEAD`，约 L486–L490）

```typescript
// 旧版：shell div 无选区事件绑定
				ref={shellRef}
				className="w-full h-auto"
				data-chat-assistant-shell
			>
```

**改动后** · `apps/frontend/src/components/design/ChatAssistantMessage/index.tsx`（当前，约 L501–L505）

```typescript
// 新版：shell div 绑定选区捕获事件
				ref={shellRef}
				className="w-full h-auto"
				data-chat-assistant-shell
				// 新增：contextmenu 捕获，决定是否弹自定义菜单
				onContextMenuCapture={onSelectionContextMenuCapture}
				// 新增：pointerdown 捕获，右键按下时快照选区
				onPointerDownCapture={onSelectionPointerDownCapture}
			>
```

**改动前** · `apps/frontend/src/components/design/ChatAssistantMessage/index.tsx`（基线 `HEAD`，约 L759–L766）

```typescript
// 旧版：memo 相等函数未比较选区菜单字段
		prev.onContinue === next.onContinue &&
		prev.onContinueAnswering === next.onContinueAnswering
	);
}
```

**改动后** · `apps/frontend/src/components/design/ChatAssistantMessage/index.tsx`（当前，约 L777–L784）

```typescript
// 新版：memo 相等函数新增 4 项比较
		prev.onContinue === next.onContinue &&
		prev.onContinueAnswering === next.onContinueAnswering &&
		// 新增：选区菜单工厂引用相等
		prev.getSelectionContextMenuItems === next.getSelectionContextMenuItems &&
		// 新增：className 相等
		prev.className === next.className &&
		// 新增：t 相等
		prev.t === next.t
	);
}
```

**变更摘要**：`ChatAssistantMessage` 新增 `getSelectionContextMenuItems` prop，内部用 `useSelectionContextMenu` 产出三件套挂到 shell div，并在末尾渲染 `{selectionContextMenu}`；memo 相等函数补齐 4 项比较。`Markdown` 预览组件（`ParserMarkdownPreviewPane`）同构集成，逻辑一致，此处不重复贴代码（见源码 `apps/frontend/src/components/design/Markdown/index.tsx` L96–L131、L452–L531）。

---

### 4.6 `Assistant/types.ts` — 新增 `floatAbove` 与 `getSelectionContextMenuItems` 字段

**对比范围**：`Assistant/types.ts` 中 `AssistantFooterProps` 与 `AssistantMessageRowProps` / `AssistantMessageBubbleProps`。

**改动前** · `apps/frontend/src/components/design/Assistant/types.ts`（基线 `HEAD`，约 L88–L94）

```typescript
export type AssistantFooterProps = {
	containerClassName?: string;
	showScrollFab?: boolean;
	scrollFab?: ScrollFabProps;
	// 旧版：无 floatAbove
	children: ReactNode;
};
```

**改动后** · `apps/frontend/src/components/design/Assistant/types.ts`（当前，约 L6–L8、L91–L96）

```typescript
// 新增 import：选区菜单工厂类型
import type { SelectionContextMenuItemsFn } from '@/components/design/ContextMenu';
// ...（其它 import 未改动）

export type AssistantFooterProps = {
	containerClassName?: string;
	showScrollFab?: boolean;
	scrollFab?: ScrollFabProps;
	// 新增：输入框上方悬浮层（如朗读控制条），定位相对本 Footer 内容区
	floatAbove?: ReactNode;
	children: ReactNode;
};
```

**改动前** · `apps/frontend/src/components/design/Assistant/types.ts`（基线 `HEAD`，约 L118–L141）

```typescript
export type AssistantMessageRowProps = {
	// ...（其它字段未改动）
	className?: string;
	t?: ChatI18nT;
	// 旧版：无 getSelectionContextMenuItems
};

export type AssistantMessageBubbleProps = {
	// ...（其它字段未改动）
	className?: string;
	t?: ChatI18nT;
	// 旧版：无 getSelectionContextMenuItems
};
```

**改动后** · `apps/frontend/src/components/design/Assistant/types.ts`（当前，约 L123–L146）

```typescript
export type AssistantMessageRowProps = {
	// ...（其它字段未改动）
	className?: string;
	t?: ChatI18nT;
	// 新增：选区右键菜单工厂
	getSelectionContextMenuItems?: SelectionContextMenuItemsFn;
};

export type AssistantMessageBubbleProps = {
	// ...（其它字段未改动）
	className?: string;
	t?: ChatI18nT;
	// 新增：选区右键菜单工厂（透传给 ChatAssistantMessage）
	getSelectionContextMenuItems?: SelectionContextMenuItemsFn;
};
```

**变更摘要**：`AssistantFooterProps` 新增 `floatAbove` 槽位；`AssistantMessageRowProps` / `AssistantMessageBubbleProps` 新增 `getSelectionContextMenuItems` 透传字段。

---

### 4.7 `Assistant/Footer.tsx` — 渲染 `floatAbove`

**对比范围**：`Footer.tsx` 整个组件。

**改动前** · `apps/frontend/src/components/design/Assistant/Footer.tsx`（基线 `HEAD`，约 L6–L26）

```typescript
export function AssistantFooter({
	embedded: _embedded = false,
	containerClassName,
	showScrollFab = false,
	scrollFab,
	// 旧版：无 floatAbove
	children,
}: AssistantFooterProps) {
	return (
		<div className="min-w-0 w-full shrink-0">
			<div
				className={cn(
					'relative mx-auto min-w-0 w-full max-w-3xl pl-4 pr-4',
					containerClassName,
				)}
			>
				// 旧版：无 floatAbove 渲染
				{showScrollFab && scrollFab ? <ScrollFab {...scrollFab} /> : null}
				{children}
			</div>
		</div>
	);
}
```

**改动后** · `apps/frontend/src/components/design/Assistant/Footer.tsx`（当前，约 L6–L27）

```typescript
export function AssistantFooter({
	embedded: _embedded = false,
	containerClassName,
	showScrollFab = false,
	scrollFab,
	// 新增：悬浮层（如朗读控制条）
	floatAbove,
	children,
}: AssistantFooterProps) {
	return (
		<div className="min-w-0 w-full shrink-0">
			<div
				className={cn(
					'relative mx-auto min-w-0 w-full max-w-3xl pl-4 pr-4',
					containerClassName,
				)}
			>
				// 新增：渲染悬浮层（位于 ScrollFab 与 children 之上）
				{floatAbove}
				{showScrollFab && scrollFab ? <ScrollFab {...scrollFab} /> : null}
				{children}
			</div>
		</div>
	);
}
```

**变更摘要**：`AssistantFooter` 新增 `floatAbove` prop 并在内容区顶部渲染，供选区朗读悬浮条挂载。

---

### 4.8 `Assistant/utils.ts` — `select-auto` → `select-text`

**对比范围**：`messageLabelClass` 函数。

**改动前** · `apps/frontend/src/components/design/Assistant/utils.ts`（基线 `HEAD`，约 L55–L66）

```typescript
export function messageLabelClass(
	// ...（参数未改动）
): string {
	if (variant === 'english') {
		return cn(
			// 旧版：select-auto，系统决定是否可选
			'message-md-wrap relative mb-5 flex min-w-0 max-w-full select-auto rounded-md p-4 text-textcolor',
			// ...（分支未改动）
		);
	}
	return cn(
		// 旧版：select-auto
		'message-md-wrap relative flex min-w-0 max-w-full rounded-md p-3 select-auto text-textcolor mb-5',
		// ...（分支未改动）
	);
}
```

**改动后** · `apps/frontend/src/components/design/Assistant/utils.ts`（当前，约 L55–L66）

```typescript
export function messageLabelClass(
	// ...（参数未改动）
): string {
	if (variant === 'english') {
		return cn(
			// 新版：select-text，强制允许用户选中文本（选区右键菜单前提）
			'message-md-wrap relative mb-5 flex min-w-0 max-w-full select-text rounded-md p-4 text-textcolor',
			// ...（分支未改动）
		);
	}
	return cn(
		// 新版：select-text
		'message-md-wrap relative flex min-w-0 max-w-full rounded-md p-3 select-text text-textcolor mb-5',
		// ...（分支未改动）
	);
}
```

**变更摘要**：消息气泡容器从 `select-auto`（交由系统默认）改为 `select-text`（显式允许选中），确保选区右键菜单可获取选中文本。

---

### 4.9 `selectionContextMenu.ts` — 英语 Agent 选区菜单项工厂（纯新增）

**对比范围**：`selectionContextMenu.ts` 整个文件。纯新增。

**新增** · `apps/frontend/src/views/englishLearning/agent/selectionContextMenu.ts`（当前，约 L1–L45）

```typescript
// import：选区菜单工厂类型
import type { SelectionContextMenuItemsFn } from '@design/ContextMenu';
// import：Toast 提示
import { Toast } from '@ui/index';
// import：剪贴板复制工具
import { copyToClipboard } from '@/utils/clipboard';
// import：播放可用性检查
import { isPlaybackAvailable } from '@/utils/speech';

// t 函数类型别名
type TFn = (key: string, params?: Record<string, unknown>) => string;

// 英语 Agent 消息选区右键：朗读（由外部会话启动）+ 复制
export function createEnglishAgentSelectionMenu(
	// i18n t 函数
	t: TFn,
	// 朗读启动回调（由 useSelectionSpeak.start 提供）
	onSpeak: (text: string) => boolean,
	// 返回 SelectionContextMenuItemsFn
): SelectionContextMenuItemsFn {
	// 返回菜单项工厂闭包
	return (selectedText, _ctx) => {
		// 去首尾空白
		const text = selectedText.trim();
		// 空文本 → 不弹菜单
		if (!text) return null;

		// 返回菜单项数组
		return [
			{
				// 普通可点击项
				type: 'item',
				// id
				id: 'speak',
				// 标签（i18n）
				label: t('englishLearning.selection.speak'),
				// 选中回调
				onSelect: () => {
					// 播放不可用 → 警告提示
					if (!isPlaybackAvailable()) {
						Toast({
							// 警告类型
							type: 'warning',
							// 标题（i18n）
							title: t('englishLearning.tts.unsupported'),
						});
						// 中止
						return;
					}
					// 启动朗读
					onSpeak(text);
				},
			},
			{
				// 普通可点击项
				type: 'item',
				// id
				id: 'copy',
				// 标签（i18n）
				label: t('englishLearning.selection.copy'),
				// 选中回调
				onSelect: () => {
					// 复制到剪贴板（void 忽略 Promise）
					void copyToClipboard(text);
				},
			},
		];
	};
}
```

---

### 4.10 `useSelectionSpeak` — 选区朗读会话 hook（纯新增）

**对比范围**：`useSelectionSpeak.tsx` 的 `start` 函数（核心启动逻辑）。其余 `stop` / `pause` / `resume` / `setRate` 见源码。

**新增** · `apps/frontend/src/views/englishLearning/agent/useSelectionSpeak.ts`（当前，约 L64–L124）

```typescript
// 启动选区朗读：听当前同款按段 TTS
const start = useCallback(
	// 原始文本（可能含 Markdown）
	(rawText: string) => {
		// 去首尾空白
		const text = rawText.trim();
		// 空文本 → 不启动
		if (!text) return false;
		// 播放不可用 → 不启动
		if (!isPlaybackAvailable()) return false;

		// 剥 Markdown 得纯文本
		const plain = stripMarkdownForTts(text);
		// 纯文本为空 → 不启动
		if (!plain) return false;
		// 按句切分（返回 offset spans）
		const sentences = buildSentenceOffsetSpans(plain);

		// 世代号自增，作废所有旧回调
		const seq = ++seqRef.current;
		// 重置暂停标志
		pausedRef.current = false;
		// 记录原始文本
		textRef.current = text;
		// 记录纯文本
		plainRef.current = plain;
		// 记录句子 spans
		sentencesRef.current = sentences;
		// 停止旧播放
		stopAllPlayback();
		// 预览首句
		applySentence(0);
		// 进入 loading 态
		setStatus('loading');

		// 异步启动播放
		void (async () => {
			try {
				// 调用听当前同款播法入口
				const ok = await playListenPlainText(plain, {
					// isActive：同世代且未暂停
					isActive: () => seq === seqRef.current && !pausedRef.current,
					// getRate：当前倍速
					getRate: () => rateRef.current,
					// 等待当前句 TTS 时回调
					onAwaitingCurrentTts: (waiting) => {
						// 旧世代或已暂停 → 忽略
						if (seq !== seqRef.current || pausedRef.current) return;
						// waiting=true → loading；否则 playing
						setStatus(waiting ? 'loading' : 'playing');
					},
					// 句切换回调
					onSentence: (si) => {
						// 旧世代 → 忽略
						if (seq !== seqRef.current) return;
						// 更新预览
						applySentence(si);
					},
				});
				// 旧世代 → 忽略后续
				if (seq !== seqRef.current) return;
				// 正常结束且未暂停 → 回 idle
				if (ok && !pausedRef.current) {
					// 状态回 idle
					setStatus('idle');
					// 清空预览
					setPreview('');
					// 清空文本
					textRef.current = '';
					// 清空纯文本
					plainRef.current = '';
					// 清空句子
					sentencesRef.current = [];
					// 失败且非暂停态 → 回 idle
				} else if (!ok && statusRef.current !== 'paused') {
					// 状态回 idle
					setStatus('idle');
					// 清空预览
					setPreview('');
					// 清空文本
					textRef.current = '';
					// 清空纯文本
					plainRef.current = '';
					// 清空句子
					sentencesRef.current = [];
				}
			} catch {
				// 旧世代 → 忽略
				if (seq !== seqRef.current) return;
				// 异常 → 回 idle
				setStatus('idle');
				// 清空预览
				setPreview('');
				// 清空文本
				textRef.current = '';
				// 清空纯文本
				plainRef.current = '';
				// 清空句子
				sentencesRef.current = [];
			}
		})();

		// 启动成功
		return true;
	},
	// 依赖 applySentence
	[applySentence],
);
```

---

### 4.11 `SelectionSpeakBar` — 悬浮条拖动核心（纯新增摘录）

**对比范围**：`SelectionSpeakBar.tsx` 的 `onHandlePointerDown`（首次拖动切 fixed 并钉住起点）。其余拖动 move/up、ResizeObserver、渲染见源码。

**新增** · `apps/frontend/src/views/englishLearning/agent/SelectionSpeakBar.tsx`（当前，约 L143–L187）

```typescript
// 拖动手柄 pointerdown：首次拖切换 absolute → fixed 并钉住起点
const onHandlePointerDown = useCallback(
	(e: ReactPointerEvent<HTMLButtonElement>) => {
		// 非左键不处理
		if (e.button !== 0) return;
		// 取面板边界 rect
		const box = boundsRef.current?.getBoundingClientRect();
		// 取 bar 元素
		const bar = barRef.current;
		// 取 bar rect
		const barRect = bar?.getBoundingClientRect();
		// 边界或 bar 不存在 → 中止
		if (!box || !bar || !barRect) return;
		// 阻止默认（避免选中文本）
		e.preventDefault();
		// 捕获指针
		e.currentTarget.setPointerCapture(e.pointerId);
		// 计算起始 fixed 坐标（首次拖时 bar 还在 absolute，用 barRect 算 clamp）
		const current =
			// 已有 fixed 坐标则用之
			fixedPosRef.current ??
			// 否则用 barRect clamp 到 box
			clampFixed(
				// bar 左
				barRect.left,
				// bar 顶
				barRect.top,
				// bar 宽
				barRect.width,
				// bar 高
				barRect.height,
				// 边界
				box,
			);
		// 首次拖：切到 fixed 并钉住起点（一次 setState）
		if (fixedPosRef.current == null) {
			// 写入 ref（拖动中以 ref 为准）
			fixedPosRef.current = current;
			// 移除 absolute 定位类
			bar.classList.remove(
				// absolute
				'absolute',
				// bottom-full
				'bottom-full',
				// left-1/2
				'left-1/2',
				// mb-[9px]
				'mb-[9px]',
				// -translate-x-1/2
				'-translate-x-1/2',
			);
			// 加 fixed 类
			bar.classList.add('fixed');
			// 直接写 style（避免等 setState）
			applyFixedStyle(current);
			// setState 同步（供渲染层）
			setFixedPos(current);
		}
		// 记录拖动上下文
		dragRef.current = {
			// 指针 id
			pointerId: e.pointerId,
			// 起始 x
			startX: e.clientX,
			// 起始 y
			startY: e.clientY,
			// 起点 left
			originLeft: current.left,
			// 起点 top
			originTop: current.top,
			// bar 宽
			barW: barRect.width,
			// bar 高
			barH: barRect.height,
			// 边界 rect
			box,
		};
	},
	// 依赖 boundsRef 与 applyFixedStyle
	[boundsRef, applyFixedStyle],
);
```

---

### 4.12 `englishLearning/agent/index.tsx` — Agent 面板装配

**对比范围**：`AgentPanel` 组件的 hook 调用、`handleNewChat`、`assistantFooter` 的 `floatAbove`、消息渲染透传。

**改动前** · `apps/frontend/src/views/englishLearning/agent/index.tsx`（基线 `HEAD`，约 L61–L66）

```typescript
const { isCopyedId, onCopy } = useAssistantCopy();
// 旧版：无选区朗读 hook、无 panelRef
```

**改动后** · `apps/frontend/src/views/englishLearning/agent/index.tsx`（当前，约 L13–L17、L64–L71）

```typescript
// 新增 import：useRef
	useRef,
// ...（其它 import 未改动）
// 新增 import：SelectionSpeakBar / selectionContextMenu / useSelectionSpeak
import { SelectionSpeakBar } from './SelectionSpeakBar';
import { createEnglishAgentSelectionMenu } from './selectionContextMenu';
import { useSelectionSpeak } from './useSelectionSpeak';
// ...（组件体内）
const { isCopyedId, onCopy } = useAssistantCopy();
// 新增：面板 ref（悬浮条拖动边界）
const panelRef = useRef<HTMLDivElement>(null);
// 新增：选区朗读会话
const selectionSpeak = useSelectionSpeak();

// 新增：选区菜单工厂（memo 化，依赖 t 与 start）
const getSelectionContextMenuItems = useMemo(
	// 工厂闭包
	() => createEnglishAgentSelectionMenu(t, selectionSpeak.start),
	// 依赖 t 与 start
	[t, selectionSpeak.start],
);
```

**改动前** · `apps/frontend/src/views/englishLearning/agent/index.tsx`（基线 `HEAD`，约 L129–L133）

```typescript
// 旧版：直接 onNewChat
const handleSendMessage = useCallback(async () => {
	await sendMessage();
}, [sendMessage, enableStreamStickToBottom]);
```

**改动后** · `apps/frontend/src/views/englishLearning/agent/index.tsx`（当前，约 L142–L146）

```typescript
// 新增：新会话时先停止朗读
const handleNewChat = useCallback(() => {
	// 停止选区朗读
	selectionSpeak.stop();
	// 再开新会话
	onNewChat();
}, [onNewChat, selectionSpeak.stop]);
```

**改动前** · `apps/frontend/src/views/englishLearning/agent/index.tsx`（基线 `HEAD`，约 L143–L148）

```typescript
const assistantFooter = (
	<AssistantFooter
		// ...（其它 props 未改动）
	}}
	>
		// ...（children 未改动）
```

**改动后** · `apps/frontend/src/views/englishLearning/agent/index.tsx`（当前，约 L162–L175）

```typescript
const assistantFooter = (
	<AssistantFooter
		// ...（其它 props 未改动）
		// 新增：悬浮朗读条（仅 visible 时渲染）
		floatAbove={
			selectionSpeak.visible ? (
				<SelectionSpeakBar
					// 拖动边界
					boundsRef={panelRef}
					// 状态
					status={selectionSpeak.status}
					// 倍速
					rate={selectionSpeak.rate}
					// 预览
					preview={selectionSpeak.preview}
					// 播放/暂停
					onTogglePlay={selectionSpeak.togglePlay}
					// 停止
					onStop={selectionSpeak.stop}
					// 倍速变更
					onRateChange={selectionSpeak.setRate}
				/>
			) : null
		}
	>
		// ...（children 未改动）
```

**变更摘要**：`AgentPanel` 装配 `useSelectionSpeak` + 选区菜单工厂；`handleNewChat` 包裹 `onNewChat` 先停朗读；`AssistantFooter` 透传 `floatAbove` 渲染悬浮条；消息渲染透传 `getSelectionContextMenuItems`；面板根 `div` 加 `ref={panelRef}` 作拖动边界。

---

### 4.13 `playListenPlainText.ts` — 选区朗读复用听书链路入口（纯新增）

**对比范围**：`playListenPlainText.ts` 整个文件。纯新增。

**新增** · `apps/frontend/src/views/ebook/utils/epub/listen/playListenPlainText.ts`（当前，约 L11–L37）

```typescript
// 无 EPUB 高亮的听当前同款播法：首句快出声，其后按段整包 TTS
export async function playListenPlainText(
	// 原始文本（可能含 Markdown）
	rawText: string,
	// 播放选项
	options?: {
		// 是否活跃（同世代且未暂停）
		isActive?: () => boolean;
		// 倍速
		getRate?: () => number;
		// 等待当前句 TTS 回调
		onAwaitingCurrentTts?: (waiting: boolean) => void;
		// 句切换回调
		onSentence?: (si: number, info: { forceCenter?: boolean }) => void;
	},
	// 返回是否正常播放完成
): Promise<boolean> {
	// 剥 Markdown 得纯文本
	const plain = stripMarkdownForTts(rawText).trim();
	// 空文本 → 失败
	if (!plain) return false;
	// 按句切分
	const sentences = buildSentenceOffsetSpans(plain);
	// 无句 → 失败
	if (sentences.length === 0) return false;
	// 按段打包
	const units = buildParagraphUnits(plain, sentences);
	// 无段 → 失败
	if (units.length === 0) return false;

	// 委托给听书同款播放游标
	return playListenUnitsFromCursor({
		// 纯文本
		plain,
		// 句子 spans
		sentences,
		// 段落 units
		units,
		// 起始句索引
		startSi: 0,
		// 倍速（默认 1）
		getRate: options?.getRate ?? (() => 1),
		// 活跃判定（默认 true）
		isActive: options?.isActive ?? (() => true),
		// 句回调（默认 noop）
		onSentence: options?.onSentence ?? (() => {}),
		// 等待回调
		onAwaitingCurrentTts: options?.onAwaitingCurrentTts,
	});
}
```

**变更摘要**：新增 `playListenPlainText` 入口，将「剥 Markdown → 分句 → 分段 → `playListenUnitsFromCursor`」封装为一步，供选区朗读复用听书链路；`useSelectionSpeak` 通过 `onAwaitingCurrentTts` / `onSentence` 回调驱动状态机与预览。

## 5. 兼容性与影响

| 项目 | 说明 |
|------|------|
| 未传 `getSelectionContextMenuItems` | `useSelectionContextMenu` 返回 `undefined`/`null`，零开销，行为与改动前完全一致 |
| 系统右键菜单 | 选中文本且 `getItems` 返回非空时才 `preventDefault`；未选中或返回空时放行系统菜单 |
| EPUB 右键菜单 | `EpubReaderContextMenu` 改用 `PositionedQuickMenu`，外部 API（`state`/`items`/`onOpenChange`）不变 |
| `ChatAssistantMessage` / `Markdown` | 新增 prop 可选，不传则不启用选区菜单 |
| 朗读与听书 | 共享 `playListenUnitsFromCursor`；切句时序优化见 [epub-listen-cadence-lead.md](../ebook/epub-listen-cadence-lead.md) |
| 新会话 | `handleNewChat` 先 `stop()` 朗读，避免残留 |
| 消息正文可选 | `select-auto` → `select-text`，不影响其它样式 |

## 6. 风险与回归清单

| 风险 | 排查 |
|------|------|
| macOS 右键选区被系统改写 | pointerdown 快照 + contextmenu 捕获阶段双保险；测试：拖选一段 → 右键 → 菜单弹出且文本正确 |
| 菜单未弹出 | `getItems` 返回空时不弹；确认选中文本非空、`isPlaybackAvailable()` 未拦截（复制项不依赖播放） |
| 朗读残留 | 切会话 / 切路由时确认 `stop()` 被调用；`useEffect` 卸载清理 |
| 悬浮条拖出面板 | `clampFixed` 限制在 `boundsRef` 内；`ResizeObserver` 面板缩放时重新 clamp |
| 悬浮条拖动闪烁 | 拖动中直接改 DOM（ref），不每帧 setState；确认 `fixedPosRef` 与 `fixedPos` 同步 |
| EPUB 右键菜单回归 | 复用 `PositionedQuickMenu` 后行为一致；测试 EPUB 选区右键弹菜单 |

建议回归：
1. 英语 Agent 消息：拖选一段 → 右键 → 菜单含「朗读内容」「复制内容」
2. 点「朗读内容」→ 悬浮条出现 → 首句出声 → 句预览跟随切换
3. 悬浮条拖动 → 切 fixed → 限制在面板内 → 松手位置保持
4. 倍速菜单 → 切换 0.75/1.5/2 → 朗读倍速变化
5. 暂停 / 续播 / 停止 → 状态正确
6. 朗读中点「新会话」→ 朗读停止
7. 未选中文本右键 → 弹系统菜单（非自定义）
8. EPUB 阅读器选区右键 → 菜单正常（复用 PositionedQuickMenu）

## 7. 相关源码路径

| 说明 | 路径 |
|------|------|
| 选区右键 hook | `apps/frontend/src/components/design/ContextMenu/useSelectionContextMenu.tsx` |
| 声明式锚定菜单 | `apps/frontend/src/components/design/ContextMenu/PositionedQuickMenu.tsx` |
| ContextMenu barrel | `apps/frontend/src/components/design/ContextMenu/index.tsx` |
| EPUB 右键菜单（复用） | `apps/frontend/src/views/ebook/components/reader/EpubReaderContextMenu.tsx` |
| 助手 Footer | `apps/frontend/src/components/design/Assistant/Footer.tsx` |
| 助手类型 | `apps/frontend/src/components/design/Assistant/types.ts` |
| 助手 utils | `apps/frontend/src/components/design/Assistant/utils.ts` |
| 助手 MessageRow | `apps/frontend/src/components/design/Assistant/MessageRow.tsx` |
| ChatAssistantMessage | `apps/frontend/src/components/design/ChatAssistantMessage/index.tsx` |
| Markdown 预览 | `apps/frontend/src/components/design/Markdown/index.tsx` |
| 选区菜单工厂 | `apps/frontend/src/views/englishLearning/agent/selectionContextMenu.ts` |
| 选区朗读 hook | `apps/frontend/src/views/englishLearning/agent/useSelectionSpeak.ts` |
| 朗读悬浮条 | `apps/frontend/src/views/englishLearning/agent/SelectionSpeakBar.tsx` |
| Agent 面板装配 | `apps/frontend/src/views/englishLearning/agent/index.tsx` |
| 听书链路入口 | `apps/frontend/src/views/ebook/utils/epub/listen/playListenPlainText.ts` |
| 中文 i18n | `apps/frontend/src/i18n/locales/zh-CN.ts` |
| 英文 i18n | `apps/frontend/src/i18n/locales/en-US.ts` |

---

（若与仓库最新源码不一致，以源码为准）
