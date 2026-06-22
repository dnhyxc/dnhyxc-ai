# Module Federation 动态远程（Dynamic Remote）生产级详细配置

> **定位**：本文是 [module-federation-production.md](file:///workspace/docs/frontend/module-federation-production.md) 中 "§7 动态远程" 的**单独落地版**。
>
> **目标**：做到"上线一个新的 Remote 应用"只需要：
> 1. 新 Remote 正常构建并部署（出 `remoteEntry.js` + 若干 chunk）；
> 2. 在"路由注册中心"登记一条 JSON 记录（`name / url / exposes / 路由映射`）；
> 3. **Host 应用不改一行代码、不重新构建、不重新发布**——用户刷新页面即生效。
>
> **前提**：所有应用使用 **Webpack 5**；Host 与 Remote 都采用"**运行时拉路由表 + 动态注册**"方案。

---

## 0. 方案全貌（一张图的文字版）

```
 ┌────────────────────────── 浏览器打开 shell.xxx.com ──────────────────────────┐
 │                                                                                │
 │  1) shell/public/index.html ──► shell/js/app.[hash].js                         │
 │     (app.js 里只做一件事：import('./bootstrap.jsx'))                            │
 │                                                                                │
 │  2) bootstrap.jsx 启动                                                         │
 │     ├── 拉 /remote-manifest.json （由 CI 写入 shell/public/）                    │
 │     │    拿到 [{ name: 'checkout',   url: 'https://checkout.xxx.com/remoteEntry.js', routes: [...] },
 │     │          { name: 'userCenter', url: 'https://user.xxx.com/remoteEntry.js',     routes: [...] }]
 │     │
 │     ├── 为每条 remote 动态注入 <script src=url crossorigin=anonymous>           │
 │     ├── window[name] 拿到 MF container，调用 container.init(shareScope)         │
 │     ├── routes 里的 { path, module: './CheckoutPage' } 用 React.lazy 包装       │
 │     └── 塞进 React Router <Routes> 里渲染                                       │
 │                                                                                │
 │  3) 业务代码里一行都不写 import 'checkout/Xxx'，只通过路由/或 useRemote() 用远程  │
 │                                                                                │
 └────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. 目录与文件清单

```
monorepo-root/
├── apps/
│   ├── shell/                         # Host（运行时注册中心的使用方，不写死任何 Remote）
│   │   ├── public/
│   │   │   ├── index.html
│   │   │   └── remote-manifest.json   # ⭐ CI 自动生成（运行时路由表）
│   │   ├── webpack.config.js
│   │   └── src/
│   │        ├── index.js              # 只写一行：import('./bootstrap')
│   │        ├── bootstrap.jsx         # 真正启动（拉 manifest + 注册路由 + ReactDOM.render）
│   │        ├── index.css
│   │        ├── mf/
│   │        │   ├── loadRemote.js         # 注入 script + init container（幂等）
│   │        │   ├── loadRemoteModule.js   # 用 container.get('./Xxx') 拿模块
│   │        │   ├── manifest.js           # 拉 remote-manifest.json
│   │        │   ├── registerRoutes.js     # 把 manifest 转成 React.lazy 路由
│   │        │   └── index.js              # 对外统一 export
│   │        └── components/
│   │            ├── RemoteFallback.jsx    # ErrorBoundary + Suspense 兜底
│   │            └── RemoteRoute.jsx       # 一行组件，统一兜底 & loading
│   │
│   └── team-checkout/                 # Remote A（作为"新 Remote 示例"）
│       ├── webpack.config.js
│       └── src/
│            ├── index.js
│            ├── bootstrap.jsx
│            └── exposes/
│                ├── CheckoutPage.jsx
│                └── PaymentButton.jsx
│
└── packages/
    └── mf-manifest/scripts/generate-manifest.js   # ⭐ CI 用脚本：扫描 apps/* 生成 remote-manifest.json
```

---

## 2. Host 端：webpack 配置（核心差异：不写死任何 Remote）

重点一句话：**`ModuleFederationPlugin.remotes` 里不放任何具体 Remote，而是放一个占位 `_placeholder`，保证 webpack 为 Host 生成"接收远程容器"的共享机制。**

```js
// apps/shell/webpack.config.js
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
    publicPath: 'auto',
    uniqueName: 'shell',
    filename:
      process.env.NODE_ENV === 'production'
        ? 'js/[name].[contenthash:8].js'
        : 'js/[name].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
    clean: true,
  },
  resolve: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        include: path.resolve(__dirname, 'src'),
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'automatic' }],
              ],
            },
          },
        ],
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      {
        test: /\.(png|svg|jpg|jpeg|gif|woff2?)$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/[name].[hash:8][ext]' },
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',

      // ⭐ 重点：不写任何具体 Remote；保留一个"占位"，保证 webpack 生成共享机制
      // 如果你写 `remotes: {}` 或完全不写 remotes，在某些 webpack 5 版本下
      // 运行时不会暴露 `__webpack_init_sharing__ / __webpack_share_scopes__`，
      // 后续动态注册会报 `__webpack_init_sharing__ is not defined`。
      // 用 `_placeholder@about:blank` 可以完美避开。
      remotes: {
        _placeholder: '_placeholder@about:blank',
      },

      // 如果你希望 shell 也被别人 consume（例如把 shell 的 Layout 共享出去）
      // exposes: { './Layout': './src/components/Layout.jsx' },

      shared: shared({
        react: { singleton: true, eager: true, requiredVersion: deps.react },
        'react-dom': { singleton: true, eager: true, requiredVersion: deps['react-dom'] },
        'react-router-dom': { singleton: true, requiredVersion: deps['react-router-dom'] },
        antd: { singleton: true, requiredVersion: deps.antd },
        dayjs: { singleton: true, requiredVersion: deps.dayjs },
        lodash: {},
      }),
    }),
    new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'public/index.html') }),
  ],
  devServer: {
    port: 3000,
    historyApiFallback: true,
    hot: true,
    client: { overlay: { errors: true, warnings: false } },
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
};
```

---

## 3. Host 端：运行时 API（使用方最终调这些函数）

### 3.1 `index.js`（入口必须异步）

```js
// apps/shell/src/index.js
import('./bootstrap');
```

### 3.2 `loadRemote.js`（核心：动态注入 remoteEntry.js 并 init）

```js
// apps/shell/src/mf/loadRemote.js
/**
 * 动态加载一个远程 container。
 *
 * 内部做 3 件事：
 *   1. `__webpack_init_sharing__('default')` 初始化 Host 自己的 shared scope
 *   2. 动态 <script src=url crossorigin=anonymous> 注入
 *   3. 等 window[name] 出现（这就是 remoteEntry 暴露出来的 container）
 *   4. 调 `container.init(__webpack_share_scopes__.default)` 完成 shared 协商
 *
 * 幂等：同一 name 重复调用只注入一次。
 *
 * @param {Object}  opts
 * @param {string}  opts.name      Remote 的容器名（必须与 Remote 端 MF plugin.name 一致）
 * @param {string}  opts.url       remoteEntry.js 的 URL（绝对路径或相对 Host 域名均可）
 * @param {string}  [opts.scope='default']
 * @returns {Promise<Object>}      返回 MF container（后续用 container.get('./Xxx') 取模块）
 */
const INJECTED = new Map(); // name -> Promise<container>

export function loadRemote({ name, url, scope = 'default' }) {
  // 1) 命中缓存直接返回（重复调用不会重复注入）
  if (INJECTED.has(name)) return INJECTED.get(name);

  const task = (async () => {
    // 2) 初始化 shared scope
    await __webpack_init_sharing__(scope);

    // 3) 注入 <script src=url crossorigin=anonymous>
    //    若页面上已有同名 <script data-mf-name=name>，复用（避免重复请求）
    const existingScript = document.querySelector(`script[data-mf-name="${name}"]`);
    if (!existingScript) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-mf-name', name);
        script.onload = () => resolve();
        script.onerror = () =>
          reject(
            new Error(
              `[MF] 远程模块加载失败：${name} (${url})。
可能原因：1) URL 错误；2) 资源未部署；3) 跨域（CORS）。`,
            ),
          );
        document.head.appendChild(script);
      });
    }

    // 4) 拿远程 container（remoteEntry 会把它挂到 window[name]）
    const container = window[name];
    if (!container || (typeof container !== 'object' && typeof container !== 'function')) {
      throw new Error(
        `[MF] 远程 ${name} 加载成功，但 window.${name} 不是合法 container。
请核对 Remote 端 ModuleFederationPlugin.name 与 Host 传入的 name 是否一致。
remoteEntry.js 会把 container 挂到 window[MF_plugin.name] 上。`,
      );
    }

    // 5) 调用 container.init(shareScope) —— 与 Host 完成 shared 协商
    //    webpack 5 标准容器是一个对象 { get, init }。
    //    有些 webpack 版本 / 插件变体，window[name] 是一个 async 函数，调用它再返回 container；
    //    为兼容这种情况，这里做一层 try/catch。
    const realContainer =
      typeof container === 'function' ? await container() : container;

    if (!realContainer || typeof realContainer.init !== 'function') {
      throw new Error(`[MF] 远程 ${name} 的 container 缺少 init 方法`);
    }

    await realContainer.init(__webpack_share_scopes__[scope]);

    // 6) 把真正可用的 container 存到 map
    return realContainer;
  })();

  INJECTED.set(name, task);
  task.catch(() => INJECTED.delete(name)); // 失败后下次还能重试
  return task;
}
```

### 3.3 `loadRemoteModule.js`（真正拿"远程组件"）

```js
// apps/shell/src/mf/loadRemoteModule.js
import { loadRemote } from './loadRemote';

/**
 * 从远程拉取一个 expose 模块。
 *
 * @param {Object} opts
 * @param {string} opts.name    Remote 容器名，例 'checkout'
 * @param {string} opts.url     remoteEntry.js 的 URL
 * @param {string} opts.module  Remote 的 exposes key，**必须以 "./" 开头**，例 './CheckoutPage'
 * @param {string} [opts.scope='default']
 * @returns {Promise<Module>}  返回模块导出对象（通常是 { default: React.Component } 或 { CheckoutPage: fn, ... }）
 */
export async function loadRemoteModule({ name, url, module: modKey, scope = 'default' }) {
  const container = await loadRemote({ name, url, scope });

  if (typeof container.get !== 'function') {
    throw new Error(`[MF] 远程 ${name} 的 container 没有 get 方法`);
  }

  // container.get('./CheckoutPage') 返回一个 Promise<factory function>
  const factory = await container.get(modKey);

  if (typeof factory !== 'function') {
    throw new Error(
      `[MF] 远程 ${name} 的 exposes 中未找到 "${modKey}"。
注意：调用方必须写完整的 "./CheckoutPage"（以 ./ 开头），与 Remote 端 exposes 的 key 完全一致。`,
    );
  }

  // factory() 返回真正的模块对象（与你在 Remote 本地 import 看到的完全一样）
  return factory();
}
```

### 3.4 `manifest.js`（拉"路由注册中心"）

```js
// apps/shell/src/mf/manifest.js
/**
 * 拉取 remote manifest：当前环境下有哪些 Remote 可加载。
 *
 * 文件位置：apps/shell/public/remote-manifest.json
 *   → 构建后会被 CopyWebpackPlugin / 或直接打包进 shell/dist 根目录
 *   → 线上通过 Nginx 的 /remote-manifest.json 就能拿到
 *
 * 推荐的数据结构：
 *
 * {
 *   "version": 1,
 *   "generatedAt": "2025-06-22T10:00:00.000Z",
 *   "remotes": [
 *     {
 *       "name":     "checkout",
 *       "url":      "https://checkout.xxx.com/remoteEntry.js",
 *       "routes":   [{ "path": "/checkout/*", "module": "./CheckoutPage", "title": "结账页" }]
 *     },
 *     {
 *       "name":     "userCenter",
 *       "url":      "https://user.xxx.com/remoteEntry.js",
 *       "routes":   [{ "path": "/user/*", "module": "./ProfilePage", "title": "个人中心" }]
 *     }
 *   ]
 * }
 */
export async function fetchRemoteManifest() {
  try {
    // 加时间戳避免浏览器缓存（manifest 应该每次都拿到最新）
    const res = await fetch(`/remote-manifest.json?_=${Date.now()}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    if (!json || !Array.isArray(json.remotes)) {
      throw new Error('字段 remotes 缺失或格式错误');
    }
    return json;
  } catch (e) {
    console.error('[MF] manifest 拉取失败，动态路由将为空。', e);
    // 返回空数组而非抛错：保证 Host 即使 manifest 挂了也能渲染出主页面
    return { version: 0, generatedAt: new Date().toISOString(), remotes: [] };
  }
}
```

### 3.5 `registerRoutes.js`（把 manifest 转成 React Router 能用的路由对象）

```jsx
// apps/shell/src/mf/registerRoutes.js
import { lazy } from 'react';
import { loadRemoteModule } from './loadRemoteModule';
import { fetchRemoteManifest } from './manifest';

/**
 * 把 manifest 的 remotes 转成 React Router 可用的路由数组。
 *
 * 返回：Promise<{ name, url, routes: [{ path, module, title, Component }] }[]>
 * 其中 Component 是 React.lazy(() => loadRemoteModule(...)) 返回的懒加载组件。
 */
export async function buildRemoteRoutes() {
  const manifest = await fetchRemoteManifest();
  const remotes = manifest.remotes || [];

  return remotes.map((remote) => {
    const routes = (remote.routes || []).map((rt) => {
      const Component = lazy(() =>
        loadRemoteModule({ name: remote.name, url: remote.url, module: rt.module })
          .then((mod) => {
            // 兼容多种导出形态：{ default: Component }、{ CheckoutPage: Component }、
            // 或 module 对象本身就是一个 Component（极少）。
            const component =
              (mod && mod.default) ||
              (mod && Object.values(mod).find((v) => typeof v === 'function')) ||
              (typeof mod === 'function' ? mod : null);

            if (typeof component !== 'function') {
              throw new Error(
                `[MF] 远程 ${remote.name}/${rt.module} 导出的不是可渲染组件。
请检查 Remote 端 exposes 的文件是否导出了一个 React 组件（export default ...）。`,
              );
            }

            return { default: component };
          }),
      );

      return { path: rt.path, title: rt.title, module: rt.module, Component };
    });

    return { name: remote.name, url: remote.url, routes };
  });
}

/**
 * 给"业务代码直接使用某一个远程模块"准备的便捷函数（非路由场景）。
 * 用法：
 *   const PaymentButton = React.lazy(() =>
 *     useRemote({ name: 'checkout', url: 'https://.../remoteEntry.js', module: './PaymentButton' })
 *   );
 */
export function useRemote({ name, url, module: modKey }) {
  return loadRemoteModule({ name, url, module: modKey }).then((mod) => ({
    default: (mod && mod.default) || mod,
  }));
}

/**
 * 统一入口。
 */
export { fetchRemoteManifest, loadRemote, loadRemoteModule } from './index-exports';
```

### 3.6 `mf/index.js`（统一对外 export）

```js
// apps/shell/src/mf/index.js
export { loadRemote } from './loadRemote';
export { loadRemoteModule, useRemote } from './loadRemoteModule';
export { fetchRemoteManifest } from './manifest';
export { buildRemoteRoutes } from './registerRoutes';
```

---

## 4. Host 端：`bootstrap.jsx`（把上面这些连起来）

```jsx
// apps/shell/src/bootstrap.jsx
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { buildRemoteRoutes } from './mf';
import RemoteRoute from './components/RemoteRoute';
import RemoteFallback from './components/RemoteFallback';
import './index.css';

/**
 * 主 App：
 *   - 启动时 await buildRemoteRoutes() 拿到所有远程路由；
 *   - 把每个路由塞进 <Routes>，用 RemoteFallback + RemoteRoute 做 ErrorBoundary + Suspense。
 */
function App() {
  const [remoteRoutes, setRemoteRoutes] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    buildRemoteRoutes().then((routes) => {
      setRemoteRoutes(routes);
      setReady(true);
    });
  }, []);

  if (!ready) return <div>加载中...</div>;

  // 把所有远程 route 展平成 React Router 能用的 <Route> 列表
  const flatRoutes = remoteRoutes.flatMap((remote) =>
    remote.routes.map((rt) => ({
      key: `${remote.name}:${rt.path}`,
      path: rt.path,
      title: rt.title || remote.name,
      remoteName: remote.name,
      Component: rt.Component,
    })),
  );

  return (
    <BrowserRouter>
      <header
        style={{
          padding: 16,
          background: '#001529',
          color: '#fff',
          display: 'flex',
          gap: 24,
        }}
      >
        <Link to="/" style={{ color: '#fff' }}>
          首页
        </Link>
        {flatRoutes.map((r) => (
          <Link key={r.key} to={r.path.replace('/*', '')} style={{ color: '#fff' }}>
            {r.title}
          </Link>
        ))}
      </header>

      <main style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<div>Shell 首页</div>} />

          {flatRoutes.map((r) => (
            <Route
              key={r.key}
              path={r.path}
              element={
                <RemoteFallback remoteName={r.remoteName}>
                  <RemoteRoute>
                    <r.Component />
                  </RemoteRoute>
                </RemoteFallback>
              }
            />
          ))}

          <Route path="*" element={<div>404：未匹配路由</div>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

---

## 5. Host 端：兜底组件（ErrorBoundary + Suspense）

### 5.1 `RemoteFallback.jsx`（ErrorBoundary：远程挂了也不崩主站）

```jsx
// apps/shell/src/components/RemoteFallback.jsx
import React, { Component } from 'react';

export default class RemoteFallback extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 生产环境：上报到监控平台（Sentry / 自研）
    if (typeof window !== 'undefined' && window.__TRACK__?.captureException) {
      window.__TRACK__.captureException(error, {
        extra: { ...info, remote: this.props.remoteName },
      });
    }
    // eslint-disable-next-line no-console
    console.error(`[MF] 远程 ${this.props.remoteName} 渲染报错`, error, info);
  }

  handleRetry = () => {
    // 1) 清错误重新挂载
    // 2) 为防止"模块加载结果被缓存导致重新加载仍然失败"，
    //    失败后强制刷新（简单粗暴但有效）；更精细的做法是清除 MF 内部缓存再重试。
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            border: '1px dashed #f5222d',
            borderRadius: 8,
            background: '#fff1f0',
            color: '#333',
          }}
        >
          <strong>「{this.props.remoteName}」模块加载失败</strong>
          <p style={{ color: '#666', marginTop: 8, wordBreak: 'break-all' }}>
            {this.state.error.message}
          </p>
          <button onClick={this.handleRetry}>刷新重试</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 5.2 `RemoteRoute.jsx`（Suspense：懒加载过程中有个 loading）

```jsx
// apps/shell/src/components/RemoteRoute.jsx
import React, { Suspense } from 'react';

export default function RemoteRoute({ children, fallback = <div>加载中...</div> }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
```

---

## 6. Host 端：`public/remote-manifest.json`（路由注册中心）

这是**运维 / 发布系统与前端团队之间的契约**：

```json
{
  "version": 1,
  "generatedAt": "2025-06-22T10:00:00.000Z",
  "remotes": [
    {
      "name":     "checkout",
      "url":      "https://checkout.xxx.com/remoteEntry.js",
      "routes":   [
        { "path": "/checkout/*",         "module": "./CheckoutPage",  "title": "结账页" },
        { "path": "/checkout/payment",   "module": "./PaymentButton", "title": "支付按钮" }
      ]
    },
    {
      "name":     "userCenter",
      "url":      "https://user.xxx.com/remoteEntry.js",
      "routes":   [{ "path": "/user/*", "module": "./ProfilePage", "title": "个人中心" }]
    }
  ]
}
```

> **规则**：
> - `name` 必须与 Remote 端 `new ModuleFederationPlugin({ name: 'checkout' })` 一致；
> - `module` 必须与 Remote 端 `exposes: { './CheckoutPage': '...' }` 的 key 完全一致（**必须以 `./` 开头**）；
> - `path` 必须是 React Router 能匹配的合法 path（通配用 `/*`）；
> - manifest 自身**不要做浏览器缓存**（见 §8 Nginx 配置）。

---

## 7. Remote 端配置（任何一个"新 Remote"都照着写）

### 7.1 `webpack.config.js`

```js
// apps/team-checkout/webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;
const { shared } = require('@mf-config/shared');
const pkg = require('./package.json');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: path.resolve(__dirname, 'src/index.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'auto',           // ⭐ 关键：不要写死 '/'，用浏览器解析到的 script 路径
    uniqueName: 'checkout',       // 保证多 Remote 之间不会互相污染 runtime
    filename:
      process.env.NODE_ENV === 'production'
        ? 'js/[name].[contenthash:8].js'
        : 'js/[name].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
    clean: true,
  },
  resolve: { extensions: ['.js', '.jsx'] },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        include: path.resolve(__dirname, 'src'),
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'automatic' }],
              ],
            },
          },
        ],
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      // ⭐ name：container 会被挂到 window.checkout
      name: 'checkout',

      // ⭐ remoteEntry 文件名：Host 端 url 写的就是它
      filename: 'remoteEntry.js',

      // ⭐ exposes：对外暴露哪些模块（key 必须以 ./ 开头）
      exposes: {
        './CheckoutPage':  './src/exposes/CheckoutPage.jsx',
        './PaymentButton': './src/exposes/PaymentButton.jsx',
      },

      shared: shared({
        react: { singleton: true, requiredVersion: pkg.dependencies.react },
        'react-dom': { singleton: true, requiredVersion: pkg.dependencies['react-dom'] },
        antd: { singleton: true, requiredVersion: pkg.dependencies.antd },
        dayjs: { singleton: true, requiredVersion: pkg.dependencies.dayjs },
        lodash: {},
      }),
    }),
    new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'public/index.html') }),
  ],
  devServer: {
    port: 3001,
    historyApiFallback: true,
    hot: true,
    // ⭐ 关键：允许 Host 跨域 fetch 本 remoteEntry
    headers: { 'Access-Control-Allow-Origin': '*' },
    client: { overlay: { errors: true, warnings: false } },
  },
};
```

### 7.2 `src/index.js` + `src/bootstrap.jsx`（Remote 端也异步入口）

```js
// apps/team-checkout/src/index.js
import('./bootstrap');
```

```jsx
// apps/team-checkout/src/bootstrap.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import CheckoutPage from './exposes/CheckoutPage';

// 独立开发模式：直接渲染一个开发入口（非必需，但很实用）
// 被 Host 消费时：这段代码也会跑，但 remoteEntry 真正导出的是 exposes 里的文件
if (document.getElementById('root')) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <div style={{ padding: 24 }}>
      <h1>Checkout（独立开发模式）</h1>
      <CheckoutPage />
    </div>,
  );
}
```

### 7.3 `src/exposes/CheckoutPage.jsx`（Remote 真正导出的东西）

```jsx
// apps/team-checkout/src/exposes/CheckoutPage.jsx
import React from 'react';

export default function CheckoutPage() {
  return (
    <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
      <h2>🧾 结账页（来自 team-checkout 远程模块）</h2>
      <p>这里就是你在 checkout 仓库里实现的业务代码。</p>
      <p>
        从 Host 点 `/checkout` 过来时：由 shell 的 React Router 渲染此组件；
        shared 的 React / antd / dayjs 都走 Host 注入的同一份。
      </p>
    </div>
  );
}
```

```jsx
// apps/team-checkout/src/exposes/PaymentButton.jsx
import React from 'react';

export default function PaymentButton({ amount = 0, onPay }) {
  return (
    <button
      onClick={() => onPay && onPay(amount)}
      style={{ padding: '8px 16px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
    >
      支付 {amount > 0 ? `￥${amount}` : ''}
    </button>
  );
}
```

---

## 8. Nginx 部署配置（让整个方案"线上跑通"）

### 8.1 Host（shell.xxx.com）

```nginx
server {
  listen 443 ssl http2;
  server_name shell.xxx.com;

  root /var/www/shell;
  index index.html;

  # ⭐ manifest：禁止缓存（它就是运行时路由表）
  location = /remote-manifest.json {
    add_header Cache-Control 'no-cache, no-store, must-revalidate, max-age=0';
    add_header Pragma 'no-cache';
    add_header Expires '0';
    try_files $uri =404;
  }

  # 构建产物：长缓存 + immutable
  location /js/ {
    expires 1y;
    add_header Cache-Control 'public, max-age=31536000, immutable';
    try_files $uri =404;
  }
  location /css/ {
    expires 1y;
    add_header Cache-Control 'public, max-age=31536000, immutable';
    try_files $uri =404;
  }
  location /assets/ {
    expires 1y;
    add_header Cache-Control 'public, max-age=31536000, immutable';
    try_files $uri =404;
  }

  # 其他所有路径（含 /checkout/*）fallback 到 index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### 8.2 Remote（checkout.xxx.com）

```nginx
server {
  listen 443 ssl http2;
  server_name checkout.xxx.com;

  root /var/www/checkout;
  index index.html;

  # ⭐ remoteEntry：禁止缓存（新 Remote 上线要立即生效）
  location = /remoteEntry.js {
    add_header Cache-Control 'no-cache, no-store, must-revalidate, max-age=0';
    add_header Pragma 'no-cache';
    add_header Expires '0';
    # ⭐ 必须允许 Host 跨域访问它
    add_header Access-Control-Allow-Origin 'https://shell.xxx.com' always;
    add_header Access-Control-Allow-Credentials 'true';
    if ($request_method = OPTIONS) { return 204; }
    try_files $uri =404;
  }

  # 业务 chunk：长缓存 + immutable（hash 变化会自动失效）
  location /js/ {
    expires 1y;
    add_header Cache-Control 'public, max-age=31536000, immutable';
    add_header Access-Control-Allow-Origin 'https://shell.xxx.com' always;
    try_files $uri =404;
  }
  location /css/ {
    expires 1y;
    add_header Cache-Control 'public, max-age=31536000, immutable';
    add_header Access-Control-Allow-Origin 'https://shell.xxx.com' always;
    try_files $uri =404;
  }

  # 独立访问 checkout.xxx.com 时（开发/调试）
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

---

## 9. CI 自动生成 manifest 的脚本（上线"新 Remote"的流程）

```js
// packages/mf-manifest/scripts/generate-manifest.js
/**
 * 运行方式（CI 里 shell 构建完之后跑一次）：
 *   node packages/mf-manifest/scripts/generate-manifest.js --out apps/shell/public/remote-manifest.json
 *
 * 它做两件事：
 *   1) 读取一份"预定义的 Remote 列表"（可以从配置中心 / JSON 文件读）
 *   2) 生成标准的 remote-manifest.json，并写到 shell 的 public 目录下
 *
 * 实际项目里你可以做得更"自动化"：
 *   - 在发布中心每一个 Remote 发布成功后，注册自己到 manifest
 *   - 由一个"配置服务"统一提供 manifest，shell 请求的是那个服务而非静态文件
 */
const fs = require('fs');
const path = require('path');

// 这个数组可以来自：1) 配置中心 API；2) 一份集中管理的 JSON；3) 本脚本扫描 apps/* 自动汇总
const REMOTES = [
  {
    name: 'checkout',
    url: 'https://checkout.xxx.com/remoteEntry.js',
    routes: [
      { path: '/checkout/*', module: './CheckoutPage',  title: '结账页' },
      { path: '/checkout/pay', module: './PaymentButton', title: '支付按钮' },
    ],
  },
  {
    name: 'userCenter',
    url: 'https://user.xxx.com/remoteEntry.js',
    routes: [{ path: '/user/*', module: './ProfilePage', title: '个人中心' }],
  },
];

function main() {
  // 解析 --out 参数
  let outPath = 'apps/shell/public/remote-manifest.json';
  const idx = process.argv.indexOf('--out');
  if (idx >= 0 && process.argv[idx + 1]) outPath = process.argv[idx + 1];

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    remotes: REMOTES,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('[MF] manifest 已生成 ->', outPath, `（共 ${REMOTES.length} 个 remote）`);
}

main();
```

使用方式：

```bash
# 1) 发布 Remote 应用（正常 CI/CD）
# 2) 在 Host 应用构建时跑一次 manifest 生成：
node packages/mf-manifest/scripts/generate-manifest.js \
     --out apps/shell/public/remote-manifest.json

# 3) 构建 shell：
#    npm --workspace=shell run build
```

> 如果你希望"连 Host 都不需要重新构建就能上线新 Remote"，把 manifest 改成**由发布中心单独部署到 CDN 的 `/remote-manifest.json`**（不要塞进 shell 的 dist）。Host 启动时 fetch `https://mf-registry.xxx.com/remote-manifest.json`，即可做到"新增 Remote 不用改 Host 代码也不用重构建"。

---

## 10. 业务代码里"真正使用一个远程模块"的两种方式

### 10.1 方式 A：走路由（推荐 90% 场景）

**你一行都不用改**——只要在 manifest 里加一条 `routes[{ path, module, title }]`，Host 启动后会自动注册路由。

用户点菜单（顶部的 `Link`）或直接访问 `/checkout/xxx`，就能进入远程模块。

### 10.2 方式 B：在某组件内部手动 import 一个远程模块（组件级共享）

例如：在 Host 的订单详情页里嵌入一个远程的 "PaymentButton"。

```jsx
// apps/shell/src/views/OrderDetail.jsx
import React, { lazy } from 'react';
import RemoteFallback from '../components/RemoteFallback';
import RemoteRoute from '../components/RemoteRoute';

// 用法 1：React.lazy + Suspense
const PaymentButton = lazy(() =>
  import('../mf').then(async ({ useRemote }) => {
    const mod = await useRemote({
      name: 'checkout',
      url: 'https://checkout.xxx.com/remoteEntry.js',
      module: './PaymentButton',
    });
    return { default: mod.default };
  }),
);

// 更推荐的写法：抽成一个"远程组件加载器"
export default function OrderDetail() {
  return (
    <div>
      <h1>订单详情</h1>
      <p>下面的按钮来自 checkout 远程模块。</p>

      <RemoteFallback remoteName="checkout/PaymentButton">
        <RemoteRoute>
          <PaymentButton amount={199} onPay={(amount) => alert(`模拟支付 ${amount}`)} />
        </RemoteRoute>
      </RemoteFallback>
    </div>
  );
}
```

> 如果你嫌每次写 `useRemote({...})` 麻烦，可以再包一层业务 Hook：
>
> ```js
> // apps/shell/src/hooks/useRemoteCheckoutComponent.js
> import { lazy } from 'react';
> import { useRemote } from '../mf';
> export function usePaymentButton() {
>   return lazy(() => useRemote({
>     name: 'checkout',
>     url: 'https://checkout.xxx.com/remoteEntry.js',
>     module: './PaymentButton',
>   }));
> }
> ```

---

## 11. 典型坑 & 排查速查（真正落地时常遇到的 10 个问题）

| # | 现象 | 根因（最常见） | 解决 |
|---|------|----------------|------|
| 1 | `__webpack_init_sharing__ is not defined` | Host 端完全没写 `remotes`，webpack 没生成 shared 接收机制 | 在 `ModuleFederationPlugin` 的 `remotes` 里加一条 `_placeholder: '_placeholder@about:blank'` 占位 |
| 2 | `ScriptExternalLoadError: Loading script failed.` / `<script>` 404 | remoteEntry.js 的 URL 写错 / CDN 没部署 | 核对 manifest 中的 `url` 能直接浏览器打开 |
| 3 | CORS 报错 `Access to fetch ... from origin 'https://shell.xxx.com' has been blocked by CORS policy` | Remote 的 Nginx 没配 `Access-Control-Allow-Origin` | 在 Remote 的 Nginx 为 `remoteEntry.js`、`js/`、`css/` 加 CORS 头；本地 devServer 也加 `headers: { 'Access-Control-Allow-Origin': '*' }` |
| 4 | `container.get('./Xxx')` 抛 `module not found` | manifest 里的 `module` 与 Remote `exposes` 的 key 不一致（缺 `./`） | 核对 Remote exposes key 与 Host 传入的 `module` 完全一致（都以 `./` 开头） |
| 5 | 渲染时报 `Invalid hook call. Hooks can only be called inside of the body of a function component` | 运行时出现两份 React（Host 一份，Remote 又一份） | 检查所有应用的 `react/react-dom` 是否都声明了 `singleton: true + requiredVersion`；CI 要跑 `mf:check-versions` 保证版本一致 |
| 6 | 刷新 `/checkout/xxx` 404 | Nginx 没把 `/checkout/*` 这种 path fall back 到 `index.html` | Host 的 Nginx 必须有 `location / { try_files $uri $uri/ /index.html; }` |
| 7 | 刷新后样式错乱（CSS 路径 404） | `output.publicPath` 没配 `auto`，Remote 的 chunk URL 被拼成了 `shell.xxx.com/js/checkout.hash.js` | Remote 端 `output.publicPath: 'auto'`（webpack 5 的默认推荐） |
| 8 | 新版本 Remote 上线后，用户还在用旧 remoteEntry（典型事故） | remoteEntry.js 被浏览器长缓存 | Remote 端 Nginx 为 `remoteEntry.js` 单独配 `Cache-Control: no-cache`；其他 chunk 保持 contenthash + immutable |
| 9 | 远程组件内部用了 antd / 主题变量，但页面上没样式 | antd 的 CSS 没被 Host 正确加载（Remote 用 CSS-in-JS 或由 Host 统一引入 antd.min.css 两种思路均可） | 推荐二选一：1) Host 统一 `import 'antd/dist/antd.min.css'`；2) Remote 把 antd 写 `singleton: true`，并在 exposes 的组件里 `import './styles.css'` |
| 10 | `uniqueName collision` 警告或多 Remote 互相污染 | 多个应用的 `output.uniqueName` 没区分 | 每个应用的 webpack output.uniqueName 都不同 |

---

## 12. 完整"新 Remote 上线" checklist（照着走一遍就能出结果）

- [ ] 在 `apps/team-xxx/` 下新建一个应用（React 或 Vue 都可以，只要 webpack 5）；
- [ ] `webpack.config.js` 里 `new ModuleFederationPlugin({ name, filename: 'remoteEntry.js', exposes, shared })`；
- [ ] `output.publicPath = 'auto'`、`output.uniqueName = 'xxx'`；
- [ ] `src/index.js` 只有一行：`import('./bootstrap')`；
- [ ] `src/exposes/` 下写真正要对外暴露的组件（`export default function XxxPage() {...}`）；
- [ ] `devServer.headers['Access-Control-Allow-Origin'] = '*'`；
- [ ] 部署到 CDN / Nginx 下，保证：
  - `remoteEntry.js`：`Cache-Control: no-cache` + CORS 头；
  - `js/*`、`css/*`：长缓存 + CORS 头；
- [ ] 在 manifest 里加一条：`{ "name": "xxx", "url": "https://xxx.xxx.com/remoteEntry.js", "routes": [...] }`；
- [ ] 重新部署 manifest（或让配置中心更新它）—— **不需要重构建 Host**；
- [ ] 打开 `shell.xxx.com/xxx/...` 验证能访问并渲染正常；
- [ ] 打开 DevTools Console，确认没有 `[MF]` 报错或 `Invalid hook call`；
- [ ] 在 `RemoteFallback.componentDidCatch` 里写一个"模拟失败"测试——把 remoteEntry 的 URL 改一个不存在的路径刷新一次，验证"主站不崩、只兜底一个红色框"。

---

## 13. 更激进的做法：manifest 改为"配置中心接口 + 热更新"

如果你的团队有一个现成的配置中心（Nacos / Apollo / Consul / JSON API 等），可以把 manifest 改成配置中心接口，然后在 Host 里加一个"定时轮询 + 路由热更新"：

```jsx
// apps/shell/src/bootstrap.jsx（节选）
useEffect(() => {
  let cancelled = false;
  (async function loop() {
    while (!cancelled) {
      const routes = await buildRemoteRoutes();
      setRemoteRoutes(routes);
      await new Promise((r) => setTimeout(r, 60_000)); // 每 60 秒轮询一次
    }
  })();
  return () => { cancelled = true; };
}, []);
```

这样"上线一个新 Remote"只需要：
1. Remote 正常部署；
2. 配置中心加一条路由记录；
3. **最多 60 秒后**，所有在线用户的 Host 应用会自动注册新路由并可用（连刷新都不需要）。

---

> **小结**：
> 动态远程方案的"魔法"只有三件事——`remotes: { _placeholder }` 保证 Host 有接收容器的机制；`fetch('/remote-manifest.json')` 在运行时拿到路由表；`loadRemote + container.get('./Xxx')` 懒加载真正的组件。
>
> 其余都是工程化：
> Nginx CORS + 缓存策略、manifest 生成流程、ErrorBoundary + Suspense 兜底、CI 版本一致性检查、监控上报。
>
> 把这些都做齐，你就能真的做到"**新 Remote 发布，Host 不重构建，刷新即可用**"。
