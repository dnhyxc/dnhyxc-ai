# host/

插件在 Host 内的**统一挂载模版**与壳层 UI，业务页只选模版，不重复写 loading/error/隔离逻辑。

## 文件

| 文件 | 场景 |
|------|------|
| `HostPoint.tsx` | 已登记扩展点：顶栏、行按钮、图标触发器、抽屉 |
| `PluginHostPage.tsx` | 全页 / 业务树内嵌；包装 `<FederationPlugin />` |
| `PluginPageShell.tsx` | 插件**独立路由**外层边距与圆角；影院全屏时收边距 |
| `PluginErrorBoundary.tsx` | Remote 渲染错误边界 |
| `PluginIcon.tsx` / `pluginIconUrl.ts` | registry 图标 URL / SVG 主题色适配。`loadPluginIconMarkup` 同时给 `PluginIcon` 和 `api.ui.readIconSvg` 用 |

## 挂载对照

| 场景 | 组件 |
|------|------|
| `/english-learning/notes` 等业务路由内嵌 | `<PluginHostPage pluginId="…" />` |
| EPUB 阅读页图标和抽屉 | `<HostPoint pointId={POINT.ebookRead} slot="drawer" part="trigger" />` 与同槽的正文 |
| registry 独立 `routePath` 全页 | `PluginHostPage` + `pageShell` / `PluginPageShell` |

## 常用

```tsx
import { HostPoint, PluginHostPage, POINT } from '@/federation';

<PluginHostPage pluginId="learningNotes" />
<HostPoint pointId={POINT.ebookRead} slot="drawer" part="trigger" />
```

## 关联

- 运行时加载 → [`../runtime/`](../runtime/README.md)
- 全屏壳层联动 → [`../capabilities/appFullscreen.ts`](../capabilities/appFullscreen.ts)
