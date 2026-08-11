# 05 · HostBridge API 全参考

> **本章目标**：讲清你的组件拿到的 `api` 对象里**到底有什么、什么情况下没有、怎么安全使用**。这是你写业务代码时最常查的一章。
>
> 对应源码：`packages/federation-kit/src/bridge/createHostBridge.ts`（Host 侧组装逻辑）、`packages/federation-kit/src/types/index.ts`。

---

## 1. `api` 是怎么被组装的（Host 侧逻辑）

理解「为什么 `api` 有的字段是 undefined」，看 Host 的 `createHostBridge` 最直接：

```ts
// packages/federation-kit/src/bridge/createHostBridge.ts（关键片段）
export function createHostBridge(
	d: PluginDescriptor,          // 你的 registry 条目
	capabilities: HostCapabilities, // Host 声明的全部能力
	navigate: (to: string) => void, // 导航实现
): HostBridgeProps {
	const allow = new Set(d.permissions); // 你申请到的权限集合

	// —— 永远有的三样：theme / locale / event ——
	const api: Record<string, unknown> = {
		theme: capabilities.getTheme(),
		locale: capabilities.getLocale(),
		event: {
			on: (event, handler) => eventBus.on(d.id, event, handler),   // 按插件 id 隔离
			off: (event, handler) => eventBus.off(d.id, event, handler),
			emit: (event, data) => eventBus.emit(d.id, event, data),
		},
	};

	// —— ui.*：需要权限 ui:toast 且 Host 有能力 ——
	if (allow.has('ui:toast') && capabilities.toast) {
		const ui: Record<string, unknown> = { showToast: capabilities.toast };
		if (capabilities.setAppFullscreen) ui.setAppFullscreen = capabilities.setAppFullscreen;
		if (capabilities.downloadBlob) {
			ui.downloadBlob = (options) => capabilities.downloadBlob!({ ...options, pluginId: d.id });
		}
		api.ui = Object.freeze(ui);
	}

	// —— navigate：需要权限 nav:subtree，且限定在 routePath 内 ——
	if (allow.has('nav:subtree')) {
		api.navigate = (to: string) => {
			if (!to.startsWith(d.routePath)) {
				throw new Error(`NAV_OUT_OF_SCOPE: ${to}`); // 越界直接抛错
			}
			navigate(to);
		};
	}

	// —— http.*：需要权限 http:plugin-api 且 Host 有能力 ——
	if (allow.has('http:plugin-api') && capabilities.http) {
		api.http = Object.freeze({ ...capabilities.http });
	}

	// —— modules.*：由 Host 的 buildModules 按你的权限集组装 ——
	if (capabilities.buildModules) {
		const built = capabilities.buildModules(allow);
		if (built && Object.keys(built).length > 0) {
			api.modules = Object.freeze(built);
		}
	}

	// 最终整个对象 deep freeze：你不能改它
	return deepFreeze({ api, plugin: { id: d.id, version: d.version, routePath: d.routePath } });
}
```

> **三条推论**：
> 1. `api` 是 **deep frozen**——你想 `api.theme = 'dark'` 会在严格模式抛错。
> 2. 可选字段 = 你的 `permissions` ∩ Host `capabilities`。**没申请就没有**。
> 3. `event` 以你的插件 id 为命名空间（`eventBus.on(d.id, ...)`），所以多插件之间事件天然隔离。

---

## 2. API 总表

| API | 权限要求 | 说明 | 是否总有 |
|-----|----------|------|----------|
| `api.theme` | 无 | 主题快照：`light` \| `dark` | ✅ 永远 |
| `api.locale` | 无 | 语言：`zh-CN` \| `en-US`（**热更新**） | ✅ 永远 |
| `api.event.on/off/emit` | 无 | 事件总线（以插件 id 命名空间隔离） | ✅ 永远 |
| `api.navigate(to)` | `nav:subtree` | 子路由导航，限定在 `plugin.routePath` 内 | 按权限 |
| `api.http.get/post/put/delete` | `http:plugin-api` | HTTP 请求 | 按权限 |
| `api.ui.showToast` | `ui:toast` | 显示 Toast | 按权限 |
| `api.ui.setAppFullscreen` | `ui:toast` | 应用级影院全屏（藏 Host 壳） | 按权限 + Host 能力 |
| `api.ui.downloadBlob` | `ui:toast` | 统一落盘下载 | 按权限 + Host 能力 |
| `api.ui.pickLocalFiles` | `ui:toast` | 选本地文件（`{ path, name, src }[]`） | 按权限 + Host 能力 |
| `api.modules.*` | `modules:xxx` | 业务模块（如 `modules:chat` → `openThread`） | 按权限 |

---

## 3. 权限表（registry `permissions` 字段）

| 权限 | 说明 | 解锁的 api |
|------|------|------------|
| `ui:toast` | 允许使用 `api.ui` | `showToast`、`setAppFullscreen`、`downloadBlob` |
| `nav:subtree` | 允许子路由导航 | `navigate` |
| `http:plugin-api` | 允许 HTTP 请求 | `http.get/post/put/delete` |
| `modules:chat` | 允许聊天模块 | `api.modules.openThread(id)` |
| `modules:ebook` | 允许电子书模块 | `api.modules.ebook`（getBookId 等） |

**最佳实践**：最小权限、按需申请、用前判空（见下）。

---

## 4. 使用示例（完整组件）

```tsx
// src/App.tsx —— 完整能力示例
import { useHostLocale, useI18n } from '@/hooks';
import type { HostBridgeProps } from '@/types/host';

export default function App({ api, plugin }: HostBridgeProps) {
	const { t } = useI18n();
	// 跟随 Host 语言（第 11 章）
	useHostLocale(api);

	// 使用 HTTP（需 http:plugin-api，用前判空）
	const handleFetch = async () => {
		if (api.http) {
			try {
				const data = await api.http.get('/api/plugin-data');
				console.log('数据:', data);
			} catch (e) {
				console.error('请求失败:', e);
			}
		}
	};

	// 子路由导航（需 nav:subtree，且只能在你自己的 routePath 内）
	const handleNavigate = () => {
		if (api.navigate) {
			api.navigate(`${plugin.routePath}/detail`);
		}
	};

	// Toast（需 ui:toast）
	const handleToast = () => {
		api.ui?.showToast({ message: t('common.success'), type: 'success' });
	};

	// 打开聊天线程（需 modules:chat）
	const openThread = () => {
		const open = api.modules?.openThread as ((id: string) => void) | undefined;
		open?.('thread-123');
	};

	return (
		<div className="plugin-standalone" data-plugin-root>
			<h1>{t('plugin.title')} · {plugin.id}</h1>
			<p>theme={api.theme} · locale={api.locale}</p>
			<button onClick={handleFetch}>{t('common.fetch')}</button>
			<button onClick={handleNavigate}>{t('common.detail')}</button>
			<button onClick={handleToast}>{t('common.toast')}</button>
			<button onClick={openThread}>{t('common.thread')}</button>
		</div>
	);
}
```

---

## 5. 权限检查：三句话规则

```ts
// ✅ 正确：用前检查
if (api.http) {
	await api.http.get('/api/data');
}

// ❌ 错误：直接使用，没权限时 api.http 是 undefined
await api.http.get('/api/data'); // TypeError: Cannot read properties of undefined
```

> 统一写法建议：每个受限 API 都判空，宁可功能缺失也别让插件崩溃。`api.navigate` 判空还有个额外原因——nav:subtree 还限制只能在 `routePath` 内跳，越界会抛 `NAV_OUT_OF_SCOPE`。

---

## 6. 事件总线：跨插件 / 与 Host 通信

```ts
// 订阅（在 activate 或组件 effect 里）
useEffect(() => {
	const onBookChanged = (data?: unknown) => {
		console.log('书籍变更:', data);
	};
	api.event.on('book-changed', onBookChanged);
	return () => api.event.off('book-changed', onBookChanged);
}, [api.event]);

// 广播
api.event.emit('my-plugin-event', { anything: true });
```

**规则**：
- 以**你的插件 id** 为命名空间，其他插件监听不到你的 `on/off/emit`。
- Host 自身也会发 `locale` 事件（语言切换，见第 11 章）。
- iframe 模式下 `event` 是 **no-op**（locale 改由 `locale` 消息推送，见第 8 章）。

---

## 7. 独立预览时没有 `api`？

独立预览（`pnpm dev`）时你不会拿到 Host 的 bridge，需要 mock（见第 12 章 §2）：

```ts
// src/utils/mockHost.ts —— 独立预览用假 bridge
export function mockApi(extra?: Record<string, unknown>) {
	return {
		theme: 'light' as const,
		event: { on: () => undefined, off: () => undefined, emit: () => undefined },
		ui: { showToast: (o: { message: string }) => console.info('[toast]', o.message) },
		...extra,
	};
}

export function mockPlugin(id: string, routePath: string, version = '1.0.0') {
	return { id, version, routePath };
}
```
