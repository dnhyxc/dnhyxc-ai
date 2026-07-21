# 运维与部署

路径前缀：`apps/backend/`（部署、静态资源、本地上传落盘）。

| 文档 | 说明 |
|------|------|
| [server-deployment.md](./server-deployment.md) | 部署总览 |
| [deploy.md](./deploy.md) | 部署步骤 |
| [nginx.md](./nginx.md) | Nginx：`/api`、`/images`、`/ext-cos/`、可选 `/mf-proxy/` 等 |
| [upload-storage-paths.md](./upload-storage-paths.md) | **本地上传** `uploads/`、`UPLOAD_ROOT`（聊天附件已迁 COS，见 [../cos/cos-object-storage.md](../cos/cos-object-storage.md)） |
| [remotes-registry-static.md](./remotes-registry-static.md) | **插件 registry**：`uploads/remotes`、`GET /remotes/`、Vite/Nginx 同源代理、Remote CORS（含 `tauri://localhost`） |
| [remote-static-resources.md](./remote-static-resources.md) | **后端 Remote 静态资源服务**：`upload-paths.ts` 新增 `REMOTES` 目录、`upload-public.controller.ts` 新增 `serveRemote`，含改动前/后对比与逐行注释 |
| [../ideas/third-party-mf-plugin-onboarding.md](../ideas/third-party-mf-plugin-onboarding.md) | **第三方 MF 插件接入**：对方 CORS 契约、registry 上架、不加 capabilities、`/mf-proxy` 兜底 |
| [trust-proxy-rate-limit.md](./trust-proxy-rate-limit.md) | 生产 **trust proxy** + rate-limit 标准头（修复 X-Forwarded-For 报错） |

相关：[../chat/chat-upload-access-prod.md](../chat/chat-upload-access-prod.md)

上级：[../README.md](../README.md)
