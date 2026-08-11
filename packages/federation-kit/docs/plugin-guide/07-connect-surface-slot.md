# 07 · 接入方式二：业务页内嵌（抽屉 / 工具栏插槽）

> **本章目标**：讲清「你的插件**嵌入到某个业务页面**（如电子书阅读页）的抽屉或顶栏」的完整过程。区别于方式一的「独立整页」，这种接入让你的组件**和业务页面共存**。
>
> Host 侧机制见 host-guide 第 6 章 `PluginHostSurface`；本处以子项目视角讲解。

---

## 1. 一句话

Host 在某个业务页面渲染 `<PluginHostSurface surface="ebook.read" />`，它自动收集所有声明了 `host.surface === "ebook.read"` 且已上架的插件。你的组件就会出现在该页的**抽屉（drawer）**或**顶栏（toolbar）**。

**你要做的**：一个「聚焦」组件（不自建整页外壳、**不要**自己管理 `portal container`）。

---

## 2. registry 条目

```jsonc
// plugins-registry.json 里你的条目（节选）
{
	"id": "ebookTool",
	"title": { "zh-CN": "阅读工具", "en-US": "Reading tool" },
	"routePath": "/plugins/ebook-tool",   // 可选：方式二不要求有路由页
	"entry": "http://127.0.0.1:9008/mf-manifest.json",
	"expose": "./EbookTool",              // 对应你 exposes 里的 ./EbookTool
	"version": "1.0.0",
	"hostApiRange": "^1.0.0",
	"host": {                             // ★ 方式二的关键字段
		"surface": "ebook.read",          //   业务面：Host 哪个页面展示你
		"slot": "drawer",                 //   位置：drawer（抽屉）或 toolbar（顶栏）
		"icon": "https://cdn.example.com/icons/tool.svg", // 顶栏触发器：推荐 SVG URL（PluginIcon 内联）
		"order": 1                        //   同 surface 插件间的排序
	},
	"permissions": ["ui:toast"],
	"enabled": true,
	"trust": "first-party"
}
```

| 字段 | 说明 |
|------|------|
| `host.surface` | **必填（方式二）**。业务面标识，如 `ebook.read`。Host 的 `<PluginHostSurface surface="ebook.read">` 与之匹配 |
| `host.slot` | **必填**。`drawer` = 底部抽屉；`toolbar` = 顶栏内联 |
| `host.icon` | 可选。`drawer` 时是顶栏触发器图标；**推荐 SVG URL**（不必再进 Host Lucide 白名单）；`toolbar` 时通常不需要。详见 [implements-guide/09](../implements-guide/09-plugin-host-icons.md) |
| `host.order` | 可选。同 surface 下排序，默认 100 |

---

## 3. Host 侧是怎么找到你的

Host 用 `listHostSurfacePlugins` 同步读 registry 缓存（`packages/federation-kit/src/enabled/hostSurface.ts`）：

```ts
// Host 侧：按 surface 收集已上架插件（同步、读缓存，不触发网络）
export function listHostSurfacePlugins(surface: PluginHostSurface): PluginDescriptor[] {
	try {
		const cached = localStorage.getItem(getRegistryCacheKey());
		if (!cached) return [];
		const data = JSON.parse(cached) as { plugins?: PluginDescriptor[] };
		// 过滤：已上架 && host.surface === 传入的 surface
		const list = (data.plugins ?? []).filter(
			(p) => isPluginEnabled(p.id) && p.host?.surface === surface,
		);
		// 按 order 排序
		return list.sort((a, b) => (a.host?.order ?? 100) - (b.host?.order ?? 100));
	} catch {
		return [];
	}
}
```

```ts
// Host 侧 React hook：订阅「上架状态变化」实时刷新（useHostSurfacePlugins）
export function useHostSurfacePlugins(surface: PluginHostSurface): PluginDescriptor[] {
	const [plugins, setPlugins] = useState(() => listHostSurfacePlugins(surface));
	useEffect(() => {
		const sync = () => setPlugins(listHostSurfacePlugins(surface));
		sync();
		return subscribePluginEnabled(sync); // 偏好变化 → 重算
	}, [surface]);
	return plugins;
}
```

而 Host 的 `<PluginHostSurface />` 会把 `slot: 'drawer'` 的插件渲染成「顶栏图标按钮 + 底部抽屉」，把 `slot: 'toolbar'` 的插件渲染成「顶栏内联区域」。**你无需改 Host 代码**——新增同 surface 插件只改 registry。

---

## 4. 你的组件怎么写（聚焦形态）

### 4.1 抽屉插件（slot: drawer）

```tsx
// src/views/ebook-tool/index.ts —— expose 入口
import '@/styles.css';
export { default } from './EbookTool';
```

```tsx
// src/views/ebook-tool/EbookTool.tsx —— 抽屉里的内容
import { useEffect, useState } from 'react';
import { useHostLocale, useI18n } from '@/hooks';
import type { HostBridgeProps } from '@/types/host';

// 抽屉内嵌：组件只占抽屉空间。Host 已负责抽屉外壳 + Portal 收编，
// 你**不要**再包 Drawer/Modal，也不要改任何 portal container。
export default function EbookTool({ api, plugin }: HostBridgeProps) {
	const { t } = useI18n();
	useHostLocale(api);
	const [bookId, setBookId] = useState<string | null>(null);

	// 读当前书籍（需要 modules:ebook 权限）
	useEffect(() => {
		const ebook = api.modules?.ebook as
			| { getBookId: () => string | null }
			| undefined;
		setBookId(ebook?.getBookId() ?? null);
	}, [api.modules]);

	return (
		<div className="plugin-standalone h-full overflow-auto" data-plugin-root>
			<h2 className="mb-3 text-base font-semibold">
				{t('tool.title')} · v{plugin.version}
			</h2>
			<p className="mb-3 text-sm text-muted-foreground">
				{t('tool.currentBook')}: {bookId ?? t('tool.noBook')}
			</p>
			<button
				type="button"
				onClick={() => api.ui?.showToast({ message: t('tool.saved'), type: 'success' })}
			>
				{t('tool.mark')}
			</button>
		</div>
	);
}
```

### 4.2 工具栏插件（slot: toolbar）

```tsx
// 工具栏：紧凑形态，不要撑满。Host 渲染时会给窄容器
export default function EbookToolbar({ api, plugin }: HostBridgeProps) {
	useHostLocale(api);
	return (
		<div className="plugin-standalone flex h-full items-center gap-2 px-2" data-plugin-root>
			<span className="text-xs text-muted-foreground">{plugin.id}</span>
			<button
				type="button"
				className="rounded px-2 py-1 text-xs"
				onClick={() => api.ui?.showToast({ message: 'toolbar action' })}
			>
				Action
			</button>
		</div>
	);
}
```

> **尺寸约定**：`drawer` 底部抽屉有固定高度，你的组件是 `h-full`；`toolbar` 是顶栏内联，保持紧凑、不撑满。多插件同 surface 时 Host 会横向排布。

---

## 5. 与方式一的关系

| | 方式一（路由页） | 方式二（业务内嵌） |
|--|------------------|--------------------|
| 入口 | 侧栏图标 / URL | 业务页触发器 / 顶栏 |
| 形态 | 整页 | 抽屉 / 工具栏片段 |
| registry | `routePath` + `menu` | `host.surface` + `host.slot` |
| 能否共存 | ✅ | ✅（一个插件可同时配两种） |

> **注意**：如果你两者都配，Host 会既注入路由**又**在业务页展示。同一组件会被两个位置使用——确保你的组件在「整页」和「聚焦」两种上下文都能工作（比如用 props 或内部判断来适配）。

---

## 6. 常见坑（务必看）

1. **不要自己包 Drawer/Modal/Popover 的 portal container**。Host 的样式隔离会自动把 `createPortal` 到 body 的浮层「收编」进你的样式域（host-guide 第 9 章 §4.5）。你传 `getContainer` / `appendTo` 反而会让浮层逃逸出隔离。
2. **抽屉里别用 `setAppFullscreen`**。它会藏掉整个 Host 壳，从抽屉里看效果很怪（第 13 章 §应用级全屏有说明）。
3. **每个 expose 入口 import 样式**（第 10 章），否则抽屉/工具栏组件在 Host 里没样式。
4. **独立预览时自测**：抽屉形态组件也要能独立运行（用 mock bridge，第 12 章）。

---

## 7. 完整接入步骤

1. **Registry**：加 `host: { surface, slot }`。
2. **组件**：写聚焦组件，`default` 导出；expose 入口 `import '@/styles.css'`。
3. **联调**：进入对应业务页，看触发器/内联区是否出现。
4. **验收**：
   - [ ] 业务页出现你的入口（图标按钮 / 顶栏片段）；
   - [ ] 打开抽屉渲染正常，悬浮层（tooltip/menu）样式正确；
   - [ ] 切换语言后文案实时更新（`useHostLocale`）；
   - [ ] 上/下架后实时出现/消失（`useHostSurfacePlugins` 订阅）。
