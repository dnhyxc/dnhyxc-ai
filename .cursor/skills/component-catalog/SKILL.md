---
name: component-catalog
description: 在实现或修改 React UI 时，通过组件目录 MCP 自动查找并正确引用本仓库组件（@ui/@design/@ 别名），用真实示例（examples.title/code）生成带参数的组件用法。适用于“写页面/加按钮/加弹窗/表单/菜单/tooltip/monaco/chat 组件”等需求，或用户提到“用组件库/组件目录/根据组件 json 自动 import”时。
---

# 组件目录（component-catalog）Skill

本 Skill 约定：在需要使用本仓库组件实现/修改 React UI 时，**优先通过组件目录 MCP 查询**，避免臆测组件 API、导出方式或 import 路径。

## 目标

- **自动找到合适组件**：不要凭空编组件名；优先复用 `apps/frontend/src/components` 下现有组件。
- **自动生成正确引用**：按项目别名（`@ui/*`、`@design/*`、`@/*`）写 import。
- **自动生成可用示例**：优先使用 catalog 的 `examples[]`（每条含 `title`、`code`），示例必须体现**传参/props**，而不是只展示导入。

## 适用场景（触发）

- 用户要你实现 UI：按钮、表单、弹窗、下拉菜单、右键菜单、Toast、Tooltip、滚动区域、Monaco/聊天相关组件等。
- 用户说“用组件库/组件目录/根据 components.json 自动引用组件”。
- 你需要在代码中引入 `@/components/ui/*` 或 `@/components/design/*` 的组件。

## 工具清单（MCP）

该 Skill 依赖 MCP 服务 **`user-dnhyxc-component-catalog`**：

- `search_components`：关键词检索组件。
- `list_components`：列出组件摘要（可按 `group/category/tag` 过滤）。
- `list_component_ids`：只列出组件 id（可过滤）。
- `get_component_details`：拿完整详情（props、examples、source、relatedSources）。
- `resolve_component_import`：生成 import 建议（`importStatement`、`importKind`、`binding`、`usageHint`）。

## 核心工作流（必须按顺序）

### 1) 先找组件（不要猜）

优先调用 MCP：

- `search_components`：用中文/英文关键词检索（例如 `button`、`对话框`、`tooltip`、`chat controls`）。
- 若你只知道范围：用 `list_components`（可按 `group` / `category` / `tag` 过滤）。
- 若需要所有 id：用 `list_component_ids`。

输出时至少确认：`id`、`title`、`group`、`category`、`source`。

### 2) 拿到组件详情与真实示例

对候选组件逐个调用：

- `get_component_details`（优先用 `id`）

并重点读取：

- **props**：确认关键入参（如 `variant`、`size`、`open`、`onOpenChange` 等）
- **examples**：按本仓库规范，示例形如：
  - `title`: 示例标题
  - `code`: **带参数的 JSX 用法**（必要时含 import）
- **source** / `relatedSources`：当 examples 不足或 export 复杂时，定位源码核对导出形式。

### 3) 生成 import 与落地用法（以 examples 为主）

调用：

- `resolve_component_import`

落地规则：

- **优先使用 `examples[].code` 的 import 风格**（例如 `@ui/index`、`@design/ChatControls`），确保与项目真实用法一致。
- 若 `examples[].code` 不含 import，则使用 `resolve_component_import.importStatement`。
- 当出现 default/named 歧义时，以 `source` 文件中的真实导出为准；必要时阅读源码确认。

### 4) 组合多个组件时的约束

- **同一文件内避免重复导入**：合并从 `@ui/index` 或相同模块路径导入的符号。
- **Props 必须真实存在**：仅使用 `get_component_details` 的 props 或 examples 中出现过的 props。
- **示例必须传参**：如果组件没有现成示例，至少提供一个最小可用的“带参数”用法（例如 `value/onChange`、`open/onOpenChange`、`onClick/disabled`、`checked/onCheckedChange` 等）。

## 快速模板（给模型直接复制的决策规则）

当用户提出 UI 需求时，按下面输出与执行：

1. 用 `search_components` 找到 1-3 个候选组件 id
2. 对每个 id 调 `get_component_details`
3. 选一个最匹配的组件，调 `resolve_component_import`
4. 将 `examples[0]`（或最匹配示例）改成当前需求的参数与文案，插入到目标文件

## 注意事项

- 若 MCP 不可用，降级策略是：直接读取 `packages/mcps/catalog/components.json` 作为组件目录；但仍应优先通过 MCP 获取详情。
