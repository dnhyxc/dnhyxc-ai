# 示例：用户怎么说 → 产出什么

落盘根目录 `<IDEAS_ROOT>` = `/Users/dnhyxc/Documents/code/micro-apps/remote-docs/wiki/ideas/`（相对本仓：`../micro-apps/remote-docs/wiki/ideas/`）。即使用户说「写到 docs/ideas」，也写入 `<IDEAS_ROOT>`。

## 示例 1 — 电子书新功能

**用户**：

> 帮我写「EPUB 章节书签同步到云端」的实现思路，写到 docs/ideas

**Agent 动作**：

1. 调研 `ebook` 进度 API、COS、阅读页 state
2. 落盘 `<IDEAS_ROOT>/epub/章节书签云同步.md`（或 `ebook/`，按现有域目录惯例）
3. 含：架构图（阅读页 / API / DB / COS）、用户添加书签流程图、保存时序图；节点用要点列表、连线带语义标签、时序详情进 Note；**每张图下** 附 **图内方法说明** 表（如 `saveBookmark`、`syncToCloud` 各一句功能）
4. 更新 `<IDEAS_ROOT>/README.md` 索引

## 示例 2 — 聊天功能

**用户**：

> /feature-implementation-idea 给「对话里引用知识库段落」出方案

**Agent 动作**：

1. 调研 `chat/`、`knowledge/` 引用与附件模式
2. `<IDEAS_ROOT>/knowledge/知识库段落引用.md`（或根目录，视域划分）
3. §10 决策表：inline 引用 vs 附件卡片

## 示例 3 — 不应使用本 Skill

**用户**：

> 根据这次 git diff 写实现文档

→ 改用 **`implementation-doc-from-diff`**，输出到 `<WIKI_ROOT>/<功能域>/`（`/Users/dnhyxc/Documents/code/micro-apps/remote-docs/wiki/`），不是 `<IDEAS_ROOT>`。

## 示例 4 — 已实现功能

**用户**：

> EPUB 听书功能怎么实现的，写开发者手册

→ 改用 **`ebook-feature-dev-guide`**，输出到本仓 `docs/ebook/developer/`。
