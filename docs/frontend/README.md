# 前端专题文档

路径前缀：`apps/frontend/`。路由与鉴权总览见 [route-auth.md](./route-auth.md)。

---

## COS 展示代理 / ATS（必读簇）

| 文档 | 角色 |
|------|------|
| **[../backend/cos-object-storage.md](../backend/cos-object-storage.md)** | **COS 主文档**：`uploadCos`、环境变量、ACL、聊天附件 |
| **[cos-dev-http-proxy.md](./cos-dev-http-proxy.md)** | **展示代理主文档**：`/ext-cos/`、`resolveCosUrlForWebDisplay`、Vite/Nginx |
| [tauri-macos-ats-http.md](./tauri-macos-ats-http.md) | macOS ATS 概念；实现细节以 cos-dev-http-proxy 为准 |
| [route-auth.md](./route-auth.md) §12 | 路由文档中的 mixed content 摘要 + 调用方列表 |
| [../backend/nginx.md](../backend/nginx.md) | 生产 `location /ext-cos/` |

**数据流一句话**：持久化存 COS 完整 HTTPS URL；**展示**在 DEV / Web PROD 改写为 `/ext-cos/`；Tauri **生产**直链 COS HTTPS（桶域名须在 allowlist / ATS 策略内）。

---

## Tauri / 桌面端

| 文档 |
|------|
| [tauri-browser.md](./tauri-browser.md) |
| [tauri-macos-ats-http.md](./tauri-macos-ats-http.md) |
| [cos-dev-http-proxy.md](./cos-dev-http-proxy.md) |

---

## 路由、鉴权、账户

| 文档 |
|------|
| [route-auth.md](./route-auth.md) |
| [home-steps-register-login-query.md](./home-steps-register-login-query.md) |
| [i18n-zh-en-implementation-guide.md](./i18n-zh-en-implementation-guide.md) |

---

## 英语学习（词汇 / 词包 / 收藏 / TTS）

按主题检索下列文件（命名均含 `english-` 或 `vocab-`）：

- 列表与网络：[english-learning-list-network-retry.md](./english-learning-list-network-retry.md)
- 词包流式 / SSE：[english-learning-pack-sse.md](./english-learning-pack-sse.md)、[english-pack-stream-store.md](./english-pack-stream-store.md)
- 会话分页：[english-learning-pack-session-items.md](./english-learning-pack-session-items.md)
- 收藏 / 导出：[english-learning-favorites-drawer.md](./english-learning-favorites-drawer.md) 等（目录内 `*favorites*`、`*docx*`）
- TTS：[english-tts-playback.md](./english-tts-playback.md)、[english-tts-cache-consistency.md](./english-tts-cache-consistency.md)

完整列表：`ls docs/frontend/english-*.md docs/frontend/vocab-*.md`

---

## 其它

| 文档 | 说明 |
|------|------|
| [http-network-error-toast.md](./http-network-error-toast.md) | 网络错误提示 |
| [voice-input-implementation.md](./voice-input-implementation.md) | 语音输入 |
| [system-shortcuts-conflict-and-toast.md](./system-shortcuts-conflict-and-toast.md) | 快捷键冲突 |
| [../backend/llm-runtime-settings.md](../backend/llm-runtime-settings.md) | 设置 → 大模型页（`/setting/llm`） |


上级索引：[../README.md](../README.md)
