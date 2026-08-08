# 插件系统文档索引

本目录与 `apps/frontend/src/plugins/**` 源码同步维护。若与源码冲突，**以源码为准**。

| 文档 | 读者 | 内容 |
|------|------|------|
| [host-plugin-integration-guide.md](./host-plugin-integration-guide.md) | Host 开发者 | 三种接入模式、侧栏注入、HostBridge、**§11.3 刷新防闪 404**、**§15 应用级全屏 / pageShell**、**附录 B 样式隔离（realm / Portal / Drawer 认领）**、**附录 B.1 overflow 与 backdrop-filter** |
| [plugin-development-guide.md](./plugin-development-guide.md) | 插件开发者 | Vite/组件/样式/API、**§4.3 Vue + registry `framework`**、**§5.2 expose 须 `import styles.css`**、**§16 `setAppFullscreen`**、验收清单；Portal / realm 由 Host 负责 |
| [mf-implementation-guide.md](./mf-implementation-guide.md) | 双方（实现细节） | 逐模块实现、**样式隔离 §2.10.2**（realm / Portal·Teleport / body remove 镜像·antd / transpile·CSSOM / sonner / reclaim；专题见 `docs/app/style-isolation-qiankun-harden.md`）、**§2.10.0 / §2.14 overflow 分层与 backdrop-filter**、**entry bust（§2.13）**、**§2.11 防闪 404**、**§2.14 影院全屏** |

## 应用级全屏相关（已并入上述手册）

1. `host-api/appFullscreen.ts` → Bridge `api.ui.setAppFullscreen`（权限：`ui:toast`）
2. Layout 订阅影院态；Web Esc 同步退出
3. `PluginPageShell`；自动路由 `pageShell: true`；业务内嵌不加壳
4. 侧栏 `MENUS` / `PLUGINS` 拆分；Tauri fullscreen capability
5. **勿在圆角容器同层写 `overflow-hidden`**（Layout / `PluginPageShell`）：否则 Chromium 下子树 `backdrop-filter` 采不到更深的 video（独立预览正常、MF 嵌入失效）

## 样式隔离 / Portal（已并入上述手册）

1. `@scope([data-mf-style-realm])`：按 Remote entry 域，同仓多 expose 共享一份 CSS
2. `reclaimEntryStyles`：切换同 Remote 插件时重包 head 已注入样式
3. 劫持 `react-dom.createPortal` **与** body 原型挂载 → `[data-mf-portal-scope]`（同 realm；覆盖 Vue Teleport）
4. body `removeChild` / `replaceChild` 镜像：antd `getScrollBarSize` 等「`body.append` → `body.remove`」在 append 被重定向后仍能从实际父节点卸载（避免 `NotFoundError`）
5. Host Drawer：`claimPluginPortalTarget` / `clearPluginPortalClaim`；App 根 `data-mf-host-portal` + Toaster children 识别保护 Host `<Toaster />`
6. qiankun 级转译：`transpileStyleText` / CSSOM `insertRule`；`captureStack`；详解 [`docs/app/style-isolation-qiankun-harden.md`](../../../../docs/app/style-isolation-qiankun-harden.md)
7. **Vue 子应用**：Host `createVueHostBridge` + `normalizePluginModule`；**registry 必写 `"framework": "vue"`**；Remote 只导出 Vue 根（勿自建 React 桥）
8. **Remote 样式入口**：每个 MF expose 须 `import '@/styles.css'`（Host 不执行 `main.ts`）；详见开发手册 §5.2
9. barrel 导出：`styleRealmKey` / claim / clear / `createVueHostBridge`（`@/plugins`）

## 刷新子应用防闪 404（已并入上述手册）

1. 根因：`pluginManager.init()` 异步注入路由前，URL 命中顶层 `*` → NotFound
2. `pluginsReady` + `buildRoutes(false)` 用 `PluginRoutesPending` 占住 catch-all
3. init `finally` 置 ready 后恢复真 404；静态路由不受阻
4. 接入手册 §11.3；实现细节 §2.11 / FAQ 5.9
