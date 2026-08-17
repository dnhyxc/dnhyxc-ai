---
name: implementation-doc-from-diff
description: 基于当前改动（git diff、@ 文件或会话内已达成共识的变更）在 docs/<功能域>/ 下生成「实现思路」专题 Markdown；文件名用简体中文且简短语义明确；一轮多项独立功能须拆多篇；含改动前/改动后成对对比、**完整符号定义**摘录；代码块内**每一行源码上方**须有**详细**中文注释（100% 覆盖，禁止只注释关键行）；无「讲解：」前缀；每个代码块标注来源；自动整理 docs 索引；用户可感知改动则同步姊妹稿与四套 TS；默认不改业务源码。适用于「把本次改动写成文档/实现思路/只写 docs」等。
---

# 基于改动的实现说明文档（implementation-doc-from-diff）

## 目标

把**当前一轮改动**整理成可归档、可交接的说明文档：

- **实现思路**：为何这样做、关键决策、数据流与边界。
- **具体代码**：围栏代码块须**改动前/改动后成对**（`code-before-after.md`）、**完整符号定义**（`code-symbol-scope.md`），且**每一行源码**正上方一行**详细**中文注释——**100% 覆盖**，禁止只注释关键行或改动行（`code-line-comments.md` §1、§1.2）；不加 `讲解：` 前缀。
- **docs 体系**：专题文落在**对应功能域**的 `docs/<功能域>/`（简短目录名；不存在则创建目录与 `README.md`）；**多个独立功能实现须分别写入不同文件**（见硬约束 §7）；新增后**自动整理**索引（见 `references/doc-domain-layout.md`、`references/docs-maintenance.md`）。
- **产品姊妹稿**：若改动包含**用户可感知**的新功能/体验变化，同步更新 `docs/project-guide.md` 与 `docs/project-update-info.md`（格式见 `references/product-user-docs.md`；**这两份正文不得出现文件路径**），并**同轮**同步应用内 `/update-info`、`/project-guide` 结构化数据（见 `references/product-pages-sync.md`）。
- **默认不改其它业务代码**：除步骤 6 允许的前端 4 个姊妹数据文件外，**不得**修改 `apps/**`、`packages/**`、根配置、`scripts/**` 等；**仅**在 `docs/**/*.md`（及步骤 6 列出的前端文件）中新建或更新。

## 硬约束（必须遵守）

1. **允许改动的路径（白名单）**
   - `docs/**/*.md`（专题实现文、索引、产品姊妹稿）。
   - **仅当**更新了 `docs/project-update-info.md` 和/或 `docs/project-guide.md` 时， additionally：
     - `apps/frontend/src/views/updateInfo/updateInfoSections.ts`
     - `apps/frontend/src/views/updateInfo/updateInfoSectionsEnOverlay.ts`
     - `apps/frontend/src/views/projectGuide/projectGuideSections.ts`
     - `apps/frontend/src/views/projectGuide/projectGuideSectionsEnOverlay.ts`
   - 不得编辑上述白名单以外的 `apps/**`、`packages/**`、`libs/**`、根配置、`scripts/**`（除非用户 Explicitly 授权扩大范围）。

2. **代码块与源码关系**（仅适用于**专题实现文**，不适用于 `project-guide.md` / `project-update-info.md`）
   - **改动前 / 改动后成对对比（必做）**：diff 中有实质改动的函数、方法、hook、组件片段、配置块等，文档中须以**同一对比范围**各贴一块「改动前」与「改动后」代码；禁止只贴最新实现并用 prose 代替旧代码。取材：`git diff` 的 `-`/`+` 侧、`git show HEAD:<path>`（或 diff 基线 commit）与当前文件。纯新增 / 纯删除 / 仅格式化等例外见 [`references/code-before-after.md`](references/code-before-after.md) §4。
   - **完整符号边界（必做）**：代码块须从**符号声明行**写到该符号**闭合**（函数签名→`}`；`useMemo`/`useCallback`→`}, [deps]);`；组件→组件函数闭合）。**禁止**仅贴函数体、`useMemo` 回调内部或孤立 `return { … }` 而无外层定义；小节标题中的符号名须在代码块内**可见**。细则与反例见 [`references/code-symbol-scope.md`](references/code-symbol-scope.md)。
   - 代码块内容应与对应版本**一致**；若因篇幅做省略，用 `// ...` 标明，并在段首说明「摘录」；**前后两块摘录范围须对称**（**同一完整符号**、相同上下文切口）；**不得**用省略代替声明行或 hook 闭合。
   - **逐行上方详细注释（必做，100%）**：围栏代码块内**每一行源码**正上一行须为讲解注释（`code-line-comments.md` §6 豁免除外）。须覆盖 §1.1 清单及 **§1.3**（`return` 对象每个属性行、`onCopy` 等回调属性及回调体内每一行、`useMemo` deps 每个元素行）。**禁止**只注释 `hasHighlight` 等 diff 字段而裸贴回调方法。落盘前 §1.2 扫描 + §1.3 复核。
   - 讲解注释统一使用**中文**；保留英文技术术语，**首次出现可加括号中文释义**。仓库源码自带的行内/块注释保留在原位置，讲解注释作为其**上方额外行**追加，不篡改源码正文。
   - **每个**围栏代码块**正上方**（紧挨 ``` 之前）须有一段**来源标注**，写清：
     - **仓库相对路径**（从仓库根算起，如 `apps/frontend/src/utils/foo.ts`）；
     - **版本侧**：`**改动前**`（基线 / 提交前）或 `**改动后**`（当前源码）；
     - **大致位置**：优先 **`约 L起始–L结束` 行号**（改动前对应基线行号、改动后对应当前行号）；若不便给行号，则写 **符号名**（函数 / 组件 / hook 名）+ 一句方位。
   - 同一对比组内「改动前」「改动后」各一块；多组对比时每组**各自**标注来源，不得省略。
   - 对比组末尾可加一两句**变更摘要**，点出删/增/改焦点。
   - 文末可加一句：**若与仓库最新源码不一致，以源码为准**。

3. **语言与链接**
   - 正文：**简体中文**。
   - **专题实现文**内引用仓库路径：使用 **相对仓库根** 的完整相对路径，便于点击跳转。
   - **`project-guide.md` / `project-update-info.md`**：遵守 `references/product-user-docs.md` §1，**禁止**出现 `apps/`、`docs/`、`packages/`、`.ts` 路径及「见 xxx.md」类开发索引。

4. **与 docs 总索引的关系（新增专题时必做）**
   - 更新 [`docs/README.md`](../../../../docs/README.md) 与对应 `docs/<领域>/README.md`（规则见 `references/docs-maintenance.md`）。
   - 相关旧专题文：文首补「延伸阅读」或收窄为摘要 + 链到主文档，避免双份维护。

5. **功能域目录（与文件名并列的硬约束）**
   - 专题实现文**只能**写在 `docs/<功能域>/` 下，**禁止** `docs/backend/`、`docs/frontend/` 及在 `docs/` 根目录堆放专题（`project-guide.md` / `project-update-info.md` 除外）。
   - `<功能域>` 须与改动的产品能力一致（见 `references/doc-domain-layout.md` 对照表）；目录名**简短**（如 `chat`、`cos`、`llm`、`ops`、`app`、`english`）。
   - 若 `docs/<功能域>/` 不存在：**创建目录** + 该域 `README.md`，并在 `docs/README.md` 功能域表登记。

6. **新建文档文件名（中文）**
   - 须用**简体中文**、**简短**且**语义明确**地概括该篇**单一功能**（具体规则见下文 **§4 落盘路径与文件名**）；与「只写文档」约束并列，作为落盘时的硬性自检项。

7. **多功能拆分（一功能一文件，必做）**
   - 当一轮变更包含**多个不同的功能实现**（可独立命名、独立验收、独立回归），**必须**为每个功能各写**一篇**专题文，分别落盘为 `docs/<功能域>/<中文文件名>.md`。
   - **禁止**把互不隶属的多项实现（例如「分享条抽取」+「电子书去重上传」+「循环依赖修复」）堆进**同一** Markdown 正文。
   - **判定「不同功能」**（满足其一即应拆分）：产品能力域不同（见 `doc-domain-layout.md`）；用户场景/入口不同；可单独用一句话概括且与其它章节无强耦合；改动路径集合几乎不相交。
   - **同一功能、前后端/多文件**：仍属**一篇**专题（文内用 ### 小节分模块），**不得**因「涉及 backend + frontend」而拆成两篇技术栈文档。
   - **跨功能域**：各功能写入各自 `docs/<功能域>/`；文首「延伸阅读」互链；**不要**为了「一轮 PR 一份总文档」而选一个主域把其它域内容塞进去。
   - **可选索引文**：若需交代「本轮共 N 项」，可在某域 README 或极短的 `docs/<域>/变更索引-YYYY-MM.md` 中**只列链接与一句话摘要**，**不得**在该索引文重复粘贴各专题的实现细节与代码块。

## 何时启用

用户在以下场景触发本 Skill：

- 「根据本次 / 当前 **改动** 写一份 **实现思路**」
- 「**git diff** 生成文档」「PR / 分支变更说明写入 **docs**」
- 「**只生成文档**，**不要改代码**」
- 「把会话里实现的 XXX 写入 **docs/knowledge**（或 monaco / cos …）」

若用户明确要求**同时改代码**，应**退出**本 Skill 的约束或改用普通 Agent 任务（本 Skill 以「纯文档」为默认）。

## 工作流（按顺序执行）

### 1) 锁定「改动事实来源」

按优先级取材：

1. 用户粘贴的 **`git diff`** / **`git show`** / PR 描述。
2. 用户 **`@`** 的文件集合 + 说明「以这些为准」。
3. 当前会话中已落地且用户声明「就是这一轮」的路径列表。
4. 若无明确范围，运行 `git diff` / `git status`（在许可环境下）缩小文件集合，并向用户确认范围。

为编写「改动前」代码块，须同时保留**基线侧**素材：`git diff`（`-` 行）、`git show HEAD:<path>`，或 `git diff <base>...HEAD -- <path>`；与当前文件（改动后）对照后再落笔。

### 2) 拆分功能单元并确定落盘计划

1. 通读 diff / 改动清单，列出**独立功能单元**（见硬约束 §7）；若 ≥2 个，为**每个单元**单独规划一篇专题（功能域 + **中文文件名** + 标题）。
2. 根据各单元，从 [`references/doc-domain-layout.md`](references/doc-domain-layout.md) 选定各自 `docs/<功能域>/`；跨域时**多篇并行落盘**，勿合并为一篇。
3. 若某功能域目录不存在，按该参考文档 **§3** 创建目录与 `README.md`。

**每个功能单元**至少回答（写入对应那篇专题，而非混在一篇里）：

- **功能域与文件名**：`docs/<功能域>/<中文文件名>.md`。
- **要解决什么问题**（用户视角一句）。
- **改了哪些地方**（该功能相关的路径清单；**不要**原样粘贴进 `project-guide` / `project-update-info`）。
- **核心思路**（3～8 条要点，含权衡：为何不用备选方案）。
- **行为变化**：兼容 / 破坏性 / 开关（若有）。
- **风险与回归**：建议测哪些路径。
- **是否用户可感知**：若是，标记需在步骤 6 写入产品姊妹稿（姊妹稿可合并多条 bullet，但**实现专题仍按功能拆分**）。

可参考 `references/doc-outline.md` 的章节骨架。

### 3) 编写「改动前 / 改动后对比 + 逐行详细注释」代码块

对 diff 中每条**实质改动**的逻辑单元：

1. 确定**对比范围**：**完整符号定义**（`code-symbol-scope.md`）；小节标题符号名须在块内可见。
2. **先写改动前、再写改动后**（推荐）：
   - 来源标注 + 围栏代码块：基线 / 当前源码。
3. **逐行注释（必做，与写源码交错或写完后补全）**：
   - **每一行源码**上一行**详细**注释；**含** `return` 对象每个属性（`onCopy` 等回调行 + 回调体内每一行）、`useMemo` deps 每一行（`code-line-comments.md` §1.3）。
4. **逐行审计（落盘前必做）**：§1.2 扫描；**重点复核** §1.3 回调属性与 deps 是否漏注。
5. 大段未改上下文：`// ...（未改动）` **对称**省略，省略行上一行说明范围。
6. 对比组末尾：**变更摘要**（1～2 句）。
7. **例外**：纯新增 / 纯删除 / 仅格式化（`code-before-after.md` §4）。
8. **禁止**机密信息。

### 4) 落盘路径与文件名（必须满足）

- **一功能一文件（必做）**：
  - 每个独立功能单元对应**恰好一篇** `docs/<功能域>/<中文文件名>.md`。
  - 一篇专题内**只写一项功能**的实现细节与代码摘录；其它功能另起新文件，并在文首「延伸阅读」互链。
- **目录（功能域，必做）**：
  - 路径形态固定为 **`docs/<功能域>/<中文文件名>.md`**。
  - `<功能域>` 仍为短英文目录名（见 [`references/doc-domain-layout.md`](references/doc-domain-layout.md)）；**不得**使用 `docs/backend/`、`docs/frontend/`。
  - 目录不存在则**创建** `docs/<功能域>/` 及 `README.md`，并更新 `docs/README.md`。
  - 用户点名路径时，仍须落在功能域目录内（例如用户说「写 frontend」→ 按实际能力归入 `app/`、`cos/`、`english/` 等，并在文中说明归类理由）。
- **文件名用中文（必做）**：
  - 专题文文件名须为**简体中文**短语 + `.md`（功能域目录名仍用英文短名，二者分工不同）。
  - **简短**：建议 **4～12 个汉字**（含必要英文专有词时总长仍宜一眼读完）；避免「……实现说明 / 改动分析 / 最终版」等堆后缀。
  - **语义明确**：读者只看文件名即可判断**该篇单项功能**；可用「对象 + 动作/特性」结构（如 `外链主题同步.md`、`编辑器锚点滚动.md`）。
  - **禁止**英文 kebab-case 专题名（如 `web-search-organics.md`）；**禁止**泛名：`说明.md`、`更新.md`、`改动.md`、`临时.md`、`notes.md`；**禁止**多主题串名（如 `分享条与电子书与国际化.md`）。
  - 确需保留的技术专有词（如 `Tavily`、`Mermaid`）可嵌在中文名中，仍以中文语义为主（如 `Tavily联网搜索.md`）。
- **与正文标题**：文件名不必与 Markdown 一级标题逐字相同；标题可略正式，文件名保持短。
- **避免**：覆盖广义文件名（如随意替换 `README.md`）；大总览应**追加章节**或**索引链**而非整块替换。

示例（仅说明意图，按实际改动选题名）：

| 不佳（英文 / 过长 / 泛 / 多主题） | 更佳（中文 + 短 + 贴题 + 单功能） |
| --------------------------------- | --------------------------------- |
| `web-search-organic-citations-implementation-notes.md` | `联网搜索引用.md` |
| `monaco-preview-hash-implementation.md` | `预览锚点滚动.md` |
| `pr-123-all-changes.md` / `分享条与电子书去重与i18n.md` | 拆成 `助手分享条.md` + `电子书路径去重.md` 等 |

### 5) 整理整个 `docs/` 目录（新增或显著更新专题时必做）

按 [`references/docs-maintenance.md`](references/docs-maintenance.md) 执行：

1. 在 `docs/<领域>/README.md` 登记新专题（无则创建该 README 并在 `docs/README.md` 补入口）。
2. 视需要更新 `docs/README.md` 的「按功能域」或「常见排查」表。
3. 检查与既有文档是否重复；确立**主文档** + 它处摘要链接。
4. 在新旧专题文文首维护「延伸阅读 / 文档角色」。

### 6) 同步产品向姊妹文档（用户可感知改动时必做）

当本轮包含**新功能、体验优化或用户可见修复**时，在专题文与索引整理完成后，更新：

| 文件                                                                     | 作用                                                 |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| [`docs/project-update-info.md`](../../../../docs/project-update-info.md) | 「新增/优化了什么」— bullet + `（更新：YYYY-MM-DD）` |
| [`docs/project-guide.md`](../../../../docs/project-guide.md)             | 「怎么用」— 教程章节/小节                            |

格式、章节归属、**禁止出现路径**等细则见 [`references/product-user-docs.md`](references/product-user-docs.md)。

### 6.1 同步应用内结构化页（姊妹稿有改动时必做）

按 [`references/product-pages-sync.md`](references/product-pages-sync.md) 执行：

1. 以**定稿后的** `project-update-info.md` / `project-guide.md` 为源，更新 `updateInfoSections.ts` / `projectGuideSections.ts`（中文主数据）。
2. **同 id** 更新 `updateInfoSectionsEnOverlay.ts` / `projectGuideSectionsEnOverlay.ts`（英文 title + description；新章节补 section 标题映射）。
3. 新增 update-info 条目使用 `{sN}-{下一序号}`；新增 guide 小节使用 `pg-s{N}-{x}`，勿复用已删 id。
4. 本地预览：切换界面语言访问 `/update-info`、`/project-guide`，确认中英文一致。

**注意**：`project-guide.md` §14 对开发文档仅保留「查阅仓库内开发文档总索引」级表述，**不写** `docs/` 下具体文件名；同步到 `pg-s14-1` 时保持产品向措辞、不写仓库路径。

### 7) 自检清单（写入前在心里过一遍）

**专题实现文**

- [ ] 是否**仅**改动了 docs 白名单与（若适用）步骤 6.1 列出的 4 个前端姊妹数据文件？
- [ ] 若 diff 含**多个独立功能**，是否已**拆成多篇**专题（**禁止**全部堆在同一文件）？
- [ ] 每一篇是否只描述**一项**功能（同一功能的前后端/多模块可在一篇内分节）？
- [ ] 跨功能文档是否在文首互链，且**未**在单篇中重复粘贴其它功能的实现细节？
- [ ] 实质改动的逻辑单元是否均有**改动前 + 改动后**成对代码块（非仅贴最新版）？
- [ ] 前后块是否**同一完整符号**（含声明与闭合，非仅函数体），且 `// ...` 摘录是否对称？
- [ ] 代码块是否从**符号声明**起笔，`useMemo` 等是否含 `}, [deps]);`？小节标题符号名是否在块内可见？
- [ ] 「改动前」是否来自 git 基线 / diff `-` 侧，而非臆造？
- [ ] 纯新增 / 纯删除 / 仅格式化是否按 `code-before-after.md` §4 处理？
- [ ] 代码块是否与 diff / 对应版本源码对齐？
- [ ] 改动前、改动后每个代码块是否 **100% 逐行**注释（§1.2 扫描通过，非仅关键行）？
- [ ] `return` 对象内 **onCopy / onUnderline 等每个回调属性行**及回调体内、`deps` 每个元素行是否均已注释（§1.3）？
- [ ] 是否无空洞套话、无「一块注释管多行」？
- [ ] `// ...` 省略行是否也有上一行说明？
- [ ] 是否说明「未涵盖的边角」或「后续可做」？
- [ ] 每篇新建文档的**文件名**是否为**简体中文**、**简短**且**语义明确**地描述该篇单一功能（非英文 kebab-case、非泛名）？
- [ ] **每个**代码块上方是否都有**改动前/改动后 + 来源路径 + 大致位置**？
- [ ] 文档层注释是否**未**使用 `讲解：` / `说明：` 前缀（见 `code-line-comments.md` §7）？

**功能域落盘**

- [ ] 专题是否在正确的 `docs/<功能域>/`（未用 `backend/`、`frontend/`、根目录）？
- [ ] 新功能域是否已创建目录 + `README.md` 并登记 `docs/README.md`？

**docs 整理**

- [ ] `docs/README.md` 与功能域 `README.md` 是否已更新？
- [ ] 是否已去重并补交叉链接？

**产品姊妹稿**（若适用）

- [ ] `project-update-info.md` 是否已增条目且**无路径/无文件名**？
- [ ] `project-guide.md` 是否已补充使用说明（若需要操作步骤）？
- [ ] 是否误将专题文中的路径或代码块粘贴进产品向文档？
- [ ] `updateInfoSections.ts` / `projectGuideSections.ts` 是否与姊妹稿对齐？
- [ ] 两个 `*EnOverlay.ts` 是否已为每个新增/修改条目补齐英文？

## 输出格式建议

````markdown
# <标题>

## 1. 背景与目标

...

## 2. 改动范围

- `path/a`
- `path/b`

## 3. 实现思路

...

## 4. 关键代码对比与注释

### 4.x `<符号名>`（`相对路径/到/文件.ext`）

**对比范围**：例如 `function resolveUrl` 全函数（摘录说明）。

**改动前** · `相对路径/到/文件.ext`（基线，约 L42–L58）

```typescript
// 函数签名与参数含义（旧版）
function oldImpl(input: string) {
	// 该分支在旧版中的行为与局限
	if (input.startsWith("http")) return input;
	// 旧版对相对路径的处理方式
	return input;
}
```

**改动后** · `相对路径/到/文件.ext`（当前，约 L42–L65）

```typescript
// 相对旧版新增的可选 base 参数
function newImpl(input: string, base?: string) {
	// 与旧版相同的全局 URL 短路逻辑
	if (input.startsWith("http")) return input;
	// 新增分支——有 base 时拼接相对路径
	if (base && !input.startsWith("/")) return join(base, input);
	// 其余情况回退
	return input;
}
```

**变更摘要**：……

## 5. 兼容性与影响

...

## 6. 相关源码路径

| 说明 | 路径 |
| ---- | ---- |

---

（若与仓库最新源码不一致，以源码为准）
````

## 参考文件

| 文件                                                                 | 用途                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| [references/doc-outline.md](references/doc-outline.md)               | 专题实现文章节骨架                                         |
| [references/code-before-after.md](references/code-before-after.md)   | **改动前/改动后**对比格式、取材与例外                      |
| [references/code-line-comments.md](references/code-line-comments.md) | **100% 逐行上方**详细注释、§1.2 扫描与反例 |
| [references/code-symbol-scope.md](references/code-symbol-scope.md)   | **完整符号边界**（声明→闭合，禁止仅函数体）                |
| [references/doc-domain-layout.md](references/doc-domain-layout.md)   | **功能域目录对照、命名、新建目录**                         |
| [references/docs-maintenance.md](references/docs-maintenance.md)     | `docs/` 索引整理与去重                                     |
| [references/product-user-docs.md](references/product-user-docs.md)   | `project-guide` / `project-update-info` 格式与禁路径       |
| [references/product-pages-sync.md](references/product-pages-sync.md) | 姊妹稿 → `/update-info`、`/project-guide` 四套 TS 同步规则 |

## 与相近 Skill 的边界

- **`spec-from-implementation`**：从**现有完整实现**反推可验收 SPEC，偏重规范条款与 checklist。
- **本 Skill**：从**一轮 diff** 写实现说明，含**改动前后对比**、**完整符号**摘录、**每一行源码上方详细注释（100%）**；多篇专题；整理 docs 索引；必要时更新姊妹稿；默认不写 spec 全套。
