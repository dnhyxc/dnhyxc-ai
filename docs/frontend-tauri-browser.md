# 前端 Tauri / 浏览器双端运行改造说明

本文档记录为让 `apps/frontend` 在 **Tauri 桌面壳** 与 **独立浏览器**（如 `pnpm dev`、静态部署）下均能运行而做的全部改动：背景、根因、方案与文件级清单。

---

## 1. 背景与要解决的问题

### 1.1 目标

- 同一套 React 前端既打包进 Tauri，也能单独用 Vite 在浏览器里开发与预览。
- 在浏览器中**不因缺少 Tauri 桥接而白屏、抛未捕获异常或模块加载失败**。

### 1.2 原有问题（根因）

1. **`store.ts` 顶层 `await`**  
   在模块加载阶段调用 `appDataDir()`、`Store.load()` 等 Tauri API。浏览器里没有 IPC 与原生能力，会导致初始化失败或阻塞整个应用入口依赖链。

2. **静态依赖 Tauri 模块**  
   `invoke`、`@tauri-apps/plugin-http` 的 `fetch`、剪贴板、`listen`/`emit`、`openUrl` 等在无壳环境调用时行为未定义或抛错。

3. **路由与全局副作用**  
   根组件挂载时无条件 `listen('about' | 'logout')`，依赖 Tauri 事件总线；剪贴板快捷键全局拦截依赖 Tauri 剪贴板插件。

4. **业务页直接 `invoke` / `openUrl`**  
   系统设置、Profile 演示、外链打开等在无壳时仍会调桌面专属命令。

---

## 2. 核心方案

### 2.1 运行时判断：`isTauriRuntime()`

新增 `apps/frontend/src/utils/runtime.ts`，在**客户端**通过 Tauri 2 注入的全局对象判断是否在 WebView 内：

- 条件：`typeof window !== 'undefined'` 且 `'__TAURI_INTERNALS__' in window`
- 为 `true`：走 Tauri 插件 / `invoke` / 原生能力
- 为 `false`：走 Web API 或降级提示（toast），避免调用 IPC

> 说明：未使用 `import.meta.env.TAURI_*` 作为主判断，因当前 Vite 配置未接入 `@tauri-apps/vite-plugin`；运行时检测与「是否在真实 WebView 内」一致。

### 2.2 设计原则

- **不在浏览器入口链上使用顶层 `await` 调 Tauri**。
- **网络**：Tauri 用 HTTP 插件，浏览器用原生 `fetch`（便于走 Vite 代理与 CORS）。
- **存储**：Tauri 用 `plugin-store` 写应用数据目录；浏览器用 `localStorage` 键 `dnhyxc_settings_json` + 内存缓存，语义上尽量贴近「键值设置」用法。
- **外链**：统一 `openExternalUrl`：Tauri 用 `plugin-opener`，浏览器用 `window.open(..., 'noopener,noreferrer')`。
- **仅桌面能力**：系统设置里的目录选择、自启、全局快捷键注册等，在浏览器中 **不调用 `invoke`**，必要时 `toast` 说明。

---

## 3. 新增文件

| 路径 | 作用 |
|------|------|
| `src/utils/runtime.ts` | 导出 `isTauriRuntime()` |
| `src/utils/open-external.ts` | 导出 `openExternalUrl(url)`，双端打开外链 |

---

## 4. 修改文件与行为说明

### 4.1 工具与基础设施

| 文件 | 改动摘要 |
|------|-----------|
| `src/utils/store.ts` | 移除顶层 `await`；按需 `import` Tauri `path` + `plugin-store`；非 Tauri 时用 `localStorage` + `saveNow` 与 Tauri 侧 `set/save` 对齐 |
| `src/utils/fetch.ts` | 去掉对 `utils/index` 的依赖以防循环引用；token 用 `localStorage.getItem('token')`；新增 `getPlatformFetch()`，缓存 Tauri HTTP 或原生 `fetch` |
| `src/utils/sse.ts` | 使用 `getPlatformFetch()`；token 读取改为本地函数，避免从 barrel 引入 `index` |
| `src/utils/clipboard.ts` | 读写剪贴板按运行时动态 `import` 插件或 `navigator.clipboard` |
| `src/utils/event.ts` | `onEmit` / `onListen`：Tauri 用官方 event；浏览器用 `CustomEvent` + `window` |
| `src/utils/index.ts` | 导出 `isTauriRuntime`、`openExternalUrl`；`downloadFileFromUrl` / `downloadBlob` / `saveFileWithPicker` 在浏览器用 `<a>`、`Blob`、`showSaveFilePicker` 等回退；下载进度监听非 Tauri 返回空 `unlisten`；`fetchImageAsBlobUrl` 使用 `getPlatformFetch`；桌面相关 `invoke` 改为动态 `import` |
| `src/utils/tauri.ts` | `WebviewWindow` 等改为动态 `import`；非 Tauri 时 `onCreateWindow` 用 `window.open`，主题相关读 `localStorage`；`getAllWindows` 等无壳时返回空或提前返回 |
| `src/utils/cache.ts` | 非 Tauri 不查缓存大小、不清远端更新缓存 |
| `src/utils/updater.ts` | 非 Tauri：`checkVersion` 返回 `null`；`checkForUpdates` 提示「仅桌面客户端」并走 `onReset`；Tauri 侧对 `check` / `relaunch` 动态 `import` |

### 4.2 路由与 Hooks

| 文件 | 改动摘要 |
|------|-----------|
| `src/router/index.tsx` | 仅在 `isTauriRuntime()` 时动态 `import('@tauri-apps/api/event')` 并注册 `about`、`logout`；`getValue('theme')` 显式断言为 `'light' \| 'dark' \| undefined`；清理时用 `for...of` 满足 lint |
| `src/hooks/index.ts` | `useGetVersion`：非 Tauri 用 `import.meta.env.VITE_APP_VERSION ?? '浏览器预览'`；Tauri 下动态 `import('@tauri-apps/api/app').getVersion` |

### 4.3 类型与环境

| 文件 | 改动摘要 |
|------|-----------|
| `src/vite-env.d.ts` | 增加可选 `VITE_APP_VERSION`，供浏览器展示版本字符串 |

### 4.4 页面与组件

| 文件 | 改动摘要 |
|------|-----------|
| `src/views/knowledge/index.tsx` | 本地重复的 `isTauriRuntime` 删除，改为 `@/utils/runtime` |
| `src/views/setting/system/index.tsx` | 桌面命令封装为 `desktopInvoke` + `isTauriRuntime` 守卫；自启、选目录、快捷键等在浏览器 toast 提示 |
| `src/views/profile/index.tsx` | `greet` 非 Tauri 提示文案；`invoke` 动态导入 |
| `src/views/home/index.tsx` | `openUrl` 改为 `openExternalUrl` |
| `src/views/home/index copy.tsx` | 同上（备份页一致） |
| `src/views/about/index.tsx` | 同上 |
| `src/views/setting/about/index.tsx` | 同上；`查看更新内容` 使用 `openExternalUrl` |
| `src/components/design/ChatAssistantMessage/SearchOrganics.tsx` | 搜索结果外链使用 `openExternalUrl` |

### 4.5 未改但已兼容的说明

- `src/utils/knowledge-save.ts`：仍为动态 `import('@tauri-apps/api/core')`；知识库页在保存路径上已用 `isTauriRuntime` 分支，浏览器走 HTTP 接口。
- `src/views/coding/tauriSandpackClipboard.ts`：原有 `navigator.clipboard` 回退，与本次剪贴板策略一致。

---

## 5. 对外 API 与配置

### 5.1 从 `@/utils` 额外导出

- `isTauriRuntime`
- `openExternalUrl`

### 5.2 可选环境变量

- `VITE_APP_VERSION`：浏览器模式下「关于 / 版本」类 UI 的展示字符串（不设则使用默认「浏览器预览」）。

---

## 6. 验证方式

- **浏览器**：仓库根或 `apps/frontend` 执行 `pnpm dev`，访问 Vite 端口（如 `9002`），应能进入主流程，不因 store / 事件 / HTTP 崩溃。
- **Tauri**：照常 `tauri dev` 或打桌面包，行为应与改造前一致（仍使用插件与 `invoke`）。

---

## 7. 已知限制（浏览器端）

- 应用内更新、系统级缓存统计、本机目录选择、开机自启、全局快捷键注册等 **仅桌面端** 有意义；浏览器中会提示或不执行对应 IPC。
- 浏览器下设置持久化在 `localStorage`，与桌面端 `settings.json` **不互通**；若需统一需另行设计同步策略。

---

## 8. 文档信息

- **主题**：前端 Tauri / 浏览器双端兼容改造
- **涉及应用**：`apps/frontend`
- **关联代码入口**：`src/utils/runtime.ts`、`src/utils/store.ts`、`src/router/index.tsx`
