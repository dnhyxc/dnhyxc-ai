---
name: implementation-doc-from-diff
description: 基于当前改动（git diff、@ 文件或会话内已达成共识的变更）在 docs/ 下生成「实现思路」专题 Markdown：包含方案说明、关键代码摘录及代码块内详细中文注释；每个代码块上方须标注来源文件（仓库相对路径）与大致位置；新建文档后自动整理 docs/ 索引；若为用户可感知的新功能则按 project-guide.md / project-update-info.md 格式同步姊妹产品文档（正文中不得出现文件路径）；新建文档文件名须简短且贴题；严禁修改业务源码，仅允许新建或编辑文档。适用于用户说「把本次改动写成文档/实现思路文档/只写 docs 不改代码/改动说明落盘到 docs/基于 diff 写文档」等。
---

# 基于改动的实现说明文档（implementation-doc-from-diff）

## 目标

把**当前一轮改动**整理成可归档、可交接的说明文档：

- **实现思路**：为何这样做、关键决策、数据流与边界。
- **具体代码**：用 Markdown **围栏代码块**呈现与改动相关的片段；块内附**详细中文注释**（可比仓库源码注释更细，便于单独阅读）。
- **docs 体系**：新增专题后**自动整理**整个 `docs/` 索引（见 `references/docs-maintenance.md`）。
- **产品姊妹稿**：若改动包含**用户可感知**的新功能/体验变化，同步更新 `docs/project-guide.md` 与 `docs/project-update-info.md`（格式见 `references/product-user-docs.md`；**这两份正文不得出现文件 路径**）。
- **只写文档**：**不得**修改业务代码、配置与构建脚本；**仅**在 `docs/`（或用户明确指定的文档目录，且须为文档用途）中新建或更新 `*.md`。

## 硬约束（必须遵守）

1. **禁止改动非文档代码**
   - 不得编辑：`apps/**`、`packages/**`、`libs/**`、根配置、`scripts/**` 等实现与工程配置（除非用户 Explicitly 授权 —— 本 Skill 默认**不授权**）。
   - 允许编辑：`docs/**/*.md`，以及用户点名「仅文档」的同级路径（例如某些 `README.md` 若用户写明）。

2. **代码块与源码关系**（仅适用于**专题实现文**，不适用于 `project-guide.md` / `project-update-info.md`）
   - 代码块内容应与仓库**一致**；若因篇幅做省略，用 `// ...` 标明，并在段首说明「摘录」。
   - 代码块内注释统一使用**中文**；保留英文技术术语，**首次出现可加括号中文释义**。
   - **每个**围栏代码块**正上方**（紧挨 ``` 之前）须有一段**来源标注**，写清：
     - **仓库相对路径**（从仓库根算起，如 `apps/frontend/src/utils/foo.ts`）；
     - **大致位置**：优先 **`约 L起始–L结束` 行号**（与当时源码一致即可）；若不便给行号，则写 **符号名**（函数 / 组件 / hook 名）+ 一句方位（如「文件前部 import 之后」）。
   - 同一小节内连续多个代码块：**各自**单独标注来源，不得省略。
   - 文末可加一句：**若与仓库最新源码不一致，以源码为准**。

3. **语言与链接**
   - 正文：**简体中文**。
   - **专题实现文**内引用仓库路径：使用 **相对仓库根** 的完整相对路径，便于点击跳转。
   - **`project-guide.md` / `project-update-info.md`**：遵守 `references/product-user-docs.md` §1，**禁止**出现 `apps/`、`docs/`、`packages/`、`.ts` 路径及「见 xxx.md」类开发索引。

4. **与 docs 总索引的关系（新增专题时必做）**
   - 更新 [`docs/README.md`](../../../../docs/README.md) 与对应 `docs/<领域>/README.md`（规则见 `references/docs-maintenance.md`）。
   - 相关旧专题文：文首补「延伸阅读」或收窄为摘要 + 链到主文档，避免双份维护。

5. **新建文档文件名**
   - 须**简短**且**准确概括本轮改动**（具体规则见下文 **§4 落盘路径与文件名**）；与「只写文档」约束并列，作为落盘时的硬性自检项。

## 何时启用

用户在以下场景触发本 Skill：

- 「根据本次 / 当前 **改动** 写一份 **实现思路**」
- 「**git diff** 生成文档」「PR / 分支变更说明写入 **docs**」
- 「**只生成文档**，**不要改代码**」
- 「把会话里实现的 XXX 写入 **docs/knowledge**（或 monaco / frontend …）」

若用户明确要求**同时改代码**，应**退出**本 Skill 的约束或改用普通 Agent 任务（本 Skill 以「纯文档」为默认）。

## 工作流（按顺序执行）

### 1) 锁定「改动事实来源」

按优先级取材：

1. 用户粘贴的 **`git diff`** / **`git show`** / PR 描述。
2. 用户 **`@`** 的文件集合 + 说明「以这些为准」。
3. 当前会话中已落地且用户声明「就是这一轮」的路径列表。
4. 若无明确范围，运行 `git diff` / `git status`（在许可环境下）缩小文件集合，并向用户确认范围。

### 2) 提炼叙述结构

至少回答：

- **要解决什么问题**（用户视角一句）。
- **改了哪些地方**（路径清单，用于专题文 §2；**不要**原样粘贴进 `project-guide` / `project-update-info`）。
- **核心思路**（3～8 条要点，含权衡：为何不用备选方案）。
- **行为变化**：兼容 / 破坏性 / 开关（若有）。
- **风险与回归**：建议测哪些路径。
- **是否用户可感知**：若是，标记需在步骤 6 写入产品姊妹稿。

可参考 `references/doc-outline.md` 的章节骨架。

### 3) 编写「带详细注释的代码块」

对每条关键逻辑：

1. 选取**最短可读**片段（函数体、分支、`useEffect`、`addCommand` 注册块等）。
2. **在开启围栏（```）之前**写来源行，格式示例（二选一或组合）：  
   - `**来源**：\`apps/frontend/src/components/Foo.tsx\`（约 L42–L88）`  
   - `**来源**：\`packages/bar/src/x.ts\`（\`resolveUrl\` 函数附近）`
3. 在围栏代码块中使用**讲解版注释**：
   - 行内：`// 说明：……`
   - 块级：关键分支前用 `/** … */` 概括意图。
4. 多个文件拆成 **### 小节**（如「前端 `index.tsx`」「Monaco `commands.ts`」）；小节标题可与路径呼应，但**不能替代**每个代码块上方的来源标注。
5. **禁止**把机密（密钥、token、隐私 URL）写入文档。

### 4) 落盘路径与文件名（必须满足）

- **目录**：专题明确时放在 `docs/<领域>/`（或用户点名的文档目录），与仓库现有风格一致。
- **文件名简短**：用可读、尽量短的名称；优先 **小写 + 连字符**（kebab-case，连字符命名）或与同目录已有文档一致的习惯；避免堆后缀（如 `-final-v2`）、避免一行塞满多个主题。
- **文件名贴题**：文件名应概括**本轮改动核心**（读者不看正文也能猜到大方向），例如 `web-search-tavily.md`、`organic-cite-capsules.md`；**禁止**泛名：`notes.md`、`update.md`、`change.md`、`temp.md`。
- **与正文标题**：文件名不必与 Markdown 一级标题逐字相同；标题可略正式，文件名保持短。
- **避免**：覆盖广义文件名（如随意替换 `README.md`）；大总览应**追加章节**而非整块替换。

示例（仅说明意图，按实际改动选题名）：

| 不佳（过长 / 泛） | 更佳（短 + 贴题） |
|------------------|-------------------|
| `web-search-organic-citations-implementation-notes.md` | `web-search-organics.md` |
| `monaco-preview-fix-implementation.md` | `monaco-preview-hash-scroll.md` |

### 5) 整理整个 `docs/` 目录（新增或显著更新专题时必做）

按 [`references/docs-maintenance.md`](references/docs-maintenance.md) 执行：

1. 在 `docs/<领域>/README.md` 登记新专题（无则创建该 README 并在 `docs/README.md` 补入口）。
2. 视需要更新 `docs/README.md` 的「按功能域」或「常见排查」表。
3. 检查与既有文档是否重复；确立**主文档** + 它处摘要链接。
4. 在新旧专题文文首维护「延伸阅读 / 文档角色」。

### 6) 同步产品向姊妹文档（用户可感知改动时必做）

当本轮包含**新功能、体验优化或用户可见修复**时，在专题文与索引整理完成后，更新：

| 文件 | 作用 |
|------|------|
| [`docs/project-update-info.md`](../../../../docs/project-update-info.md) | 「新增/优化了什么」— bullet + `（更新：YYYY-MM-DD）` |
| [`docs/project-guide.md`](../../../../docs/project-guide.md) | 「怎么用」— 教程章节/小节 |

格式、章节归属、**禁止出现路径**等细则见 [`references/product-user-docs.md`](references/product-user-docs.md)。

**注意**：

- 应用内 `/update-info`、`/project-guide` 由前端 `updateInfoSections` / `projectGuideSections` 驱动；本 Skill **默认只改上述两份 Markdown**。完成后在回复中**提醒用户**：若需线上页一致，须另开任务同步结构化数据（属 `apps/frontend`，非本 Skill 默认范围）。
- `project-guide.md` §14 对开发文档仅保留「查阅仓库内开发文档总索引」级表述，**不写** `docs/` 下具体文件名。

### 7) 自检清单（写入前在心里过一遍）

**专题实现文**

- [ ] 是否**没有任何非 docs** 文件被修改？
- [ ] 代码块是否与 diff / 源码对齐？
- [ ] 是否说明「未涵盖的边角」或「后续可做」？
- [ ] 新建文档的**文件名**是否**简短**且**准确描述本轮改动**？
- [ ] **每个**代码块上方是否都有**来源路径 + 大致位置**？

**docs 整理**

- [ ] `docs/README.md` 与领域 `README.md` 是否已更新？
- [ ] 是否已去重并补交叉链接？

**产品姊妹稿**（若适用）

- [ ] `project-update-info.md` 是否已增条目且**无路径/无文件名**？
- [ ] `project-guide.md` 是否已补充使用说明（若需要操作步骤）？
- [ ] 是否误将专题文中的路径或代码块粘贴进产品向文档？

## 输出格式建议

```markdown
# <标题>

## 1. 背景与目标
...

## 2. 改动范围
- `path/a`
- `path/b`

## 3. 实现思路
...

## 4. 关键代码与注释

### 4.x <文件角色>

**来源**：`相对路径/到/文件.ext`（约 Lxx–Lyy 或 `符号名` 附近）

```typescript
// 中文注释讲解……
```

## 5. 兼容性与影响
...

## 6. 相关源码路径
| 说明 | 路径 |
|------|------|
```

## 参考文件

| 文件 | 用途 |
|------|------|
| [references/doc-outline.md](references/doc-outline.md) | 专题实现文章节骨架 |
| [references/docs-maintenance.md](references/docs-maintenance.md) | `docs/` 索引整理与去重 |
| [references/product-user-docs.md](references/product-user-docs.md) | `project-guide` / `project-update-info` 格式与禁路径 |

## 与相近 Skill 的边界

- **`spec-from-implementation`**：从**现有完整实现**反推可验收 SPEC，偏重规范条款与 checklist。
- **本 Skill**：从**一轮 diff / 明确改动集合**写**实现说明**，偏重「这轮做了什么 + 注释代码块」，并**整理 docs 索引**、必要时**更新产品姊妹稿**；默认**不写 spec 全套章节**除非用户要求合并。
