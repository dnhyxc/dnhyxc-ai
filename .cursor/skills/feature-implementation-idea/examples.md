# 示例：用户怎么说 → 产出什么

## 示例 1 — 电子书新功能

**用户**：

> 帮我写「EPUB 章节书签同步到云端」的实现思路，写到 docs/ideas

**Agent 动作**：

1. 调研 `ebook` 进度 API、COS、阅读页 state
2. 落盘 `docs/ideas/epub-bookmark-cloud-sync.md`
3. 含：架构图（阅读页 / API / DB / COS）、用户添加书签流程图、保存时序图；**每张图下** 附 **图内方法说明** 表（如 `saveBookmark`、`syncToCloud` 各一句功能）
4. 更新 `docs/ideas/README.md` 索引

## 示例 2 — 聊天功能

**用户**：

> /feature-implementation-idea 给「对话里引用知识库段落」出方案

**Agent 动作**：

1. 调研 `chat/`、`knowledge/` 引用与附件模式
2. `docs/ideas/chat-knowledge-quote.md`
3. §10 决策表：inline 引用 vs 附件卡片

## 示例 3 — 不应使用本 Skill

**用户**：

> 根据这次 git diff 写实现文档

→ 改用 **`implementation-doc-from-diff`**，输出到 `docs/<功能域>/`，不是 `docs/ideas/`。

## 示例 4 — 已实现功能

**用户**：

> EPUB 听书功能怎么实现的，写开发者手册

→ 改用 **`ebook-feature-dev-guide`**，输出到 `docs/ebook/developer/`。
