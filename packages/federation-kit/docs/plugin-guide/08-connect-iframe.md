# 08 · 接入方式三：iframe 隔离（untrusted）

> **本章目标**：讲清「不可信第三方插件」如何在 Host 的 `<iframe>` 沙箱里运行，包括**完整通信协议**、**`connectIframeHost` 客户端实现**、**embed 页面**，以及 Host 侧 `attachIframeBridge` 是如何响应的。
>
> 对应源码：`packages/federation-kit/src/bridge/attachIframeBridge.ts`（Host 侧协议）、`packages/federation-kit/src/react/PluginHostView.tsx`（iframe 渲染）。

---

## 1. 适用场景

| 场景 | 是否需要 iframe |
|------|------------------|
| `trust: "untrusted"` / 第三方不可信 | ✅ |
| 需要强隔离（独立 JS/CSS 文档，不能操作 Host DOM） | ✅ |
| 第一方 / 合作方（`first-party` / `partner`） | ❌（MF 嵌入，样式由 Host 隔离） |

> **为什么不可信插件不能用 MF 嵌入**：MF 动态 import 的代码与 Host **同 realm**，一旦有恶意脚本就能操作 Host 的 `document` / `window`。iframe + `sandbox` 属性提供浏览器级别的软隔离。

---

## 2. 整体架构

```
Host 页面
  └─ <PluginHostView pluginId="thirdPartyTool">
       └─ <UntrustedIframe src="https://third-party.com/embed/my-tool" />
            └─ iframe 里的 embed 页面（你的）
                 └─ connectIframeHost('thirdPartyTool')
                      ├─ postMessage ready 握手
                      ├─ 收到 Host 的 init（theme / locale / plugin）
                      └─ 之后用 bridge 调 RPC（http / ui.showToast ...）
```

---

## 3. Host 侧：iframe 怎么被渲染

Host 的 `PluginHostView` 检测到 `trust === 'untrusted'` 时走 `UntrustedIframe`（`packages/federation-kit/src/react/PluginHostView.tsx`）：

```tsx
// Host 侧源码（关键片段）
function UntrustedIframe({ pluginId, src, bridge, iframeBridge }) {
	const iframeRef = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		const el = iframeRef.current;
		if (!el) return;
		let origin: string;
		try {
			origin = new URL(src).origin; // 目标 origin = iframeUrl 的 origin
		} catch {
			return;
		}
		// 挂上 postMessage 桥：负责 ready/init/locale/rpc/rpc-result
		return attachIframeBridge(el, bridge, origin, iframeBridge);
	}, [src, bridge, iframeBridge]);

	return (
		<iframe
			ref={iframeRef}
			title={pluginId}
			src={src}
			className="h-full w-full border-0"
			data-mf-plugin={pluginId}
			data-mf-trust="untrusted"
			sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
		/>
	);
}
```

> **`sandbox` 说明**：`allow-scripts` 允许跑 JS；`allow-same-origin` 保留同源能力（配合真实 https 域名）；`allow-forms`、`allow-popups` 按需放开。**没有** `allow-top-navigation` 等敏感权限。

---

## 4. 完整通信协议

`attachIframeBridge`（Host 侧）实现的协议，双向共 5 种消息：

| 消息 | 方向 | 载荷 | 触发 |
|------|------|------|------|
| `ready` | iframe → Host | `{ channel, type: 'ready', pluginId }` | iframe 加载后（重试直至成功） |
| `init` | Host → iframe | `{ channel, type: 'init', theme, locale, plugin }` | 收到 `ready` / iframe `load` |
| `locale` | Host → iframe | `{ channel, type: 'locale', locale }` | Host 语言切换 |
| `rpc` | iframe → Host | `{ channel, type: 'rpc', id, method, args }` | iframe 调用受限能力 |
| `rpc-result` | Host → iframe | `{ channel, type: 'rpc-result', id, ok, value \| error }` | Host 处理完 RPC |

`channel` 默认 `dnhyxc-mf-iframe`（Host 可用 `iframeChannel` 配置改）。

Host 侧内置的 RPC 方法（`dispatchRpc`）：

| method | 对应能力 | 权限门 |
|--------|----------|--------|
| `http.get` / `http.post` / `http.put` / `http.delete` | `api.http.*` | `api.http` 存在 |
| `ui.showToast` | `api.ui.showToast` | `api.ui` 存在 |
| `ui.downloadBlob` | `api.ui.downloadBlob` | `api.ui.downloadBlob` 存在 |

> Host 还可以通过 `iframeRpcHandlers` 扩展任意 RPC（见第 13 章 registry 说明）。**iframe 模式下 `api.event` 是 no-op**——语言热更新靠 `locale` 消息，不靠事件总线。

---

## 5. 你要准备的：`connectIframeHost` 客户端

这是你 iframe 页面里唯一的通信层。实现参考 `apps/remote-plugins/src/utils/iframeHostClient.ts`：

```ts
// src/utils/iframeHostClient.ts —— iframe 通信客户端
import type { HostBridgeProps } from '@/types/host';

// 协议 channel：与 Host 的 iframeChannel 一致（本仓默认 dnhyxc-mf-iframe）
const CHANNEL = 'dnhyxc-mf-iframe';

type RpcRequest = { channel: string; type: 'rpc'; id: string; method: string; args: unknown[] };
type RpcResult =
	| { channel: string; type: 'rpc-result'; id: string; ok: true; value: unknown }
	| { channel: string; type: 'rpc-result'; id: string; ok: false; error: string };

// 简易 Promise 等待表：rpc id → 回调
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

// 向父窗口发消息
function post(msg: unknown) {
	window.parent.postMessage(msg, '*');
}

/**
 * 连接 Host：
 * 1) 循环发 ready 直到收到 init；
 * 2) 返回还原后的 HostBridgeProps（桥接方法内部走 postMessage RPC）。
 */
export function connectIframeHost(pluginId: string): Promise<HostBridgeProps> {
	return new Promise((resolve, reject) => {
		// 收到 Host 消息的处理函数
		const onMessage = (ev: MessageEvent) => {
			const data = ev.data as Record<string, unknown>;
			// 只认自己的 channel
			if (!data || data.channel !== CHANNEL) return;

			// —— init：Host 主动推送 theme/locale/plugin，握手完成 ——
			if (data.type === 'init') {
				const bridge = buildBridge(data as Record<string, unknown>);
				window.removeEventListener('message', onMessage);
				resolve(bridge);
				return;
			}

			// —— locale：语言热更新 ——
			if (data.type === 'locale') {
				onLocaleChange?.(data.locale as 'zh-CN' | 'en-US');
				return;
			}

			// —— rpc-result：RPC 返回值 ——
			if (data.type === 'rpc-result') {
				const result = data as unknown as RpcResult;
				const p = pending.get(result.id);
				if (!p) return;
				pending.delete(result.id);
				if (result.ok) p.resolve(result.value);
				else p.reject(new Error(result.error));
			}
		};
		window.addEventListener('message', onMessage);

		// 握手：每 400ms 发一次 ready，直到收到 init（Host 也可能在 iframe load 时主动发）
		let attempts = 0;
		const timer = window.setInterval(() => {
			attempts += 1;
			post({ channel: CHANNEL, type: 'ready', pluginId });
			if (attempts > 25) {
				// 25 次未连上（10 秒）：放弃，避免无限重试
				window.clearInterval(timer);
				window.removeEventListener('message', onMessage);
				reject(new Error('iframe host handshake timeout'));
			}
		}, 400);
		post({ channel: CHANNEL, type: 'ready', pluginId }); // 立即先发一次

		// 语言变化回调（业务侧 useHostLocale 会注册）
		let onLocaleChange: ((l: 'zh-CN' | 'en-US') => void) | undefined;
		buildBridge.onLocaleChange = (fn) => {
			onLocaleChange = fn;
		};
	});
}

// 发起 RPC：发请求并等待 rpc-result
function rpc<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
	const id = `rpc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	return new Promise<T>((resolvePromise, rejectPromise) => {
		pending.set(id, {
			resolve: (v) => resolvePromise(v as T),
			reject: rejectPromise,
		});
		const msg: RpcRequest = { channel: CHANNEL, type: 'rpc', id, method, args };
		post(msg);
	});
}

// 把 init 载荷 + RPC 客户端组装成"看起来像" HostBridgeProps 的对象
function buildBridge(init: Record<string, unknown>): HostBridgeProps & {
	onLocaleChange?: (fn: (l: 'zh-CN' | 'en-US') => void) => void;
} {
	const api = {
		theme: init.theme as 'light' | 'dark',
		locale: init.locale as 'zh-CN' | 'en-US',
		// iframe 模式 event 是 no-op（语言靠 locale 消息）
		event: { on: () => undefined, off: () => undefined, emit: () => undefined },
		// http 走 RPC
		http: {
			get: <T = unknown>(url: string) => rpc<T>('http.get', url),
			post: <T = unknown>(url: string, body?: unknown) => rpc<T>('http.post', url, body),
			put: <T = unknown>(url: string, body?: unknown) => rpc<T>('http.put', url, body),
			delete: <T = unknown>(url: string) => rpc<T>('http.delete', url),
		},
		// ui 走 RPC
		ui: {
			showToast: (o: { message: string; type?: 'success' | 'error' | 'info' }) => {
				void rpc('ui.showToast', o);
			},
			downloadBlob: (o: { fileName: string; data: ArrayBuffer | Uint8Array; mimeType?: string }) =>
				rpc('ui.downloadBlob', o),
		},
	};
	return {
		api,
		plugin: init.plugin as HostBridgeProps['plugin'],
	};
}
```

> **语义**：`connectIframeHost` 的核心是把「异步的 postMessage 往返」封装成「同步的 Promise」。你的业务代码用 `bridge.http.get()` 时，背后就是一个 `rpc` 请求 + `rpc-result` 等待。`buildBridge` 里把 `http` / `ui` 用 RPC 实现，`event` 置为 no-op——**业务组件不需要知道自己在 iframe 里**，接口形状与 MF 模式一致。

---

## 6. embed 页面：无壳、纯业务

Host 的 `iframeUrl` 必须指向一个**不带导航壳**的页面（否则会在 iframe 里再套一套预览壳，很丑且可能循环依赖）。

```tsx
// src/views/embed/index.tsx —— iframe embed 页（对接 Host 的 iframeUrl）
import { useEffect, useState, type ComponentType } from 'react';
import { connectIframeHost } from '@/utils/iframeHostClient';
import { useI18n } from '@/hooks';
import type { HostBridgeProps } from '@/types/host';

type Bridge = HostBridgeProps;

// 通用 embed 壳：connectIframeHost 拿到 bridge 后渲染业务组件
function EmbedShell({ pluginId, App }: { pluginId: string; App: ComponentType<Bridge> }) {
	const { t } = useI18n();
	const [bridge, setBridge] = useState<Bridge | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void connectIframeHost(pluginId)
			.then((b) => {
				if (!cancelled) setBridge(b as Bridge);
			})
			.catch((e) => {
				if (!cancelled) setError(e instanceof Error ? e.message : String(e));
			});
		return () => {
			cancelled = true;
		};
	}, [pluginId]);

	if (error) return <div className="text-destructive h-full p-3 text-sm">{error}</div>;
	if (!bridge) return <div className="h-full p-3 text-sm">{t('common.connectingHost')}</div>;
	return (
		<div className="h-full min-h-0">
			<App {...bridge} />
		</div>
	);
}

// 你的 embed 页面
export function EmbedLearningNotes() {
	return <EmbedShell pluginId="learningNotes" App={LearningNotesApp} />;
}
```

---

## 7. 路由注册（iframe 页面用）

`src/router/routes.tsx`（独立预览的路由表）里加 embed 路径：

```tsx
import { EmbedLearningNotes } from '@/views/embed';

export const routes = [
	{
		path: '/',
		element: <App api={mockApi()} plugin={mockPlugin('myPlugin', '/my-plugin')} />,
	},
	// ★ Host 的 iframeUrl 指向这里（无壳页面）
	{
		path: '/embed/my-plugin',
		element: <EmbedLearningNotes />,
	},
];
```

> **Registry 里 `iframeUrl` 必须写 `/embed/...` 路径**，不要写带导航壳的预览路由。

---

## 8. registry 条目（untrusted）

```jsonc
{
	"id": "thirdPartyTool",
	"title": { "zh-CN": "第三方工具", "en-US": "Third party tool" },
	"routePath": "/plugins/third-party-tool",
	"entry": "https://third-party.com/mf-manifest.json", // 仅占位；untrusted 不加载 MF entry
	"version": "1.0.0",
	"hostApiRange": "^1.0.0",
	"trust": "untrusted",                        // ★ 关键
	"iframeUrl": "https://third-party.com/embed/tool", // ★ 关键：你的 embed 页
	"permissions": ["ui:toast", "http:plugin-api"],    // RPC 权限门
	"enabled": true
}
```

> **注意**：untrusted 插件 **不校验 hostApiRange / integrity**，但 `iframeUrl` 必须 https（开发环境 localhost http 可放行）。Host 的 `verifyPlugin` 会在加载前检查 origin（见 host-guide 第 9 章 §2）。

---

## 9. 常见坑

1. **`iframeUrl` 写错成预览首页** → iframe 里出现整页壳。要指向 `/embed/...`。
2. **channel 不一致** → 永远收不到 init。确认 Host `iframeChannel`（本仓默认 `dnhyxc-mf-iframe`）。
3. **`targetOrigin` 校验**：Host 用 `iframeUrl` 的 origin 做 `postMessage` 目标；你的 `iframeHostClient` 用 `'*'` 即可（更严格可写死 Host origin）。
4. **无法使用 `api.event`**：iframe 模式它是 no-op，跨 iframe 实时事件请走 RPC 扩展。
5. **调试**：DevTools 里选 iframe 上下文；`window.parent` 查看父窗口；Console 里手动 `postMessage` 测试。

---

## 10. 验收清单

- [ ] `iframeUrl` 指向无壳 embed 页；
- [ ] iframe 加载后能拿到 `init`（Network/Console 可见握手）；
- [ ] 用 `bridge.http.get` 能正常请求（配了 `http:plugin-api`）；
- [ ] `ui.showToast` 生效；
- [ ] 语言切换时收到 `locale` 消息并更新 UI；
- [ ] 无报错：iframe 不尝试操作 Host DOM。
