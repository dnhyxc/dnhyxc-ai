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
| [plugin-entry-cache-bust.md](./plugin-entry-cache-bust.md) | **插件 entry 缓存破坏（version@manifestHash）**：Remote manifest 指纹 bust、afterResolve 补 remoteEntry、发布者勿改 Host registry |
| [mf-manifest-dedup.md](./mf-manifest-dedup.md) | **MF manifest 去重与 remoteEntry 直连优化**：一次拉取 manifest 同时产出 buildId + remoteEntry 地址、registerRemote 跳过 MF 二次 manifest 请求、federation `name` 改为 `micro`（含改动前/后对比与逐行注释） |
| [mf-shared-react-router.md](./mf-shared-react-router.md) | **勿 shared react-router**：避免生产双 Router / `useLocation` 白屏 |
| [plugin-registry-hostapi.md](./plugin-registry-hostapi.md) | **Registry hostApi 校验与字段说明**：`VITE_HOST_API_VERSION`、保存校验、`RegistryFieldsHelp`、⌘S |
| [remote-plugin-hmr.md](./remote-plugin-hmr.md) | **Remote 开发态双次刷新**：勿同文件空 `activate`；tiptap `optimizeDeps.include` |
| [plugin-lifecycle-colocation.md](./plugin-lifecycle-colocation.md) | **插件生命周期钩子同文件挂载与 Fast Refresh 兼容**：`pickPluginLifecycle` 双源解析（named export / default 静态属性）、`LifecycleCarrier` 类型、`normalizePluginModule` 缺失钩子 info 日志、`VueRemoteExpose` 生命周期字段扩展；含改动前/后对比与逐行注释 |
| [mf-plugin-locale-sync.md](./mf-plugin-locale-sync.md) | **MF 插件语言同步与远程插件 i18n 完整接入**：`api.t` → `api.locale`、`withLiveLocale`/`eventBus`/`postMessage` 三路同步、`iframeHostClient` 接收 `applyHostLocale`、`learningNotes` store 注入 `t`、Layout 语言切换按钮（含改动前/后对比与逐行注释） |
| [plugin-registry-i18n.md](./plugin-registry-i18n.md) | **插件 Registry i18n 解耦**：插件 registry 自带 `PluginLocaleMap` 多语言 title/description，移除 `titleKey`/`descriptionKey`/`menu.nameKey`；`pickPluginLocaleText` 回退链、`RouteMeta.titleI18n`、`resolveRouteMetaLabel` 统一解析、Header 面包屑与插件中心卡片改用已解析 label（含改动前/后对比与逐行注释） |
| [mf-implementation-guide.md](./mf-implementation-guide.md) | **MF 实现过程总文档**：Vite 配置、运行时 API、PluginManager、RouteInjector、SidebarInjector、HostBridge、插件验证、Registry、iframe 隔离等 |
| [dynamic-plugin-system.md](./dynamic-plugin-system.md) | **动态插件系统核心实现**：Vite MF 配置、App 组件初始化、buildRoutes 动态路由合并、PluginManager 生命周期、Sidebar 动态菜单注入（含改动前/后对比与逐行注释） |
| [plugin-development-guide.md](./plugin-development-guide.md) | **子项目/插件开发手册**：环境准备、Vite 配置、组件规范、全局样式隔离、HostBridge API、权限声明、生命周期、iframe 隔离模式、调试与发布 |
| [host-plugin-integration-guide.md](./host-plugin-integration-guide.md) | **主项目接入插件方式**：自动路由注入、业务内手动挂载、iframe 隔离；电子书/英语学习接入示例、插件中心管理、Registry 配置、侧栏菜单注入 |
| [ebook-host-surface-plugins.md](./ebook-host-surface-plugins.md) | **Ebook 阅读页插件动态接入（Host Surface 发现机制）**：`PluginDescriptor.host` 声明、`listHostSurfacePlugins`/`useHostSurfacePlugins` 同步枚举、`EbookReadHostPlugins` 三 part 槽位、阅读页去硬编码、后端 highlights 分页端点、remote 仓 ebook 视图重组与新增 expose（含改动前/后对比与逐行注释） |
| [plugin-host-icons.md](./plugin-host-icons.md) | **Host 插件图标 SVG URL 动态加载**：`PluginIcon` 内联渲染、`normalizeSvgForHostIcon`（stroke/fill + currentColor 主题）、注册表上传写回 `menu.icon`/`host.icon`、去掉 Lucide 白名单、React 19 `__html` 引用稳定避免点击重播画线（含改动前/后对比与逐行注释） |
| [plugin-docs-update.md](./plugin-docs-update.md) | **插件开发文档路径同步**：`ebook-ideas` → `ebook/ideas` 目录重组后，同步 host-plugin-integration-guide / mf-implementation-guide 两份文档中的文件路径引用 |
| [federation-kit-migration.md](./federation-kit-migration.md) | **微前端通用包 federation-kit 迁移与本仓 Host 适配层重写**：原 `plugins/` 抽为 `@dnhyxc-ai/federation-kit` + 本仓 `federation/` 薄适配；`createFederation` DI、`PluginHostSurface` 通用模版、`mf.start()`/`mf.onRoutesChange` 调用点迁移、englishLearning 防闪烁；含改动前/后对比与逐行注释 |
| [sonner-pointer-events-fix.md](./sonner-pointer-events-fix.md) | **sonner Toaster 点击失效修复**：插件样式隔离场景下 Toast 根节点 + `<Sonner>` className 与 inline style 三处显式注入 `pointer-events: auto`；含改动前/后对比与逐行注释 |
| [plugin-shelf-toggle.md](./plugin-shelf-toggle.md) | **插件上架/下架实现**：PluginManager.setEnabled、persistPluginEnabled 持久化、enabledOverrides 订阅、usePluginEnabled Hook、插件中心 Switch、Registry 编辑页、后端 PUT /upload/remotes（含改动前/后对比与逐行注释） |
| [plugin-enabled-prefs-persistence.md](./plugin-enabled-prefs-persistence.md) | **插件上架偏好按账号持久化（Web/桌面跨端同步）**：后端 `plugin_user_prefs` 建表 + `PluginPrefsModule`（Entity/DTO/Service/Controller），前端 `pluginEnabledPrefs` 内存缓存 + 旧 localStorage 一次性迁移，`overlayUserEnabled` 解耦 catalog 与偏好，`syncEnabledShells` 切号重挂路由/侧栏，默认全关（含改动前/后对比与逐行注释） |
| [switch-dynamic-id-fix.md](./switch-dynamic-id-fix.md) | **Switch 组件动态 ID 修复**：新增 `id` prop + `React.useId` 兜底，`switchId` 同时驱动 `<Root id>` 与 `<Label htmlFor>`，解决多实例下 Label 点击串到第一个 Switch 的 bug（含改动前/后对比与逐行注释） |
| [plugin-card-border-theme.md](./plugin-card-border-theme.md) | **插件中心卡片 border 显式主题色**：`Card` className 追加 `border-theme/5`，避免裸 `border` 吃到被远程插件污染的 `border-border` 白边（含改动前/后对比与逐行注释） |
| [tauri-webview-context-menu-disable.md](./tauri-webview-context-menu-disable.md) | **Tauri 桌面端生产环境禁用 WebView 系统右键菜单**：`App` 首个 `useEffect` 内 `import.meta.env.PROD && isTauriRuntime()` 时注册 `contextmenu` 监听并 `preventDefault`（含改动前/后对比与逐行注释） |
| [tauri-window-zoom-unveil.md](./tauri-window-zoom-unveil.md) | **macOS 窗口缩放零露白**：swizzle `NSWindow.zoom:`、目标尺寸预布局 + 顶对齐 cover + 窗口揭开、dispatch2 帧循环、注入 JS 钉 `#root`/body 尺寸、首帧立刻 tick、移除 `background-attachment:fixed`（含改动前/后对比与逐行注释；规划思路见 [../ideas/tauri-window-zoom-unveil.md](../ideas/tauri-window-zoom-unveil.md)） |
| [tauri-system-menu-shortcuts.md](./tauri-system-menu-shortcuts.md) | **系统菜单 + 全局/页面快捷键体系**：`shortcut_{n}` store 单一真相源、`IconMenuItem` 运行时 `set_accelerator` 改键、`sync_window_menu_shortcuts` 命令、失焦反注册（`HideOrShowApp` 例外）、删 `Hide` 收敛、macOS Edit 系统项中文化与 SF Symbol 图标统一（含改动前/后对比与逐行注释；规划思路见 [../ideas/tauri-system-menu-shortcuts.md](../ideas/tauri-system-menu-shortcuts.md)） |
| [about-window-lightweight.md](./about-window-lightweight.md) | **关于子窗轻量化**：`main.tsx` 按 pathname 分流（`/about` 走独立 chunk）、新增 `about.tsx` 极简入口、`About` 用 `useState` + URL search 取版本不再依赖 `useGetVersion`、菜单「关于」已开则原生侧 `set_focus`、`onCreateWindow` 已存在窗 `setTheme + show + setFocus`（含改动前/后对比与逐行注释） |
| [logout-unify-theme-sync.md](./logout-unify-theme-sync.md) | **登出统一 + 多窗主题同步**：新增 `performLogout(navigate?)` 集中清态（侧边栏 / File 菜单 / 401 三入口复用）、动态 import 规避 `utils↔authSession↔store` 静态循环、`changeTheme` 写完 store 后 `setThemeToAllWindows` 广播、新增 `readWindowChromeThemeSync` 三级回退同步读、`onCreateWindow` 已存在窗 `setTheme`（含改动前/后对比与逐行注释） |
| [style-isolation-tech-overview.md](./style-isolation-tech-overview.md) | **主项目样式隔离技术说明**：5 分钟快速了解 @scope 原理、两层捕获机制、trusted/untrusted 两种模式、主子项目各自关注点、常见问题 FAQ |
| [style-isolation-implementation.md](./style-isolation-implementation.md) | **主子项目样式隔离实现手册**：CSS @scope 原理、DOM 劫持 + MutationObserver 双层捕获、styleIsolation.ts 逐行注释、PluginManager/PluginHostPage 调用链路、子项目零改造、边界情况与降级策略、与 Shadow DOM/qiankun 对比 |
| [style-isolation-dev-exclude-host.md](./style-isolation-dev-exclude-host.md) | **开发态样式认领：白名单 → 排除 Host**：`looksLikeRemoteStyle` viteId 分支由匹配 `micro\|remote-plugins\|…` 目录名改为 `hostViteRoot` + `isHostViteDevStyle` 排除 Host，新增/重命名 `apps/<remote>` 不必改正则（含改动前/后对比与逐行注释） |
| [style-isolation-realm-portal.md](./style-isolation-realm-portal.md) | **样式隔离 Realm 键 + Portal 收编 + HMR 修复**：按 Remote 来源 `styleRealmKey` 替代 `pluginId` 粒度、`createPortal` 劫持收编 `body` portal、sonner Toaster 保护、HMR 下 `@scope` 重包、reclaim 旧样式（含改动前/后对比与逐行注释） |
| [style-isolation-qiankun-harden.md](./style-isolation-qiankun-harden.md) | **样式隔离 qiankun 级加固**：`transpileStyleText`（font-face hoist / keyframes 前缀）、CSSOM `insertRule`、body 原型劫持覆盖 Vue Teleport、`captureStack`、MO 收窄、sticky `:hover`、Toaster children 保护（含改动前/后对比与逐行注释） |
| [style-isolation-portal-overlay-timing.md](./style-isolation-portal-overlay-timing.md) | **样式隔离 Portal Overlay 重构与时序保证**：Portal scope 全屏 fixed 覆盖层、`useLayoutEffect` 保证挂载时序、Element Plus Popper 容器回收、HMR 智能重隔离 `styleNeedsRescope`、`stampRealmOnPortalNode`（含改动前/后对比与逐行注释） |
| [plugin-vue-bridge.md](./plugin-vue-bridge.md) | **Vue 子应用桥接（跨框架插件支持 · Host 零 Vue 依赖）**：Remote 自管 `createApp`、Host 调 `mount(el, bridge)` API、registry `framework` 字段、`vite.config.ts` 移除 Vue shared、`PluginPageShell` overflow-auto（含改动前/后对比与逐行注释） |
| [remote-demo-audio-player.md](./remote-demo-audio-player.md) | **remote-demo 插件多音频连续播放**：集成 AudioPlayer 组件、支持三段音频自动连续播放、进度跟踪和手动跳转 |
| [video-player-plugin.md](./video-player-plugin.md) | **视频播放器插件**：基于 xgplayer 的视频播放插件实现，支持多文件上传、自定义控制条、PiP、影院态全屏、选集、倍速等（含改动前/后对比与逐行注释） |
| [video-player-component-refactor.md](./video-player-component-refactor.md) | **视频播放器组件化重构**：单体 `VideoPlayer.tsx` 拆为通用 `VideoPlayer` / `VideoUpload` / `Tooltip` / `Popover` / `Segmented` / `Volume`，插件入口变「列表状态 + 组合层」，`TooltipProvider` 全局挂载，`PlaybackRatePanel` 用项目语义 token 替换硬编码白色（含改动前/后对比与逐行注释） |
| [video-player-feature-enhancement.md](./video-player-feature-enhancement.md) | **视频播放器功能增强**：进度条缩略图预览（离屏 video + canvas）、多平台画中画（xgplayer 插件 → 原生 API → WebKit 兜底）、xgplayer 语言跟随主站 locale、重置逻辑全面清理、长视频刻度上限（含改动前/后对比与逐行注释） |
| [video-player-drag-scrub.md](./video-player-drag-scrub.md) | **视频播放器进度条拖拽重写与画布跟随修复**：拖拽像素对齐 + `scrubHoldUntilRef` 抑制右抖、固定 160×90 canvas + cover/contain、循环单条原地重播、播放器背景跟随主题、控制条 `visible` 替换 `opacity`、`PluginPageShell` / `Layout` 分层 `overflow-hidden`（含改动前/后对比与逐行注释） |
| [rich-editor-feature.md](./rich-editor-feature.md) | **富文本编辑器功能实现**：基于 Tiptap 的自定义标题节点（atom + 单标题约束 + 选区修正）、TabIndent/DocEdgeNav/EmptyParagraphDelete 自定义快捷键扩展、图片粘贴/拖放上传（resolveSrcRef ref 模式）、字数统计（Intl.Segmenter CJK 正确计数）、完整中英文 UI 本地化（含改动前/后对比与逐行注释） |
| [learning-notes-implementation.md](./learning-notes-implementation.md) | **学习笔记实现**：MobX `LearningNotesStore` 单例模式、Host API 依赖注入（bind/http/toast/t/downloadBlob）、累积分页加载（首次/刷新/加载更多三模式 + 去重）、乐观预览加载、CRUD + DOCX 导出（服务端生成 + 双端 downloadBlob）、公开/私密状态管理（含改动前/后对比与逐行注释） |
| [video-player-chrome-cinema-theme.md](./video-player-chrome-cinema-theme.md) | **视频播放器影院态控制条主题适配**：`chromeFg` / `chromeFgMuted` 派生语义色、影院态黑底切白字、顶部标题 + 底部全控制条（播放/上一集/下一集/选集/重置/倍速/音量/画中画/全屏）统一复用（含改动前/后对比与逐行注释） |
| [plugin-cinema-fullscreen.md](./plugin-cinema-fullscreen.md) | **插件影院态全屏与路由防闪 404**：`appFullscreen` 单例、Layout 影院态订阅、`PluginPageShell` 统一外壳、`pluginsReady` + `PluginRoutesPending` 防 404、侧栏菜单拆分、Tauri 全屏 capability（含改动前/后对比与逐行注释） |
| [style-isolation-layered-refactor.md](./style-isolation-layered-refactor.md) | **样式隔离分层重构（巨石 → protocol / css / sandbox / portal）**：`host/styleIsolation.ts` 单文件拆为四层目录、新增 `themeStrip` 剥离 Host 主题 token、对外 barrel 不变、smoke 迁位（含改动前/后对比与逐行注释） |
| [plugins-core-refactor.md](./plugins-core-refactor.md) | **插件 Core 模块分层重构**：`core/` 扁平单文件（PluginManager/PluginVerifier/types/mf/createHostBridge）拆为 runtime/bridge/types/mf 子目录、新增 `core/index.ts` barrel 对外接口稳定 |
| [style-isolation-modularization.md](./style-isolation-modularization.md) | **样式隔离模块化与 PluginHostPage 接入**：样式隔离逻辑独立为 `plugins/style-isolation/`、PluginManager 在 `loadRemoteApp` 前后包裹样式捕获、PluginHostPage 用 `useLayoutEffect` 激活运行时隔离并挂 `data-mf-style-realm` 标记（含改动前/后对比与逐行注释） |
| [standalone-preview-polish.md](./standalone-preview-polish.md) | **独立预览环境优化**：Toaster 挂载、padding 从 layout 移至 home、UI 组件导出补齐、Input spellCheck、ScrollArea 注释 |
| [plugin-icon-system.md](./plugin-icon-system.md) | **SVG 插件图标系统**：`PluginIcon` 组件（fetch + 缓存 + 归一化 + 内联渲染）、`pluginIconUrl` 工具集（`normalizeSvgForHostIcon`、`detectPluginIconKind`、`isThemeablePaint`）、Sidebar / PluginHostSurface 集成、CSS 动画 `pathLength=1` 单位方案（含改动前/后对比与逐行注释） |
| [registry-icon-upload.md](./registry-icon-upload.md) | **Registry 图标上传**：Upload 组件新增 `uploadType="button"` + `openRef` + `validExtensions`、DropdownMenu scrollable、Registry 页面图标上传 UI（DropdownMenu 插件选择 + COS 上传 + `applyPluginIconUrl` 写入 + 热加载）、i18n 文案（含改动前/后对比与逐行注释） |
| [unified-file-selection.md](./unified-file-selection.md) | **通用文件选择命令统一**：Tauri `select_files` 命令（accept + multiple + title）替代 3 个专用命令（`pick_ebook_file` / `select_knowledge_import_md_file` / `select_english_learning_import_json_file`）、前端 `select-files.ts` 模块（`pickLocalFiles` / `selectFile` / `selectFiles`）、电子书/知识库/英语学习导入迁移、`assetProtocol` 配置（含改动前/后对比与逐行注释） |
| [plugin-pick-local-files.md](./plugin-pick-local-files.md) | **插件选本地文件能力**：federation-kit bridge 新增 `api.ui.pickLocalFiles`、`HostCapabilities.pickLocalFiles` 类型、`createHostBridge` 装配（`ui:toast` 门闩）、`attachIframeBridge` RPC case、Host 适配层（Tauri `convertFileSrc` / Web `createObjectURL`）、权限文档同步（含改动前/后对比与逐行注释） |
| [../ideas/third-party-mf-plugin-onboarding.md](../ideas/third-party-mf-plugin-onboarding.md) | **第三方插件接入配置**：任意 HTTPS 域、CORS 契约、加插件不发桌面版 |
| [../ideas/mf-css-isolation.md](../ideas/mf-css-isolation.md) | **主/子样式隔离**：scoped CSS + untrusted iframe |

上级：[../README.md](../README.md)
