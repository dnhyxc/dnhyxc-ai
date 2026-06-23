---
name: frontend-react
description: React 前端编码默认规范：组件优先 @/components/design，其次 @/components/ui，都没有再自建；命名简洁语义化；遵循 Ponytail 最少必要代码。在 apps/frontend 编写或修改页面、组件、hook、工具、样式或任意 TS/TSX 业务代码时自动适用；用户要求写 UI、改前端、加按钮/表单/弹窗/列表时也适用。
---

# React 前端编码（frontend-react）

在 **apps/frontend** 写代码时的默认流程。与 always-on 的 Ponytail 规则叠加：先选对组件、再写最少必要代码。

## 1. 组件选用（design → ui → 自建）

写 UI 前**必须先查现有组件**，按优先级：

```
1. @/components/design/*   — 业务/复合组件（第一选择）
2. @/components/ui/*        — 基础 shadcn 原子组件
3. 都没有                    — 在当前文件或同模块最小实现
```

**禁止**：ui 里已有 Button，却手写 `<button className="...">`；design 里已有 ChatEntry/Loading/Confirm，却重复造同类组件。

### 如何查找

1. **目录速查**（改代码前快速扫一眼）：
   - `apps/frontend/src/components/design/` — ChatEntry、Loading、Confirm、Drawer、ContextMenu、Monaco、ChatBot…
   - `apps/frontend/src/components/ui/` — Button、Input、Dialog、Popover、Select、ScrollArea、Tooltip…
2. **MCP 组件目录**（可用时）：按 `component-catalog` skill 调 `search_components` → `get_component_details` → `resolve_component_import`。
3. **import 路径**：与仓库一致，例如 `@/components/ui`、`@/components/design/Loading`；以 catalog examples 或邻近文件为准。

### 示例

| 需求 | design 有？ | ui 有？ | 选用 |
|------|------------|---------|------|
| 按钮 | 无 | `Button` | `@/components/ui` 的 `Button` |
| 全页 Loading | `Loading` | 无 | `@/components/design/Loading` |
| 确认弹窗 | `Confirm` | `AlertDialog` | 优先 `Confirm`；简单确认再用 ui |

## 2. 命名

简洁且语义明确；**避免冗长前缀/重复上下文**。

| 避免 | 推荐 |
|------|------|
| `handleEpubReaderSettingsPopoverCloseButtonClick` | `closeSettings` |
| `isEpubThoughtListPanelCurrentlyVisible` | `listOpen` |
| `EpubReaderSurfaceBackgroundColorValue` | `surfaceBg` |

- 组件文件：PascalCase，与导出组件同名。
- hook：`use` + 简短谓词（`useQuoteClamp`）。
- 事件处理：`onSave`、`closePanel`；布尔：`open`、`loading`、`hasQuote`。
- 文件名已表达域（如在 `EpubPane.tsx`）时，标识符里不必再堆 `Epub` 前缀。

## 3. Ponytail 写码原则（与 `.cursor/rules/ponytail.mdc` 一致）

- 先理解再改：读调用链，最小 diff。
- YAGNI 阶梯：别建 → 复用本文件/本模块 → 标准库 → 平台原生 → 已有依赖 → 一行能搞定 → 最后才写最少实现。
- 不加未要求的抽象、不引新依赖、不铺样板。
- **不砍**：校验、错误处理、安全、无障碍、用户明确要求的功能。
-  intentional 简化用 `ponytail:` 注释标上限与升级路径。

## 4. 动手前检查（mental checklist）

- [ ] design 里有没有现成复合组件？
- [ ] ui 里有没有对应原子组件？
- [ ] 能否改 props/组合，而不是新文件？
- [ ] 命名是否够短、一眼能懂？
- [ ] diff 是否还能更短且正确？

## 5. 与 component-catalog 的分工

- **本 skill**：选用顺序（design > ui > 自建）、命名、Ponytail。
- **component-catalog skill**：MCP 查 props、examples、import 语句。

两者同时适用；MCP 不可用时降级为目录搜索 + 读源码 export。
