# Module Federation 动态远程（Dynamic Remote）生产级方案

> **适用场景**：多团队协同开发的巨石应用拆分，多技术栈并存（React + Vue），需要独立发布、独立部署、热插拔注册。
>
> **核心能力**：新远程应用上线 → 只改配置文件 → Host 应用不重构建、不重部署 → 用户刷新即生效。

---

## 1. 整体架构一览

```
┌─────────────────────────────────────── Shell (Host) ───────────────────────────────────────┐
│ 入口: index.js → import('./bootstrap')                                                        │
│ 启动: bootstrap.jsx → fetch('/remote-manifest.json') → 动态 <script src=remoteEntry.js>       │
│                                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                            │
│  │  React 子应用 A  │  │   Vue 子应用 B    │  │  独立业务组件  │                            │
│  │  (Remote)       │  │   (Remote)       │  │  (Remote)       │                            │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘                            │
│             ↑                         ↑                        ↑                              │
│             │ remoteEntry.js          │ remoteEntry.js          │ remoteEntry.js             │
│             │                         │                         │                              │
└─────────────┼─────────────────────────┼─────────────────────────┼──────────────────────────────┘
              │                         │                         │
        ┌────────────┐           ┌────────────┐           ┌────────────┐
        │ checkout.  │           │ user.xxx.com │           │ product.   │
        │ xxx.com    │           │              │           │ xxx.com    │
        └────────────┘           └────────────┘           └────────────┘
```

---

## 2. 目录结构（Monorepo）

```
monorepo-root/
├── package.json                          # workspace 定义
├── pnpm-workspace.yaml
├── turbo.json                            # 构建编排
│
├── apps/
│   ├── shell/                           # ⭐ Host 应用（必须）
│   │   ├── package.json
│   │   ├── webpack.config.js
│   │   ├── public/
│   │   │   ├── index.html
│   │   │   └── remote-manifest.json     # 运行时路由表（CI 生成）
│   │   └── src/
│   │       ├── index.js                  # 入口：异步 bootstrap
│   │       ├── bootstrap.jsx             # 真正启动
│   │       ├── mf/                       # Module Federation 核心逻辑
│   │       │   ├── loadRemote.js         # 动态 <script> + init
│   │       │   ├── loadRemoteModule.js   # container.get()
│   │       │   ├── manifest.js           # fetch manifest
│   │       │   ├── registerRoutes.js     # 构建路由对象
│   │       │   └── index.js              # 统一导出
│   │       ├── components/
│   │       │   ├── RemoteFallback.jsx    # ErrorBoundary
│   │       │   └── RemoteRoute.jsx       # Suspense 加载器
│   │       └── index.css
│   │
│   ├── team-checkout/                   # 远程应用 A（React）
│   │   ├── package.json
│   │   ├── webpack.config.js
│   │   ├── public/index.html
│   │   └── src/
│   │       ├── index.js
│   │       ├── bootstrap.jsx
│   │       └── exposes/
│   │           ├── CheckoutPage.jsx
│   │           └── PaymentButton.jsx
│   │
│   └── team-user/                       # 远程应用 B（Vue 示例）
│       ├── package.json
│       ├── webpack.config.js
│       ├── public/index.html
│       └── src/
│           ├── index.js
│           ├── bootstrap.js
│           └── exposes/
│               ├── ProfilePage.vue
│               └── UserAvatar.vue
│
└── packages/
    ├── mf-config/                        # 公共 shared 配置
    │   └── src/shared.js
    └── mf-manifest/                      # CI 脚本生成 manifest
        └── scripts/generate-manifest.js
```

---

## 3. 基础依赖版本

```json
// apps/shell/package.json
{
  "name": "shell",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "webpack serve --mode development",
    "build": "webpack --mode production",
    "mf:gen-manifest": "node ../../packages/mf-manifest/scripts/generate-manifest.js --out public/remote-manifest.json"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0"
  },
  "devDependencies": {
    "@babel/core": "^7.23.0",
    "@babel/preset-env": "^7.23.0",
    "@babel/preset-react": "^7.22.0",
    "babel-loader": "^9.1.3",
    "html-webpack-plugin": "^5.5.3",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "webpack-dev-server": "^4.15.0",
    "css-loader": "^6.8.1",
    "style-loader": "^3.3.3"
  }
}
```

```json
// apps/team-checkout/package.json（Remote）
{
  "name": "team-checkout",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "webpack serve --mode development --port 3001",
    "build": "webpack --mode production"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@babel/core": "^7.23.0",
    "@babel/preset-env": "^7.23.0",
    "@babel/preset-react": "^7.22.0",
    "babel-loader": "^9.1.3",
    "html-webpack-plugin": "^5.5.3",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "webpack-dev-server": "^4.15.0"
  }
}
```

---

## 4. Host 应用（Shell）完整配置

### 4.1 webpack.config.js

```js
// apps/shell/webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;
const pkg = require('./package.json');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: path.resolve(__dirname, 'src/index.js'),

  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'auto',                              // ⭐ 关键
    uniqueName: 'shell',
    filename: process.env.NODE_ENV === 'production'
      ? 'js/[name].[contenthash:8].js'
      : 'js/[name].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
    clean: true,
  },

  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
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
            presets: [
              '@babel/preset-env',
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        }],
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
      filename: 'remoteEntry.js',

      // ⭐⭐⭐ 动态远程核心：写一个占位
      // 为什么需要它？webpack 5 只有在 plugins 中看到 ModuleFederationPlugin
      // 且至少声明过 remotes/exposes/shared 时，才会在运行时暴露
      // `__webpack_init_sharing__` / `__webpack_share_scopes__` 全局函数。
      // 留一个占位远程确保这些 API 存在。
      remotes: {
        _placeholder: '_placeholder@about:blank',
      },

      // ⭐ shared：所有远程都会和 Host 共用的库
      shared: {
        react: {
          singleton: true,
          eager: true,                            // 立即加载
          requiredVersion: pkg.dependencies.react,
        },
        'react-dom': {
          singleton: true,
          eager: true,
          requiredVersion: pkg.dependencies['react-dom'],
        },
        'react-router-dom': {
          singleton: true,
          requiredVersion: pkg.dependencies['react-router-dom'],
        },
      },
    }),

    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public/index.html'),
      inject: 'body',
    }),
  ],

  devServer: {
    port: 3000,
    historyApiFallback: true,
    hot: true,
    client: { overlay: { errors: true, warnings: false } },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    static: {
      directory: path.resolve(__dirname, 'public'),
    },
  },
};
```

### 4.2 src/index.js（异步入口）

```js
// apps/shell/src/index.js
// 只有一行：把真正启动代码放到 bootstrap.jsx 里，让 Module Federation 有时间
// 完成 shared scope 的协商。这是官方规定的写法。
import('./bootstrap');
```

### 4.3 src/bootstrap.jsx（应用启动）

```jsx
// apps/shell/src/bootstrap.jsx
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from 'react-router-dom';
import { buildRemoteRoutes } from './mf';
import RemoteFallback from './components/RemoteFallback';
import RemoteRoute from './components/RemoteRoute';
import './index.css';

function App() {
  const [remoteRoutes, setRemoteRoutes] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    buildRemoteRoutes().then((routes) => {
      setRemoteRoutes(routes);
      setReady(true);
    });
  }, []);

  // 展平成路由数组
  const flatRoutes = remoteRoutes.flatMap((remote) =>
    remote.routes.map((rt) => ({
      key: `${remote.name}:${rt.path}`,
      path: rt.path,
      title: rt.title || remote.name,
      remoteName: remote.name,
      Component: rt.Component,
    })),
  );

  if (!ready) {
    return <div style={{ padding: 24 }}>加载路由配置...</div>;
  }

  return (
    <BrowserRouter>
      <header style={headerStyle}>
        <Link to="/" style={linkStyle}>
          首页
        </Link>
        {flatRoutes.map((r) => (
          <Link key={r.key} to={r.path.replace('/*', '')} style={linkStyle}>
            {r.title}
          </Link>
        ))}
      </header>

      <main style={{ padding: 24 }}>
        <Routes>
          <Route path="/" element={<HomePage remoteCount={remoteRoutes.length} />} />

          {/* 动态注册的远程路由 */}
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

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

// --- 首页 & 404 ---
function HomePage({ remoteCount }) {
  return (
    <div>
      <h1>🏠 Shell 主站</h1>
      <p>目前已注册 {remoteCount} 个远程应用。</p>
      <p>点击顶部菜单即可跳转到远程应用。远程应用无需重启 Shell，只要修改 manifest 即可。</p>
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div>
      <h2>404：路由不存在</h2>
      <button onClick={() => navigate('/')}>返回首页</button>
    </div>
  );
}

// --- 样式（简单起见直接写 inline）---
const headerStyle = {
  display: 'flex',
  gap: 24,
  padding: 16,
  background: '#001529',
  color: '#fff',
};
const linkStyle = { color: '#fff', textDecoration: 'none' };

// --- 启动 ---
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

### 4.4 src/mf/loadRemote.js（动态注入 script）

```js
// apps/shell/src/mf/loadRemote.js
/**
 * 以幂等方式加载一个远程 remoteEntry.js，完成 shared scope 协商。
 *
 * @param {Object} opts
 * @param {string} opts.name    远程容器名，必须与 Remote 端的
 *                               `new ModuleFederationPlugin({ name: 'xxx' })` 完全一致
 * @param {string} opts.url     远程 remoteEntry.js 的 URL
 * @param {string} [opts.scope='default']
 * @returns {Promise<Object>} 返回 MF container：{ get: (module) => Promise<factory> }
 */
const INJECTED = new Map(); // name -> Promise<container>

export async function loadRemote({ name, url, scope = 'default' }) {
  if (INJECTED.has(name)) return INJECTED.get(name);

  const task = (async () => {
    // 1. 初始化 shared scope（让远程和 Host 的 shared 模块可以被互相发现）
    await __webpack_init_sharing__(scope);

    // 2. 查找已有 <script> 或创建新的
    let script = document.querySelector(`script[data-mf-name="${name}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.setAttribute('data-mf-name', name);
      document.head.appendChild(script);

      await new Promise((resolve, reject) => {
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', () => reject(new Error(`加载 ${name} (${url}) 失败`)), { once: true });
      });
    }

    // 3. 拿到 container
    const container = window[name];
    if (!container || typeof container !== 'object') {
      throw new Error(
        `远程 ${name} 的 remoteEntry.js 加载成功，但 window.${name} 不是合法容器。
请检查 Remote 端 ModuleFederationPlugin.name 是否为 "${name}"。`,
      );
    }

    // 4. 初始化 container —— 把它的 shared 和 Host 的 shared 做协商
    if (typeof container.init === 'function') {
      await container.init(__webpack_share_scopes__[scope]);
    }

    return container;
  })();

  INJECTED.set(name, task);
  task.catch(() => INJECTED.delete(name));
  return task;
}
```

### 4.5 src/mf/loadRemoteModule.js（真正拿组件）

```js
// apps/shell/src/mf/loadRemoteModule.js
import { loadRemote } from './loadRemote';

/**
 * 加载远程模块（通常是 React 组件）。
 *
 * @param {Object} opts
 * @param {string} opts.name    远程容器名
 * @param {string} opts.url     remoteEntry.js 的 URL
 * @param {string} opts.module  exposes 的 key（必须以 ./ 开头，如 './CheckoutPage'）
 * @returns {Promise<Object>} 返回 exposes 文件的 module（通常 { default: Component }）
 */
export async function loadRemoteModule({ name, url, module: modKey }) {
  const container = await loadRemote({ name, url });

  if (typeof container.get !== 'function') {
    throw new Error(`远程 ${name} 容器没有 get() 方法`);
  }

  try {
    const factory = await container.get(modKey);
    if (typeof factory !== 'function') {
      throw new Error(`模块不是工厂函数`);
    }
    return factory();
  } catch (err) {
    throw new Error(
      `远程 ${name} 没有 exposes 模块 "${modKey}"（注意必须以 ./ 开头）。
原错误: ${err.message}`,
    );
  }
}

/**
 * 业务侧更友好的 API：返回 { default: Component }，React.lazy 可直接用。
 */
export async function useRemote({ name, url, module: modKey }) {
  const mod = await loadRemoteModule({ name, url, module: modKey });
  const component = mod?.default || mod || Object.values(mod || {})[0];
  if (typeof component !== 'function') {
    throw new Error(`${name}/${modKey} 导出的不是可渲染组件`);
  }
  return { default: component };
}
```

### 4.6 src/mf/manifest.js（获取运行时路由表）

```js
// apps/shell/src/mf/manifest.js
/**
 * 拉取 remote manifest。
 *
 * 文件结构（apps/shell/public/remote-manifest.json 或外部 URL）：
 * {
 *   "version": 1,
 *   "remotes": [
 *     {
 *       "name":    "checkout",
 *       "url":     "http://localhost:3001/remoteEntry.js",
 *       "routes": [
 *         { "path": "/checkout/*", "module": "./CheckoutPage", "title": "结账页" },
 *         { "path": "/checkout/pay", "module": "./PaymentButton", "title": "支付按钮" }
 *       ]
 *     }
 *   ]
 * }
 */
const DEFAULT_MANIFEST_PATH = '/remote-manifest.json';

export async function fetchRemoteManifest(manifestUrl = DEFAULT_MANIFEST_PATH) {
  try {
    const res = await fetch(`${manifestUrl}?_t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!json || !Array.isArray(json.remotes)) {
      throw new Error(`缺少 remotes 数组`);
    }

    return json;
  } catch (err) {
    console.error('[MF] manifest 拉取失败：', err.message);
    return { version: 0, generatedAt: new Date().toISOString(), remotes: [] };
  }
}
```

### 4.7 src/mf/registerRoutes.js（注册成 React Router 可用对象）

```jsx
// apps/shell/src/mf/registerRoutes.js
import React, { lazy } from 'react';
import { loadRemoteModule, useRemote } from './loadRemoteModule';
import { fetchRemoteManifest } from './manifest';

/**
 * 把 manifest 转成 React Router 可用的路由对象数组。
 *
 * 返回：Promise<[{ name, url, routes: [{ path, module, title, Component }] }]>
 */
export async function buildRemoteRoutes(manifestUrl) {
  const manifest = await fetchRemoteManifest(manifestUrl);
  const remotes = manifest.remotes || [];

  return remotes.map((remote) => {
    const routes = (remote.routes || []).map((rt) => {
      const Component = lazy(() => useRemote({ name: remote.name, url: remote.url, module: rt.module }));
      return { path: rt.path, title: rt.title, module: rt.module, Component };
    });

    return { name: remote.name, url: remote.url, routes };
  });
}

export { loadRemote, loadRemoteModule, useRemote, fetchRemoteManifest };
```

### 4.8 src/mf/index.js（统一导出）

```js
// apps/shell/src/mf/index.js
export * from './loadRemote';
export * from './loadRemoteModule';
export * from './manifest';
export * from './registerRoutes';
```

### 4.9 src/components/RemoteFallback.jsx（ErrorBoundary）

```jsx
// apps/shell/src/components/RemoteFallback.jsx
import React, { Component } from 'react';

/**
 * 微前端最关键的安全网：任何远程模块的错误只会被隔离到这一层，不会让整个 Shell 崩。
 */
export default class RemoteFallback extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[MF] 远程 ${this.props.remoteName} 报错：`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            border: '1px dashed #f5222d',
            borderRadius: 8,
            background: '#fff1f0',
            color: '#222',
          }}
        >
          <strong>「{this.props.remoteName}」模块加载失败</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, color: '#666' }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 4.10 src/components/RemoteRoute.jsx（Suspense）

```jsx
// apps/shell/src/components/RemoteRoute.jsx
import React, { Suspense } from 'react';

export default function RemoteRoute({ children, fallback }) {
  return (
    <Suspense fallback={fallback || <div style={{ padding: 24 }}>加载中...</div>}>
      {children}
    </Suspense>
  );
}
```

### 4.11 src/index.css

```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #222;
}
* { box-sizing: border-box; }
```

### 4.12 public/index.html

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shell 主站</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

### 4.13 Shell 端的环境变量（process.env 注入，让 URL 可配置）

webpack 5 推荐用 `EnvironmentPlugin`（或 `DefinePlugin`）注入 `process.env.xxx`。关键点：
- **不要把 URL 写死在代码里**，这样本地/测试/生产可以指向不同的远程地址；
- `MF_MANIFEST_URL` 支持"把 manifest 放到配置中心/独立 CDN"，实现彻底的零发布。

```js
// apps/shell/webpack.config.js（在 plugins 数组追加）
new webpack.EnvironmentPlugin({
  NODE_ENV: 'development',

  // manifest 地址：默认走同源 /remote-manifest.json，
  // 生产可以改成 https://config.xxx.com/mf/manifest.json
  MF_MANIFEST_URL: '/remote-manifest.json',

  // 是否在首次渲染时就开始预加载所有远程 remoteEntry
  MF_PRELOAD_ALL: 'false',

  // 单个远程的兜底 URL（可选——如果你想在 manifest 挂掉时仍能加载核心模块）
  REMOTE_CHECKOUT_URL: 'http://localhost:3001/remoteEntry.js',
  REMOTE_USER_URL:     'http://localhost:3002/remoteEntry.js',
}),
```

对应的 `.env.development` / `.env.production`：

```dotenv
# apps/shell/.env.development
MF_MANIFEST_URL=/remote-manifest.json
MF_PRELOAD_ALL=false
REMOTE_CHECKOUT_URL=http://localhost:3001/remoteEntry.js
REMOTE_USER_URL=http://localhost:3002/remoteEntry.js
```

```dotenv
# apps/shell/.env.production
MF_MANIFEST_URL=https://config.xxx.com/mf/manifest.json
MF_PRELOAD_ALL=true
REMOTE_CHECKOUT_URL=https://checkout.xxx.com/remoteEntry.js
REMOTE_USER_URL=https://user.xxx.com/remoteEntry.js
```

> **CI 里怎么用？** `cross-env MF_MANIFEST_URL=https://... npm run build` 或在 Dockerfile 里 `ENV MF_MANIFEST_URL=...`，都可以。

对应的 `src/mf/manifest.js` 最终版（读环境变量 + 失败降级）：

```js
// apps/shell/src/mf/manifest.js（最终版）
const DEFAULT_MANIFEST_PATH =
  (typeof process !== 'undefined' && process.env && process.env.MF_MANIFEST_URL) ||
  '/remote-manifest.json';

/**
 * 兜底远程列表（当 manifest 完全不可用时，保证核心模块仍可运行）。
 * 可以留空——视业务需要而定。
 */
const FALLBACK_REMOTES = [
  {
    name: 'checkout',
    url: process.env.REMOTE_CHECKOUT_URL,
    routes: [{ path: '/checkout/*', module: './CheckoutPage', title: '结账页' }],
  },
];

export async function fetchRemoteManifest(manifestUrl = DEFAULT_MANIFEST_PATH) {
  try {
    const res = await fetch(`${manifestUrl}?_t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!json || !Array.isArray(json.remotes)) {
      throw new Error(`缺少 remotes 数组`);
    }

    return json;
  } catch (err) {
    console.warn('[MF] manifest 拉取失败，使用降级配置：', err.message);
    return {
      version: 0,
      generatedAt: new Date().toISOString(),
      remotes: FALLBACK_REMOTES,
    };
  }
}
```

### 4.14 public/remote-manifest.json（⭐ 运行时路由表）

```json
{
  "version": 1,
  "generatedAt": "2024-11-22T10:00:00.000Z",
  "remotes": [
    {
      "name":     "checkout",
      "url":      "http://localhost:3001/remoteEntry.js",
      "routes": [
        { "path": "/checkout/*",         "module": "./CheckoutPage",  "title": "结账页" },
        { "path": "/checkout/pay",       "module": "./PaymentButton", "title": "支付按钮" }
      ]
    },
    {
      "name":     "userCenter",
      "url":      "http://localhost:3002/remoteEntry.js",
      "routes": [
        { "path": "/user/*",             "module": "./ProfilePage",   "title": "用户中心" }
      ]
    }
  ]
}
```

---

## 5. 远程应用 A：team-checkout（React）

### 5.1 webpack.config.js

```js
// apps/team-checkout/webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;
const pkg = require('./package.json');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: path.resolve(__dirname, 'src/index.js'),

  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'auto',
    uniqueName: 'checkout',                              // ⭐ 不同应用要不同
    filename: process.env.NODE_ENV === 'production'
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
        use: [{
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            presets: [
              '@babel/preset-env',
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        }],
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },

  plugins: [
    new ModuleFederationPlugin({
      name: 'checkout',                                   // ⭐ 必须和 manifest 的 name 一致
      filename: 'remoteEntry.js',                         // ⭐ Host 请求的就是它
      exposes: {
        './CheckoutPage':  './src/exposes/CheckoutPage.jsx',
        './PaymentButton': './src/exposes/PaymentButton.jsx',
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: pkg.dependencies.react,
        },
        'react-dom': {
          singleton: true,
          requiredVersion: pkg.dependencies['react-dom'],
        },
      },
    }),

    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public/index.html'),
    }),
  ],

  devServer: {
    port: 3001,
    historyApiFallback: true,
    hot: true,
    client: { overlay: { errors: true, warnings: false } },
    headers: { 'Access-Control-Allow-Origin': '*' },          // ⭐ 允许 Shell 跨域请求
  },
};
```

### 5.2 src/index.js

```js
// apps/team-checkout/src/index.js
import('./bootstrap');
```

### 5.3 src/bootstrap.jsx

```jsx
// apps/team-checkout/src/bootstrap.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import CheckoutPage from './exposes/CheckoutPage';

// 独立开发模式：直接渲染 checkout（非必需，但非常实用）
if (document.getElementById('root')) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <div style={{ padding: 24 }}>
      <h1>Checkout（独立开发模式）</h1>
      <CheckoutPage />
    </div>,
  );
}
```

### 5.4 src/exposes/CheckoutPage.jsx

```jsx
// apps/team-checkout/src/exposes/CheckoutPage.jsx
import React, { useState } from 'react';

export default function CheckoutPage() {
  const [qty, setQty] = useState(1);
  return (
    <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
      <h2>🧾 CheckoutPage（来自 checkout 远程模块）</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setQty(qty > 0 ? qty - 1 : 0)}>-</button>
        <span>数量: {qty}</span>
        <button onClick={() => setQty(qty + 1)}>+</button>
      </div>
      <div>总价: ¥{qty * 99}</div>
      <p style={{ color: '#888', marginTop: 16 }}>
        本页面由 team-checkout 应用独立开发、独立部署。Shell 端只负责注入路由。
      </p>
    </div>
  );
}
```

### 5.5 src/exposes/PaymentButton.jsx

```jsx
// apps/team-checkout/src/exposes/PaymentButton.jsx
import React from 'react';

export default function PaymentButton({ amount = 0, label = '立即支付', onPay }) {
  return (
    <button
      onClick={() => onPay && onPay(amount)}
      style={{
        padding: '8px 20px',
        background: '#1677ff',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 14,
      }}
    >
      {label} {amount > 0 ? ` ¥${amount}` : ''}
    </button>
  );
}
```

---

## 6. 远程应用 B：team-user（Vue 示例）

### 6.1 package.json（关键依赖）

```json
{
  "name": "team-user",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "webpack serve --mode development --port 3002",
    "build": "webpack --mode production"
  },
  "dependencies": {
    "vue": "^3.3.8"
  },
  "devDependencies": {
    "vue-loader": "^17.4.2",
    "@vue/compiler-sfc": "^3.3.8",
    "html-webpack-plugin": "^5.5.3",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "webpack-dev-server": "^4.15.0"
  }
}
```

### 6.2 webpack.config.js

```js
// apps/team-user/webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const { ModuleFederationPlugin } = require('webpack').container;
const pkg = require('./package.json');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: path.resolve(__dirname, 'src/index.js'),

  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'auto',
    uniqueName: 'userCenter',
    filename: process.env.NODE_ENV === 'production'
      ? 'js/[name].[contenthash:8].js'
      : 'js/[name].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
    clean: true,
  },

  resolve: { extensions: ['.js', '.vue'] },

  module: {
    rules: [
      { test: /\.vue$/, loader: 'vue-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },

  plugins: [
    new VueLoaderPlugin(),

    new ModuleFederationPlugin({
      name: 'userCenter',                               // ⭐ 必须与 manifest 一致
      filename: 'remoteEntry.js',
      exposes: {
        './ProfilePage': './src/exposes/ProfilePage.js',
        './UserAvatar':  './src/exposes/UserAvatar.vue',
      },
      shared: {
        vue: {
          singleton: true,
          requiredVersion: pkg.dependencies.vue,
        },
      },
    }),

    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public/index.html'),
    }),
  ],

  devServer: {
    port: 3002,
    historyApiFallback: true,
    hot: true,
    client: { overlay: { errors: true, warnings: false } },
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
};
```

### 6.3 src/index.js & src/bootstrap.js

```js
// apps/team-user/src/index.js
import('./bootstrap');
```

```js
// apps/team-user/src/bootstrap.js
import { createApp, h } from 'vue';
import ProfilePage from './exposes/ProfilePage';

// 独立开发模式：直接渲染
if (document.getElementById('root')) {
  createApp({
    render: () => h('div', { style: { padding: '24px' } }, [
      h('h1', 'UserCenter（独立开发模式）'),
      h(ProfilePage),
    ]),
  }).mount('#root');
}
```

### 6.4 src/exposes/ProfilePage.js（函数式组件）

```js
// apps/team-user/src/exposes/ProfilePage.js
import { h, ref } from 'vue';

/**
 * 导出一个 Vue render 函数（或组件对象）。
 * 当 Shell 用 `import userCenter/ProfilePage` 时，Module Federation 会返回这个对象。
 */
const ProfilePage = {
  setup() {
    const username = ref('张三');
    const age = ref(28);

    const increment = () => { age.value++; };
    const decrement = () => { age.value--; };

    return () => h(
      'div',
      { style: { padding: '16px', border: '1px solid #e8e8e8', borderRadius: '8px' } },
      [
        h('h2', '👤 ProfilePage（来自 userCenter 远程模块，使用 Vue 3）'),
        h('div', { style: { marginTop: 12 } }, [
          '姓名: ',
          h('strong', username.value),
        ]),
        h('div', { style: { marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 } }, [
          '年龄: ',
          h('button', { onClick: decrement }, '-'),
          h('span', age.value),
          h('button', { onClick: increment }, '+'),
        ]),
        h('p', { style: { color: '#888', marginTop: 16 } },
          '本页面由 team-user 应用独立开发，使用 Vue 3 技术栈，可单独发布。',
        ),
      ],
    );
  },
};

export default ProfilePage;
export { ProfilePage };
```

### 6.5 在 React Shell 里渲染 Vue 组件（生产级 Adapter）

上面给的 ProfilePage 只是个 `setup 函数，直接丢到 `React.lazy` 里会因为 Vue 和 React 的渲染模型不同而出问题。生产上必须把 Vue 组件包一层 React Bridge。

思路：
1. Vue 3 远程端导出一个 `mount(el, props)` 和 `unmount()`;
2. Shell 端用一个 React 组件 `useEffect` 调 `mount`，`unmount` 清干净。

```js
// apps/team-user/src/exposes/ProfilePage.js（改写版，对外暴露 mount API）
import { createApp, h, ref } from 'vue';

/**
 * 生产级约定：远程组件对外暴露一个 mount(el, props) 工厂，
 * 返回 { update, unmount }。这样任何框架都能被 Shell 包一层 Bridge。
 */
export default function mountProfilePage(el, props = {}) {
  const username = ref(props.username || '张三');
  const age = ref(props.age || 28);

  const app = createApp({
    setup() {
      return () =>
        h('div',
          { style: { padding: '16px', border: '1px solid #e8e8e8', borderRadius: '8px' } },
          [
            h('h2', '👤 ProfilePage（来自 userCenter 远程模块，Vue 3）'),
            h('div', { style: { marginTop: 12 } }, [
              '姓名: ',
              h('strong', username.value),
            ]),
            h('div', { style: { marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 } }, [
              '年龄: ',
              h('button', { onClick: () => age.value-- }, '-'),
              h('span', age.value),
              h('button', { onClick: () => age.value++ }, '+'),
            ]),
          ],
        );
    },
  });

  app.mount(el);

  return {
    update(nextProps) {
      if (nextProps.username) username.value = nextProps.username;
      if (typeof nextProps.age === 'number') age.value = nextProps.age;
    },
    unmount() {
      app.unmount();
    },
  };
}
```

然后 Shell 端写一个通用的 `VueBridge.jsx`：

```jsx
// apps/shell/src/components/VueBridge.jsx
import React, { useEffect, useRef } from 'react';
import { loadRemoteModule } from '../mf';

/**
 * 用法:
 *   <VueBridge
 *     name="userCenter"
 *     url="https://user.xxx.com/remoteEntry.js"
 *     module="./ProfilePage"
 *     props={{ username: '张三' }}
 *   />
 */
export default function VueBridge({ name, url, module: modKey, props = {} }) {
  const elRef = useRef(null);
  const instanceRef = useRef(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const mod = await loadRemoteModule({ name, url, module: modKey });
      const factory = mod?.default || mod;
      if (typeof factory !== 'function') {
        console.error(`[VueBridge] ${name}/${modKey} 不是 mount 工厂`);
        return;
      }
      if (cancelled || !elRef.current) return;
      instanceRef.current = factory(elRef.current, propsRef.current);
    })();

    return () => {
      cancelled = true;
      if (instanceRef.current?.unmount) instanceRef.current.unmount();
      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, url, modKey]);

  // props 变化时，调用 update 做轻量更新（如果远程端支持）
  useEffect(() => {
    if (instanceRef.current?.update) instanceRef.current.update(props);
  }, [props]);

  return <div ref={elRef} />;
}
```

这样在 `bootstrap.jsx` 的路由表里，你可以把 Vue 远程路由统一包一层：

```jsx
<RemoteFallback remoteName="userCenter/ProfilePage">
  <VueBridge
    name="userCenter"
    url="https://user.xxx.com/remoteEntry.js"
    module="./ProfilePage"
  />
</RemoteFallback>
```

### 6.6 public/index.html

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>userCenter</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

---

## 7. 使用方视角：在业务组件里手动加载远程模块

前面讲了"manifest 驱动的动态路由"。但更常见的场景是——**业务页面里主动 import 一个远程模块**，比如订单页要加载 checkout 的按钮组件。下面给两套写法。

### 7.1 写法 A：最直接的 React.lazy + useRemote（推荐）

```jsx
// apps/shell/src/views/OrderPage.jsx
import React, { Suspense, lazy, useState } from 'react';
import { useRemote } from '../mf';
import RemoteFallback from '../components/RemoteFallback';

/**
 * React.lazy 要求返回 { default: Component }。
 * useRemote 已经帮你做了这一层。
 */
const CheckoutButton = lazy(() =>
  useRemote({
    name: 'checkout',
    url:  process.env.REMOTE_CHECKOUT_URL || 'http://localhost:3001/remoteEntry.js',
    module: './PaymentButton',
  }),
);

export default function OrderPage() {
  const [amount, setAmount] = useState(199);

  return (
    <div style={{ padding: 24 }}>
      <h1>订单页（Shell 端业务页面）</h1>

      <div style={{ margin: '16px 0' }}>
        <label>金额：</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>

      {/* ⭐ 核心：远程组件包一层 RemoteFallback + Suspense */}
      <RemoteFallback remoteName="checkout/PaymentButton">
        <Suspense fallback={<div>正在加载支付按钮...</div>}>
          <CheckoutButton
            amount={amount}
            label="立即支付"
            onPay={(amt) => alert(`模拟支付成功 ¥${amt}`)}
          />
        </Suspense>
      </RemoteFallback>
    </div>
  );
}
```

### 7.2 写法 B：通过 manifest 按 name 查 URL（更符合"新 Remote 不改 Host"）

如果你连"写死 `checkout` 的 URL"都不想做——用 manifest 查询：

```jsx
// apps/shell/src/mf/index.js 追加一个工具函数
// export { useRemoteByName }

import { useRemote } from './loadRemoteModule';

// 把 manifest 缓存起来，避免每次都 fetch
let manifestCache = null;
let manifestPromise = null;

export async function getManifest() {
  if (manifestCache) return manifestCache;
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetchRemoteManifest().then((m) => {
    manifestCache = m;
    return m;
  });
  return manifestPromise;
}

export function useRemoteByName({ name, module: modKey }) {
  return (async () => {
    const manifest = await getManifest();
    const remote = manifest.remotes.find((r) => r.name === name);
    if (!remote) throw new Error(`manifest 中找不到远程: ${name}`);
    return useRemote({ name, url: remote.url, module: modKey });
  })();
}

// 使用方这样写：
// const CheckoutButton = React.lazy(() =>
//   useRemoteByName({ name: 'checkout', module: './PaymentButton' })
// );
```

### 7.3 完整的"Checkout 流程"示例：订单页 + 结账页串联

```jsx
// apps/shell/src/views/OrderPage.jsx
import React, { useState, lazy, Suspense } from 'react';
import { Link, Routes, Route, useNavigate } from 'react-router-dom';
import { useRemote, useRemoteByName } from '../mf';
import RemoteFallback from '../components/RemoteFallback';

// 远程按钮组件：来自 checkout 应用
const PaymentButton = lazy(() =>
  useRemoteByName({ name: 'checkout', module: './PaymentButton' }),
);

// 远程整页组件：来自 checkout 应用（也可以在 manifest 里配路由）
const CheckoutPage = lazy(() =>
  useRemoteByName({ name: 'checkout', module: './CheckoutPage' }),
);

export default function OrderPage() {
  const [amount] = useState(999);
  const navigate = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <h1>订单页</h1>

      <p>当前金额：¥{amount}</p>

      {/* 按钮：来自远程 */}
      <RemoteFallback remoteName="checkout/PaymentButton">
        <Suspense fallback={<div>加载支付按钮...</div>}>
          <PaymentButton amount={amount} onPay={() => navigate('/checkout')} />
        </Suspense>
      </RemoteFallback>

      {/* 结账页：也是来自远程 */}
      <div style={{ marginTop: 32 }}>
        <RemoteFallback remoteName="checkout/CheckoutPage">
          <Suspense fallback={<div>加载结账页...</div>}>
            <CheckoutPage />
          </Suspense>
        </RemoteFallback>
      </div>
    </div>
  );
}
```

> **要点**：使用方只需要知道两个东西——
> 1. 远程 `name`（比如 `checkout`）
> 2. 暴露的 `module`（比如 `./PaymentButton`）
>
> URL 去哪里找？manifest 里查。构建期要不要改？不要。只要 manifest 里有这个 name，Shell 就能跑起来。

### 7.4 路由级远程：在 bootstrap.jsx 中根据 manifest 自动生成路由

这是实现"新 Remote 不改 Host 代码"的关键。下面给出一个**最终版**的 bootstrap.jsx：

```jsx
// apps/shell/src/bootstrap.jsx（最终版）
import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from 'react-router-dom';
import { getManifest, loadRemote, useRemote } from './mf';
import RemoteFallback from './components/RemoteFallback';
import RemoteRoute from './components/RemoteRoute';
import VueBridge from './components/VueBridge';
import OrderPage from './views/OrderPage';
import './index.css';

/**
 * 根据 manifest 构造路由数组。
 * - type 为 'vue' 的远程用 VueBridge 渲染
 * - 其余默认 React 组件用 React.lazy 渲染
 */
function useRemoteRoutes() {
  const [routes, setRoutes] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getManifest().then((manifest) => {
      if (cancelled) return;
      const result = [];
      (manifest.remotes || []).forEach((remote) => {
        (remote.routes || []).forEach((rt) => {
          const Component = rt.type === 'vue'
            ? function VueRemoteComponent() {
                return <VueBridge name={remote.name} url={remote.url} module={rt.module} />;
              }
            : React.lazy(() => useRemote({
                name: remote.name, url: remote.url, module: rt.module,
              }));

          result.push({
            key: `${remote.name}:${rt.path}`,
            path: rt.path,
            title: rt.title || remote.name,
            Component,
          });
        });
      });
      setRoutes(result);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  return { routes, ready };
}

function App() {
  const { routes, ready } = useRemoteRoutes();

  if (!ready) {
    return <div style={{ padding: 24 }}>正在加载路由配置...</div>;
  }

  return (
    <BrowserRouter>
      <header style={headerStyle}>
        <Link to="/" style={linkStyle}>首页</Link>
        <Link to="/order" style={linkStyle}>订单</Link>
        {routes.map((r) => (
          <Link key={r.key} to={r.path.replace('/*', '')} style={linkStyle}>
            {r.title}
          </Link>
        ))}
      </header>

      <main style={{ padding: 24 }}>
        <Routes>
          <Route path="/" element={<HomePage remoteCount={routes.length} />} />
          <Route path="/order" element={<OrderPage />} />

          {/* ⭐ 动态注入的远程路由 */}
          {routes.map((r) => (
            <Route
              key={r.key}
              path={r.path}
              element={
                <RemoteFallback remoteName={r.key}>
                  <RemoteRoute>
                    <r.Component />
                  </RemoteRoute>
                </RemoteFallback>
              }
            />
          ))}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

function HomePage({ remoteCount }) {
  return (
    <div>
      <h1>🏠 Shell 主站</h1>
      <p>目前已注册 {remoteCount} 个远程应用。</p>
      <p>点击顶部菜单即可跳转到远程应用。远程应用无需重启 Shell，只要修改 manifest 即可。</p>
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div>
      <h2>404：路由不存在</h2>
      <button onClick={() => navigate('/')}>返回首页</button>
    </div>
  );
}

const headerStyle = { display: 'flex', gap: 24, padding: 16, background: '#001529', color: '#fff' };
const linkStyle = { color: '#fff', textDecoration: 'none' };

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

现在 manifest 可以这样写（支持 `type: 'vue'`）：

```json
{
  "version": 1,
  "remotes": [
    { "name": "checkout",
      "url": "https://checkout.xxx.com/remoteEntry.js",
      "routes": [
        { "path": "/checkout/*", "module": "./CheckoutPage", "title": "结账页" },
        { "path": "/checkout/pay", "module": "./PaymentButton", "title": "支付按钮" }
      ]
    },
    { "name": "userCenter",
      "url": "https://user.xxx.com/remoteEntry.js",
      "type": "vue",
      "routes": [
        { "path": "/user/*", "module": "./ProfilePage", "title": "用户中心" }
      ]
    }
  ]
}
```


---

## 8. 部署流程（"新远程上线"只需 4 步）

### 步骤 1：开发并部署远程应用

```bash
cd apps/team-checkout
npm run build
# dist/ 目录会包含：remoteEntry.js、js/[name].[hash].js、index.html 等
# 部署到：https://checkout.xxx.com/
# 保证能访问 https://checkout.xxx.com/remoteEntry.js
```

### 步骤 2：更新 manifest（改配置，不改代码）

```json
// apps/shell/public/remote-manifest.json
{
  "version": 1,
  "remotes": [
    {
      "name":     "checkout",
      "url":      "https://checkout.xxx.com/remoteEntry.js",
      "routes": [
        { "path": "/checkout/*", "module": "./CheckoutPage", "title": "结账页" }
      ]
    }
  ]
}
```

### 步骤 3：只部署 manifest 到 Shell 的静态资源目录

不需要重新构建 Shell。只要 Shell 的用户能访问到新的 `remote-manifest.json` 就行。

```bash
# 把 manifest.json 放到 shell 的 dist 根目录
scp apps/shell/public/remote-manifest.json deploy@shell.xxx.com:/var/www/shell/remote-manifest.json
```

### 步骤 4：用户刷新浏览器即生效

```
用户访问 https://shell.xxx.com/checkout
  └─ Shell 启动 → fetch('/remote-manifest.json')
     └─ 发现 checkout 这条记录
        └─ 动态 <script src="https://checkout.xxx.com/remoteEntry.js">
           └─ React Router 渲染 <CheckoutPage />
```

---

## 9. Nginx 生产配置（核心是 CORS + remoteEntry 的缓存策略）

### 9.1 Shell（shell.xxx.com）

```nginx
server {
  listen 443 ssl http2;
  server_name shell.xxx.com;

  root /var/www/shell;
  index index.html;

  # manifest: 禁止缓存（因为它就是路由表，新远程需要立即生效）
  location = /remote-manifest.json {
    add_header Cache-Control 'no-cache, no-store, must-revalidate, max-age=0';
    add_header Pragma 'no-cache';
    add_header Expires '0';
    try_files $uri =404;
  }

  # JS/CSS：长缓存 + immutable（contenthash 变化会自动失效）
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

  # 其他所有路径 fallback 到 index.html（React Router history 模式）
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### 9.2 远程应用（checkout.xxx.com）

```nginx
server {
  listen 443 ssl http2;
  server_name checkout.xxx.com;

  root /var/www/checkout;
  index index.html;

  # ⭐ remoteEntry.js：禁止缓存 + 允许 Shell 跨域
  location = /remoteEntry.js {
    add_header Cache-Control 'no-cache, no-store, must-revalidate, max-age=0';
    add_header Pragma 'no-cache';
    add_header Expires '0';
    add_header Access-Control-Allow-Origin 'https://shell.xxx.com' always;
    add_header Access-Control-Allow-Credentials 'true';
    if ($request_method = OPTIONS) { return 204; }
    try_files $uri =404;
  }

  # JS/CSS chunk：长缓存 + CORS
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

  # 其他路径 fallback（远程应用独立访问时可用）
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

---

## 10. 完整开发与生产启动流程

### 开发模式

```bash
# 终端 1：启动 Shell（端口 3000）
cd apps/shell && npm run dev

# 终端 2：启动 checkout（端口 3001）
cd apps/team-checkout && npm run dev

# 终端 3：启动 userCenter（端口 3002）
cd apps/team-user && npm run dev

# 浏览器访问 http://localhost:3000
# 点击顶部菜单即可跳转到各远程应用
```

### 生产模式

```bash
# 1. 构建远程应用
cd apps/team-checkout && npm run build
# 上传 dist/ 到 CDN（checkout.xxx.com）

# 2. 生成 manifest（CI 脚本，见 §11）
node packages/mf-manifest/scripts/generate-manifest.js \
  --out apps/shell/public/remote-manifest.json

# 3. 构建 Shell（非必需——但为了把 manifest 打进 dist，推荐 Shell 也 build 一次）
cd apps/shell && npm run build

# 4. 部署 Shell
# 上传 apps/shell/dist/ 到 shell.xxx.com
```

---

## 11. CI 脚本：自动生成 manifest

```js
// packages/mf-manifest/scripts/generate-manifest.js
/**
 * 用法: node generate-manifest.js --out apps/shell/public/remote-manifest.json
 * 输出: JSON 格式的 manifest 文件
 */
const fs = require('fs');
const path = require('path');

// 实际项目里：这份配置可以从配置中心读取，或扫描 apps/* 目录自动汇总
const REMOTES = [
  {
    name: 'checkout',
    url: process.env.REMOTE_CHECKOUT_URL || 'http://localhost:3001/remoteEntry.js',
    routes: [
      { path: '/checkout/*', module: './CheckoutPage', title: '结账页' },
      { path: '/checkout/pay', module: './PaymentButton', title: '支付按钮' },
    ],
  },
  {
    name: 'userCenter',
    url: process.env.REMOTE_USER_URL || 'http://localhost:3002/remoteEntry.js',
    routes: [
      { path: '/user/*', module: './ProfilePage', title: '用户中心' },
    ],
  },
];

function main() {
  let outPath = path.resolve(process.cwd(), 'apps/shell/public/remote-manifest.json');
  const idx = process.argv.indexOf('--out');
  if (idx >= 0 && process.argv[idx + 1]) {
    outPath = path.resolve(process.cwd(), process.argv[idx + 1]);
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    remotes: REMOTES,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[MF] manifest 已生成: ${outPath} (共 ${REMOTES.length} 个远程)`);
}

main();
```

---

## 12. 常见问题排查速查表

| # | 现象 | 原因 | 解决 |
|---|------|------|------|
| 1 | `__webpack_init_sharing__ is not defined` | Shell 的 MF Plugin 没声明 remotes 或 shared | 在 `remotes` 里加 `_placeholder: '_placeholder@about:blank'` |
| 2 | `<script src=remoteEntry.js> 报错 404` | URL 写错或未部署 | 用浏览器直接打开 URL 验证；检查 Nginx 的 `try_files` |
| 3 | CORS: `Access to script at xxx from origin yyy blocked` | 远程应用 Nginx 没开 CORS | 远程 Nginx `add_header Access-Control-Allow-Origin 'https://shell.xxx.com' always` |
| 4 | `window[name]` 不存在 | manifest 的 name 与远程应用 MF Plugin 的 name 不一致 | 两端必须完全一致（区分大小写） |
| 5 | `container.get('./Xxx')` throws | `./` 前缀缺失，或远程端 exposes 里根本没配这条 | manifest 的 module 必须以 `./` 开头，且与远程 exposes key 一致 |
| 6 | 渲染时报 `Invalid hook call` | 页面上同时存在两份 React 实例 | Remote 端必须声明 `react: { singleton: true }`；版本号要与 Shell 兼容 |
| 7 | 刷新 `/checkout/xxx` 404 | Shell 的 Nginx 没有 `try_files ... /index.html` | 加 fallback 规则 |
| 8 | 新远程上线后仍显示旧模块 | remoteEntry.js 被浏览器长缓存 | remoteEntry.js 必须配 `Cache-Control: no-cache` |
| 9 | 样式加载失败（CSS 404） | Remote 的 `output.publicPath` 不是 `auto` | 保持 `publicPath: 'auto'`，webpack 5 会自动根据 script 位置解析 |
| 10 | Vue 远程组件加载后不渲染 | 忘记在 Shell 引入 Vue（如果 shared 没加 eager: true） | Shell 端或首次加载前确保 vue 能被 shared scope 提供；或把 vue 设为 `{ singleton: true, eager: true }` |

---

## 13. 真正"热插拔"：部署新远程不需重构建 Shell 的流程总结

1. **开发**：新团队开发新 Remote 应用，MF Plugin 配好 `name / exposes / shared`
2. **构建**：`npm run build`，产出 `remoteEntry.js` 和 chunk
3. **部署**：把 dist/ 放到 CDN，确保 `https://new-app.xxx.com/remoteEntry.js` 可访问
4. **注册**：**改一行 JSON**——把 `{ name, url, routes }` 加到 Shell 的 `remote-manifest.json`
5. **生效**：只上传这一个 JSON 文件到 Shell 静态资源根目录
6. **用户**：刷新页面即可看到新的远程应用

> **为什么不需要重构建 Shell？**
> Shell 已经在构建期把 `ModuleFederationPlugin` 注入，产生了 `__webpack_init_sharing__` 等运行时 API。
> manifest 是运行时拉取的配置，动态 `<script>` 注入 remoteEntry.js 也是运行时行为。
> 只要你能让 Shell 拿到新的 manifest，它就会自动注册新的远程应用。

---

## 14. 进阶：用外部配置中心提供 manifest（更极致的热插拔）

如果你想做到"发布新远程连 Shell 的静态文件都不碰"，可以把 manifest 放到独立 URL，Shell 启动时从那里拉：

```js
// apps/shell/src/mf/manifest.js（改写版）
const CONFIG_CENTER_URL = process.env.MF_MANIFEST_URL || '/remote-manifest.json';

export async function fetchRemoteManifest() {
  try {
    const res = await fetch(`${CONFIG_CENTER_URL}?_t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json || !Array.isArray(json.remotes)) throw new Error(`格式错误`);
    return json;
  } catch (err) {
    console.error('[MF] manifest 拉取失败，改用空路由表：', err.message);
    return { version: 0, generatedAt: new Date().toISOString(), remotes: [] };
  }
}
```

部署流程变成：

1. 新远程部署到 CDN
2. 调用配置中心 API 追加一条远程记录
3. **Shell 端任何操作都不需要**——用户下次打开页面时自然拿到新 manifest

---

## 15. 预加载：把 remoteEntry.js 放到"首屏不卡，但点击就秒开"

策略：**在 Shell 首屏渲染完成后（idle 阶段），把 manifest 中全部远程的 remoteEntry.js 预加载到内存**。这样用户跳转到新路由时不会看到"加载中..."。

```jsx
// apps/shell/src/mf/preload.js
import { getManifest, loadRemote } from './index';

/**
 * 在浏览器空闲时预加载所有 remoteEntry.js（仅注入 script，不执行 exposes）。
 * 注意：这只是"下载 + 完成 shared scope 协商"，真正的组件懒加载仍然按需。
 */
export function preloadAllRemotes(opts = {}) {
  const run = () => {
    getManifest().then((manifest) => {
      const remotes = manifest.remotes || [];
      remotes.forEach((remote) => {
        // 仅完成 loadRemote —— 它会把 window[name] 初始化好，
        // 真正调用 container.get() 获取 component 的时机仍由 React.lazy 决定
        loadRemote({ name: remote.name, url: remote.url }).catch((err) => {
          console.warn(`[MF] 预加载 ${remote.name} 失败:`, err.message);
        });
      });
    });
  };

  if (typeof window === 'undefined') return;
  if (opts.force) run();
  else if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1500); // 兼容旧浏览器
  }
}
```

在 bootstrap.jsx 启动后调用一次：

```jsx
// apps/shell/src/bootstrap.jsx 末尾
import { preloadAllRemotes } from './mf/preload';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// 首屏渲染完后，空闲时预热
if (process.env.MF_PRELOAD_ALL !== 'false') {
  setTimeout(preloadAllRemotes, 1000);
}
```

> **关键点**：`loadRemote()` 已经是幂等的（内部 `INJECTED Map` 缓存），所以你预加载一次后，后续 `React.lazy(() => useRemote(...))` 会直接命中缓存。

---

## 16. 灰度发布：给部分用户上新版远程

思路：**manifest 里每条 remote 提供 `versions[]`，每条有 `percent、url、env`**，Shell 根据 `userId` 或 `sessionId` 做 bucket，选择对应版本。

```json
{
  "version": 1,
  "remotes": [
    {
      "name": "checkout",
      "versions": [
        {
          "url":     "https://checkout.xxx.com/v1.2.0/remoteEntry.js",
          "percent": 80,
          "tag":     "stable"
        },
        {
          "url":     "https://checkout.xxx.com/v1.3.0-beta/remoteEntry.js",
          "percent": 20,
          "tag":     "beta"
        }
      ],
      "routes": [
        { "path": "/checkout/*", "module": "./CheckoutPage", "title": "结账页" }
      ]
    }
  ]
}
```

Shell 端按 userId hash 选择：

```js
// apps/shell/src/mf/manifest.js（补充版本选择）
function pickVersion(versions, seed = 'default') {
  if (!Array.isArray(versions) || versions.length === 0) return null;
  if (versions.length === 1) return versions[0];

  // 简单 hash
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const bucket = hash % 100;

  let acc = 0;
  for (const v of versions) {
    acc += v.percent || 0;
    if (bucket < acc) return v;
  }
  return versions[versions.length - 1];
}

// 在 fetchRemoteManifest 的返回值里，把每个 remotes 的 url 替换成选中版本
export async function fetchRemoteManifest(manifestUrl = DEFAULT_MANIFEST_PATH, seed) {
  const json = await fetch(...);

  json.remotes = (json.remotes || []).map((remote) => {
    if (Array.isArray(remote.versions) && remote.versions.length > 0) {
      const v = pickVersion(remote.versions, seed || window.location.hostname);
      return { ...remote, url: v.url, versionTag: v.tag };
    }
    return remote;
  });

  return json;
}
```

运维/配置中心只需**调整 JSON 里的 percent**，整个灰度过程无需重构建 Shell。

---

## 17. manifest hash 校验 + 安全边界

因为 manifest 本质是"运行时路由表"，一旦被篡改后果严重。生产上推荐两种防护：

1. **完整性校验**：CI 生成 manifest 时同时计算 `sha256(manifest)`，把 hash 放到独立的 `manifest-hash.json` 或放到配置中心；Shell 端加载 manifest 后用 `SubtleCrypto.digest('SHA-256', ...)` 比对。

2. **CSP / 允许域名白名单**：Shell 端在 `loadRemote()` 时校验 URL 是否在允许的域名列表里，防止把恶意远程引入：

```js
// apps/shell/src/mf/loadRemote.js 增加域名白名单
const ALLOWED_HOSTS = (process.env.MF_ALLOWED_HOSTS || 'localhost,xxx.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedUrl(url) {
  try {
    const host = new URL(url, window.location.href).hostname;
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function loadRemote({ name, url, scope = 'default' }) {
  if (!isAllowedUrl(url)) {
    throw new Error(`远程 ${name} 的 URL ${url} 不在白名单内，拒绝加载`);
  }
  // ... 其余逻辑不变
}
```

---

## 18. 最小可验证闭环 checklist（"新 Remote 不改 Host 也能上线"）

下面是一份可以直接贴到 PR 里当 checklist 的列表。**只要你逐项做过，就可以宣称自己实现了真正的动态远程**：

### Shell 端（只构建一次，以后不变）

- [x] `webpack.config.js` 启用 `ModuleFederationPlugin`，并至少配一个 `_placeholder: '_placeholder@about:blank'` 确保 `__webpack_init_sharing__` 存在
- [x] `shared` 中 `react / react-dom / vue / react-router-dom` 都声明 `{ singleton: true }`，版本号对齐
- [x] `output.publicPath = 'auto'`（或等价配置）
- [x] `src/index.js` 只做 `import('./bootstrap')` 一件事
- [x] `src/mf/loadRemote.js` 有 `INJECTED Map` 做幂等缓存
- [x] `src/mf/manifest.js` 从 `process.env.MF_MANIFEST_URL` 读 manifest，失败降级到 `remotes: []` 或白名单 fallback
- [x] `src/mf/loadRemote.js` 增加域名白名单校验（生产必备）
- [x] `components/RemoteFallback.jsx` 捕获远程组件错误，不把整个 Shell 拖崩
- [x] `components/VueBridge.jsx` 用 mount 工厂渲染 Vue 远程组件，且有 unmount 行为
- [x] 生产环境注入正确的 `process.env.MF_MANIFEST_URL`、`process.env.MF_PRELOAD_ALL`
- [x] `public/index.html` 没有内联任何远程相关信息

### Remote 端（每个独立仓库，只发布自己）

- [x] `new ModuleFederationPlugin({ name, filename: 'remoteEntry.js', exposes, shared })`
- [x] `name` 与 manifest 中声明的 `name` 完全一致（大小写敏感）
- [x] `exposes` 里每个 key 以 `./` 开头（例如 `./CheckoutPage`）
- [x] React 远程：默认导出 React 组件
- [x] Vue 远程：默认导出 `mount(el, props) => { update, unmount }` 工厂函数
- [x] `output.publicPath = 'auto'`，`uniqueName` 与 name 保持一致或唯一
- [x] shared 与 Shell 同构（react/vue 用 singleton，lodash/axios 等按需）
- [x] `npm run build` 成功产出 `dist/remoteEntry.js` 及 chunk
- [x] 部署到 CDN（例如 `https://checkout.xxx.com/v1.2.0/remoteEntry.js`）
- [x] 浏览器直接打开 `https://checkout.xxx.com/v1.2.0/remoteEntry.js` 能看到 JS，且 CORS 允许 Shell 域

### manifest 端（唯一"每次发布都改"的地方）

- [x] `remote-manifest.json` 的 schema 与约定一致：`{ version, remotes: [{ name, url, type?, routes: [{ path, module, title }] }] }`
- [x] `type: 'vue'` 字段存在，Shell 端用 VueBridge 渲染
- [x] `routes[].module` 与 Remote 端 `exposes` key 完全一致（含 `./` 前缀）
- [x] 新远程上线：追加一条 `remotes` 记录，`version++`
- [x] manifest 本身支持灰度：`versions[].{ url, percent, tag }`（按需）
- [x] manifest 部署到 Shell 可访问的 URL（同源静态资源或独立配置中心均可）
- [x) manifest 响应头：`Cache-Control: no-cache, no-store, must-revalidate`，避免浏览器缓存旧版本

### 验证步骤（手动跑一遍确认闭环）

1. **首次验证**：打开 Shell 首页 → 顶部菜单出现 `manifest.remotes` 的路由 → 点击 → 看到远程组件 → 控制台无 `__webpack_init_sharing__` / 404 / CORS 错误
2. **模拟"新 Remote 不改 Host 发布"**：
   - 只改 manifest.json（增加一条远程：`{ name: 'coupon', url: 'https://coupon.xxx.com/remoteEntry.js', routes: [...] }`）
   - **不重建、不重部署 Shell**
   - 刷新浏览器 → Shell 首页顶部菜单出现"优惠券"路由 → 点击 → 能加载 coupon 的远程组件
3. **失败降级验证**：故意把 manifest 返回 404 → Shell 仍然能启动，远程路由部分显示"加载失败"而非白屏
4. **CORS 验证**：浏览器 DevTools → Network → 确认 `remoteEntry.js` 响应含 `Access-Control-Allow-Origin: shell.xxx.com`（或 `*`）
5. **缓存策略验证**：刷新两次 → 第二次 manifest 仍是最新（而不是缓存的旧文件）；`remoteEntry.js` 也是最新；静态 chunk 走长缓存没有问题

### 失败速查

| 现象 | 通常原因 | 解决 |
|---|---|---|
| `__webpack_init_sharing__ is not defined` | Shell 没声明任何 remotes 或 shared | 在 `remotes` 加 `_placeholder: '_placeholder@about:blank'` |
| manifest 返回 404 | Shell 静态资源目录没放 manifest，或路径不对 | 检查 `MF_MANIFEST_URL`，本地把文件放到 `public/` |
| `window[name]` 不存在 | manifest 的 name 和 Remote 端 MF Plugin 的 name 不一致 | 两端大小写完全一致 |
| `container.get('./Xxx') throws` | 前缀缺失或 exposes key 不一致 | 必须以 `./` 开头 |
| `Invalid hook call` | 页面上存在两个 React 实例 | React 必须 `{ singleton: true }` |
| Vue 组件不渲染 | 没走 VueBridge 或远程端没有 export mount 工厂 | 走 VueBridge + 远程端暴露 mount |
| 样式 404 / chunk 404 | 远程端 `publicPath` 非 auto | 设为 `'auto'` |
| 刷新 `/:remotePath` 404 | Shell 端 Nginx 没 fallback 到 index.html | 加 `try_files $uri $uri/ /index.html` |

---

> **一句话总结**：Module Federation 动态远程的本质是"在构建时让 Shell 具备接收任意远程的能力（通过 `_placeholder` 占位），再在运行时通过 manifest 告诉它"你现在有这些远程可用"。后续的一切（按需注入 script、协商 shared scope、懒加载组件、路由注册）都是纯运行时行为，与构建过程解耦。
