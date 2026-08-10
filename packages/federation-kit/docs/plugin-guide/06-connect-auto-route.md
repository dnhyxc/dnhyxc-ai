# 06 · 接入方式一：独立路由页（自动注入路由）

> **本章目标**：讲清「你的插件成为一个**独立页面**」的完整过程——registry 写什么、Host 怎么把它变成路由 + 侧栏入口、你的组件怎么写。**这是最常用的一种接入方式**。
>
> Host 侧机制见 host-guide 第 5、6 章；本处以子项目视角倒推「我要准备什么」。

---

## 1. 一句话

你在 registry 里声明 `routePath`，Host 启动时就自动为你在路由表里加一条，并（可选）在侧栏加一个图标入口。用户点进去 → Host 懒加载你的代码 → 你的整页组件被渲染。

**你要做的**：一个「整页」组件（可带自己的内部路由）。其余全由 Host 完成。

---

## 2. registry 条目（你要和 Host 管理员确认的）

```jsonc
// plugins-registry.json 里你的条目
{
	"id": "learningNotes",
	"title": { "zh-CN": "学习笔记", "en-US": "Learning notes" },
	"description": { "zh-CN": "记录你的学习心得。", "en-US": "Take study notes." },
	"routePath": "/plugins/learning-notes",   // ★ 路由路径（必填，决定 URL）
	"entry": "http://127.0.0.1:9008/mf-manifest.json", // ★ 你的资源清单地址
	"expose": "./App",                        // 可选，默认 ./App
	"version": "1.0.0",
	"hostApiRange": "^1.0.0",                 // ★ 须覆盖 Host 的 VITE_HOST_API_VERSION
	"menu": { "order": 10, "icon": "Puzzle" },// ★ 可选：侧栏图标 + 排序
	"permissions": ["ui:toast", "http:plugin-api"],
	"enabled": true,                          // 全局上架开关
	"trust": "first-party"                    // 信任等级
}
```

| 字段 | 说明 |
|------|------|
| `routePath` | 必填。Host 注入的路由路径；`nav:subtree` 的导航也以它为界 |
| `menu` | 可选。有 `menu` 才出现侧栏图标；`icon` 是 Host 图标表里的名字（如 `Puzzle` / `Sparkle`），`order` 控制排序 |
| `injectRoute` | 可选，默认 `true`。设为 `false` 则**不自动注入路由**（罕见） |

---

## 3. Host 侧到底发生了什么（理解时序）

Host 启动 `mf.start()` → `PluginManager.init()`：

```ts
// packages/federation-kit/src/runtime/createPluginRuntime.ts（关键逻辑）
async init() {
	// ① 拉账号上架偏好
	await this.config.enabledStore.load?.();
	// ② 拉 registry
	const registry = await this.config.fetchRegistry({ force: true });
	// ③ 只处理「已上架」的插件
	const enabled = registry.plugins.filter((p) => isPluginEnabled(p.id));
	for (const meta of enabled) {
		this.mountShell(meta); // 只注入「壳」，不下载你的代码！
	}
}

// mountShell：为每个插件注入路由壳与侧栏项
private mountShell(meta: PluginDescriptor) {
	// 有 routePath 且未关闭自动注入 → 路由表加一条（createRoute 是 Host 的路由工厂）
	if (meta.injectRoute !== false && this.createRoute) {
		this.routeInjector.inject(meta.id, [this.createRoute(meta)]);
	}
	// 有 menu → 侧栏加一项
	if (meta.menu) {
		this.sidebarInjector.add({
			pluginId: meta.id,
			path: meta.routePath,
			nameKey: meta.id,
			icon: meta.menu.icon ?? 'Puzzle',
			order: meta.menu.order,
		});
	}
}
```

> **关键**：`mountShell` **不下载你的代码**——它只是注入路由壳 + 侧栏项，所以启动很快。真正的 `ensurePlugin`（下载 `remoteEntry.js`）发生在**用户点击进入那条路由**时。

用户点击进入 → Host 路由页渲染 `<FederationPlugin name="learningNotes" />` → `ensurePlugin`：

```
ensurePlugin(id)
  ├─ verifyPlugin          安全校验（hostApiRange 不符 → 拒绝）
  ├─ resolvePluginBust     GET 你的 mf-manifest.json（算 version@指纹）
  ├─ registerRemote        注册 remoteEntry.js?v=…
  ├─ loadRemoteApp         MF import 你的 ./App
  └─ 渲染 <Comp {...bridge} />（包在 data-mf-plugin / data-mf-style-realm 里）
```

---

## 4. 你的组件怎么写（整页形态）

```tsx
// src/views/learning-notes/index.ts —— expose 入口（薄壳）
// 必须：Host 不执行 main.tsx，样式挂在这里
import '@/styles.css';
export { default } from './App';
```

```tsx
// src/views/learning-notes/App.tsx —— 整页组件
import { useEffect, useState } from 'react';
import { useHostLocale, useI18n } from '@/hooks';
import type { HostBridgeProps } from '@/types/host';

// 独立路由页：Host 已套统一页壳（PluginPageShell 提供边距/圆角），
// 你**不要**再套整页外层 padding——否则嵌入后边距翻倍
export default function App({ api, plugin }: HostBridgeProps) {
	const { t } = useI18n();
	useHostLocale(api); // 跟随 Host 语言
	const [data, setData] = useState<string | null>(null);

	// 挂载时拉一次数据（需 http:plugin-api 权限，用前判空）
	useEffect(() => {
		if (!api.http) return;
		void api.http
			.get('/api/learning-notes')
			.then((res) => setData(String((res as { data?: string })?.data ?? '')))
			.catch(() => setData(''));
	}, [api.http]);

	return (
		<div className="plugin-standalone h-full" data-plugin-root>
			<h1 className="mb-4 text-xl font-semibold">
				{t('notes.title')} · v{plugin.version}
			</h1>
			{data ? <p>{data}</p> : <p className="text-muted-foreground">{t('common.loading')}</p>}
			<button
				type="button"
				onClick={() =>
					api.ui?.showToast({ message: t('common.saved'), type: 'success' })
				}
			>
				{t('common.save')}
			</button>
		</div>
	);
}
```

> **边距规则**：独立路由页由 Host 套 `PluginPageShell`（见 host-guide 第 6 章），它已经给了外层 `p-5.5` 与圆角内容区。插件**不要**再叠同类外层 padding；`backdrop-filter` 若失效，是 Host 圆角容器带 `overflow-hidden` 的问题，报 Host 排查，不是你的问题。

---

## 5. 带内部子路由的插件（进阶）

如果你需要自己的二级页面（如 `/plugins/learning-notes/notes/123`），两种做法：

### 5.1 组件内自建路由（推荐，简单）

```tsx
// App.tsx —— 用你自己的 react-router 实例（注意：别用 Host 的路由上下文）
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';

// 注意：子应用内的路由是"独立实例"，base 用 plugin.routePath，别共享 Host router
export default function App({ api, plugin }: HostBridgeProps) {
	useHostLocale(api);
	return (
		<BrowserRouter basename={plugin.routePath}>
			<Routes>
				<Route index element={<List />} />
				<Route path="notes/:id" element={<Detail />} />
			</Routes>
		</BrowserRouter>
	);
}
```

> 跨页跳转建议走 `<Link>` / 内部 router；要跳到 Host 其它页面再用 `api.navigate`（`nav:subtree` 权限，且只能在你 `routePath` 内）。

### 5.2 只用一个暴露（多 expose 场景）

如果你的插件很大，也可以拆多个 expose 各自成路由页。此时**每个 expose 入口都要 `import '@/styles.css'`**（第 10 章），且每个都作为独立 `routePath` 登记。

---

## 6. 完整接入步骤（核对清单）

1. **Registry**：加条目（含 `routePath` + 可选 `menu` + `entry` + `hostApiRange`）。
2. **组件**：写整页组件，`default` 导出；根元素 `data-plugin-root`；expose 入口 `import '@/styles.css'`。
3. **联调**：`pnpm dev` 起子应用 → 在 Host 控制台看 `pluginManager.list()`，确认 `status: 'activated'`。
4. **验收**：
   - [ ] 侧栏出现图标（`menu` 存在时）；
   - [ ] 直接访问 `http://host/plugins/learning-notes` 能渲染；
   - [ ] 刷新该 URL 不闪 404（Host 的 pluginsReady 占位机制）；
   - [ ] 样式/浮层与独立预览一致。
