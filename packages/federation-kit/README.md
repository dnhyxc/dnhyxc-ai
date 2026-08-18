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

**实现指南（implements-guide）**：
- [`implements-guide/README.md`](./docs/implements-guide/README.md) — 索引
- [`implements-guide/架构概览.md`](./docs/implements-guide/架构概览.md) — 架构总览（先读）
- [`implements-guide/API方法参考.md`](./docs/implements-guide/API方法参考.md) — **方法字典**（ensurePlugin / runLoad / resolvePluginBust 等）
- [`implements-guide/运行时与桥接.md`](./docs/implements-guide/运行时与桥接.md) — 运行时 / MF / Bridge
- [`implements-guide/样式隔离实现.md`](./docs/implements-guide/样式隔离实现.md) — 样式隔离
- [`implements-guide/React宿主视图.md`](./docs/implements-guide/React宿主视图.md) — React 挂载
- [`implements-guide/宿主适配层.md`](./docs/implements-guide/宿主适配层.md) — 本仓 `@/federation` 适配层
- [`implements-guide/复刻方案.md`](./docs/implements-guide/复刻方案.md) — 跨项目复刻手册

**宿主接入指南（host-guide）**：
- [`host-guide/README.md`](./docs/host-guide/README.md) — 主项目接入手册

**插件开发指南（plugin-guide）**：
- [`plugin-guide/README.md`](./docs/plugin-guide/README.md) — 子项目/插件开指南

## Exports

| 入口 | 内容 |
|------|------|
| `@dnhyxc-ai/federation-kit` | `createFederation` / `start` 门面 + 底层 runtime |
| `@dnhyxc-ai/federation-kit/react` | `FederationPlugin` / `Plugin` / `FederationProvider` / hooks |
| `@dnhyxc-ai/federation-kit/style-isolation` | 样式隔离 |
