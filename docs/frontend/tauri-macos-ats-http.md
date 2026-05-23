# Tauri macOS：ATS（应用传输安全）与 HTTP 资源

本文说明 **macOS 生产包**中 WKWebView 加载 `http://` 外链被 **ATS（App Transport Security，应用传输安全）** 拦截的原因与策略。**七牛 CDN 展示链、开发态 `/ext-img/` 代理、代码摘录与回归清单**以专题文为准，避免两处重复维护：

→ **[qiniu-dev-http-proxy.md](./qiniu-dev-http-proxy.md)**（主文档）

---

## 1. 现象与报错

生产包或 Tauri dev 加载 `http://` 资源（如七牛 `*.clouddn.com` 图片）时，控制台常见：

- `App Transport Security policy requires the use of a secure connection`
- `Failed to load resource: The network connection was lost.`

示例（host 以 `.env` 中 `VITE_QINIU_DOMAIN` 为准，当前桶域多为 `tfhx5uh5p.hd-bkt.clouddn.com`）：

- `http://tfhx5uh5p.hd-bkt.clouddn.com/128x128@2x.png`

---

## 2. 根因

macOS ATS 默认要求 **HTTPS（TLS）**。Tauri macOS 前端运行在 **WKWebView** 内，对外部 `http://` 资源的请求受系统策略约束，与前端 `fetch` 写法无关。

| 场景 | 典型处理 |
|------|----------|
| **开发**（`pnpm dev` / Tauri dev） | 展示 URL 改写为同源 `/ext-img/`，由 Vite 代理回源 HTTP（见七牛主文档） |
| **Tauri 生产** | 无 Vite：展示用原始 HTTP URL + `Info.plist` 对 CDN 域名做 **NSExceptionDomains** |
| **Web 生产 HTTPS** | `/ext-img/` + Nginx 回源（见 [route-auth.md](./route-auth.md) §12） |

---

## 3. 解决思路（推荐顺序）

### 3.1 长期：资源域名 HTTPS

七牛控制台绑定 HTTPS 域名后，可逐步取消 HTTP 例外，安全性最好。

### 3.2 当前：按环境分层（本项目）

1. **开发 / Tauri dev**：`resolveQiniuUrlForWebDisplay` + Vite `server.proxy['/ext-img']`（不改持久化 URL）。
2. **Tauri 生产**：`apps/frontend/src-tauri/Info.plist` 中对 **当前 CDN host** 配置 `NSExceptionAllowsInsecureHTTPLoads`；并配置 `NSAllowsLocalNetworking` 以便 `http://localhost` API。
3. **Web 生产**：Nginx `location /ext-img/`（[backend/nginx.md](../backend/nginx.md)）。

完整配置片段、capabilities 白名单、换桶 checklist → [qiniu-dev-http-proxy.md](./qiniu-dev-http-proxy.md) §5–§8。

### 3.3 不推荐

`NSAllowsArbitraryLoads = true` 会放开全部 HTTP，生产环境一般避免。

---

## 4. Info.plist 落点

- 文件：`apps/frontend/src-tauri/Info.plist`
- Tauri v2 会合并同目录 `Info.plist` 进 macOS 包。
- **域名键只写 host**（无 `http://`、无端口）；换桶时与 `VITE_QINIU_DOMAIN`、`capabilities/default.json` 的 `http.allowlist` **同步修改**。

---

## 5. 验证

1. 修改 `Info.plist` 或 `vite.config.ts` 后：**Tauri 需重新 build / 重启 dev**（代理不热更新）。
2. macOS 生产包：控制台无 ATS 报错，CDN 图片可加载。
3. CI 若遇 `--ci` 解析问题，可 `env -u CI pnpm run tauri build --debug`（见历史记录）。

---

## 6. 相关文档

| 文档 | 内容 |
|------|------|
| [qiniu-dev-http-proxy.md](./qiniu-dev-http-proxy.md) | 实现、代码、环境变量、回归 |
| [route-auth.md](./route-auth.md) §12 | mixed content 与调用方 |
| [../backend/nginx.md](../backend/nginx.md) | 生产 `/ext-img/` |
| [../README.md](../README.md) | 文档总索引 |
