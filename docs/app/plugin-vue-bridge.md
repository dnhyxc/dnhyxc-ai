# Vue 子应用桥接（跨框架插件支持）

> **文档角色**：Host 开发者 / 插件开发者的 Vue 子应用接入说明
> **阅读时间**：约 10 分钟
> **目标**：让 React Host 无缝加载 Vue Remote（SFC / 组件），子应用仅需在 registry 声明 `framework: 'vue'`

## 1. 背景与目标

主站使用 React 构建，但部分业务团队希望用 Vue（特别是 `<script setup>` SFC）开发插件。以往 Module Federation 只能加载与 Host 同框架的 Remote，导致跨框架插件无法运行。

**本轮改动**：在 Host 侧新增 Vue→React 桥接层，使 `loadRemoteApp` 能自动识别 Vue Remote 并包装为 React 组件，插件开发者仅需：

1. 在 registry 中声明 `"framework": "vue"`
2. 或在 expose 中导出 `export const framework = 'vue'`
3. 或让组件形态可被启发式识别（`__vccOpts` / `setup` / `render`）

## 2. 改动范围

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `apps/frontend/src/plugins/core/createVueHostBridge.tsx` | **新增** | Vue 根组件 → React 组件工厂 |
| `apps/frontend/src/plugins/core/normalizePluginModule.ts` | **新增** | 框架检测 + 模块规范化 |
| `apps/frontend/src/plugins/core/types.ts` | 修改 | `PluginDescriptor.framework` 字段 |
| `apps/frontend/src/plugins/core/mf.ts` | 修改 | `loadRemoteApp` 接入 `normalizePluginModule` |
| `apps/frontend/src/plugins/index.ts` | 修改 | barrel 导出新符号 |
| `apps/frontend/vite.config.ts` | 修改 | `vue` 加入 shared 单例 |
| `apps/frontend/src/i18n/locales/zh-CN.ts` | 修改 | `framework` 字段帮助文本 |
| `apps/frontend/src/i18n/locales/en-US.ts` | 修改 | 同上英文版 |
| `apps/frontend/src/plugins/docs/README.md` | 修改 | 插件开发手册索引更新 |
| `apps/micro/plugin-info.md` | 修改 | Remote 接入约定更新 |

## 3. 实现思路

### 3.1 整体架构

```
registry 声明 framework: 'vue'
         │
         ▼
loadRemoteApp(d)
         │  loadRemote 拿到 RawRemoteModule
         ▼
normalizePluginModule(raw, meta)
         │  isVueRemoteModule() 判定
         ▼
    ┌─ Vue Remote ─┐
    │              │
    ▼              ▼
createVueHostBridge(VueRoot)   →   PluginModule {
                                    default: ReactComponent,
                                    activate,
                                    deactivate
                                  }
         │
         ▼
PluginHostPage 渲染 ReactComponent
         │
         ▼
React useEffect(createApp + mount)
React useEffect(unmount) → Vue app.unmount()
```

### 3.2 关键设计决策

1. **Host 侧统一桥接**：不在 Remote 中引入 React 依赖，保持 Vue Remote 纯净
2. **reactive bridge 传参**：Vue 组件通过 `props.bridge` 访问 Host API，用 `reactive` 包裹以支持热更新（`api` / `plugin` 变化时自动响应）
3. **三级判定**：registry 声明 > expose 标记 > 组件启发式，逐层回退
4. **Vue shared 单例**：`vite.config.ts` 中 `vue` 标记为 `singleton`，确保 Host 桥接与 Remote 运行时共用同一 Vue 实例
5. **`data-mf-framework` 标记**：桥接容器加 `data-mf-framework="vue"` 属性，供调试和未来扩展识别

## 4. 关键代码对比与注释

### 4.1 `PluginDescriptor.framework` 字段（`types.ts`）

**对比范围**：`PluginDescriptor` 接口中 `expose` 字段之后新增 `framework` 字段，完整接口段落（约 L55–L68）

**改动前** · `apps/frontend/src/plugins/core/types.ts`（基线，约 L55–L65）

```typescript
// MF registerRemotes.name；默认 `id`。多插件共享同一 Remote 时填 federation name
remoteName?: string;
// MF expose 路径；默认 `./App`（如 `./IdeasList`）
expose?: string;
// 权限声明
permissions: PluginPermission[];
// 加载时机（默认 route = 懒加载）
preload?: 'eager' | 'route' | 'idle';
enabled: boolean;
```

**改动后** · `apps/frontend/src/plugins/core/types.ts`（当前，约 L55–L69）

```typescript
// MF registerRemotes.name；默认 `id`。多插件共享同一 Remote 时填 federation name
remoteName?: string;
// MF expose 路径；默认 `./App`（如 `./IdeasList`）
expose?: string;
// 子应用 UI 框架。`vue` 时 Host 用 `createVueHostBridge` 包装 default（Vue SFC/组件）
// 省略时：看 expose 是否 `export const framework = 'vue'`，再启发式识别 Vue 组件
framework?: 'react' | 'vue';
// 权限声明
permissions: PluginPermission[];
// 加载时机（默认 route = 懒加载）
preload?: 'eager' | 'route' | 'idle';
enabled: boolean;
```

**变更摘要**：在 `expose` 与 `permissions` 之间新增 `framework?: 'react' | 'vue'` 字段，供 Host 桥接层优先识别。

### 4.2 `loadRemoteApp` 集成 `normalizePluginModule`（`mf.ts`）

**对比范围**：`loadRemoteApp` 函数体中 Remote 加载与规范化逻辑（约 L246–L263）

**改动前** · `apps/frontend/src/plugins/core/mf.ts`（基线，约 L246–L260）

```typescript
export async function loadRemoteApp(
	d: PluginDescriptor,
): Promise<PluginModule> {
	// 在加载插件之前，确保 shared 和 bust 插件已注册
	ensureShared();
	// 确保 bust 插件已注册
	ensureBustPlugin();
	const name = remoteNameOf(d);
	const expose = exposeBaseOf(d);
	// 直接 loadRemote 拿 PluginModule，default 导出即为 React 组件
	const mod = await getMf().loadRemote<PluginModule>(`${name}/${expose}`);
	// 缺 default 导出直接报错
	if (!mod?.default) {
		throw new Error(
			`plugin ${d.id}: expose ./${expose} missing default export`,
		);
	}
	// 原样返回
	return mod;
}
```

**改动后** · `apps/frontend/src/plugins/core/mf.ts`（当前，约 L246–L263）

```typescript
// 引入 normalizePluginModule + RawRemoteModule 类型
import {
	normalizePluginModule,
	type RawRemoteModule,
} from './normalizePluginModule';

export async function loadRemoteApp(
	// 插件描述符（含 framework 字段）
	d: PluginDescriptor,
// 返回规范化后的 PluginModule；函数体开始
): Promise<PluginModule> {
	// 在加载插件之前，确保 shared 和 bust 插件已注册
	ensureShared();
	// 确保 bust 插件已注册（entry bust 机制）
	ensureBustPlugin();
	// 取 Remote federation name
	const name = remoteNameOf(d);
	// 取 expose 路径（相对路径，如 ./App）
	const expose = exposeBaseOf(d);
	// 加载原始模块（类型为 RawRemoteModule，可能是 React 或 Vue 组件）
	const raw = await getMf().loadRemote<RawRemoteModule>(`${name}/${expose}`);
	// 缺 default 导出直接报错
	if (!raw?.default) {
		// 错误信息含插件 id 和 expose 路径
		throw new Error(
			`plugin ${d.id}: expose ./${expose} missing default export`,
		);
	}
	// 规范化：Vue Remote → createVueHostBridge 包装；React Remote 原样返回
	return normalizePluginModule(raw, d);
// 结束 loadRemoteApp
}
```

**变更摘要**：`loadRemoteApp` 不再直接返回 `loadRemote` 结果，而是将 `RawRemoteModule` 经 `normalizePluginModule` 规范化；Vue Remote 会被自动桥接为 React 组件。

### 4.3 `normalizePluginModule` — 框架检测与规范化（`normalizePluginModule.ts`）

**对比范围**：纯新增文件。完整符号定义（约 L1–L70）

**改动后** · `apps/frontend/src/plugins/core/normalizePluginModule.ts`（当前，约 L1–L70，纯新增）

```typescript
// React 组件类型
import type { ComponentType } from 'react';
// Vue 桥接工厂
import { createVueHostBridge } from './createVueHostBridge';
// 插件相关类型
import type { HostBridgeProps, PluginDescriptor, PluginModule } from './types';

// Remote 原始模块：可能是 React 组件，或 Vue 组件 + framework 标记
export type RawRemoteModule = {
	// 组件默认导出
	default: unknown;
	// expose 级别的框架标记（可选）
	framework?: string;
	// MF 约定的框架标记（可选）
	mfFramework?: string;
	// 可选的激活回调
	activate?: PluginModule['activate'];
	// 可选的失活回调
	deactivate?: PluginModule['deactivate'];
};

// 启发式判断组件是否为 Vue SFC / setup 组件
function looksLikeVueComponent(comp: unknown): boolean {
	// 非对象非函数则不可能是 Vue 组件
	if (!comp || (typeof comp !== 'object' && typeof comp !== 'function')) {
		// 早返回
		return false;
	// 结束基础类型判定
	}
	// 转为字典方便取特征字段
	const c = comp as Record<string, unknown>;
	// React memo / forwardRef 有 $$typeof 标记
	if ('$$typeof' in c) return false;
	// Vue SFC 编译产物带 __vccOpts
	if ('__vccOpts' in c) return true;
	// setup() 函数形式的组件
	if (typeof c.setup === 'function' || typeof c.render === 'function') {
		// 符合 Vue 组件特征
		return true;
	// 结束 setup/render 判定
	}
	// 函数形式的 SFC 编译产物检查
	if (typeof comp === 'function' && '__vccOpts' in (comp as object)) {
		// 函数形式的 SFC
		return true;
	// 结束函数形式判定
	}
	// 以上条件均不满足则视为非 Vue 组件
	return false;
// 结束 looksLikeVueComponent
}

// 三级判定：registry 声明 > expose 标记 > 组件启发式
export function isVueRemoteModule(
	// loadRemote 返回的原始模块
	raw: RawRemoteModule,
	// 插件描述符（含 framework 字段）
	meta: PluginDescriptor,
// 返回是否为 Vue Remote；函数体开始
): boolean {
	// 优先级 1：registry 显式声明为 vue
	if (meta.framework === 'vue') return true;
	// 优先级 1b：registry 显式声明为 react，直接排除
	if (meta.framework === 'react') return false;
	// 优先级 2：expose 中导出的 framework 标记
	const tag = raw.framework ?? raw.mfFramework;
	// 命中 vue 标记
	if (tag === 'vue') return true;
	// 命中 react 标记
	if (tag === 'react') return false;
	// 优先级 3：启发式检测组件形态
	return looksLikeVueComponent(raw.default);
// 结束 isVueRemoteModule
}

// 将 loadRemote 原始模块规范为 Host 可用的 PluginModule
export function normalizePluginModule(
	// loadRemote 返回的原始模块
	raw: RawRemoteModule,
	// 插件描述符
	meta: PluginDescriptor,
// 返回规范化后的 PluginModule；函数体开始
): PluginModule {
	// 缺 default 导出则报错
	if (!raw?.default) {
		// 错误信息含插件 id
		throw new Error(`plugin ${meta.id}: expose missing default export`);
	// 结束缺导出分支
	}

	// 判定是否为 Vue Remote
	if (isVueRemoteModule(raw, meta)) {
		// Vue Remote：用 createVueHostBridge 包装为 React 组件
		return {
			// 包装后的 React 组件作为 default
			default: createVueHostBridge(
				// 类型断言为 Vue 组件
				raw.default as Parameters<typeof createVueHostBridge>[0],
			),
			// 透传 activate 回调
			activate: raw.activate,
			// 透传 deactivate 回调
			deactivate: raw.deactivate,
		};
	// 结束 Vue Remote 分支
	}

	// React Remote：原样透传
	return {
		// default 即为 React 组件
		default: raw.default as ComponentType<HostBridgeProps>,
		// 透传 activate 回调
		activate: raw.activate,
		// 透传 deactivate 回调
		deactivate: raw.deactivate,
	};
// 结束 normalizePluginModule
}
```

**变更摘要**：`isVueRemoteModule` 实现三级判定（registry > expose > 启发式）；`normalizePluginModule` 将 Vue 组件经 `createVueHostBridge` 包装为 React 组件，React 组件原样透传。

### 4.4 `createVueHostBridge` — Vue→React 桥接工厂（`createVueHostBridge.tsx`）

**对比范围**：纯新增文件。完整符号定义（约 L1–L67）

**改动后** · `apps/frontend/src/plugins/core/createVueHostBridge.tsx`（当前，约 L1–L67，纯新增）

```typescript
// Vue 桥接工厂：PluginHostPage 只渲染 React default
// Vue Remote 导出 SFC / 组件后，由 loadRemoteApp → normalizePluginModule 调用本工厂包装
import { type ComponentType, createElement, useEffect, useRef } from 'react';
// Vue 核心 API：createApp / reactive / App 类型
import {
	createApp,
	reactive,
	type App as VueApp,
	type Component as VueComponent,
} from 'vue';
// Host Bridge 属性类型
import type { HostBridgeProps } from './types';

// Vue 根组件 props：Host 注入的 bridge（reactive，可热更新 api/locale）
export type VuePluginRootProps = {
	// 响应式 bridge 对象，含 api 和 plugin
	bridge: HostBridgeProps;
};

// 把 Vue 根组件包成 Host 可用的 React 组件
// 子应用勿自建 React 桥；registry `framework: 'vue'` 或 expose `export const framework = 'vue'`
export function createVueHostBridge(
	// Vue 根组件（SFC / setup / render 均可）
	VueRoot: VueComponent,
// 返回 Host 可直接渲染的 React ComponentType；函数体开始
): ComponentType<HostBridgeProps> {
	// React 函数组件：每个 Vue Remote 实例对应一个 React 组件
	function VueHostBridge(props: HostBridgeProps) {
		// 挂载目标 DOM ref
		const elRef = useRef<HTMLDivElement | null>(null);
		// Vue 应用实例 ref（供卸载时使用）
		const appRef = useRef<VueApp | null>(null);
		// reactive bridge：Vue 组件通过 props.bridge 访问 Host API
		// reactive 包裹确保 api/plugin 变化时 Vue 组件自动响应
		const bridgeRef = useRef(
			reactive({
				// 初始化：从 props 取 api
				api: props.api,
				// 初始化：从 props 取 plugin 信息
				plugin: props.plugin,
			}) as HostBridgeProps,
		);

		// bridge 热更新：props 变化时同步写入 reactive 对象
		useEffect(() => {
			// 同步最新 api 到 reactive bridge
			bridgeRef.current.api = props.api;
			// 同步最新 plugin 信息
			bridgeRef.current.plugin = props.plugin;
		}, [props.api, props.plugin]);

		// Vue 应用生命周期：挂载 + 卸载
		useEffect(() => {
			// 取 DOM 容器
			const el = elRef.current;
			// 容器不存在则跳过（理论上不会）
			if (!el) return;

			// 创建 Vue 应用，注入 reactive bridge
			const app = createApp(VueRoot, {
				// bridge 作为 Vue 根组件的 props
				bridge: bridgeRef.current,
			});
			// 挂载到 DOM 容器
			app.mount(el);
			// 保存 Vue app 引用，供卸载使用
			appRef.current = app;

			// React useEffect cleanup：组件卸载时卸载 Vue 应用
			return () => {
				// 调用 Vue 应用的 unmount
				app.unmount();
				// 清空引用
				appRef.current = null;
			};
		}, []);

		// 返回挂载容器 div：作为 Vue 应用的根节点
		return createElement('div', {
			// React ref 绑定
			ref: elRef,
			// 全高全宽，撑满 PluginHostPage
			className: 'h-full w-full min-h-0',
			// 标记为插件根容器
			'data-plugin-root': true,
			// 标记框架类型，供调试与未来扩展
			'data-mf-framework': 'vue',
		});
	}

	// 设置 displayName 便于 React DevTools 识别
	VueHostBridge.displayName = 'VueHostBridge';
	// 返回包装后的 React 组件
	return VueHostBridge;
// 结束 createVueHostBridge
}
```

**变更摘要**：`createVueHostBridge` 是 Vue→React 桥的核心工厂——用 `reactive` 包裹 bridge 确保热更新，`useEffect` 负责 Vue app 的 createApp + mount/unmount，返回带 `data-mf-framework="vue"` 标记的 React 组件。

### 4.5 `vite.config.ts` — Vue shared 单例

**对比范围**：`MF_SHARED_EXCLUDE` 数组与 `federation.shared` 配置（约 L19–L27 + L62–L66）

**改动前** · `apps/frontend/vite.config.ts`（基线，约 L19–L25 + L62–L64）

```typescript
const MF_SHARED_EXCLUDE = [
	'react',
	'react/jsx-runtime',
	'react/jsx-dev-runtime',
	'react-dom',
	'react-dom/client',
];
// ...
shared: {
	react: { singleton: true, requiredVersion: '^19.1.0' },
	'react-dom': { singleton: true, requiredVersion: '^19.1.0' },
},
```

**改动后** · `apps/frontend/vite.config.ts`（当前，约 L19–L27 + L62–L66）

```typescript
// MF_SHARED_EXCLUDE：排除 optimizeDeps 预打包的依赖
// Vue 子应用与 Host 桥共享同一运行时（createVueHostBridge 内部 import 'vue'）
const MF_SHARED_EXCLUDE = [
	// React 核心运行时
	'react',
	// React JSX 运行时（生产）
	'react/jsx-runtime',
	// React JSX 运行时（开发）
	'react/jsx-dev-runtime',
	// React DOM 渲染
	'react-dom',
	// React DOM 客户端
	'react-dom/client',
	// Vue 核心运行时：Host 桥接与 Remote 需共用同一 Vue 单例
	'vue',
];
// ...
// federation shared 配置：跨 Remote 共用单例
shared: {
	// React 单例，版本锁定
	react: { singleton: true, requiredVersion: '^19.1.0' },
	// React DOM 单例，版本锁定
	'react-dom': { singleton: true, requiredVersion: '^19.1.0' },
	// Vue 单例：Host bridge + Vue Remote 共享同一 Vue 运行时
	vue: { singleton: true, requiredVersion: '^3.5.0' },
},
```

**变更摘要**：`vue` 加入 `MF_SHARED_EXCLUDE` 避免 Vite optimizeDeps 预打包导致双实例；`federation.shared` 中 `vue` 标记为 `singleton: true` + `requiredVersion: '^3.5.0'`，确保 Host 桥接与 Remote Vue 组件共用同一运行时。

### 4.6 `index.ts` — barrel 导出

**对比范围**：新增 Vue bridge 相关导出（约 L8–L9 + L25–L29）

**改动前** · `apps/frontend/src/plugins/index.ts`（基线，约 L1–L30）

```typescript
// 仅导出 React 相关符号
export { createHostBridge } from './core/createHostBridge';
// ... 其余导出，无 Vue 相关
```

**改动后** · `apps/frontend/src/plugins/index.ts`（当前，约 L8–L9 + L25–L29）

```typescript
// Vue 桥接类型导出
export type { VuePluginRootProps } from './core/createVueHostBridge';
// Vue 桥接工厂导出
export { createVueHostBridge } from './core/createVueHostBridge';
// ... 其余导出

// RawRemoteModule 类型导出（供外部识别原始模块结构）
export type { RawRemoteModule } from './core/normalizePluginModule';
// 框架检测与规范化函数
export {
	isVueRemoteModule,
	normalizePluginModule,
} from './core/normalizePluginModule';
```

**变更摘要**：barrel 新增 `createVueHostBridge`、`isVueRemoteModule`、`normalizePluginModule` 三个运行时符号及 `VuePluginRootProps`、`RawRemoteModule` 两个类型导出。

### 4.7 i18n — `framework` 字段帮助文本

**对比范围**：`plugins.registry.help.framework` 键新增（en-US.ts + zh-CN.ts，各 2 行）

**改动前** · `apps/frontend/src/i18n/locales/zh-CN.ts`（基线，约 L1783）

```typescript
// 无 framework 帮助文本
'plugins.registry.help.expose':
	'MF expose 路径，默认 ./App；如 ./LearningNotes、./EbookIdeas。',
'plugins.registry.help.injectRoute':
	'是否由 PluginManager 注入顶层路由。false 表示宿主业务树已挂好 PluginHostPage。',
```

**改动后** · `apps/frontend/src/i18n/locales/zh-CN.ts`（当前，约 L1783）

```typescript
// expose 路径帮助文本（保持不变）
'plugins.registry.help.expose':
	'MF expose 路径，默认 ./App；如 ./LearningNotes、./EbookIdeas。',
// 新增 framework 字段帮助文本
'plugins.registry.help.framework':
	'可选 react | vue。vue 时 Host 用 createVueHostBridge 包装 default（也可在 expose 导出 framework = "vue"）。',
// injectRoute 帮助文本（保持不变）
'plugins.registry.help.injectRoute':
	'是否由 PluginManager 注入顶层路由。false 表示宿主业务树已挂好 PluginHostPage。',
```

**变更摘要**：新增 `plugins.registry.help.framework` 国际化条目，中英双语，为插件 Registry 编辑器提供字段说明。

## 5. 插件接入流程（Vue Remote 开发者视角）

### 5.1 步骤

1. **Registry 声明**：在插件 Registry JSON 中加入 `"framework": "vue"`
2. **Remote 导出**：expose 导出的 `default` 即为 Vue 根组件（SFC / `<script setup>` / `setup()` 函数均可）
3. **可选标记**：在 expose 中额外导出 `export const framework = 'vue'` 作为二级标识
4. **样式契约**：每个 expose 入口须 `import '@/styles.css'`（详见 `plugin-development-guide.md §5.2`）

### 5.2 接入示例

```json
{
  "id": "my-vue-plugin",
  "framework": "vue",
  "remoteName": "micro",
  "expose": "./MyVueApp",
  "entry": "http://127.0.0.1:9008/mf-manifest.json",
  "injectRoute": false,
  "permissions": [],
  "trust": "trusted",
  "enabled": true
}
```

```vue
<!-- Remote 侧：src/views/MyVueApp/index.vue -->
<script setup lang="ts">
// 从 Host 桥接注入的 reactive bridge 访问 API
defineProps<{ bridge: import('@/plugins').VuePluginRootProps['bridge'] }>();

// 可选：在 expose 中导出 framework 标记
</script>
```

## 6. 兼容性与影响

| 维度 | 说明 |
|------|------|
| React Remote | 完全不受影响，`normalizePluginModule` 透传 |
| Vue Remote | 新增支持，无需在 Remote 中引入 React |
| `loadRemoteApp` 签名 | 返回类型不变（`PluginModule`），外部调用方无感知 |
| Vite 配置 | `vue` 加入 shared singleton；旧 Remote 若使用 Vue 需升级 |
| 样式隔离 | Vue 组件挂载后处于 `data-plugin-root` 容器内，自动继承 Host `@scope` 样式隔离 |
| 性能 | `reactive` 桥仅包含 `api` / `plugin` 两个字段，开销可忽略 |

## 7. 行为变化

| 场景 | 改动前 | 改动后 |
|------|--------|--------|
| Vue Remote 加载 | `loadRemote` 拿到 Vue 组件，`PluginHostPage` 渲染失败（非 React 组件） | `normalizePluginModule` 自动包装为 React 组件，正常渲染 |
| registry 无 framework | 仅支持 React Remote | 回退到 `framework` 标记或启发式检测 |
| 多 Vue Remote 共存 | 不支持 | 共用 Vue 单例，互不干扰 |
| Remote 动态 import Vue | 可能产生双实例 | shared singleton 确保唯一实例 |

## 8. 风险与回归

### 8.1 建议回归路径

1. **React Remote**：加载 / 卸载 / 切换插件正常
2. **Vue Remote**：加载 / 卸载 / 切换 / 热更新正常
3. **混合场景**：React + Vue 插件共存、路由切换、全局状态同步
4. **样式隔离**：Vue 插件内 Tailwind 样式不泄漏、不被其他插件污染
5. **API 热更新**：Host `api` 变化时 Vue 组件通过 `bridge` 实时响应
6. **卸载清理**：切换插件时 Vue app.unmount 正确执行，无内存泄漏

### 8.2 已知限制

- Vue Remote 必须使用 Vue 3（`^3.5.0`），Vue 2 不支持
- 不可信插件（`trust: untrusted`）仍走 iframe，不进入 Vue 桥接流程
- Vue Remote 的 Teleport（`to="body"`）不受 `data-mf-portal-scope` 收编——需插件使用 `App.vue` 根容器内定位

## 9. 相关文档索引

| 文档 | 说明 |
|------|------|
| [style-isolation-qiankun-harden.md](./style-isolation-qiankun-harden.md) | 样式隔离第三轮加固（transpile / CSSOM / Portal） |
| [style-isolation-realm-portal.md](./style-isolation-realm-portal.md) | Realm 键 + React Portal 收编 |
| [style-isolation-implementation.md](./style-isolation-implementation.md) | 首轮 CSS @scope 实现 |
| [plugin-development-guide.md](../../apps/frontend/src/plugins/docs/plugin-development-guide.md) | §4.3 Vue + registry framework / §5.2 expose 须 import styles.css |
| [mf-implementation-guide.md](../../apps/frontend/src/plugins/docs/mf-implementation-guide.md) | MF 实现细节总览 |
| [plugin-info.md](../../apps/micro/plugin-info.md) | Remote 接入约定（样式契约 / expose / registry） |

---

（若与仓库最新源码不一致，以源码为准）