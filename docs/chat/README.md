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
| [share-knowledge-timezone.md](./share-knowledge-timezone.md) | **知识文章分享**「更新时间」MySQL 时区 ±8h 修复 |
| [chat-update.md](./chat-update.md) | Chat 重构与性能相关记录 |
