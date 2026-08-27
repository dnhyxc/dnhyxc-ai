# runtime/

本仓微前端**唯一装配点**：调用 `@dnhyxc-ai/federation-kit` 的 `createFederation`，把 Host 产品差异注入 kit。

## 职责

- 创建全局 `mf` / `pluginManager` / `routeInjector` / `sidebarInjector`
- 组装 `capabilities`（toast、http、全屏、选文件、downloadBlob、`buildModules`）
- 注册 ebook / learningNotes 等 `api.modules.*`
- 配置样式隔离、registry 拉取、账号上架偏好、iframe RPC

## 主要导出

| 符号 | 说明 |
|------|------|
| `mf` | Federation 门面；`mf.start()` 启动 |
| `pluginManager` | 加载 / 激活 Remote |
| `routeInjector` / `sidebarInjector` | 动态路由与侧栏 |
| `HOST_API_VERSION` | 与 registry `hostApiRange` 对齐 |
| `getAppIframeBridgeOptions()` | iframe embed 桥接配置 |

## 常用

```ts
import { mf, pluginManager } from '@/federation';

await mf.start();
mf.setNavigate(nav);
```

## 关联

- 通用 UI 能力 → [`../capabilities/`](../capabilities/README.md)
- 插件模块 → [`../modules/`](../modules/README.md)
- Registry → [`../registry/`](../registry/README.md)
- 上架偏好 → [`../enabled/`](../enabled/README.md)
