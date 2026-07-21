# 前端应用壳层

路径前缀：`apps/frontend/`（非单一业务模块的横切能力）。

| 文档 | 说明 |
|------|------|
| [route-auth.md](./route-auth.md) | 路由守卫、401、公开路径；§12 COS mixed content |
| [user-switch-state-reset.md](./user-switch-state-reset.md) | 切换账号 / 登出 / 401 时清空前端用户态缓存（含书架） |
| [membership-store-circular-deps.md](./membership-store-circular-deps.md) | **增量**：会员纯函数下沉，修复 Store 循环依赖与 `getStorage` TDZ |
| [login-cloud-tts-prefetch-401.md](./login-cloud-tts-prefetch-401.md) | **登录瞬间 401 被踢出**：cloud-tts 预拉取与 token 时序 |
| [i18n-zh-en-implementation-guide.md](./i18n-zh-en-implementation-guide.md) | 中英文界面 |
| [home-steps-register-login-query.md](./home-steps-register-login-query.md) | 注册登录与 URL 参数 |
| [tauri-browser.md](./tauri-browser.md) | Tauri / 浏览器双端 |
| [tauri-macos-ats-http.md](./tauri-macos-ats-http.md) | macOS ATS（摘要；细节见 [../cos/cos-dev-http-proxy.md](../cos/cos-dev-http-proxy.md)） |
| [http-network-error-toast.md](./http-network-error-toast.md) | 网络错误 Toast |
| [tauri-http-all-method-retry.md](./tauri-http-all-method-retry.md) | **Tauri HttpClient 全方法重试**：POST 等写请求默认 2 次、`catch`/`handleErrorResponse` 修复 |
| [voice-input-implementation.md](./voice-input-implementation.md) | 语音输入（对话等） |
| [secret-input-component.md](./secret-input-component.md) | **SecretInput 密文输入组件**：设计系统统一组件，密码/API Key + 眼睛显隐按钮、受控/非受控、`tabIndex=-1` |
| [setting-api-key-secret-input.md](./setting-api-key-secret-input.md) | **设置页 API Key 改用 SecretInput**：LLM + 云端 TTS 设置页去重样板代码 |
| [login-password-secret-input-tab.md](./login-password-secret-input-tab.md) | **登录页密码显隐 + 全局 Tab 仅输入框**：`SecretInput` 接入登录/注册/找回密码、`useInputsOnlyTab` Hook |
| [wechat-mini-program-login-bind.md](./wechat-mini-program-login-bind.md) | **微信小程序登录与账号关联**：code2session、bind_token/link_code 双 token、JWT 解绑吊销、Web 端绑定面板 |
| [mf-plugin-host.md](./mf-plugin-host.md) | **Module Federation 动态插件 Host**：registry、校验、loadRemote、路由/侧栏注入、失败不闪烁 |
| [mf-implementation-guide.md](./mf-implementation-guide.md) | **MF 实现过程总文档**：Vite 配置、运行时 API、PluginManager、RouteInjector、SidebarInjector、HostBridge、插件验证、Registry、iframe 隔离等 |
| [dynamic-plugin-system.md](./dynamic-plugin-system.md) | **动态插件系统核心实现**：Vite MF 配置、App 组件初始化、buildRoutes 动态路由合并、PluginManager 生命周期、Sidebar 动态菜单注入（含改动前/后对比与逐行注释） |
| [plugin-development-guide.md](./plugin-development-guide.md) | **子项目/插件开发手册**：环境准备、Vite 配置、组件规范、全局样式隔离、HostBridge API、权限声明、生命周期、iframe 隔离模式、调试与发布 |
| [host-plugin-integration-guide.md](./host-plugin-integration-guide.md) | **主项目接入插件方式**：自动路由注入、业务内手动挂载、iframe 隔离；电子书/英语学习接入示例、插件中心管理、Registry 配置、侧栏菜单注入 |
| [plugin-shelf-toggle.md](./plugin-shelf-toggle.md) | **插件上架/下架实现**：PluginManager.setEnabled、persistPluginEnabled 持久化、enabledOverrides 订阅、usePluginEnabled Hook、插件中心 Switch、Registry 编辑页、后端 PUT /upload/remotes（含改动前/后对比与逐行注释） |
| [../ideas/third-party-mf-plugin-onboarding.md](../ideas/third-party-mf-plugin-onboarding.md) | **第三方插件接入配置**：任意 HTTPS 域、CORS 契约、加插件不发桌面版 |
| [../ideas/mf-css-isolation.md](../ideas/mf-css-isolation.md) | **主/子样式隔离**：scoped CSS + untrusted iframe |

上级：[../README.md](../README.md)
