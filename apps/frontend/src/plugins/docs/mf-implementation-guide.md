# Module Federation 动态插件实现指南

> **文档角色**：详细的实现过程文档，包含主项目具体实现方式和子项目/插件接入方式，代码含逐行注释。
> **适用读者**：主项目开发者、插件/子项目开发者。
> **同步说明**：已对齐最新 HostBridge（`api.locale`，无 `api.t`）、PluginHostPage locale 热更新、iframe `locale` 消息、**Host `@scope` 样式隔离完整方案（§2.10.2：原理 / 时序 / `styleIsolation.ts` 全文注释 / 接入点；dev 认领排除 Host；`data-mf-style-realm` 多 expose；`createPortal` + body 挂载收编 Vue Teleport；body `removeChild`/`replaceChild` 镜像修 antd `getScrollBarSize`；qiankun 式 transpile / CSSOM `insertRule` / `captureStack`；Drawer `claimPluginPortalTarget`；sonner 防误包；详解 `docs/app/style-isolation-qiankun-harden.md`；`@/plugins` 导出 realm/claim）**；**Layout / `PluginPageShell`：overflow 与 `border-radius` 分层，避免废掉路由页内 `backdrop-filter`（§2.10.0 / §2.14）**；Registry `title`/`description` locale map；**Host 勿 shared `react-router`**；entry bust 用 **`version@manifestHash`**（`fetchManifestMeta` / `fetchEntryBuildId` + `resolvePluginBust`，**不依赖**改 registry `updatedAt`）——**进入插件只 GET 一次 `mf-manifest.json`**（指纹 + 解析 `remoteEntry`），`registerRemote` 直连 `remoteEntry.js?v=`，`afterResolve` 兜底补 `?v=`；`ensurePlugin` 按 bust 判断重载；保存 registry 校验 `hostApiRange`；remotes 静态 `no-store`；**`api.ui.setAppFullscreen` + `PluginPageShell` / `pageShell`（§2.7 / §2.10 / §2.14）**；**刷新插件路由防闪 404（`pluginsReady` + catch-all 占位，§2.11）**；App 根 **`data-mf-host-portal`**。若与源码不一致，以源码为准。

---

## 目录

1. [概述](#1-概述)
2. [主项目实现](#2-主项目实现)
   - 2.1 Vite 配置
   - 2.2 MF 核心运行时 (`mf.ts`)
   - 2.3 插件类型定义 (`types.ts`)
   - 2.4 插件管理器 (`PluginManager.ts`)
   - 2.5 路由注入器 (`RouteInjector.ts`)
   - 2.6 侧栏注入器 (`SidebarInjector.ts`)
   - 2.7 Host Bridge (`createHostBridge.ts`)
   - 2.8 插件验证器 (`PluginVerifier.ts`)
   - 2.9 Registry 管理 (`registry.ts`)
   - 2.10 插件宿主页面 (`PluginHostPage.tsx`)
   - 2.10.0 独立路由外壳 (`PluginPageShell.tsx`；**勿圆角同层 overflow-hidden**)
   - 2.10.1 错误边界
   - **2.10.2 主子样式隔离（原理与完整实现）**（realm / Portal·Teleport / body remove 镜像·antd getScrollBarSize / transpile·CSSOM / sonner / reclaim / Drawer 认领）
   - **2.11 路由构建与初始化**（含刷新子应用防闪 404；`data-mf-host-portal`）
   - 2.12 语言（locale）同步
   - **2.13 插件/子应用加载缓存破坏（完整方案）**
   - **2.14 应用级全屏（影院态）**（含 Layout overflow 分层）
3. [子项目/插件接入](#3-子项目插件接入)
   - 3.1 Vite 配置
   - 3.2 组件实现规范
   - **3.3 全局样式处理（Remote 侧约定）**
   - 3.4 多插件共享 Remote
   - 3.5 不安全插件（untrusted）接入
   - 3.6 CORS 配置
   - 3.7 Registry 配置示例
4. [完整数据流](#4-完整数据流)
5. [常见问题与解决方案](#5-常见问题与解决方案)
   - 5.7 样式隔离相关（含 Portal / antd getScrollBarSize / sonner / **backdrop-filter**）
   - **5.9 刷新子应用先闪 404**

---

## 1. 概述

本项目采用 **@module-federation/vite** + **@module-federation/enhanced/runtime** 实现动态插件系统，核心特点：

- **运行时动态注册**：通过 `registerRemotes` 在运行时注册远程模块，无需预配置
- **懒加载策略**：插件默认懒加载，首次进入页面时才执行 `loadRemote`
- **共享 React 单例**：Host 和 Remote 共享同一个 React 实例，避免双 React 问题
- **安全验证**：包含信任等级、origin 白名单、hostApi 版本检查、可选 integrity 校验
- **幂等注入**：路由和侧栏注入支持幂等，避免重复注入导致闪烁
- **刷新防闪 404**：`pluginsReady` + catch-all 占位（§2.11）；静态路由仍可首屏匹配
- **失败重试**：失败态稳定，仅手动触发重试，避免自动死循环
- **语言同步**：Host 只推送 `locale`（`zh-CN` | `en-US`）；插件自维护文案字典
- **Registry 文案解耦**：插件中心标题/说明与注入路由面包屑读 registry 的 `title`/`description` locale map，改名不必改 Host 语言包
- **样式隔离**：Host 运行时 `@scope([data-mf-style-realm])` + transpile/CSSOM + head 劫持 + MutationObserver + Portal/`Teleport` 收编（含 body `removeChild`/`replaceChild` 镜像）+ antd Modal/Drawer 兼容（详解 §2.10.2 / `docs/app/style-isolation-qiankun-harden.md`）；`untrusted` 走 iframe
- **entry 缓存破坏**：`pluginBust = version@manifestHash`（指纹来自 Remote 自有 `mf-manifest`；发布者勿改 Host registry）；`resolvePluginBust` **只拉一次** manifest（算指纹并解析 `remoteEntry`），`registerRemote` **直连** `remoteEntry.js?v=`，`afterResolve` 再兜底补 `?v=`（WKWebView 固定名 ESM 强缓存）
- **Host shared**：只 shared `react` / `react-dom`；**不要** shared `react-router`（生产易双 Router，`useLocation` 白屏）
- **应用级全屏**：`api.ui.setAppFullscreen`（`ui:toast`）驱动 Layout 影院态 + Tauri/Web 系统全屏；独立路由页 `pageShell` → `PluginPageShell`（§2.14）
- **MF 内 backdrop-filter**：Layout / `PluginPageShell` 将 `overflow-hidden` 与 `border-radius` 分层，避免 Chromium 裁切导致毛玻璃采不到更深 video（§2.10.0 / §2.14.4）

---

## 2. 主项目实现

### 2.1 Vite 配置

**文件路径**：`apps/frontend/vite.config.ts`

```typescript
// 引入 Module Federation Vite 插件
import { federation } from "@module-federation/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import {
	clearMfViteDepCachePlugin,
	copyPdfjsAssetsPlugin,
	removeDistMinMapsPlugin,
} from "./plugins";

// 定义需要排除优化的依赖（避免 React 被预打包写入 virtual:mf）
const MF_SHARED_EXCLUDE = [
	"react", // React 核心库
	"react/jsx-runtime", // JSX 运行时
	"react/jsx-dev-runtime", // 开发环境 JSX 运行时
	"react-dom", // React DOM
	"react-dom/client", // React DOM 客户端入口
];

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	return {
		plugins: [
			// 关键：启动时清空 .vite/deps 缓存，避免 mf_owner 漂移导致解析失败
			clearMfViteDepCachePlugin(),
			react(),
			tailwindcss(),
			copyPdfjsAssetsPlugin(),
			removeDistMinMapsPlugin(),
			// Module Federation 核心配置
			federation({
				name: "host", // Host 名称，必须唯一
				filename: "remoteEntry.js", // Remote Entry 文件名
				remotes: {}, // 动态注册，初始为空
				shared: {
					// 共享依赖配置
					react: {
						// React 共享
						singleton: true, // 单例模式，确保只有一个 React 实例
						requiredVersion: "^19.1.0", // 要求版本范围
					},
					"react-dom": {
						// React DOM 共享
						singleton: true,
						requiredVersion: "^19.1.0",
					},
					// 勿 shared react-router：生产 loadShare 易与 react-router/dom 拆成双实例，
					// 导致 useLocation 找不到 Router context（线上 /plugins 白屏）。Remote 也未共享它。
					// 仍用 resolve.dedupe 收敛 react-router 单实例。
				},
				// 关键：避免默认 html 注入把任意 ts 打成无 export bootstrap
				hostInitInjectLocation: "entry",
				dts: false, // 关闭类型生成（Ctrl+C 后 IPC 易残留）
				dev: {
					remoteHmr: true, // 开发环境支持 Remote HMR
				},
			}),
		],
		resolve: {
			alias: {
				"@": "/src",
				"@ui": "/src/components/ui",
				"@design": "/src/components/design",
			},
			dedupe: ["react", "react-dom", "react-router"], // 去重（含 router，但不进 MF shared）
		},
		optimizeDeps: {
			// 禁止把 shared 依赖打进 .vite/deps（否则会 import virtual:mf 且解析失败）
			exclude: MF_SHARED_EXCLUDE,
			include: [
				// 其他需要预优化的依赖...
			],
		},
		server: {
			port: 9002,
			strictPort: true,
			host: "0.0.0.0",
			cors: true, // 允许跨域
			proxy: {
				"/api": {
					/* ... */
				},
				"/remotes": {
					// 代理插件 registry 和 entry
					target: devApiProxyTarget,
					changeOrigin: true,
				},
				// ...
			},
		},
	};
});
```

**关键点说明**：

| 配置项                            | 作用                                 | 为什么重要                                               |
| --------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| `shared.singleton: true`          | 强制共享单例（仅 react / react-dom） | 避免 Host 和 Remote 各加载一份 React                     |
| **勿** `shared['react-router']`   | 不进 MF shared                       | 避免生产双 Router / `useLocation` 白屏；用 `dedupe` 即可 |
| `hostInitInjectLocation: 'entry'` | 注入位置改为 entry                   | 避免默认 html 注入导致 bootstrap 无 export               |
| `optimizeDeps.exclude`            | 排除 React 相关                      | 避免预打包写入 virtual:mf 后重启解析失败                 |
| `clearMfViteDepCachePlugin`       | 启动清缓存                           | 解决 mf_owner 递增后 .vite/deps 失效问题                 |

---

### 2.2 MF 核心运行时 (`mf.ts`)

**文件路径**：`apps/frontend/src/plugins/core/mf.ts`

```typescript
// 引入 MF Runtime API
import {
	createInstance,
	getInstance,
	type ModuleFederation,
	type ModuleFederationRuntimePlugin,
} from "@module-federation/enhanced/runtime";

// 引入 React 和 ReactDOM，用于 registerShared（Host 不装 / 不 shared vue）
import React from "react";
import ReactDOM from "react-dom";

// 引入插件类型定义
import type { PluginDescriptor, PluginModule } from "./types";

// 进程内 MF 实例单例缓存
let mf: ModuleFederation | null = null;

// shared 是否已注册的标志位
let sharedReady = false;

// afterResolve 插件是否已注册
let bustPluginReady = false;

/** remoteName → bust token；afterResolve 给改写后的 remoteEntry.js 补上 */
const bustByRemote = new Map<string, string>();

/**
 * registry entry（通常 mf-manifest.json）→ 解析出的 remoteEntry.js 绝对地址。
 * resolvePluginBust 拉 manifest 时写入，registerRemote 直连 remoteEntry，避免 MF 再拉一次 manifest。
 * （完整符号与逐行注释见 §2.13.5）
 */
const remoteEntryByManifest = new Map<string, string>();

/** 去掉 search/hash 后作为 Map key（完整见 §2.13.5） */
function entryKey(entry: string): string {
	try {
		const u = new URL(entry);
		u.search = "";
		u.hash = "";
		return u.href;
	} catch {
		return entry;
	}
}

/** 从 manifest 正文 / entry URL 得到 remoteEntry.js 绝对地址（完整见 §2.13.5） */
function resolveRemoteEntryUrl(entry: string, manifestText: string): string {
	try {
		const json = JSON.parse(manifestText) as {
			metaData?: { publicPath?: string; remoteEntry?: { name?: string } };
		};
		const file = json.metaData?.remoteEntry?.name?.trim() || "remoteEntry.js";
		const publicPath = json.metaData?.publicPath?.trim();
		if (publicPath) return new URL(file, publicPath).href;
	} catch {
		/* 非 JSON 或结构异常：按 entry 路径回退 */
	}
	try {
		const u = new URL(entry);
		if (/remoteEntry\.js$/i.test(u.pathname)) {
			u.search = "";
			u.hash = "";
			return u.href;
		}
		u.pathname = u.pathname.replace(/[^/]*$/, "remoteEntry.js");
		u.search = "";
		u.hash = "";
		return u.href;
	} catch {
		return entry;
	}
}

/**
 * 获取或创建 Host MF 实例
 * - 优先复用 @module-federation/vite 创建的默认实例
 * - 无默认实例时手动创建空 remotes 的 Host 实例
 */
function getMf(): ModuleFederation {
	// 如果已存在实例，直接返回
	if (mf) return mf;

	// 尝试获取 @module-federation/vite 创建的默认实例
	try {
		const existing = getInstance();
		if (existing) {
			mf = existing;
			return mf;
		}
	} catch {
		// 没有默认实例时静默忽略
	}

	// 创建新的 Host 实例，名称为 'host'，初始 remotes 为空数组
	mf = createInstance({ name: "host", remotes: [] });
	return mf;
}

/**
 * 向 Runtime 注册共享依赖（React / ReactDOM）
 * - 确保 sharedReady 为 true 后不再重复注册
 * - 使用 singleton 模式保证全局只有一个实例
 */
function ensureShared() {
	// 如果已注册，直接返回
	if (sharedReady) return;

	// 获取 MF 实例
	const instance = getMf();

	// 注册共享依赖（仅 react / react-dom；Vue 由 Remote 自带 + mount API）
	instance.registerShared({
		// React 共享配置
		react: {
			version: React.version, // 当前 React 版本
			scope: "default", // 作用域
			get: async () => () => React, // 模块获取函数（双重包装）
			shareConfig: {
				singleton: true, // 单例模式
				requiredVersion: `^${React.version}`, // 版本要求
			},
		},
		// React DOM 共享配置
		"react-dom": {
			version: ReactDOM.version || React.version,
			scope: "default",
			get: async () => () => ReactDOM,
			shareConfig: {
				singleton: true,
				requiredVersion: `^${ReactDOM.version || React.version}`,
			},
		},
	});

	// 标记已注册
	sharedReady = true;
}

/**
 * 从 PluginDescriptor 提取 remoteName
 * - 优先使用 descriptor 中的 remoteName
 * - 若无则使用 id
 */
function remoteNameOf(d: PluginDescriptor) {
	return d.remoteName?.trim() || d.id;
}

/**
 * 从 PluginDescriptor 提取 expose 基础名称
 * - 去掉开头的 './'
 * - 默认值为 'App'
 * - 例如 './IdeasList' → 'IdeasList'
 */
function exposeBaseOf(d: PluginDescriptor) {
	const raw = (d.expose?.trim() || "./App").replace(/^\.\//, "");
	return raw || "App";
}

/**
 * 给任意 URL 写入/覆盖 `v=`（manifest 与 remoteEntry 共用）
 * - 空 bust 不改动 URL
 * - 绝对 URL 用 URLSearchParams；相对路径手工拼 query
 */
export function withBust(url: string, bust: string): string {
	// 去空白；空则不改 URL（完整逐行见 §2.13.5）
	const token = bust.trim();
	if (!token) return url;
	try {
		const u = new URL(url);
		u.searchParams.set("v", token);
		return u.href;
	} catch {
		const hashIdx = url.indexOf("#");
		const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
		const noHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
		const qIdx = noHash.indexOf("?");
		const base = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
		const params = new URLSearchParams(qIdx >= 0 ? noHash.slice(qIdx + 1) : "");
		params.set("v", token);
		return `${base}?${params.toString()}${hash}`;
	}
}

/** bust token：`version` 或 `version@manifestHash`（完整逐行注释见 §2.13.5） */
export function pluginBust(
	// 至少需要 registry 声明的 version
	meta: Pick<PluginDescriptor, "version">,
	// Remote mf-manifest 内容指纹；勿传 registry.updatedAt
	buildId?: string,
): string {
	// version 与 buildId 去空白后过滤空值，用 @ 连接
	return [meta.version.trim(), buildId?.trim()].filter(Boolean).join("@");
}

/** FNV-1a 32-bit；仅作 cache bust（完整注释见 §2.13.5） */
function hashText(text: string): string {
	// FNV offset basis
	let h = 2166136261;
	// 逐字符异或再乘 FNV prime
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	// 无符号 32 位十六进制
	return (h >>> 0).toString(16);
}

/**
 * 拉取 Remote 自有 mf-manifest（进入插件路径上对该 URL 的唯一次网络请求）：
 * - 内容指纹 → buildId
 * - 解析 remoteEntry → 写入 remoteEntryByManifest
 * （完整逐行注释见 §2.13.5）
 */
async function fetchManifestMeta(
	entry: string,
): Promise<{ buildId: string; remoteEntryUrl: string }> {
	const url = withBust(entry, `t${Date.now()}`);
	const res = await fetch(url, { cache: "no-store" });
	if (!res.ok) {
		throw new Error(`entry buildId ${res.status}: ${entry}`);
	}
	const text = await res.text();
	const remoteEntryUrl = resolveRemoteEntryUrl(entry, text);
	remoteEntryByManifest.set(entryKey(entry), remoteEntryUrl);
	return { buildId: hashText(text), remoteEntryUrl };
}

/** 对外 API：仅返回 buildId（内部走 fetchManifestMeta；完整见 §2.13.5） */
export async function fetchEntryBuildId(entry: string): Promise<string> {
	const { buildId } = await fetchManifestMeta(entry);
	return buildId;
}

/** trusted → version@hash；untrusted → 仅 version（完整注释见 §2.13.5） */
export async function resolvePluginBust(
	meta: Pick<PluginDescriptor, "version" | "entry" | "trust">,
): Promise<string> {
	if (meta.trust === "untrusted") {
		return pluginBust(meta);
	}
	const { buildId } = await fetchManifestMeta(meta.entry);
	return pluginBust(meta, buildId);
}

/**
 * MF snapshot 会把 entry 改写成无 query 的 `.../remoteEntry.js`，
 * WKWebView 对固定名 ESM 强缓存。本钩子在 afterResolve 再补 `?v=`。
 * （afterResolve 逐行注释见 §2.13.5）
 */
const bustRemoteEntryPlugin: ModuleFederationRuntimePlugin = {
	// 插件名（完整 afterResolve 逐行见 §2.13.5）
	name: "bust-remote-entry",
	async afterResolve(args) {
		// federation remote name
		const name = args.remoteInfo?.name;
		// registerRemote 写入的 token
		const bust = name ? bustByRemote.get(name) : undefined;
		// MF 改写后的 remoteEntry.js 再补 ?v=
		if (bust && args.remoteInfo?.entry) {
			args.remoteInfo.entry = withBust(args.remoteInfo.entry, bust);
		}
		return args;
	},
};

/**
 * 注册远程模块
 * @param d - 插件描述符
 * @param bust - 可选；默认用 version。通常传入 await resolvePluginBust(meta)
 * - 优先用 remoteEntryByManifest 直连 remoteEntry.js?v=（MF 不再二次拉 manifest）
 * - 写入 bustByRemote 供 afterResolve 兜底
 * - force: true 允许覆盖已注册的 remote
 */
export function registerRemote(d: PluginDescriptor, bust?: string) {
	ensureShared();
	ensureBustPlugin();
	const token = (bust ?? d.version).trim();
	const name = remoteNameOf(d);
	if (token) bustByRemote.set(name, token);
	/* 优先用 resolvePluginBust 已解析的 remoteEntry，跳过 MF 对 mf-manifest 的第二次请求 */
	const remoteEntry =
		remoteEntryByManifest.get(entryKey(d.entry)) ??
		resolveRemoteEntryUrl(d.entry, "");
	getMf().registerRemotes(
		[
			{
				name,
				// 直连 remoteEntry.js?v=token —— MF 不再 GET mf-manifest.json
				entry: withBust(remoteEntry, token),
				type: "module",
			},
		],
		{ force: true },
	);
}

/**
 * 加载远程应用
 * @param d - 插件描述符
 * @returns 加载的插件模块
 */
export async function loadRemoteApp(
	d: PluginDescriptor,
): Promise<PluginModule> {
	ensureShared();
	ensureBustPlugin();
	const name = remoteNameOf(d);
	const expose = exposeBaseOf(d);
	const mod = await getMf().loadRemote<PluginModule>(`${name}/${expose}`);
	if (!mod?.default) {
		throw new Error(
			`plugin ${d.id}: expose ./${expose} missing default export`,
		);
	}
	return mod;
}
```

> **说明**：文件顶部维护 `bustByRemote: Map<string, string>` 与 `ensureBustPlugin()`（只 `registerPlugins` 一次）。完整源码见 `apps/frontend/src/plugins/core/mf.ts`。

---

### 2.3 插件类型定义 (`types.ts`)

**文件路径**：`apps/frontend/src/plugins/core/types.ts`

```typescript
import type React from "react";

/**
 * Host 插件契约 semver；破坏性变更才升 major。
 * 优先读 `VITE_HOST_API_VERSION`，缺省 `1.0.0`。
 */
export const HOST_API_VERSION =
	import.meta.env.VITE_HOST_API_VERSION?.trim() || "1.0.0";

/** 插件信任等级 */
export type PluginTrust = "first-party" | "partner" | "untrusted";

/** 插件权限声明 */
export type PluginPermission =
	| "ui:toast" // 允许使用 Toast
	| "nav:subtree" // 允许在子路由内导航
	| "http:plugin-api" // 允许使用插件 API
	| "modules:chat" // 允许使用聊天模块
	| "modules:ebook" // 允许使用电子书模块
	| (string & {}); // 扩展权限

/**
 * 插件描述符 - 定义插件在 registry 中的元数据
 * Host 通过此描述符加载和管理插件
 */
/** registry 内嵌多语言文案（与 Host `locale` 对齐）；见 `localeText.ts` */
export type PluginLocaleMap = Partial<Record<"zh-CN" | "en-US", string>>;

export interface PluginDescriptor {
	/** 插件唯一标识，与 MF remote name / loadRemote(`${id}/App`) 对齐 */
	id: string;

	/**
	 * 多语言插件名（插件中心 / 注入路由标题）。
	 * 新增或改名只改 registry，不必改 Host i18n。
	 */
	title?: PluginLocaleMap;

	/** 多语言说明，或旧版单语字符串 */
	description?: string | PluginLocaleMap;

	/** 路由 path（顶层注入或业务内路径） */
	routePath: string;

	/** MF entry：通常为 .../mf-manifest.json 绝对 URL */
	entry: string;

	/** 插件自身 semver 版本 */
	version: string;

	/** Host API 兼容范围，如 ^1.0.0 */
	hostApiRange: string;

	/** 可选侧栏菜单配置（仅 icon + order；文案不走 Host i18n） */
	menu?: { order: number; icon?: string };

	/**
	 * 是否由 PluginManager 注入顶层路由
	 * false：宿主已在业务路由树挂好 PluginHostPage，只负责 loadRemote
	 */
	injectRoute?: boolean;

	/**
	 * MF registerRemotes.name；默认使用 id
	 * 多插件共享同一 Remote 时填写 federation name
	 */
	remoteName?: string;

	/**
	 * MF expose 路径；默认 ./App
	 * 例如 ./IdeasList
	 */
	expose?: string;

	/** 权限声明（Bridge 按权限裁剪能力） */
	permissions: PluginPermission[];

	/**
	 * 加载时机（默认 route = 懒加载）：
	 * - route/idle/省略：仅首次进入插件页时 loadRemote
	 * - eager：init 后微任务后台预拉（不阻塞启动）
	 */
	preload?: "eager" | "route" | "idle";

	/** 插件总开关 */
	enabled: boolean;

	/** 可选 SRI 完整性校验 */
	integrity?: string;

	/** 可选签名钩子 */
	signature?: string;

	/** 信任等级；untrusted 走 iframe（不 loadRemote），须配 iframeUrl */
	trust: PluginTrust;

	/**
	 * trust: untrusted 必填：独立 HTTPS 页，Host 用 iframe 打开
	 * 生产须 https；开发可 localhost http
	 */
	iframeUrl?: string;
}

/** 插件注册表 */
export interface PluginRegistry {
	updatedAt: string; // 更新时间
	plugins: PluginDescriptor[]; // 插件列表
}

/**
 * HostBridge 属性 - Host 传递给 Remote 的 API 和插件信息
 * Remote 组件接收此属性作为 props
 */
export type HostLocale = "zh-CN" | "en-US";

export interface HostBridgeProps {
	/** Host 暴露给插件的 API（按 permissions 裁剪；未授权字段不存在） */
	api: Readonly<{
		/** 主题快照（创建时读取；MF/iframe 均无 theme 热推送） */
		theme: "light" | "dark";
		/**
		 * 与 Host 顶栏语言一致；插件自维护文案字典，仅跟随此 locale。
		 * 切换后由 PluginHostPage / iframe / eventBus 推送更新。
		 */
		locale: HostLocale;
		/** 导航函数（需 nav:subtree；须在 plugin.routePath 子树内） */
		navigate?: (to: string) => void;
		/** 插件域事件总线（始终可用） */
		event: {
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		/** HTTP（需 http:plugin-api） */
		http?: {
			get: <T = unknown>(url: string) => Promise<T>;
			post: <T = unknown>(url: string, body?: unknown) => Promise<T>;
			put: <T = unknown>(url: string, body?: unknown) => Promise<T>;
			delete: <T = unknown>(url: string) => Promise<T>;
		};
		/** UI（需 ui:toast）：Toast / 应用级全屏 / 统一落盘 */
		ui?: {
			showToast: (options: {
				message: string;
				type?: "success" | "error" | "info";
			}) => void;
			/**
			 * 应用级全屏：隐藏 Host 壳（侧栏/顶栏）并（Tauri）拉窗口全屏 /（Web）document 全屏。
			 * 实现见 host-api/appFullscreen.ts；Layout / PluginPageShell 订阅状态。
			 */
			setAppFullscreen?: (full: boolean) => Promise<void>;
			/**
			 * 统一落盘（Web `<a download>` / Tauri `download_blob`）。
			 * Tauri 成功/失败时 Host 已 Toast，`hostToasted: true` 时插件勿再弹成功提示。
			 */
			downloadBlob?: (options: {
				fileName: string;
				data: ArrayBuffer | Uint8Array;
				mimeType?: string;
			}) => Promise<{
				ok: boolean;
				hostToasted: boolean;
				message?: string;
			}>;
		};
		/** 模块 API（需 modules:chat / modules:ebook） */
		modules?: Readonly<Record<string, (...args: unknown[]) => unknown>>;
	}>;
	plugin: Readonly<Pick<PluginDescriptor, "id" | "version" | "routePath">>;
}

/**
 * 插件模块接口
 * Remote 必须导出 default 组件，可选导出 activate/deactivate 生命周期函数
 */
export interface PluginModule {
	/** 默认导出的 React 组件 */
	default: React.ComponentType<HostBridgeProps>;

	/** 激活钩子（可选）- 在模块加载后调用 */
	activate?: (api: HostBridgeProps["api"]) => Promise<void> | void;

	/** 停用钩子（可选）- 在模块卸载前调用 */
	deactivate?: () => Promise<void> | void;
}

/** 插件状态 */
export type PluginStatus =
	| "registered" // 已注册但未加载
	| "loading" // 正在加载
	| "activated" // 已激活
	| "failed" // 加载失败
	| "unloaded"; // 已卸载

/** 已加载的插件 */
export interface LoadedPlugin {
	meta: PluginDescriptor; // 插件描述符
	bridge: HostBridgeProps; // HostBridge 属性
	mod: PluginModule; // 插件模块
	status: PluginStatus; // 当前状态
	error?: string; // 错误信息（失败时）
	/** version@manifestHash；与 MF entry bust 一致，用于判断是否需重载 */
	bust?: string;
}

/** 插件侧栏菜单项（侧栏只渲染 icon；nameKey 为稳定 id，默认等于 pluginId） */
export interface PluginSidebarItem {
	pluginId: string; // 插件 ID
	path: string; // 路由路径
	nameKey: string; // 稳定标识（非 Host i18n key）
	icon: string; // 图标名称
	order: number; // 排序序号
	requiresAuth?: boolean; // 是否需要认证
}
```

**文案解析辅助**（`apps/frontend/src/plugins/core/localeText.ts`）：

```typescript
/** 优先当前 locale → zh-CN → en-US → 空串；纯字符串则原样返回 */
export function pickPluginLocaleText(
	value: PluginLocaleMap | string | undefined | null,
	locale: string,
): string;
```

---

### 2.4 插件管理器 (`PluginManager.ts`)

**文件路径**：`apps/frontend/src/plugins/core/PluginManager.ts`

```typescript
import { type ComponentType, createElement } from "react";
import type { RouteConfig } from "@/router/routes";
import { PluginHostPage } from "../host/PluginHostPage";
import { beginPluginStyleCapture } from "../host/styleIsolation";
import { eventBus } from "../host-api/EventBus";
import { routeInjector } from "../inject/RouteInjector";
import { sidebarInjector } from "../inject/SidebarInjector";
import { createHostBridge } from "./createHostBridge";
import { loadRemoteApp, registerRemote, resolvePluginBust } from "./mf";
import { verifyPlugin } from "./PluginVerifier";
import { fetchPluginRegistry, persistPluginEnabled } from "./registry";
import type { LoadedPlugin, PluginDescriptor } from "./types";

/**
 * 创建插件路由配置
 * @param meta - 插件描述符
 * @returns 路由配置对象
 * - 使用 PluginHostPage 作为组件
 * - pageShell: true → 独立路由套 PluginPageShell（业务内嵌勿传）
 */
function createPluginRoute(meta: PluginDescriptor): RouteConfig {
	const Page: ComponentType = () =>
		createElement(PluginHostPage, { pluginId: meta.id, pageShell: true });
	return {
		path: meta.routePath,
		Component: Page,
		meta: {
			/** Header / 面包屑按 Host locale 从 title 解析，不绑 Host i18n key */
			titleI18n: meta.title,
			title: meta.id,
		},
	};
}

/**
 * 插件管理器核心类
 * 负责插件的生命周期管理：注册、加载、激活、停用、卸载
 */
class PluginManagerImpl {
	/** 插件 ID → 已加载插件状态映射 */
	private plugins = new Map<string, LoadedPlugin>();

	/** 同一插件并发 load 共用一个 Promise，避免失败重入闪烁 */
	private inflight = new Map<string, Promise<void>>();

	/** 默认导航实现：整页跳转；App 会注入 router.navigate */
	private navigateImpl: (to: string) => void = (to) => {
		window.location.assign(to);
	};

	/**
	 * 设置导航实现
	 * @param fn - 导航函数（由 App 注入 React Router navigate）
	 */
	setNavigate(fn: (to: string) => void) {
		this.navigateImpl = fn;
	}

	/**
	 * 获取插件状态
	 * @param id - 插件 ID
	 * @returns 已加载插件或 undefined
	 */
	get(id: string) {
		return this.plugins.get(id);
	}

	/**
	 * 获取所有已加载插件列表
	 * @returns 插件数组
	 */
	list() {
		return [...this.plugins.values()];
	}

	/**
	 * 初始化插件系统
	 * - 只拉 registry + 挂路由/侧栏壳，不下载 MF Remote
	 * - 实际 loadRemote 在首次 ensurePlugin / PluginHostPage 挂载时进行
	 * - preload: 'eager' 的插件在微任务中后台预拉（不阻塞启动）
	 */
	async init() {
		// 拉取插件注册表（强制刷新）
		const registry = await fetchPluginRegistry({ force: true });

		// 过滤出启用的插件
		const enabled = registry.plugins.filter((p) => p.enabled);

		// 为每个启用的插件挂载壳（路由 + 侧栏）
		for (const meta of enabled) {
			this.mountShell(meta);
		}

		// 处理 eager 预加载的插件
		const eager = enabled.filter((p) => p.preload === "eager");
		if (eager.length === 0) return;

		// 在微任务中后台预拉，不阻塞主应用启动
		queueMicrotask(() => {
			void Promise.all(eager.map((p) => this.loadPlugin(p)));
		});
	}

	/**
	 * 挂载插件壳（路由 + 侧栏菜单）
	 * @param meta - 插件描述符
	 */
	private mountShell(meta: PluginDescriptor) {
		// 注入顶层路由（除非 injectRoute 显式设置为 false）
		if (meta.injectRoute !== false) {
			routeInjector.inject(meta.id, [createPluginRoute(meta)]);
		}

		// 如果有菜单配置，添加到侧栏
		if (meta.menu) {
			sidebarInjector.add({
				pluginId: meta.id,
				path: meta.routePath,
				// 侧栏仅用 icon；nameKey 仅作稳定 id，不再指向 Host i18n
				nameKey: meta.id,
				icon: meta.menu.icon ?? "Puzzle",
				order: meta.menu.order,
			});
		}
	}

	/**
	 * 确保插件可用（按需加载）
	 * @param id - 插件 ID
	 * @param opts - 选项（force: 强制重新加载）
	 * @returns 已激活的插件
	 * - 先 force 拉 registry 取 meta，再 resolvePluginBust → version@manifestHash
	 * - 已激活且 bust 未变且未 force：直接返回
	 * - bust 已变：继续重载（即使 status 仍是 activated）
	 */
	async ensurePlugin(id: string, opts?: { force?: boolean }) {
		// 强制拉最新 registry（清单防缓存；与 entry bust 解耦）
		const registry = await fetchPluginRegistry({ force: true });
		// 找已启用的目标插件
		const meta = registry.plugins.find((p) => p.id === id && p.enabled);
		// 未启用或不存在则失败
		if (!meta) {
			throw new Error(`registry 中无启用插件 ${id}`);
		}
		// version@manifestHash（逐行细节见 §2.13.6）
		const bust = await resolvePluginBust(meta);
		// 读内存态
		const cur = this.plugins.get(id);

		// 已激活且 bust 未变且未 force → 复用
		if (cur?.status === "activated" && cur.bust === bust && !opts?.force) {
			return cur;
		}
		// 同 bust 失败且未 force → 抛旧错
		if (cur?.status === "failed" && !opts?.force && cur.bust === bust) {
			throw new Error(cur.error || `加载 ${id} 失败`);
		}

		// 并发加载 Promise
		const pending = this.inflight.get(id);
		// 非 force 时等待并发结果
		if (pending && !opts?.force) {
			await pending;
			const after = this.plugins.get(id);
			if (after?.status === "activated" && after.bust === bust) return after;
			if (after?.status !== "activated") {
				throw new Error(after?.error || `加载 ${id} 失败`);
			}
			/* bust 已变，继续往下重载 */
		}

		// 确保路由/侧栏壳
		this.mountShell(meta);
		// 传入 bust，避免 loadPlugin 重复 fetch manifest
		await this.loadPlugin(meta, opts, bust);
		const next = this.plugins.get(id);
		if (next?.status !== "activated") {
			throw new Error(next?.error || `加载 ${id} 失败`);
		}
		return next;
	}

	/**
	 * 加载插件
	 * @param meta - 插件描述符
	 * @param opts - 选项（force: 强制重新加载）
	 * @param bustToken - 可选；已算好的 bust，避免 ensurePlugin 重复 fetch
	 */
	async loadPlugin(
		// 插件描述符
		meta: PluginDescriptor,
		// force 时忽略 bust 相等短路
		opts?: { force?: boolean },
		// 已算好的 bust；缺省则内部 resolvePluginBust
		bustToken?: string,
	) {
		// 复用传入 token，或自行拉 manifest 指纹
		const bust = bustToken ?? (await resolvePluginBust(meta));
		const prev = this.plugins.get(meta.id);

		// bust 未变 → 短路
		if (prev?.status === "activated" && prev.bust === bust && !opts?.force) {
			return;
		}

		// bust 变了 → 先卸旧
		if (prev?.status === "activated") {
			await this.unloadPlugin(meta.id);
			this.mountShell(meta);
		}

		const existing = this.inflight.get(meta.id);
		if (existing) {
			if (!opts?.force) return existing;
			await existing.catch(() => {});
		}

		// 真正加载，写入 LoadedPlugin.bust
		const run = this.runLoad(meta, bust);
		this.inflight.set(meta.id, run);

		try {
			await run;
		} finally {
			if (this.inflight.get(meta.id) === run) {
				this.inflight.delete(meta.id);
			}
		}
	}

	/**
	 * 执行实际加载逻辑
	 * @param meta - 插件描述符
	 * @param bust - version@manifestHash，写入 LoadedPlugin 并传给 registerRemote
	 */
	private async runLoad(meta: PluginDescriptor, bust: string) {
		// navigate 绑定（完整逐行见 §2.13.6）
		const nav = (to: string) => this.navigateImpl(to);
		// loading 占位并带上本次 bust
		const loading: LoadedPlugin = {
			meta,
			bridge: createHostBridge(meta, nav),
			mod: { default: () => null },
			status: "loading",
			bust,
		};
		this.plugins.set(meta.id, loading);

		try {
			await verifyPlugin(meta);

			// iframe 插件不进 MF
			if (meta.trust === "untrusted") {
				this.plugins.set(meta.id, {
					meta,
					bridge: createHostBridge(meta, nav),
					mod: { default: () => null },
					status: "activated",
					bust,
				});
				return;
			}

			// entry ?v=bust + bustByRemote
			registerRemote(meta, bust);
			const endCapture = beginPluginStyleCapture(meta.id, meta.entry);
			let mod: Awaited<ReturnType<typeof loadRemoteApp>>;
			try {
				// afterResolve 会给 remoteEntry 再补 ?v=
				mod = await loadRemoteApp(meta);
			} finally {
				endCapture();
			}
			const bridge = createHostBridge(meta, nav);
			await mod.activate?.(bridge.api);

			this.plugins.set(meta.id, {
				meta,
				bridge,
				mod,
				status: "activated",
				bust,
			});
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			console.error(`[PluginManager] load ${meta.id} failed`, e);
			this.plugins.set(meta.id, {
				...loading,
				status: "failed",
				error: message,
			});
		}
	}

	/**
	 * 卸载插件
	 * @param id - 插件 ID
	 * - 调用 deactivate 钩子
	 * - 清理事件总线
	 * - 移除路由和侧栏
	 * - 更新状态为 unloaded
	 */
	async unloadPlugin(id: string) {
		const loaded = this.plugins.get(id);

		// 未加载：直接清理路由和侧栏
		if (!loaded) {
			routeInjector.remove(id);
			sidebarInjector.remove(id);
			return;
		}

		try {
			// 调用 deactivate 钩子（如果存在）
			await loaded.mod.deactivate?.();
		} catch (e) {
			console.error(`[PluginManager] deactivate ${id}`, e);
		}

		// 清理事件总线
		eventBus.clearPlugin(id);

		// 移除路由和侧栏
		routeInjector.remove(id);
		sidebarInjector.remove(id);

		// 更新状态为 unloaded
		this.plugins.set(id, {
			...loaded,
			status: "unloaded",
		});
	}

	/**
	 * 上架/下架插件
	 * @param id - 插件 ID
	 * @param enabled - 是否启用
	 * - 写入本地覆盖
	 * - 即时挂壳或卸载
	 * - 下架后 init/ensure 不再加载
	 */
	async setEnabled(id: string, enabled: boolean) {
		// 设置启用覆盖
		setEnabledOverride(id, enabled);

		// 下架：卸载插件
		if (!enabled) {
			await this.unloadPlugin(id);
			return;
		}

		// 上架：从 registry 获取元数据并挂载壳
		const registry = await fetchPluginRegistry({ force: true });
		const meta = registry.plugins.find((p) => p.id === id && p.enabled);
		if (!meta) return;
		this.mountShell(meta);
	}
}

/** 插件管理器单例实例 */
export const pluginManager = new PluginManagerImpl();
```

---

### 2.5 路由注入器 (`RouteInjector.ts`)

**文件路径**：`apps/frontend/src/plugins/inject/RouteInjector.ts`

```typescript
import type { RouteConfig } from "@/router/routes";

/** 监听函数类型 */
type Listener = () => void;

/**
 * 路由注入器
 * 管理插件路由的注入和移除，支持订阅变更通知
 * 相同 path 集合不触发 notify，避免重建 router 导致闪烁
 */
class RouteInjectorImpl {
	/** 插件 ID → 路由配置数组映射 */
	private byPlugin = new Map<string, RouteConfig[]>();

	/** 变更监听器集合 */
	private listeners = new Set<Listener>();

	/**
	 * 注入插件路由
	 * @param pluginId - 插件 ID
	 * @param routes - 路由配置数组
	 * - 相同 path 集合不 notify，避免闪烁
	 */
	inject(pluginId: string, routes: RouteConfig[]) {
		// 获取之前的路由配置
		const prev = this.byPlugin.get(pluginId);

		// 相同 path 集合：不触发通知（幂等）
		if (
			prev &&
			prev.length === routes.length &&
			prev.every((r, i) => r.path === routes[i]?.path)
		) {
			return;
		}

		// 更新路由配置
		this.byPlugin.set(pluginId, routes);

		// 通知所有监听器
		this.notify();
	}

	/**
	 * 移除插件路由
	 * @param pluginId - 插件 ID
	 * - 只有实际删除了才触发通知
	 */
	remove(pluginId: string) {
		if (!this.byPlugin.delete(pluginId)) return;
		this.notify();
	}

	/**
	 * 获取所有已注入的动态路由
	 * @returns 路由配置数组
	 */
	getRoutes(): RouteConfig[] {
		return [...this.byPlugin.values()].flat();
	}

	/**
	 * 订阅路由变更
	 * @param fn - 监听函数
	 * @returns 取消订阅函数
	 */
	subscribe(fn: Listener) {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	}

	/**
	 * 通知所有监听器路由已变更
	 */
	private notify() {
		for (const fn of this.listeners) fn();
	}
}

/** 路由注入器单例实例 */
export const routeInjector = new RouteInjectorImpl();
```

---

### 2.6 侧栏注入器 (`SidebarInjector.ts`)

**文件路径**：`apps/frontend/src/plugins/inject/SidebarInjector.ts`

```typescript
import type { PluginSidebarItem } from "../core/types";

/** 监听函数类型 */
type Listener = () => void;

/**
 * 侧栏注入器
 * 管理插件侧栏菜单的添加和移除，支持订阅变更通知
 * 字段全相同则跳过，避免不必要的重渲染
 */
class SidebarInjectorImpl {
	/** 侧栏菜单项数组 */
	private _items: PluginSidebarItem[] = [];

	/** 变更监听器集合 */
	private listeners = new Set<Listener>();

	/** 获取侧栏菜单项（只读） */
	get items() {
		return this._items;
	}

	/**
	 * 添加/更新侧栏菜单项
	 * @param item - 侧栏菜单项
	 * - 字段全相同则跳过（幂等）
	 * - 按 order 排序
	 */
	add(item: PluginSidebarItem) {
		// 查找之前的配置
		const prev = this._items.find((x) => x.pluginId === item.pluginId);

		// 字段全相同：跳过（幂等）
		if (
			prev &&
			prev.path === item.path &&
			prev.nameKey === item.nameKey &&
			prev.icon === item.icon &&
			prev.order === item.order
		) {
			return;
		}

		// 更新配置：移除旧项，添加新项，按 order 排序
		this._items = [
			...this._items.filter((x) => x.pluginId !== item.pluginId),
			item,
		].sort((a, b) => a.order - b.order);

		// 通知所有监听器
		this.notify();
	}

	/**
	 * 移除侧栏菜单项
	 * @param pluginId - 插件 ID
	 * - 只有实际删除了才触发通知
	 */
	remove(pluginId: string) {
		const next = this._items.filter((x) => x.pluginId !== pluginId);
		if (next.length === this._items.length) return;
		this._items = next;
		this.notify();
	}

	/**
	 * 订阅侧栏变更
	 * @param fn - 监听函数
	 * @returns 取消订阅函数
	 */
	subscribe(fn: Listener) {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	}

	/**
	 * 通知所有监听器侧栏已变更
	 */
	private notify() {
		for (const fn of this.listeners) fn();
	}
}

/** 侧栏注入器单例实例 */
export const sidebarInjector = new SidebarInjectorImpl();
```

---

### 2.7 Host Bridge (`createHostBridge.ts`)

**文件路径**：`apps/frontend/src/plugins/core/createHostBridge.ts`

```typescript
import { Toast } from "@ui/sonner";
import { http } from "@/utils/fetch";
import { setAppFullscreen } from "../host-api/appFullscreen";
import { deepFreeze } from "../host-api/deepFreeze";
import { createEbookModulesApi } from "../host-api/ebookHostApi";
import { eventBus } from "../host-api/EventBus";
import type { HostBridgeProps, PluginDescriptor } from "./types";

/**
 * 读取当前主题
 * - 优先从 html data-theme 属性读取
 * - 其次检查 html.dark class
 * - 最后检查 body.dark / body.theme-black
 * - 默认返回 light
 */
function readTheme(): "light" | "dark" {
	try {
		const t = document.documentElement.getAttribute("data-theme");
		if (t === "dark" || t === "light") return t;
		if (document.documentElement.classList.contains("dark")) return "dark";
		// Host 黑色主题挂在 body.theme-black（不是 html.dark）
		if (
			document.body.classList.contains("dark") ||
			document.body.classList.contains("theme-black")
		) {
			return "dark";
		}
	} catch {
		// 忽略错误
	}
	return "light";
}

/**
 * 创建 HostBridge（按权限组装 API 并密封）
 * @param d - 插件描述符
 * @param navigate - 导航函数
 * @returns HostBridgeProps
 * - 根据插件权限声明组装 API
 * - 未授权的能力不存在（undefined）
 * - 返回的对象被深度冻结，不可修改
 */
export function createHostBridge(
	d: PluginDescriptor,
	navigate: (to: string) => void,
): HostBridgeProps {
	// 创建权限集合
	const allow = new Set(d.permissions);

	// API 对象（逐步构建）—— 无 api.t；插件自维护字典
	const api: Record<string, unknown> = {
		theme: readTheme(),
		locale: readLocale(), // getActiveLocale() → zh-CN | en-US
		event: {
			on: (event: string, handler: (data?: unknown) => void) =>
				eventBus.on(d.id, event, handler),
			off: (event: string, handler: (data?: unknown) => void) =>
				eventBus.off(d.id, event, handler),
			emit: (event: string, data?: unknown) => eventBus.emit(d.id, event, data),
		},
	};

	// 如果有 ui:toast 权限，添加 UI API（Toast + 应用级全屏 + 统一落盘）
	if (allow.has("ui:toast")) {
		api.ui = Object.freeze({
			showToast: (options: {
				message: string;
				type?: "success" | "error" | "info";
			}) => {
				Toast({
					type: options.type ?? "info",
					title: options.message,
				});
			},
			/** 应用级全屏：藏壳 + Tauri 窗口 / Web document 全屏（见 §2.14） */
			setAppFullscreen,
			/** 与主站收藏导出同源：Web / Tauri2 统一落盘 */
			downloadBlob: async (options: {
				fileName: string;
				data: ArrayBuffer | Uint8Array;
				mimeType?: string;
			}) => {
				// ... 见源码 createHostBridge.ts：downloadBlob + hostToasted
			},
		});
	}

	// 如果有 nav:subtree 权限，添加导航 API（限制在子路由内）
	if (allow.has("nav:subtree")) {
		api.navigate = (to: string) => {
			// 限制导航范围：只能在插件自身的 routePath 下导航
			if (!to.startsWith(d.routePath)) {
				throw new Error(`NAV_OUT_OF_SCOPE: ${to}`);
			}
			navigate(to);
		};
	}

	// 如果有 http:plugin-api 权限，添加 HTTP API
	if (allow.has("http:plugin-api")) {
		api.http = Object.freeze({
			get: <T = unknown>(url: string) => http.get<T>(url),
			post: <T = unknown>(url: string, body?: unknown) =>
				http.post<T>(url, body),
			put: <T = unknown>(url: string, body?: unknown) => http.put<T>(url, body),
			delete: <T = unknown>(url: string) => http.delete<T>(url),
		});
	}

	const modules: Record<string, unknown> = {};
	if (allow.has("modules:chat")) {
		modules.openThread = (id: unknown) => {
			if (typeof id !== "string") throw new Error("INVALID_THREAD_ID");
			navigate(`/chat/c/${id}`);
		};
	}
	if (allow.has("modules:ebook")) {
		modules.ebook = createEbookModulesApi();
	}
	if (Object.keys(modules).length > 0) {
		api.modules = Object.freeze(modules);
	}

	return deepFreeze({
		api,
		plugin: {
			id: d.id,
			version: d.version,
			routePath: d.routePath,
		},
	}) as HostBridgeProps;
}

/** 归一化 Host 当前语言 */
function readLocale(): HostLocale {
	const locale = getActiveLocale();
	return locale === "en-US" ? "en-US" : "zh-CN";
}
```

---

### 2.8 插件验证器 (`PluginVerifier.ts`)

**文件路径**：`apps/frontend/src/plugins/core/PluginVerifier.ts`

```typescript
import { HOST_API_VERSION, type PluginDescriptor } from "./types";

/**
 * 解析 SemVer 版本号
 * @param v - 版本字符串
 * @returns [major, minor, patch] 数组或 null
 * - 支持 v 前缀（如 v1.0.0）
 * - 只匹配主版本.次版本.补丁版本
 */
function parseSemver(v: string): [number, number, number] | null {
	const m = v
		.trim()
		.replace(/^v/, "")
		.match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!m) return null;
	return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * 检查版本是否满足范围要求
 * @param version - 当前版本
 * @param range - 版本范围（支持 ^x.y.z / >=x.y.z / 精确版本）
 * @returns 是否满足
 */
export function satisfiesRange(version: string, range: string): boolean {
	const ver = parseSemver(version);
	if (!ver) return false;

	const r = range.trim();

	// 处理 ^x.y.z 范围
	if (r.startsWith("^")) {
		const base = parseSemver(r.slice(1));
		if (!base) return false;

		// major 必须相同
		if (ver[0] !== base[0]) return false;

		// 0.x.x：minor 必须相同，patch >= base
		if (ver[0] === 0) {
			return ver[1] === base[1] && ver[2] >= base[2];
		}

		// x.x.x (x > 0)：minor > base 或 minor == base && patch >= base
		return ver[1] > base[1] || (ver[1] === base[1] && ver[2] >= base[2]);
	}

	// 处理 >=x.y.z 范围
	if (r.startsWith(">=")) {
		const base = parseSemver(r.slice(2));
		if (!base) return false;

		return (
			ver[0] > base[0] ||
			(ver[0] === base[0] && ver[1] > base[1]) ||
			(ver[0] === base[0] && ver[1] === base[1] && ver[2] >= base[2])
		);
	}

	// 精确版本匹配
	const exact = parseSemver(r);
	return (
		!!exact && exact[0] === ver[0] && exact[1] === ver[1] && exact[2] === ver[2]
	);
}

/**
 * 检查 entry URL 是否允许
 * @param entry - entry URL
 * @param opts - 选项（prod: 是否生产环境）
 * @returns 是否允许
 * - 生产环境：只允许 https
 * - 开发环境：允许 https 或 localhost/127.0.0.1 的 http
 */
export function entryUrlAllowed(
	entry: string,
	opts?: { prod?: boolean },
): boolean {
	let url: URL;
	try {
		url = new URL(entry);
	} catch {
		return false;
	}

	// https 始终允许
	if (url.protocol === "https:") return true;

	// 判断是否生产环境
	const prod = opts?.prod ?? import.meta.env.PROD;

	// 生产环境：只允许 https
	if (prod) return false;

	// 开发环境：允许 localhost/127.0.0.1 的 http
	return (
		url.protocol === "http:" &&
		(url.hostname === "localhost" || url.hostname === "127.0.0.1")
	);
}

/**
 * 是否跳过 integrity 校验
 * @returns 是否跳过
 * - 默认跳过（VITE_PLUGIN_SKIP_INTEGRITY !== 'false' 即跳过）
 */
function skipIntegrity(): boolean {
	return import.meta.env.VITE_PLUGIN_SKIP_INTEGRITY !== "false";
}

/**
 * 计算 SHA-384 哈希并转为 base64
 * @param buf - ArrayBuffer
 * @returns sha384-xxx 格式的字符串
 */
async function sha384Base64(buf: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-384", buf);
	const bytes = new Uint8Array(digest);
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return `sha384-${btoa(bin)}`;
}

/**
 * 插件验证错误类
 */
export class PluginVerifyError extends Error {
	constructor(
		message: string,
		readonly code:
			| "TRUST"
			| "ORIGIN"
			| "HOST_API"
			| "INTEGRITY"
			| "SIGNATURE"
			| "IFRAME",
	) {
		super(message);
		this.name = "PluginVerifyError";
	}
}

/**
 * 验证插件（加载前校验）
 * @param d - 插件描述符
 * @throws PluginVerifyError - 验证失败时抛出
 * - 信任等级验证
 * - entry URL 验证
 * - hostApi 版本验证
 * - integrity 校验（可选）
 * - signature 校验（预留）
 */
export async function verifyPlugin(d: PluginDescriptor): Promise<void> {
	// 不可信插件：只校验 iframeUrl，禁止 loadRemote 进主文档
	if (d.trust === "untrusted") {
		const src = d.iframeUrl?.trim();

		// 必须提供 iframeUrl
		if (!src) {
			throw new PluginVerifyError(
				`plugin ${d.id}: untrusted requires iframeUrl`,
				"IFRAME",
			);
		}

		// 验证 iframeUrl 是否合法
		if (!entryUrlAllowed(src)) {
			throw new PluginVerifyError(
				`plugin ${d.id}: iframeUrl must be https (or localhost http in dev)`,
				"ORIGIN",
			);
		}

		return;
	}

	// 验证 entry URL 是否合法
	if (!entryUrlAllowed(d.entry)) {
		throw new PluginVerifyError(
			`plugin ${d.id}: entry must be https (or localhost http in dev)`,
			"ORIGIN",
		);
	}

	// 验证 hostApi 版本是否兼容
	if (!satisfiesRange(HOST_API_VERSION, d.hostApiRange)) {
		throw new PluginVerifyError(
			`plugin ${d.id}: hostApi ${HOST_API_VERSION} not in ${d.hostApiRange}`,
			"HOST_API",
		);
	}

	// 验证 integrity（如果提供了且未跳过）
	if (d.integrity && !skipIntegrity()) {
		const res = await fetch(d.entry, { cache: "no-store" });

		if (!res.ok) {
			throw new PluginVerifyError(
				`plugin ${d.id}: fetch entry failed ${res.status}`,
				"INTEGRITY",
			);
		}

		// 计算 SHA-384 哈希并对比
		const hash = await sha384Base64(await res.arrayBuffer());
		if (hash !== d.integrity) {
			throw new PluginVerifyError(
				`plugin ${d.id}: integrity mismatch`,
				"INTEGRITY",
			);
		}
	}

	// signature 校验（预留钩子）
	// 实际验签由发布流水线完成，此处只检查标记
	if (d.signature === "invalid") {
		throw new PluginVerifyError(`plugin ${d.id}: bad signature`, "SIGNATURE");
	}
}
```

---

### 2.9 Registry 管理 (`registry.ts`)

**文件路径**：`apps/frontend/src/plugins/core/registry.ts`

```typescript
import { getPlatformFetch } from "@/utils/fetch";
import { resolveUploadedFileUrl } from "@/utils/upload-file-url";
import { applyEnabledOverrides } from "./enabledOverrides";
import type { PluginRegistry } from "./types";

/** 缓存键（区分生产和开发环境） */
const CACHE_KEY = `dnhyxc.plugin.registry.${import.meta.env.PROD ? "prod" : "dev"}.v1`;

/** 导出缓存键（供外部使用） */
export const PLUGIN_REGISTRY_CACHE_KEY = CACHE_KEY;

/** Registry 文件名 */
export const PLUGIN_REGISTRY_FILENAME = "plugins-registry.json";

/** 落盘相对路径；展示/拉取用 resolveUploadedFileUrl（与图片一致） */
export const PLUGIN_REGISTRY_STATIC_PATH = `/remotes/${PLUGIN_REGISTRY_FILENAME}`;

/**
 * 获取 Registry URL
 * - 优先使用环境变量覆盖
 * - 否则使用 resolveUploadedFileUrl 解析
 * - 对齐 Web/Tauri 开发/生产环境路径
 */
function registryUrl(): string {
	// 优先使用环境变量覆盖
	const override = (
		import.meta.env.PROD
			? import.meta.env.VITE_PROD_PLUGIN_REGISTRY_URL
			: import.meta.env.VITE_DEV_PLUGIN_REGISTRY_URL
	)?.trim();
	if (override) return override;

	// 使用默认路径解析
	return resolveUploadedFileUrl(PLUGIN_REGISTRY_STATIC_PATH);
}

/**
 * 读取本地缓存
 * @returns 缓存的 Registry 或 null
 * - 从 localStorage 读取
 * - 验证格式是否正确
 */
function readCache(): PluginRegistry | null {
	try {
		const cached = localStorage.getItem(CACHE_KEY);
		if (!cached) return null;

		const data = JSON.parse(cached) as PluginRegistry;

		// 验证格式
		if (!Array.isArray(data.plugins) || data.plugins.length === 0) return null;

		return data;
	} catch {
		return null;
	}
}

/**
 * 应用启用覆盖（本地上架/下架）
 * @param data - 原始 Registry
 * @returns 应用覆盖后的 Registry
 */
function withOverrides(data: PluginRegistry): PluginRegistry {
	return applyEnabledOverrides(data);
}

/**
 * 获取适合当前平台的 fetch 函数
 * @param url - 请求 URL
 * @param force - 是否强制刷新
 * @returns 响应文本
 * - https URL：使用平台特定的 fetch
 * - 其他：使用全局 fetch
 */
async function fetchRegistryText(
	url: string,
	force?: boolean,
): Promise<string> {
	const doFetch = /^https?:\/\//i.test(url)
		? await getPlatformFetch()
		: globalThis.fetch.bind(globalThis);

	// force 时 URL 加 ?t= 时间戳，避免桌面/代理仍返回旧 registry
	const fetchUrl = force ? withCacheBust(url) : url;
	const res = await doFetch(fetchUrl, {
		cache: "no-store",
		...(force ? { headers: { "Cache-Control": "no-cache" } } : {}),
	});

	if (!res.ok) throw new Error(`registry ${res.status}`);

	return res.text();
}

/**
 * 拉取插件 Registry
 * @param opts - 选项（force: 强制刷新）
 * @returns Registry 对象
 * - 优先从网络拉取
 * - 网络失败时使用本地缓存
 * - 缓存也没有时返回空列表
 */
export async function fetchPluginRegistry(opts?: {
	force?: boolean;
}): Promise<PluginRegistry> {
	let url: string;

	try {
		url = registryUrl();
	} catch (e) {
		// URL 解析失败：使用缓存
		console.warn("[plugins] registry url missing", e);
		const fallback = readCache();
		return withOverrides(
			fallback ?? { updatedAt: new Date(0).toISOString(), plugins: [] },
		);
	}

	try {
		// 从网络拉取
		const text = await fetchRegistryText(url, opts?.force);

		let data: PluginRegistry;

		try {
			data = JSON.parse(text) as PluginRegistry;
		} catch {
			throw new Error(
				`registry not JSON (${url}): ${text.slice(0, 80).replace(/\s+/g, " ")}`,
			);
		}

		// 验证格式
		if (!Array.isArray(data.plugins)) {
			throw new Error("registry.plugins missing");
		}

		try {
			// 缓存远端原文（覆盖在返回前合并，不写回污染源）
			localStorage.setItem(CACHE_KEY, JSON.stringify(data));
		} catch {
			// 忽略缓存失败
		}

		// 应用覆盖并返回
		return withOverrides(data);
	} catch (e) {
		// 网络拉取失败：使用缓存
		console.warn("[plugins] registry fetch failed, using cache", e);
		const fallback = readCache();
		return withOverrides(
			fallback ?? { updatedAt: new Date(0).toISOString(), plugins: [] },
		);
	}
}

/**
 * 拉取远端原文（不合并本地上架覆盖；用于配置编辑页）
 * @returns Registry JSON 文本
 */
export async function fetchPluginRegistryRawText(): Promise<string> {
	const url = registryUrl();
	// 编辑页始终 force，避免读到缓存旧文
	const text = await fetchRegistryText(url, true);

	try {
		// 格式化输出
		return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
	} catch {
		return text;
	}
}

/**
 * 保存前校验：每个插件的 hostApiRange 必须覆盖当前 HOST_API_VERSION
 * （避免把插件 version bump 误写成 hostApiRange）
 */
export function assertRegistryHostApiCompatible(data: PluginRegistry): void {
	for (const p of data.plugins) {
		const range = p.hostApiRange?.trim();
		if (!range) {
			throw new Error(
				translateSync("plugins.registry.missingHostApiRange", { id: p.id }),
			);
		}
		if (!satisfiesRange(HOST_API_VERSION, range)) {
			throw new Error(
				translateSync("plugins.registry.hostApiIncompatible", {
					id: p.id,
					range,
					hostApi: HOST_API_VERSION,
				}),
			);
		}
	}
}

/** 将整份 registry 写回服务端 remotes，并刷新本地缓存 */
export async function savePluginRegistry(
	data: PluginRegistry,
): Promise<PluginRegistry> {
	assertRegistryHostApiCompatible(data);
	const next: PluginRegistry = {
		...data,
		updatedAt: formatRegistryUpdatedAt(),
		plugins: data.plugins,
	};
	const payload = `${JSON.stringify(next, null, 2)}\n`;
	await putUploadRemoteJson(PLUGIN_REGISTRY_FILENAME, payload);
	writeCache(next);
	return next;
}

/**
 * 清除插件 Registry 缓存
 */
export function clearPluginRegistryCache() {
	try {
		localStorage.removeItem(CACHE_KEY);
	} catch {
		// 忽略错误
	}
}
```

---

### 2.10 插件宿主页面 (`PluginHostPage.tsx`)

**文件路径**：`apps/frontend/src/plugins/host/PluginHostPage.tsx`

职责：

1. `ensurePlugin` 加载；失败仅手动重试（`retryKey`）
2. **MF**：`withLiveLocale` 覆盖 `api.locale` + `eventBus.emit(pluginId, 'locale')`；包装 `data-mf-plugin` + `data-mf-style-realm`；挂载期 `attachPluginStyleIsolation`（CSS 捕获 + Portal bridge）
3. **untrusted**：`<iframe sandbox=...>` + `attachIframeBridge`（用 `loaded.bridge`，**不用** liveBridge）
4. Loading / 失败文案走 Host i18n keys：`plugins.host.*`
5. **`pageShell?: boolean`**：为 `true` 时用 `PluginPageShell` 包裹激活态内容（**仅** `PluginManager.createPluginRoute` 传 true；业务内嵌勿开）

```typescript
// 摘录：pageShell + locale 热更新 + MF/iframe 双路径；下列为 Props 形状
type Props = {
	// Registry / 路由注入用的插件主键
	pluginId: string;
	// 宿主容器额外 class（业务槽可收窄高度等）
	className?: string;
	// 电子书 surface 槽位：toolbar / drawer 触发器 / drawer 本体
	part?: 'toolbar' | 'drawer-triggers' | 'drawer';
	/** 独立路由页：套 Host 统一容器。业务树内嵌勿开。 */
	pageShell?: boolean;
};

// 用 Host 当前 locale 覆盖 bridge.api.locale，供 props 热更新
function withLiveLocale(bridge: HostBridgeProps, locale: HostLocale): HostBridgeProps {
	// 浅拷贝 bridge 与 api，仅替换 locale，其它 API 引用不变
	return { ...bridge, api: { ...bridge.api, locale } };
}

// 插件宿主页：加载态 / MF 根 / iframe / 可选 pageShell
export function PluginHostPage({ pluginId, className, part, pageShell }: Props) {
	// Host i18n：locale 驱动热更新；t 用于 loading/失败文案
	const { locale, t } = useI18n();
	// … ensurePlugin(pluginId, { force: retryKey > 0 }) 省略：加载与失败重试 …

	// 激活且非 untrusted：挂载期持续 CSS 捕获 + Portal bridge
	useEffect(() => {
		// 未激活 / iframe / 无 entry 时不挂隔离（untrusted 靠独立 document）
		if (status !== 'activated' || trust === 'untrusted' || !entry) return;
		// remoteName 参与 styleRealmKey；同 Remote 多 expose 共享一份 CSS realm
		return attachPluginStyleIsolation(pluginId, entry, loaded?.meta.remoteName);
		// pluginId/entry/trust/remoteName 变则重绑隔离；status 变出 activated 时卸载
	}, [pluginId, status, entry, trust, loaded?.meta.remoteName]);

	// 已激活插件经 eventBus 再推一帧 locale（与 props 热更新互补）
	useEffect(() => {
		// 未激活时无订阅方，避免空发
		if (status !== 'activated') return;
		// 按 pluginId 频道广播，Remote useHostLocale 可重绘文案
		eventBus.emit(pluginId, 'locale', locale);
		// locale 切换或插件变为 activated 时重发
	}, [pluginId, status, locale]);

	// 把最新 locale 叠进 bridge，避免 Remote 只吃到加载瞬间的 props
	const liveBridge = useMemo(
		// bridge 未就绪则 null；就绪则 withLiveLocale
		() => (loaded?.bridge ? withLiveLocale(loaded.bridge, locale) : null),
		// bridge 引用或 Host locale 变则重算
		[loaded?.bridge, locale],
	);

	// 仅独立路由需要统一外边距；业务内嵌直接返回子树
	const wrap = (node: ReactNode) =>
		pageShell ? <PluginPageShell>{node}</PluginPageShell> : node;

	// 仅 activated 走内容；loading/failed 省略（见源码）
	if (loaded?.status === 'activated') {
		// untrusted：sandbox iframe + 原始 bridge（不用 liveBridge）
		if (loaded.meta.trust === 'untrusted') {
			// 套 pageShell（若开）后进入错误边界与 iframe
			return wrap(
				<PluginErrorBoundary pluginId={pluginId}>
					<UntrustedIframe
						pluginId={pluginId}
						src={loaded.meta.iframeUrl!}
						bridge={loaded.bridge}
					/>
				</PluginErrorBoundary>,
			);
		}
		// MF default 导出即插件根组件
		const Comp = loaded.mod.default;
		// 按 entry/remoteName 算样式域，供 data-mf-style-realm 与 @scope 对齐
		const realm = styleRealmKey(
			loaded.meta.entry,
			loaded.meta.remoteName,
			pluginId,
		);
		// 套壳后渲染带 data-mf-* 的插件根
		return wrap(
			<PluginErrorBoundary pluginId={pluginId}>
				<div
					className={cn(`plugin-${pluginId} h-full w-full min-h-0`, className)}
					data-mf-plugin={pluginId}
					data-mf-style-realm={realm}
					data-plugin-root
				>
					<Comp {...liveBridge!} />
				</div>
			</PluginErrorBoundary>,
		);
	}
	// Loading / failed + 手动重试（i18n）；loading 态当前未强制 wrap pageShell
}
```

`PluginManager.createPluginRoute`：

```typescript
// 独立路由注入：强制 pageShell，业务内嵌挂载切勿照抄 true
createElement(PluginHostPage, { pluginId: meta.id, pageShell: true });
```

#### 2.10.0 独立路由外壳 (`PluginPageShell.tsx`)

**文件路径**：`apps/frontend/src/plugins/host/PluginPageShell.tsx`

订阅 `subscribeAppFullscreen`：正常态 `p-5.5 pt-0` + 圆角内容区；影院态 `p-0` / `rounded-none`。完整影院说明见 §2.14。

**现行约束（backdrop-filter）**：圆角内容区**不要**写 `overflow-hidden`。与 `border-radius` 同层时，Chromium 会让子树 `backdrop-filter` 采不到更深的 video——Remote 独立预览正常，MF 嵌入后毛玻璃失效。裁切放到更内层（无圆角）或更外层（无圆角）即可。Layout 侧同样「overflow 不与 rounded 同层」，见 §2.14.4。

```tsx
/**
 * 插件独立路由页的 Host 统一外壳（边距 + 圆角内容区）。
 * 业务内嵌挂载不要用；影院全屏时收起边距以免挡画面。
 *
 * 勿在圆角容器上写 overflow-hidden：与 border-radius 同层时，
 * Chromium 会让子树 backdrop-filter 采不到更深的 video（本地独立跑正常、MF 嵌入失效）。
 */
// React：外壳订阅影院态所需 hooks；ReactNode 为 children 类型
import { type ReactNode, useEffect, useState } from 'react';
// 合并 className，影院开/关切换 padding 与圆角
import { cn } from '@/lib/utils';
// 影院态单源：同步读初值 + 订阅后续变更
import {
	getAppFullscreen,
	subscribeAppFullscreen,
} from '../host-api/appFullscreen';

// 独立路由页外壳；业务内嵌勿包一层以免双 padding
export function PluginPageShell({
	children,
	className,
}: {
	// 插件根或错误边界子树
	children: ReactNode;
	// 路由级额外布局 class（可选）
	className?: string;
}) {
	// 初值与 Layout 同源，避免首帧闪出带边距的壳
	const [theater, setTheater] = useState(getAppFullscreen);
	// 订阅影院态；卸载时退订；[] 仅挂载一次
	useEffect(() => subscribeAppFullscreen(setTheater), []);

	// 以下为 JSX 树（标记行不加讲解）；逻辑意图见 className 表达式
	return (
		<div
			className={cn(
				// 纵向占满；min-h-0 让 flex 子项可收缩滚动
				'mx-auto flex h-full min-h-0 flex-col',
				// 影院：去外边距；常态：与业务页一致的 p-5.5 pt-0
				theater ? 'p-0' : 'p-5.5 pt-0',
				className,
			)}
		>
			<div
				className={cn(
					// 无 overflow-hidden：保留圆角视觉，不裁切 backdrop-filter 采样
					'h-full min-h-0 bg-theme-background',
					// 影院去圆角；常态 rounded-md 与 Layout 内容区一致
					theater ? 'rounded-none p-0' : 'rounded-md',
				)}
			>
				{children}
			</div>
		</div>
	);
}
```

#### 2.10.1 错误边界

| 文件                           | 作用                                              |
| ------------------------------ | ------------------------------------------------- |
| `host/PluginErrorBoundary.tsx` | Class 边界；fallback 用 `plugins.host.loadFailed` |

#### 2.10.2 主子样式隔离（原理与完整实现）

> **源码**：`apps/frontend/src/plugins/host/styleIsolation.ts`  
> **姊妹稿**（技术速览 / 落地手册）：`docs/app/style-isolation-tech-overview.md`、`docs/app/style-isolation-implementation.md`、`docs/app/style-isolation-realm-portal.md`、`docs/app/style-isolation-qiankun-harden.md`（**本轮 qiankun 级加固**）、`docs/ideas/mf-css-isolation.md`  
> **目标**：隔离责任在 **Host**；Remote 可按普通 Vite + Tailwind 工程开发（含 Preflight），主↔子样式互不破坏。  
> **现行要点（相对早期「按 pluginId `@scope`」）**：样式域改为 **`data-mf-style-realm`（按 Remote entry）**；挂载期 **`reclaimEntryStyles`** 收回同 entry 已注入 CSS；Portal 用劫持共享 **`react-dom.createPortal`** + **body 原型挂载**（覆盖 Vue Teleport 等）收进 `[data-mf-portal-scope]`；body **`removeChild` / `replaceChild` 镜像**（`resolveRetargetedChildParent`）修 antd `getScrollBarSize` 等「`body.append` → `body.remove`」在 append 重定向后抛 `NotFoundError`；Host Drawer 等外壳打开前 **`claimPluginPortalTarget`** 防首帧闪烁；sonner 等 Host 关键样式禁止误包。  
> **第三轮加固（对齐 qiankun next）**：`transpileStyleText`（`@font-face`/`@namespace`/`@import` hoist、`@keyframes` realm 前缀）；`CSSStyleSheet.insertRule` 拦截；`captureStack` 替代单例 `active`；head MO 仅 `childList`（HMR 改节点级）；sticky 认领改为 scope **`:hover`**；Toaster children 识别永不收编。详解见 [`style-isolation-qiankun-harden.md`](../../../../docs/app/style-isolation-qiankun-harden.md)。

##### 172.16.0.5 问题与目标

Host 与 Remote **同页共享一个 `document`**：

| 风险                               | 表现                                                   |
| ---------------------------------- | ------------------------------------------------------ |
| Preflight / `body`/`html` 全局规则 | Remote Tailwind 改坏 Host 字体、边距、表单             |
| 同名 utility / 组件库类            | 后加载的 Remote 覆盖 Host，或反过来                    |
| 多插件同仓                         | 学习笔记 / 全书想法等共用 `remotePlugins` 时样式互相串 |
| 多 expose 共一份 CSS               | 若按 `pluginId` 包 `@scope`，先打开的插件「占走」样式，切换后另一插件匹配不到 |
| Radix / Drawer Portal → `body`     | 弹层逃出插件子树，utility / 组件样式丢失；或 `createPortal` 容器在 body↔scope 间切换导致闪烁 |
| Vue Teleport / 原生 append → `body` | 非 React 栈同样逃出 realm，仅 patch `createPortal` 不够 |
| antd Modal/Drawer `getScrollBarSize` | `body.appendChild(measure)` 被重定向到 portal-scope 后，仍 `body.removeChild` → WebKit `NotFoundError`，Portal 崩溃 |
| CSS-in-JS `insertRule`             | 绕过改写 `style.textContent`，规则仍全局泄漏 |
| 整包 `@scope`                      | `@font-face` 失效；跨 Remote `@keyframes` 撞名 |
| Host 全局 Toaster（sonner）        | 被误 `@scope` 后 `position:fixed` 失效，顶开布局；或 sticky 误收进插件 portal-scope |

**目标**：

1. Remote **零侵入**：正常 `@import "tailwindcss"`，不必禁用 Preflight、不必手写 `[data-plugin-root]` 套 utilities。
2. Host 运行时把 Remote 注入的 CSS **限制在** `[data-mf-style-realm="…"]` 容器内（同一 Remote 多插件共享同一 realm；`data-mf-plugin` 仍作插件根标识）。
3. 仍能**继承** Host 主题 CSS 变量（视觉统一）。
4. `untrusted` 继续走 **iframe**（独立 document，不走本方案）。
5. Portal / Teleport 弹层在 **不改 Remote 业务** 的前提下仍命中 `@scope`；打开/悬停不因容器搬迁闪烁。
6. Host 关键全局样式（如 sonner）永不被收进 Remote `@scope`，亦不被误收编进 portal-scope。
7. 转译对齐 qiankun：全局 at-rule hoist、keyframes 前缀；CSSOM 与文本注入双路径覆盖。

##### 192.168.1.2 方案选型（为何用 `@scope`）

| 方案                                             | Remote 改造     | 隔离     | 主题变量继承 | 本项目                  |
| ------------------------------------------------ | --------------- | -------- | ------------ | ----------------------- |
| **CSS `@scope` + head 劫持 + MutationObserver**  | 零              | 选择器级 | ✅           | ✅ 采用                 |
| **+ `createPortal` / body 挂载收编到 portal-scope** | 零（Host 静默） | 同上     | ✅           | ✅ 跨框架 Portal 补强 |
| **+ qiankun 式 transpile / CSSOM `insertRule`** | 零              | 更强     | ✅           | ✅ 第三轮加固           |
| Shadow DOM                                       | 中（挂载/事件） | 强       | ❌ 差        | ❌                      |
| 强制 Remote 关 Preflight / 嵌套 utilities        | 高              | 弱～中   | ✅           | ❌ 已弃                 |
| qiankun experimentalStyleIsolation（改写选择器） | 低              | 中       | ✅           | ❌（改用原生 `@scope` + 同类 transpile） |
| 业务传 `getPopupContainer` / portal container    | 中～高          | ✅       | ✅           | ❌（污染主/子业务代码） |
| iframe                                           | 低              | 完全     | ❌           | ✅ 仅 `untrusted`       |

一句话：**类 qiankun next `@scope` runtime isolation 的意图落地（原生 `@scope` + hoist/keyframes 转译 + CSSOM）；Portal/Teleport 用 Host 静默收编，业务零改。**

##### 192.168.1.2 `@scope` 原理

```css
/* 现行：按 Remote 样式域（realm），不是按单个 pluginId */
/* 只有落在 [data-mf-style-realm="entry:…"] 子树内的元素才会匹配括号里的规则 */
@scope ([data-mf-style-realm="entry:http://localhost:9008/"]) {
	.btn {
		background: blue;
	}
	body {
		margin: 0;
	} /* 不会改 Host 的 body；只在容器内找匹配 */
	:root {
		--x: 1;
	} /* 不会污染 Host 的 :root */
}
```

> **历史说明（仍有效的理解）**：早期文档曾用 `@scope ([data-mf-plugin="learningNotes"])`。多 expose 共用同一 Remote CSS 包时，按 pluginId 会导致「先挂载者独占」。现改为 **`styleRealmKey(entry, remoteName, pluginId)` → `data-mf-style-realm`**；`data-mf-plugin` 仍保留，用于 Portal 归属、调试与兼容。

要点：

- 支持 Chrome 118+ / Firefox 125+ / Safari 17.4+（本项目目标环境已覆盖）。
- 不改写普通选择器字符串；`@font-face` / `@namespace` / `@import` **提升出** `@scope`；`@keyframes` 按 realm **加前缀**并改写 `animation*` 引用（防撞名）。
- CSS 变量仍可从容器祖先（Host）**继承进来**，主题统一。
- `unwrapScope`：按大括号深度剥最外层 `@scope`，保留 hoist 段，便于 HMR / 换 realm 重包。

宿主必须提供 scope 根（`PluginHostPage`）：

```html
<div
	data-mf-plugin="learningNotes"
	data-mf-style-realm="entry:http://localhost:9008/"
	data-plugin-root
	class="plugin-learningNotes h-full w-full"
>
	<!-- Remote default 组件 -->
</div>
```

Portal scope 容器（Host 维护，业务不可见）同样带 `data-mf-plugin` + `data-mf-style-realm` + `data-mf-portal-scope`。

##### 10.20.0.1 样式域 `styleRealmKey`（多 expose 共 Remote）

| 项 | 说明 |
| -- | ---- |
| **为何需要** | `apps/micro` 等一个 federation 名暴露多个插件时，CSS 往往只注入一份；`@scope` 根必须是「这份 CSS」的域，不能是某一个 pluginId |
| **键算法** | 优先 `entry:` + origin + 去掉 `mf-manifest.json` / `remoteEntry.js` 后的目录 path；URL 非法时退到 `remote:<remoteName>` 或 `plugin:<id>` |
| **写入位置** | `@scope` 选择器、`data-mf-style-owner`（现为 realm）、插件根与 portal-scope 的 `data-mf-style-realm` |
| **切换插件** | `beginPluginStyleCapture` / `attachPluginStyleIsolation` 开头调用 `reclaimEntryStyles`：把 head 里同 entry 已 scoped 的样式按当前 realm 重包（`unwrapScope` + 再 wrap） |

##### 192.168.0.2 两阶段捕获（时序）

```mermaid
sequenceDiagram
  participant PM as PluginManager.runLoad
  participant SI as styleIsolation
  participant MF as loadRemoteApp
  participant Head as document.head
  participant Page as PluginHostPage

  PM->>SI: beginPluginStyleCapture(id, entry, remoteName)
  SI->>SI: realm = styleRealmKey；repairHostCriticalStyles；reclaimEntryStyles
  SI->>Head: patch appendChild / insertBefore + CSSOM insertRule + head childList MO
  PM->>MF: loadRemote（Vite/MF 往 head 注 style/link）
  Head-->>SI: 同步/异步注入 → transpileStyleText / wrapWithScope(realm)
  MF-->>PM: module
  PM->>SI: endCapture()（refcount 归零则卸 patch）
  Page->>SI: attachPluginStyleIsolation（CSS 捕获 + Portal/Teleport bridge）
  Note over Page,SI: 覆盖 HMR / 延迟 import；createPortal + body 挂载收编到 portal-scope
  Page-->>Page: 卸载时 disconnect + releaseHeadPatch + 卸 portal scope
```

| 阶段         | API                                                              | 时机                                                         | 捕获什么                          |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| **初始加载** | `beginPluginStyleCapture(id, entry, remoteName?)`                | `registerRemote` 之后、`loadRemoteApp` 前后（`try/finally`） | 入口及依赖首次注入的 CSS；并 reclaim 同 entry |
| **挂载期**   | `attachPluginStyleIsolation`（内部 = CSS 捕获 + **Portal bridge**） | `status === 'activated'` 且非 untrusted                      | HMR、动态 `import()`、晚到的 link；Portal/Teleport 收编 |

嵌套安全：`patchDepth` / `cssomPatchDepth` 引用计数；多次 begin 只 patch 一次 head/CSSOM，全部 end 后才恢复原生方法。捕获上下文用 **`captureStack` + `activeCtx()`**（替代单例 `active`），dispose 时按 ctx 引用 `splice`，避免并行加载互相覆盖。

##### 192.168.1.4 如何认出「这是 Remote 的样式」

`looksLikeRemoteStyle(el, ctx, mode)` 优先级（`mode`: `'live'` | `'reclaim'`）：

1. `data-mf-host-style === '1'` → **永不认领**（Host 关键，如已标记的 sonner）
2. `data-mf-style-origin === entryOrigin` → 同 Remote 源
3. `data-mf-style-owner === realm`（或遗留 `=== pluginId`）→ 已认领；若 owner 已是其它 `entry:`/`remote:`/`plugin:` 域则拒绝
4. `<link rel="stylesheet">`：`href` 的 **origin === entryOrigin**
5. 文本含 `[data-sonner-toaster]` → 标 Host 关键并拒绝（防 Toaster 失 `fixed`）
6. `<style data-vite-dev-id>`（**仅 dev / HMR**）：**排除 Host**（`import.meta.url` 推出的 `…/apps/frontend` 根、或 Host 相对 id `/src/*` `/@id/*`）；其余在当前 capture 窗口认领。**不**再维护 `micro|remote-demo|…` 目录白名单——新增/重命名 `apps/<remote>` 无需改此文件
7. 生产无 vite id、有遗留 owner=pluginId 且 CSS 仍包着该 plugin 的 `@scope` → 可升到当前 realm
8. **无任何标记**：`reclaim` 模式 **绝不碰**（避免收走 Host sonner 等）；`live` 捕获窗口内才认领新注入（`activeCtx()?.realm === ctx.realm`）

线上构建一般无 `data-vite-dev-id`，走 origin / owner / live 窗口；第 6 步只影响本地 Vite 同页注入。

处理策略：

- **style**：`transpileStyleText` → hoist 全局 at-rule + keyframes 前缀 + `@scope`；Vite 常先插空 style 再写内容 → **立刻打 `mfStyleOwner`**（供 CSSOM）并挂节点级 MO；已 scoped 节点另挂 HMR 观察器。
- **link**：先 `disabled` 再 `fetch` → 新建 scoped `<style>` 插在 link 后。CORS 失败则**优雅降级**（原样生效，不阻断加载）。同源已旁路过的 link 会复用 `data-mf-from-link` 节点并按 realm 重包。
- **CSSOM**：`ensureCssomPatch` 劫持 `insertRule`；`ownerNode` 带 `mfStyleOwner` 时对单条规则 `transpileStyleRule`。
- **repairHostCriticalStyles**：捕获开始时扫描 head，剥掉误包到 sonner 上的 `@scope`。
- **观察器性能**：head 只听 **`childList`**；空 style / HMR 改写由**节点级** MO 负责（不再对 head 开 `subtree + characterData`）。

##### 10.0.0.2 Portal → `@scope`（`createPortal` + body 挂载收编）

Radix HoverPopover / Sheet / Drawer 等默认 `createPortal(…, document.body)`，Vue `Teleport to="body"` / 原生 `appendChild` 同理：子树不在 `[data-mf-style-realm]` 内 → Remote utility 失效。业界正解多是业务改 `getPopupContainer`；本项目约束为 **主/子业务零改**，故在 Host 静默处理：

| 机制 | 作用 |
| ---- | ---- |
| 劫持共享 `react-dom.createPortal` | 目标为 `body`/`documentElement` 时，改挂到 `body > [data-mf-portal-scope="<pluginId>"]`（带同 realm） |
| 劫持 `Node.appendChild` / `insertBefore` / `Element.append` / `prepend` | 同上认领逻辑，覆盖 **Vue Teleport** 与原生 body 挂载（跳过 SCRIPT/STYLE/LINK/META… 与 Host 标记节点） |
| 劫持 `Node.removeChild` / `replaceChild`（`resolveRetargetedChildParent`） | append 已重定向时，调用方仍对 `body` 做 remove/replace → 改从 **实际父节点** 操作，避免 `NotFoundError`（典型：antd/`rc-util` `getScrollBarSize`） |
| `isHostProtectedPortalChildren` | children 可识别为 sonner Toaster / `data-mf-host-portal` 时**永不收编** |
| `data-mf-host-portal` | App 根标记后，container 落在该子树内的 portal **不**收编 |
| `pointerover` / `focusin` | 仅在进出插件根 / portal-scope **边界**时更新 `lastTouchedPluginId`（`relatedTarget` 早退） |
| sticky resolve | scope **仍 `:hover`（含弹层）** 且有子节点时沿用认领；比「有子节点就占」更安全，降低误收 Host Toast |
| `claimPluginPortalTarget` / `clearPluginPortalClaim` | Host Drawer 等「先 Portal 再挂插件」：打开前同步认领；关闭 clear 并可 `maybeReleaseBodyPortalPatch` |

```mermaid
sequenceDiagram
  participant UI as Host Drawer / Radix POP
  participant RD as react-dom.createPortal
  participant SI as styleIsolation
  participant Scope as data-mf-portal-scope

  UI->>RD: createPortal(children, body)
  RD->>SI: patch：retargetPortalContainer
  alt 有 claim / lastTouched / sticky 子节点
    SI->>Scope: 挂到带 data-mf-style-realm 的 scope
  else Host data-mf-host-portal 或无归属
    SI->>RD: 保持原 body
  end
```

**闪烁两类根因（已修）**：

1. 指针进入 POP 时旧逻辑不认 portal-scope → 归属变 `null` → 容器 scope→body → 重挂。  
2. 电子书 Drawer：首帧无 claim 挂 body，插件激活/聚焦后再搬进 scope → 整树重挂。打开前 `claimPluginPortalTarget`（见 `EbookReadHostPlugins`）。

**antd Modal/Drawer 崩溃（已修）**：

`rc-util` 的 `getScrollBarSize` 在打开弹层时同步测量滚动条宽度：

```text
document.body.appendChild(measureEle)  →  测量 offsetWidth - clientWidth  →  document.body.removeChild(measureEle)
```

Host 把 `appendChild` 重定向进 `[data-mf-portal-scope]` 后，`measureEle.parentNode !== document.body`，再对 body 调 `removeChild` 会抛 `NotFoundError: The object can not be found here.`（WebKit），并被 `PluginErrorBoundary` 接住。  
修复：在 `ensureBodyPortalPatch` 中同步劫持 `removeChild` / `replaceChild`，经 `resolveRetargetedChildParent` 落到实际父节点后再原生卸载。自检：`styleIsolation.smoke.ts` 覆盖 `resolveRetargetedChildParent`。

##### 192.168.1.3 Host 接入点（调用方）

**① `PluginManager.runLoad`（初始窗口）** — `apps/frontend/src/plugins/core/PluginManager.ts`

```typescript
// untrusted 已提前 return；此处只走 MF：先登记 Remote 再开捕获窗
registerRemote(meta, bust);
// 开启捕获：劫持 head、repair sonner、reclaim 同 entry；remoteName → realm
const endCapture = beginPluginStyleCapture(
	// 插件 id：active.pluginId / 日志与遗留 owner 兼容
	meta.id,
	// entry URL：算 entryOrigin 与 styleRealmKey 主路径
	meta.entry,
	// federation 名：URL 非法时作 remote: 后备键
	meta.remoteName,
);
// 预声明模块变量，供 try 赋值、外层 activate 使用
let mod: Awaited<ReturnType<typeof loadRemoteApp>>;
try {
	// loadRemote 期间 Vite/MF 往 head 注 style/link → 被 @scope(realm)
	mod = await loadRemoteApp(meta);
} finally {
	// 成功失败都结束本轮捕获（refcount -1，嵌套时不提前卸 patch）
	endCapture();
}
```

**② `PluginHostPage`（挂载期 + 容器属性）** — `apps/frontend/src/plugins/host/PluginHostPage.tsx`

```typescript
// 已激活且非 iframe：整页生命周期持续隔离（HMR / 延迟 CSS）+ Portal bridge
useEffect(() => {
	// 未就绪或不走 MF 时不挂；避免对 iframe 误 patch createPortal
	if (status !== 'activated' || trust === 'untrusted' || !entry) return;
	// 返回 disposer：卸 portal-scope + 结束 CSS 捕获
	return attachPluginStyleIsolation(
		pluginId,
		entry,
		// 与 runLoad 同一 remoteName，保证挂载期 realm 一致
		loaded?.meta.remoteName,
	);
	// 身份或 entry 变则重绑；离开 activated 时清理
}, [pluginId, status, entry, trust, loaded?.meta.remoteName]);

// @scope 根必须存在：用 entry 算 realm，写到插件根 data-mf-style-realm
const realm = styleRealmKey(
	loaded.meta.entry,
	loaded.meta.remoteName,
	pluginId,
);
// 以下 JSX：错误边界 + 带 data-mf-plugin / data-mf-style-realm 的根（标记行不注）
return (
	<PluginErrorBoundary pluginId={pluginId}>
		<div
			className={cn(`plugin-${pluginId} h-full w-full`, className)}
			data-mf-plugin={pluginId}
			data-mf-style-realm={realm}
			data-plugin-root
		>
			<Comp {...liveBridge} />
		</div>
	</PluginErrorBoundary>
);
```

**③ Host Drawer 插件槽（打开前认领 Portal）** — `views/ebook/components/plugins/EbookReadHostPlugins.tsx`

从 `@/plugins` 引入公开 API（`plugins/index.ts` barrel）：

```typescript
// 业务槽只从 barrel 取 Portal 认领 / 样式域 / 宿主页，勿深链 styleIsolation
import {
	// Drawer 打开前同步认领，首帧 createPortal 进 scope
	claimPluginPortalTarget,
	// 关闭时清 override，避免误收后续 Host portal
	clearPluginPortalClaim,
	// drawer 内挂载插件根
	PluginHostPage,
	// 与 PluginHostPage 同一套 realm 算法
	styleRealmKey,
	// 按 host.surface 列出已启用插件
	useHostSurfacePlugins,
} from '@/plugins';
```

要点（两处认领，缺一不可）：

| 时机 | 代码落点 | 作用 |
| ---- | -------- | ---- |
| 点击打开图标 | `drawer-triggers` 的 `onClick`：打开前 `claim`，关闭前 `clear` | 用户手势瞬间已有 override，不等 `attach` |
| Drawer 渲染 | `part === 'drawer'` 找到 `openMeta` 后、`return <Drawer>` **之前**同步 `claim` | 与 `createPortal` **同一次渲染前**认领，避免「先挂 body 再搬进 scope」整树重挂闪烁 |
| Drawer 关闭 | `onOpenChange(false)` → `clearPluginPortalClaim` + 清空 `openPluginId` | 释放 override，避免误收后续 Host portal |

```tsx
// drawer-triggers：点击瞬间认领或清除，再改 openPluginId
onClick={() => {
	// 即将打开：先 claim，保证 Drawer 首帧 portal 有归属
	if (!open) {
		claimPluginPortalTarget(
			// 认领目标插件 id
			p.id,
			// realm 与插件根 data-mf-style-realm 一致，弹层才能吃到 CSS
			styleRealmKey(p.entry, p.remoteName, p.id),
		);
	} else {
		// 即将关闭：清 override（不等 Drawer unmount）
		clearPluginPortalClaim(p.id);
	}
	// 切换受控 openPluginId；打开则设 id，关闭则 null
	onOpenPluginIdChange?.(open ? null : p.id);
}}

// drawer：与 createPortal 同一次渲染前认领，避免 Drawer 先挂 body 再搬进 scope 闪烁
claimPluginPortalTarget(
	openMeta.id,
	styleRealmKey(openMeta.entry, openMeta.remoteName, openMeta.id),
);

// 以下 JSX：Drawer 壳 + 关闭时 clear；标记行不注
return (
	<Drawer
		open={!!openPluginId}
		onOpenChange={(open) => {
			// 仅处理关闭：释放 claim 并清空受控 id
			if (!open) {
				clearPluginPortalClaim(openPluginId);
				onOpenPluginIdChange?.(null);
			}
		}}
	>
		{openPluginId ? (
			<PluginHostPage pluginId={openPluginId} part={part} />
		) : null}
	</Drawer>
);
```

**④ Host Toaster 防收编** — `router/index.tsx` App 根：

```tsx
// data-mf-host-portal：retargetPortalContainer 遇到该祖先则保持原 container
return (
	<div className="h-full w-full bg-theme-background" data-mf-host-portal>
		<Toaster />
		<RouterProvider router={router} />
	</div>
);
```

**⑤ 公开导出** — `apps/frontend/src/plugins/index.ts`：

```typescript
// 供业务 Host 槽（Drawer/Sheet）认领 Portal / 算 realm，勿深链 host/styleIsolation
export {
	// 打开会 portal 到 body 的外壳前同步认领
	claimPluginPortalTarget,
	// 关闭外壳时清除认领 override
	clearPluginPortalClaim,
	// 与 @scope / data-mf-style-realm 同一套键
	styleRealmKey,
} from './host/styleIsolation';
```

业务 Host 槽（Drawer / Sheet 等）应走 barrel，勿深链 `styleIsolation.ts`。

##### 10.0.2.5 核心实现（全文 + 逐行说明）

**文件路径**：`apps/frontend/src/plugins/host/styleIsolation.ts`  
> 下列为**全文 + 逐行上方语义注释**（与现行源码对齐；**未改动的源码行优先保留本文档历史讲解注释**，新增/变更行采用源码侧注释）。含 realm、`transpileStyleText` / CSSOM、`captureStack`、body Portal/Teleport 收编、sonner 保护。第三轮加固对比见 [`style-isolation-qiankun-harden.md`](../../../../docs/app/style-isolation-qiankun-harden.md)。

```typescript
// 模块级文档：说明 Host 侧 CSS 隔离策略、realm 键、Portal 收编目标
/**
 * Host 侧 CSS 隔离（对齐 qiankun next `@scope` runtime isolation）：
 * Remote 注入的 CSS 用 @scope 包到 [data-mf-style-realm="…"]；
 * @font-face/@namespace 提升出 scope；@keyframes 按 realm 前缀防撞名；
 * CSSOM insertRule 拦截补齐 CSS-in-JS；body 挂载劫持覆盖 React/Vue 等 Portal/Teleport。
 * body removeChild/replaceChild 同步镜像：antd getScrollBarSize 等「body.append → body.remove」
 * 在 append 被重定向后仍能按实际父节点卸载，避免 NotFoundError。
 *
 * 多 expose 共用同一 Remote 时按 realm（非 pluginId）隔离。
 * 不改主/子业务逻辑：仅改写注入的 CSS 与 body 级 Portal 挂载点。
 */

// React：isValidElement 与 ReactNode，供 Portal 子树改挂时判定
import { isValidElement, type ReactNode } from 'react';
// 引入 ReactDOM，后续 monkey-patch createPortal 将 body Portal 收进插件 scope 容器
import ReactDOM from 'react-dom';

// 样式捕获上下文：记录当前认领 CSS 的插件、共享 realm 与 Remote entry 源
type CaptureCtx = {
	// 当前插件实例 id，用于 capture 栈匹配与 Portal 认领
	pluginId: string;
	/** @scope / mfStyleOwner 键：同一 Remote 多插件共享 */
	// realm 字符串键，写入 mfStyleOwner 与 @scope 根选择器 data-mf-style-realm
	realm: string;
	// Remote entry 的 origin，用于 looksLikeRemoteStyle 精确同源判断
	entryOrigin: string;
// 结束 CaptureCtx 类型定义
};

/** 嵌套 begin/attach 用栈，避免并行加载时 active 互相覆盖 */
// 见上行 JSDoc：嵌套 begin/attach 用栈，并行加载时避免 active 互相覆盖
const captureStack: CaptureCtx[] = [];
// 取栈顶捕获上下文；栈空时返回 null，表示不在捕获窗口
function activeCtx(): CaptureCtx | null {
	// 返回栈顶 ctx，空栈则 null
	return captureStack[captureStack.length - 1] ?? null;
// 结束 activeCtx
}

// head.appendChild/insertBefore patch 嵌套深度，支持 begin/end 成对嵌套
let patchDepth = 0;
// 缓存 document.head.appendChild 原生实现，release 时还原
let origAppend: <T extends Node>(node: T) => T;
// 缓存 document.head.insertBefore 原生实现，release 时还原
let origInsert: <T extends Node>(node: T, ref: Node | null) => T;

/** 指针/焦点跨越插件边界时更新；多数移动早退，避免 pointerover 热路径开销 */
// 最近一次 pointer/focus 事件关联的 pluginId，供 Portal 认领兜底
let lastTouchedPluginId: string | null = null;
// 是否已在 document 安装 pointerover/focusin 桥接监听
let touchBridgeInstalled = false;

// 匹配 @keyframes 名，供按 realm 加前缀防撞
const KEYFRAMES_RE = /@keyframes\s+([\w-]+)/g;
// 匹配整段 @font-face（含嵌套大括号），供 hoist 出 @scope
const FONT_FACE_RE = /@font-face\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g;
// 匹配 @namespace 声明，须 hoist 到文件顶
const NAMESPACE_RE = /@namespace\s+[^;]+;/g;
// @import 正则续行声明：整句提到文件最前
const IMPORT_RE =
	// 匹配 url(...) 或字符串形式的 @import 整句
	/@import\s+(?:url\(\s*["']?[^"')]+["']?\s*\)|["'][^"']+["'])[^;]*;/g;
// 匹配 animation-name 声明，便于把值里的 kf 名换成前缀名
const ANIMATION_NAME_DECL_RE = /(animation-name\s*:\s*)([^;}]+)/gi;
// 匹配 animation 简写声明（需排除 animation-* 长属性）
const ANIMATION_SHORTHAND_DECL_RE = /(animation\s*:\s*)([^;}]+)/gi;
// 从 animation 值里抠标识符 token，对照 nameMap 替换
const IDENT_TOKEN_RE = /([\w-]+)/g;
// 已加前缀的 keyframes 标记串，避免二次改写
const KF_PREFIX_MARK = '__mf';

// 将 CSS 标识符转义，避免 realm 含特殊字符时破坏 [attr="…"] 选择器
function cssEscapeIdent(id: string): string {
	// 环境提供 CSS.escape 时走标准 API
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		// 返回浏览器转义后的安全 ident 字符串
		return CSS.escape(id);
	// 结束 CSS.escape 可用分支
	}
	// 降级：对非 [a-zA-Z0-9_-] 字符前加反斜杠
	return id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
// 结束 cssEscapeIdent 函数
}

/**
 * 同一 MF Remote（同 entry 源）共用一个样式域。
 * 优先 entry origin+目录；显式 remoteName 且异于 id 时作补充键。
 */
// 导出：根据 entry URL / remoteName / pluginId 计算跨插件共享的 style realm 键
export function styleRealmKey(
	// Remote manifest 或 remoteEntry URL，用于解析 origin 与 realm 主路径
	entry: string,
	// Module Federation remote 名称；entry 非 URL 时作 remote: 前缀降级键
	remoteName?: string,
	// 插件实例 id；entry 无法解析且无有效 remoteName 时作 plugin: 兜底键
	pluginId?: string,
// 返回 realm 字符串
): string {
	// 尝试把 entry 当 URL 规范化，成功则生成 entry:origin+path
	try {
		// 将 entry 解析为 URL 对象
		const u = new URL(entry);
		// 去掉 query，避免 manifest 带参导致 realm 漂移
		u.search = '';
		// 去掉 hash 片段
		u.hash = '';
		// 从 pathname 剥掉末尾 mf-manifest.json / remoteEntry.js
		let path = u.pathname.replace(
			// replace 正则：匹配 Remote 入口文件名并替换为空
			/\/(?:mf-manifest\.json|remoteEntry\.js)\/?$/i,
			// 替换为 empty string，得到 Remote 根目录路径
			'',
		// 结束 pathname.replace 调用
		);
		// 目录路径统一以 / 结尾，保证同 Remote 不同 expose 键一致
		if (!path.endsWith('/')) path += '/';
		// try 成功：返回 entry:origin+规范化路径作为共享 realm
		return `entry:${u.origin}${path}`;
	// entry 非合法 URL 时进入降级分支
	} catch {
		// 取 trim 后的 remoteName 供后续判断
		const named = remoteName?.trim();
		// 有 remoteName 且与 pluginId 不同 → remote: 键
		if (named && named !== pluginId) return `remote:${named}`;
		// 最后兜底 plugin:pluginId（未知时用 unknown）
		return `plugin:${pluginId || 'unknown'}`;
	// 结束 styleRealmKey 的 catch 降级分支
	}
// 结束 styleRealmKey 函数
}

// 生成 @scope 根选择器，匹配带 data-mf-style-realm 的 DOM 子树
function scopeSelector(realm: string): string {
	// 返回属性选择器字符串，realm 经 cssEscapeIdent 转义
	return `[data-mf-style-realm="${cssEscapeIdent(realm)}"]`;
// 结束 scopeSelector 函数
}

// 为 realm 生成稳定短前缀，给 @keyframes 名防跨 Remote 撞名
function kfPrefixForRealm(realm: string): string {
	// FNV-1a 32 位初始偏移基础
	let h = 2166136261;
	// 逐字节混入 realm 字符
	for (let i = 0; i < realm.length; i++) {
		// 异或当前字符码
		h ^= realm.charCodeAt(i);
		// 乘 FNV 质数完成一轮混叠
		h = Math.imul(h, 16777619);
	// 结束 for 循环
	}
	// 无符号化后转 36 进制，拼上固定标记与下划线
	return `${KF_PREFIX_MARK}${(h >>> 0).toString(36)}_`;
// 结束 kfPrefixForRealm
}

// 判断 CSS 文本是否已用给定选择器包过 @scope，避免重复包裹
function alreadyScoped(text: string, sel: string): boolean {
	// 检测 @scope (sel) 或 @scope(sel) 两种写法
	return text.includes(`@scope (${sel})`) || text.includes(`@scope(${sel})`);
// 结束 alreadyScoped 函数
}

/** 按大括号深度剥最外层 @scope (…) { … }，保留 hoist 段 */
// 若文本被单层 @scope 包裹则剥壳，否则原样返回
function unwrapScope(cssText: string): string {
	// 定位最外层 @scope (…) { 的起始
	const m = cssText.match(/@scope\s*\([^)]*\)\s*\{/);
	// 无匹配或无 index 则原样返回（未包 scope 或异常）
	if (!m || m.index == null) return cssText;
	// @scope 匹配起点下标
	const start = m.index;
	// 外层 { 的下标（match 末字符）
	const openAt = start + m[0].length - 1;
	// 大括号嵌套深度，用于找到配对的外层 }
	let depth = 0;
	// 从开括号起扫描到串尾找闭合
	for (let i = openAt; i < cssText.length; i++) {
		// 当前字符
		const ch = cssText[i];
		// 遇 { 加深一层
		if (ch === '{') depth++;
		// 遇 } 进入减深分支
		else if (ch === '}') {
			// 减一层深度
			depth--;
			// 回到 0 说明外层 @scope 块结束
			if (depth === 0) {
				// @scope 之前的 hoist/前缀文本
				const before = cssText.slice(0, start).trimEnd();
				// @scope 大括号内的样式正文
				const inner = cssText.slice(openAt + 1, i).trim();
				// 闭合 } 之后的剩余文本
				const after = cssText.slice(i + 1).trim();
				// 拼接非空三段，剥掉最外层 scope
				return [before, inner, after].filter(Boolean).join('\n');
			// 结束 depth===0 分支
			}
		// 结束 ch==='}' 分支
		}
	// 结束 for 扫描
	}
	// 未找到配对 } 则原样返回，避免截断损坏
	return cssText;
// 结束 unwrapScope 函数
}

// 用正则抽出 at-rule，返回抽出列表与剩余 CSS
function extractAtRules(
	// 待扫描的 CSS 文本
	cssText: string,
	// 匹配目标 at-rule 的全局正则
	regex: RegExp,
// 返回类型：抽出片段与剩余串；函数体开始
): { extracted: string[]; remaining: string } {
	// 收集匹配到的 at-rule 原文
	const extracted: string[] = [];
	// replace 回调：记下 match 并从正文删除
	const remaining = cssText.replace(regex, (match) => {
		// 把整段 match 推进 extracted
		extracted.push(match);
		// 用空串删掉该 at-rule，留给后续 hoist
		return '';
	// 结束 replace 回调
	});
	// 返回抽出结果与剩余 CSS
	return { extracted, remaining };
// 结束 extractAtRules
}

// 按 nameMap 改写 animation 值里的 keyframes 标识符（保留时长等）
function rewriteAnimationValueTokens(
	// 逗号分隔的多段 animation 值
	value: string,
	// 原名 → 带 realm 前缀的新名
	nameMap: Map<string, string>,
// 返回改写后的 animation 值；函数体开始
): string {
	// 对每段 animation 列表项替换 ident
	return value
		// 按逗号拆成多条动画定义
		.split(',')
		// 对单条定义做 map，准备替换其中的 ident
		.map((entry) =>
			// 命中 nameMap 则换前缀名，否则保留原 token（如 ease、1s）
			entry.replace(IDENT_TOKEN_RE, (token) => nameMap.get(token) ?? token),
		// 结束 map 回调
		)
		// 再拼回逗号分隔列表
		.join(',');
// 结束 rewriteAnimationValueTokens
}

// 给 CSS 内 @keyframes 名加 realm 前缀，并同步改写 animation 引用
function prefixKeyframes(cssText: string, realm: string): string {
	// 本 realm 的稳定前缀
	const prefix = kfPrefixForRealm(realm);
	// 收集「原名 → 前缀名」，供 animation 声明第二遍替换
	const nameMap = new Map<string, string>();
	// 第一遍：改写 @keyframes 规则名并填充 nameMap
	let result = cssText.replace(KEYFRAMES_RE, (match, name: string) => {
		// 已带 __mf 标记则跳过，避免重复前缀
		if (name.startsWith(KF_PREFIX_MARK)) return match;
		// 拼出带 realm 前缀的新 keyframes 名
		const next = `${prefix}${name}`;
		// 记下映射，供 animation-name / animation 简写使用
		nameMap.set(name, next);
		// 返回改写后的 @keyframes 行
		return `@keyframes ${next}`;
	// 结束 KEYFRAMES_RE replace 回调
	});
	// 没有改过任何 kf 名则无需动 animation 声明
	if (nameMap.size === 0) return result;

	// 第二遍：改写 animation-name: … 中的名字列表
	result = result.replace(
		// 匹配 animation-name 声明
		ANIMATION_NAME_DECL_RE,
		// 保留「animation-name:」头，只改值里的 kf 名
		(_m, head: string, value: string) =>
			// 头 + 按 nameMap 改写后的值
			`${head}${rewriteAnimationValueTokens(value, nameMap)}`,
	// 结束 animation-name replace
	);
	// 第三遍：改写 animation 简写（排除 animation-* 长属性误伤）
	result = result.replace(
		// 匹配疑似 animation 简写的声明
		ANIMATION_SHORTHAND_DECL_RE,
		// 简写回调：先过滤 animation-xxx 长属性
		(match, head: string, value: string) => {
			// animation-duration 等长属性整段 match 以 animation- 开头则原样
			if (/^animation-[a-z]/i.test(match)) return match;
			// 真正的 animation 简写：改写值里的 kf 名
			return `${head}${rewriteAnimationValueTokens(value, nameMap)}`;
		// 结束 animation 简写回调
		},
	// 结束 animation 简写 replace
	);
	// 返回完成 kf 前缀与引用同步的 CSS
	return result;
// 结束 prefixKeyframes
}

/**
 * 类 qiankun transpileStyleText：hoist 全局 at-rule + keyframes 前缀 + @scope。
 * @import 提到文件顶部（必须在任何规则前）；导入内容本身仍可能全局生效——CORS/外链场景的已知上限。
 */
// 见上行 JSDoc：整段 style 文本转译（hoist + kf 前缀 + @scope）
function transpileStyleText(
	// 原始 CSS 文本
	cssText: string,
	// 目标 @scope 选择器
	sel: string,
	// realm：keyframes 前缀与 owner 语义
	realm: string,
// 返回可写入 style 标签的转译结果；函数体开始
): string {
	// 读取去空白后的 CSS 文本
	const trimmed = cssText.trim();
	// 空 CSS 直接返回，无需包裹
	if (!trimmed) return cssText;
	// 已是目标 @scope 则幂等返回
	if (alreadyScoped(trimmed, sel)) return cssText;

	// 若曾误包 scope，先剥到裸 CSS 再重新 hoist/包
	const bare = unwrapScope(trimmed);
	// 抽出所有 @import，剩余交给后续 font-face 等
	const { extracted: imports, remaining: afterImport } = extractAtRules(
		// 从裸 CSS 抽 @import
		bare,
		// 使用 IMPORT_RE
		IMPORT_RE,
	// 结束 extractAtRules(@import) 调用
	);
	// 抽出 @font-face，剩余继续抽 namespace
	const { extracted: fontFaces, remaining: afterFont } = extractAtRules(
		// 在去 import 后的串上抽 font-face
		afterImport,
		// 使用 FONT_FACE_RE
		FONT_FACE_RE,
	// 结束 extractAtRules(@font-face)
	);
	// 抽出 @namespace
	const { extracted: namespaces, remaining: afterNs } = extractAtRules(
		// 在去 font-face 后的串上抽 namespace
		afterFont,
		// 使用 NAMESPACE_RE
		NAMESPACE_RE,
	// 结束 extractAtRules(@namespace)
	);

	// 对剩余规则做 kf 前缀，作为 @scope 正文
	const scopedContent = prefixKeyframes(afterNs, realm).trim();
	// hoist 顺序：@import → @namespace → @font-face（符合 CSS 顶置约束）
	const hoisted = [...imports, ...namespaces, ...fontFaces].join('\n');
	// 没有可 scope 的正文则只返回 hoist 段
	if (!scopedContent) return hoisted.trim();

	// 用 @scope (sel) 包住插件局部规则
	const scoped = `@scope (${sel}) {\n${scopedContent}\n}\n`;
	// 有 hoist 则拼在 scope 块前，否则只返回 scope 块
	return hoisted ? `${hoisted}\n${scoped}` : scoped;
// 结束 transpileStyleText
}

/** 单条 CSSOM 规则（无 @import） */
// 见上行 JSDoc：单条 CSSOM insertRule 文本转译（无 @import 流程）
function transpileStyleRule(
	// insertRule 传入的单条 rule 文本
	ruleText: string,
	// 目标 scope 选择器
	sel: string,
	// realm 供 keyframes 前缀
	realm: string,
// 返回可 insertRule 的字符串；函数体开始
): string {
	// 去空白后判断规则类型
	const trimmed = ruleText.trim();
	// 空规则原样返回
	if (!trimmed) return ruleText;
	// 已是目标 @scope 开头则不重复包
	if (
		// 有空格的 @scope (sel) 写法
		trimmed.startsWith(`@scope (${sel})`) ||
		// 无空格的 @scope(sel) 写法
		trimmed.startsWith(`@scope(${sel})`)
	// 结束已 scope 判定条件，进入分支
	) {
		// 已隔离则直接返回 trimmed
		return trimmed;
	// 结束已 scope 分支
	}
	// @font-face / @namespace 必须全局，不进 @scope
	if (/^@font-face\b/i.test(trimmed) || /^@namespace\b/i.test(trimmed)) {
		// 原样返回这类全局 at-rule
		return trimmed;
	// 结束全局 at-rule 分支
	}
	// @import 不能经 insertRule 可靠处理，原样放行
	if (/^@import\b/i.test(trimmed)) return trimmed;
	// 其余规则先做 kf 前缀再包一层 @scope
	const prefixed = prefixKeyframes(trimmed, realm);
	// 单行 @scope 包装，供 CSSOM 插入
	return `@scope (${sel}) { ${prefixed} }`;
// 结束 transpileStyleRule
}

// wrapWithScope：委托 transpileStyleText，统一整段文本入口
function wrapWithScope(cssText: string, sel: string, realm: string): string {
	// 直接转译整段 CSS
	return transpileStyleText(cssText, sel, realm);
// 结束 wrapWithScope 函数
}

// 从 entry URL 提取 origin（scheme+host+port）
function entryOriginOf(entry: string): string {
	// 尝试解析 entry 为 URL
	try {
		// 成功则返回 origin 字符串
		return new URL(entry).origin;
	// 解析失败进入 catch
	} catch {
		// 无法解析时返回空串，looksLikeRemoteStyle 会走其他启发式
		return '';
	// 结束 entryOriginOf 的 catch 分支
	}
// 结束 entryOriginOf 函数
}

/** Host 源码根（…/apps/frontend），由本模块 URL 推导，避免白名单 remote 目录名 */
// 缓存 Host Vite 根路径，避免重复解析 import.meta.url
let hostViteRootCache: string | null = null;
// 懒计算 Host 前端工程根目录，用于识别 Host dev 注入的 style
function hostViteRoot(): string {
	// 缓存命中则直接返回
	if (hostViteRootCache != null) return hostViteRootCache;
	// 尝试从当前模块 URL 推导 monorepo 内 /apps/frontend 绝对前缀
	try {
		// decodeURIComponent 当前模块 pathname，统一为正斜杠
		const path = decodeURIComponent(
			// import.meta.url → pathname，反斜杠转正斜杠
			new URL(import.meta.url).pathname.replace(/\\/g, '/'),
		// 结束 decodeURIComponent 实参
		);
		// monorepo 内 Host 应用目录标记字符串
		const marker = '/apps/frontend';
		// 从路径末尾向前找 marker 位置
		const idx = path.lastIndexOf(marker);
		// 找到 marker 则切片得到 Host 根并缓存
		if (idx >= 0) {
			// 缓存含 /apps/frontend 的绝对路径前缀
			hostViteRootCache = path.slice(0, idx + marker.length);
			// 返回刚写入的 hostViteRootCache
			return hostViteRootCache;
		// 结束 idx >= 0 分支
		}
	// URL 推导异常时忽略，走下方默认值
	} catch {
		/* ignore */
	// 结束 hostViteRoot 的 try 块（catch 体为空）
	}
	// 推导失败：写入保守默认 /apps/frontend
	hostViteRootCache = '/apps/frontend';
	// 返回默认 hostViteRootCache
	return hostViteRootCache;
// 结束 hostViteRoot 函数
}

/**
 * 是否为 Host 自身 Vite 注入的 style（dev）。
 * 只排除 Host；其余 app（micro / remote-demo / 未来新目录）在 capture 窗口内一律可认领。
 */
// 根据 Vite dev 注入 style 的 data-vite-dev-id 判断是否为 Host 样式
function isHostViteDevStyle(viteId: string): boolean {
	// 统一路径分隔符便于 includes/regex
	const id = viteId.replace(/\\/g, '/');
	// 取得 Host 根路径供后续匹配
	const root = hostViteRoot();
	// vite id 含 Host 根绝对路径 → Host 自身模块
	if (root && id.includes(root)) return true;
	// 路径段含 /apps/frontend/ 或以其结尾 → Host 应用
	if (/\/apps\/frontend(?:\/|$)/i.test(id)) return true;
	// Host Vite 相对 id（无 monorepo apps/ 段）；Remote 一般是 @fs 绝对路径含 apps/<name>
	// 见下行源码注释：无 /apps/ 且以 /src/ 或 /@id/ 开头 → Host Vite 虚拟模块
	if (!/\/apps\//i.test(id) && (/^\/src\//.test(id) || /^\/@id\//.test(id))) {
		// 命中 Host 相对 id 规则，排除于 Remote 认领
		return true;
	// 结束 Host 相对 id 分支
	}
	// 其余 id 视为 Remote 或其他应用
	return false;
// 结束 isHostViteDevStyle 函数
}

// 检测 CSS 是否含 Host 关键全局规则（sonner toaster），不能进 @scope
function isHostCriticalCss(text: string): boolean {
	// sonner 用 __insertCSS 注入全局样式；误 @scope 后 Toaster 失 fixed，会顶开布局
	// 见下行源码注释：含 sonner toaster 选择器即 Host 关键 CSS
	return text.includes('[data-sonner-toaster]');
// 结束 isHostCriticalCss 函数
}

/** 纠正已被误包进 @scope 的 Host 关键全局样式（如 sonner） */
// 扫描 head 内 style，对误包 @scope 的 Host 关键 CSS 去壳并打 mfHostStyle
function repairHostCriticalStyles() {
	// 遍历 head 下所有 style 元素
	for (const node of document.head.querySelectorAll('style')) {
		// 非 HTMLStyleElement 跳过
		if (!(node instanceof HTMLStyleElement)) continue;
		// 读取 style 内联 CSS 文本
		const text = node.textContent ?? '';
		// 非 Host 关键 CSS 不处理
		if (!isHostCriticalCss(text)) continue;
		// 标记 mfHostStyle=1，后续 looksLikeRemoteStyle 永久排除
		node.dataset.mfHostStyle = '1';
		// 未包 @scope 则无需修复
		if (!text.includes('@scope')) continue;
		// 剥掉误包的 @scope，恢复全局 fixed 等规则
		node.textContent = unwrapScope(text);
		// 清除 mfScoped，避免被当作已 scoped Remote
		delete node.dataset.mfScoped;
		// 清除 mfStyleOwner
		delete node.dataset.mfStyleOwner;
		// 清除 mfStyleOrigin
		delete node.dataset.mfStyleOrigin;
	// 结束 repairHostCriticalStyles 的 for 循环
	}
// 结束 repairHostCriticalStyles 函数
}

// 判断 style/link 是否应视为当前 ctx 的 Remote 样式
function looksLikeRemoteStyle(
	// 待检测的 style 或 link 元素
	el: HTMLStyleElement | HTMLLinkElement,
	// 当前 capture/reclaim 上下文
	ctx: CaptureCtx,
	// live=捕获新注入；reclaim=挂载时回收已有样式，对无标记节点更保守
	mode: 'live' | 'reclaim' = 'live',
// 返回是否应认领并 @scope
): boolean {
	// 已标记 Host 样式的一律不认领
	if (el.dataset.mfHostStyle === '1') return false;

	// 读取先前写入的 mfStyleOrigin
	const origin = el.dataset.mfStyleOrigin;
	// 有 origin 标记时仅精确匹配 ctx.entryOrigin
	if (origin) return origin === ctx.entryOrigin;

	// 读取 mfStyleOwner（realm 或历史 pluginId）
	const owner = el.dataset.mfStyleOwner;
	// owner 已是当前 realm 或 pluginId → 属于本插件/本 realm
	if (owner === ctx.realm || owner === ctx.pluginId) return true;
	// owner 是其他 entry/remote/plugin 键 → 明确属于别的域
	if (
		// 条件：owner 以 entry: 开头
		owner?.startsWith('entry:') ||
		// 或 owner 以 remote: 开头
		owner?.startsWith('remote:') ||
		// 或 owner 以 plugin: 开头
		owner?.startsWith('plugin:')
	// 结束「属于其他域」复合条件
	) {
		// 命中则拒绝认领
		return false;
	// 结束 owner 前缀判断的 if 块
	}

	// link 元素走 href 同源判断分支
	if (el instanceof HTMLLinkElement) {
		// 非 stylesheet 或无 href 则跳过
		if (el.rel !== 'stylesheet' || !el.href) return false;
		// 尝试解析 link.href 的 origin
		try {
			// href origin 与 entry origin 一致则认领
			return new URL(el.href).origin === ctx.entryOrigin;
		// href 解析失败
		} catch {
			// 解析失败则拒绝
			return false;
		// 结束 link href try/catch
		}
	// 结束 HTMLLinkElement 分支
	}

	// style 元素：读取内联 CSS 文本
	const text = el.textContent ?? '';
	// Host 关键全局 CSS：打 Host 标记并排除
	if (isHostCriticalCss(text)) {
		// 标记 mfHostStyle 防止后续误认领
		el.dataset.mfHostStyle = '1';
		// 返回 false 排除 Remote 处理
		return false;
	// 结束 isHostCriticalCss 分支
	}

	// 读取 Vite dev 注入的 data-vite-dev-id
	const viteId = el.getAttribute('data-vite-dev-id') || '';
	// 有 vite id 时走 Host/Remote 模块路径启发式
	if (viteId) {
		// Host 自身 Vite 样式永不认领
		if (isHostViteDevStyle(viteId)) return false;
		// 尝试从 ctx.entryOrigin 取 host 做 vite id 子串匹配
		try {
			// 解析 entry origin 得到 host 字符串
			const host = new URL(ctx.entryOrigin).host;
			// vite id 含 Remote host → 高置信 Remote 样式
			if (host && viteId.includes(host)) return true;
		// entryOrigin 解析异常忽略
		} catch {
			/* ignore */
		// 结束 viteId try 块（catch 体为 /* ignore */）
		}
		// 无 host 线索时：仅当仍在本 realm 捕获窗口内才认领
		return activeCtx()?.realm === ctx.realm;
	// 结束 viteId 分支
	}

	// 生产无 vite id：旧版 owner=pluginId 且仍包着该 plugin 的 @scope → 可升到 realm
	// 见下行源码注释：生产无 vite id，兼容旧 owner=pluginId + data-mf-plugin @scope
	if (owner) {
		// 旧版 scoped 样式仍含 [data-mf-plugin="owner"] 时可 reclaim 到 realm
		if (
			// active 仍是本 realm
			activeCtx()?.realm === ctx.realm &&
			// 且 CSS 含双引号版 data-mf-plugin 选择器
			(text.includes(`[data-mf-plugin="${owner}"]`) ||
				// 或 CSS 含单引号版 data-mf-plugin 选择器
				text.includes(`[data-mf-plugin='${owner}']`))
		// 结束旧版 owner 升级复合条件
		) {
			// 满足则认领 true
			return true;
		// 结束 inner if
		}
		// owner 存在但不满足升级条件则 false
		return false;
	// 结束 owner 分支
	}

	// 无标记的 style：reclaim 绝不碰（避免收走 Host sonner 等）；仅 live 捕获窗口认领新注入
	// 见下行源码注释：reclaim 对无标记 style 保守拒绝；live 依赖 active capture
	if (mode === 'reclaim') return false;
	// live 捕获窗口内：仅栈顶仍是本 realm 时认领新注入
	return activeCtx()?.realm === ctx.realm;
// 结束 looksLikeRemoteStyle
}

// 空 style 等待 textContent 出现的 MutationObserver，弱键防泄漏
const pendingStyleObservers = new WeakMap<HTMLStyleElement, MutationObserver>();
// 已 scoped 的 style 监听 HMR 改文，弱键防泄漏
const hmrStyleObservers = new WeakMap<HTMLStyleElement, MutationObserver>();

// 监听已隔离 style 的文本被 HMR 改写后重新 scope
function watchScopedStyleHmr(
	// 目标 style 元素
	el: HTMLStyleElement,
	// 期望的 owner realm
	realm: string,
	// 可选 origin，回写 data-mf-style-origin
	entryOrigin: string | undefined,
	// alreadyScoped / wrap 使用的选择器
	sel: string,
// 函数体开始（无显式返回类型）
) {
	// 已在监听则跳过，避免重复 MO
	if (hmrStyleObservers.has(el)) return;
	// 子树/字符变化时检查是否需重新隔离
	const mo = new MutationObserver(() => {
		// owner 已不是本 realm 则忽略（可能被其它插件接管）
		if (el.dataset.mfStyleOwner !== realm) return;
		// 读最新 CSS 文本
		const text = el.textContent ?? '';
		// 有内容且不再带本 sel 的 @scope → 清标记并重跑 scope
		if (text.trim() && !alreadyScoped(text, sel)) {
			// 去掉 mfScoped，允许 scopeStyleElement 重写
			delete el.dataset.mfScoped;
			// 再次 wrap/@scope
			scopeStyleElement(el, realm, entryOrigin);
		// 结束需重 scope 分支
		}
	// 结束 MutationObserver 回调
	});
	// 记下 MO，供 has 判断与生命周期
	hmrStyleObservers.set(el, mo);
	// 观察子节点、字符数据与子树，覆盖 Vite HMR 换文
	mo.observe(el, { childList: true, characterData: true, subtree: true });
// 结束 looksLikeRemoteStyle 函数
}

// 对单个 style 写入 @scope 包裹并设置 mfScoped/mfStyleOwner/mfStyleOrigin
function scopeStyleElement(
	// 待处理的 HTMLStyleElement
	el: HTMLStyleElement,
	// 目标 realm 键，用于 @scope 根选择器与 dataset
	realm: string,
	// 可选 entry origin，写入 mfStyleOrigin 供后续 reclaim
	entryOrigin?: string,
// 函数体开始
) {
	// 首次读取 textContent，尽早拦截 Host 关键 CSS
	const text0 = el.textContent ?? '';
	// 含 sonner 等 Host 关键规则则标记并退出
	if (isHostCriticalCss(text0)) {
		// 打 mfHostStyle=1
		el.dataset.mfHostStyle = '1';
		// 提前 return，不写入 @scope
		return;
	// 结束 Host 关键 CSS 分支
	}
	// 计算本 realm 的 @scope 根选择器
	const sel = scopeSelector(realm);
	// 再次读取 textContent（可能已被异步填充）
	const text = el.textContent ?? '';
	// 内容为空：Vite 可能先插空 style 再填 textContent
	if (!text.trim()) {
		// 立刻打 owner：CSS-in-JS 可能先 insertRule 再填 text
		// 先写入 owner=realm，CSSOM patch 才能知道归属
		el.dataset.mfStyleOwner = realm;
		// 标 scoped，避免被当成未处理节点反复进逻辑
		el.dataset.mfScoped = '1';
		// 有 origin 则一并写入
		if (entryOrigin) el.dataset.mfStyleOrigin = entryOrigin;
		// 已有 pending MO 则不再挂第二个
		if (pendingStyleObservers.has(el)) return;
		// 挂 MutationObserver 等待非空后再递归 scope
		const mo = new MutationObserver(() => {
			// observer 回调：检测 textContent 是否已有实质内容
			if ((el.textContent ?? '').trim()) {
				// 有内容则 disconnect 避免重复触发
				mo.disconnect();
				// 从 pending 表移除
				pendingStyleObservers.delete(el);
				// 递归调用完成 @scope 包裹
				scopeStyleElement(el, realm, entryOrigin);
			// 结束 observer 内 if 块
			}
		// 结束 MutationObserver 回调
		});
		// 登记 pending MO
		pendingStyleObservers.set(el, mo);
		// 监听 style 子树与字符数据变化
		mo.observe(el, {
			// observe 选项：childList
			childList: true,
			// observe 选项：characterData
			characterData: true,
			// observe 选项：subtree
			subtree: true,
		// 结束 mo.observe 配置对象
		});
		// 空内容分支 return，等待 observer 触发
		return;
	// 结束空 text 分支
	}
	// 已正确 scoped 到本 realm 则只补 origin 与 HMR 监听
	if (
		// 已标 mfScoped
		el.dataset.mfScoped === '1' &&
		// owner 仍是本 realm
		el.dataset.mfStyleOwner === realm &&
		// 文本已含本 sel 的 @scope
		alreadyScoped(text, sel)
	// 结束「已隔离」条件
	) {
		// 有 entryOrigin 则写入 mfStyleOrigin
		if (entryOrigin) el.dataset.mfStyleOrigin = entryOrigin;
		// 确保 HMR 监听已挂
		watchScopedStyleHmr(el, realm, entryOrigin, sel);
		// 已 scoped 分支 return
		return;
	// 结束 alreadyScoped 分支
	}
	// 正式把 CSS wrap 进 @scope 写回 textContent
	el.textContent = wrapWithScope(text, sel, realm);
	// 标记 mfScoped=1
	el.dataset.mfScoped = '1';
	// 写入 mfStyleOwner=realm
	el.dataset.mfStyleOwner = realm;
	// 有 entryOrigin 则写入 mfStyleOrigin
	if (entryOrigin) el.dataset.mfStyleOrigin = entryOrigin;
	// 挂上 HMR 重隔离监听
	watchScopedStyleHmr(el, realm, entryOrigin, sel);
// 结束 scopeStyleElement 函数
}

// 将 link[stylesheet] fetch 为内联 style 并 @scope，或复用已有副本
async function scopeLinkElement(
	// 待处理的 HTMLLinkElement
	el: HTMLLinkElement,
	// 目标 realm 键
	realm: string,
	// entry origin，写入 style/link 的 mfStyleOrigin
	entryOrigin: string,
// 函数体开始
) {
	// 读取 resolved href
	const href = el.href;
	// 无 href 则无法 fetch，直接返回
	if (!href) return;
	// 计算 @scope 根选择器
	const sel = scopeSelector(realm);
	// 查找 head 内是否已有同 href 的 data-mf-from-link style
	const existing = Array.from(
		// querySelectorAll 取所有 from-link 副本
		document.head.querySelectorAll('style[data-mf-from-link]'),
	// find 匹配 dataset.mfFromLink === href
	).find((s) => (s as HTMLElement).dataset.mfFromLink === href) as
		// 类型断言为 HTMLStyleElement | undefined
		| HTMLStyleElement
		// 结束 union 类型第二行
		| undefined;
	// 已存在同 href 副本则复用
	if (existing) {
		// 对已有 style 确保 realm 标记与 @scope 一致
		scopeStyleElement(existing, realm, entryOrigin);
		// link 打 mfScoped=1
		el.dataset.mfScoped = '1';
		// link 写 mfStyleOwner=realm
		el.dataset.mfStyleOwner = realm;
		// link 写 mfStyleOrigin=entryOrigin
		el.dataset.mfStyleOrigin = entryOrigin;
		// 禁用原 link 避免双份样式
		el.disabled = true;
		// 复用分支 return
		return;
	// 结束 existing 分支
	}
	// 同一 link 已按本 realm scoped 则跳过重复 fetch
	if (el.dataset.mfScoped === '1' && el.dataset.mfStyleOwner === realm) return;
	// 尝试跨域 fetch 外链 CSS
	try {
		// fetch href，omit credentials + cors
		const res = await fetch(href, { credentials: 'omit', mode: 'cors' });
		// HTTP 非 2xx 则放弃
		if (!res.ok) return;
		// 读取 CSS 文本
		const css = await res.text();
		// 创建内联 style 承载 scoped 内容
		const style = document.createElement('style');
		// 先禁用 link，避免 fetch 窗口内未隔离样式闪烁污染 Host
		// 立刻禁用原 link，缩短未隔离窗口
		el.disabled = true;
		// 写入 wrap 后的 CSS
		style.textContent = wrapWithScope(css, sel, realm);
		// style 打 mfScoped=1
		style.dataset.mfScoped = '1';
		// style 写 mfStyleOwner=realm
		style.dataset.mfStyleOwner = realm;
		// style 写 mfStyleOrigin=entryOrigin
		style.dataset.mfStyleOrigin = entryOrigin;
		// style 写 mfFromLink=href 供 dedupe
		style.dataset.mfFromLink = href;
		// 插在 link 之后保持 DOM 顺序
		el.insertAdjacentElement('afterend', style);
		// link 打 mfScoped=1
		el.dataset.mfScoped = '1';
		// link 写 mfStyleOwner=realm
		el.dataset.mfStyleOwner = realm;
		// link 写 mfStyleOrigin=entryOrigin
		el.dataset.mfStyleOrigin = entryOrigin;
	// fetch 失败（CORS/离线）静默忽略
	} catch {
		/* CORS / 离线：保持原 link，不阻断功能（隔离降级） */
	// 结束 scopeLinkElement 的 catch 块（体为 /* CORS / 离线 */）
	}
// 结束 scopeLinkElement 函数
}

// 处理新插入 head 的节点：style 同步 scope，link 异步 scopeLinkElement
function processNode(node: Node, ctx: CaptureCtx) {
	// 非 HTMLElement（如 Text）直接忽略
	if (!(node instanceof HTMLElement)) return;
	// style 节点走 scopeStyleElement 分支
	if (node instanceof HTMLStyleElement) {
		// 非 Remote 样式则跳过
		if (!looksLikeRemoteStyle(node, ctx)) return;
		// 同步 @scope 并写 dataset
		scopeStyleElement(node, ctx.realm, ctx.entryOrigin);
		// style 分支 return
		return;
	// 结束 HTMLStyleElement 分支
	}
	// link[rel=stylesheet] 走异步 scopeLinkElement
	if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
		// 非 Remote 样式则跳过
		if (!looksLikeRemoteStyle(node, ctx)) return;
		// void 触发 async fetch+scope，不阻塞 DOM 插入
		void scopeLinkElement(node, ctx.realm, ctx.entryOrigin);
	// 结束 HTMLLinkElement 分支
	}
// 结束 processNode 函数
}

/** 挂载时把 head 里已注入、同 entry 的样式收回当前 realm（修复切换插件后无样式） */
// 挂载时扫描 head，把同源 Remote 样式收回当前 realm
function reclaimEntryStyles(ctx: CaptureCtx) {
	// 先修复可能被误包的 Host 关键样式
	repairHostCriticalStyles();
	// 收集 head 内所有 style 与 stylesheet link
	const nodes = document.head.querySelectorAll('style, link[rel="stylesheet"]');
	// 逐个节点尝试 reclaim
	for (const node of nodes) {
		// 类型收窄：仅处理 style 或 link
		if (
			// 条件：非 HTMLStyleElement 且非 HTMLLinkElement
			!(node instanceof HTMLStyleElement || node instanceof HTMLLinkElement)
		// 结束类型判断复合条件
		) {
			// 非目标节点 continue
			continue;
		// 结束类型收窄 if 块
		}
		// reclaim 模式：只认领有明确 Remote 标记的节点
		if (!looksLikeRemoteStyle(node, ctx, 'reclaim')) continue;
		// style 节点同步 scope
		if (node instanceof HTMLStyleElement) {
			// 调用 scopeStyleElement
			scopeStyleElement(node, ctx.realm, ctx.entryOrigin);
		// link 节点异步 scope
		} else {
			// void scopeLinkElement
			void scopeLinkElement(node, ctx.realm, ctx.entryOrigin);
		// 结束 style/link 分支
		}
	// 结束 for 循环
	}
// 结束 reclaimEntryStyles 函数
}

/* -------------------- CSSOM insertRule（CSS-in-JS） -------------------- */

// CSSOM insertRule patch 引用计数
let cssomPatchDepth = 0;
// 保存 CSSStyleSheet.prototype.insertRule 原函数
let origInsertRule: typeof CSSStyleSheet.prototype.insertRule | null = null;

// 从 stylesheet 的 ownerNode 读 mfStyleOwner 作为 realm
function sheetOwnerRealm(sheet: CSSStyleSheet): string | null {
	// CSSOM sheet 对应的 DOM 节点
	const owner = sheet.ownerNode;
	// 非 style 标签拥有的 sheet 不走此 patch 语义
	if (!(owner instanceof HTMLStyleElement)) return null;
	// Host 关键 style 上的规则不改写
	if (owner.dataset.mfHostStyle === '1') return null;
	// 返回 dataset 上的 owner realm，无则 null
	return owner.dataset.mfStyleOwner || null;
// 结束 sheetOwnerRealm
}

// 确保 CSSStyleSheet.insertRule 被包一层 @scope 转译
function ensureCssomPatch() {
	// 已 patch：只增加深度，避免重复替换 prototype
	if (cssomPatchDepth > 0) {
		// 嵌套引用 +1
		cssomPatchDepth += 1;
		// 已装过则返回
		return;
	// 结束已 patch 分支
	}
	// 保存原生 insertRule
	origInsertRule = CSSStyleSheet.prototype.insertRule;
	// 替换为会按 owner realm 转译的实现
	CSSStyleSheet.prototype.insertRule = function mfInsertRule(
		// 待插入的 CSS 规则文本
		rule: string,
		// 可选插入下标
		index?: number,
	// 返回新规则索引；包装函数体开始
	): number {
		// 看本 sheet 是否属于某插件 realm
		const realm = sheetOwnerRealm(this);
		// 有 owner 则转译后再插入
		if (realm) {
			// 生成本 realm 的 scope 选择器
			const sel = scopeSelector(realm);
			// 单条规则 transpile 后写回局部 rule
			rule = transpileStyleRule(rule, sel, realm);
		// 结束有 realm 分支
		}
		// 调用原生 insertRule，保持 CSSOM 索引语义
		return origInsertRule!.call(this, rule, index);
	// 结束 mfInsertRule
	};
	// 深度置 1，标记 patch 已装
	cssomPatchDepth = 1;
// 结束 ensureCssomPatch
}

// 减少 CSSOM patch 引用；到 0 时恢复原生 insertRule
function releaseCssomPatch() {
	// 未装过则无操作
	if (cssomPatchDepth <= 0) return;
	// 引用计数 -1
	cssomPatchDepth -= 1;
	// 仍有其它捕获窗口持有 patch 则不卸载
	if (cssomPatchDepth > 0) return;
	// 仅当当前仍是我们的包装函数时才还原，避免误伤他人 patch
	if (origInsertRule && CSSStyleSheet.prototype.insertRule !== origInsertRule) {
		// 恢复原型上的原生 insertRule
		CSSStyleSheet.prototype.insertRule = origInsertRule;
	// 结束仍是我们包装的分支
	}
	// 清空保存的原函数引用
	origInsertRule = null;
// 结束 releaseCssomPatch
}

// 首次调用 patch head.appendChild/insertBefore；嵌套 begin 只增 patchDepth
function ensureHeadPatch() {
	// 已在 patch 栈内：仅递增深度
	if (patchDepth > 0) {
		// 嵌套 beginPluginStyleCapture 时再进入：仅递增引用计数
		patchDepth += 1;
		// 嵌套 capture 不重复替换方法，直接 return
		return;
	// 结束 patchDepth > 0 分支
	}
	// 取得 document.head 引用
	const head = document.head;
	// 绑定并缓存原生 appendChild
	origAppend = head.appendChild.bind(head) as typeof origAppend;
	// 绑定并缓存原生 insertBefore
	origInsert = head.insertBefore.bind(head) as typeof origInsert;

	// 替换 head.appendChild：插入后若 active 存在则 processNode
	head.appendChild = function appendScoped<T extends Node>(node: T): T {
		// 先走原生 appendChild 完成 DOM 插入
		const ret = origAppend(node);
		// 取当前捕获栈顶
		const ctx = activeCtx();
		// 在捕获窗口内则尝试隔离该节点
		if (ctx) processNode(node, ctx);
		// 返回原生 appendChild 的返回值
		return ret;
	// 结束 appendScoped 函数赋值
	};

	// 替换 head.insertBefore：逻辑同 appendScoped
	head.insertBefore = function insertScoped<T extends Node>(
		// 待插入节点
		node: T,
		// 参考节点 ref
		ref: Node | null,
	// 返回类型 T
	): T {
		// 先走原生 insertBefore
		const ret = origInsert(node, ref);
		// 当前捕获上下文
		const ctx = activeCtx();
		// 有 ctx 则隔离
		if (ctx) processNode(node, ctx);
		// 返回原生 insertBefore 返回值
		return ret;
	// 结束 insertScoped 函数赋值
	};

	// 标记进入第一层 patch，patchDepth=1
	patchDepth = 1;
	// 同时装上 CSSOM insertRule patch
	ensureCssomPatch();
// 结束 ensureHeadPatch 函数
}

// 与 ensureHeadPatch 成对：递减 depth，归零时还原 head 原生方法
function releaseHeadPatch() {
	// patchDepth 已为 0 则 noop
	if (patchDepth <= 0) return;
	// 每次 end capture 递减嵌套深度
	patchDepth -= 1;
	// 仍有外层 capture 持有 patch，暂不还原
	if (patchDepth > 0) return;
	// 还原 head.appendChild 为 origAppend
	document.head.appendChild = origAppend as typeof document.head.appendChild;
	// 还原 head.insertBefore 为 origInsert
	document.head.insertBefore = origInsert as typeof document.head.insertBefore;
	// 成对释放 CSSOM patch
	releaseCssomPatch();
// 结束 releaseHeadPatch 函数
}

/**
 * 在 loadRemote 前后包一层：捕获本次注入的 CSS 并 @scope 到 realm。
 */
// 开始插件样式捕获：设置 active、patch head、reclaim、MutationObserver；返回 end 函数
export function beginPluginStyleCapture(
	// 当前插件 id，用于 capture 栈匹配与 teardown 条件
	pluginId: string,
	// Remote entry URL，传入 styleRealmKey 与 entryOriginOf
	entry: string,
	// 可选 MF remote 名称，参与 realm 降级键计算
	remoteName?: string,
// 返回 teardown 函数，在插件 unmount 或 loadRemote 结束时调用
): () => void {
	// 计算本插件/shared Remote 的 realm 键
	const realm = styleRealmKey(entry, remoteName, pluginId);
	// 构造本次 capture 上下文对象
	const ctx: CaptureCtx = {
		// ctx.pluginId
		pluginId,
		// ctx.realm
		realm,
		// ctx.entryOrigin
		entryOrigin: entryOriginOf(entry),
	// 结束 CaptureCtx 字面量
	};
	// 压栈，使 activeCtx 指向本次加载
	captureStack.push(ctx);
	// patch head 插入方法以拦截新 style/link
	ensureHeadPatch();
	// 修复 head 内误包 @scope 的 Host 关键样式
	repairHostCriticalStyles();
	// reclaim 已注入的同 entry Remote 样式到当前 realm
	reclaimEntryStyles(ctx);

	// MutationObserver 监听 head 子树：新节点与 style 文本变更
	const obs = new MutationObserver((mutations) => {
		// 若栈顶已不是本 realm（嵌套其它 Remote）则忽略
		if (activeCtx()?.realm !== realm) return;
		// 遍历本次 batch 的 mutation 记录
		for (const m of mutations) {
			// 处理 addedNodes 中的新 style/link
			for (const n of m.addedNodes) processNode(n, ctx);
		// 结束 for (mutations) 循环
		}
	// 结束 MutationObserver 回调
	});
	// 只观察 childList，不做 subtree（空 style/HMR 由节点级 MO 负责）
	obs.observe(document.head, { childList: true });

	// 返回 teardown 闭包
	return () => {
		// 断开 MutationObserver
		obs.disconnect();
		// 从栈尾侧查找本 ctx，支持嵌套乱序结束
		const idx = captureStack.lastIndexOf(ctx);
		// 找到则删除该帧，避免残留 active
		if (idx >= 0) captureStack.splice(idx, 1);
		// release head patch（递减 patchDepth，可能还原原生方法）
		releaseHeadPatch();
	// 结束 teardown 闭包
	};
// 结束 beginPluginStyleCapture 函数
}

// Portal/Teleport 段：把挂到 document.body 的节点重定向进带 @scope 的插件 scope 容器
/* -------------------- Portal / Teleport → @scope -------------------- */

// 当前已 attach Portal 桥接的 pluginId 集合
const portalPlugins = new Set<string>();
/** pluginId → realm，Portal 容器需带 style-realm 才能吃到 CSS */
// pluginId → realm 映射，Portal 容器需带 data-mf-style-realm 才能匹配 @scope
const portalRealmByPlugin = new Map<string, string>();

// 原生 append 到 body 时跳过重定向的标签（资源/元数据/宿主专用标记）
const PORTAL_SKIP_TAGS = new Set([
	// 脚本须挂真实 body，重定向会破坏加载与执行顺序
	'SCRIPT',
	// 样式表由 head 捕获路径处理，不走 Portal 收编
	'STYLE',
	// 外链资源保持在 document 级，避免进 scope 失效
	'LINK',
	// 文档元信息必须留在 head/body 顶层
	'META',
	// 无脚本降级内容不应进插件 scope
	'NOSCRIPT',
	// 模板节点非可见 UI，勿当弹层收编
	'TEMPLATE',
	// <base> 影响整页 URL 解析，禁止挪动
	'BASE',
// 结束 PORTAL_SKIP_TAGS 集合字面量
]);

// 从 DOM 元素向上查找所属 pluginId
function claimIdFromElement(el: Element | null): string | null {
	// 无元素则无法认领
	if (!el) return null;
	// 查找最近的 data-mf-portal-scope 祖先
	const scope = el.closest('[data-mf-portal-scope]');
	// 在 portal-scope 子树内则读 scope 上的 pluginId
	if (scope) {
		// 读取 data-mf-portal-scope 属性值
		const id = scope.getAttribute('data-mf-portal-scope');
		// id 有效且插件仍注册 Portal 桥接则返回
		if (id && portalPlugins.has(id)) return id;
	// 结束 scope 分支
	}
	// 否则查插件主挂载根（排除 portal stamp/scope 节点自身）
	const root = el.closest(
		// closest 选择器：data-mf-plugin 且非 portal 标记节点
		'[data-mf-plugin]:not([data-mf-portal-stamp]):not([data-mf-portal-scope])',
	// 结束 closest 实参
	);
	// 从插件根读 data-mf-plugin
	const id = root?.getAttribute('data-mf-plugin');
	// 有效且已注册则返回 id，否则 null
	return id && portalPlugins.has(id) ? id : null;
// 结束 claimIdFromElement 函数
}

// 安装 document 级 pointerover/focusin，维护 lastTouchedPluginId
function ensureTouchBridge() {
	// 已安装或无 document（SSR）则跳过
	if (touchBridgeInstalled || typeof document === 'undefined') return;
	// 标记桥接已安装，避免重复 addEventListener
	touchBridgeInstalled = true;

	// 注册 pointerover 捕获阶段监听
	document.addEventListener(
		// 事件类型 pointerover
		'pointerover',
		// pointerover 回调
		(e) => {
			// 解析 pointer 进入侧所属 pluginId
			const to = claimIdFromElement(
				// e.target 转 Element 或 null 传入 claimIdFromElement
				e.target instanceof Element ? e.target : null,
			// 结束 claimIdFromElement(to) 实参
			);
			// 解析 pointer 离开侧（relatedTarget）所属 pluginId
			const from = claimIdFromElement(
				// relatedTarget 转 Element 或 null
				e.relatedTarget instanceof Element ? e.relatedTarget : null,
			// 结束 claimIdFromElement(from) 实参
			);
			// 仍在同一插件子树内移动则不更新，减少热路径写入
			if (to === from) return;
			// 跨插件边界时更新 lastTouchedPluginId
			lastTouchedPluginId = to;
		// 结束 pointerover 回调
		},
		// 捕获阶段 true
		true,
	// 结束 addEventListener(pointerover)
	);
	// 注册 focusin 捕获阶段监听
	document.addEventListener(
		// 事件类型 focusin
		'focusin',
		// focusin 回调
		(e) => {
			// 焦点进入时更新 lastTouchedPluginId
			lastTouchedPluginId = claimIdFromElement(
				// e.target 转 Element 传入 claimIdFromElement
				e.target instanceof Element ? e.target : null,
			// 结束 claimIdFromElement 实参
			);
		// 结束 focusin 回调
		},
		// 捕获阶段 true
		true,
	// 结束 addEventListener(focusin)
	);
// 结束 ensureTouchBridge 函数
}

/** 打开 Host Portal 外壳前的同步认领（不等 attach）；关闭时 clear */
// Host Drawer 等打开前强制认领的 pluginId，优先于 pointer/focus 推断
let portalClaimOverride: string | null = null;

// 解析 createPortal 应重定向到哪个 plugin 的 body portal 容器
function resolveClaimPluginId(): string | null {
	// 优先使用显式 portalClaimOverride
	if (
		// 条件：override 非空
		portalClaimOverride &&
		// 且 override 对应插件仍在 portalPlugins 或仍有 realm 映射
		(portalPlugins.has(portalClaimOverride) ||
			// 结束 portalRealmByPlugin.has 条件
			portalRealmByPlugin.has(portalClaimOverride))
	// 结束 override 复合条件
	) {
		// 命中则直接返回 override pluginId
		return portalClaimOverride;
	// 结束 override 分支
	}
	// 其次：最近一次 pointer/focus 关联且仍注册的插件
	if (lastTouchedPluginId && portalPlugins.has(lastTouchedPluginId)) {
		// 返回 lastTouchedPluginId
		return lastTouchedPluginId;
	// 结束 lastTouched 分支
	}
	// 再次：当前焦点元素所在插件
	const ae = document.activeElement;
	// 若焦点在 Element 上则尝试 claimIdFromElement
	if (ae instanceof Element) {
		// 解析焦点元素所属 pluginId
		const id = claimIdFromElement(ae);
		// 有 id 则返回
		if (id) return id;
	// 结束 focus 分支
	}
	// sticky：scope 里已有弹层时不要把 createPortal 打回 body（否则 Drawer/POP 重挂闪烁）
	// 见下行源码注释：sticky——scope 容器已有子节点时保持该 plugin，防 Drawer 重挂闪烁
	for (const id of portalPlugins) {
		// 查该 plugin 的 body portal-scope 容器
		const host = document.querySelector(
			// querySelector 带 cssEscapeIdent 转义 id
			`[data-mf-portal-scope="${cssEscapeIdent(id)}"]`,
		// 结束 querySelector 实参
		);
		// 容器存在、非空且自身或子孙仍 hover 才 sticky
		if (
			// host 必须是 HTMLElement
			host instanceof HTMLElement &&
			// 有 Portal 子树才值得 sticky
			host.childElementCount > 0 &&
			// matches/querySelector :hover 覆盖弹层悬停
			(host.matches(':hover') || host.querySelector(':hover'))
		// 结束 hover 判断
		) {
			// 返回仍悬停的插件 id
			return id;
		// 结束 if (host ...)
		}
	// 结束 for (portalPlugins) 循环
	}
	// 所有策略均未命中则 null，createPortal 保持挂 body
	return null;
// 结束 resolveClaimPluginId 函数
}

/**
 * 在 Host 打开会 Portal 的外壳（如 Drawer）之前同步认领，
 * 让首帧 createPortal 就进 scope，避免「先 body 再搬进 scope」整树重挂闪烁。
 */
// Host 外壳 Portal 打开前同步设置 claim、realm 并确保 body scope 容器
export function claimPluginPortalTarget(pluginId: string, realm: string): void {
	// 确保 pointer/focus 桥接已安装
	ensureTouchBridge();
	// 确保 createPortal 已被 patch
	ensureCreatePortalPatch();
	// 安装 Node/Element body 挂载原型 patch
	ensureBodyPortalPatch();
	// 记录 pluginId → realm 供 Portal 容器写 data-mf-style-realm
	portalRealmByPlugin.set(pluginId, realm);
	// 设置同步认领 override，首帧 createPortal 即用
	portalClaimOverride = pluginId;
	// 同步更新 lastTouchedPluginId
	lastTouchedPluginId = pluginId;
	// 创建或更新 body 下零尺寸 portal-scope 容器
	ensureBodyPortalScope(pluginId);
// 结束 claimPluginPortalTarget 函数
}

// 清除同步认领；可指定 pluginId，仅 override 匹配时才清
export function clearPluginPortalClaim(pluginId?: string | null): void {
	// 指定了 pluginId 且 override 不是它则 noop（避免误清新插件 claim）
	if (pluginId && portalClaimOverride !== pluginId) return;
	// 清空 portalClaimOverride
	portalClaimOverride = null;
	// 若无活跃插件且无 override，尝试还原 body 原型
	maybeReleaseBodyPortalPatch();
// 结束 clearPluginPortalClaim 函数
}

// 获取或创建 body 下某插件零尺寸 portal-scope 容器，同步 data-mf-style-realm
function ensureBodyPortalScope(pluginId: string): HTMLElement {
	// 构造 portal-scope 容器 querySelector
	const sel = `[data-mf-portal-scope="${cssEscapeIdent(pluginId)}"]`;
	// 查找是否已有容器
	let el = document.querySelector(sel) as HTMLElement | null;
	// 读取该 plugin 当前 realm
	const realm = portalRealmByPlugin.get(pluginId);
	// 容器已存在分支
	if (el) {
		// realm 变更时更新 data-mf-style-realm，保证 @scope 仍匹配
		if (realm && el.getAttribute('data-mf-style-realm') !== realm) {
			// 写入最新 realm 属性
			el.setAttribute('data-mf-style-realm', realm);
		// 结束 realm 更新 if 块
		}
		// 返回已有容器
		return el;
	// 结束 el 已存在分支
	}
	// 不存在则创建新 div 容器
	el = document.createElement('div');
	// 标记 data-mf-plugin
	el.setAttribute('data-mf-plugin', pluginId);
	// 有 realm 则写 data-mf-style-realm
	if (realm) el.setAttribute('data-mf-style-realm', realm);
	// 写 data-mf-portal-scope=pluginId 供 claimIdFromElement
	el.setAttribute('data-mf-portal-scope', pluginId);
	// 打 mfPortalStamp 排除 closest 插件根误判
	el.dataset.mfPortalStamp = '1';
	// 零尺寸绝对定位样式：不占布局，Portal 内容 overflow:visible
	el.style.cssText =
		// cssText 赋值：position/size/z-index 详见字符串
		'position:absolute;left:0;top:0;width:0;height:0;overflow:visible;z-index:2147503646;';
	// 置 busy：append 自身触发的 body patch 不再递归重定向
	bodyPatchBusy = true;
	// try/finally 保证 busy 一定复位
	try {
		// 挂到 body；经 patch 时因 busy 走原生 append
		document.body.appendChild(el);
	// finally 块
	} finally {
		// 清除 busy，恢复对外部 Portal append 的拦截
		bodyPatchBusy = false;
	// 结束 try/finally
	}
	// 返回新建容器
	return el;
// 结束 ensureBodyPortalScope 函数
}

// 插件卸载时移除 body 下对应 portal-scope 容器
function removeBodyPortalScope(pluginId: string) {
	// 查找并 remove portal-scope 节点
	document
		// querySelector 带转义 pluginId
		.querySelector(`[data-mf-portal-scope="${cssEscapeIdent(pluginId)}"]`)
		// 可选链 remove
		?.remove();
// 结束 removeBodyPortalScope 函数
}

// 判断 Portal 目标是否为 body 或 documentElement（需重定向进 scope）
function isBodyPortalTarget(
	// createPortal 的 container 参数
	container: Element | DocumentFragment | null | undefined,
// 返回是否为 body/html 根挂载点
): boolean {
	// body 或 documentElement 即 true
	return container === document.body || container === document.documentElement;
// 结束 isBodyPortalTarget
}

// 判断原生 append 的节点是否应跳过重定向（资源/宿主/scope 自身）
function shouldSkipPortalNode(node: Node): boolean {
	// DocumentFragment 需继续处理（React 18 可能 portal 到 fragment）
	if (node instanceof DocumentFragment) return false;
	// 非 Element 节点（文本等）跳过
	if (!(node instanceof Element)) return true;
	// head 资源类标签不应收编进插件 scope
	if (PORTAL_SKIP_TAGS.has(node.tagName)) return true;
	// portal scope 容器自身不再重定向
	if (node.hasAttribute('data-mf-portal-scope')) return true;
	// stamp 占位节点跳过
	if (node.hasAttribute('data-mf-portal-stamp')) return true;
	// Host Sonner toaster 永不收编
	if (node.hasAttribute('data-sonner-toaster')) return true;
	// Host 专用 portal 标记节点跳过
	if (node.hasAttribute('data-mf-host-portal')) return true;
	// 其余 Element 可参与重定向
	return false;
// 结束 isBodyPortalTarget 函数
}

// body/html 目标且能解析 pluginId 时，替换为 ensureBodyPortalScope 容器
function retargetPortalContainer(
	// createPortal 原始 container
	container: Element | DocumentFragment,
// 返回重定向后或原样的 container
): Element | DocumentFragment {
	// 非 body/html 目标直接返回原 container
	if (!isBodyPortalTarget(container)) return container;
	// Host 自身 portal 外壳不重定向，避免 Host UI 进 Remote @scope
	if (
		// 条件：container 是 Element
		container instanceof Element &&
		// 且在 data-mf-host-portal 子树内
		container.closest('[data-mf-host-portal]')
	// 结束 Host portal 排除复合条件
	) {
		// 命中则保持原 container
		return container;
	// 结束 Host portal 分支
	}
	// 解析应认领的 pluginId
	const id = resolveClaimPluginId();
	// 无法认领则保持挂 body
	if (!id) return container;
	// 返回该 plugin 的 body portal-scope 容器
	return ensureBodyPortalScope(id);
// 结束 retargetPortalContainer 函数
}

// 是否已对 ReactDOM.createPortal 做过 monkey-patch
let createPortalPatched = false;
// 保存原始 createPortal，patch 内委托调用
let origCreatePortal: typeof ReactDOM.createPortal | null = null;

/** Host Toaster 等：children 可识别时永不收编，避免 lastTouched 误伤 */
// 见上行 JSDoc：识别 Host Toaster 等受保护 children，避免被 lastTouched 误收编
function isHostProtectedPortalChildren(children: ReactNode): boolean {
	// 非单一 React 元素则无法从 props 识别，不保护
	if (!isValidElement(children)) return false;
	// 收窄 props 类型以读 data-* 与 className
	const p = children.props as {
		// className 字段
		className?: string;
		// Sonner toaster 标记
		'data-sonner-toaster'?: unknown;
		// Host portal 标记
		'data-mf-host-portal'?: unknown;
	// 结束 props 类型
	};
	// 显式 Host portal/toaster 标记则保护
	if (p['data-sonner-toaster'] != null || p['data-mf-host-portal'] != null) {
		// 命中 data 属性则走原生 createPortal 到 body
		return true;
	// 结束 data 属性保护 if 块
	}
	// 读 className
	const cn = p.className;
	// class 含 toaster 词也视为 Host 全局 toast 容器
	return typeof cn === 'string' && /\btoaster\b/.test(cn);
// 结束 isHostProtectedPortalChildren
}

// 一次性 patch ReactDOM.createPortal，body Portal 重定向到插件 scope
function ensureCreatePortalPatch() {
	// 已 patch 则直接返回
	if (createPortalPatched) return;
	// 标记已 patch，防止重复替换
	createPortalPatched = true;
	// 绑定并缓存原生 createPortal
	origCreatePortal = ReactDOM.createPortal.bind(ReactDOM);
	// 替换为包装函数：必要时 retarget container 再委托 origCreatePortal
	ReactDOM.createPortal = ((children, container, key) => {
		// Host 受保护 children 永不改 container
		if (isHostProtectedPortalChildren(children)) {
			// 委托原生 createPortal
			return origCreatePortal!(children, container as Element, key);
		// 结束 protected 分支
		}
		// 有 portal 插件注册或同步 claim 时才尝试 retarget
		const next =
			// 条件：portalPlugins 非空或 portalClaimOverride 存在
			portalPlugins.size > 0 || portalClaimOverride
				// 是则 retargetPortalContainer(container)
				? retargetPortalContainer(container as Element | DocumentFragment)
				// 否则保持原 container
				: container;
		// 委托原生 createPortal(children, next, key)
		return origCreatePortal!(children, next as Element, key);
	// 结束 createPortal 包装箭头函数
	}) as typeof ReactDOM.createPortal;
// 结束 ensureCreatePortalPatch 函数
}

/** Vue Teleport / 原生 append 到 body：与 createPortal 同一套认领，框架无关 */
// 见上行 JSDoc：Vue Teleport / 原生 append 与 createPortal 共用认领逻辑
let bodyPortalPatched = false;
// body 原型 patch 是否已安装
let bodyPatchBusy = false;
// patch 内部 append scope 容器时置 true，防止递归重定向
let origBodyAppend: typeof Node.prototype.appendChild | null = null;
// 保存 Node.prototype.appendChild
let origBodyInsert: typeof Node.prototype.insertBefore | null = null;
// 保存 Node.prototype.insertBefore
let origBodyAppendFn: typeof Element.prototype.append | null = null;
// 保存 Element.prototype.append
let origBodyPrepend: typeof Element.prototype.prepend | null = null;
// 保存 Element.prototype.prepend
let origBodyRemove: typeof Node.prototype.removeChild | null = null;
// 保存 Node.prototype.removeChild（镜像 retarget 卸载）
let origBodyReplace: typeof Node.prototype.replaceChild | null = null;

/**
 * append 被重定向到 portal scope 后，调用方仍可能对 body 做 remove/replace。
 * 若 child 实际父节点已变，改从实际父节点操作，避免 NotFoundError。
 */
function resolveRetargetedChildParent(assumedParent: Node, child: Node): Node {
	// 读 child 当前真实父节点
	const actual = child.parentNode;
	// 已挂到别的父节点（典型：portal scope）则改用实际父
	return actual && actual !== assumedParent ? actual : assumedParent;
	// 结束 resolveRetargetedChildParent
}

// 保存 Element.prototype.prepend（历史讲解注释位置；现行源码见上 origBodyPrepend）
function retargetBodyMount(parent: Node, node: Node): Node {
	// 原生 append 到 body 时：按认领把 parent 换成插件 scope 容器
	if (bodyPatchBusy) return parent;
	// patch 自身正在 append scope 节点时不改写 parent
	if (parent !== document.body && parent !== document.documentElement) {
		// 仅 body/documentElement 作为 parent 才参与重定向
		return parent;
		// parent 非 body 则原样返回
	}
	// 结束 parent 非 body 分支
	if (portalPlugins.size === 0 && !portalClaimOverride) return parent;
	// 无活跃 Portal 且无预认领则不改 parent
	if (shouldSkipPortalNode(node)) return parent;
	// 应跳过的节点类型保持挂到 body
	return retargetPortalContainer(parent as Element);
	// 否则按 retargetPortalContainer 解析 scope 容器作为 parent
}

// 结束 retargetBodyMount
function ensureBodyPortalPatch() {
	// patch Node/Element 原型：拦截所有框架的 body 级 DOM 挂载
	if (bodyPortalPatched) return;
	// 已 patch 则返回
	bodyPortalPatched = true;
	// 标记 body patch 已安装
	origBodyAppend = Node.prototype.appendChild;
	// 缓存 appendChild
	origBodyInsert = Node.prototype.insertBefore;
	// 缓存 insertBefore
	origBodyAppendFn = Element.prototype.append;
	// 缓存 Element.append
	origBodyPrepend = Element.prototype.prepend;
	// 缓存 Element.prepend
	origBodyRemove = Node.prototype.removeChild;
	// 缓存 removeChild
	origBodyReplace = Node.prototype.replaceChild;
	// 缓存 replaceChild

	Node.prototype.appendChild = function mfAppendChild<T extends Node>(
		// 包装 Node.prototype.appendChild
		node: T,
		// appendChild 的 node 参数
	): T {
		// appendChild 包装函数体开始
		if (
			// 早退条件：busy / 非 body / 无 Portal
			bodyPatchBusy ||
			// bodyPatchBusy
			(this !== document.body && this !== document.documentElement) ||
			// this 非 body/documentElement
			(portalPlugins.size === 0 && !portalClaimOverride)
			// 无 portalPlugins 且无 override
		) {
			// 结束早退条件
			return origBodyAppend!.call(this, node) as T;
			// 走原生 appendChild
		}
		// 结束早退 if 块
		const parent = retargetBodyMount(this, node);
		// retargetBodyMount 解析 parent
		return origBodyAppend!.call(parent, node) as T;
		// 向 scope 容器 appendChild
	};

	// 结束 appendChild 包装
	Node.prototype.insertBefore = function mfInsertBefore<T extends Node>(
		// 包装 Node.prototype.insertBefore
		node: T,
		// insertBefore 的 node 参数
		ref: Node | null,
		// ref 参数
	): T {
		// insertBefore 包装函数体开始
		if (
			// 早退条件同 appendChild
			bodyPatchBusy ||
			// bodyPatchBusy
			(this !== document.body && this !== document.documentElement) ||
			// 非 body parent
			(portalPlugins.size === 0 && !portalClaimOverride)
			// 无 Portal 活跃
		) {
			// 结束早退条件
			return origBodyInsert!.call(this, node, ref) as T;
			// 原生 insertBefore
		}
		// 结束早退 if 块
		const parent = retargetBodyMount(this, node);
		// retarget parent
		if (parent !== this) return origBodyAppend!.call(parent, node) as T;
		// parent 变则 appendChild 到 scope
		return origBodyInsert!.call(this, node, ref) as T;
		// parent 未变则原生 insertBefore
	};

	// 结束 insertBefore 包装
	// 镜像 remove：body.removeChild 时若节点已被 append 重定向，从实际父节点卸下
	Node.prototype.removeChild = function mfRemoveChild<T extends Node>(
		// 待移除子节点
		child: T,
		// 返回被移除节点
	): T {
		// busy 或非 body/html：原生路径
		if (
			bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement)
		) {
			return origBodyRemove!.call(this, child) as T;
		}
		// 解析可能被 retarget 后的实际父节点
		const parent = resolveRetargetedChildParent(this, child);
		return origBodyRemove!.call(parent, child) as T;
	};

	// 镜像 replace：与 removeChild 同理，避免 body.replaceChild 找不到节点
	Node.prototype.replaceChild = function mfReplaceChild<T extends Node>(
		// 新节点
		node: Node,
		// 旧节点
		child: T,
		// 返回被替换的旧节点
	): T {
		if (
			bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement)
		) {
			return origBodyReplace!.call(this, node, child) as T;
		}
		const parent = resolveRetargetedChildParent(this, child);
		// 旧节点在 scope 内：在实际父上 replace；新节点若仍走 body append 路径由其它 patch 处理
		return origBodyReplace!.call(parent, node, child) as T;
	};

	Element.prototype.append = function mfAppend(
		// 包装 Element.prototype.append
		...nodes: (Node | string)[]
		// 可变 nodes 参数
	): void {
		// append 包装函数体开始
		if (
			// 早退条件
			bodyPatchBusy ||
			// bodyPatchBusy
			(this !== document.body && this !== document.documentElement) ||
			// 非 body
			(portalPlugins.size === 0 && !portalClaimOverride)
			// 无 Portal
		) {
			// 结束早退条件
			origBodyAppendFn!.apply(this, nodes);
			// 原生 append 全部入参
			return;
			// return 结束早退
		}
		// 结束早退 if 块
		for (const n of nodes) {
			// for 逐节点 retarget
			if (typeof n === 'string') {
				// 字符串节点直接 append
				origBodyAppendFn!.call(this, n);
				// 原生 append 字符串
				continue;
				// continue 下一节点
			}
			// 结束字符串 if 块
			const parent = retargetBodyMount(this, n);
			// Element 节点走 retargetBodyMount
			if (parent !== this) origBodyAppend!.call(parent, n);
			// parent 变则 appendChild 到 scope
			else origBodyAppendFn!.call(this, n);
			// 否则 Element.append 到 this
		}
		// 结束 for 循环
	};

	// 结束 append 包装赋值
	Element.prototype.prepend = function mfPrepend(
		// 包装 Element.prepend，逻辑与 append 对称
		...nodes: (Node | string)[]
		// 可变 nodes 参数
	): void {
		// prepend 包装函数体开始
		if (
			// 早退条件
			bodyPatchBusy ||
			// bodyPatchBusy
			(this !== document.body && this !== document.documentElement) ||
			// 非 body
			(portalPlugins.size === 0 && !portalClaimOverride)
			// 无 Portal
		) {
			// 结束早退条件
			origBodyPrepend!.apply(this, nodes);
			// 原生 prepend 全部入参
			return;
			// return 结束早退
		}
		// 结束早退 if 块
		for (const n of nodes) {
			// for 逐节点处理
			if (typeof n === 'string') {
				// 字符串节点直接 prepend
				origBodyPrepend!.call(this, n);
				// 原生 prepend 字符串节点
				continue;
				// continue
			}
			// 结束字符串 if 块
			const parent = retargetBodyMount(this, n);
			// Element 节点 retarget
			if (parent !== this) origBodyAppend!.call(parent, n);
			// parent 变则 appendChild（prepend 语义简化为 append）
			else origBodyPrepend!.call(this, n);
			// parent 未变则 prepend
		}
		// 结束 for 循环
	};
	// 结束 prepend 包装赋值
}

// 结束 ensureBodyPortalPatch
function maybeReleaseBodyPortalPatch() {
	// 无活跃 Portal 且无预认领时还原 body 原型，避免污染全局 DOM API
	if (!bodyPortalPatched) return;
	// 未 patch 则无需释放
	if (portalPlugins.size > 0 || portalClaimOverride) return;
	// 仍有插件或 override 时保持 patch
	if (origBodyAppend) Node.prototype.appendChild = origBodyAppend;
	// 还原 appendChild
	if (origBodyInsert) Node.prototype.insertBefore = origBodyInsert;
	// 还原 insertBefore
	if (origBodyAppendFn) Element.prototype.append = origBodyAppendFn;
	// 还原 Element.append
	if (origBodyPrepend) Element.prototype.prepend = origBodyPrepend;
	// 还原 Element.prepend
	if (origBodyRemove) Node.prototype.removeChild = origBodyRemove;
	// 还原 removeChild
	if (origBodyReplace) Node.prototype.replaceChild = origBodyReplace;
	// 还原 replaceChild
	origBodyAppend = null;
	// 清空保存的 appendChild 引用
	origBodyInsert = null;
	// 清空 insertBefore
	origBodyAppendFn = null;
	// 清空 append
	origBodyPrepend = null;
	// 清空 prepend
	origBodyRemove = null;
	// 清空 removeChild
	origBodyReplace = null;
	// 清空 replaceChild
	bodyPortalPatched = false;
	// 允许下次 attach 重新 patch
}

// 插件页挂载期间注册 Portal 桥接；返回 cleanup
function attachPortalScopeBridge(pluginId: string, realm: string): () => void {
	// 确保 pointer/focus 桥接已安装
	ensureTouchBridge();
	// 确保 createPortal 已被 patch
	ensureCreatePortalPatch();
	// patch React createPortal
	ensureBodyPortalPatch();
	// 注册 pluginId 到 portalPlugins
	portalPlugins.add(pluginId);
	// 写入 pluginId → realm 映射
	portalRealmByPlugin.set(pluginId, realm);
	// 初始化 lastTouchedPluginId
	lastTouchedPluginId = pluginId;
	// 确保 body portal-scope 容器存在
	ensureBodyPortalScope(pluginId);
	// 返回 unmount cleanup 闭包
	return () => {
		// 从 portalPlugins 移除
		portalPlugins.delete(pluginId);
		// 删除 realm 映射
		portalRealmByPlugin.delete(pluginId);
		// 移除 body portal-scope DOM
		removeBodyPortalScope(pluginId);
		// 若 lastTouched 正是本 plugin 则清 null
		if (lastTouchedPluginId === pluginId) lastTouchedPluginId = null;
		// 若 lastTouched 指向本插件则清空
		maybeReleaseBodyPortalPatch();
	// 结束 cleanup 闭包
	};
// 结束 attachPortalScopeBridge 函数
}

/**
 * 插件页挂载期间继续隔离（HMR / 延迟 CSS）+ Portal/Teleport 静默纳入 @scope。
 */
// 组合 CSS capture 与 Portal 桥接；插件页 mount 调用，unmount 执行返回 cleanup
export function attachPluginStyleIsolation(
	// 插件 id
	pluginId: string,
	// Remote entry URL
	entry: string,
	// 可选 remote 名称
	remoteName?: string,
// 返回 teardown：先 endPortal 再 endCss
): () => void {
	// 计算共享 realm 键
	const realm = styleRealmKey(entry, remoteName, pluginId);
	// 启动 CSS capture，得到 endCss
	const endCss = beginPluginStyleCapture(pluginId, entry, remoteName);
	// 启动 Portal 桥接，得到 endPortal
	const endPortal = attachPortalScopeBridge(pluginId, realm);
	// 返回组合 teardown
	return () => {
		// 先 teardown Portal（createPortal/容器/claim）
		endPortal();
		// 再 teardown CSS capture（observer/head patch/active）
		endCss();
	// 结束 teardown 闭包
	};
// 结束 attachPluginStyleIsolation 函数
}

/** @internal smoke / 自检用 */
// 见上行 JSDoc：导出内部 transpile/scope 工具供 smoke 自检
export const __styleIsolationTest = {
	// CSS 全文 @scope 包装入口
	transpileStyleText,
	// 单条 CSSOM rule 改写
	transpileStyleRule,
	// 从已 scope 文本还原
	unwrapScope,
	// 生成 [data-mf-style-realm=…] 选择器
	scopeSelector,
	// 生成 realm 专属 @keyframes 前缀
	kfPrefixForRealm,
	// body.removeChild 镜像：解析 retarget 后的实际父节点
	resolveRetargetedChildParent,
	// 结束 __styleIsolationTest 对象
};
```
##### 10.20.0.5 边界与验收

| 场景                  | 行为                                                              |
| --------------------- | ----------------------------------------------------------------- |
| 浏览器不支持 `@scope` | 规则被忽略 → 样式变全局（功能可用，隔离失效）；目标浏览器均已支持 |
| link CORS 失败        | 原 link 仍生效，可能泄漏全局；partner 应开 CORS 或把 CSS 打进 JS  |
| 忘记 `data-mf-style-realm` / `data-mf-plugin` | scoped 规则匹配不到插件 UI → **子应用看起来没样式**               |
| 同 Remote 多插件切换  | `reclaimEntryStyles` 后两插件应都能吃到同一份 CSS（同一 realm）   |
| Portal POP / Drawer 闪烁 | sticky 改为 scope `:hover` + Drawer 打开前 `claimPluginPortalTarget` |
| Host Toaster 顶开布局 / 误进 scope | critical CSS 检测 + `data-mf-host-portal` + Toaster children 识别永不收编 |
| Vue Teleport / 非 React 弹层无样式 | body 原型挂载劫持与 `createPortal` 同一套认领 |
| antd Modal/Drawer 打开崩溃（`getScrollBarSize` / `NotFoundError`） | body `removeChild`/`replaceChild` 镜像到实际父节点（`resolveRetargetedChildParent`） |
| CSS-in-JS 全局泄漏 | `insertRule` → `transpileStyleRule`（需 style 已打 `mfStyleOwner`） |
| `@font-face` / 动画异常 | hoist 出 scope；keyframes 按 realm 前缀 |
| MF 内毛玻璃失效、独立预览正常 | 圆角容器同层 `overflow-hidden` 裁切了 `backdrop-filter` 采样；见 §2.10.0 / §2.14.4 |
| `untrusted`           | 不调用本模块；sandbox iframe                                      |
| 打开笔记后再进设置    | Host 字体/标签不应被 Remote Preflight 改坏                        |

验收（手工）：

1. 英语学习 → 学习笔记：按钮有主题样式。
2. 再进设置页：主站样式正常。
3. 学习笔记 ↔ 视频播放器（同 Remote）：切换后双方样式仍正常。
4. 视频底栏 POP：鼠标移入不闪；滤镜/音量轨道有色。
5. 电子书「全书划线」Drawer：首次打开不闪。
6. Host Toast：仍右上角 fixed，不顶开布局；插件弹层打开时 Toast 仍挂 Host。
7. Remote 内 antd Modal / Drawer：打开不抛 `NotFoundError`（`getScrollBarSize`）。
8. `apps/micro` 独立预览（:9008）仍用标准 Tailwind。
9. 视频播放器嵌入 Host：控制条 / POP 上 `backdrop-filter` 仍能模糊到画面（非纯灰底）。
10. 转译自检：`pnpm --filter @dnhyxc-ai/frontend exec tsx src/plugins/host/styleIsolation.smoke.ts`。

##### 10.10.0.5 明确不做

- 不要求 Remote 构建期去掉 Preflight / 嵌套 `@tailwind utilities`。
- 不恢复「半套 Shadow + 只搬 head」。
- 不把全体第一方改成 iframe。
- 不要求业务改 `getPopupContainer` / 传 portal `container`（由 Host `createPortal` + body 挂载收编）。
- 不在 reclaim 时认领无标记的裸 `<style>`（避免误伤 Host）。
- 不强制 Shadow DOM（会断主题变量继承）。

---

### 2.11 路由构建与初始化

**文件路径**：`apps/frontend/src/router/buildRoutes.ts`、`apps/frontend/src/router/index.tsx`

#### 2.11.1 问题：刷新子应用路径先闪 404

| 项                 | 说明                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **现象**           | 硬刷新 `/video-player` 等 `injectRoute` 插件路径时，先出现 Host「404 Not Found」，再渲染子应用页                                                                                                                                                                                |
| **根因**           | 插件路由由 `pluginManager.init()` **异步**注入；首屏 `createBrowserRouter(buildRoutes())` 只有静态表。静态表顶层有 `path: '*'` → `NotFound`。URL 尚未挂到 Layout children 时命中 catch-all，于是闪 404；init 完成后 `routeInjector` notify / epoch +1 重建 router，才命中插件页 |
| **为何不阻塞整站** | 若等 init 完再挂 `RouterProvider`，首页/聊天等静态路由也会被 registry/偏好网络拖慢。只改 catch-all：插件未就绪时用占位组件，静态路由照常首屏可用                                                                                                                                |

```mermaid
sequenceDiagram
	participant User
	participant App as router/index.tsx
	participant RR as createBrowserRouter
	participant PM as pluginManager.init
	participant RI as routeInjector

	User->>App: 硬刷新 /video-player
	App->>RR: buildRoutes(pluginsReady=false)
	Note over RR: 无动态路由；* → PluginRoutesPending（非 404）
	App->>PM: 异步 init
	PM->>RI: mountShell → inject
	RI-->>App: subscribe → routeEpoch++
	App->>RR: buildRoutes(false) + 动态路由
	Note over RR: 命中 Layout children 插件页
	PM-->>App: finally → pluginsReady=true
	App->>RR: buildRoutes(true)
	Note over RR: * 恢复为真正 NotFound
```

#### 2.11.2 方案要点

1. App 增加 `pluginsReady`（初始 `false`）；`pluginManager.init()` 在 **`finally`** 里置 `true` 并 bump `routeEpoch`（失败也要 ready，否则真 404 永远不出现）。
2. `buildRoutes(pluginsReady)`：未就绪时把静态表里 `path === '*'` 的 `Component` 换成 `PluginRoutesPending`（主题色空白占位）；就绪后仍用 `NotFound`。
3. 动态路由仍挂到 **Layout（routes[0]）的 children 末尾**；catch-all 仍是顶层兄弟路由。Header / `routeMeta` 调 `buildRoutes()` 默认 `pluginsReady=true`，只读 meta，不受占位影响。

#### 2.11.3 `buildRoutes.ts`（与源码对齐）

```typescript
// 无 JSX 文件：用 createElement 做占位组件
import { createElement } from "react";
// 读 PluginManager 已注入的动态 Route 配置
import { routeInjector } from "@/plugins";
// 静态壳路由表（含顶层 * → NotFound）
import routes, { type RouteConfig } from "./routes";

/** 插件壳未就绪时占住 `*`，避免刷新子项目路径先闪 404 */
function PluginRoutesPending() {
	// 顶层 * 无 Layout；主题色空白即可，不必 Loading 动画拖住首屏
	return createElement("div", {
		className: "h-full w-full bg-theme-background",
	});
}

/**
 * 静态壳路由 + PluginManager 注入的动态插件路由
 * @param pluginsReady - false：catch-all 用占位；true：真正 NotFound
 */
export function buildRoutes(pluginsReady = true): RouteConfig[] {
	// 当前已 inject 的插件路由（可能为空数组）
	const dynamic = routeInjector.getRoutes();
	// 未就绪：只替换 *，其它静态 path 不变，首页/聊天仍可立刻匹配
	const base = pluginsReady
		? routes
		: routes.map((route) =>
				// 仅顶层 catch-all 换成占位；其它路由原样
				route.path === "*"
					? { ...route, Component: PluginRoutesPending }
					: route,
			);

	// 尚无动态路由时直接返回 base（含占位或 NotFound）
	if (dynamic.length === 0) return base;

	// 把动态路由挂到 Layout（routes[0]）children 末尾
	return base.map((route, index) => {
		// Layout 壳：首条带 children 的路由
		if (index === 0 && route.children) {
			return {
				...route,
				// 静态业务 children 在前，插件路由在后
				children: [...route.children, ...dynamic],
			};
		}
		// 非 Layout 顶层路由（含 *）原样返回
		return route;
	});
}
```

#### 2.11.4 `router/index.tsx`（关键片段）

```typescript
// App 根：插件 init + 防闪 404 + Host portal 豁免标记
const App = () => {
	// 仅输入框显示 Tab 焦点环（全局 UX，与插件无关）
	useInputsOnlyTab();
	// 路由世代：inject / init 结束时 +1，触发重建 createBrowserRouter
	const [routeEpoch, setRouteEpoch] = useState(0);
	// false：catch-all 用占位，避免刷新子应用路径先闪 NotFound
	const [pluginsReady, setPluginsReady] = useState(false);

	// 挂载时订阅注入器 + 启动 pluginManager.init
	useEffect(() => {
		// 侧栏/路由注入完成时 bump epoch，立刻挂上新 path
		const unsub = routeInjector.subscribe(() => {
			setRouteEpoch((n) => n + 1);
		});
		// init 异步拉 registry、加载启用插件、注入路由
		void pluginManager
			.init()
			// 失败只打日志；仍须 finally ready，否则真 404 永不出现
			.catch((e) => console.error("[plugins] init failed", e))
			.finally(() => {
				// 成功或失败都 ready，占位改为真正 NotFound
				setPluginsReady(true);
				// 与 ready 同批重建 router，吃到已注入的动态路由
				setRouteEpoch((n) => n + 1);
			});
		// 卸载时取消 inject 订阅
		return unsub;
		// 仅挂载跑一次
	}, []);

	// pluginsReady / routeEpoch 变则重建 router，并回写 navigate 给 PluginManager
	const router = useMemo(() => {
		// 按 ready 决定 * 是占位还是 NotFound，并拼上动态插件路由
		const r = createBrowserRouter(buildRoutes(pluginsReady) as RouteObject[]);
		// 插件内跳转走同一 router 实例，避免双实例
		pluginManager.setNavigate((to) => {
			void r.navigate(to);
		});
		return r;
		// epoch：注入完成；pluginsReady：catch-all 策略切换
	}, [routeEpoch, pluginsReady]);

	// JSX：data-mf-host-portal 包住 Toaster，createPortal 收编时跳过（§2.10.2）
	return (
		<div className="h-full w-full bg-theme-background" data-mf-host-portal>
			<Toaster />
			<RouterProvider router={router} />
		</div>
	);
};
```

---

### 2.12 语言（locale）同步

| 路径          | 实现                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| Host 切换语言 | `hooks/i18n.ts` `setLocale` → `onEmit('locale')`                                                       |
| MF props      | `PluginHostPage` `withLiveLocale`                                                                      |
| MF event      | `eventBus.emit(pluginId, 'locale', locale)`；Remote `useHostLocale` 订阅                               |
| iframe        | `attachIframeBridge`：`init.locale` + `onListen('locale')` → `type:'locale'`；Remote `applyHostLocale` |

**不做**：Host 不向插件注入翻译函数 `api.t`；theme 无热同步。

---

### 2.13 插件/子应用加载缓存破坏（完整方案）

> **专题角色**：发版后桌面 / WebView 仍加载旧插件、或只发静态资源却仍吃旧 `remoteEntry.js`——根因与端到端修复。  
> **当前 bust**：`version@manifestHash`（Remote 自有 manifest 指纹）；**禁止**靠改 Host `plugins-registry.json` 刷缓存。  
> **网络**：进入插件时 Host **只 GET 一次** `mf-manifest.json`（算指纹并解析 `remoteEntry` 绝对地址）；随后 `registerRemotes(entry=remoteEntry.js?v=…)`，**不再**让 MF Runtime 二次拉 manifest。  
> 仓库归档副本：[`docs/app/plugin-entry-cache-bust.md`](../../../../docs/app/plugin-entry-cache-bust.md)（与本节同步维护；若冲突以源码与该归档文为准）。

#### 2.13.1 问题现象

| 场景                                                   | 表现                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| 桌面端发了新版插件                                     | 打开仍是旧 UI / 旧逻辑                                              |
| 只改了 `mf-manifest.json` 的 query                     | 无效：真正 `import()` 的仍是无 query 的 `remoteEntry.js`            |
| 只 bump 了插件 `version`，Host 壳是旧逻辑              | 旧 Host「已 activated 就 return」，内存里不重载                     |
| 旧方案：依赖改 registry `updatedAt`                    | 发布者被迫写 Host 清单 → **不安全** / 运维重                        |
| registry 文件被代理 / WebView 缓存                     | Host 读到旧权限 / 旧 `entry`（与 entry bust 解耦后仍须 `no-store`） |
| （已优化前）进入插件 Network 见两次 `mf-manifest.json` | Host 算 bust 拉一次 + MF `registerRemotes(manifest)` 再拉一次       |

#### 2.13.2 根因（两层缓存 + 一层短路）

```mermaid
sequenceDiagram
  participant Host
  participant MF as MF Runtime
  participant Net as WebView/代理缓存
  participant CDN as Remote 静态资源

  Host->>CDN: GET mf-manifest.json?v=t…（算 buildId + 解析 remoteEntry）
  Note over Host: 仅此一次拉 manifest
  Host->>MF: registerRemotes(entry=remoteEntry.js?v=version@hash)
  Note over MF: 不再二次 GET mf-manifest
  MF->>Net: import(.../remoteEntry.js)（可能被剥掉 ?v=）
  Net-->>MF: 若无 afterResolve 补 bust → 命中固定 URL 强缓存 → 旧模块
  Note over Host: 旧 ensurePlugin：status===activated 直接 return<br/>即便资源已变也不重载
```

1. **HTTP / WebView 层**：固定路径的 ESM（`remoteEntry.js`）在 WKWebView 等环境会被强缓存；仅给 manifest 加 `?v=` 不够。
2. **MF 运行时层**：即便直连 `remoteEntry.js`，snapshot 仍可能把 `remoteInfo.entry` **改写成无 query** 的同路径文件。
3. **Host 业务层**：旧逻辑「已 `activated` 就短路」，不比对 bust，进程内永不重载。
4. **（历史）双次 manifest**：旧实现 `registerRemotes` 的 `entry` 仍是 `mf-manifest.json?v=`，MF 会再 GET 一次；现已改为直连 `remoteEntry.js`（见 §2.13.3 B / §2.13.5）。

#### 2.13.3 解决思路（协同）

| 层               | 手段                                                                                                         | 作用                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| A. bust token    | `resolvePluginBust` → `version@manifestHash`                                                                 | 只发 Remote 静态资源即可变 token；**不改 Host registry**     |
| B. 单次 manifest | `fetchManifestMeta`：一次 GET 同时拿到 **指纹** + **`remoteEntry` 绝对 URL**（写入 `remoteEntryByManifest`） | Network 里 `mf-manifest.json` **只出现一次**                 |
| C. register 时   | `registerRemote(meta, bust)` → `entry = withBust(remoteEntry.js, bust)` + `bustByRemote`                     | MF **不再**为解析 expose 再拉 manifest                       |
| D. resolve 后    | `afterResolve` 再对 `remoteEntry.js` `withBust`                                                              | **真正 import 的 URL 也带 `?v=`**（防 MF 剥 query）          |
| E. 是否重载      | `LoadedPlugin.bust`；仅 bust 相同才跳过                                                                      | 内存态与 Remote 构建对齐                                     |
| F. registry 拉取 | force 时 `?t=` + `no-store`                                                                                  | 少读到旧**清单**（权限 / entry URL）；与 entry bust **解耦** |
| G. 服务端        | `/remotes` → `Cache-Control: no-store`                                                                       | 代理少缓存清单                                               |

**发版 checklist**：

1. 部署新 Remote 静态资源（`mf-manifest.json` 正文须变化）。
2. **不要**为刷缓存改 `plugins-registry.json`；仅管理员改上架 / 权限 / `entry` URL 等。
3. **桌面生产必须发含本方案的 Host 壳**（`resolvePluginBust` + 直连 `remoteEntry` + `afterResolve`）。

#### 2.13.3.1 为何曾两次请求、如何收成一次

进入插件时旧路径：

1. Host `fetchEntryBuildId` → `GET mf-manifest.json?v=t{Date.now()}`（`cache: 'no-store'`）→ FNV 指纹
2. `registerRemotes({ entry: mf-manifest.json?v=version@hash })` → **MF Runtime 再 GET 一次** 同文件，才能知道 `remoteEntry.js` 路径

优化后（**功能等价**：仍用 manifest 内容指纹做 bust，仍给 `remoteEntry.js` 补 `?v=`）：

1. Host `fetchManifestMeta` → **仍只 GET 一次** manifest（`?v=t…`）
2. 从正文解析 `metaData.publicPath` + `metaData.remoteEntry.name` → 绝对 `remoteEntry.js` URL，缓存进 `remoteEntryByManifest`
3. `registerRemotes({ entry: remoteEntry.js?v=version@hash })` → MF **跳过**对 manifest 的二次请求，直接 `import` remoteEntry
4. `afterResolve` 若 MF 剥掉 query，再补一次 `?v=`

验收：DevTools → Network 过滤 `mf-manifest`，进入某一插件路由应 **仅 1 条**（另有 `remoteEntry.js?v=…` 属正常）。

#### 2.13.4 端到端数据流

```mermaid
flowchart TD
  A[ensurePlugin / init eager] --> B[fetchPluginRegistry force=true<br/>取 meta]
  B --> C[resolvePluginBust<br/>fetchManifestMeta 一次]
  C --> C2[FNV hash + 解析 remoteEntry URL<br/>写入 remoteEntryByManifest]
  C2 --> D{内存 LoadedPlugin.bust<br/>=== 当前 bust?}
  D -->|是且未 force| E[复用已加载模块]
  D -->|否| F[unload 旧插件可选]
  F --> G[registerRemote meta,bust]
  G --> H[entry=remoteEntry.js?v=bust<br/>bustByRemote.set]
  H --> I[loadRemote]
  I --> J[MF afterResolve]
  J --> K[remoteEntry.js 再补 ?v=bust]
  K --> L[原生 import 新 URL]
  L --> M[activate → status=activated<br/>写入 LoadedPlugin.bust]
```

#### 2.13.5 完整源码：`mf.ts`（缓存相关，逐行注释）

**改动后** · `apps/frontend/src/plugins/core/mf.ts`（缓存相关符号完整定义；与源码同步）

```typescript
// remoteName → bust token 的内存表；afterResolve 按 remote 名取回同一 token
const bustByRemote = new Map<string, string>();

/**
 * registry entry（通常 …/mf-manifest.json）→ 已解析的 remoteEntry.js 绝对地址
 * resolvePluginBust / fetchManifestMeta 写入；registerRemote 读取后直连 remoteEntry
 */
const remoteEntryByManifest = new Map<string, string>();

// 是否已向 MF Runtime 注册过 bustRemoteEntryPlugin（只注册一次）
let bustPluginReady = false;

/**
 * 去掉 query/hash，作为 remoteEntryByManifest 的稳定键
 * @param entry - registry 中的 entry URL
 */
function entryKey(entry: string): string {
	try {
		// 标准 URL：清掉 search / hash 再比
		const u = new URL(entry);
		u.search = "";
		u.hash = "";
		return u.href;
	} catch {
		// 非法 URL：原样作键
		return entry;
	}
}

/**
 * 从 manifest 正文或 entry 路径得到 remoteEntry.js 绝对地址
 * @param entry - 原始 entry（多为 mf-manifest.json）
 * @param manifestText - GET 到的正文；空串时仅按路径回退
 */
function resolveRemoteEntryUrl(entry: string, manifestText: string): string {
	try {
		// 解析 MF manifest JSON
		const json = JSON.parse(manifestText) as {
			metaData?: { publicPath?: string; remoteEntry?: { name?: string } };
		};
		// 文件名默认 remoteEntry.js
		const file = json.metaData?.remoteEntry?.name?.trim() || "remoteEntry.js";
		// 构建时写入的 publicPath（如 https://dnhyxc.cn:9008/）
		const publicPath = json.metaData?.publicPath?.trim();
		// 有 publicPath 时用其拼绝对地址（与线上一致）
		if (publicPath) return new URL(file, publicPath).href;
	} catch {
		/* 非 JSON：走路径回退 */
	}
	try {
		const u = new URL(entry);
		// entry 本身已是 remoteEntry.js
		if (/remoteEntry\.js$/i.test(u.pathname)) {
			u.search = "";
			u.hash = "";
			return u.href;
		}
		// …/mf-manifest.json → 同目录 remoteEntry.js
		u.pathname = u.pathname.replace(/[^/]*$/, "remoteEntry.js");
		u.search = "";
		u.hash = "";
		return u.href;
	} catch {
		return entry;
	}
}

/**
 * 给任意 URL 写入/覆盖查询参数 v=（manifest 探测与 remoteEntry 共用 token）
 * @param url - 原始绝对或相对 URL，可已含 query / hash
 * @param bust - cache bust token；空串则原样返回
 */
export function withBust(url: string, bust: string): string {
	// 去掉首尾空白，避免写出 ?v=%20
	const token = bust.trim();
	// 无有效 token 时不改 URL，避免无意义的 ?v=
	if (!token) return url;
	try {
		// 标准绝对 URL：用 URL API 解析
		const u = new URL(url);
		// 写入或覆盖同名查询参数 v
		u.searchParams.set("v", token);
		// 返回带 bust 的完整 href（含 origin / path / query / hash）
		return u.href;
	} catch {
		// 相对路径或非法 URL：手工拼 query，并保留 hash
		const hashIdx = url.indexOf("#");
		const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
		const noHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
		const qIdx = noHash.indexOf("?");
		const base = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
		const params = new URLSearchParams(qIdx >= 0 ? noHash.slice(qIdx + 1) : "");
		params.set("v", token);
		return `${base}?${params.toString()}${hash}`;
	}
}

/**
 * 组装 bust 字符串：version 与可选 buildId 用 @ 连接
 * @param meta - 至少含 registry 声明的 version（展示/兼容用）
 * @param buildId - Remote mf-manifest 内容指纹；勿传 registry.updatedAt（避免发布者改 Host 清单）
 */
export function pluginBust(
	meta: Pick<PluginDescriptor, "version">,
	buildId?: string,
): string {
	// 去空白后过滤空段，再用 @ 拼接 → 如 1.0.0@a1b2c3d4
	return [meta.version.trim(), buildId?.trim()].filter(Boolean).join("@");
}

/**
 * FNV-1a 32-bit 内容指纹；仅作 cache bust，非安全哈希
 * @param text - mf-manifest.json 响应正文
 */
function hashText(text: string): string {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0).toString(16);
}

/**
 * 拉取 Remote 自有的 mf-manifest（进入插件路径上对该 URL 的唯一次网络请求）：
 * - 内容指纹 → buildId
 * - 解析 remoteEntry 绝对地址 → 写入 remoteEntryByManifest，供 registerRemote 直连
 * @param entry - registry 中的 entry，通常为 …/mf-manifest.json
 */
async function fetchManifestMeta(
	entry: string,
): Promise<{ buildId: string; remoteEntryUrl: string }> {
	// 一次性 t= 防 HTTP 中间层缓存旧 manifest（与最终 ?v=bust 不同用途）
	const url = withBust(entry, `t${Date.now()}`);
	// 原生 fetch；cache: no-store 要求浏览器勿复用磁盘缓存
	const res = await fetch(url, { cache: "no-store" });
	if (!res.ok) {
		throw new Error(`entry buildId ${res.status}: ${entry}`);
	}
	// 读全文：既哈希又解析
	const text = await res.text();
	// 从 publicPath + remoteEntry.name 得到绝对 remoteEntry.js
	const remoteEntryUrl = resolveRemoteEntryUrl(entry, text);
	// 供随后 registerRemote 读取，避免 MF 再 GET manifest
	remoteEntryByManifest.set(entryKey(entry), remoteEntryUrl);
	return { buildId: hashText(text), remoteEntryUrl };
}

/**
 * 拉取 Remote 自有的 mf-manifest，用内容指纹做 buildId（对外 API，内部走 fetchManifestMeta）
 * 发布者只更新自己域名静态资源即可；无需也不应改 Host registry
 */
export async function fetchEntryBuildId(entry: string): Promise<string> {
	const { buildId } = await fetchManifestMeta(entry);
	return buildId;
}

/**
 * 解析当前插件应使用的 bust token
 * trusted MF：version@manifestHash；untrusted：仅 version（iframe 不走 MF entry）
 */
export async function resolvePluginBust(
	// 需要 version / entry / trust 三分量
	meta: Pick<PluginDescriptor, "version" | "entry" | "trust">,
): Promise<string> {
	// iframe 插件无 mf-manifest，不拉 Remote 指纹
	if (meta.trust === "untrusted") {
		// 仅 version；上架变更仍靠管理员改 registry
		return pluginBust(meta);
	}
	// 一次 GET：指纹 + 缓存 remoteEntry URL
	const { buildId } = await fetchManifestMeta(meta.entry);
	// 拼成 version@hash，供 registerRemote / LoadedPlugin.bust 共用
	return pluginBust(meta, buildId);
}

/**
 * MF Runtime 插件：snapshot 常把 entry 改写成无 query 的 …/remoteEntry.js
 * WKWebView 对固定名 ESM 强缓存 → 必须在改写之后再补 ?v=
 */
const bustRemoteEntryPlugin: ModuleFederationRuntimePlugin = {
	// 插件名，便于调试与去重注册
	name: "bust-remote-entry",
	// MF 解析 remote 信息之后调用
	async afterResolve(args) {
		const name = args.remoteInfo?.name;
		const bust = name ? bustByRemote.get(name) : undefined;
		if (bust && args.remoteInfo?.entry) {
			// 真正 import() 的 URL 带 ?v=
			args.remoteInfo.entry = withBust(args.remoteInfo.entry, bust);
		}
		return args;
	},
};

/** 确保 bustRemoteEntryPlugin 只向 MF 注册一次 */
function ensureBustPlugin() {
	if (bustPluginReady) return;
	getMf().registerPlugins([bustRemoteEntryPlugin]);
	bustPluginReady = true;
}

/**
 * 注册远程模块：直连 remoteEntry.js?v=；写入 bustByRemote；force 覆盖同名 remote
 * @param d - 插件描述符（含 entry / remoteName / version）
 * @param bust - 通常为 await resolvePluginBust(meta)；缺省回退 d.version
 */
export function registerRemote(d: PluginDescriptor, bust?: string) {
	ensureShared();
	ensureBustPlugin();
	const token = (bust ?? d.version).trim();
	const name = remoteNameOf(d);
	// // 非空 token 写入 Map，供 afterResolve 按 name 读取
	if (token) bustByRemote.set(name, token);
	// 优先用 resolvePluginBust 已解析的地址；缺省则按路径猜测（无二次 manifest）
	const remoteEntry =
		remoteEntryByManifest.get(entryKey(d.entry)) ??
		resolveRemoteEntryUrl(d.entry, "");
	getMf().registerRemotes(
		[
			{
				name,
				// 直连 remoteEntry.js?v=token —— MF 不再 GET mf-manifest.json
				entry: withBust(remoteEntry, token),
				type: "module",
			},
		],
		{ force: true },
	);
}

/**
 * 加载 Remote expose 模块（default 导出为 React 组件）
 * 调用前须已 registerRemote（含正确 bust）
 */
export async function loadRemoteApp(
	d: PluginDescriptor,
): Promise<PluginModule> {
	ensureShared();
	ensureBustPlugin();
	const name = remoteNameOf(d);
	const expose = exposeBaseOf(d);
	const mod = await getMf().loadRemote<PluginModule>(`${name}/${expose}`);
	if (!mod?.default) {
		throw new Error(
			`plugin ${d.id}: expose ./${expose} missing default export`,
		);
	}
	return mod;
}
```

**变更摘要**：

1. bust 第二段为 Remote `mf-manifest` 的 FNV 指纹（`version@manifestHash`），**不依赖**改 Host registry。
2. 新增 `fetchManifestMeta` / `remoteEntryByManifest` / `resolveRemoteEntryUrl`：一次 GET 同时服务指纹与 `remoteEntry` 解析。
3. `registerRemote` **改为注册 `remoteEntry.js?v=`**，消除 MF 对 `mf-manifest.json` 的第二次请求。
4. `withBust` + `afterResolve` 仍保证真正 `import` 的 `remoteEntry.js` 带 `?v=`。

#### 2.13.6 完整源码：`PluginManager`（bust 重载路径，逐行注释）

**改动后** · `apps/frontend/src/plugins/core/PluginManager.ts`（`init` eager / `ensurePlugin` / `loadPlugin` / `runLoad`）

```typescript
// 从 mf 引入：加载 Remote、注册 entry、解析 version@manifestHash
import { loadRemoteApp, registerRemote, resolvePluginBust } from './mf';

/**
 * 启动：只挂壳；eager 插件在微任务里 loadPlugin（内部自己 resolvePluginBust）
 */
async init() {
	// 强制拉最新 registry（清单 ?t= / no-store；与 entry bust 解耦）
	const registry = await fetchPluginRegistry({ force: true });
	// 仅处理 enabled 插件
	const enabled = registry.plugins.filter((p) => p.enabled);
	// 先挂路由/侧栏壳，不下载 MF
	for (const meta of enabled) {
		// 注入路由与侧栏项
		this.mountShell(meta);
	}
	// 显式 opt-in 的 eager 预拉列表
	const eager = enabled.filter((p) => p.preload === 'eager');
	// 无 eager 则结束
	if (eager.length === 0) return;
	// 不阻塞 init：微任务后台拉
	queueMicrotask(() => {
		// 每个 eager 插件走完整 loadPlugin（会 fetch manifest 算 bust）
		void Promise.all(eager.map((p) => this.loadPlugin(p)));
	});
}

/**
 * 确保指定插件可用：按 bust 决定复用或重载
 * @param id - registry 插件 id
 * @param opts.force - true 时忽略 bust 相等短路
 */
async ensurePlugin(id: string, opts?: { force?: boolean }) {
	// 每次 ensure 强制读最新清单（权限 / entry URL / enabled）
	const registry = await fetchPluginRegistry({ force: true });
	// 在启用列表中找目标
	const meta = registry.plugins.find((p) => p.id === id && p.enabled);
	// 未启用或不存在
	if (!meta) {
		throw new Error(`registry 中无启用插件 ${id}`);
	}
	// bust = version@manifestHash（来自 Remote 自有 entry，不依赖改 registry）
	const bust = await resolvePluginBust(meta);
	// 读内存态
	const cur = this.plugins.get(id);
	// 已激活且 bust 未变且未 force → 复用，避免重复 import
	if (cur?.status === 'activated' && cur.bust === bust && !opts?.force) {
		return cur;
	}
	// 失败且 bust 未变且未 force → 仍抛旧错，避免无意义重试
	if (cur?.status === 'failed' && !opts?.force && cur.bust === bust) {
		throw new Error(cur.error || `加载 ${id} 失败`);
	}

	// 同 id 并发加载中的 Promise
	const pending = this.inflight.get(id);
	// 非 force 时等待已有加载完成
	if (pending && !opts?.force) {
		// 等并发 load 结束
		await pending;
		// 再读一次内存
		const after = this.plugins.get(id);
		// 并发结果已是目标 bust 的 activated → 直接返回
		if (after?.status === 'activated' && after.bust === bust) return after;
		// 并发结果失败 → 抛错
		if (after?.status !== 'activated') {
			throw new Error(after?.error || `加载 ${id} 失败`);
		}
		/* bust 已变（并发期间 Remote 又发了版），继续往下重载 */
	}

	// 确保壳（路由/侧栏）在位
	this.mountShell(meta);
	// 传入已算好的 bust，避免 loadPlugin 内再 fetch 一次 manifest
	await this.loadPlugin(meta, opts, bust);
	// 加载后取最终态
	const next = this.plugins.get(id);
	// 未激活则抛错给调用方
	if (next?.status !== 'activated') {
		throw new Error(next?.error || `加载 ${id} 失败`);
	}
	// 返回已激活的 LoadedPlugin
	return next;
}

/**
 * 执行加载；bust 变则先 unload 再 load
 * @param meta - 插件描述符
 * @param opts.force - 强制重载
 * @param bustToken - 可选；已算好的 bust，避免重复 fetchEntryBuildId
 */
async loadPlugin(
	meta: PluginDescriptor,
	opts?: { force?: boolean },
	bustToken?: string,
) {
	// 有传入则复用；否则自行 resolve（eager / 内部调用路径）
	const bust = bustToken ?? (await resolvePluginBust(meta));
	// 当前内存中的同 id 插件
	const prev = this.plugins.get(meta.id);
	// 已激活且 bust 相同且未 force → 短路
	if (prev?.status === 'activated' && prev.bust === bust && !opts?.force) {
		return;
	}
	// 已激活但 bust 变了（或 force）→ 先卸旧模块
	if (prev?.status === 'activated') {
		// deactivate + 清 eventBus + 卸路由壳
		await this.unloadPlugin(meta.id);
		// 卸完再挂壳（unload 会 remove 路由）
		this.mountShell(meta);
	}

	// 并发 inflight
	const existing = this.inflight.get(meta.id);
	if (existing) {
		// 非 force：直接复用同一个 Promise
		if (!opts?.force) return existing;
		// force：等旧的结束（忽略其失败）再开新 load
		await existing.catch(() => {});
	}

	// 启动真正的 runLoad，带上本次 bust
	const run = this.runLoad(meta, bust);
	// 记入 inflight，供并发 ensure 等待
	this.inflight.set(meta.id, run);
	try {
		// 等待加载完成
		await run;
	} finally {
		// 仅当 Map 里仍是本次 run 时删除，避免误删更新的 inflight
		if (this.inflight.get(meta.id) === run) {
			this.inflight.delete(meta.id);
		}
	}
}

/**
 * 校验 → registerRemote(bust) → loadRemote → activate；失败写 failed
 * @param bust - 写入 LoadedPlugin 并传给 registerRemote 的 token
 */
private async runLoad(meta: PluginDescriptor, bust: string) {
	// navigate 闭包绑定当前 PluginManager 的 navigateImpl
	const nav = (to: string) => this.navigateImpl(to);
	// loading 占位；提前带上 bust，便于并发比对
	const loading: LoadedPlugin = {
		// 描述符快照
		meta,
		// 按 permissions 组装的 HostBridge
		bridge: createHostBridge(meta, nav),
		// 占位组件，避免渲染期空 default
		mod: { default: () => null },
		// 加载中
		status: 'loading',
		// 本次目标 bust
		bust,
	};
	// 写入 Map，对外可见 loading
	this.plugins.set(meta.id, loading);

	try {
		// hostApiRange / integrity 等校验
		await verifyPlugin(meta);

		// untrusted：仅激活壳，由 PluginHostPage 渲染 iframe，不进 MF
		if (meta.trust === 'untrusted') {
			this.plugins.set(meta.id, {
				meta,
				bridge: createHostBridge(meta, nav),
				mod: { default: () => null },
				status: 'activated',
				// iframe 路径 bust 多为纯 version
				bust,
			});
			return;
		}

		// 注册 Remote：manifest ?v=bust，并写入 bustByRemote
		registerRemote(meta, bust);
		// 样式捕获窗口：包住 loadRemote 引入的 style/link
		const endCapture = beginPluginStyleCapture(meta.id, meta.entry);
		// loadRemote 返回的模块类型
		let mod: Awaited<ReturnType<typeof loadRemoteApp>>;
		try {
			// 真正 import Remote（afterResolve 会给 remoteEntry 补 ?v=）
			mod = await loadRemoteApp(meta);
		} finally {
			// 无论成败结束捕获窗口
			endCapture();
		}
		// 加载成功后再建一份 bridge（navigate 等最新）
		const bridge = createHostBridge(meta, nav);
		// 可选生命周期：有副作用插件的 activate
		await mod.activate?.(bridge.api);

		// 标记 activated，bust 与本次 token 一致
		this.plugins.set(meta.id, {
			meta,
			bridge,
			mod,
			status: 'activated',
			bust,
		});
	} catch (e) {
		// 统一错误文案
		const message = e instanceof Error ? e.message : String(e);
		// 控制台保留堆栈
		console.error(`[PluginManager] load ${meta.id} failed`, e);
		// 写 failed，保留 loading 上的 bust，便于「同 bust 失败不重试」
		this.plugins.set(meta.id, {
			...loading,
			status: 'failed',
			error: message,
		});
	}
}
```

**变更摘要**：`ensurePlugin` / `loadPlugin` 用 `await resolvePluginBust(meta)` 替代 `pluginBust(meta, registry.updatedAt)`；`runLoad` 把同一 bust 写入 `LoadedPlugin` 并传给 `registerRemote`。

#### 2.13.6.1 `LoadedPlugin.bust` 字段

**改动后** · `apps/frontend/src/plugins/core/types.ts`（约 L140–L148）

```typescript
// 内存中已加载（或加载中/失败）的插件运行时态
export interface LoadedPlugin {
	// registry 描述符快照
	meta: PluginDescriptor;
	// 按 permissions 密封的 HostBridge
	bridge: HostBridgeProps;
	// Remote 模块（default 组件 + 可选 activate/deactivate）
	mod: PluginModule;
	// registered | loading | activated | failed | unloaded
	status: PluginStatus;
	// failed 时的错误文案
	error?: string;
	// version@manifestHash；与 MF entry ?v= 一致，用于判断是否需重载
	bust?: string;
}
```

#### 2.13.7 registry `updatedAt` 说明

`savePluginRegistry` 仍会写 `updatedAt`（编辑审计 / 强制刷新本地清单缓存）。**它不再参与 MF entry bust**。发布者不得通过改 registry 刷插件缓存。

#### 2.13.8 后端 remotes `no-store`

仍适用于 Host 清单 `/remotes/plugins-registry.json`（见 `serve-upload-static.middleware.ts`）。与 Remote CDN 上的 `mf-manifest` 是两条线。生产 Nginx 若对 `/remotes/` 另设了 `expires`，须改为不缓存或与后端一致。

#### 2.13.9 验收与排障

| 步骤                                        | 期望                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| DevTools 过滤 `mf-manifest.json`            | 进入某一插件路由时 **仅 1 条**（Host `?v=t…`）；**不应**再出现 MF 发起的第二次 manifest   |
| DevTools 看 `remoteEntry.js`                | URL 含 `?v=version@<hash>`（register 直连和/或 afterResolve）                             |
| 只部署新 Remote、不改 registry 再进插件     | Host 重载；UI 为新版                                                                      |
| `curl -i .../remotes/plugins-registry.json` | `Cache-Control` 含 `no-store`                                                             |
| 桌面仍旧                                    | 确认已安装**含本方案的 Host 壳**，且 Remote 静态资源已部署、CORS 允许 Host fetch manifest |

| 误区                             | 正确做法                                |
| -------------------------------- | --------------------------------------- |
| 只给 manifest 加 query           | 必须 `afterResolve` 补 `remoteEntry.js` |
| 只发插件不发桌面壳               | 生产 Host 逻辑在壳内，必须发壳          |
| 发布者改 Host registry 刷缓存    | **禁止**；部署 Remote 即可              |
| 把 `version` 写成 `hostApiRange` | 保存失败或加载报 HOST_API 不兼容        |

---

### 2.14 应用级全屏（影院态）

接入手册视角与回归清单见 `host-plugin-integration-guide.md` §15；插件调用见 `plugin-development-guide.md` §16。

#### 2.14.1 模块 `host-api/appFullscreen.ts`（全文）

**文件路径**：`apps/frontend/src/plugins/host-api/appFullscreen.ts`

| API                          | 作用                                                     |
| ---------------------------- | -------------------------------------------------------- |
| `getAppFullscreen()`         | 同步读影院态                                             |
| `subscribeAppFullscreen(fn)` | Layout / `PluginPageShell` 订阅                          |
| `setAppFullscreen(next)`     | 写状态 + Tauri `setFullscreen` / Web `requestFullscreen` |
| `APP_FULLSCREEN_EVENT`       | `window` CustomEvent，`detail.full`                      |

状态为**模块单例**（非 React Context），保证 Bridge、Layout、Shell 同源。

```typescript
/**
 * Host 应用级影院/全屏状态。
 * 插件只调 bridge `api.ui.setAppFullscreen`；壳层显隐由 Layout 订阅。
 */
import { isTauriRuntime } from "@/utils/runtime";

export const APP_FULLSCREEN_EVENT = "host:app-fullscreen";

type Listener = (full: boolean) => void;

let full = false;
const listeners = new Set<Listener>();

export function getAppFullscreen(): boolean {
	return full;
}

export function subscribeAppFullscreen(fn: Listener): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

function notify(next: boolean) {
	full = next;
	for (const fn of listeners) fn(next);
	window.dispatchEvent(
		new CustomEvent(APP_FULLSCREEN_EVENT, { detail: { full: next } }),
	);
}

/** Host / bridge 入口：改布局态 + 系统窗口全屏 */
export async function setAppFullscreen(next: boolean): Promise<void> {
	if (full !== next) notify(next);

	if (isTauriRuntime()) {
		try {
			const { getCurrentWindow } = await import("@tauri-apps/api/window");
			await getCurrentWindow().setFullscreen(next);
		} catch (err) {
			console.warn("[host] setFullscreen failed", err);
		}
		return;
	}

	try {
		if (next) {
			if (!document.fullscreenElement) {
				await document.documentElement.requestFullscreen();
			}
		} else if (document.fullscreenElement) {
			await document.exitFullscreen();
		}
	} catch {
		/* 布局态已切换即可 */
	}
}
```

要点：先 `notify` 布局态再调系统 API；Tauri 提前 `return` 不走 document 全屏；`full === next` 时跳过 notify 但仍执行系统对齐。

#### 2.14.2 Bridge 注入

`createHostBridge` 在 `ui:toast` 下：

```typescript
// 仅当 permissions 含 ui:toast 时注入整包 api.ui（否则插件侧为 undefined）
api.ui = Object.freeze({
	// Host Toast：类型/文案由插件传入
	showToast: (options) => {
		/* ... */
	},
	// 影院全屏：与 showToast 同门闩，供 VideoPlayer 等调用
	setAppFullscreen,
	// 受控下载：走 Host 能力，避免 Remote 直接碰文件系统策略
	downloadBlob: async (options) => {
		/* ... */
	},
	// 结束 Object.freeze 配置对象
});
```

#### 2.14.3 `PluginPageShell` + `pageShell`

全文与注释见 **§2.10.0**（含「勿在圆角容器写 `overflow-hidden`」）。要点：

```tsx
/**
 * 勿在圆角容器上写 overflow-hidden：与 border-radius 同层时，
 * Chromium 会让子树 backdrop-filter 采不到更深的 video（本地独立跑正常、MF 嵌入失效）。
 */
// 以下为圆角内容区要点（JSX 标记行不注）；className 逻辑：
// cn 合并：铺满 + 主题底，故意不含 overflow-hidden
// theater 时去圆角；否则 rounded-md 与 Layout 内容区一致
<div
	className={cn(
		'h-full min-h-0 bg-theme-background', // 无 overflow-hidden
		theater ? 'rounded-none p-0' : 'rounded-md',
	)}
>
	{children}
</div>
```

```typescript
// 独立路由才套壳；业务内嵌直接返回 node，避免双层 p-5.5
const wrap = (node: ReactNode) =>
	pageShell ? <PluginPageShell>{node}</PluginPageShell> : node;
```

仅 `createPluginRoute` 传 `pageShell: true`。

#### 2.14.4 Layout 行为（`apps/frontend/src/layout/index.tsx`）

影院态：

- `theater === true`：不渲染 Sidebar / Header / Web 备案 footer；去掉 `py-7 pr-7` 与圆角；Outlet 内容区 `h-full overflow-hidden`
- Web：`fullscreenchange` 且无 `document.fullscreenElement` 时 `setAppFullscreen(false)`
- Tauri：`capabilities/default.json` 含 `core:window:allow-set-fullscreen` / `allow-is-fullscreen`

**overflow 分层（与 `PluginPageShell` 同源约束）**：`main` 可带 `rounded-md`，但 **不要**在同一层写 `overflow-hidden`；裁切放到内层无圆角（或圆角已拆开）的容器，否则路由页内 `backdrop-filter` 失效。

```tsx
{/* JSX 结构示意：标记行不逐行注；下列 // 只解释 className / 条件表达式意图 */}
<main
	className={cn(
		// main 可带 rounded；同层绝不要 overflow-hidden
		'relative flex h-full w-full bg-theme-background',
		// 影院去圆角贴齐窗口；常态与窗口圆角一致
		theater ? 'rounded-none' : 'rounded-md',
	)}
>
	{/* overflow 不与 rounded 同层，避免废掉路由页内 backdrop-filter */}
	<div className="relative flex h-full w-full min-w-0 flex-1 overflow-hidden">
		{/* 影院隐藏侧栏；条件表达式本身是布局逻辑 */}
		{theater ? null : <Sidebar />}
		<TooltipProvider>
			<div
				data-tauri-drag-region
				className={cn(
					// 主内容列：拖拽区 + flex 占满
					'box-border flex h-full w-full min-w-0 max-w-full flex-1 flex-col',
					// 影院去内边距/圆角；常态 py-7 pr-7 给侧栏留视觉呼吸
					theater ? 'rounded-none p-0' : 'rounded-md py-7 pr-7',
				)}
			>
				<div
					className={cn(
						// 圆角在此层；overflow 再往内一层
						'relative h-full w-full min-w-0 max-w-full bg-theme-secondary',
						theater ? 'rounded-none' : 'rounded-md',
					)}
				>
					{/* 裁切层：无 rounded，专责 overflow-hidden */}
					<div className="relative h-full w-full min-w-0 max-w-full overflow-hidden">
						{theater ? null : <Header />}
						<div
							className={cn(
								'box-border min-h-0 min-w-0 w-full max-w-full',
								// 影院：Outlet 占满且裁切；常态：为 Header 留 3.25rem 并可纵向滚动
								theater
									? 'h-full overflow-hidden'
									: 'h-[calc(100%-3.25rem)] overflow-x-hidden overflow-y-auto',
							)}
						>
							{/* 鉴权未过不挂 Outlet，避免闪出需登录页 */}
							{needAuth && !authed ? null : <Outlet />}
						</div>
					</div>
				</div>
			</div>
		</TooltipProvider>
		{/* Web 备案 footer：非 theater 时 absolute 挂在 overflow 内层 */}
	</div>
</main>
```

#### 2.14.5 侧栏 `MENUS` / `PLUGINS`

`Sidebar/enum.tsx` 拆分；`Sidebar/index.tsx`：`[...MENUS, ...dynamic, ...PLUGINS]`。

#### 2.14.6 插件调用

```typescript
// 进入影院：藏侧栏/顶栏并请求系统全屏（需 permissions 含 ui:toast，否则 api.ui 不存在）
await api.ui?.setAppFullscreen?.(true);
// 退出 / 卸载时务必回写 false，避免壳层残留无侧栏状态
await api.ui?.setAppFullscreen?.(false);
```

参考：`apps/micro/src/views/video-player/VideoPlayer.tsx` 的 `onFull`。iframe untrusted 若 RPC 未登记则不可远程调用。

---

## 3. 子项目/插件接入

### 3.1 Vite 配置

**文件路径**：`apps/remote-demo/vite.config.ts`（单 expose 示例）

```typescript
import fs from "node:fs";
import path from "node:path";
import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * MF mf_owner id 递增后 .vite/deps 会失效，serve 时清缓存
 * 与 Host 端的 clearMfViteDepCachePlugin 功能相同
 */
function clearMfViteDepCache(): Plugin {
	return {
		name: "clear-mf-vite-dep-cache",
		enforce: "pre",
		config: (viteConfig, { command }) => {
			if (command !== "serve") return;
			const root = viteConfig.root
				? path.resolve(viteConfig.root)
				: process.cwd();
			fs.rmSync(path.join(root, "node_modules/.vite"), {
				recursive: true,
				force: true,
			});
		},
	};
}

// 开发环境配置
const host = "127.0.0.1";
// 参考端口：remote-demo=9007，remote-plugins=9008（下文示例沿用变量）
const port = Number(process.env.PORT) || 9008;
const devOrigin = `http://${host}:${port}`;

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	/**
	 * 生产环境：.env.production 里配置 VITE_REMOTE_PUBLIC_ORIGIN
	 * 例如：VITE_REMOTE_PUBLIC_ORIGIN=https://dnhyxc.cn:9005
	 */
	const origin = env.VITE_REMOTE_PUBLIC_ORIGIN || devOrigin;

	/**
	 * React Refresh Host：指向 Host 开发服务器
	 * 确保 HMR 能正确连接到 Host
	 */
	const reactRefreshHost =
		env.VITE_REACT_REFRESH_HOST || "http://127.0.0.1:9002";

	return {
		// 关键：与 Host registry entry 一致，避免只绑 ::1 导致 127.0.0.1 连不上
		base: `${origin}/`,

		plugins: [
			// 清理 MF 缓存
			clearMfViteDepCache(),

			// React 插件（配置 reactRefreshHost）
			react({
				reactRefreshHost,
			}),

			// Module Federation 配置
			federation({
				name: "remoteDemo", // Remote 名称，必须唯一
				filename: "remoteEntry.js", // Remote Entry 文件名
				manifest: true, // 生成 manifest（支持多 expose）
				exposes: {
					// 暴露的模块
					"./App": "./src/App.tsx", // 暴露 App 组件
				},
				shared: {
					// 共享依赖
					react: {
						// React 共享
						singleton: true, // 单例模式
						requiredVersion: "^19.1.0", // 版本要求（与 Host 一致）
					},
					"react-dom": {
						// React DOM 共享
						singleton: true,
						requiredVersion: "^19.1.0",
					},
				},
				// 关键：避免默认 html 注入问题
				hostInitInjectLocation: "entry",
				dts: false, // 关闭类型生成
				dev: {
					remoteHmr: true, // 开发环境支持 HMR
				},
			}),
		],

		optimizeDeps: {
			// 排除 React，避免双实例；含 TipTap 等时建议 include 预打包，避免 HMR 二次 reload
			include: [
				// 按实际 import 补齐 '@tiptap/core'、'@tiptap/pm/model' 等
			],
			exclude: [
				"react",
				"react/jsx-runtime",
				"react/jsx-dev-runtime",
				"react-dom",
				"react-dom/client",
			],
		},

		server: {
			host,
			port,
			strictPort: true,
			origin: devOrigin,
			cors: true, // 关键：允许跨域
			headers: {
				"Access-Control-Allow-Origin": "*", // 允许所有来源
			},
		},

		preview: {
			host,
			port,
			strictPort: true,
			cors: true,
		},

		build: {
			target: "esnext", // 目标 ES 版本
			modulePreload: false, // 禁用 module preload
			minify: false, // 开发环境不压缩
		},
	};
});
```

**关键点说明**（Remote 端）：

| 配置项                                   | 作用               | 为什么重要                                           |
| ---------------------------------------- | ------------------ | ---------------------------------------------------- |
| `base: ${origin}/`                       | 设置基础路径       | 必须与 Host registry entry 一致                      |
| `reactRefreshHost`                       | React HMR 连接地址 | 确保开发时 HMR 能连到 Host                           |
| `cors: true`                             | 允许跨域           | Host 需要跨域加载 Remote                             |
| `headers['Access-Control-Allow-Origin']` | CORS 响应头        | 允许所有来源访问                                     |
| `optimizeDeps.exclude`                   | 排除 React         | 与 Host 保持一致，避免重复打包                       |
| `optimizeDeps.include`                   | 预打包重依赖       | 避免 HMR 中途发现 `@tiptap/pm/model` 等再整页 reload |

---

### 3.2 组件实现规范

**文件路径**：`apps/remote-demo/src/App.tsx`

```typescript
/**
 * HostBridge 属性类型定义
 * Remote 组件接收此属性作为 props
 * 与 Host 端的 HostBridgeProps 类型对齐
 */
type HostBridgeProps = {
	api: {
		theme: 'light' | 'dark';
		locale?: 'zh-CN' | 'en-US'; // Host 注入；插件自维护 t()
		navigate: (to: string) => void;
		event: {
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		ui?: { showToast: (options: { message: string }) => void };
	};
	plugin: { id: string; version: string; routePath: string };
};

/**
 * 默认导出的 React 组件
 * - 必须是 default 导出
 * - 接收 HostBridgeProps 作为 props
 * - 渲染插件内容
 */
export default function App({ api, plugin }: HostBridgeProps) {
	return (
		<div
			className={`plugin-${plugin.id}`}
			style={{
				padding: 24,
				minHeight: '100%',
				fontFamily: 'ui-sans-serif, system-ui, sans-serif',
			}}
		>
			<h1 style={{ fontSize: 28, marginBottom: 8 }}>Remote Demo</h1>
			<p style={{ opacity: 0.75, marginBottom: 16 }}>
				MF 插件页 · {plugin.id}@{plugin.version} · theme={api.theme}
			</p>
			<button
				type="button"
				onClick={() =>
					api.ui?.showToast({ message: `hello from ${plugin.id}` })
				}
				style={{
					padding: '8px 14px',
					borderRadius: 8,
					border: '1px solid #ccc',
					cursor: 'pointer',
				}}
			>
				通过 HostBridge 弹 Toast
			</button>
		</div>
	);
}

/**
 * 激活钩子（可选）
 * - 在模块加载后调用
 * - **不要**与 React 组件写在同一频繁改动的文件：否则 Fast Refresh 失败 → 整页 reload
 * - 无副作用时可省略；有副作用时放到 lifecycle.ts 再由入口 re-export
 */
export async function activate() {
	console.log('Remote Demo activated');
}

/**
 * 停用钩子（可选）
 * - 在模块卸载前调用
 * - 同样建议与组件分文件
 */
export async function deactivate() {
	console.log('Remote Demo deactivated');
}
```

**组件实现要点**：

| 要求                      | 说明                                             |
| ------------------------- | ------------------------------------------------ |
| `default` 导出            | **必须**有 default 导出，且是 React 组件         |
| `HostBridgeProps`         | 组件接收 `{ api, plugin }` 作为 props            |
| `activate` / `deactivate` | **可选**；勿与组件同文件空导出；有副作用则拆文件 |
| 样式隔离                  | Host `@scope([data-mf-style-realm])` + Portal 收编；可用正常 Tailwind |
| API 使用                  | 通过 `api` 对象调用 Host 提供的能力              |

---

### 3.3 全局样式处理（Remote 侧约定）

#### 3.3.1 隔离责任在 Host（Remote 零改造）

详细原理与 Host 源码见 **§2.10.2**。Remote 开发者只需记住：

| 信任等级                  | 隔离方式                                     | Remote 侧要求                                        |
| ------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| `first-party` / `partner` | Host 运行时 `@scope ([data-mf-style-realm="…"])`（同 Remote 多插件共享 realm；另有 Portal 收编） | **可用**正常 `@import "tailwindcss"`（含 Preflight） |
| `untrusted`               | sandbox iframe                               | 天然隔离；`iframeUrl` 指向无壳 embed 页              |

**不要做**：

- 不要为了「防污染 Host」去关 Preflight、手写 `[data-plugin-root] { @import "tailwindcss/utilities" }` 等特殊构建。
- 不要假设能写「影响整个 Host 的全局 CSS」——嵌入后一律被 scope 住。

**可以做**：

- 正常 Tailwind / CSS Modules / CSS-in-JS / 第三方组件库。
- 使用 Host 主题 CSS 变量（自动继承）。
- 独立预览（:9008）继续用本包 `styles.css` 的 `:root` / `.dark`。

#### 3.3.2 Remote 样式文件（当前 `remote-plugins`）

**文件路径**：`apps/remote-plugins/src/styles.css`

```css
/*
 * 常规 Tailwind v4 + shadcn token。
 * 嵌入 Host 时主题变量由主站继承；独立预览 / iframe 用本文件 :root / .dark。
 * Host 会在注入时用 @scope([data-mf-style-realm]) 包住整段 CSS，不必在此文件手写 data-mf-plugin / realm。
 */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where(.dark, .dark *));
/* ... token / #root 等 ... */
```

#### 3.3.3 接入步骤与注意点

1. Remote 按普通 Vite + Tailwind 工程写样式即可。
2. Host 已在 `PluginManager.runLoad` / `PluginHostPage` 接入捕获；插件开发者**无需**调用 `beginPluginStyleCapture`。
3. 组件根仍可带 `data-plugin-root`（兼容旧选择器）；**宿主容器**上的 `data-mf-plugin` + `data-mf-style-realm` 由 Host 设置。
4. 外链 `<link rel="stylesheet">`：须对 Host 源开 **CORS**，否则无法改写成 scoped style（见 §5.7）。优先把 CSS 打进 JS（Vite 默认注入 `<style>`）。
5. `untrusted` 勿依赖 Host CSS；走 embed + iframe。
6. 勿在插件侧再改 `createPortal` / 强行传 portal container（Host 已静默收编，含 body remove 镜像）；antd Modal/Drawer 无需改 `getContainer`；Host Drawer 类外壳由宿主调用 `claimPluginPortalTarget`。
7. 独立预览正常、嵌入后 `backdrop-filter` 失效：属 Host `PluginPageShell` / Layout overflow 分层问题（§2.10.0 / §2.14.4），不是插件要关掉毛玻璃。

#### 3.3.4 嵌入后样式「看起来丢了」怎么查

1. DevTools 看插件根是否有 `data-mf-plugin="你的id"` **与** `data-mf-style-realm="entry:…"`。
2. 看 `document.head` 里 Remote 的 `<style>` 是否已含 `@scope ([data-mf-style-realm=...])`（早期文档曾写 `data-mf-plugin`，现行以 realm 为准）。
3. 若只有未禁用的跨域 `<link>`：检查 CORS / 改打进 bundle。
4. Host 是否走过 `beginPluginStyleCapture` / `attachPluginStyleIsolation`（untrusted 不会走）。
5. 弹层是否在 `[data-mf-portal-scope]` 下；同 Remote 切换后是否已 reclaim。
6. 毛玻璃失效：查圆角祖先是否同层带了 `overflow-hidden`（§5.7）。

---

### 3.4 多插件共享 Remote

**文件路径**：`apps/remote-plugins/vite.config.ts`（多 expose 示例）

```typescript
federation({
	name: 'remotePlugins',          // Remote 名称
	filename: 'remoteEntry.js',
	manifest: true,
	exposes: {                      // 暴露多个模块
		'./IdeasList': './src/views/ebook/ideas/index.tsx',
		'./LearningNotes': './src/views/learning-notes/index.tsx',
	},
	shared: {
		react: { singleton: true, requiredVersion: '^19.1.0' },
		'react-dom': { singleton: true, requiredVersion: '^19.1.0' },
	},
	hostInitInjectLocation: 'entry',
	dts: false,
	dev: {
		remoteHmr: true,
	},
}),
```

**Registry 配置示例**（多插件共享同一 Remote）：

```json
{
	"plugins": [
		{
			"id": "ideasList",
			"routePath": "/ideas",
			"entry": "https://dnhyxc.cn:9008/mf-manifest.json",
			"version": "1.0.0",
			"hostApiRange": "^1.0.0",
			"remoteName": "remotePlugins", // 指定 federation name
			"expose": "./IdeasList", // 指定 expose 路径
			"permissions": ["ui:toast"],
			"enabled": true,
			"trust": "first-party"
		},
		{
			"id": "learningNotes",
			"routePath": "/english/notes",
			"entry": "https://dnhyxc.cn:9008/mf-manifest.json", // 同一 entry
			"version": "1.0.0",
			"hostApiRange": "^1.0.0",
			"remoteName": "remotePlugins", // 同一 federation name
			"expose": "./LearningNotes", // 不同 expose
			"injectRoute": false, // 业务内挂载
			"permissions": ["ui:toast"],
			"enabled": true,
			"trust": "first-party"
		}
	]
}
```

**多插件共享 Remote 的优势**：

| 优势           | 说明                                  |
| -------------- | ------------------------------------- |
| 减少 HTTP 请求 | 多个插件只需要加载一次 remoteEntry.js |
| 共享依赖       | 同一 Remote 内的共享依赖只需加载一次  |
| 简化部署       | 一个构建产物对应多个插件              |

---

### 3.5 不安全插件（untrusted）接入

#### 3.5.1 适用场景

当插件不可信（`trust: untrusted`）时，Host 不会通过 `loadRemote` 加载插件代码，而是通过 iframe 隔离运行。适用场景：

| 场景                    | 说明                                                                        |
| ----------------------- | --------------------------------------------------------------------------- |
| 第三方插件              | 由外部开发者提供，无法完全信任其代码安全性                                  |
| 不可信 / 需强隔离的插件 | 不共享主文档 JS/CSS；走 iframe（样式已可由 Host @scope 覆盖多数第一方场景） |
| 需要独立 DOM 环境的插件 | 插件需要操作 `document`、`window` 等全局对象                                |
| 需要独立网络环境的插件  | 插件需要独立的网络请求环境                                                  |

#### 3.5.2 Host 端处理流程

**文件路径**：`apps/frontend/src/plugins/core/PluginManager.ts`（`runLoad` 方法中 untrusted 处理）

```typescript
private async runLoad(meta: PluginDescriptor, bust: string) {
	// bust = await resolvePluginBust(meta) 由 loadPlugin 传入（见 §2.13.6）
	const nav = (to: string) => this.navigateImpl(to);
	const loading: LoadedPlugin = {
		meta,
		bridge: createHostBridge(meta, nav),
		mod: { default: () => null },
		status: 'loading',
		bust,
	};
	this.plugins.set(meta.id, loading);

	try {
		await verifyPlugin(meta);

		// untrusted：仅激活壳，由 PluginHostPage 渲染 iframe，不进 MF
		if (meta.trust === 'untrusted') {
			this.plugins.set(meta.id, {
				meta,
				bridge: createHostBridge(meta, nav),
				mod: { default: () => null },
				status: 'activated',
				bust,
			});
			return;
		}

		// 正常 MF：registerRemote(meta, bust) 后 loadRemote（省略）
		registerRemote(meta, bust);
		// ...
	} catch (e) {
		// 错误处理（省略）
	}
}
```

**文件路径**：`apps/frontend/src/plugins/core/PluginVerifier.ts`（untrusted 验证）

```typescript
export async function verifyPlugin(d: PluginDescriptor): Promise<void> {
	// 不可信插件：只校验 iframeUrl，禁止 loadRemote 进主文档
	if (d.trust === "untrusted") {
		const src = d.iframeUrl?.trim();

		// 必须提供 iframeUrl
		if (!src) {
			throw new PluginVerifyError(
				`plugin ${d.id}: untrusted requires iframeUrl`,
				"IFRAME",
			);
		}

		// 验证 iframeUrl 是否合法（生产环境必须 https）
		if (!entryUrlAllowed(src)) {
			throw new PluginVerifyError(
				`plugin ${d.id}: iframeUrl must be https (or localhost http in dev)`,
				"ORIGIN",
			);
		}

		return;
	}

	// 正常插件验证流程（省略）
}
```

#### 3.5.3 Host iframe Bridge 通信

**文件路径**：`apps/frontend/src/plugins/core/attachIframeBridge.ts`

```typescript
import type { HostBridgeProps } from "./types";

export const MF_IFRAME_CHANNEL = "dnhyxc-mf-iframe";

/**
 * Host ↔ untrusted iframe：把 bridge 能力经 postMessage 暴露给 embed 页
 * @param iframe - iframe 元素
 * @param bridge - HostBridgeProps 对象
 * @param targetOrigin - iframe 目标 origin
 * @returns 清理函数
 */
export function attachIframeBridge(
	iframe: HTMLIFrameElement,
	bridge: HostBridgeProps,
	targetOrigin: string,
): () => void {
	const win = () => iframe.contentWindow;

	// 发送 init：theme 快照 + 当前 locale + plugin 元信息
	const sendInit = () => {
		const w = win();
		if (!w) return;
		w.postMessage(
			{
				channel: MF_IFRAME_CHANNEL,
				type: "init",
				theme: bridge.api.theme,
				locale: getActiveLocale(),
				plugin: bridge.plugin,
			},
			targetOrigin,
		);
	};

	// Host 顶栏语言变化 → 推送给 iframe（不重挂 iframe）
	const pushLocale = (locale: Locale) => {
		win()?.postMessage(
			{ channel: MF_IFRAME_CHANNEL, type: "locale", locale },
			targetOrigin,
		);
	};
	void onListen<Locale>("locale", (next) => {
		if (next === "zh-CN" || next === "en-US") pushLocale(next);
	});

	// 处理 iframe 发来的消息
	const onMessage = (ev: MessageEvent) => {
		// 验证消息来源
		if (ev.source !== win()) return;
		if (targetOrigin !== "*" && ev.origin !== targetOrigin) return;

		const data = ev.data;
		if (!isRecord(data) || data.channel !== MF_IFRAME_CHANNEL) return;

		// 处理 ready 消息：iframe 已准备好，发送 init
		if (data.type === "ready") {
			const ready = data as ReadyMsg;
			if (ready.pluginId && ready.pluginId !== bridge.plugin.id) return;
			sendInit();
			return;
		}

		// 处理 RPC 请求
		if (data.type !== "rpc") return;
		const rpc = data as RpcMsg;
		if (typeof rpc.id !== "string" || typeof rpc.method !== "string") return;
		const args = Array.isArray(rpc.args) ? rpc.args : [];

		// 异步处理 RPC 请求
		void (async () => {
			try {
				const value = await dispatchRpc(bridge, rpc.method, args);
				// 返回 RPC 结果
				win()?.postMessage(
					{
						channel: MF_IFRAME_CHANNEL,
						type: "rpc-result",
						id: rpc.id,
						ok: true,
						value,
					},
					targetOrigin,
				);
			} catch (e) {
				// 返回 RPC 错误
				win()?.postMessage(
					{
						channel: MF_IFRAME_CHANNEL,
						type: "rpc-result",
						id: rpc.id,
						ok: false,
						error: e instanceof Error ? e.message : String(e),
					},
					targetOrigin,
				);
			}
		})();
	};

	// 注册事件监听
	window.addEventListener("message", onMessage);
	iframe.addEventListener("load", onLoad);

	// 如果 iframe 已加载，立即发送 init
	if (iframe.contentDocument?.readyState === "complete") {
		sendInit();
	}

	// 返回清理函数
	return () => {
		window.removeEventListener("message", onMessage);
		iframe.removeEventListener("load", onLoad);
		unlistenLocale?.();
	};
}

/**
 * 分发 RPC 请求到对应的 bridge API
 */
async function dispatchRpc(
	bridge: HostBridgeProps,
	method: string,
	args: unknown[],
): Promise<unknown> {
	const { api } = bridge;

	switch (method) {
		case "http.get":
			if (!api.http) throw new Error("HTTP_DENIED");
			return api.http.get(String(args[0] ?? ""));
		case "http.post":
			if (!api.http) throw new Error("HTTP_DENIED");
			return api.http.post(String(args[0] ?? ""), args[1]);
		case "http.put":
			if (!api.http) throw new Error("HTTP_DENIED");
			return api.http.put(String(args[0] ?? ""), args[1]);
		case "http.delete":
			if (!api.http) throw new Error("HTTP_DENIED");
			return api.http.delete(String(args[0] ?? ""));
		case "ui.showToast":
			if (!api.ui) throw new Error("UI_DENIED");
			api.ui.showToast(
				args[0] as { message: string; type?: "success" | "error" | "info" },
			);
			return null;
		case "ebook.getBookId":
			return api.modules?.ebook?.getBookId?.() ?? null;
		case "ebook.getBookTitle":
			return api.modules?.ebook?.getBookTitle?.() ?? null;
		case "ebook.navigateToCfi":
			await api.modules?.ebook?.navigateToCfi?.(String(args[0] ?? ""));
			return null;
		case "ebook.openThought":
			api.modules?.ebook?.openThought?.(args[0]);
			return null;
		case "ebook.closeIdeasList":
			api.modules?.ebook?.closeIdeasList?.();
			return null;
		default:
			throw new Error(`UNKNOWN_RPC: ${method}`);
	}
}
```

#### 3.5.4 Remote 端 iframe 客户端

**文件路径**：`apps/remote-plugins/src/utils/iframeHostClient.ts`

```typescript
export const MF_IFRAME_CHANNEL = "dnhyxc-mf-iframe";

/**
 * 与 Host 建立 postMessage 通信连接
 * @param pluginId - 插件 ID
 * @returns HostBridgeProps Promise
 */
export function connectIframeHost(pluginId: string): Promise<HostBridgeProps> {
	// 检查是否在 iframe 内运行
	if (window.parent === window) {
		return Promise.reject(new Error("embed 页须在 Host iframe 内打开"));
	}

	// 存储待处理的 RPC 请求
	const pending = new Map<string, Pending>();
	let seq = 0;

	// RPC 调用函数
	const rpc = (method: string, args: unknown[] = []) =>
		new Promise<unknown>((resolve, reject) => {
			const id = `r${++seq}`;
			pending.set(id, { resolve, reject });
			window.parent.postMessage(
				{ channel: MF_IFRAME_CHANNEL, type: "rpc", id, method, args },
				"*",
			);
		});

	return new Promise((resolve, reject) => {
		let settled = false;

		// 超时处理：15秒未收到 init 则拒绝
		const timeout = window.setTimeout(() => {
			teardown();
			if (!settled) {
				settled = true;
				reject(new Error("等待 Host init 超时"));
			}
		}, 15_000);

		// 清理函数
		const teardown = () => {
			window.clearTimeout(timeout);
			window.clearInterval(retry);
			window.removeEventListener("message", onMessage);
		};

		// 消息处理函数
		const onMessage = (ev: MessageEvent) => {
			const data = ev.data;
			if (!isRecord(data) || data.channel !== MF_IFRAME_CHANNEL) return;

			// 语言热更新（Host onListen → postMessage）
			if (data.type === "locale" && isLocale(data.locale)) {
				applyHostLocale(data.locale);
				return;
			}

			// 处理 init 消息
			if (data.type === "init") {
				window.clearInterval(retry);
				window.clearTimeout(timeout);

				const theme =
					data.theme === "dark" || data.theme === "light"
						? data.theme
						: "light";
				const locale: Locale = isLocale(data.locale) ? data.locale : "zh-CN";

				const plugin =
					isRecord(data.plugin) && typeof data.plugin.id === "string"
						? {
								id: String(data.plugin.id),
								version: String(data.plugin.version ?? "0"),
								routePath: String(data.plugin.routePath ?? ""),
							}
						: { id: pluginId, version: "0", routePath: "" };

				document.documentElement.dataset.theme = theme;
				applyHostLocale(locale);

				// iframe：event 为 no-op；locale 靠 init + locale 消息
				const bridge: HostBridgeProps = {
					api: {
						theme,
						locale,
						event: {
							on: () => undefined,
							off: () => undefined,
							emit: () => undefined,
						},
						http: {
							get: (url) => rpc("http.get", [url]) as Promise<never>,
							post: (url, body) =>
								rpc("http.post", [url, body]) as Promise<never>,
							put: (url, body) =>
								rpc("http.put", [url, body]) as Promise<never>,
							delete: (url) => rpc("http.delete", [url]) as Promise<never>,
						},
						ui: {
							showToast: (options) => {
								void rpc("ui.showToast", [options]);
							},
						},
						modules: {
							ebook: {
								getBookId: () => null,
								getBookTitle: () => null,
								navigateToCfi: (cfi: string) =>
									rpc("ebook.navigateToCfi", [cfi]),
								openThought: (thought: unknown) =>
									rpc("ebook.openThought", [thought]),
								closeIdeasList: () => rpc("ebook.closeIdeasList"),
							},
						},
					},
					plugin,
				};

				// 预取 ebook 数据（同步读需要）
				void (async () => {
					try {
						const [bookId, bookTitle] = await Promise.all([
							rpc("ebook.getBookId"),
							rpc("ebook.getBookTitle"),
						]);
						const ebook = bridge.api.modules!.ebook as {
							getBookId: () => string | null;
							getBookTitle: () => string | null;
						};
						ebook.getBookId = () =>
							typeof bookId === "string" || bookId === null ? bookId : null;
						ebook.getBookTitle = () =>
							typeof bookTitle === "string" || bookTitle === null
								? bookTitle
								: null;
						if (!settled) {
							settled = true;
							resolve(bridge);
						}
					} catch (e) {
						teardown();
						if (!settled) {
							settled = true;
							reject(e instanceof Error ? e : new Error(String(e)));
						}
					}
				})();
				return;
			}

			// 处理 RPC 结果
			if (data.type === "rpc-result" && typeof data.id === "string") {
				const p = pending.get(data.id);
				if (!p) return;
				pending.delete(data.id);
				if (data.ok) p.resolve(data.value);
				else p.reject(new Error(String(data.error ?? "rpc failed")));
			}
		};

		// Ping 函数：向 Host 发送 ready 消息
		const ping = () =>
			window.parent.postMessage(
				{ channel: MF_IFRAME_CHANNEL, type: "ready", pluginId },
				"*",
			);

		// 注册事件监听并开始 ping
		window.addEventListener("message", onMessage);
		ping();
		const retry = window.setInterval(ping, 400); // 每 400ms 发送一次 ready
	});
}
```

#### 3.5.5 Remote 端 embed 页面实现

**文件路径**：`apps/remote-plugins/src/views/embed/index.tsx`

```typescript
import { useEffect, useState, type ComponentProps, type ComponentType } from 'react';
import IdeasListApp from '@/views/ebook/ideas';
import LearningNotesApp from '@/views/learning-notes';
import { connectIframeHost } from '@/utils/iframeHostClient';

type Bridge = {
	api: ComponentProps<typeof IdeasListApp>['api'];
	plugin: ComponentProps<typeof IdeasListApp>['plugin'];
};

/**
 * embed 壳组件：处理与 Host 的连接和错误状态
 * @param pluginId - 插件 ID
 * @param App - 实际插件组件
 */
function EmbedShell({ pluginId, App }: { pluginId: string; App: ComponentType<Bridge> }) {
	const [bridge, setBridge] = useState<Bridge | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		// 连接 Host
		void connectIframeHost(pluginId)
			.then((b) => {
				if (!cancelled) setBridge(b as Bridge);
			})
			.catch((e) => {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : String(e));
				}
			});

		return () => {
			cancelled = true;
		};
	}, [pluginId]);

	// 显示错误状态
	if (error) {
		return (
			<div
				className="plugin-standalone text-destructive h-full p-3 text-sm"
				data-plugin-root
			>
				{error}
			</div>
		);
	}

	// 显示加载状态
	if (!bridge) {
		return (
			<div
				className="plugin-standalone text-textcolor/55 h-full p-3 text-sm"
				data-plugin-root
			>
				连接 Host…
			</div>
		);
	}

	// 渲染实际插件组件
	return (
		<div
			className="plugin-standalone h-full min-h-0"
			data-plugin-root
			data-theme={bridge.api.theme}
		>
			<App {...bridge} />
		</div>
	);
}

/** IdeasList embed 页面 */
export function EmbedIdeasList() {
	return <EmbedShell pluginId="ebookIdeasList" App={IdeasListApp} />;
}

/** LearningNotes embed 页面 */
export function EmbedLearningNotes() {
	return <EmbedShell pluginId="learningNotes" App={LearningNotesApp} />;
}
```

#### 3.5.6 Remote 端路由配置

**文件路径**：`apps/remote-plugins/src/router/routes.tsx`

```typescript
import { EmbedIdeasList, EmbedLearningNotes } from '@/views/embed';

/** 独立预览路由；path 与主站 registry / 业务树对齐 */
export const routes: RouteObject[] = [
	{
		path: '/',
		element: <Layout />,
		children: [
			// 独立预览路由（带导航壳）
			{ index: true, element: <Home /> },
			{
				path: 'english-learning/notes',
				element: (
					<LearningNotesApp
						api={mockApi()}
						plugin={mockPlugin('learningNotes', '/english-learning/notes')}
					/>
				),
			},
			{
				path: 'ebook/plugins/ideas-list',
				element: (
					<IdeasListApp
						api={mockApi({ modules: { ebook: { /* ... */ } }})}
						plugin={mockPlugin('ebookIdeasList', '/ebook/plugins/ideas-list')}
					/>
				),
			},
		],
	},
	/** Host untrusted iframe：无预览壳，经 postMessage 接 Host bridge */
	{
		path: '/embed/ebook/plugins/ideas-list',
		element: <EmbedIdeasList />,
	},
	{
		path: '/embed/english-learning/notes',
		element: <EmbedLearningNotes />,
	},
];
```

#### 3.5.7 Registry 配置示例（untrusted）

```json
{
	"plugins": [
		{
			"id": "thirdPartyPlugin",
			"title": {
				"zh-CN": "第三方插件",
				"en-US": "Third-party plugin"
			},
			"description": {
				"zh-CN": "第三方插件（iframe 隔离）",
				"en-US": "Third-party plugin (iframe isolation)"
			},
			"routePath": "/third-party",
			"entry": "https://example.com:9009/mf-manifest.json",
			"version": "1.0.0",
			"hostApiRange": "^1.0.0",
			"menu": {
				"order": 20,
				"icon": "ExternalLink"
			},
			"permissions": ["ui:toast", "http:plugin-api"],
			"enabled": true,
			"trust": "untrusted",
			"iframeUrl": "https://example.com:9009/embed/third-party"
		}
	]
}
```

**untrusted 插件必须配置的字段**：

| 字段        | 说明                              | 必填 |
| ----------- | --------------------------------- | ---- |
| `trust`     | 必须设置为 `untrusted`            | ✅   |
| `iframeUrl` | iframe 嵌入地址（生产必须 https） | ✅   |
| `entry`     | 仍需填写（用于验证）              | ✅   |

#### 3.5.8 iframe 通信协议

**通信流程**：

```mermaid
sequenceDiagram
    participant Host
    participant Iframe as Remote iframe

    Iframe->>Host: postMessage { type: 'ready', pluginId }
    Host->>Iframe: postMessage { type: 'init', theme, plugin }
    Iframe->>Host: postMessage { type: 'rpc', id, method, args }
    Host->>Iframe: postMessage { type: 'rpc-result', id, ok, value }
```

**消息类型**：

| 类型         | 方向          | 说明                       |
| ------------ | ------------- | -------------------------- |
| `ready`      | Iframe → Host | iframe 已准备好，请求 init |
| `init`       | Host → Iframe | 发送 theme 和 plugin 信息  |
| `rpc`        | Iframe → Host | RPC 调用请求               |
| `rpc-result` | Host → Iframe | RPC 调用结果               |

**支持的 RPC 方法**：

| 方法                   | 说明         | 参数                  | 返回值   |
| ---------------------- | ------------ | --------------------- | -------- |
| `http.get`             | GET 请求     | `[url]`               | 响应数据 |
| `http.post`            | POST 请求    | `[url, body]`         | 响应数据 |
| `ui.showToast`         | 显示 Toast   | `[{ message, type }]` | null     |
| `ebook.getBookId`      | 获取书籍 ID  | `[]`                  | 书籍 ID  |
| `ebook.getBookTitle`   | 获取书籍标题 | `[]`                  | 书籍标题 |
| `ebook.navigateToCfi`  | 导航到 CFI   | `[cfi]`               | null     |
| `ebook.openThought`    | 打开想法     | `[thought]`           | null     |
| `ebook.closeIdeasList` | 关闭想法列表 | `[]`                  | null     |

---

### 3.6 CORS 配置

**开发环境**：

Remote 端 Vite 配置已包含 CORS 设置：

```typescript
server: {
	cors: true,
	headers: {
		'Access-Control-Allow-Origin': '*',
	},
},
```

**生产环境**（Nginx 示例）：

```nginx
server {
	listen 9005 ssl;
	server_name dnhyxc.cn;

	ssl_certificate /path/to/cert.pem;
	ssl_certificate_key /path/to/key.pem;

	location / {
		root /path/to/remote-demo/dist;
		try_files $uri $uri/ /index.html;

		# CORS 配置
		add_header Access-Control-Allow-Origin "*";
		add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
		add_header Access-Control-Allow-Headers "Content-Type";

		if ($request_method = OPTIONS) {
			return 204;
		}
	}
}
```

**Tauri 环境特殊配置**：

Tauri 桌面端需要额外处理 `tauri://localhost` 的 CORS：

```nginx
add_header Access-Control-Allow-Origin "$http_origin";
add_header Access-Control-Allow-Credentials "true";
```

---

### 3.7 Registry 配置示例

**文件路径**：`apps/backend/uploads/remotes/plugins-registry.json`

```json
{
	"updatedAt": "2026/07/27 15:45:00",
	"plugins": [
		{
			"id": "remoteDemo",
			"title": {
				"zh-CN": "插件演示",
				"en-US": "Plugin demo"
			},
			"description": {
				"zh-CN": "Module Federation 接入演示。",
				"en-US": "Module Federation demo."
			},
			"routePath": "/remote-demo",
			"entry": "http://127.0.0.1:9007/mf-manifest.json",
			"version": "1.0.0",
			"hostApiRange": "^1.0.0",
			"menu": {
				"order": 90,
				"icon": "Puzzle"
			},
			"permissions": ["ui:toast", "nav:subtree"],
			"preload": "route",
			"enabled": true,
			"trust": "first-party"
		},
		{
			"id": "ebookIdeas",
			"title": {
				"zh-CN": "全书想法",
				"en-US": "All ideas"
			},
			"description": {
				"zh-CN": "在 EPUB 阅读页浏览本书全部想法。",
				"en-US": "Browse all ideas for the current EPUB."
			},
			"routePath": "/ebook/plugins/ebook-ideas",
			"entry": "http://127.0.0.1:9008/mf-manifest.json",
			"version": "1.0.0",
			"hostApiRange": "^1.0.0",
			"remoteName": "remotePlugins",
			"expose": "./EbookIdeas",
			"injectRoute": false,
			"permissions": ["ui:toast", "http:plugin-api", "modules:ebook"],
			"enabled": true,
			"trust": "first-party"
		}
	]
}
```

**Registry 字段说明**：

| 字段           | 类型                        | 必填 | 说明                                      |
| -------------- | --------------------------- | ---- | ----------------------------------------- |
| `id`           | string                      | ✅   | 插件唯一标识                              |
| `routePath`    | string                      | ✅   | 路由路径                                  |
| `entry`        | string                      | ✅   | MF entry URL                              |
| `version`      | string                      | ✅   | 插件版本（semver）                        |
| `hostApiRange` | string                      | ✅   | Host API 兼容范围                         |
| `enabled`      | boolean                     | ✅   | 是否启用                                  |
| `trust`        | PluginTrust                 | ✅   | 信任等级                                  |
| `title`        | `PluginLocaleMap`           | ❌   | 多语言插件名（插件中心 / 注入路由面包屑） |
| `description`  | `string \| PluginLocaleMap` | ❌   | 多语言说明（或旧版单语字符串）            |
| `menu`         | `{ order, icon? }`          | ❌   | 侧栏入口（仅 icon；无 nameKey）           |
| `injectRoute`  | boolean                     | ❌   | 是否注入顶层路由                          |
| `remoteName`   | string                      | ❌   | MF remote name                            |
| `expose`       | string                      | ❌   | MF expose 路径                            |
| `permissions`  | array                       | ❌   | 权限声明                                  |
| `preload`      | string                      | ❌   | 加载时机                                  |
| `integrity`    | string                      | ❌   | SRI 校验                                  |
| `signature`    | string                      | ❌   | 签名                                      |

> **注意**：不要再写 `titleKey` / `descriptionKey` / `menu.nameKey`。业务 Host 路由（如英语学习笔记页）仍可用自己的 `route.*.titleKey`，那是业务路由 meta，不是 registry 字段。

---

## 4. 完整数据流

```mermaid
flowchart TD
    A[App mount] --> B[pluginManager.init]
    B --> C[fetchPluginRegistry]
    C --> D[mountShell: route + sidebar]
    D --> E{preload === 'eager'?}
    E -->|是| F[queueMicrotask: loadRemote]
    E -->|否| G[等待用户访问]

    H[User 打开路由] --> I[PluginHostPage 挂载]
    I --> J[ensurePlugin]
    J --> K[verifyPlugin]
    K --> L[registerRemote]
    L --> L2[beginPluginStyleCapture]
    L2 --> M[loadRemoteApp]
    M --> M2[CSS 注入 head 并 @scope realm]
    M2 --> M3[endCapture]
    M3 --> N[mod.activate]
    N --> O[渲染 data-mf-plugin + data-mf-style-realm + attachPluginStyleIsolation]

    P[失败] --> Q[设置 failed 状态]
    Q --> R[显示错误 UI]
    R --> S[手动重试]
    S --> J

    T[卸载插件] --> U[mod.deactivate]
    U --> V[清理路由/侧栏]
    V --> W[设置 unloaded 状态]
```

### 数据流详细说明

1. **应用启动**：App 组件挂载后调用 `pluginManager.init()`
2. **拉取 Registry**：从服务器拉取插件清单
3. **挂载壳**：为每个启用的插件注入路由和侧栏（不加载 Remote）
4. **懒加载**：用户首次访问插件路由时才执行 `loadRemote`
5. **验证**：检查信任等级、origin、hostApi 版本等
6. **注册 Remote**：`registerRemote(meta, bust)` 使用已解析的 **`remoteEntry.js?v=`**（manifest 已在 `resolvePluginBust` 拉过一次）；`afterResolve` 再给改写后的 `remoteEntry.js` 补 bust
7. **加载模块**：通过 `loadRemote` 加载远程组件
8. **激活**：调用 `activate` 钩子（如果存在）
9. **渲染**：将插件组件渲染到 `PluginHostPage` 中；`LoadedPlugin.bust` 供下次 ensure 比对

---

## 5. 常见问题与解决方案

### 5.1 双 React 问题

**现象**：Remote 组件无法正常渲染，控制台报错 `Invalid hook call`

**原因**：Host 和 Remote 各加载了一份 React

**解决方案**：

1. Host 和 Remote 都配置 `shared.singleton: true`（**仅** react / react-dom）
2. `optimizeDeps.exclude` 排除 React 相关依赖
3. 使用 `clearMfViteDepCachePlugin` 清理缓存

### 5.1.1 线上 `/plugins` `useLocation` 无 Router

**原因**：Host 把 `react-router` 放进 MF `shared`，生产易与 `react-router/dom` 拆成双实例。

**解决方案**：Host `shared` **不要**包含 `react-router`；用 `resolve.dedupe` 收敛。

### 5.2 `virtual:mf` 解析失败

**现象**：控制台报错 `Failed to resolve virtual:mf:...`

**原因**：`mf_owner` 递增后 `.vite/deps` 缓存失效

**解决方案**：

1. 使用 `clearMfViteDepCachePlugin` 插件
2. 手动删除 `node_modules/.vite` 目录

### 5.3 CORS 错误

**现象**：控制台报错 `Access-Control-Allow-Origin`

**原因**：Remote 未配置 CORS

**解决方案**：

1. Remote 端 Vite 配置 `cors: true`
2. 生产环境 Nginx 添加 CORS 响应头
3. Tauri 环境需允许 `tauri://localhost`

### 5.4 插件加载失败

**现象**：页面显示「插件不可用」

**排查步骤**：

1. 检查 Remote 是否启动
2. 检查 Registry entry URL 是否正确
3. 检查 CORS 配置
4. 检查 `hostApiRange` 是否覆盖 Host `VITE_HOST_API_VERSION`（勿把插件 `version` 误写成 range）
5. 检查信任等级配置
6. 桌面仍旧版：确认 Host 壳已更新（含 resolvePluginBust / afterResolve）；Remote 静态资源已部署且 manifest 有变；`/remotes` 为 `no-store`

### 5.5 HMR 不生效 / 连刷两次

**现象**：修改 Remote 代码后整页刷两次；Host 报 `Importing a module script failed`

**解决方案（React Remote）**：

1. 确保 Remote 配置 `dev.remoteHmr: true` 与 `reactRefreshHost`（指向 Host，如 `http://127.0.0.1:9002`）
2. **不要**在组件同文件导出空 `activate`/`deactivate`（Fast Refresh 整页 reload）
3. 重依赖（如 `@tiptap/*`）写入 `optimizeDeps.include` 并**重启** remote `pnpm dev`
4. 检查端口是否正确

#### Vue Remote 契约（Host 不安装 Vue）

**现行**：Host **不**依赖 `vue`、**不** `registerShared(vue)`。`framework: "vue"` 时 Remote 须导出 `mount(el, bridge)`（或 `{ mount }`）；Host `createVueHostBridge` 只提供挂载点并调用 mount。SFC / `createApp` 全部在 Remote。

若仍 `export { default } from './App.vue'`，Host 会报错提示改 mount API。

### 5.6 桌面发新版插件仍是旧模块

**原因**：MF 解析后把 entry 改写成无 query 的 `remoteEntry.js`，WKWebView 强缓存。

**解决方案**：Host 使用 `resolvePluginBust`（一次 GET manifest → `version@manifestHash` + 解析 `remoteEntry`）+ `registerRemote` 直连 `remoteEntry.js?v=` + `afterResolve` 兜底（见 §2.13）；**只部署 Remote 静态资源即可**（勿为刷缓存改 Host registry），并**发布含该逻辑的桌面壳**。验收进入插件时 Network 里 `mf-manifest.json` 应仅 **1 条**。

### 5.7 样式隔离相关

#### 打开插件后 Host 字体/布局被改坏

**原因**：捕获窗口未生效，或识别失败导致 Remote Preflight 仍全局生效。

**排查**：

1. `runLoad` 是否在 `loadRemoteApp` 外包了 `beginPluginStyleCapture` / `finally endCapture`
2. `PluginHostPage` 是否挂了 `attachPluginStyleIsolation`
3. head 里 Remote `<style>` 是否已有 `@scope ([data-mf-style-realm="..."])`（早期文档曾写 `data-mf-plugin`，现行以 realm 为准）
4. 是否存在未 `disabled` 的跨域 stylesheet link（CORS 失败降级）

#### 插件 UI 完全无样式

**原因**：有 `@scope`，但页面上没有对应的 `data-mf-style-realm` 根；或挂在错误的 portal/宿主外；或同 Remote 多插件切换后未 `reclaim`。

**解决方案**：确认 `PluginHostPage` 渲染了 `data-mf-plugin` **与** `data-mf-style-realm`；Drawer/Portal 由 Host `createPortal` 收编进 `[data-mf-portal-scope]`（同 realm）。切换同 Remote 插件时确认走过 `reclaimEntryStyles`。

#### 同 Remote 多插件：刷新正常、切换后样式乱

**原因**：CSS 只注入一份却按 `pluginId` 包 `@scope`，先打开者独占。

**解决方案**：现行按 `styleRealmKey(entry)` → `data-mf-style-realm`；挂载时 reclaim。见 §2.10.2 / `10.20.0.1`。

#### Portal POP / Drawer 瞬间闪一下

**原因**：`createPortal` 容器在 `body` 与 `[data-mf-portal-scope]` 间切换导致重挂。

**解决方案**：portal-scope 也计入归属；scope 有子节点时 sticky；Drawer 打开前 `claimPluginPortalTarget`（`EbookReadHostPlugins`）。

#### antd Modal / Drawer 打开即崩溃（`getScrollBarSize` / `NotFoundError`）

**现象**：插件内打开 antd `Modal`/`Drawer`，控制台 `NotFoundError: The object can not be found here.`（`getScrollBarSize.js`），`<Portal>` 被 `PluginErrorBoundary` 接住。

**原因**：Host 把 `document.body.appendChild` 重定向到 `[data-mf-portal-scope]`；`rc-util` `getScrollBarSize` 测量完仍调用 `document.body.removeChild(measureEle)`，节点已不在 body 下。

**解决方案**：`ensureBodyPortalPatch` 同步劫持 `Node.removeChild` / `replaceChild`，经 `resolveRetargetedChildParent` 从实际父节点卸载。见 §2.10.2 / `10.0.0.2`。插件侧**无需**改 `getContainer`。

#### Host Toast 把整页往下顶

**原因**：sonner 的 `__insertCSS` 无 vite-id，被 `reclaim` 误 `@scope`，`[data-sonner-toaster]{position:fixed}` 不再命中 Host Toaster。

**解决方案**：`isHostCriticalCss` / `repairHostCriticalStyles`；reclaim 不碰无标记 style；App 根 `data-mf-host-portal`。

#### 外链 CSS 隔离失败

**原因**：`scopeLinkElement` 需 CORS `fetch`；失败则原 link 全局生效。

**解决方案**：Remote/CDN 开 CORS；或把 CSS 打进 JS（推荐）。

#### HMR 后样式又污染 Host

**原因**：仅初始 capture、挂载期未 `attachPluginStyleIsolation`。

**解决方案**：激活态挂载期必须持续捕获（现源码已接）；Observer 在 HMR 改写 textContent 丢掉 `@scope` 时会重包。

#### MF 嵌入后 `backdrop-filter` 失效，Remote 独立预览正常

**原因**：Host 外壳（`PluginPageShell` / Layout）在带 `border-radius` 的同一节点写了 `overflow-hidden`。Chromium 会为此建立裁切上下文，子树毛玻璃采不到更深的 video / 背景。

**解决方案**：

1. `PluginPageShell` 圆角内容区去掉 `overflow-hidden`（见 §2.10.0 文件头注释）
2. Layout：`overflow-hidden` 下沉到**无圆角**或与 rounded **不同层**的节点（见 §2.14.4 注释「overflow 不与 rounded 同层」）
3. 勿在业务里用「给圆角父级加 overflow」当万能裁切；需要裁切时单独加一层无圆角容器

### 5.8 应用级全屏后侧栏仍在 / Esc 后壳卡住

**原因**：只对插件 DOM 调了 `requestFullscreen`，未走 Host `api.ui.setAppFullscreen`；或退出时未回写 `false`。

**解决方案**：

1. Registry 声明 `ui:toast`
2. 进入/退出调用 `await api.ui.setAppFullscreen(true|false)`
3. Web Esc：Layout 有 `fullscreenchange` 兜底；插件仍应主动退出
4. Tauri：确认 capability 含 `allow-set-fullscreen`
5. 详见 §2.14；接入手册见 `host-plugin-integration-guide.md` §15

### 5.9 刷新子应用路径先出现 404 再出插件页

**原因**：首屏 router 在 `pluginManager.init()` 完成前只有静态路由；插件 `routePath` 未注入时 URL 命中顶层 `*` → `NotFound`。

**解决方案**（详见 §2.11）：

1. `pluginsReady` 初始为 `false`；init 的 `finally` 置 `true` 并重建 router
2. `buildRoutes(false)` 将 `*` 换成 `PluginRoutesPending`，勿渲染 404
3. 注入完成后再匹配插件页；真假路径在 ready 后才显示 NotFound
4. **不要**整站等待 init 再挂 `RouterProvider`（会拖慢所有静态页）

---

## 6. 总结

本项目的 Module Federation 动态插件系统实现了：

- **运行时动态注册**：无需预配置，通过 registry 动态加载插件
- **懒加载策略**：优化启动性能，按需加载
- **刷新防闪 404**：`pluginsReady` + catch-all 占位（§2.11），静态路由仍可首屏匹配
- **entry 缓存破坏**：`version@manifestHash`；**一次** GET manifest + 直连 `remoteEntry.js?v=` + `afterResolve` 兜底（发布者勿改 Host registry）
- **应用级全屏**：`setAppFullscreen` + Layout 影院态 + 独立路由 `PluginPageShell`
- **MF 内毛玻璃**：Layout / `PluginPageShell` overflow 与 rounded 分层（§2.10.0 / §2.14.4）
- **Host shared 收敛**：仅 shared react / react-dom；勿 shared react-router
- **主子样式隔离**：Host `@scope([data-mf-style-realm])` + transpile/CSSOM + head 劫持 + MutationObserver + `createPortal`/body Teleport 收编 + Drawer `claimPluginPortalTarget`（§2.10.2）；Remote 零侵入 Tailwind；`untrusted` 走 iframe
- **安全验证**：hostApiRange 运行时校验 + 保存 registry 前置校验
- **幂等注入**：避免重复注入导致的闪烁问题
- **失败重试**：稳定的失败态管理，支持手动重试
- **多插件共享**：支持一仓多 expose，减少资源消耗

主项目开发者可以参考第 2 章了解完整实现（样式隔离见 **§2.10.2**），插件开发者可以参考第 3 章与 `plugin-development-guide.md` 进行接入。
