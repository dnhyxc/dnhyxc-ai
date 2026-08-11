# 01 · 概念：子项目在微前端里的位置

> **本章目标**：从**子项目（Remote）开发者**的视角，建立「你的项目是怎么被 Host 发现、校验、加载、挂载」的完整图景，并讲清**信任分级**与**三种接入方式**，以及贯穿全篇的 **HostBridge 契约**。
>
> 对应源码：`packages/federation-kit/src/types/index.ts`、`packages/federation-kit/src/runtime/createPluginRuntime.ts`、`packages/federation-kit/src/mf/normalizePluginModule.ts`。

---

## 1. 你是谁：Remote，不是独立应用

在微前端架构里，你的项目被称作 **Remote（子应用）**，主项目是 **Host**。

| 维度 | Host（主项目） | Remote（你） |
|------|----------------|--------------|
| 职责 | 发现、校验、加载、挂载、隔离 | 提供可被加载的组件/页面 |
| 代码 | 不含任何子项目源码 | **不在** Host 构建产物里 |
| 运行 | 启动时就知道自己的路由 | 不知道也不关心自己被挂到哪 |
| 通信 | 通过 `createHostBridge` 注入能力 | 通过 props / `postMessage` 消费能力 |

**核心结论**：你的代码**永远不会被打进 Host 的 bundle**。Host 运行时读到 registry 里你的条目，按需 `fetch` 你的 `mf-manifest.json` 和 `remoteEntry.js`，再用 Module Federation 动态 import 你的 expose 模块。

---

## 2. 一次完整的「子项目被接入」的生命周期

```
1. Host 启动：mf.start()
   ├─ 拉 registry（plugins-registry.json）
   ├─ 按账号偏好过滤出「已上架」的插件
   └─ mountShell：为 routePath/menu 注入路由壳与侧栏项（不下载你的代码！）

2. 用户点侧栏/路由进入你的插件（或业务页挂载你的 surface 槽）
   └─ ensurePlugin(你的 id)
        ├─ verifyPlugin：origin / hostApiRange / integrity / signature
        ├─ resolvePluginBust：GET 你的 mf-manifest.json，算 version@指纹
        ├─ registerRemote：注册你的 remoteEntry.js（带 ?v= 防缓存）
        ├─ loadRemoteApp：MF 动态 import 你的 expose 模块
        ├─ beginPluginStyleCapture：捕获并前缀化你的 CSS
        └─ createHostBridge：按权限组装 api → 渲染你的组件

3. 你的组件收到 props { api, plugin } 开始渲染
```

> **对你的意义**：① 不用关心「什么时候被加载」；② 首次真正加载发生在**用户进入时**（懒加载）；③ `hostApiRange` 不符会被直接拒绝——这是 Host 的安全门，不是 bug。

---

## 3. 信任分级：first-party / partner / untrusted

registry 里每条插件都有一个 `trust` 字段，决定 Host 用什么方式承载你的代码：

| `trust` | 语义 | 加载方式 | 你能用到的能力 |
|---------|------|----------|----------------|
| `first-party` | 第一方（自己产品线） | MF 动态 import（与 Host 同 realm） | `api` 全量（按 permissions） |
| `partner` | 合作方（受控的第三方） | MF 动态 import | 同上 |
| `untrusted` | 不可信第三方 | 独立 `<iframe>` 沙箱 | 仅 `postMessage` RPC |

> **信任等级影响样式隔离方式**（详见第 10 章）：`first-party` / `partner` 由 Host 用 CSS 选择器前缀做隔离，你可以正常引入 Tailwind；`untrusted` 在 iframe 里天然隔离，样式自由但通信受限。

---

## 4. 三种接入方式（本指南的主线）

Host 通过 registry 字段决定**以哪种形态**呈现你。三种方式不是互斥的——一个插件可以同时声明多种。

### 4.1 接入方式一：独立路由页（自动注入路由）

```jsonc
// registry 关键字段
{
	"id": "learningNotes",
	"routePath": "/plugins/learning-notes",  // 路由路径
	"menu": { "order": 10, "icon": "https://cdn.example.com/icons/demo.svg" } // 可选：侧栏图标（推荐 SVG URL）
}
```

- Host 启动时把 `routePath` 注入自己的路由表，并在侧栏加图标。
- 用户点击侧栏或直接访问该路径 → Host 懒加载你的代码，套上统一页壳渲染。
- **你要做的**：提供一个「整页」组件（可带自己的子路由/内部导航）。

### 4.2 接入方式二：业务页内嵌（抽屉 / 工具栏插槽）

```jsonc
// registry 关键字段
{
	"id": "ebookTool",
	"host": {
		"surface": "ebook.read", // 业务面：如「电子书阅读页」
		"slot": "drawer",        // 位置：抽屉或顶栏
		"icon": "Sparkle",
		"order": 1
	}
}
```

- Host 在业务页渲染 `<PluginHostSurface surface="ebook.read" />`，自动收集该 surface 下所有已上架插件。
- 你的组件出现在抽屉里 / 顶栏，随业务页一起展示。
- **你要做的**：提供一个「聚焦」组件（不套整页外壳，不动 `portal container`）。

### 4.3 接入方式三：iframe 隔离（untrusted）

```jsonc
// registry 关键字段
{
	"id": "thirdPartyTool",
	"trust": "untrusted",
	"iframeUrl": "https://third-party.com/embed/my-tool"
}
```

- Host 用 `<iframe>` 沙箱承载你，`postMessage` 通信。
- 你需要一个**无宿主壳**的 `/embed/...` 页面 + 一个 `connectIframeHost` 客户端来拿到 bridge。
- **你要做的**：提供 embed 页面 + iframe 客户端；不可操作 Host DOM。

---

## 5. HostBridge 契约：你唯一需要认识的「接口」

无论哪种接入方式，你的业务组件最终都会拿到**同一个形状**的数据——`HostBridgeProps`（定义见 `packages/federation-kit/src/types/index.ts`）：

```ts
// 插件组件收到的 props（MF 嵌入是 props 传入；iframe 是 postMessage 还原）
export interface HostBridgeProps {
	// api：主项目注入的能力（不可变，deep frozen）
	api: Readonly<{
		theme: 'light' | 'dark';          // 主题快照，永远有
		locale: 'zh-CN' | 'en-US';        // 当前语言，永远有（会热更新）
		navigate?: (to: string) => void;  // 需要权限 nav:subtree，且限定在你的 routePath 内
		event: {                          // 事件总线，永远有（on/off/emit）
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		http?: {                          // 需要权限 http:plugin-api
			get: <T = unknown>(url: string) => Promise<T>;
			post: <T = unknown>(url: string, body?: unknown) => Promise<T>;
			put: <T = unknown>(url: string, body?: unknown) => Promise<T>;
			delete: <T = unknown>(url: string) => Promise<T>;
		};
		ui?: {                            // 需要权限 ui:toast
			showToast: (options: { message: string; type?: 'success' | 'error' | 'info' }) => void;
			setAppFullscreen?: (full: boolean) => Promise<void>; // 应用级影院全屏
			downloadBlob?: (options: { fileName: string; data: ArrayBuffer | Uint8Array; mimeType?: string }) => Promise<{
				ok: boolean; hostToasted: boolean; message?: string;
			}>;
		};
		modules?: Readonly<Record<string, unknown>>; // 需要权限 modules:xxx
	}>;
	// plugin：你自己在 registry 里的身份信息
	plugin: Readonly<{ id: string; version: string; routePath: string }>;
}
```

**三条铁律**（详见第 5 章）：

1. `api` 是 **deep frozen** 的：你不能改它，只能读。Hot 更新 locale 靠「换新的 props」而不是修改原对象。
2. `api` 里的可选字段是**按权限裁剪**的：没申请 `http:plugin-api`，`api.http` 就是 `undefined`。**用之前必须判空**。
3. `api.locale` 会热更新：MF 模式下 Host 每次语言切换都重新传 props + 发 `event('locale')`；iframe 模式发 `locale` 消息。你的 UI 必须响应它（用 `useHostLocale`，见第 11 章）。

---

## 6. 你与 Host 的职责边界（一句话版）

| Host 负责（你不碰） | 你负责（Host 不碰） |
|---------------------|---------------------|
| 加载时机 / 懒加载 | 组件如何渲染、内部状态 |
| 安全校验 / 版本判断 | 业务逻辑 |
| 样式隔离 / Portal 收编 | 自有文案字典（i18n） |
| 路由 / 侧栏 / 生命周期调度 | 独立预览能力（`pnpm dev`） |
| bridge 组装 / iframe 协议 | `default` 导出（React）或 `mount`（Vue） |
