# 02 · 项目前置准备：安装、构建配置、路径别名、环境变量

> **本章目标**：让读者在自己的项目里完成「能跑 kit」的最少准备。包含：依赖安装、`vite.config.ts` 的 federation 配置、路径别名、`tsconfig`、环境变量、registry 文件放哪。
>
> 全部代码以本仓真实配置为蓝本（`apps/frontend/vite.config.ts`、`apps/frontend/package.json`、`apps/frontend/.env`），并逐行注释。

---

## 1. 安装依赖

主项目需要两个东西：**kit 本身** + **Module Federation 运行时**。

### 1.1 安装 `@dnhyxc-ai/federation-kit`

```bash
# 本仓库内（pnpm workspace）用 workspace 协议安装
pnpm add @dnhyxc-ai/federation-kit

# 普通项目（发布到 npm 后）直接装
pnpm add @dnhyxc-ai/federation-kit
```

kit 的 `package.json` 声明了三个 **peerDependencies**（均 optional，用到对应功能才装）：

```jsonc
// packages/federation-kit/package.json（摘录）
{
  "peerDependencies": {
    // Module Federation 增强运行时：loadRemote / registerRemotes / registerShared 全依赖它
    "@module-federation/enhanced": ">=0.0.0",
    // 宿主若用 React 挂载插件（FederationPlugin / PluginHostView），需要 React
    "react": ">=18.0.0",
    // React 对应 DOM 渲染器
    "react-dom": ">=18.0.0"
  }
}
```

### 1.2 安装 Module Federation 相关依赖

```bash
# enhanced 运行时：宿主加载远端、共享 React 的底层引擎
pnpm add @module-federation/enhanced

# 仅当宿主用 Vite 构建时：让 Vite 产物带 federation 能力（shared + remoteEntry）
pnpm add -D @module-federation/vite
```

> **语义说明**：
> - `@module-federation/enhanced` 提供 `createInstance` / `loadRemote` / `registerRemotes` / `registerShared`，是 kit `mf/mf.ts` 的底层依赖。
> - `@module-federation/vite` 是 Vite 构建插件。**宿主也需要它**（不只是子应用），因为宿主必须声明 `shared: { react, react-dom }` 并向子应用暴露「我共享了 React」——否则子应用拉到的 React 与宿主不是同一实例，hooks 会失效（常见现象：子应用 `useLocation` 找不到 Router context、`useState` 各自为政）。

---

## 2. Vite 配置（宿主侧，关键！）

宿主虽然是「消费方」，但**必须有** `federation()` 插件。下面是本仓 `apps/frontend/vite.config.ts` 逐行注释：

```ts
// @module-federation/vite：给宿主加 federation 能力（shared + 运行时 getInstance）
import { federation } from '@module-federation/vite';
// 本仓还用了 tailwind 与 react 插件，仅作上下文，与微前端无关
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
// Vite 配置工具
import { defineConfig, loadEnv } from 'vite';

// 宿主需要 federation（shared + getInstance），否则 Remote 共享 React 易挂。
// 但不能让 optimizeDeps 预打包 react*：否则会写进 virtual:mf:...，重启后解析失败。
// 见 module-federation/vite#708 / #768。
// 只 exclude react*：exclude react-router 会让其直连 CJS cookie，浏览器报 parse named export 不存在
// 不 shared/不 exclude vue：Host 不安装 Vue；Vue Remote 自带 runtime
// 上面这三行注释是踩坑经验，务必保留语义：
const MF_SHARED_EXCLUDE = [
  // 这几个必须交给 federation 运行时动态解析，不能预打包
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
];

export default defineConfig(({ mode }) => {
  // loadEnv：读取 .env 里的变量（本仓 .env 里有 VITE_HOST_API_VERSION 等）
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      federation({
        // 宿主自身在 MF 世界的名字；子应用 shared react 时对名字无要求，保持唯一即可
        name: 'host',
        // 宿主也可以作为远端被别人加载（本仓不作为远端，文件名保留默认即可）
        filename: 'remoteEntry.js',
        // 宿主不声明任何远端；远端全部由 kit 运行时动态 registerRemote
        remotes: {},
        // ★ 共享 React：单例 + 版本要求，这是插件能复用宿主 React 的关键
        // 勿 shared react-router：生产 loadShare 易与 react-router/dom 拆成双实例，
        // 导致 useLocation 找不到 Router context（线上 /plugins 白屏）。Remote 也未共享它。
        // 勿 shared vue：Host 不装 Vue；Vue 插件自带 runtime + mount API。
        shared: {
          react: { singleton: true, requiredVersion: '^19.1.0' },
          'react-dom': { singleton: true, requiredVersion: '^19.1.0' },
        },
        // entry 注入位置：让初始化代码在入口最早执行，避免被包成无导出 bootstrap
        hostInitInjectLocation: 'entry',
        // 关闭 dts 生成
        dts: false,
        dev: {
          // 开发态子应用热更新
          remoteHmr: true,
        },
      }),
    ],
    resolve: {
      alias: {
        // 本仓的路径别名（可选，视你的项目而定）
        '@': '/src',
        '@ui': '/src/components/ui',
        '@design': '/src/components/design',
      },
      // 强制 React 全家桶去重，保证宿主/插件只存在一份
      dedupe: ['react', 'react-dom', 'react-router'],
    },
    optimizeDeps: {
      // 禁止把 shared 打进 .vite/deps（否则 deps 里会 import virtual:mf 且常解析失败）
      exclude: MF_SHARED_EXCLUDE,
    },
  };
});
```

### 2.1 关键点逐条解释

| 配置 | 作用 | 不配会怎样 |
|------|------|-----------|
| `shared.react` singleton | 插件通过 loadShare 拿到宿主同一个 React | 插件/宿主各一份 React，hooks 状态不同步 |
| `optimizeDeps.exclude` react* | 避免预打包引入 `virtual:mf` 死循环 | Vite 重启后解析失败 |
| `remotes: {}` | 远端完全运行时注册 | — |
| `dedupe` react 系 | 保险丝：确保无第二份 | 双实例症状同上 |

> **Vite 之外**：如果用 webpack/rspack 作宿主，只需保证「产物是 Module Federation 兼容 + 共享 react 单例」，并让 `@module-federation/enhanced/runtime` 可用即可，kit 本身与构建器无关。

---

## 3. 路径别名与 TS 配置

kit 是 ESM 包，导出三个子路径：

| 入口 | 内容 | 何时用 |
|------|------|--------|
| `@dnhyxc-ai/federation-kit` | `createFederation` + 底层运行时（mf / bridge / injector / registry / types） | 适配层 |
| `@dnhyxc-ai/federation-kit/react` | `FederationPlugin` / `PluginHostView` / hooks / `FederationProvider` | React 挂载组件 |
| `@dnhyxc-ai/federation-kit/style-isolation` | 仅样式隔离能力 | 需要时 |

`tsconfig.json` 建议配置 `moduleResolution: "bundler"` 以识别 `exports` 字段：

```jsonc
// tsconfig.json（建议）
{
  "compilerOptions": {
    // bundler 模式才能解析包 exports 子路径（./react、./style-isolation）
    "moduleResolution": "bundler",
    // 别名：业务代码统一走适配层
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

> **约定（本仓强制）**：业务代码**只** `import { ... } from '@/federation'`，不要在业务侧直接写 `@dnhyxc-ai/federation-kit`。适配层内部才可以依赖 kit。这样换包 / 升级 / 多包共存都不影响业务代码。

---

## 4. 环境变量（宿主侧）

本仓在 `.env` 里暴露给微前端相关的变量如下：

```bash
# .env（摘录）
# Host 插件契约版本：与 plugins-registry.json 里每个插件的 hostApiRange 对齐。
# 语义：你的宿主给插件提供了"第几版"的能力契约；插件声明自己兼容哪个范围。
VITE_HOST_API_VERSION=1.0.0

# 开发/生产 registry 覆盖地址（可选）。
# 留空则走默认静态路径（本仓为 /remotes/plugins-registry.json，经 Vite 代理）。
# VITE_DEV_PLUGIN_REGISTRY_URL=
# VITE_PROD_PLUGIN_REGISTRY_URL=
```

这些变量在适配层里这样读取（`apps/frontend/src/federation/runtime/index.ts`）：

```ts
// 读取宿主 API 版本；缺省回退 '1.0.0'，保证没配也能跑
const hostApiVersion = import.meta.env.VITE_HOST_API_VERSION?.trim() || '1.0.0';

// 读取是否跳过插件完整性校验（默认不跳过）
const skipIntegrity = import.meta.env.VITE_PLUGIN_SKIP_INTEGRITY !== 'false';
```

> **语义**：`VITE_HOST_API_VERSION` 是宿主与插件之间的「契约版本」。插件在 registry 里写 `hostApiRange: "^1.0.0"`，宿主加载前用 `satisfiesRange(hostApiVersion, hostApiRange)` 校验兼容性，不兼容就不加载。详见 [09-security-isolation.md](./09-security-isolation.md)。

---

## 5. registry 文件放哪

`plugins-registry.json`（插件清单）是一个静态 JSON，必须能让宿主 fetch 到。三种常见放法：

| 方式 | 地址 | 优点 | 缺点 |
|------|------|------|------|
| 同源静态目录 | `/remotes/plugins-registry.json` | 简单，Vite 开发用代理即可 | 生产需 Nginx 静态托管 |
| 对象存储 COS/OSS | `https://xxx.cos.ap-xxx.myqcloud.com/remotes/plugins-registry.json` | 可直传、带 CDN | 需配置 CORS |
| 后端接口动态生成 | `/api/plugins/registry` | 可动态下发 | 多一层服务 |

本仓的取法（`apps/frontend/src/federation/registry/index.ts`）：

```ts
// 定义清单文件静态相对路径：插件中心读取/落盘都基于它
export const PLUGIN_REGISTRY_FILENAME = 'plugins-registry.json';
// 落盘相对路径；展示/拉取用 resolveUploadedFileUrl（与图片一致）
export const PLUGIN_REGISTRY_STATIC_PATH = `/remotes/${PLUGIN_REGISTRY_FILENAME}`;

/**
 * 计算最终 registry URL，优先环境变量覆盖，否则走默认静态路径。
 * 本仓路径解析对齐图片上传：Web DEV 同源 /remotes（Vite 代理）；
 * Web PROD / Tauri 走 /api/upload/serve?path=...；Tauri DEV 走静态源站。
 */
function registryUrl(): string {
  // 生产用 PROD 覆盖、开发用 DEV 覆盖；有值则直接用
  const override = (
    import.meta.env.PROD
      ? import.meta.env.VITE_PROD_PLUGIN_REGISTRY_URL
      : import.meta.env.VITE_DEV_PLUGIN_REGISTRY_URL
  )?.trim();
  if (override) return override;
  // 无覆盖则按项目的"上传文件 URL 解析"策略得到默认地址
  return resolveUploadedFileUrl(PLUGIN_REGISTRY_STATIC_PATH);
}
```

> 如果你的项目没有 `resolveUploadedFileUrl`，直接返回字符串地址即可，例如 `return '/remotes/plugins-registry.json'`。核心是：**返回一个能 fetch 到 JSON 的绝对/相对 URL**。

---

## 6. 最小可运行清单（本章小结）

要在你的项目里「跑起来」最少需要：

1. 安装 `@dnhyxc-ai/federation-kit`、`@module-federation/enhanced`、（Vite 宿主）+ `@module-federation/vite`。
2. `vite.config.ts` 加 `federation({ name:'host', remotes:{}, shared:{react:'^19.x', 'react-dom':'^19.x'} })`，并把 react* 加进 `optimizeDeps.exclude`。
3. 有一份 `plugins-registry.json` 能被 fetch 到（哪怕只有一个插件，或先放空 `{ updatedAt, plugins: [] }`）。
4. 一个适配层文件（下一章开始逐文件搭建）。

> 下一步：[03-registry.md](./03-registry.md) 弄懂插件清单 JSON 的每一个字段。
