# 04 · expose 契约：你的模块长什么样

> **本章目标**：讲清 Host 加载你之后，**期望你的 expose 模块导出什么**。覆盖 React 默认导出、`activate` / `deactivate` 生命周期钩子、Vue 的 `mount` 导出，以及 Host 侧的 `normalizePluginModule` 是如何「翻译」你的模块的。
>
> 对应源码：`packages/federation-kit/src/mf/normalizePluginModule.ts`、`packages/federation-kit/src/bridge/createVueHostBridge.tsx`、`packages/federation-kit/src/types/index.ts`。

---

## 1. Host 期望的模块形态

Host 用 Module Federation 动态 import 你的 expose 模块后，得到一个「原始模块」，然后交给 `normalizePluginModule` 规范化：

```ts
// packages/federation-kit/src/mf/normalizePluginModule.ts（Host 侧源码，逐行注释）
import type { ComponentType } from 'react';
import { createVueHostBridge, type VueRemoteExpose } from '../bridge/createVueHostBridge';
import type { HostBridgeProps, PluginDescriptor, PluginModule } from '../types';

// Remote 原始模块：React 组件，或 Vue mount API + framework 标记
export type RawRemoteModule = {
	default: unknown;                    // 核心：default 导出
	framework?: string;                  // 构建期打上的 framework 标记（可选）
	mfFramework?: string;                // 旧名兼容
	activate?: PluginModule['activate'];     // 可选生命周期钩子
	deactivate?: PluginModule['deactivate']; // 可选生命周期钩子
};

// 启发式：default 形如 { mount: fn } 的对象 → 视为 Vue mount（避免裸函数误判为 React FC）
function looksLikeVueMount(comp: unknown): boolean {
	return (
		!!comp &&
		typeof comp === 'object' &&
		typeof (comp as { mount?: unknown }).mount === 'function'
	);
}

// 判断「这个模块是不是 Vue」：registry/expose 显式标记 > 构建标记 > 启发式
export function isVueRemoteModule(raw: RawRemoteModule, meta: PluginDescriptor): boolean {
	// registry 里写了 framework: 'vue' → 是 Vue
	if (meta.framework === 'vue') return true;
	if (meta.framework === 'react') return false;
	// 模块自带的标记
	const tag = raw.framework ?? raw.mfFramework;
	if (tag === 'vue') return true;
	if (tag === 'react') return false;
	// 兜底启发式：default 是 { mount } → Vue
	return looksLikeVueMount(raw.default);
}

// 规范化：Vue → createVueHostBridge 包成 React 组件；React → 原样
export function normalizePluginModule(raw: RawRemoteModule, meta: PluginDescriptor): PluginModule {
	if (!raw?.default) {
		throw new Error(`plugin ${meta.id}: expose missing default export`);
	}
	if (isVueRemoteModule(raw, meta)) {
		// Vue：把 mount 包成 React 组件（createVueHostBridge），Host 侧只管 React 渲染
		return {
			default: createVueHostBridge(raw.default as VueRemoteExpose, meta.id),
			activate: raw.activate,
			deactivate: raw.deactivate,
		};
	}
	// React：default 就是可渲染组件，props 接收 HostBridgeProps
	return {
		default: raw.default as ComponentType<HostBridgeProps>,
		activate: raw.activate,
		deactivate: raw.deactivate,
	};
}
```

> **对你的意义**：Host 只认「模块的 `default` 导出」。React 子项目：`default` 导出组件；Vue 子项目：`default` 导出 `mount(el, bridge)` 或 `{ mount }`。生命周期钩子 `activate` / `deactivate` 从入口 `named export` 出来即可。

---

## 2. React 子项目：default 导出组件

### 2.1 最小形态

```tsx
// src/App.tsx —— 最小可用插件组件
export default function App({ api, plugin }: HostBridgeProps) {
	return (
		<div className="plugin-standalone" data-plugin-root>
			<h1>{plugin.id} v{plugin.version}</h1>
			<p>theme={api.theme} · locale={api.locale}</p>
		</div>
	);
}
```

### 2.2 建议的 HostBridgeProps 类型定义（插件侧自建）

> kit 没有把 `HostBridgeProps` 直接发布成「插件侧依赖」——你只需要把类型复制到自己的 `src/types/host.ts`（或从 `@dnhyxc-ai/federation-kit` 引用类型）。**不要把它当运行时依赖**。

```ts
// src/types/host.ts —— 与 kit 的 HostBridgeProps 对齐（无 api.t）
export type HostBridgeProps = {
	api: {
		theme: 'light' | 'dark';                 // 主题快照（无热更新）
		locale?: 'zh-CN' | 'en-US';              // 当前语言（热更新）
		navigate?: (to: string) => void;         // 子路由导航（需 nav:subtree）
		event: {                                  // 事件总线（永远有）
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		http?: {                                  // 需 http:plugin-api
			get: <T = unknown>(url: string) => Promise<T>;
			post: <T = unknown>(url: string, body?: unknown) => Promise<T>;
			put: <T = unknown>(url: string, body?: unknown) => Promise<T>;
			delete: <T = unknown>(url: string) => Promise<T>;
		};
		ui?: {                                    // 需 ui:toast
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => void;
			setAppFullscreen?: (full: boolean) => Promise<void>;
			downloadBlob?: (options: {
				fileName: string;
				data: ArrayBuffer | Uint8Array;
				mimeType?: string;
			}) => Promise<{ ok: boolean; hostToasted: boolean; message?: string }>;
		};
		modules?: Readonly<Record<string, (...args: unknown[]) => unknown>>; // 需 modules:xxx
	};
	plugin: { id: string; version: string; routePath: string };
};
```

### 2.3 组件实现检查表

| 要求 | 是否必须 | 说明 |
|------|----------|------|
| `default` 导出组件 | ✅ | React 组件；Vue 为 `mount`（见第 9 章） |
| 定义 `HostBridgeProps` 类型 | ✅ | 见上（Vue 根收 `props.bridge`） |
| 根元素 `data-plugin-root` | ✅ | Host 样式隔离契约属性 |
| 根元素 `plugin-standalone` | ✅ React / 等价类名 | 独立预览样式自洽 |
| `api` 参数按需使用 | ⚠️ | 使用前判权限（见第 5 章） |
| `activate` / `deactivate` | ❌ | 可选生命周期钩子（见 §4） |

---

## 3. expose 入口文件：一个完整的例子

多 expose 时，每个 expose 入口文件应该是「薄壳」——尽量少逻辑，避免 HMR 整页 reload：

```ts
// src/views/ideas-list/index.ts —— MF expose 入口（对齐 apps/micro 各页面入口）
// 必须：Host 不执行 main.tsx，样式必须挂在 expose 入口上（第 10 章）
import '@/styles.css';

// 再导出主组件
export { default } from './App';

// 再导出生命周期钩子（放在独立文件，避免与组件同文件导致 Fast Refresh 整页刷新）
export { activate, deactivate } from './lifecycle';
```

```ts
// src/views/ideas-list/lifecycle.ts —— 生命周期钩子独立文件（第 12 章有专门讲解）
import type { HostBridgeProps } from '@/types/host';

// 模块加载完成、挂载前执行（可 async）
export async function activate(api: HostBridgeProps['api']) {
	// 注册全局事件 / 预拉数据
	api.event.on('book-changed', (data) => {
		console.log('书籍变更:', data);
	});
	await api.http?.get('/api/init-data');
}

// 插件卸载前执行（清理订阅 / 定时器）
export async function deactivate() {
	// 清理
}
```

---

## 4. 生命周期钩子（activate / deactivate）

Host 的 `PluginManager.runLoad` 这样调用它们（`packages/federation-kit/src/runtime/createPluginRuntime.ts`）：

```ts
// 加载成功、拿到模块后：调用 activate，传入组装好的 api
const bridge = createHostBridge(meta, this.config.capabilities, nav);
await mod.activate?.(bridge.api);

// 卸载时：先调 deactivate，再清事件、路由、侧栏
async unloadPlugin(id: string) {
	const loaded = this.plugins.get(id);
	if (!loaded) { /* 未加载：直接清路由/侧栏 */ return; }
	try {
		await loaded.mod.deactivate?.();
	} catch (e) {
		console.error(`[PluginManager] deactivate ${id}`, e);
	}
	eventBus.clearPlugin(id);
	this.routeInjector.remove(id);
	this.sidebarInjector.remove(id);
	// ...
}
```

> **⚠️ HMR 注意**：`activate` / `deactivate` 与 React 组件写在同一文件会导致 Vite Fast Refresh 整页刷新（开发态连刷两次，并打断 Host 对 remote 的 `import()`，报「Importing a module script failed」）。**无全局副作用时不要导出空钩子**；确需钩子时拆到独立文件再由入口 re-export（见上方 lifecycle.ts）。

| 钩子 | 调用时机 | 参数 | 返回值 |
|------|----------|------|--------|
| `activate` | 模块加载后 | `api: HostBridgeProps['api']` | `Promise<void>` 或 `void` |
| `deactivate` | 模块卸载前 | 无 | `Promise<void>` 或 `void` |

---

## 5. 总结：你的「模块契约」就是这几条

1. **必须**有 `default` 导出（React 组件 / Vue `mount`）。
2. `activate` / `deactivate` 可选，但**建议独立成文件**。
3. 每个 expose 入口**必须** `import '@/styles.css'`（否则嵌入 Host 后没样式）。
4. 组件根元素加 `data-plugin-root`。
5. Host 会调用 `verifyPlugin`（安全校验）——`hostApiRange` 不符会拒绝加载（见 host-guide 第 9 章）。
