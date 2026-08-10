# @dnhyxc-ai/federation-kit 子项目接入指南（Plugin Integration Guide）

> **一句话**：本目录面向**子项目 / 插件（Remote）开发者**，手把手讲解如何把你的项目做成一个「微前端子应用」，并**以三种不同形式接入主项目（Host）**：
>
> 1. **独立路由页**（自动注入路由 + 侧栏菜单）；
> 2. **业务页内嵌**（抽屉 / 工具栏插槽，随业务页展示）；
> 3. **iframe 隔离**（不可信第三方，浏览器沙箱 + `postMessage` RPC）。
>
> **写法约定**：每一份代码都带**逐行中文注释**（注释写在代码上方），并在代码块前后用正文充分解释**意图与语义**。读者照抄即可接入。
>
> **对照源码**：本文以当前仓库 `packages/federation-kit/src/**`（kit 内核）为契约依据；子项目侧的真实参考实现见本仓外的 `apps/micro` / `apps/remote-plugins`（多 expose，端口 **9008**）、`apps/remote-demo`（最小插件，端口 **9007**）、`micro-vue`（Vue 样例，端口 **9009**）。若与源码不一致，以源码为准。
>
> **与 `docs/host-guide` 的区别**：host-guide 讲「主项目怎么接子项目」（Host 视角）；本目录讲「子项目怎么被接入、怎么在不同形态下运行」（Remote 视角）。两边互补，遇到 Host 侧机制（registry、bridge 组装、样式隔离）会交叉引用。

---

## 目录（阅读顺序）

| 顺序 | 文件 | 内容 | 篇幅 |
|------|------|------|------|
| 1 | [01-concepts.md](./01-concepts.md) | **先读**：子项目在微前端里的位置、信任分级、三种接入方式总览、HostBridge 契约 | 概念 |
| 2 | [02-scaffold.md](./02-scaffold.md) | 项目初始化：环境变量、依赖、tsconfig、目录结构、开发服务器 | 实操 |
| 3 | [03-vite-config.md](./03-vite-config.md) | Vite federation 配置：`federation()` 每一项为什么这么写 | 核心 |
| 4 | [04-expose-contract.md](./04-expose-contract.md) | expose 契约：React 默认导出 / 生命周期钩子 / Vue `mount`，Host 如何规范化 | 核心 |
| 5 | [05-host-bridge.md](./05-host-bridge.md) | HostBridge API 全参考：`api.*` 有什么、权限门、用法示例 | 能力 |
| 6 | [06-connect-auto-route.md](./06-connect-auto-route.md) | **接入方式一**：独立路由页（自动注入路由 + 侧栏） | 接入 |
| 7 | [07-connect-surface-slot.md](./07-connect-surface-slot.md) | **接入方式二**：业务页内嵌（抽屉 / 工具栏插槽） | 接入 |
| 8 | [08-connect-iframe.md](./08-connect-iframe.md) | **接入方式三**：iframe 隔离（untrusted）+ 完整协议 + 客户端 | 接入 |
| 9 | [09-vue-plugin.md](./09-vue-plugin.md) | Vue 子应用接入：`mount` 契约、registry、Element Plus | 专项 |
| 10 | [10-styles-isolation.md](./10-styles-isolation.md) | 样式规范：expose 引入 CSS、Tailwind、Portal、主题 token | 规范 |
| 11 | [11-i18n-locale.md](./11-i18n-locale.md) | 插件内 i18n：自有字典、`useHostLocale`、三种 locale 来源 | 规范 |
| 12 | [12-preview-lifecycle-debug.md](./12-preview-lifecycle-debug.md) | 独立预览、生命周期钩子、调试技巧 | 实操 |
| 13 | [13-publish-registry.md](./13-publish-registry.md) | 构建、部署、Nginx、Registry 注册、缓存破坏、验收清单 | 发布 |

> 时间紧只看：README 速览 → [02](./02-scaffold.md) → [03](./03-vite-config.md) → [04](./04-expose-contract.md) → 选一种接入方式（[06](./06-connect-auto-route.md) / [07](./07-connect-surface-slot.md) / [08](./08-connect-iframe.md)），即可跑通 MVP。

---

## 30 秒速览（一个最小插件）

子项目侧你只需要做**三件事**，剩下的（怎么加载、怎么进路由、怎么隔离样式）全是 Host + kit 的事：

```ts
// ① Vite federation 配置：声明自己是个 MF Remote，暴露 ./App
// vite.config.ts
import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';

export default {
	base: 'http://127.0.0.1:9008/', // 必须与 Host registry 的 entry 一致
	plugins: [
		react(),
		federation({
			name: 'pluginDemo',        // 唯一 federation 名
			filename: 'remoteEntry.js', // 固定值
			manifest: true,             // 生成 mf-manifest.json（Host 靠它算缓存指纹）
			exposes: { './App': './src/App.tsx' }, // 暴露哪个模块
			shared: {
				react: { singleton: true },      // 与 Host 共享同一份 React
				'react-dom': { singleton: true },
			},
		}),
	],
};
```

```tsx
// ② 插件主组件：default 导出，props 接收 HostBridge
// src/App.tsx
export default function App({ api, plugin }) {
	return (
		<div data-plugin-root>
			<h1>{plugin.id}</h1>
			<button onClick={() => api.ui?.showToast({ message: 'hi' })}>
				Toast
			</button>
		</div>
	);
}
```

```jsonc
// ③ 在 Host 的 plugins-registry.json 里登记（只需 Host 管理员加一条）
{
	"id": "pluginDemo",
	"title": { "zh-CN": "示例插件", "en-US": "Demo plugin" },
	"routePath": "/plugin-demo",                    // 接入方式一：自动路由
	"entry": "http://127.0.0.1:9008/mf-manifest.json",
	"version": "1.0.0",
	"hostApiRange": "^1.0.0",                       // 须覆盖 Host 的 VITE_HOST_API_VERSION
	"permissions": ["ui:toast"],                    // 插件能用什么 api
	"enabled": true,
	"trust": "first-party"
}
```

之后用户在 Host 侧栏看到 `plugin-demo` 入口，点击进入即加载你的代码并渲染——**子项目接入完成**。

---

## 三种接入方式（本指南主线）

| 接入方式 | registry 关键字段 | Host 如何呈现 | 插件需要额外做什么 | 详细章节 |
|----------|-------------------|---------------|--------------------|----------|
| **① 独立路由页** | `routePath`（+ 可选 `menu`） | 自动注入一条路由，侧栏出现图标入口 | 一个整页组件即可（Host 会套页壳） | [06](./06-connect-auto-route.md) |
| **② 业务页内嵌** | `host: { surface, slot }` | 在业务页的抽屉 / 工具栏位置渲染 | 一个聚焦组件（无整页 chrome）；不改 portal container | [07](./07-connect-surface-slot.md) |
| **③ iframe 隔离** | `trust: "untrusted"` + `iframeUrl` | 独立 `<iframe>` 沙箱 + `postMessage` RPC | 一个 `/embed/...` 页面 + `connectIframeHost` 客户端 | [08](./08-connect-iframe.md) |

> 一个插件可以**同时**声明多种接入方式：比如既有 `routePath`（进路由页）又有 `host.surface`（进业务页抽屉）。

---

## 子项目开发者心智模型

```text
┌────────────────────────────────────────────────────────────┐
│  主项目 Host（别人维护，你无需改代码）                        │
│  · registry 决定"哪些插件上架、以哪种方式挂载"                 │
│  · PluginManager 按需加载你的 remoteEntry.js                │
│  · createHostBridge 按权限组装 api 传给你                    │
│  · style-isolation 隔离你的 CSS                              │
├────────────────────────────────────────────────────────────┤
│  @dnhyxc-ai/federation-kit（契约）                           │
│  · 你收到 props = { api, plugin }（HostBridgeProps）        │
│  · Vue 子应用：导出 mount(el, bridge)                        │
│  · iframe 子应用：postMessage 协议                           │
├────────────────────────────────────────────────────────────┤
│  你的子项目 Remote（你要做的事）                              │
│  · Vite federation 配置 + exposes                           │
│  · 组件 default 导出（或 Vue mount）                        │
│  · 自有 i18n / 样式 / 独立预览                               │
└────────────────────────────────────────────────────────────┘
```

**你的职责边界**：你只管「暴露组件 + 消费 bridge + 自备样式/文案」；「什么时候加载、加载哪个入口、怎么隔离样式、怎么校验安全」全部由 Host 负责。这也意味着——**你的子项目必须能独立 `pnpm dev` 运行**，否则无法自测。

---

## 文档中出现的真实契约速查

| 契约 | 定义位置 | 说明 |
|------|----------|------|
| `HostBridgeProps` | `packages/federation-kit/src/types/index.ts` | 插件组件收到的 props：`{ api, plugin }` |
| `PluginDescriptor` | `packages/federation-kit/src/types/index.ts` | registry 里一条插件的完整字段 |
| `PluginModule` | `packages/federation-kit/src/types/index.ts` | Remote 模块规范化后的形态（`default` / `activate` / `deactivate`） |
| `normalizePluginModule` | `packages/federation-kit/src/mf/normalizePluginModule.ts` | Host 把你的 expose 规范成可挂载模块 |
| `createHostBridge` | `packages/federation-kit/src/bridge/createHostBridge.ts` | Host 按权限组装 `api` |
| `attachIframeBridge` | `packages/federation-kit/src/bridge/attachIframeBridge.ts` | iframe 模式的 `postMessage` 协议 |
| `createVueHostBridge` | `packages/federation-kit/src/bridge/createVueHostBridge.tsx` | Vue Remote → React 桥 |
