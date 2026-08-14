# 对话（Chat）专题文档

路径前缀：`apps/frontend/src/views/chat/`、`apps/backend/src/services/chat/`。总览见 [chatbot.md](./chatbot.md)。

---

## 索引

| 文档 | 说明 |
|------|------|
| [chatbot.md](./chatbot.md) | 对话架构、SSE、附件与 OCR、联网检索 |
| [chat-upload-preview.md](./chat-upload-preview.md) | **历史**本地上传附件 URL、Vite `/images`、CORP 排查 |
| [../cos/cos-object-storage.md](../cos/cos-object-storage.md) | **当前**聊天附件 COS 上传、`chat/` 前缀、展示与分享 |
| [chat-upload-access-prod.md](./chat-upload-access-prod.md) | **生产 Web 附件访问、`/api/upload/serve`、路径规范化、Nginx** |
| [../ops/upload-storage-paths.md](../ops/upload-storage-paths.md) | 后端 uploads 落盘、`UPLOAD_ROOT`、与 dist 同级 |
| [web-search.md](./web-search.md) | 联网搜索与引用 |
| [share.md](./share.md) | 会话分享（顺序、附件、排版） |
| [assistant-share-bar.md](./assistant-share-bar.md) | **增量**：助手分享底栏与 `useAssistantShare` 统一（知识库 / 英语 Agent / 电子书） |
| [share-knowledge-timezone.md](./share-knowledge-timezone.md) | **知识文章分享**「更新时间」MySQL 时区 ±8h 修复 |
| [chat-update.md](./chat-update.md) | Chat 重构与性能相关记录 |
| [chat-memory-oom.md](./chat-memory-oom.md) | **对话堆 OOM**：流式 Registry、附件缓存与解析上限、上下文 60 条 |
| [streaming-code-block-scroll.md](./streaming-code-block-scroll.md) | **流式代码块横滚**：拆段渲染、`StreamingCodeFenceBlock` 冻结 DOM |
| [assistant-selection-speak-guide.md](./assistant-selection-speak-guide.md) | **现行主文档**：助手选区「右键菜单 + 悬浮条 + 状态机」整条链路（F1–F14；英语 Agent / 电子书问书） |
| [selection-speak-common.md](./selection-speak-common.md) | **历史 / 重构对照**：`SelectionSpeak` 组件化与跨域复用过程；现行实现见 [assistant-selection-speak-guide.md](./assistant-selection-speak-guide.md) |
| [streaming-selection-preserve.md](./streaming-selection-preserve.md) | **流式选区保持**：`domTextSelection` 文本偏移快照/恢复、`StreamingCodeFenceBlock` 与 `StableMarkdownChunk` 选区保护、稳定 key 策略 |
| [selection-speak-media-session.md](./selection-speak-media-session.md) | **选区朗读 Media Session**：系统 Touch Bar / 控制中心 play·pause 接入选区朗读（`registerPlaybackMediaHandlers` + `pauseRef`/`resumeRef` 闭包新鲜度） |
