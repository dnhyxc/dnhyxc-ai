# 04 · `createFederation()` 门面：全部配置项 + 返回值详解

> **本章目标**：`createFederation()` 是你项目里唯一创建 Host 的入口（≈ qiankun 的 `registerMicroApps` + `start` 的结合体）。把它的**每个配置项**和返回的 **`mf` 对象每个方法**讲透。
>
> 实现见 `packages/federation-kit/src/createFederation.ts`；本仓真实调用见 `apps/frontend/src/federation/runtime/index.ts`。
>
> **先给结论**：最简配置只需 `registryUrl`（或 `fetchRegistry`）一个字段，其余都有默认值。下面按「必配 → 常用 → 进阶」展开。

---

## 1. 最简调用（照抄即可跑通 MVP）

```ts
// 创建全局唯一的 Host 门面
// 语义：这个对象（mf）就是"你的项目与整个微前端系统的总指挥"——
// 启动、拉清单、注入路由、管理插件生命周期、导航、能力注入都经由它。
const mf = createFederation({
  // registryUrl：插件清单地址（kit 会自己 fetch + localStorage 缓存）。
  // 语义：只要给这一个字段，enabledStore（默认 localStorage）、fetchRegistry、缓存键全部自动生成。
  registryUrl: '/remotes/plugins-registry.json',
});

// 启动：拉 registry、挂路由/侧栏壳（异步，须 await 或用 finally 处理）
await mf.start();

// 把宿主 SPA 导航回写：插件调用 api.navigate 时，实际由它执行
mf.setNavigate((to) => router.navigate(to));

// 订阅动态路由变化：插件上架/下架导致路由表变了，回调里重建 router
mf.onRoutesChange(() => remountRouter());
```

> **语义关键**：`createFederation` 默认把实例设为「全局默认单例」（`asDefault: true`），因此页面里的 `<FederationPlugin />` / `<Plugin />` **不需要** Provider 就能找到这个 mf。多个 Host 实例时用 `FederationProvider` 显式注入。

---

## 2. `CreateFederationOptions` 全部配置项

类型定义（`packages/federation-kit/src/createFederation.ts`）：

```ts
export type CreateFederationOptions<TRoute extends { path?: string } = { path?: string }> = {
  // ═══ 数据来源（二选一，缺省则空清单）═══════════════════════════
  /** 最简接入：registry JSON 地址（kit 自行 fetch + 缓存） */
  registryUrl?: string;
  /** 自定义拉取函数：返回 Promise<PluginRegistry>；更灵活（接 COS/接口/鉴权头） */
  fetchRegistry?: PluginHostConfig['fetchRegistry'];

  // ═══ 宿主标识与运行环境 ═══════════════════════════════════════
  /** 宿主 API 契约版本；与插件 hostApiRange 比对（缺省 '1.0.0'） */
  hostApiVersion?: string;
  /** 是否生产环境；影响 entry http 准入（缺省看 process.env.NODE_ENV） */
  prod?: boolean;
  /** 是否跳过插件 integrity 完整性校验（缺省 true，生产可打开） */
  skipIntegrity?: boolean;

  // ═══ 本地存储 ═════════════════════════════════════════════════
  /** localStorage 键前缀（缺省 'mf.plugin'） */
  storagePrefix?: string;
  /** registry 缓存 localStorage 键（缺省 `${storagePrefix}.registry.v1`） */
  registryCacheKey?: string;

  // ═══ iframe 通信 ══════════════════════════════════════════════
  /** untrusted 插件 iframe postMessage 的 channel 名（缺省 'mf-iframe'） */
  iframeChannel?: string;

  // ═══ 上架偏好 ═════════════════════════════════════════════════
  /** 上架偏好存取器（缺省 localStorage） */
  enabledStore?: EnabledStore;
  /** 上架/下架后的写回函数（返回最新 registry） */
  persistEnabled?: PluginHostConfig['persistEnabled'];

  // ═══ 能力注入 ═════════════════════════════════════════════════
  /** 覆盖默认 capabilities；未给的字段用内置默认（getTheme/getLocale/navigate） */
  capabilities?: Partial<HostCapabilities>;

  // ═══ 样式隔离 ═════════════════════════════════════════════════
  styleIsolation?: StyleIsolationConfig;

  // ═══ 扩展能力 ═════════════════════════════════════════════════
  /** 扩展 iframe RPC（在内置 http/ui 之后追加） */
  iframeRpcHandlers?: PluginHostConfig['iframeRpcHandlers'];
  /** 翻译函数（插件校验错误信息用；缺省输出原文） */
  translate?: PluginHostConfig['translate'];
  /** 插件元数据 → 路由配置 的工厂函数（TRoute 泛型由你的路由类型决定） */
  createRoute?: PluginRouteFactory<TRoute>;
  /** 路由页壳组件（与 createRoute 二选一；提供了 createRoute 则优先） */
  HostPage?: ComponentType<{ pluginId: string; pageShell?: boolean }>;
  /** 自定义路由注入器（一般不用传） */
  routeInjector?: RouteInjector<TRoute>;
  /** 设为全局默认单例，供 <Plugin /> 无 Context 使用（缺省 true） */
  asDefault?: boolean;
};
```

### 2.1 `registryUrl` / `fetchRegistry`（数据来源）

| 选项 | 说明 | 适用 |
|------|------|------|
| `registryUrl` | 一个字符串地址；kit 内部用 `fetch` 拉取，失败回退缓存 | 最简、清单是静态文件 |
| `fetchRegistry` | 函数 `(opts?: { force?: boolean }) => Promise<PluginRegistry>` | 清单要鉴权 / 走已有 http 客户端 / 动态生成 |

**本仓两者都用过**：最简演示用 `registryUrl`；真实项目用 `fetchRegistry: fetchPluginRegistry`（本仓自定义实现，接 COS + 平台 fetch + 缓存，见 [08](./08-enabled-registry-impl.md)）。

### 2.2 `capabilities`（能力注入，核心之一）

`capabilities` 是「宿主能力钱包」的源头，`createHostBridge` 会按插件的 `permissions` 从里面裁剪出 bridge。类型见 `packages/federation-kit/src/config/types.ts`：

```ts
export interface HostCapabilities {
  // 读当前主题（'light' | 'dark'）；内置默认会读 DOM data-theme/class
  getTheme: () => HostTheme;
  // 读当前 locale（'zh-CN' | 'en-US'）；内置默认返回 'zh-CN'
  getLocale: () => HostLocale;
  // 导航函数：插件 navigate 的底层实现；内置默认 window.location.assign
  navigate: (to: string) => void;
  // Toast 能力（对应权限 ui:toast）
  toast?: (options: { message: string; type?: 'success' | 'error' | 'info' }) => void;
  // http 客户端（对应权限 http:plugin-api）
  http?: HostHttpClient;
  // 统一下载（对应权限 ui:toast；Web/Tauri 都走它）
  downloadBlob?: (options: { fileName: string; data: ArrayBuffer | Uint8Array; mimeType?: string; pluginId: string }) => Promise<{ ok: boolean; hostToasted: boolean; message?: string }>;
  // 应用级全屏（对应权限 ui:toast）
  setAppFullscreen?: (full: boolean) => Promise<void>;
  // 业务模块直接注入（对应权限 modules:xxx；按简单键匹配）
  modules?: Record<string, unknown>;
  // 业务模块装配器（优先于 modules）：permissions 传进来，按需返回模块
  buildModules?: (permissions: ReadonlySet<string>) => Record<string, unknown> | undefined;
  // 监听宿主 locale 变化（返回取消订阅）；供插件热同步语言
  onLocaleChange?: (handler: (locale: HostLocale) => void) => () => void;
}
```

> **语义重点**：`capabilities` 里**没给**的字段就用内置默认（只有 `getTheme` / `getLocale` / `navigate` 有默认，其余是可选的「能力增强」）。你的项目一定要注入 `toast`（否则插件调 `showToast` 没反应）和 `http`（否则 `http:plugin-api` 权限无效）。

### 2.3 `enabledStore`（上架偏好）

```ts
export interface EnabledStore {
  // 同步判断某插件是否上架（宿主启动/挂载前都会调）
  get: (pluginId: string) => boolean;
  // 写回上架状态（可选；缺省 setEnabled 走 persistEnabled）
  set?: (pluginId: string, enabled: boolean) => Promise<void> | void;
  // 订阅偏好变化（可选）
  subscribe?: (fn: () => void) => () => void;
  // 异步加载偏好（可选；账号场景用于登录后拉取）
  load?: () => Promise<void>;
  // 偏好是否已就绪（可选；缺省 true）。未就绪时 get 的 false 不会被当成"已下架"
  isReady?: () => boolean;
}
```

缺省实现：`localStorage` 存 `{ [storagePrefix].enabled.v1: { [id]: true } }`。本仓把它换成账号服务（[08](./08-enabled-registry-impl.md)）。

### 2.4 `styleIsolation` / `iframeRpcHandlers` / `translate`

```ts
// 样式隔离配置（缺省即可）
styleIsolation?: {
  // 覆盖默认 Host 主题 CSS 变量剥离正则
  themePropPattern?: RegExp;
  // Vite 开发态 Host 源码根标记（HMR 时区分宿主/插件样式，缺省 '/apps/frontend'）
  hostViteRootMarker?: string;
};

// 扩展 iframe RPC：key 是方法名，value 处理函数；内置 http/ui 之后执行
iframeRpcHandlers?: Record<
  string,
  (bridge: HostBridgeProps, args: unknown[]) => unknown | Promise<unknown>
>;

// 校验错误信息翻译（key + params → 本地化文案）
translate?: (key: string, params?: Record<string, string>) => string;
```

### 2.5 `createRoute` / `HostPage`（动态路由工厂）

`createRoute` 决定：**一条插件 registry 记录 → 一条路由配置**。本仓用 React Router，所以返回 `RouteConfig`：

```ts
// 创建"插件路由工厂"：把插件元数据变成一个 React Router 配置
// 语义：path 用 registry.routePath；Component 渲染宿主的路由页壳（PluginHostPage + pageShell）
function createPluginRoute(meta: PluginDescriptor): RouteConfig {
  // 构造一个匿名组件：它委托给已注册的 PluginHostPage 渲染对应插件
  const Page: ComponentType = () => {
    // 若 PluginHostPage 还没被 import（模块未加载），抛错提示
    if (!hostPage) throw new Error('PluginHostPage not registered');
    // 渲染路由壳：pluginId = 插件 id，pageShell = true 表示"独立路由页"（带统一边距）
    return createElement(hostPage, { pluginId: meta.id, pageShell: true });
  };
  // 组装成路由：path 来自清单，meta 里带上多语言标题
  return {
    path: meta.routePath,
    Component: Page,
    meta: { titleI18n: meta.title, title: meta.id },
  };
}
```

> **如果你不用 React Router**，自己实现一个 `createRoute`（或 `HostPage`）把 `PluginDescriptor` 映射到你的路由体系即可——kit 只负责调用它并注入 `routeInjector`。

---

## 3. 返回值 `FederationHost`（`mf` 对象）每个方法

```ts
export type FederationHost<TRoute extends { path?: string } = { path?: string }> = {
  // 启动：拉 registry、灌偏好、挂路由/侧栏壳（≈ qiankun start）。返回 Promise
  start: () => Promise<void>;
  // 底层运行时（含 config、hostApiVersion、init 等）
  runtime: PluginRuntime<TRoute>;
  // 插件管理器：ensurePlugin / list / get / setEnabled / loadPlugin 等生命周期
  manager: PluginManager<TRoute>;
  // 路由注入器：订阅/读取动态路由
  routeInjector: RouteInjector<TRoute>;
  // 侧栏注入器：订阅/读取动态侧栏项
  sidebarInjector: SidebarInjector;
  // 回写宿主导航：插件 navigate 时调用 fn(to)
  setNavigate: (fn: (to: string) => void) => void;
  // 订阅路由变化：fn 在路由注入/移除时触发（返回取消订阅函数）
  onRoutesChange: (fn: () => void) => () => void;
  // 获取 iframe bridge 配置（channel / locale / RPC），给 untrusted 插件用
  getIframeBridgeOptions: () => {
    channel?: string;
    getLocale: () => HostLocale | string;
    onLocaleChange?: (handler: (locale: HostLocale) => void) => () => void;
    extraRpc?: Record<string, (bridge, args) => unknown | Promise<unknown>>;
  };
  // 完整配置（调试/进阶用）
  config: PluginHostConfig;
};
```

### 3.1 `manager`（PluginManager）常用方法速查

| 方法 | 语义 | 示例 |
|------|------|------|
| `ensurePlugin(id, opts?)` | 确保插件加载完成（会先拉 registry、校验、按需 loadRemoteApp）；已激活且 bust 相同则复用 | `await mf.manager.ensurePlugin('learningNotes')` |
| `loadPlugin(meta, opts?)` | 加载单个插件（低层） | — |
| `unloadPlugin(id)` | 卸载：调 deactivate、清事件、摘路由/侧栏 | — |
| `setEnabled(id, enabled)` | 上架/下架：写回偏好 + 挂/卸壳 | `await mf.manager.setEnabled('x', false)` |
| `get(id)` | 取 `LoadedPlugin`（含 status/bridge/mod/bust） | `mf.manager.get('x')?.status` |
| `list()` | 所有已加载插件 | — |
| `setNavigate(fn)` | 同 mf.setNavigate | — |

### 3.2 `routeInjector` / `sidebarInjector`

```ts
// 读取当前所有动态插件路由（router 构建时调用）
routeInjector.getRoutes(): TRoute[];

// 订阅路由变化（router 重建时调用）
routeInjector.subscribe(fn): () => void;

// 读取当前所有动态侧栏项
sidebarInjector.items: PluginSidebarItem[];

// 订阅侧栏变化（Sidebar 组件重渲染）
sidebarInjector.subscribe(fn): () => void;
```

### 3.3 `onRoutesChange`（驱动 router 重建）

```ts
// 在 App 组件里：订阅动态路由变化 → 递增 epoch → 重新 buildRoutes 并重建 router
const unsub = mf.onRoutesChange(() => {
  setRouteEpoch((n) => n + 1);
});
// 组件卸载时取消订阅
return unsub;
```

> 为什么需要重建 router？React Router 的路由表是构建期的；插件路由是运行期注入的。宿主通过「epoch 递增 → `useMemo` 重建 `createBrowserRouter`」把动态路由并入路由表。详见 [05](./05-start-router-injection.md)。

---

## 4. 本仓真实完整调用（逐行注释）

`apps/frontend/src/federation/runtime/index.ts` 的核心（去掉与本指南无关的 import）：

```ts
/**
 * 本仓微前端门面：基于 createFederation（主流 start + <Plugin />）。
 * 产品差异（Toast / COS / ebook / 偏好）集中在此文件。
 */
import {
  createFederation,
  DEFAULT_HOST_THEME_CUSTOM_PROP,
  type HostHttpClient,
  type PluginDescriptor,
} from '@dnhyxc-ai/federation-kit';
import { Toast } from '@ui/sonner';
import { type ComponentType, createElement } from 'react';
import { getActiveLocale, type Locale, translateSync } from '@/i18n';
import type { RouteConfig } from '@/router/routes';
import { downloadBlob, isTauriRuntime, onListen } from '@/utils';
import { http } from '@/utils/fetch';
import { setAppFullscreen } from '../capabilities/appFullscreen';
import { createEbookModulesApi } from '../capabilities/ebookHostApi';
import {
  arePluginEnabledPrefsReady,
  ensurePluginEnabledPrefsLoaded,
  getPluginEnabledPref,
  setPluginEnabledPref,
} from '../enabled/prefs';
import {
  fetchPluginRegistry,
  PLUGIN_REGISTRY_CACHE_KEY,
  persistPluginEnabled,
} from '../registry';

// docx 默认 MIME（插件下载兜底）
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// 从 DOM 读当前主题：data-theme 优先，其次 class
function readTheme(): 'light' | 'dark' {
  try {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    if (document.documentElement.classList.contains('dark')) return 'dark';
    if (document.body.classList.contains('dark') || document.body.classList.contains('theme-black')) return 'dark';
  } catch { /* ignore */ }
  return 'light';
}

// 映射到 HostLocale（宿主只同步枚举，不传翻译串）
function readLocale(): 'zh-CN' | 'en-US' {
  return getActiveLocale() === 'en-US' ? 'en-US' : 'zh-CN';
}

// 路由工厂持有的路由页组件（由 PluginHostPage 模块加载时自注册，避免循环依赖）
let hostPage: ComponentType<{ pluginId: string; pageShell?: boolean }> | null = null;

// 供 PluginHostPage 在模块加载时自注册
export function registerPluginHostPage(page: ComponentType<{ pluginId: string; pageShell?: boolean }>) {
  hostPage = page;
}

// 把 registry 元数据变成 React Router 配置（详见本章 2.5）
function createPluginRoute(meta: PluginDescriptor): RouteConfig {
  const Page: ComponentType = () => {
    if (!hostPage) throw new Error('PluginHostPage not registered');
    return createElement(hostPage, { pluginId: meta.id, pageShell: true });
  };
  return {
    path: meta.routePath,
    Component: Page,
    meta: { titleI18n: meta.title, title: meta.id },
  };
}

/** 全局 MF Host（asDefault，供 <Plugin /> / FederationPlugin 使用） */
export const mf = createFederation<RouteConfig>({
  // 宿主 API 契约版本（与 registry hostApiRange 比对）
  hostApiVersion: import.meta.env.VITE_HOST_API_VERSION?.trim() || '1.0.0',
  // 生产标记：影响 entry https 准入
  prod: import.meta.env.PROD,
  // 默认跳过完整性校验（可用 env 打开严格模式）
  skipIntegrity: import.meta.env.VITE_PLUGIN_SKIP_INTEGRITY !== 'false',
  // localStorage 前缀
  storagePrefix: 'dnhyxc.plugin',
  // registry 缓存键（本仓自定义，区分 dev/prod）
  registryCacheKey: PLUGIN_REGISTRY_CACHE_KEY,
  // iframe 通信 channel 名
  iframeChannel: 'dnhyxc-mf-iframe',
  // 自定义拉取（COS/平台 fetch/缓存）
  fetchRegistry: fetchPluginRegistry,
  // 上架写回（账号服务）
  persistEnabled: persistPluginEnabled,
  // 上架偏好：账号服务适配
  enabledStore: {
    get: getPluginEnabledPref,
    set: setPluginEnabledPref,
    load: ensurePluginEnabledPrefsLoaded,
    isReady: arePluginEnabledPrefsReady,
  },
  // 样式隔离：主题变量 + 宿主 Vite 根标记
  styleIsolation: {
    themePropPattern: DEFAULT_HOST_THEME_CUSTOM_PROP,
    hostViteRootMarker: '/apps/frontend',
  },
  // 校验错误翻译
  translate: (key, params) => translateSync(key, params as Record<string, string>),
  // 动态路由工厂
  createRoute: createPluginRoute,
  // 产品能力注入
  capabilities: {
    getTheme: readTheme,
    getLocale: readLocale,
    navigate: (to) => window.location.assign(to),
    toast: (options) => {
      Toast({ type: options.type ?? 'info', title: options.message });
    },
    http: {
      get: ((url: string) => http.get(url)) as HostHttpClient['get'],
      post: ((url: string, body?: unknown) => http.post(url, body)) as HostHttpClient['post'],
      put: ((url: string, body?: unknown) => http.put(url, body)) as HostHttpClient['put'],
      delete: ((url: string) => http.delete(url)) as HostHttpClient['delete'],
    },
    setAppFullscreen,
    downloadBlob: async (options) => {
      const mime = options.mimeType?.trim() || DOCX_MIME;
      const raw = options.data;
      const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw);
      const blob = new Blob([bytes], { type: mime });
      const result = await downloadBlob(
        { file_name: options.fileName || 'download', id: `plugin-${options.pluginId}-${Date.now()}`, overwrite: true },
        blob,
      );
      const hostToasted = isTauriRuntime();
      if (result.success !== 'success') {
        return { ok: false as const, hostToasted, message: result.message || '下载失败' };
      }
      return { ok: true as const, hostToasted };
    },
    buildModules: (allow) => {
      const modules: Record<string, unknown> = {};
      if (allow.has('modules:chat')) {
        modules.openThread = (id: unknown) => {
          if (typeof id !== 'string') throw new Error('INVALID_THREAD_ID');
          window.location.assign(`/chat/c/${id}`);
        };
      }
      if (allow.has('modules:ebook')) {
        modules.ebook = createEbookModulesApi();
      }
      return Object.keys(modules).length > 0 ? modules : undefined;
    },
    onLocaleChange: (handler) => {
      let unlisten: (() => void) | undefined;
      void onListen<Locale>('locale', (next) => {
        if (next === 'zh-CN' || next === 'en-US') handler(next);
      }).then((fn) => {
        unlisten = fn;
      });
      return () => unlisten?.();
    },
  },
  // 扩展 iframe RPC：ebook 能力转发到 bridge.api.modules.ebook
  iframeRpcHandlers: {
    'ebook.getBookId': (bridge) => {
      const ebook = bridge.api.modules?.ebook as { getBookId: () => string | null } | undefined;
      return ebook?.getBookId() ?? null;
    },
    'ebook.navigateToCfi': async (bridge, args) => {
      const ebook = bridge.api.modules?.ebook as { navigateToCfi: (cfi: string) => void | Promise<void> } | undefined;
      await ebook?.navigateToCfi(String(args[0] ?? ''));
      return null;
    },
  },
});

// 便捷别名：业务侧从 @/federation 导入这些
export const pluginManager = mf.manager;
export const routeInjector = mf.routeInjector;
export const sidebarInjector = mf.sidebarInjector;
export const HOST_API_VERSION = mf.runtime.hostApiVersion;
export const appRuntime = mf.runtime;

// 取 iframe bridge 选项（untrusted 插件渲染时使用）
export const getAppIframeBridgeOptions = () => mf.getIframeBridgeOptions();

/** @deprecated 用 mf.start() */
export const startFederation = () => mf.start();
```

### 4.1 这段代码的「意图」解读

1. **它是一切的汇聚点**：Toast、http、i18n、全屏、下载、ebook 模块全部在这里注入成 `capabilities`。改任何一个产品能力，只动这一个文件。
2. **它定义了路由工厂**：`createRoute` 让插件自动拥有一个「独立路由页」，页面组件由 `PluginHostPage` 提供（延迟注册避免循环依赖）。
3. **它适配了账号偏好**：`enabledStore` 把「上架」从 localStorage 换成了账号服务，登录/登出即同步。
4. **它开启了扩展通道**：`iframeRpcHandlers` 让 untrusted 插件也能调用 ebook 能力（经 postMessage → 转 bridge.api.modules.ebook）。

---

## 5. 本仓还导出的适配层常用符号

业务侧统一从 `@/federation` 导入（`apps/frontend/src/federation/index.ts` 再导出）：

```ts
// 本仓适配层统一出口（摘录）
export { mf, pluginManager, routeInjector, sidebarInjector } from './runtime';
export { PluginHostPage } from './host/PluginHostPage';
export { PluginHostSurface } from './host/PluginHostSurface';
export { PluginErrorBoundary } from './host/PluginErrorBoundary';
export { PluginPageShell } from './host/PluginPageShell';
export { fetchPluginRegistry, savePluginRegistry, clearPluginRegistryCache } from './registry';
export { usePluginEnabled, usePluginEnabledState } from '@dnhyxc-ai/federation-kit/react';
// ... 还有 enabled/prefs、capabilities 等
```

> 这就是「适配层」存在的意义：业务代码永远 import `@/federation`，未来升级 kit 时只有 `runtime/index.ts` 需要动。

> 下一步：[05-start-router-injection.md](./05-start-router-injection.md) 启动 + 动态路由注入 + 防闪 404 + 侧栏。
