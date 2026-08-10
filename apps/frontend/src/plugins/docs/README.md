# 插件系统文档索引

本目录与 `apps/frontend/src/plugins/**` 源码同步维护。若与源码冲突，**以源码为准**。

| 文档 | 读者 | 内容 |
|------|------|------|
| [host-plugin-integration-guide.md](./host-plugin-integration-guide.md) | Host 开发者 | 三种接入模式、侧栏注入、HostBridge、**§11.3 刷新防闪 404**、**§15 应用级全屏 / pageShell**、**附录 B 样式隔离（`plugins/style-isolation/` · `mf-iso:3` 前缀 / Portal / Drawer 认领）**、**附录 B.1 overflow 与 backdrop-filter** |
| [plugin-development-guide.md](./plugin-development-guide.md) | 插件开发者 | Vite/组件/样式/API、**§4.3 Vue + registry `framework`**、**§5.2 expose 须 `import styles.css`**、**§16 `setAppFullscreen`**、验收清单；Portal / realm 由 Host 负责 |
| [mf-implementation-guide.md](./mf-implementation-guide.md) | 双方（实现细节） | 逐模块实现、**样式隔离 §2.10.2**（`plugins/style-isolation/` 分层：`protocol`/`css`/`sandbox`/`portal`；选择器前缀 `mf-iso:3`；`html/body→[realm][data-plugin-root]`；全屏 portal-scope + 打标；HMR 仅 vite-id；body remove 镜像·antd；CSSOM；Vue `useLayoutEffect`）、**§2.10.0 / §2.14 overflow 分层**、**entry bust（§2.13）**、**§2.11 防闪 404**、**§2.14 影院全屏** |

## 应用级全屏相关（已并入上述手册）

1. `host-api/appFullscreen.ts` → Bridge `api.ui.setAppFullscreen`（权限：`ui:toast`）
2. Layout 订阅影院态；Web Esc 同步退出
3. `PluginPageShell`；自动路由 `pageShell: true`；业务内嵌不加壳
4. 侧栏 `MENUS` / `PLUGINS` 拆分；Tauri fullscreen capability
5. **勿在圆角容器同层写 `overflow-hidden`**（Layout / `PluginPageShell`）：否则 Chromium 下子树 `backdrop-filter` 采不到更深的 video（独立预览正常、MF 嵌入失效）

## 样式隔离 / Portal（现行 `/*mf-iso:3*/`）

实现目录：[`apps/frontend/src/plugins/style-isolation/`](../style-isolation/)（已从巨石 `host/styleIsolation.ts` 按 **protocol / css / sandbox / portal** 分层；公开 API 不变）。

1. **选择器前缀**（取代整包 `@scope`）：`:root` → `[data-mf-style-realm]`；**`html`/`body` → `[realm][data-plugin-root]`**；其余 `[realm] .x,[realm].x`
2. 插件根须同时带 `data-mf-style-realm` + **`data-plugin-root`**（布局规则依赖后者）
3. `reclaimEntryStyles`：同 Remote 切换时按当前 realm 重写 head 已注入样式
4. 全屏 `[data-mf-portal-scope]`（`pointer-events:none`）+ 子节点可点 + **`stampRealmOnPortalNode`**
5. body `removeChild` / `replaceChild` 镜像：修 antd `getScrollBarSize` `NotFoundError`
6. Host Drawer：`claimPluginPortalTarget` / `clearPluginPortalClaim`；App 根 `data-mf-host-portal`
7. **HMR**：仅 `data-vite-dev-id` 换文重隔离；antd cssinjs 走 `insertRule`（勿对 textContent 互殴）
8. **Vue**：`PluginHostPage` / `createVueHostBridge` 用 **`useLayoutEffect`**；Remote `mount(el, bridge)` + `"framework": "vue"`
9. **Remote 样式入口**：每个 expose 须 `import '@/styles.css'`（及组件库 CSS）；Host 不执行 `main.ts`
10. 自检：`style-isolation/styleIsolation.smoke.ts`；barrel：`styleRealmKey` / claim / clear / `createVueHostBridge`
11. 分层速查：`protocol/`（realm 契约）→ `css/`（转译）→ `sandbox/`（捕获/HMR）→ `portal/`（认领/scope/body 劫持）；组合入口 `sandbox/attach.ts`

## 刷新子应用防闪 404（已并入上述手册）

1. 根因：`pluginManager.init()` 异步注入路由前，URL 命中顶层 `*` → NotFound
2. `pluginsReady` + `buildRoutes(false)` 用 `PluginRoutesPending` 占住 catch-all
3. init `finally` 置 ready 后恢复真 404；静态路由不受阻
4. 接入手册 §11.3；实现细节 §2.11 / FAQ 5.9
