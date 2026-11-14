# 本仓 Host 适配（`@/federation`）

业务代码**只从 `@/federation` 导入**微前端能力；勿在业务侧直接写 `@dnhyxc-ai/federation-kit`。

```ts
import {
  mf,
  HostPoint,
  POINT,
  PluginHostPage,
  PluginHostSurface,
  usePluginEnabled,
  pickPluginLocaleText,
} from '@/federation';
```

## 目录

| 目录 | 职责 | 说明 |
|------|------|------|
| [`runtime/`](./runtime/README.md) | `createFederation` 门面 | `mf` / `pluginManager` / injectors |
| [`registry/`](./registry/README.md) | 插件清单 | COS 拉取、缓存、落盘 |
| [`enabled/`](./enabled/README.md) | 账号上架偏好 | 用户级插件开关 |
| [`host/`](./host/README.md) | 挂载模版 | Page / Surface / Shell |
| [`capabilities/`](./capabilities/README.md) | 通用 UI 能力 | `appFullscreen`、`pickLocalFiles` |
| [`sync/`](./sync/README.md) | 跨窗 sync | BC + Tauri 工厂 |
| [`points/`](./points/catalog.ts) | 扩展点目录与会话 | `api.modules.point`、`HostPoint` |
| [`modules/`](./modules/README.md) | 学习笔记专属模块 | `api.modules.learningNotes` |

入口 re-export：[`index.ts`](./index.ts)

**新插件接入**：形态和要改的文件见 [`guide.md`](./guide.md)。扩展点的逐步代码见 [`access.md`](./access.md)。

实现细节见 [`packages/federation-kit/README`](../../../../packages/federation-kit/README.md)。

## 统一挂载模版

| 场景 | 模版 |
|------|------|
| 路由全页 / 业务树内嵌 | `PluginHostPage` |
| 已登记扩展点的顶栏、行按钮、抽屉 | `HostPoint` |
| 阅读页自己画的触发器和抽屉 | `PluginHostSurface` |

```ts
await mf.start();
mf.setNavigate(nav);
mf.onRoutesChange(rebuild);

<PluginHostPage pluginId="learningNotes" />
<HostPoint pointId={POINT.dailyReading} slot="toolbar" />
<PluginHostSurface surface="ebook.read" part="drawer-triggers" />
```
