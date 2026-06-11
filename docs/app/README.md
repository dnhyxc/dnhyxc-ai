# 前端应用壳层

路径前缀：`apps/frontend/`（非单一业务模块的横切能力）。

| 文档 | 说明 |
|------|------|
| [route-auth.md](./route-auth.md) | 路由守卫、401、公开路径；§12 COS mixed content |
| [user-switch-state-reset.md](./user-switch-state-reset.md) | 切换账号 / 登出 / 401 时清空前端用户态缓存 |
| [login-cloud-tts-prefetch-401.md](./login-cloud-tts-prefetch-401.md) | **登录瞬间 401 被踢出**：cloud-tts 预拉取与 token 时序 |
| [i18n-zh-en-implementation-guide.md](./i18n-zh-en-implementation-guide.md) | 中英文界面 |
| [home-steps-register-login-query.md](./home-steps-register-login-query.md) | 注册登录与 URL 参数 |
| [tauri-browser.md](./tauri-browser.md) | Tauri / 浏览器双端 |
| [tauri-macos-ats-http.md](./tauri-macos-ats-http.md) | macOS ATS（摘要；细节见 [../cos/cos-dev-http-proxy.md](../cos/cos-dev-http-proxy.md)） |
| [http-network-error-toast.md](./http-network-error-toast.md) | 网络错误 Toast |
| [voice-input-implementation.md](./voice-input-implementation.md) | 语音输入（对话等） |

上级：[../README.md](../README.md)
