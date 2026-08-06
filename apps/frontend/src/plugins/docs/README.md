# 插件系统文档索引

本目录与 `apps/frontend/src/plugins/**` 源码同步维护。若与源码冲突，**以源码为准**。

| 文档 | 读者 | 内容 |
|------|------|------|
| [host-plugin-integration-guide.md](./host-plugin-integration-guide.md) | Host 开发者 | 三种接入模式、侧栏注入、HostBridge、**§11.3 刷新防闪 404**、**§15 应用级全屏 / pageShell** |
| [plugin-development-guide.md](./plugin-development-guide.md) | 插件开发者 | Vite/组件/样式/API、**§16 `setAppFullscreen`**、验收清单 |
| [mf-implementation-guide.md](./mf-implementation-guide.md) | 双方（实现细节） | 逐模块实现、样式隔离、bust、**§2.11 路由构建与防闪 404**、**§2.14 应用级全屏源码** |

## 应用级全屏相关（已并入上述手册）

1. `host-api/appFullscreen.ts` → Bridge `api.ui.setAppFullscreen`（权限：`ui:toast`）
2. Layout 订阅影院态；Web Esc 同步退出
3. `PluginPageShell`；自动路由 `pageShell: true`；业务内嵌不加壳
4. 侧栏 `MENUS` / `PLUGINS` 拆分；Tauri fullscreen capability

## 刷新子应用防闪 404（已并入上述手册）

1. 根因：`pluginManager.init()` 异步注入路由前，URL 命中顶层 `*` → NotFound
2. `pluginsReady` + `buildRoutes(false)` 用 `PluginRoutesPending` 占住 catch-all
3. init `finally` 置 ready 后恢复真 404；静态路由不受阻
4. 接入手册 §11.3；实现细节 §2.11 / FAQ 5.9
