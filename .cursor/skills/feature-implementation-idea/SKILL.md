---
name: feature-implementation-idea
description: >-
  根据用户指定的功能需求，通读仓库可复用实现后，在 micro-apps/remote-docs/wiki/ideas/
  生成「实现思路」设计文档：含架构图、核心流程图、时序图、模块职责、分阶段落地步骤与验收清单，
  让读者一眼看懂怎么做；接口草图须上方注释（做什么+为什么）；文件名用简体中文且简短语义明确。
  适用于「写实现思路/功能怎么做/架构设计/需求方案/docs/ideas/wiki/ideas/implementation idea/设计文档」等，
  且目标为规划态文档（默认不改业务源码）。
---

# 功能需求实现思路（feature-implementation-idea）

## 目标

把用户点名的 **功能需求** 整理成 **规划态** 实现思路，写入 **remote-docs wiki ideas**：

| 写法                      | 路径                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| **绝对路径（权威）**      | `/Users/dnhyxc/Documents/code/micro-apps/remote-docs/wiki/ideas/` |
| **相对本仓（dnhyxc-ai）** | `../micro-apps/remote-docs/wiki/ideas/`                           |

下文记作 **`<IDEAS_ROOT>`**，落盘时优先用绝对路径，避免写进本仓 `docs/ideas/`。

- **一眼能懂**：文首 3～5 条要点 + 「一句话方案」；每张 Mermaid 图下 **图内方法说明** 表逐条解释 callable 职责。
- **图先于字**：至少 **架构图 + 主流程图 + 主链路时序图**（Mermaid；节点含职责要点、连线带语义标签、时序详情进 Note，规则见 [`references/diagram-guide.md`](references/diagram-guide.md)）。
- **可落地**：模块拆分、数据流、分阶段步骤（M1→Mn）、预估改动路径、风险与验收；接口草图 ≤30 行且注释符合 [`references/code-line-comments.md`](references/code-line-comments.md)。
- **贴仓库**：先调研现有代码/模式，优先复用，标注「已有 / 新增 / 扩展」。

**默认只写文档**（`<IDEAS_ROOT>/**/*.md` 与其 `README.md` 索引）；**不改** 本仓 `apps/**`、`packages/**`，除非用户明确要求同时实现代码。写入 sibling 仓时若沙箱拒写，需申请可写权限。

## 与相近 Skill 的边界

| Skill                          | 输入                      | 输出                                                                                   | 何时用                         |
| ------------------------------ | ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------ |
| **本 Skill**                   | 用户 **功能需求**（规划） | `<IDEAS_ROOT>/<可选功能域>/<中文文件名>.md`                                            | 还没写代码、要先定方案         |
| `implementation-doc-from-diff` | git diff / 已落地改动     | `<WIKI_ROOT>/<功能域>/`（`/Users/dnhyxc/Documents/code/micro-apps/remote-docs/wiki/`） | 改完后归档实现说明             |
| `spec-from-implementation`     | 已有模块路径              | `spec/*.md` 等                                                                         | 从代码反推验收 SPEC            |
| `ebook-feature-dev-guide`      | EPUB 功能名 + 现有实现    | 本仓 `docs/ebook/developer/`                                                           | 电子书 **已实现** 的开发者手册 |

**禁止**把规划思路写进 `<WIKI_ROOT>/<功能域>/` 正式专题（除非用户明确要求「直接写实现归档文」——此时改用 `implementation-doc-from-diff` 或先实现再写）。

**禁止**再往本仓 `docs/ideas/` 或本仓 `docs/<功能域>/` 落新规划/实现文（均已迁至 remote-docs wiki）。

## 硬约束

1. **落盘路径与文件名**
   - **根目录**：`<IDEAS_ROOT>` = `/Users/dnhyxc/Documents/code/micro-apps/remote-docs/wiki/ideas/`（相对本仓：`../micro-apps/remote-docs/wiki/ideas/`）。
   - **单篇**：`<IDEAS_ROOT>/<可选功能域>/<中文文件名>.md`。
     - 有明确功能域时用子目录（与现有 `epub/`、`knowledge/`、`ebook/`、`notes/`、`plugins/`、`tauri/`、`tts/`、`agent/`、`miniprogram/` 等对齐）。
     - 跨域或未定域可落在 `<IDEAS_ROOT>/` 根下。
   - **文件名用中文（必做）**：简体中文短语 + `.md`；**简短**（建议 4～12 个汉字）、**语义明确**（一眼看出单项功能，如 `电子书离线缓存.md`、`对话语音输入.md`）。
   - **禁止**英文 kebab-case（如 `epub-offline-cache.md`）；**禁止**泛名：`说明.md`、`方案.md`、`思路.md`、`临时.md`；**禁止**多主题串名。
   - 确需保留的技术专有词可嵌在中文名中（如 `EPUB章节书签同步.md`）。
   - 目录不存在则创建 `<IDEAS_ROOT>/`（及所需功能域子目录）与 `<IDEAS_ROOT>/README.md`。
   - **索引**：只更新 `<IDEAS_ROOT>/README.md`；**不要**再改本仓 `docs/ideas/README.md` / `docs/README.md` 登记新规划文。
   - **一需求一文件**；一次多个独立需求 → 多篇 + 文首互链。

2. **必读图（缺一则不合格）**
   - **架构图**：分层 / 模块 / 前后端边界（`flowchart TB` / `graph TD` / `graph LR`）。
   - **主流程图**：用户操作或系统主路径（`flowchart TD`，含分支与失败路径）。
   - **时序图**：Happy path 跨模块调用（`sequenceDiagram`，≥3 参与者）。
   - 有复杂状态时加 **状态图**（`stateDiagram-v2`）。
   - **禁止 ASCII 字符画**；一律 ` ```mermaid `。
   - **节点可读**：节点用 `"<b>名称</b><br/>━━━<br/>• 要点…"` 写清职责/IO/关键字段，不能只写名称；连线须带语义标签；用 `subgraph` 分组；建议含图例。
   - **时序可读**：消息线只写短方法名/事件名；参数与返回值放 `Note right of`（优先于 `Note over`）。
   - **图内方法须有功能说明**：每张图中出现的 **每个函数/方法**（节点名、箭头消息、`participant` 别名所指的 callable）须在图下 **「图内方法说明」** 表中逐条写清 **做什么、输入/输出要点**（见 [`references/diagram-guide.md`](references/diagram-guide.md) §2.5）。
   - 细则与正/反例：[`references/diagram-guide.md`](references/diagram-guide.md)。

3. **调研先于动笔**
   - 用 `SemanticSearch` / `Grep` / `Read` 找可复用模块；文档中设 **「现状与复用」** 节，表格列：能力 | 已有位置 | 本需求用法。
   - 不得臆造仓库不存在的 API；不确定处标 **「待确认」** 并写验证方式。

4. **语言**
   - 正文：**简体中文**；英文术语保留，首次括号释义。
   - 路径用**本仓（dnhyxc-ai）根相对路径**描述源码（如 `apps/frontend/src/views/chat/`）；文档自身落在 remote-docs。

5. **篇幅与可读性**
   - 优先表格、列表、图；避免大段空话。
   - 代码仅 **伪代码或接口草图**（≤30 行/块），**不要**贴大段实现；完整代码属实现阶段或 `implementation-doc-from-diff`。
   - **草图注释**：凡 JS/TS 围栏块，对**每一行非空、非纯花括号**源码上方写中文注释，说明 **「做什么」+「为什么」**；须覆盖 import/声明/参数/return/分支/循环/调用/对象属性/装饰器/类型；空行与纯 `{`/`}` 可豁免；禁止废话式注释。细则见 [`references/code-line-comments.md`](references/code-line-comments.md)。

## 何时启用

- 「帮我写 **XXX 功能** 的 **实现思路**」
- 「**docs/ideas**」「**wiki/ideas**」「需求方案」「架构设计」「怎么做这个功能」
- 「先出设计文档再开发」

用户仅说「根据 diff 写文档」→ 用 `implementation-doc-from-diff`，**不用**本 Skill。

即使用户说「写到 docs/ideas」，也落盘到 **`<IDEAS_ROOT>`**（本 Skill 默认目录已迁）。

## 工作流（按顺序）

### 1) 锁定需求

向用户确认（信息不足时 **必问**，可用 `AskQuestion`）：

| 项           | 说明                                                             |
| ------------ | ---------------------------------------------------------------- |
| 功能一句话   | 谁、在什么场景、做什么、达成什么                                 |
| 范围         | 前端 / 后端 / 全栈；是否含迁移、i18n、会员                       |
| 非目标       | 明确不做什么（YAGNI）                                            |
| 约束         | 性能、兼容、Ponytail、现有交互互斥                               |
| 文件名       | 默认自拟**简体中文**短名（见硬约束 §1），用户可指定              |
| 功能域子目录 | 默认按产品域选 `epub` / `knowledge` 等；用户可指定或要求落根目录 |

用户已 @ 文件或粘贴 PRD 片段 → 以之为准。

### 2) 调研仓库

按 [`references/research-checklist.md`](references/research-checklist.md)：

- 找 **同类功能**（UI 模式、Hook、Service、Store）。
- 找 **入口**（路由、顶栏、API route）。
- 找 **数据持久化**（DB 表、localStorage、COS）。
- 记录 **互斥**（如听书 vs 听当前）。

输出写入文档 **§3 现状与复用**。

### 3) 方案设计

在脑中（并写入文档）回答：

1. **模块怎么切**？（UI / Hook / Utils / API / DB）
2. **数据从哪来到哪去**？（单向数据流）
3. **状态放哪**？（MobX / useState / URL / 服务端）
4. **关键算法或边界**？（一句说清）
5. **为何不用备选**？（1～2 条权衡）

### 4) 画图（先于长文）

按 [`references/diagram-guide.md`](references/diagram-guide.md) 绘制并嵌入 Markdown：

1. 架构图 → 2. 主流程图 → 3. 时序图 → （可选）状态图

画图时自检：**节点有要点列表、连线有语义标签、时序详情在 Note、建议有图例**；渲染重叠则缩短文案或拆图，勿退化成「空名称节点」。

图下 **先列「图内方法说明」表**（覆盖该图全部 callable），**再用 2～4 句** 写「读图要点」；要点讲结构与决策，**不重复**表中已有功能释义。

### 5) 落盘

- 骨架：[`references/doc-outline.md`](references/doc-outline.md)。
- 路径：`<IDEAS_ROOT>/<可选功能域>/<中文文件名>.md`（规则见硬约束 §1）。
- 更新 `<IDEAS_ROOT>/README.md` 索引行。
- 若与 `<WIKI_ROOT>/<功能域>/`（`/Users/dnhyxc/Documents/code/micro-apps/remote-docs/wiki/`）已有专题相关：文首 **延伸阅读** 互链，避免重复维护实现细节。

### 6) 自检

复制 [`references/self-check.md`](references/self-check.md) 清单逐项打勾后再交付。

## 输出格式（摘要）

完整模板见 [`references/doc-outline.md`](references/doc-outline.md)。文首固定包含：

```markdown
# <功能名> — 实现思路

> **状态**：规划 | **日期**：YYYY-MM-DD | **需求摘要**：<一句话>

## 0. 读本文你将得到什么

- …
```

## 示例触发语

| 用户说                                      | 动作                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 「电子书离线缓存的实现思路，写 docs/ideas」 | 调研 ebook 阅读/COS → 出三图 + 分阶段步骤 → `<IDEAS_ROOT>/ebook/电子书离线缓存.md`        |
| 「聊天里加语音输入怎么做」                  | 调研 chat + TTS/上传 → 架构 + 时序 → `<IDEAS_ROOT>/对话语音输入.md`（或合适功能域子目录） |

## 参考文件

| 文件                                                                 | 用途                                                        |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| [references/doc-outline.md](references/doc-outline.md)               | 正文章节模板                                                |
| [references/diagram-guide.md](references/diagram-guide.md)           | Mermaid 图类型与规范（节点要点 / 连线标签 / Note / 正反例） |
| [references/code-line-comments.md](references/code-line-comments.md) | 接口草图注释（做什么+为什么）                               |
| [references/research-checklist.md](references/research-checklist.md) | 调研清单                                                    |
| [references/self-check.md](references/self-check.md)                 | 交付前自检                                                  |
| [examples.md](examples.md)                                           | 触发语与产出示例                                            |
