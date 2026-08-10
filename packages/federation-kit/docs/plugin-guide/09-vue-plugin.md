# 09 · Vue 子应用接入

> **本章目标**：讲清 Vue 子应用与 React 子应用在接入上的差异。**核心**：Host 不安装 Vue——Vue Remote 必须导出 `mount(el, bridge)`，由 Host 的 `createVueHostBridge` 包成 React 组件来渲染。
>
> 对应源码：`packages/federation-kit/src/bridge/createVueHostBridge.tsx`、`packages/federation-kit/src/mf/normalizePluginModule.ts`。参考实现：`micro-vue`（端口 9009）。

---

## 1. 一句话

Host 是 React 应用且**不安装 Vue**。你的 Vue 子应用自带 Vue runtime，expose 导出 `mount(el, bridge)`；Host 加载后调用 `mount` 把 Vue 应用挂到指定 DOM。

**所以**：不要直接 `export default` 一个 Vue SFC——Host 不会 React-render 它，会报「framework "vue" 须 default 导出 mount」。

---

## 2. Host 侧桥（理解契约）

`normalizePluginModule` 检测到 Vue 后调用 `createVueHostBridge`（`packages/federation-kit/src/bridge/createVueHostBridge.tsx`）：

```tsx
// Host 侧源码（关键片段）
/** Remote 的 mount 类型：挂到 el，可返回 disposer */
export type VueRemoteMount = (
	el: HTMLElement,
	bridge: HostBridgeProps,
) => VueRemoteDisposer | undefined;

// 兼容两种导出：直接函数 / { mount } 对象
export type VueRemoteExpose = VueRemoteMount | { mount: VueRemoteMount; unmount?: () => void };

// 把 Vue Remote 的 mount 包成 Host 可用的 React 组件
export function createVueHostBridge(expose: VueRemoteExpose, pluginId = 'unknown') {
	const mount = resolveMount(expose, pluginId); // 解析出真正的 mount

	function VueHostBridge(props: HostBridgeProps) {
		const elRef = useRef<HTMLDivElement | null>(null);
		// 可变 bag：Remote 侧 reactive(bridge) 后可收到 api/locale 热更新
		const bridgeRef = useRef<HostBridgeProps>({ api: props.api, plugin: props.plugin });

		useEffect(() => {
			bridgeRef.current.api = props.api;      // api/locale 变化时更新 bag
			bridgeRef.current.plugin = props.plugin;
		}, [props.api, props.plugin]);

		// useLayoutEffect：早于 paint、早于子树挂载——保证 Element Plus 在
		// onBeforeMount 建 popper 容器时，Host 的 Portal 桥已就绪
		useLayoutEffect(() => {
			const el = elRef.current;
			if (!el) return;
			const dispose = mount(el, bridgeRef.current);
			const explicitUnmount = typeof expose === 'object' && 'unmount' in expose
				? expose.unmount : undefined;
			return () => {
				if (typeof dispose === 'function') dispose();
				else explicitUnmount?.();
			};
		}, []); // 空 deps：mount 一次；SFC HMR 由 Remote 自有 Vue runtime 处理

		return createElement('div', {
			ref: elRef,
			className: 'h-full w-full min-h-0',
			'data-plugin-root': true,
			'data-mf-framework': 'vue',
		});
	}
	return VueHostBridge;
}
```

> **对你（Vue 开发者）的意义**：
> 1. 你的 `mount` 会拿到一个**真实 DOM 容器**和一个 **bridge**；
> 2. bridge 是**同一个对象**（可变 bag）——建议 `reactive(bridge)` 后交给 Vue 根组件，Host 语言切换时 `api.locale` 会热更新；
> 3. 你的 `mount` 可以返回卸载函数，Host 会在插件卸载时调用。

---

## 3. registry 配置

```jsonc
// plugins-registry.json 里 Vue 插件的条目（React 不需要 framework 字段）
{
	"id": "vueStyleIsolationLab",
	"title": { "zh-CN": "Vue 样式实验", "en-US": "Vue style lab" },
	"routePath": "/plugins/vue-style-isolation-lab",
	"entry": "http://127.0.0.1:9009/mf-manifest.json",
	"expose": "./StyleIsolationLab",      // 对应你 exposes 里的入口
	"framework": "vue",                   // ★ 必须写！告诉 Host 用 Vue 桥
	"version": "1.0.0",
	"hostApiRange": "^1.0.0",
	"permissions": ["ui:toast"],
	"enabled": true,
	"trust": "first-party"
}
```

> 省略 `framework` 时 Host 会**启发式判断**（default 形如 `{ mount }` → Vue）。**显式写 `"framework": "vue"` 最稳**，避免误判。

---

## 4. expose 入口（Vue）

```ts
// src/views/my-lab/index.ts —— Vue MF expose 入口
// 必须：Host 不执行 main.ts，样式要挂在 expose 上（第 10 章）
import '@/styles.css';
import { createApp, reactive } from 'vue';
import App from './App.vue';
import type { HostBridgeProps } from '@/types/host';

// ① 直接导出函数（推荐）
export function mount(el: HTMLElement, bridge: HostBridgeProps) {
	// reactive(bridge)：Host 语言切换时 api.locale 热更新，Vue 响应式自动触发渲染
	const app = createApp(App, { bridge: reactive(bridge) });
	app.mount(el);
	// 返回卸载函数（可选）
	return () => app.unmount();
}

// ② 或导出 { mount } 对象
export default { mount };
```

```vue
<!-- src/views/my-lab/App.vue -->
<template>
	<div class="plugin-standalone h-full" data-plugin-root>
		<h1>{{ t('lab.title') }} · {{ bridge.plugin.version }}</h1>
		<p>theme={{ bridge.api.theme }} · locale={{ bridge.api.locale }}</p>
		<el-button type="primary" @click="toast">
			{{ t('lab.toast') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/i18n';

// 根组件收到 bridge（reactive 过）
const props = defineProps<{ bridge: HostBridgeProps }>();
const bridge = props.bridge;

// 组件内自己维护文案字典（第 11 章），跟随 bridge.api.locale
const t = useI18n(() => bridge.api.locale);

const toast = () => {
	bridge.api.ui?.showToast({ message: t('lab.toast'), type: 'success' });
};
</script>
```

---

## 5. 关键差异速查（React vs Vue）

| 事项 | React 子应用 | Vue 子应用 |
|------|--------------|------------|
| registry `framework` | 可省略 | **必须** `"vue"` |
| expose 导出 | `default` React 组件 | `mount(el, bridge)` 或 `{ mount }` |
| 根 props | `props` 直接收 `HostBridgeProps` | 根组件收 `props.bridge` |
| bridge 热更新 | React 每次重传新 props | 用 `reactive(bridge)` 同一个对象 |
| shared vue | — | Host **不** shared vue；Remote 自带 vue |
| Host 是否装 Vue | — | 不装 |

---

## 6. Vite 配置（Vue 版差异）

```ts
// vite.config.ts —— Vue 子应用
import { federation } from '@module-federation/vite';
import vue from '@vitejs/plugin-vue';   // 用 Vue 插件替代 react

export default defineConfig(({ mode }) => {
	return {
		base: `${origin}/`, // 同 React：与 registry entry 一致
		plugins: [
			vue(),
			federation({
				name: 'microVue',
				filename: 'remoteEntry.js',
				manifest: true,
				exposes: { './StyleIsolationLab': './src/views/my-lab/index.ts' },
				// Vue 子应用：不必 shared vue（Host 不装 Vue），
				// 也可按需本仓 singleton。react 相关不用 shared
				shared: {},
				hostInitInjectLocation: 'entry',
				dts: false,
				dev: { remoteHmr: true }, // SFC HMR 走 Remote 自己的 Vite
			}),
		],
		// 不必 exclude react*（你没有 React），按需 exclude/预打包 vue
		optimizeDeps: {
			exclude: ['vue-demi'],
		},
		server: { host, port: 9009, strictPort: true, cors: true, headers: { 'Access-Control-Allow-Origin': '*' } },
		build: { target: 'esnext', modulePreload: false, minify: false },
		resolve: { alias: { '@': '/src' } },
	});
});
```

---

## 7. Element Plus 与样式

- **每个 expose 入口** `import '@/styles.css'` 之外，还要确保 Element Plus 的样式随 expose 加载：`import 'element-plus/dist/index.css'`（或保证按需样式覆盖 Teleport 组件）。
- **图标**建议包 `<el-icon>`：裸 SVG 在 Tailwind `svg { display: block }` 下容易撑满容器。
- **Portal**：EP 的 `#el-popper-container-*` 由 Host 自动收编，**不要**自己改 `getContainer` / `appendTo`。

---

## 8. 常见问题

| 症状 | 原因 | 解决 |
|------|------|------|
| Vue 嵌 Host 白屏 | 仍 `export default` SFC | 改为 `export default { mount }` 或函数 mount |
| 报「framework "vue" 须导出 mount」 | registry 没写 `framework: vue` 且 default 不是 mount | 写 `"framework": "vue"` |
| 当成 React 渲染（hooks 报错） | 启发式误判 | 显式 `"framework": "vue"` |
| 浮层样式缺失 | EP CSS 没随 expose 加载 | expose 里 `import 'element-plus/dist/index.css'` |
| 语言不更新 | 没 reactive bridge | `createApp(App, { bridge: reactive(bridge) })` |
