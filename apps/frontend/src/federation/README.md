# 本仓 Host 适配（`@/federation`）

业务代码**只从 `@/federation` 导入**微前端能力；勿在业务侧直接写 `@dnhyxc-ai/federation-kit`。

```ts
import {
  mf,
  PluginHostPage,
  PluginHostSurface,
  usePluginEnabled,
  pickPluginLocaleText,
} from '@/federation';
```

## 目录

| 目录 | 职责 |
|------|------|
| `runtime/` | `createFederation` 门面：`mf` / `pluginManager` / injectors |
| `registry/` | COS registry 拉取、缓存、落盘 |
| `enabled/` | 账号插件上架偏好 |
| `host/` | 统一挂载模版：`PluginHostPage` / `PluginHostSurface` / Shell |
| `capabilities/` | 产品能力：影院全屏、ebook Host API |

实现细节见 [`packages/federation-kit/README`](../../../../packages/federation-kit/README.md)。

## 统一挂载模版

| 场景 | 模版 |
|------|------|
| 路由全页 / 业务树内嵌 | `PluginHostPage` |
| 抽屉 / 顶栏触发器 / toolbar | `PluginHostSurface` |

```ts
await mf.start();
mf.setNavigate(nav);
mf.onRoutesChange(rebuild);

<PluginHostPage pluginId="learningNotes" />
<PluginHostSurface surface="ebook.read" part="drawer-triggers" … />
```
