---
name: ebook-feature-dev-guide
description: >-
  根据用户指定的 EPUB/电子书功能，通读仓库现有实现，在 docs/ebook/developer/ 生成端到端开发者实现手册：
  白话原理、维护定位表、M1–Mn 从零阶段、运行时调用链、分模块链路、带逐行中文注释的可照抄源码与验收清单。
  适用于「写开发者手册/实现思路/照着实现/功能怎么实现的/ebook developer 文档/EPUB 功能实现原理」等，
  且落盘目标为 docs/ebook/developer/ 时。
---

# EPUB 功能开发者实现手册（ebook-feature-dev-guide）

## 目标

把用户点名的 **某一 EPUB/电子书能力**（如听书、用户划线、读书想法）整理成 **唯一完整开发者手册**，写入 `docs/ebook/developer/`：

- **覆盖面广**：用户入口、状态机、API、DOM/epub.js、互斥、性能、边界、回归。
- **可照着做**：§0 维护表 + M1–Mn 分阶段从零顺序 + 运行时调用链。
- **讲清原理**：§2 白话思路（全景 → 分场景 → 按文件拆解）。
- **可照抄代码**：源码章摘录当前实现，**每行源码上方详细中文注释**。
- **一目了然**：文首文档角色、推荐阅读顺序、与增量专题分工表。

**默认只写文档**（`docs/ebook/developer/**/*.md` 及索引）；**不改** `apps/**`、`packages/**`，除非用户明确要求同时改代码。

## 与相近 Skill 的边界

| Skill | 输入 | 输出 | 差异 |
|-------|------|------|------|
| **本 Skill** | 用户指定功能名 + 可选 @ 路径 | `docs/ebook/developer/<名>.md` | 端到端手册、从零阶段、**无**改动前后对比 |
| `implementation-doc-from-diff` | git diff / 本轮改动 | `docs/<功能域>/` | 改动前/后对比、姊妹稿 |
| `spec-from-implementation` | 模块路径 | `spec/*.md` 等 | 验收 SPEC、checklist 条款 |
| `code-line-comments` | @ 源码文件 | 改源码加注释 | 只增注释不改 docs |

## 硬约束

1. **落盘路径**
   - 专题手册：`docs/ebook/developer/<文件名>.md`（kebab-case，贴题，如 `epub-chapter-listen-dev.md`）。
   - 更新 [`docs/ebook/developer/README.md`](../../../docs/ebook/developer/README.md) 索引表。
   - 更新 [`docs/ebook/README.md`](../../../docs/ebook/README.md) developer 相关行（见 `implementation-doc-from-diff/references/docs-maintenance.md` 索引规则）。
   - **禁止**把开发者手册写到 `docs/ebook/` 根目录（增量专题）或 `docs/backend/`、`docs/frontend/`。

2. **一功能一文件**
   - 用户一次点名多个独立能力 → **多篇** developer 手册，文首互链。
   - 同一能力的前后端/多模块 → **一篇**内分节，不因技术栈拆文件。

3. **以代码为准**
   - 通读实现后再写；任何行为断言须能在源码中找到依据。
   - 用 `codegraph_explore` / `Read` / `git` 取材；**禁止臆造**符号或文件。

4. **源码摘录**（详见 [`references/code-excerpt-rules.md`](references/code-excerpt-rules.md)）
   - **完整符号**（声明 → 闭合）。
   - **100% 逐行上方**详细中文注释（JSX 标记行可豁免）。
   - 每块 **来源标注**（路径 + 约 L起–L止）。
   - 每个符号块末尾 **「读完应掌握」**。

5. **语言**
   - 正文与注释：**简体中文**；英文术语可保留，首次出现括号释义。
   - 路径用仓库根相对路径，便于点击跳转。

6. **与既有文档分工**
   - 若 `docs/ebook/` 已有增量专题：手册文首表格说明「本手册 = 唯一完整版；增量文 = 历史 diff」。
   - 若已有同主题 `developer/*.md`：**更新/扩充**该文件，文首注明版本与变更摘要；勿另起泛名重复维护。

7. **不写产品姊妹稿**
   - 本 Skill **不**更新 `project-guide.md` / `project-update-info.md`（除非用户另提）。

## 何时启用

- 「为 XXX 功能写 **开发者手册** / **实现思路** / **怎么实现的**」
- 「整理 **docs/ebook/developer**」「EPUB **照着实现**」「**逐行注释**源码参考」
- 用户 @ 某 EPUB 模块并要求 **详细、细致、每个点都讲到** 的实现文档

**不启用**：纯 git diff 归档 → `implementation-doc-from-diff`；写 SPEC → `spec-from-implementation`；只给源码加注释 → `code-line-comments`。

## 工作流（按顺序）

### 1) 锁定功能范围

向用户确认（可从上下文推断则省略提问）：

- **功能名**（一句话，用户视角）。
- **边界**：含不含后端、PDF、与哪几个 EPUB 能力互斥/共存。
- **取材范围**：用户 `@` 的路径，或 Agent 搜索 `apps/frontend/src/views/ebook/**`、相关 backend、`englishTts` 等。

列出 **必读文件清单**（入口页、主 hook、核心 utils、组件、API service、后端 controller/entity 若适用）。

### 2) 通读实现（先理解再写）

对每个用户动作建立 **动作 → 状态 → 副作用** 表：

| 用户动作 | 入口 UI | 调用链 | 持久化 | DOM/UI 变化 | 失败/互斥 |
|----------|---------|--------|--------|-------------|-----------|

重点抓取（易漏、易 bug）：

- key / session / controller 互斥（如听当前 vs 听书）。
- epub.js：iframe、`rendition`、`CFI`、`annotations`、`marks-pane`。
- 异步：TTS cadence、scroll guard、节末 `next()`、目录跳转 sync。
- sync 顺序（用户划线 vs 想法 vs 听书背景）。
- 性能：rAF、增量 patch、Observer。

可用 mermaid 画架构/状态机（仅当比 prose 更清晰时）。

### 3) 规划文档结构

读取 [`references/dev-guide-outline.md`](references/dev-guide-outline.md)，按功能裁剪章节。

**必须包含**：

- §0.1–0.4（维护表、M1–Mn、调用链）
- §2 白话思路（§2.0 五分钟全景 + 分场景 + 按文件表）
- 分模块链路（§3+）
- 源码对照章（覆盖链路中 **最关键** 的 6–15 个符号，按调用顺序排列）
- 验收清单

**文件名**：`<主题>-dev.md` 或贴题短名；避免 `notes.md`、`impl.md`。

### 4) 编写源码对照章

对每个选定符号：

1. 从仓库复制**当前**实现（完整符号）。
2. 为**每一行**写上方详细注释（遵守 `code-excerpt-rules.md`）。
3. 写来源标注 + 「读完应掌握」。

优先级：入口 hook → 控制器/互斥 → 核心算法 utils → UI 接线 → 后端 API（若有）。

### 5) 落盘与索引

1. 写入 `docs/ebook/developer/<文件名>.md`。
2. 更新 `docs/ebook/developer/README.md`（表格一行：文档名 + 范围一句）。
3. 更新 `docs/ebook/README.md` developer 区（若新增文件）。
4. 相关增量专题文首可加「完整开发者手册见 developer/xxx」。

### 6) 自检清单

**结构与可读性**

- [ ] 文首有文档角色、推荐阅读顺序、与增量专题分工？
- [ ] §0.2 维护表每行含：现象、文件、符号、怎么验？
- [ ] §0.3 每阶段有验收 +「本阶段不要做」？
- [ ] §2.0 能否让未读过代码的人理解整功能怎么跑？
- [ ] 分模块节是否写清：入口、流程、边界、常见坑？

**源码章**

- [ ] 每个符号完整（声明→闭合）？
- [ ] 100% 逐行注释（JSX 豁免除外）？
- [ ] 每块有来源路径 + 行号？
- [ ] 无臆造 API/文件？

**索引**

- [ ] `developer/README.md` 已更新？
- [ ] `docs/ebook/README.md` 已登记？

## 输出格式

以 [`references/dev-guide-outline.md`](references/dev-guide-outline.md) 为骨架；源码块示例：

````markdown
### 8.1 `useEpubChapterListen` — 听书状态机入口

**来源**：`apps/frontend/src/views/ebook/hooks/useEpubChapterListen.ts` · 约 L1–L80

```typescript
// 从 englishTts 引入句界与播放能力
import { playEnglishPreferred, … } from '@/utils/englishTts';
// …
export function useEpubChapterListen(…) {
	// …
}
```

**读完应掌握**：听书 hook 对外暴露哪些控制方法、与 `epubListenController` 如何互斥注册。
````

## 参考

| 文件 | 用途 |
|------|------|
| [references/dev-guide-outline.md](references/dev-guide-outline.md) | 手册章节骨架 |
| [references/code-excerpt-rules.md](references/code-excerpt-rules.md) | 源码摘录与逐行注释 |
| [docs/ebook/developer/epub-listen-dev.md](../../../docs/ebook/developer/epub-listen-dev.md) | 成品样例（听读） |
| [docs/ebook/developer/epub-thought-add-underline-dev.md](../../../docs/ebook/developer/epub-thought-add-underline-dev.md) | 成品样例（想法） |
| `implementation-doc-from-diff/references/code-symbol-scope.md` | 完整符号边界 |
| `implementation-doc-from-diff/references/docs-maintenance.md` | docs 索引维护 |
