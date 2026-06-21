# 模块联邦 Module Federation 生产级落地完整方案

> **适用场景**：多前端应用（宿主/壳应用 + 若干远程应用）需要在**运行时共享组件、模块、工具库或完整页面**；希望做到"独立发布、独立版本、按需加载"，而不是编译时大包合并。
>
> 前提：所有参与方使用 **Webpack 5**（Module Federation 是 Webpack 5 官方内置能力，不支持 Webpack 4）。
> 若你还在 Webpack 4，可以先升级到 Webpack 5（`module/rule` 基本兼容，主要改动在 `optimization` 与 `asset/resource` 取代 `file-loader/url-loader`），再启模块联邦。

本文按"先讲约定 → 再给可复制的基础配置 → 再讲 shared 策略 → 再讲部署与降级 → 再讲开发体验与性能 → 最后给出一份可直接落地的宿主/远程项目骨架"的顺序写，方便直接拿去做生产方案或面试回答。

---

## 0. 术语约定（先对齐，后面不会再解释）

- **Host（宿主/容器应用）**：消费远程模块的一方，一个 Host 可以同时是 Remote（提供给别人）；
- **Remote（远程应用）**：通过 `exposes` 暴露模块的一方；
- **Remote Entry（远程入口）**：每个 Remote 都会产出一个 `remoteEntry.js`，这是一个很小的"清单文件"，Host 先加载它，再按需拉真正的业务 chunk；
- **Shared（共享依赖）**：在 `shared` 中声明的依赖会在运行时去重，避免多个应用各自打包一份 `react`/`lodash`/`antd`；
- **Federation 插件**：`new ModuleFederationPlugin({ name, filename, remotes, exposes, shared })`。

---

## 1. 生产级建议的三档方案（你项目里选一档）

| 档 | 做法 | 适用 | 改动量 |
| --- | --- | --- | --- |
| **第 1 档：最小可行** | 只做"一个 Host + 一个 Remote"，Remote exposes 1~2 个组件；shared 只声明 `react/react-dom` | 试点/POC | 小 |
| **第 2 档：多 Host + 多 Remote + shared 规范**（推荐生产起点） | 多团队多应用，共享组件库/工具库/业务域模块；shared 统一在"配置包"维护；有版本降级策略与 CI 校验 | 公司级中台、多产品矩阵 | 中 |
| **第 3 档：动态远程（Dynamic Remote）+ 运行时注册 + 中央注册中心** | Host 不在构建期写死 `remotes`，而是运行时从配置接口拉 `remoteEntry` 列表，支持"热插拔新应用" | SaaS、插件化平台、低代码 | 大 |

下面按第 2 档展开，再用单独一节讲第 3 档的实现。

---

## 2. 代码组织与项目结构（Monorepo 推荐）

> 模块联邦项目"可以不是 Monorepo"，但 Monorepo 能显著降低版本管理、共享配置、共享脚本的成本。推荐使用 **pnpm workspace + Turborepo**（或 Nx）。

```
monorepo-root/
├── package.json               # workspace / scripts / devDependencies
├── pnpm-workspace.yaml
├── turbo.json
├── apps/
│   ├── shell/                # Host / 壳应用（消费者，通常是主站 / 控制台 / 工作台）
│   │   ├── package.json
│   │   ├── webpack.config.js
│   │   └── src/
│   │        ├── bootstrap.jsx   # 异步入口（关键！）
│   │        ├── index.js        # 只负责 import('./bootstrap')
│   │        ├── remotes/        # 运行时注册远程 + 降级处理
│   │        └── components/
│   ├── team-checkout/         # Remote：订单/支付团队提供的远程组件/页面
│   │   ├── package.json
│   │   ├── webpack.config.js
│   │   └── src/
│   │        ├── bootstrap.jsx
│   │        ├── index.js
│   │        └── exposes/
│   │             ├── CheckoutPage.jsx
│   │             └── PaymentButton.jsx
│   └── team-user/             # Remote：用户中心提供的
│        ├── ...
└── packages/
    ├── mf-config/             # ⭐ 公共 Module Federation 配置（shared/exposes/remotes 的"真相源"）
    │   ├── src/
    │   │   ├── shared.js      # shared 清单 + 版本策略（所有 app 都引用它）
    │   │   └── remotes.js     # remotes 映射（环境变量 override）
    │   └── package.json
    ├── ui-components/         # 共享组件库（也可以通过 exposes 提供，也可以直接 import 打包）
    ├── tracking/              # 共享埋点 SDK
    └── eslint-config-mf/      # 统一 lint（建议团队使用同一份 lint）
```

关键点：**所有 app 的 `shared` 声明都来自同一个包 `@mf-config/shared`**，保证"react 版本 18.2"在每个 app 中都是同一个规则，不会出现"宿主声明 singleton，远程声明多实例"导致两份 react 共存而 hooks 炸掉。

---

## 3. 可复制的基础配置

### 3.1 Host（宿主）webpack 配置

```js
// apps/shell/webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;
const { shared } = require('@mf-config/shared');           // ⭐ 来自公共包
const { remotes, remoteType } = require('@mf-config/remotes');
const deps = require('./package.json').dependencies;

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: path.resolve(__dirname, 'src/index.js'),            // 注意：入口是 index（同步 import bootstrap）
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'auto',                                     // ⭐ 最稳妥写法：按实际 script 加载路径解析
    filename: process.env.NODE_ENV === 'production'
      ? 'js/[name].[contenthash:8].js'
      : 'js/[name].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        include: path.resolve(__dirname, 'src'),
        exclude: /node_modules/,
        use: [{
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            presets: ['@babel/preset-env', ['@babel/preset-react', { runtime: 'automatic' }]],
          },
        }],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|woff2?)$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/[name].[hash:8][ext]' },
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',                            // 容器应用名（不能与其他 name 冲突！）
      filename: 'remoteEntry.js',               // 如果你希望 shell 也能被别人 consume（双向）
      remotes: {                                // ⭐ 本应用消费谁
        checkout: `checkout@${remotes.checkout}/${remoteType}`,
        userCenter: `userCenter@${remotes.userCenter}/${remoteType}`,
        // ↑ 最终在运行时拼成：
        //   import('checkout/CheckoutPage')
        //   → 加载 https://checkout.xxx.com/remoteEntry.js → 读取 exposes["./CheckoutPage"]
      },
      exposes: {                                // 可选：宿主也可以暴露（比如共享的 Layout/Header）
        './Layout': './src/components/Layout.jsx',
      },
      shared: shared({
        react: { singleton: true, eager: true, requiredVersion: deps.react },
        'react-dom': { singleton: true, eager: true, requiredVersion: deps['react-dom'] },
        // 业务级共享（非 eager，按需加载）
        'react-router-dom': { singleton: true, requiredVersion: deps['react-router-dom'] },
        antd: { singleton: true, requiredVersion: deps.antd },
        dayjs: { singleton: true, requiredVersion: deps.dayjs },
        lodash: {},
        '@ui-components/button': { singleton: true, requiredVersion: deps['@ui-components/button'] },
      }),
    }),
    new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'public/index.html') }),
  ],
  devServer: {
    port: 3000,
    historyApiFallback: true,
    hot: true,
    // 允许在 HTML 中动态注入其他 remote 的 script（动态远程方案需要）
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
};
```

### 3.2 Remote（远程）webpack 配置

```js
// apps/team-checkout/webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;
const { shared } = require('@mf-config/shared');
const deps = require('./package.json').dependencies;

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: path.resolve(__dirname, 'src/index.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'auto',                                          // ⭐ 生产推荐
    filename: process.env.NODE_ENV === 'production'
      ? 'js/[name].[contenthash:8].js' : 'js/[name].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
    clean: true,
    // 生产关键：保证多 Remote 之间的 webpack runtime 不冲突
    uniqueName: 'teamCheckout',
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  module: { /* 同 host，略 */ },
  plugins: [
    new ModuleFederationPlugin({
      name: 'checkout',                                          // ⭐ 必须与 host 的 `checkout@xxx` 前缀一致
      filename: 'remoteEntry.js',                                // Host 加载的就是它
      exposes: {
        './CheckoutPage':  './src/exposes/CheckoutPage.jsx',     // ⭐ 对外暴露什么
        './PaymentButton': './src/exposes/PaymentButton.jsx',
      },
      shared: shared({
        react: { singleton: true, requiredVersion: deps.react },
        'react-dom': { singleton: true, requiredVersion: deps['react-dom'] },
        antd: { singleton: true, requiredVersion: deps.antd },
        dayjs: { singleton: true, requiredVersion: deps.dayjs },
        lodash: {},
      }),
    }),
    // Remote 自己也能独立跑起来（便于开发），所以也要 HtmlWebpackPlugin
    new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'public/index.html') }),
  ],
  devServer: {
    port: 3001,
    historyApiFallback: true,
    hot: true,
    headers: { 'Access-Control-Allow-Origin': '*' },             // Host 在本地要能 fetch remoteEntry
  },
};
```

### 3.3 公共 shared 配置包（"真相源"）

这是生产化的关键：**把 shared 规则收敛到一处**，避免每个应用自己写一份导致版本语义不一致。

```js
// packages/mf-config/src/shared.js
/**
 * 生成 shared 配置。
 * 生产建议区分三种共享策略：
 *   1. singleton + eager：React/ReactDOM 等"必须同一份实例"的基础库；
 *   2. singleton + lazy（默认）：antd/dayjs 等"希望同一份，但不阻塞首屏"；
 *   3. 多实例：lodash/utils 等"无内部状态、各版本不冲突"的库，允许多实例共存。
 */
function pickStrategy(depKey) {
  const singletons = new Set([
    'react', 'react-dom', 'react-router-dom', 'antd', 'antd5',
    'dayjs', 'moment', 'redux', 'react-redux', '@reduxjs/toolkit',
    'vue', 'vue-router', 'pinia', '@ui-components/button',
  ]);
  if (singletons.has(depKey)) {
    return { singleton: true };
  }
  // 其余默认多实例（不写 singleton）
  return {};
}

/**
 * @param {Record<string, object>} appOverrides 应用级覆盖声明
 */
module.exports.shared = function shared(appOverrides = {}) {
  const merged = {};
  for (const [k, v] of Object.entries(appOverrides)) {
    merged[k] = { ...pickStrategy(k), ...v };
  }
  return merged;
};
```

```js
// packages/mf-config/src/remotes.js（可被环境变量覆盖）
module.exports.remotes = {
  checkout: process.env.MF_REMOTE_CHECKOUT || 'https://checkout.xxx.com',
  userCenter: process.env.MF_REMOTE_USERCENTER || 'https://user.xxx.com',
};
module.exports.remoteType = 'remoteEntry.js';
```

> 为什么要"所有应用统一一份 shared"？因为 Module Federation 决定"用哪一份 shared 模块"时遵循三条规则：
> - `singleton: true`：整个页面只能有一个实例，**版本最高且满足 `requiredVersion` 的获胜**；
> - 没有 singleton：每个应用自己带一份（会有多份 `react` 并存，hooks 会崩）；
> - **version 冲突会静默 fallback**：如果某个 remote 的 `requiredVersion` 与宿主提供的版本 semver 不兼容，它会**在控制台打印一条 warning 然后回退到使用自己打包的那份**——这就是"你以为 singleton 了实际却有两份"的经典坑。

---

## 4. 两个必须懂的"shared 规则"（面试/生产必问）

### 4.1 `eager: true` vs 不写 `eager`

- **`eager: true`**：模块会打进**启动 chunk**，页面一启动就有；不会额外发一个 shared chunk 请求；
- **不写 eager**（默认 lazy）：shared 模块会被抽成一个独立 chunk，在首次被某个 remote 用到时才加载；
- **生产建议**：React/ReactDOM（尤其是 host 端）写成 `eager: true` 避免"首屏一个大 chunk 之外还要额外 fetch shared"；其他库（antd/lodash/dayjs）不要 eager，按实际使用加载。

```js
// 一个好的默认
shared({
  react: { singleton: true, eager: true, requiredVersion: deps.react },
  'react-dom': { singleton: true, eager: true, requiredVersion: deps['react-dom'] },
  antd: { singleton: true, requiredVersion: deps.antd },          // 懒加载
  lodash: {},                                                       // 允许多实例
});
```

### 4.2 `requiredVersion` 的几种写法与 fallback 策略

```js
shared({
  // 1) 写死 package.json 版本（推荐）——严格匹配，不匹配就 fallback
  react: { singleton: true, requiredVersion: deps.react },

  // 2) 指定 semver 范围（慎用，意图要和团队文档一致）
  antd: { singleton: true, requiredVersion: '^4.24.0' },

  // 3) 不写 requiredVersion：任何版本都可接受（不推荐对 react 这样）
  lodash: {},
});
```

> **fallback 策略是什么？**
> - Host 提供一个版本，Remote 声明 `requiredVersion`；
> - Host 版本满足要求 → Remote 用 Host 的；
> - Host 版本不满足 → Remote **默默自己带一份**（控制台 warning），于是页面出现两份 antd，样式/实例互相冲突；
> - 生产中要"禁止 fallback"可以用 `strictVersion: true`（**不满足就抛异常，构建失败**——这很硬核但最安全），或通过 **CI 校验 shared 清单**（见 §9）。

---

## 5. 入口必须异步！（90% 的人第一步踩坑）

Host 的 entry 不能直接 `import React from 'react'` 然后 `ReactDOM.createRoot`——因为模块联邦的 shared 在**构建完成后还有"等待 remote 注册共享模块"的异步过程**。正确做法：**entry 只做 `import('./bootstrap')`，真正的 React 启动写在 bootstrap.jsx 里**。

```js
// apps/shell/src/index.js   ← 同步 shell
import('./bootstrap');       // ⭐ 关键：只有一行异步 import
```

```jsx
// apps/shell/src/bootstrap.jsx   ← 真正的启动代码（可以正常 import 一切）
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Layout from './components/Layout';

// ⭐ 跨应用动态加载远程模块（懒加载）
const CheckoutPage = lazy(() => import('checkout/CheckoutPage'));
const UserCenter = lazy(() => import('userCenter/ProfilePage'));

function RemoteRoute({ children, fallback = <div>loading...</div> }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Layout>
      <nav>
        <Link to="/">Home</Link> |{' '}
        <Link to="/checkout">Checkout（远程）</Link> |{' '}
        <Link to="/user">User Center（远程）</Link>
      </nav>
      <Routes>
        <Route path="/" element={<div>Shell Home</div>} />
        <Route
          path="/checkout/*"
          element={
            <RemoteRoute><CheckoutPage /></RemoteRoute>
          }
        />
        <Route
          path="/user/*"
          element={
            <RemoteRoute><UserCenter /></RemoteRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  </BrowserRouter>
);
```

Remote 也必须遵循同样的约定，否则它"自己独立跑"时没问题、一旦被 Host 消费就炸：

```js
// apps/team-checkout/src/index.js
import('./bootstrap');
```

```jsx
// apps/team-checkout/src/bootstrap.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import CheckoutPage from './exposes/CheckoutPage';

// 独立运行（开发用）：直接渲染 CheckoutPage
if (!window.__IS_CONSUMED_BY_MF__) {
  ReactDOM.createRoot(document.getElementById('root')).render(<CheckoutPage />);
}
// ⭐ 被消费时：什么都不做（Host 会调用 exposes/CheckoutPage）
export { default as CheckoutPage } from './exposes/CheckoutPage';
export { default as PaymentButton } from './exposes/PaymentButton';
```

---

## 6. `remoteEntry.js` 的加载机制、部署与跨域

### 6.1 加载机制（一句话讲清楚）

Host 启动后，webpack 会先把 `remotes: { checkout: 'checkout@https://checkout.xxx.com/remoteEntry.js' }` 映射成"当代码 `import('checkout/CheckoutPage')` 时，先 `fetch('https://checkout.xxx.com/remoteEntry.js')`，拿到后解析 exposes 列表，再按需 fetch 真正的 `checkout/src/CheckoutPage` chunk"。

### 6.2 部署：remoteEntry 与其他 chunk 的相对路径

```
checkout.xxx.com/
├── remoteEntry.js               ← Host 直接请求它（建议短缓存）
├── js/
│    ├── main.abc123.js
│    ├── 567.aaa.js              ← 远程业务代码（长缓存，contenthash）
│    └── vendors-shared.xyz.js   ← 共享 chunk
└── index.html（独立开发用）
```

**Nginx（Remote 侧）关键：**

```nginx
server {
  listen 443 ssl http2;
  server_name checkout.xxx.com;

  root /var/www/checkout;

  # ⭐ remoteEntry 不能长缓存，每次要能拿到最新
  location = /remoteEntry.js {
    add_header Cache-Control 'no-cache, no-store, must-revalidate, max-age=0';
    add_header Access-Control-Allow-Origin 'https://your-host-domain.com' always;
    add_header Access-Control-Allow-Credentials 'true';
    if ($request_method = OPTIONS) { return 204; }
    try_files $uri =404;
  }

  # 其他静态资源：长缓存（webpack contenthash）
  location /js/     { expires 1y; add_header Cache-Control 'public, max-age=31536000, immutable'; }
  location /css/    { expires 1y; add_header Cache-Control 'public, max-age=31536000, immutable'; }
  location /assets/ { expires 1y; add_header Cache-Control 'public, max-age=31536000, immutable'; }

  # 独立开发 / 直接访问时的 historyApiFallback
  location / {
    try_files $uri $uri/ /index.html;
    add_header Access-Control-Allow-Origin 'https://your-host-domain.com' always;
  }
}
```

> **一个非常常见的事故**：运维把 `remoteEntry.js` 也设了 `max-age=31536000`，导致新版本发布后，Host 还在加载旧 `remoteEntry.js`，引用的旧 chunk hash 404，**整个远程模块白屏**。缓存策略是模块联邦项目的"生命线"。

### 6.3 `publicPath: 'auto'`

webpack 5 官方推荐，运行时按"当前 script 标签的 src 所在路径"自动解析相对 chunk URL。比 `publicPath: '/checkout/'` 这种写死更稳。

---

## 7. 动态远程（第 3 档：运行时注册，支持"新 Remote 无须改 Host 代码发布"）

如果每次上线新 Remote 都要改 Host 的 `webpack.config.js`，模块联邦的"独立发布"意义就打折了。生产级做法：**Host 在启动时从接口拉"当前开放的 Remote 列表"，动态注册再加载 bootstrap**。

### 7.1 Host 动态注册脚本

```jsx
// apps/shell/src/remotes/dynamicRemotes.js
/**
 * 远程描述：{ name: 'checkout', url: 'https://checkout.xxx.com/remoteEntry.js' }
 * 通过调用 loadRemote 完成"promise-based 远程加载"。
 *
 * 前提：webpack.config 中不能把 `checkout` 写死到 remotes（或写一个空壳 remotes），
 *      而是通过 `__webpack_init_sharing__` + `container.init` 的运行时 API 手动接入。
 */
export async function loadRemote({ name, url, scope = 'default' }) {
  // 1) 初始化 shared 作用域
  await __webpack_init_sharing__(scope);

  // 2) 动态注入 <script>，拿到远程 container（即 remoteEntry.js 暴露的对象）
  const container = window[name];
  if (!container) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // 3) 初始化远程容器（与 Host 做 shared 协商）
  const fetchedContainer = window[name];
  await fetchedContainer.init(__webpack_share_scopes__[scope]);

  return fetchedContainer;
}

/**
 * 动态 import 一个远程模块（运行时）
 * 用法：const Component = await loadRemoteModule({ name:'checkout', url:'...', module: './CheckoutPage' })
 */
export async function loadRemoteModule({ name, url, module }) {
  const container = await loadRemote({ name, url });
  const factory = await container.get(module); // container.get('./CheckoutPage')
  return factory();                           // factory 调用返回实际 module.exports
}
```

### 7.2 把动态路由表接进来

```jsx
// apps/shell/src/remotes/registerRoutes.js
import { loadRemoteModule } from './dynamicRemotes';
import { lazy, Suspense } from 'react';

/**
 * 从服务端拉一份"远程路由表"（示例）：
 * [
 *   { path: '/checkout', name: 'checkout', url: 'https://checkout.xxx.com/remoteEntry.js', module: './CheckoutPage' },
 *   { path: '/user',     name: 'userCenter', url: 'https://user.xxx.com/remoteEntry.js', module: './ProfilePage' },
 * ]
 */
export async function fetchRemoteRoutes() {
  const list = await fetch('/api/remote-routes').then((r) => r.json());
  return list.map((item) => ({
    path: item.path,
    element: lazy(() => loadRemoteModule({ name: item.name, url: item.url, module: item.module })),
  }));
}

// bootstrap.jsx 中使用：先 fetchRemoteRoutes，再把动态路由并入 Routes
```

### 7.3 webpack.config 对动态远程的声明（非常关键，否则 webpack 不会生成 shared chunk）

如果你完全不写 `remotes`，webpack 可能不会为你准备好"接收远程容器"的基础设施。推荐写一个"占位 remotes"：

```js
// apps/shell/webpack.config.js
new ModuleFederationPlugin({
  name: 'shell',
  remotes: {
    // 写死一个占位，webpack 会在构建时为它生成加载逻辑；
    // 真正的 URL 由 src/remotes/dynamicRemotes.js 覆盖
    _placeholder: '_placeholder@about:blank',
  },
  shared: { /* ... */ },
});
```

或更现代的做法——使用 `experiments.outputModule` 或 `remotes: []` 空数组——取决于你 webpack 版本，**建议保留一个占位**，避免"生产环境某些版本 shared chunk 未正确生成"导致的偶发白屏。

---

## 8. 降级与容错（生产必备）

模块联邦里"一个远程挂了"不能让整个宿主挂。至少要做到三层兜底：

### 8.1 React Error Boundary（最外层）

```jsx
// apps/shell/src/components/RemoteFallback.jsx
import React, { Component } from 'react';

export default class RemoteFallback extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    // 上报：Sentry / 自建监控 / window.track（见埋点 §11）
    window.__TRACK__?.captureException?.(error, { extra: info, remote: this.props.remoteName });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, border: '1px dashed #f5222d', borderRadius: 8, background: '#fff1f0' }}>
          <strong>「{this.props.remoteName || '远程模块'}」加载失败</strong>
          <p style={{ color: '#666' }}>{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })}>重试</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 8.2 Suspense fallback + 超时中断

```jsx
// apps/shell/src/components/RemoteRoute.jsx
import React, { Suspense, useEffect, useState } from 'react';

export default function RemoteRoute({ children, fallback = <div>Loading...</div>, timeout = 8000 }) {
  const [timeout, setTimeoutFlag] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setTimeoutFlag(true), timeout);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <Suspense fallback={fallback}>
      {timeout ? <div>加载超时，请刷新重试</div> : children}
    </Suspense>
  );
}
```

### 8.3 服务端灰度（Nginx / CDN）

`remoteEntry.js` 做灰度：让 10% 用户请求 `remoteEntry.beta.js`，90% 请求 `remoteEntry.js`。失败回退到稳定版，避免"新版本 remote 有 bug 导致全站白屏"。

---

## 9. shared 版本一致性的 CI 校验（避免两套 react）

在 Monorepo 中写一条脚本：**所有应用的 `dependencies.react` 必须与 `@mf-config/shared` 中声明的 `requiredVersion` 一致**，否则 CI 失败。

```js
// packages/mf-config/scripts/check-versions.js
const fs = require('fs');
const path = require('path');

const appDirs = [
  path.resolve(__dirname, '../../apps/shell'),
  path.resolve(__dirname, '../../apps/team-checkout'),
  path.resolve(__dirname, '../../apps/team-user'),
];

let failed = false;
const canonical = {
  react: '18.2.0',
  'react-dom': '18.2.0',
  antd: '4.24.15',
  dayjs: '1.11.10',
};

for (const dir of appDirs) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  for (const [name, expected] of Object.entries(canonical)) {
    const actual = (pkg.dependencies[name] || pkg.devDependencies[name] || '').replace(/[\^~]/, '');
    if (actual !== expected) {
      console.error(`[MF] ${path.basename(dir)}/${name} 期望 ${expected}，实际 ${actual}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('[MF] shared 版本一致 ✓');
```

```json
// monorepo-root/package.json
{
  "scripts": {
    "mf:check-versions": "node packages/mf-config/scripts/check-versions.js",
    "prebuild": "pnpm mf:check-versions"
  }
}
```

---

## 10. 开发体验（DX）

### 10.1 Monorepo 一键同时起所有 app + 热更新

```json
// monorepo-root/package.json
{
  "scripts": {
    "dev": "turbo run dev --parallel",        // 用 Turborepo 并行跑所有 app 的 dev
    "build": "turbo run build",
    "lint": "turbo run lint",
    "mf:check-versions": "node packages/mf-config/scripts/check-versions.js"
  }
}
```

```json
// monorepo-root/turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "dev": { "cache": false, "persistent": true },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "lint": { "outputs": [] }
  }
}
```

### 10.2 TypeScript 类型支持（远程模块的类型怎么拿到？）

默认 `import('checkout/CheckoutPage')` 是 `any`。生产方案：**让 Remote 在构建时额外产出 `*.d.ts` "类型入口"，Host 通过 npm package / workspace 消费**。一个流行的社区插件是 `@module-federation/typescript`。

### 10.3 允许远程模块在 Host 断点调试（source map）

- Remote 构建：开启 `devtool: 'hidden-source-map'`（生产）或 `devtool: 'source-map'`（预发）；
- Host 构建：与 Remote 保持一致的 devtool，并在浏览器 DevTools 设置中打开 "JavaScript source maps"；
- 在 Sentry 上传 source map 即可看到远程模块的调用栈。

---

## 11. 埋点与 SSO（跨应用但口径一致）

```js
// packages/tracking/src/index.js（Host bootstrap.jsx 最前面 import）
export function initTracking() {
  window.__TRACK__ = {
    captureException(error, extra = {}) {
      // Sentry 上报
      if (window.Sentry) window.Sentry.captureException(error, { extra });
      // 或自建监控
      console.error('[track]', error, extra);
    },
    pageView({ path, remote }) {
      console.log('[track] pageview', { path, remote });
    },
  };
}
```

Remote 内部不要再初始化 Sentry（否则一个页面多个 Sentry 实例，会重复上报），统一：

```jsx
// apps/team-checkout/src/exposes/CheckoutPage.jsx
import React, { useEffect } from 'react';
export default function CheckoutPage() {
  useEffect(() => {
    window.__TRACK__?.pageView({ path: location.pathname, remote: 'checkout' });
  }, []);
  return <div>Checkout Page (remote)</div>;
}
```

SSO 由 **Host 统一做**（OAuth2/OIDC/Cookie-JWT 任一），登录后把 `token/user/permissions` 放在 `window.__AUTH__` 或 `localStorage`，Remote 只读即可——不要在 Remote 里跑登录流程。

---

## 12. 性能

- **Suspense + React.lazy**：所有远程模块都懒加载，Host 首屏只加载真正会访问的 remote；
- **`publicPath: 'auto'` + HTTP2 + CDN**：静态资源就近、多路复用；
- **`remoteEntry.js` no-cache、其他 chunk immutable**：避免"新版本旧 chunk 404"的经典事故；
- **`contenthash` 的正确使用**（第 3 节 output 已给出）；
- **shared chunk 预连接**：在 Host 的 `<head>` 中根据已知 remote 域名加

  ```html
  <link rel="dns-prefetch" href="https://checkout.xxx.com">
  <link rel="preconnect" href="https://checkout.xxx.com" crossorigin>
  ```
- **构建缓存**：Turborepo + `babel-loader.cacheDirectory` + `cache.type: 'filesystem'`

---

## 13. 故障排查速查（我在项目里整理的高频坑）

| 现象 | 可能原因 | 解决 |
| --- | --- | --- |
| 控制台 `Uncaught Error: Shared module is not available for eager consumption` | 入口直接 `import React`，没做"index + bootstrap 异步" | 把真正启动代码移到 `bootstrap.jsx`，`index.js` 只写 `import('./bootstrap')` |
| 控制台 `Uncaught Error: ScriptExternalLoadError: Loading script failed.` | Host 无法加载 remoteEntry.js（域名错 / 404 / CORS） | 检查 remote 域名、Nginx CORS、HTTPS 证书、网络连通性 |
| Hooks 报错 "Invalid hook call" 或组件上下文丢失 | 页面上有两份 React 实例（Host 一份、Remote 一份） | 所有应用统一 `react: { singleton: true, requiredVersion: deps.react }`，CI 跑 `mf:check-versions` |
| 首屏正常，刷新某个远程路由白屏 | Host 的 `historyApiFallback` 没落到 index.html；或 Host 没把 `/checkout/*` 这种路径交给 React Router 处理 | Nginx `try_files $uri $uri/ /index.html`；React Router 用通配路由渲染 Remote 组件 |
| 远程模块样式错乱 / antd 样式丢 | antd 在 Remote 用了按需引入但样式文件未打进 shared；或 Remote 的 CSS 被 Host 的样式覆盖 | 把 antd 等"必须同一份实例"的库放在 shared singleton；或由 Host 统一引入全局样式；Remote 只写局部 scoped CSS |
| 发布新版本后老 chunk 404（最经典事故） | remoteEntry.js 被长缓存了 | Nginx 对 `remoteEntry.js` 单独 `Cache-Control: no-cache`；其他 chunk 保持 `contenthash + immutable` |
| `publicPath` 算错导致资源请求到 Host 域名下 | 写死 `publicPath: '/'` 或 Remote 被 Host 消费时路径不对 | 使用 `publicPath: 'auto'`；必要时在 Remote 的 `bootstrap.jsx` 顶部动态设置 `__webpack_public_path__` |
| 动态远程：`container.get('./Xxx')` 抛 "module not found" | expose 的 key 必须以 `./` 开头，且大小写严格匹配 | 检查 Remote 的 `exposes: { './CheckoutPage': ... }` 的 key 与 Host 的 `container.get('./CheckoutPage')` 严格一致 |
| 动态远程：`__webpack_init_sharing__ is not defined` | webpack 没有为 Host 生成共享机制（remotes 为空或配置不合法） | 在 webpack.config 的 remotes 中加一个占位；或确保 webpack 5 版本 >= 5.30 |

---

## 14. 生产级完整骨架（可直接 `pnpm install && pnpm dev`）

下面把 4 个"最小可运行"文件放在一起，你复制即可跑通。

### 14.1 Monorepo workspace

```yaml
# monorepo-root/pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// monorepo-root/package.json
{
  "name": "mf-monorepo",
  "private": true,
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "mf:check-versions": "node packages/mf-config/scripts/check-versions.js",
    "prebuild": "pnpm mf:check-versions"
  },
  "devDependencies": {
    "turbo": "^1.12",
    "@babel/core": "^7.24",
    "@babel/preset-env": "^7.24",
    "@babel/preset-react": "^7.24",
    "babel-loader": "^9.1",
    "css-loader": "^6.10",
    "style-loader": "^3.3",
    "html-webpack-plugin": "^5.6",
    "webpack": "^5.91",
    "webpack-cli": "^5.1",
    "webpack-dev-server": "^5.0"
  }
}
```

```json
// monorepo-root/turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
  }
}
```

### 14.2 公共配置包 `@mf-config/shared`

```json
// packages/mf-config/package.json
{
  "name": "@mf-config/shared",
  "version": "1.0.0",
  "main": "src/shared.js",
  "exports": {
    ".": "./src/shared.js",
    "./shared": "./src/shared.js",
    "./remotes": "./src/remotes.js"
  }
}
```

```js
// packages/mf-config/src/shared.js（同 §3.3，略）
module.exports.shared = function shared(appOverrides = {}) {
  const singletons = new Set([
    'react', 'react-dom', 'react-router-dom', 'antd', 'dayjs',
  ]);
  const merged = {};
  for (const [k, v] of Object.entries(appOverrides)) {
    merged[k] = { ...(singletons.has(k) ? { singleton: true } : {}), ...v };
  }
  return merged;
};
```

```js
// packages/mf-config/src/remotes.js
module.exports.remotes = {
  checkout: process.env.MF_REMOTE_CHECKOUT || '//localhost:3001',
  userCenter: process.env.MF_REMOTE_USERCENTER || '//localhost:3002',
};
module.exports.remoteType = 'remoteEntry.js';
```

### 14.3 Host（shell）

```json
// apps/shell/package.json
{
  "name": "shell",
  "version": "1.0.0",
  "scripts": { "dev": "webpack serve", "build": "webpack --mode production" },
  "dependencies": {
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-router-dom": "^6.22",
    "@mf-config/shared": "workspace:*"
  }
}
```

```js
// apps/shell/src/index.js
import('./bootstrap');
```

```jsx
// apps/shell/src/bootstrap.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import RemoteFallback from './components/RemoteFallback';
import RemoteRoute from './components/RemoteRoute';

const CheckoutPage = lazy(() => import('checkout/CheckoutPage'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <header style={{ padding: 16, background: '#001529', color: '#fff' }}>
      <Link to="/" style={{ color: '#fff', marginRight: 16 }}>Shell Home</Link>
      <Link to="/checkout" style={{ color: '#fff' }}>Checkout（远程）</Link>
    </header>
    <main style={{ padding: 16 }}>
      <Routes>
        <Route path="/" element={<div>Shell Home</div>} />
        <Route
          path="/checkout/*"
          element={
            <RemoteRoute>
              <RemoteFallback remoteName="checkout"><CheckoutPage /></RemoteFallback>
            </RemoteRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </main>
  </BrowserRouter>
);
```

```html
<!-- apps/shell/public/index.html -->
<!doctype html><html><body><div id="root"></div></body></html>
```

`webpack.config.js` 同 §3.1。

### 14.4 Remote（team-checkout）

```json
// apps/team-checkout/package.json
{
  "name": "team-checkout",
  "version": "1.0.0",
  "scripts": { "dev": "webpack serve", "build": "webpack --mode production" },
  "dependencies": {
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "@mf-config/shared": "workspace:*"
  }
}
```

```js
// apps/team-checkout/src/index.js
import('./bootstrap');
```

```jsx
// apps/team-checkout/src/bootstrap.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import CheckoutPage from './exposes/CheckoutPage';
if (document.getElementById('root')) {
  ReactDOM.createRoot(document.getElementById('root')).render(<CheckoutPage />);
}
```

```jsx
// apps/team-checkout/src/exposes/CheckoutPage.jsx
import React from 'react';
export default function CheckoutPage() {
  return (
    <div style={{ padding: 16, border: '1px solid #eee' }}>
      <h2>🧾 Checkout（远程模块 @ team-checkout）</h2>
      <p>这里可以放置订单/支付流程，共享的 React / antd / dayjs 由 shared 提供。</p>
    </div>
  );
}
```

`webpack.config.js` 同 §3.2。

### 14.5 本地跑起来

```bash
pnpm install
pnpm dev          # 并行启动 shell@3000 + team-checkout@3001
# 打开 http://localhost:3000
# 点击顶部 "Checkout（远程）"，应能看到 CheckoutPage
```

---

## 15. 小结：生产化清单（上线前逐个勾）

- [ ] **entry 异步**：所有 app 都有 `index.js` → `bootstrap.jsx` 两层；
- [ ] **shared 统一来源**：所有 shared 声明都来自 `@mf-config/shared`；
- [ ] **React 必须 singleton + requiredVersion**；
- [ ] **CI 版本一致性脚本**：`mf:check-versions` 在 `prebuild` 跑；
- [ ] **部署缓存策略**：`remoteEntry.js` no-cache，其余 chunk immutable；
- [ ] **动态/静态远程的 CORS**：remote 域名允许 Host 域名；
- [ ] **远程模块兜底**：ErrorBoundary + Suspense + 超时中断；
- [ ] **Remote 也能独立跑**（每个 Remote 自己的 `public/index.html`）；
- [ ] **埋点/SSO 只在 Host 初始化一次**，Remote 只读；
- [ ] **TypeScript 类型**：用 `@module-federation/typescript` 或手工发布 d.ts 包；
- [ ] **source map + Sentry**：能看到远程模块的调用栈；
- [ ] **灰度/回滚**：`remoteEntry.beta.js` 或 `MF_REMOTE_CHECKOUT` 环境变量支持快速切换 remote。

---

> 模块联邦的"坑"几乎都集中在**shared 版本协商**、**remoteEntry 缓存**、**入口必须异步**三件事上。把它们三个管住，模块联邦就是一个非常顺手的"独立发布 + 按需共享"工具。如果你的团队正在选型，建议先用第 2 档跑 1 个季度，再评估是否上第 3 档动态远程。
