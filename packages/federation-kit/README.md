# @dnhyxc-ai/federation-kit

像 qiankun / micro-app 一样接入 Module Federation Host。

## 任意项目：3 步

```ts
import { createFederation } from '@dnhyxc-ai/federation-kit';
import { FederationPlugin } from '@dnhyxc-ai/federation-kit/react';

// 1) 创建（registryUrl 即可；其余有默认值）
const mf = createFederation({
  registryUrl: '/remotes/plugins-registry.json',
});

// 2) 启动（拉 registry、挂路由/侧栏壳）
await mf.start();
mf.setNavigate((to) => router.navigate(to));
mf.onRoutesChange(() => remountRouter());

// 3) 页面里声明式挂载
<FederationPlugin name="learningNotes" />
// 或
import { Plugin } from '@dnhyxc-ai/federation-kit/react';
<Plugin name="learningNotes" slots={{ loading: () => <Spin /> }} />
```

对比旧写法：不必手写 `createPluginRuntime` 全量 config，也不必每次给 `PluginHostView` 传 `manager` / `iframeBridge`。

## 可选能力

| 选项 | 默认 | 说明 |
|------|------|------|
| `registryUrl` | — | 最简：kit 自 fetch + localStorage 缓存 |
| `enabledStore` | localStorage | 上架开关 |
| `capabilities` | theme/locale/navigate 内置 | toast/http/modules 按需补 |
| `asDefault` | `true` | `<Plugin />` 无需 Provider |

进阶仍可用底层 `createPluginRuntime` / `PluginHostView`。

## 本仓

本仓业务代码**统一从** [`@/federation`](../../apps/frontend/src/federation) 导入（`index.ts` 再导出本包常用符号），不要直接依赖 `@dnhyxc-ai/federation-kit`。

```ts
import { mf, PluginHostPage, PluginHostSurface, usePluginEnabled } from '@/federation';
await mf.start();

<PluginHostPage pluginId="learningNotes" />
<PluginHostSurface surface="ebook.read" part="drawer" openPluginId={id} onOpenPluginIdChange={setId} />
```

## 文档

详细实现思路、原理与逐行注释代码见：

- [`docs/README.md`](./docs/README.md) — 索引  
- [`docs/01-architecture-overview.md`](./docs/01-architecture-overview.md) — 架构总览（先读）  
- [`docs/07-api-method-reference.md`](./docs/07-api-method-reference.md) — **方法字典**（ensurePlugin / runLoad / resolvePluginBust 等）  
- [`docs/02-runtime-mf-bridge.md`](./docs/02-runtime-mf-bridge.md) — 运行时 / MF / Bridge  
- [`docs/03-style-isolation.md`](./docs/03-style-isolation.md) — 样式隔离  
- [`docs/04-react-host-view.md`](./docs/04-react-host-view.md) — React 挂载  
- [`docs/05-host-adapter-frontend.md`](./docs/05-host-adapter-frontend.md) — 本仓 `@/federation` 适配层  
- [`docs/06-replication-playbook.md`](./docs/06-replication-playbook.md) — 跨项目复刻手册

## Exports

| 入口 | 内容 |
|------|------|
| `@dnhyxc-ai/federation-kit` | `createFederation` / `start` 门面 + 底层 runtime |
| `@dnhyxc-ai/federation-kit/react` | `FederationPlugin` / `Plugin` / `FederationProvider` / hooks |
| `@dnhyxc-ai/federation-kit/style-isolation` | 样式隔离 |
