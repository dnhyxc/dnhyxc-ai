# Vue / React 微前端接入方案（全面面试回答）

> **适用场景**：中大型项目（多团队协作 / 多技术栈并存 / 巨石应用拆分 / 技术平滑升级）需要做前端架构设计或架构面试，面试官/面试者希望有一份结构完整、能从头到尾讲下来的"面试回答"。

本文按「**为什么做 → 有哪些技术路线 → 我怎么选 → 我怎么实现（原理/路由/通信/样式/沙箱/状态/共享依赖/部署）→ 有哪些坑 → 性能如何做 → 量化验证 → 高频追问**」的顺序组织。正文采用"面试回答口吻 + 代码示例 + 对比表"三种形式组织，方便直接复述或作为团队决策材料。

---

## 0. 开场一句（总览）

> **我会这样开场**："微前端本质上是**把一个前端应用拆成若干可独立开发、独立部署、独立运行的子应用**，由一个**主应用（基座）**负责生命周期管理、路由分发、资源加载与基础服务共享。
>
> 它解决的核心问题有四个：1) **巨石应用拆分**（一个 Git 仓库 / 一个构建任务太大）；2) **多团队协作解耦**（A 队用 React，B 队用 Vue，互不阻断）；3) **技术栈平滑升级**（老业务不重写，新业务用新技术，渐进式替换）；4) **复用公共能力**（登录、权限、埋点、主题、国际化）。
>
> 它的代价是：**样式隔离 / JS 沙箱 / 资源加载 / 路由管理**这 4 件事的复杂度会上升。做方案时，我会先选一条技术路线，再把这 4 件事的落地细节定下来。"

---

## 1. 技术路线对比（选型是面试的第一道题）

### 1.1 主流方案对比表（第一时间能讲出各路线的边界）

| 路线 | 代表 | 原理 | 隔离度 | 接入成本 | 适用 | 不适用 |
| --- | --- | --- | --- | --- | --- | --- |
| **路由级多应用（Nginx 分发）** | location + `/app1` `/app2` | 不同前缀对应不同 SPA，浏览器整页跳转 | 原生最高，天然隔离 | 极低 | 子应用完全独立、无需共享运行时 | 子应用之间频繁交互，有"看起来是一个应用"的诉求 |
| **iframe 嵌入** | 原生 `<iframe>` | 主应用用 iframe 套子应用，浏览器天然隔离 | 高（DOM/JS/样式全隔离） | 低 | 需要 100% 隔离的第三方页面 / 旧系统迁移第一步 | 路由同步、弹窗跨层级、高性能动画、表单跨应用提交 |
| **qiankun（阿里）** | `qiankun` 封装 + `import-html-entry` | 主应用 `registerMicroApps` + `start()`；子应用暴露 `bootstrap/mount/unmount`；通过 fetch HTML + 提取脚本执行 | 中（基于 Proxy 的 JS 沙箱，样式用 scoped / shadow DOM） | 中 | 多技术栈并存、中大型多团队、需要渐进式替换 | 对沙箱兼容性敏感（老 IE/部分浏览器插件） |
| **micro-app（京东零售）** | `@micro-zoe/micro-app` | 自定义元素 `<micro-app>`，Web Components 风格；子应用基本"零改" | 中（同样基于 Proxy + 自定义元素） | 低 | 子应用多、希望改到最少；团队熟悉 Web Components | 有大量复杂的全局变量污染场景 |
| **Module Federation（Webpack 5）** | `webpack/lib/container/ModuleFederationPlugin` | 编译期声明 remote/exposes；运行时通过 `__webpack_modules__` 共享模块；本质是"模块级联邦"，不是传统意义的"应用级联邦" | 取决于实现；通常要自行补上 | 中高（构建层改动，子应用要暴露模块） | 组件/工具/库的跨应用复用、BFF 页面拼图、"微模块"场景 | 期望"一个路由 = 一个子应用"的应用级联邦体验（它的优势不在这里） |
| **EMP（字节）** | `@efox/emp` | 基于 Module Federation 的上层封装；强化共享依赖、版本管理、开发体验 | 同上 | 中 | 多应用大规模共享 React/Vue/组件库/工具库 | 与 MF 相同 |
| **wujie（腾讯）** | `wujie` | **JS 沙箱用 Web Worker / Proxy**，**样式沙箱用 Shadow DOM**；子应用运行在 iframe 的 document 上但挂载到主应用 | 高 | 中 | 对样式与 JS 隔离要求都高、需兼容老应用；期望"主应用无感" | 重度依赖全局 window 副作用的老应用、复杂路由嵌套场景 |
| **自研 + single-spa** | `single-spa` | 最底层路由/生命周期库；自己做资源加载、沙箱、样式 | 取决于实现 | 高（轮子自己造） | 特殊定制化需求、已有构建体系且无法迁 | 时间紧、想快速落地 |

### 1.2 我的典型选型思路（面试常用回答）

> **"如果让我来选，我会按三步判断："**
>
> 1. **团队情况**：团队 3~5 支，各有 React / Vue，那选 **qiankun 或 micro-app**（社区资源多、接入成本中、隔离性够用）。
> 2. **是否有大量组件级共享**：如果跨应用共享的是**组件/库/业务模块**而不是"整页"，我会重点考虑 **Module Federation / EMP**，再补上路由级容器。
> 3. **是否对隔离性有硬要求**：比如嵌入第三方、有合规/安全要求，我会先用 **iframe** 做一版兜底，再在内部用 **wujie / qiankun** 做用户体验更好的版本。
>
> 我不会上来就选"最炫的那个"——**技术路线的稳定性/社区资源/团队熟悉度**和隔离方案同等重要。

---

## 2. 以 qiankun 为例讲"接入原理"（最常见的面试主线）

> 为什么选 qiankun 作为主线？社区资源最丰富、面试提问概率最高、能把"路由 + 生命周期 + 沙箱 + 样式"这四个关键问题都讲清楚。
> 对 micro-app / wujie 而言，差别主要在「资源加载方式 / JS 沙箱实现 / 样式隔离手段」三件事上，后文会专门列差异表。

### 2.1 主应用（基座）接入骨架

```js
// main-app/src/main.js
import { registerMicroApps, start, setDefaultMountApp, initGlobalState } from 'qiankun';
import Vue from 'vue';
import App from './App.vue';
import router from './router';

new Vue({ router, render: h => h(App) }).$mount('#app');

// ===== 1. 注册子应用（核心：activeRule + entry + container）
registerMicroApps([
  {
    name: 'app-react',                   // 唯一 ID
    entry: '//localhost:8001',            // 子应用 entry（html-entry）
    container: '#subapp-container',       // 挂载节点
    activeRule: '/app-react',             // 路由匹配规则（函数形式可支持更复杂）
    props: { routerBase: '/app-react', global: { user: '...' } }, // 给子应用的初值
  },
  {
    name: 'app-vue',
    entry: {
      scripts: ['//cdn.xxx.com/app-vue/js/chunk-vendors.xxx.js', '//cdn.xxx.com/app-vue/js/app.xxx.js'],
      styles: ['//cdn.xxx.com/app-vue/css/app.xxx.css'],
      html: '<div id="app"></div>',
    },
    container: '#subapp-container',
    activeRule: (location) => location.pathname.startsWith('/app-vue'),
    props: { routerBase: '/app-vue' },
  },
], {
  // 全局生命周期钩子（适合做 loading / 错误兜底 / 埋点）
  beforeLoad: [
    (app) => {
      console.log('[qiankun] before load', app.name);
      window.__SUBAPP_LOADING__ = true;
      return Promise.resolve();
    },
  ],
  beforeMount: [(app) => console.log('[qiankun] before mount', app.name)],
  afterUnmount: [(app) => console.log('[qiankun] after unmount', app.name)],
});

// ===== 2. 全局状态（极简版 store）
const { onGlobalStateChange, setGlobalState } = initGlobalState({
  user: null,
  token: '',
  theme: 'light',
  permissions: [],
});

// 主应用自己订阅变化（可选）
onGlobalStateChange((state, prev) => {
  console.log('[qiankun] global state', prev, '→', state);
});

// 暴露给业务代码（建议封装成一个 service，不要直接裸写 setGlobalState）
window.__QIANKUN_GLOBAL__ = { setGlobalState, onGlobalStateChange };

// ===== 3. 启动：关键参数
setDefaultMountApp('/app-react');

start({
  sandbox: {
    experimentalStyleIsolation: true,          // 实验性样式隔离（通过选择器重写）
    strictStyleIsolation: false,                 // 严格样式隔离（Shadow DOM；会影响 antd modal 等插 body 的节点）
  },
  singular: true,                                // 同一时刻只允许渲染一个子应用（绝大多数场景够用且更稳）
  prefetch: 'all',                               // 首屏后预加载其他子应用的资源（提升二次加载速度）
  fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include' }), // 自定义 fetch（可改 cookie、跨域策略）
  // 如用 import-html-entry 的预加载，可开启（与 prefetch 配套）
  // getPublicPath: (entry) => entry,
  // getTemplate: (tpl) => tpl,
});
```

**主应用路由里必须放一个容器节点**，供 qiankun 注入：

```vue
<!-- main-app/src/App.vue -->
<template>
  <div id="app-root">
    <Layout>
      <Sidebar />
      <Header />
      <Content>
        <router-view name="main"></router-view>      <!-- 主应用自有页面（首页/关于） -->
        <div id="subapp-container"></div>            <!-- 子应用挂载点 -->
      </Content>
    </Layout>
  </div>
</template>
```

### 2.2 子应用（React 版）暴露的生命周期

子应用要做四件事：

1. **输出 `bootstrap / mount / unmount`**三个方法；
2. **根路由前缀要对齐 activeRule**（比如都是 `/app-react`）；
3. **publicPath 动态设置**（因为资源是从主应用的 URL 加载的，相对路径会算错）；
4. **构建产物允许跨域**（Nginx `Access-Control-Allow-Origin: *` 或走网关）。

```js
// app-react/src/public-path.js（必须放在最顶部！）
if (window.__POWERED_BY_QIANKUN__) {
  // eslint-disable-next-line no-undef
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}
```

```js
// app-react/src/main.jsx
import './public-path';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './views/Home';
import About from './views/About';

let root = null;

function render(props = {}) {
  const { container, routerBase } = props;
  const basename = window.__POWERED_BY_QIANKUN__ ? routerBase : '/';
  const domContainer = container
    ? container.querySelector('#app-react-root')
    : document.querySelector('#app-react-root');

  root = ReactDOM.createRoot(domContainer);
  root.render(
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

// 独立运行（npm start 时走这里）
if (!window.__POWERED_BY_QIANKUN__) {
  render();
}

// ====== qiankun 生命周期 ======
export async function bootstrap(props) {
  console.log('[app-react] bootstrap');
  // 可以做一次"初始化"动作：拉取权限、预加载全局变量等
}

export async function mount(props) {
  console.log('[app-react] mount', props);
  // 接收主应用的全局状态（可选）
  props.onGlobalStateChange && props.onGlobalStateChange(
    (state, prev) => console.log('[app-react] onGlobalStateChange', state, prev),
    true,
  );
  render(props);
}

export async function unmount(props) {
  console.log('[app-react] unmount');
  const { container } = props;
  const target = container
    ? container.querySelector('#app-react-root')
    : document.querySelector('#app-react-root');
  root.unmount(target);
  root = null;
}

export async function update(props) {
  // 可选：主应用主动"update"时触发（传新 props）
  console.log('[app-react] update', props);
}
```

```js
// app-react/config-overrides.js（如果你用 craco / react-app-rewired）
const { name } = require('./package');

module.exports = {
  webpack: (config) => {
    config.output.library = `${name}-[name]`;
    config.output.libraryTarget = 'umd';
    // 关键：把子应用暴露给全局 window
    config.output.globalObject = 'window';
    // 热更新时不要走相对路径
    config.output.publicPath = process.env.NODE_ENV === 'production'
      ? `/${name}/`
      : 'auto';
    return config;
  },
  devServer: (configFunction) => (proxy, allowedHost) => {
    const config = configFunction(proxy, allowedHost);
    config.historyApiFallback = true;
    config.hot = true;
    // 关键：允许主应用跨域请求子应用资源
    config.headers = { 'Access-Control-Allow-Origin': '*' };
    return config;
  },
};
```

### 2.3 子应用（Vue 版）暴露的生命周期

```js
// app-vue/src/main.js
import './public-path';       // 与 React 版完全一样
import Vue from 'vue';
import VueRouter from 'vue-router';
import App from './App.vue';
import routes from './router';

let instance = null;
let router = null;

function render(props = {}) {
  const { container, routerBase } = props;
  const base = window.__POWERED_BY_QIANKUN__ ? routerBase : process.env.BASE_URL;

  router = new VueRouter({
    mode: 'history',
    base,
    routes,
  });

  instance = new Vue({
    router,
    store: null, // 可以放 Vuex / Pinia
    render: (h) => h(App),
  }).$mount(container ? container.querySelector('#app-vue-root') : '#app-vue-root');
}

if (!window.__POWERED_BY_QIANKUN__) {
  render();
}

export async function bootstrap(props) { console.log('[app-vue] bootstrap'); }
export async function mount(props)     { render(props); }
export async function unmount(props)   {
  instance.$destroy();
  instance = null;
  router = null;
}
```

### 2.4 qiankun 底层原理（面试里容易被追问"它到底做了什么"）

> 我会这么回答：**qiankun 的核心就是三件事**：
>
> 1. **路由匹配**：监听主应用的 `popstate/hashchange`，当路径命中某子应用的 `activeRule` 时，触发该子应用的 mount 流程，其他子应用的 unmount 流程。
> 2. **HTML Entry + 脚本执行**：它用的底层库叫 `import-html-entry`，会 `fetch(entry)` 拿到子应用的 HTML，再从 HTML 中解析 `<script> <link rel="stylesheet">` 等资源、按顺序 fetch 并执行；脚本执行时，**把子应用 export 的 `bootstrap/mount/unmount` 暴露到主应用可调用的函数**。
> 3. **JS 沙箱 + 样式隔离**：脚本能跑起来只是第一步，下一步是防止"子应用 A 的全局变量污染主应用"、"子应用 A 的样式 `.app-header` 把子应用 B 的 `.app-header` 覆盖"。qiankun 通过 `Proxy`（或旧浏览器退化方案）做 JS 沙箱；通过选择器重写 / Shadow DOM 做样式隔离。

理解了上面三件事，你就可以解释：**为什么 micro-app 强调"子应用零改造"**（它在 `<micro-app>` 元素上把 HTML Entry + 沙箱做好了），也能解释 **wujie 为什么强调 Shadow DOM + Web Worker**（它把沙箱做得更深）。

---

## 3. 四个绕不开的核心问题（面试回答的"骨架"）

### 3.1 路由管理（最常见第一道题：子应用的路由怎么和主应用对齐？）

#### 3.1.1 推荐模型："主应用 = 顶层路由；子应用 = 子路由"

- 主应用的路由：`/app-react/*` → 激活 React 子应用；`/app-vue/*` → 激活 Vue 子应用；
- 子应用内部路由：`/app-react/home`、`/app-react/about` 等由子应用自己管；
- 关键点：**子应用的 `basename/routerBase` 必须与 `activeRule` 对齐**（否则 404）。

React Router 版：

```jsx
// app-react 挂载时传入 basename
<BrowserRouter basename={basename}>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
  </Routes>
</BrowserRouter>
```

Vue Router 版：

```js
// app-vue
new VueRouter({
  mode: 'history',
  base: window.__POWERED_BY_QIANKUN__ ? '/app-vue/' : '/',
  routes,
});
```

#### 3.1.2 主应用如何与子应用路由同步？

- **方案一（推荐）：通过主应用 router-link 跳转**，例如 `<a href="/app-react/about">`。子应用内部的 `router.push` 也能被主应用监听到（因为大家共享同一个 `window.history`）。
- **方案二：主应用发命令，子应用订阅**，用 `initGlobalState` 传 `{ navigateTo: '/xxx' }`，子应用订阅后 `router.push`。

> **常见坑**：子应用 `router.push('/home')` 在 qiankun 下很容易写成**绝对路径 `/home`**，导致"**跳回主应用首页**"。正确做法是：`router.push({ path: './home' })` 或者始终让子应用内部用**相对路径 / 命名路由**，让 `basename` 帮你拼前缀。

#### 3.1.3 Nginx 的关键配置（线上部署时）

```nginx
server {
  listen 80;
  server_name main.xxx.com;

  # 主应用（Vue/React 构建产物）
  location / {
    root /var/www/main-app;
    index index.html;
    try_files $uri $uri/ /index.html;
  }

  # React 子应用（与 activeRule /app-react 对齐）
  location /app-react/ {
    alias /var/www/app-react/;
    index index.html;
    try_files $uri $uri/ /app-react/index.html;

    # 允许跨域（qiankun 要 fetch 子应用 HTML）
    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Credentials true;
    add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
    if ($request_method = OPTIONS) { return 204; }
  }

  # Vue 子应用
  location /app-vue/ {
    alias /var/www/app-vue/;
    index index.html;
    try_files $uri $uri/ /app-vue/index.html;

    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Credentials true;
    if ($request_method = OPTIONS) { return 204; }
  }
}
```

### 3.2 JS 沙箱（qiankun 的核心价值之一）

> **面试常用回答**："微前端如果不用沙箱，最大的问题是**全局变量污染**——子应用 A 声明了 `window.App = {...}`，子应用 B 再写一次，A 的就被覆盖了；更危险的是**事件监听**（子应用 unmount 后没有 `removeEventListener`，主应用会收到脏事件）、**定时器**（没有清理会导致内存泄漏）、**location 劫持**等。
>
> qiankun 的沙箱实现有三种：`LegacySandbox`（快照沙箱，老浏览器，单应用）、`ProxySandbox`（用 Proxy 代理 window，读写都走代理）、`SnapshotSandbox`（类似 Legacy，做 diff）。核心思路是：**子应用对 window 的写入都写到 proxy 上，不真正污染原生 window**；卸载时把 proxy 销毁/重置。

#### 3.2.1 自己动手：极简沙箱概念版（面试常被问到"你能不能写一个？"）

```js
// 这是一个"能讲清原理"的极简实现，非生产代码
class SimpleProxySandbox {
  constructor(name) {
    this.name = name;
    // 记录子应用对 window 的写入，不真写 window
    this.fakeWindow = {};
    const rawWindow = window;

    this.proxy = new Proxy(this.fakeWindow, {
      get(target, key) {
        if (key === 'window' || key === 'self') return this.proxy;
        if (key in target) return target[key];
        // 没写入过的，fallback 到真实 window
        const value = rawWindow[key];
        return typeof value === 'function' ? value.bind(rawWindow) : value;
      },
      set(target, key, value) {
        target[key] = value;   // 写进 fakeWindow，不污染真 window
        return true;
      },
      has(target, key) {
        return key in target || key in rawWindow;
      },
    });
  }
  active() { return this.proxy; }
  inactive() { this.fakeWindow = {}; }
}

// 使用：子应用脚本执行时在 with(this.proxy) { /* code */ } 内执行
// 真实项目里会配合 (0, eval)(scriptText) 执行，with 语句配合 proxy 捕获所有 window 读写
```

> **面试再追问**：Proxy 可以拦截 `window.foo = 1`，但是 `function foo(){}` 这种"隐式声明的全局变量"抓不到——解决方案是用 `with (proxy) {}` 包整个脚本执行，或者在子应用严格禁用隐式全局（`'use strict'` + `no-undef` eslint 规则），或者使用 `vm.Script` / `new Function` 等手段。这也是为什么 qiankun/micro-app/wujie 都会强调"请避免滥用隐式全局变量"。

### 3.3 样式隔离

| 方案 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **CSS Module / Scoped CSS**（子应用自身约束） | `.button[data-v-hash]` 或 `:local(.button)` | 零侵入，生态成熟 | 只能约束自己；第三方库（antd/element）的全局样式仍然冲突 |
| **CSS 命名空间前缀** | `.app-react__button` `.app-vue__button` | 简单粗暴有效 | 改造成本大；第三方库仍要处理 |
| **qiankun 实验性样式隔离** | `experimentalStyleIsolation: true` | qiankun 自动把子应用样式规则前加选择器（`.app-name h1 {}`） | 有性能损耗；对 `.body { background }` 等全局选择器只能做有限保护；官方叫"experimental" |
| **Shadow DOM 严格样式隔离** | `strictStyleIsolation: true` | 真正完全隔离 | antd Modal / el-dialog / Portal 组件默认插到 document.body，会跑到 Shadow DOM 外面，样式丢失；组件库适配成本高 |
| **CSS-in-JS（Styled-components / Emotion / Vue scoped 类似）** | 每个组件生成唯一类名 | 子应用自身的样式很干净 | 与"样式"问题一样无法解决第三方库；且 runtime 有成本 |
| **动态注入/卸载 `<style>`** | 子应用 mount 时注入；unmount 时移除 `<link>` / `<style>` | 成本低，对"切应用"场景非常有效 | 不解决"同一时刻两个子应用都挂着"的冲突（singular=true 时不发生）；要配构建工具能识别子应用的样式资源 |
| **postcss 插件统一加前缀**（生产环境最推荐的折中方案） | 对业务 CSS 自动加 `.app-name` 前缀，对 antd 等单独走 babel-plugin-import + 主题变量 | 改造小、可控性强 | 需要约定和 CI 检查；第三方库样式仍要单独处理 |

**生产实战中我会用的组合策略**（面试说这句话加分）：

> "我会用 '**postcss 前缀 + qiankun.experimentalStyleIsolation + 动态注入/卸载 `<link>`**' 三层组合：业务代码靠 postcss 加前缀，antd / element 靠 `babel-plugin-import` + 主题变量做可控样式；再由 qiankun 的实验性样式隔离做一层兜底；子应用切换时动态卸载 `<style>`/`<link>` 节点，避免长驻导致样式表膨胀。"

PostCSS 前缀示例：

```js
// postcss.config.js（子应用端）
const path = require('path');
const pkg = require('./package.json');

module.exports = {
  plugins: [
    require('postcss-prefix-selector')({
      prefix: `.${pkg.name}`,              // 业务样式统一加 .app-react 前缀
      transform(prefix, selector, prefixedSelector) {
        // html/body 不做前缀（否则 .app-react body 会匹配不到）
        if (selector.match(/^(html|body)/)) return selector;
        // 已经有前缀的不重复加
        if (selector.startsWith(prefix)) return selector;
        return prefixedSelector;
      },
      exclude: [/node_modules/],            // 第三方库另走 babel-plugin-import + 主题
    }),
    require('autoprefixer'),
  ],
};
```

### 3.4 应用间通信（父子、子子通信）

> **面试常用回答**："微前端里通信分两类：**父子通信**（主应用 ↔ 子应用）和**子子通信**（子应用 A ↔ 子应用 B）。父子用 qiankun 的 props 传初值 + `initGlobalState` 做订阅；子子之间我会让它们都通过主应用的全局 store 做"中转"——谁想发消息就 `setGlobalState`，谁想监听就 `onGlobalStateChange`。
>
> 不推荐直接 `window.parent` 或 `window.frames` 硬写，耦合太强；也不推荐事件总线（`window.dispatchEvent(new CustomEvent(...))`）长期作为主方案——扩展性差、难追踪。

#### 3.4.1 全局 store（qiankun 自带）

```js
// 主应用
const { setGlobalState, onGlobalStateChange } = initGlobalState({
  user: null, token: '', theme: 'light', permissions: [],
});

// 子应用
export async function mount(props) {
  props.onGlobalStateChange((state, prev) => {
    if (state.theme !== prev.theme) applyTheme(state.theme);
    if (state.user !== prev.user) rerenderHeader(state.user);
  }, true); // true = 立即收到当前 state

  // 子应用也可以写入（例如"子应用内退出登录"）
  document.getElementById('logout-btn').onclick = () => {
    props.setGlobalState({ user: null, token: '' });
  };
}
```

#### 3.4.2 更结构化的做法（生产推荐）：封装一层 service

```js
// main-app/src/services/micro-frontend.js
import { initGlobalState } from 'qiankun';

const initialState = { user: null, token: '', theme: 'light', permissions: [] };
const { onGlobalStateChange, setGlobalState, offGlobalStateChange } = initGlobalState(initialState);

// 主应用对外 API（统一封装，避免业务直接 setGlobalState 一把梭）
export const microApp = {
  getUser()      { return initialState.user; },
  setUser(user)  { setGlobalState({ user }); },
  setTheme(theme){ setGlobalState({ theme }); },
  setToken(token){ setGlobalState({ token }); },
  subscribe(fn)  { const key = Math.random().toString(36).slice(2); onGlobalStateChange(fn); return key; },
  unsubscribe(key) { offGlobalStateChange(key); },
};

window.__MICRO_APP__ = microApp;
```

这样任何子应用只要读 `window.__MICRO_APP__` 就行，不用关心底层是 qiankun/micro-app/wujie。

#### 3.4.3 子子通信的最佳实践

- 子子之间**不要直接调用**对方的方法（会强耦合，拆应用就白拆了）；
- 约定"事件名 + payload"的语义接口；由主应用的全局 store 做转发；
- 若数据量极大（如视频流 / 大文件共享），走 `BroadcastChannel` / `SharedWorker` / `localStorage` + `storage` 事件，但要注意持久化风险与跨域限制。

```js
// 子应用 A 发消息（比如"我更新了购物车数量"）
window.__MICRO_APP__?.setGlobalState({ cart: { count: 5, updatedAt: Date.now() } });

// 子应用 B 订阅
window.__MICRO_APP__?.subscribe((state, prev) => {
  if (state.cart?.count !== prev?.cart?.count) {
    document.getElementById('cart-badge').textContent = state.cart.count;
  }
});
```

---

## 4. 公共依赖与共享能力（决定"拆完能不能比原来更快"）

### 4.1 共享的三种形态

| 形态 | 做法 | 适用 |
| --- | --- | --- |
| **运行时共享（外部化 external）** | `externals` + `<script>` 全局注入；`window.React` | 体积大、版本统一的库（react/antd/lodash） |
| **构建时共享（dll）** | `webpack.DllPlugin` + `DllReferencePlugin` | 开发时加速；已被 Module Federation/ESM CDN 取代 |
| **Module Federation** | `exposes` + `remotes` | 大规模组件/模块级共享 |

### 4.2 推荐方案 A：主应用注入 externals + 子应用声明 external

主应用 HTML：

```html
<!-- main-app/index.html -->
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script crossorigin src="https://unpkg.com/antd@4.x/dist/antd.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/antd@4.x/dist/antd.min.css" />
```

每个子应用的 webpack：

```js
// webpack.config.js（子应用端）
module.exports = {
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    antd: 'antd',
  },
};
```

优点：简单、体积小、一次加载全站复用；缺点：**版本必须统一**（主应用升 React 18，所有子应用也得升；这个决策要放在"架构委员会"级）。

### 4.3 推荐方案 B：Module Federation（子应用互相暴露模块）

主应用 webpack 配置：

```js
// main-app/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'mainApp',
      remotes: {
        'app-react': 'appReact@http://localhost:8001/remoteEntry.js',
        'app-vue':   'appVue@http://localhost:8002/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, eager: true },
        'react-dom': { singleton: true, eager: true },
        'antd': { singleton: true },
      },
    }),
    new HtmlWebpackPlugin({ template: './public/index.html' }),
  ],
};
```

子应用暴露组件：

```js
// app-react/webpack.config.js
new ModuleFederationPlugin({
  name: 'appReact',
  filename: 'remoteEntry.js',
  exposes: { './Button': './src/components/SharedButton' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
});
```

主应用消费：

```jsx
// main-app/src/views/UseShared.jsx
import React, { lazy, Suspense } from 'react';
const SharedButton = lazy(() => import('app-react/Button'));

export default function UseShared() {
  return (
    <Suspense fallback="loading remote component...">
      <SharedButton>跨应用按钮</SharedButton>
    </Suspense>
  );
}
```

> **面试追问常见陷阱**：Module Federation 的 `shared` 是在"运行时"解决共享依赖版本的；如果多个子应用都要 `react@18`，它会在运行时挑一个最高版本的实例共享给大家。`singleton: true` 意味着"**只允许一个实例**"——对 React 这种有内部状态的库是必须的（两个 React 实例共存会导致 hook 状态错乱）。`eager: true` 表示"启动时就加载这个共享模块"，适合主应用的基础依赖；如果关掉，它会等真正 `import` 时再拉。

---

## 5. 状态管理（Vuex / Pinia / Redux / Zustand 在微前端下怎么共存）

> **面试常用回答**："状态我会分三层：
>
> 1. **全局共享态**（user / token / theme / permissions）→ 主应用 `initGlobalState` 或主应用的 Redux/Pinia；
> 2. **业务域态**（购物车/订单等）→ 对应的子应用自己管，跨子应用需要时走全局 store 的"事件接口"；
> 3. **局部组件态** → 完全不共享，useState / ref 自管。
>
> 原则：**能不共享就不共享**。跨子应用共享状态 = 跨团队契约 = 高维护成本，应当做最小化。"

### 5.1 React 子应用（Zustand 最简示例）

```js
// app-react/src/store/useUser.js
import { create } from 'zustand';

// 从 qiankun props 中拿到初始 user
export const useUser = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

// 在 mount 时做一次"同步"
export async function mount(props) {
  props.onGlobalStateChange((state) => {
    useUser.getState().setUser(state.user);
  }, true);
}
```

### 5.2 Vue 子应用（Pinia 示例）

```js
// app-vue/src/store/user.js
import { defineStore } from 'pinia';

export const useUser = defineStore('user', {
  state: () => ({ user: null }),
  actions: {
    setUser(user) { this.user = user; },
  },
});

// main.js 内订阅 qiankun global state
export async function mount(props) {
  const userStore = useUser();
  props.onGlobalStateChange((state) => userStore.setUser(state.user), true);
}
```

---

## 6. 部署策略（很多人做到这里才发现"上线卡住了"）

### 6.1 三种部署形态

| 形态 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **同域部署（推荐生产方案）** | `main.xxx.com/` 主应用；`main.xxx.com/app-react/` 同域下的子路径 | 没有跨域；cookie 天然携带；Nginx `alias` 即可 | 需要统一域名；子应用部署时要注意 `publicPath` 对齐前缀 |
| **主应用 + 子应用独立域名** | `main.xxx.com`，`app-react.xxx.com`，`app-vue.xxx.com` | 部署最解耦；子应用独立发布 | 跨域需处理（CORS / credentials）；cookie 要走 `SameSite=None; Secure`；子应用之间 cookie 不共享 |
| **微前端网关层** | 在 Node BFF 层按路径拼接返回 HTML（SSR 场景常用） | 能做统一鉴权、统一降级、统一注入公共脚本 | BFF 要维护；复杂度较高 |

### 6.2 同域部署的 Nginx 参考（已在 §3.1.3 给出）

关键三件事：

1. 每个子应用用 `alias + try_files` 各自回自己的 `index.html`；
2. 每个子应用 `add_header Access-Control-Allow-Origin * always`（qiankun fetch HTML 需要）；
3. `publicPath` / `basename` 与 Nginx 前缀一致（即 `/app-react/` 这种末尾带斜杠的路径很重要，否则子应用的相对资源会算到根上）。

### 6.3 资源哈希与长期缓存（部署的另一关）

```js
// 子应用 webpack output
output: {
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].chunk.js',
  publicPath: '/app-react/',   // 与 Nginx 前缀一致
},
```

> **生产小经验**：部署时不要覆盖旧文件（`mv dist dist.old && cp new dist`），等 5~10 分钟再删旧文件，否则正在浏览的用户请求旧 hash 的 JS 会 404。

---

## 7. 性能优化（微前端很容易变慢，需要主动做几件事）

> **面试常用回答**：微前端相比单应用多了"主应用启动 + 子应用资源 fetch + 脚本执行"三次成本。优化我会分四类做：

### 7.1 资源加载优化

- **prefetch**：qiankun `start({ prefetch: 'all' })` 或自定义 `prefetch:'all'/'condition'`；
- **HTTP2 + CDN**：子应用资源上 CDN，多路复用；
- **DNS / TCP 预连接**：

```html
<link rel="dns-prefetch" href="//cdn.xxx.com" />
<link rel="preconnect" href="//cdn.xxx.com" />
```

- **按需加载**：子应用内部也做 `React.lazy / defineAsyncComponent`，主路由不打包业务页。

### 7.2 公共依赖 external / shared

- React / Vue / antd / element 这种"每个子应用都要"且体积大的库，external 到 `<script>` 注入；
- 或走 Module Federation 的 `shared` 做共享；
- 极端场景：**dll + manifest.json**（已不如 MF 优雅，但在 webpack 4 老项目仍有用）。

### 7.3 首屏体验优化

- **loading**：qiankun `beforeLoad` 开一个全局 loading，`afterMount` 关；
- **骨架屏**：主应用先渲染"假的子应用布局"，子应用 mount 后再替换；
- **首屏子应用的资源 inline**：把首屏关键 CSS / 小 JS 直接写到 HTML；
- **避免"子应用一上来就拉全量权限字典/全量配置"**：按路由懒加载。

### 7.4 缓存命中

- `output.contenthash` → 保证代码未变时 hash 不变；
- **runtimeChunk: 'single'** → 把 webpack runtime 抽成独立文件，减少业务 chunk 的 hash 抖动；
- **HTML 不缓存**（`Cache-Control: no-cache`），`js/css` 设成一年长缓存（`Cache-Control: public, max-age=31536000, immutable`）。

### 7.5 性能监测（非常适合面试收尾）

- 用 `performance.mark/measure` 打点：

```js
performance.mark('subapp-load-start');
registerMicroApps([...]);
performance.mark('subapp-mount-end');
performance.measure('subapp-mount', 'subapp-load-start', 'subapp-mount-end');
console.log(performance.getEntriesByName('subapp-mount')[0].duration);
```

- 配合 Sentry / 自研监控面板：上报首屏 TTI、子应用切换耗时、错误率；
- 做阈值报警："子应用平均加载 > 3s 就报警"。

---

## 8. 典型坑与解决思路（面试官很爱问"你踩过哪些坑？"）

### 8.1 资源路径错乱（最常见的首坑）

- 表现：子应用的图片/字体 404，或者路由看起来正常但资源走了主应用 URL；
- 根因：`publicPath` 与 Nginx 前缀不一致；
- 解决：顶部注入 `public-path.js`（已在 §2.2 展示），构建产物 `output.publicPath` 与 Nginx location 一致。

### 8.2 antd/element 等弹窗组件跑到子应用外面（样式沙箱问题）

- 根因：它们默认 `getContainer = () => document.body`；Shadow DOM 下 body 不是 Shadow DOM，样式被隔离了。
- 解决：统一用 `getContainer` 指向子应用挂载节点或主应用提供的"公共 modal 容器"。

```jsx
// React 子应用
<Modal getContainer={() => document.getElementById('app-react-root')}>
  hello
</Modal>
```

```vue
<!-- Vue 子应用 -->
<el-dialog :append-to-body="false" :modal-append-to-body="false" :get-popup-container="() => $el"></el-dialog>
```

### 8.3 全局事件与定时器泄漏（JS 沙箱的补充）

- 根因：子应用 unmount 时没有 `removeEventListener / clearInterval / clearTimeout / clearImmediate`；
- 解决：**在子应用自己的 unmount 里显式清理**（这是 qiankun 沙箱不帮你做的事）：

```js
// 建议每个子应用都有一个"泄漏收集器"
const disposables = [];
disposables.push(() => window.removeEventListener('resize', onResize));
disposables.push(() => clearInterval(timer));
export async function unmount() {
  disposables.forEach((fn) => fn());
  disposables.length = 0;
  root.unmount();
}
```

### 8.4 cookie / 鉴权跨域

- 根因：主应用在 `main.xxx.com`，子应用接口在 `api.xxx.com`；浏览器 SameSite/Lax 策略导致 cookie 不被带过去；
- 解决：**要么同域部署，要么 `Set-Cookie` 时加上 `SameSite=None; Secure; Domain=xxx.com`**，并在 fetch 中 `credentials: 'include'`。

### 8.5 `history.pushState` 与路由回退

- 根因：qiankun 内部会监听 `popstate` 并触发子应用的挂载/卸载；子应用如果手动 `history.pushState`，有时会触发"切换子应用时白屏"；
- 解决：统一用子应用的路由库（`router.push`）而不是直接操作 `history`；有问题时在 qiankun `afterUnmount` 打印日志定位。

### 8.6 子应用与主应用版本不一致（最隐蔽的坑）

- 根因：主应用升级了"全局 API"但忘记同步子应用，子应用读到 `window.__MICRO_APP__.xxx` 为 undefined；
- 解决：**封装 API 时做版本兼容 + 做一次"启动阶段健康检查"**：

```js
export async function mount(props) {
  if (!props?.onGlobalStateChange) {
    throw new Error('[app-react] 主应用版本过低，请升级主应用');
  }
}
```

---

## 9. 面试回答的完整叙事模板（按这个顺序复述即可）

> 下面是你可以直接照读的"面试回答脚本"。建议配合代码示例一起讲。

### 9.1 开场：为什么要做微前端？

"在我们项目里，有 3 个团队分别维护一个大应用的三块模块，一个用 Vue2、一个用 Vue3、一个用 React。随着业务增长，一个 Git 仓库 + 一次构建要 10 分钟，一个线上 bug 修复要等待全量发布，跨团队的协作成本太高。
所以我们选择做微前端——**把巨石应用拆成若干可独立开发/部署/运行的子应用，由一个基座负责生命周期管理、路由分发、资源加载与公共服务共享**。"

### 9.2 技术选型：为什么选这条路线？

"当时我对比了 qiankun、micro-app、wujie、Module Federation、iframe：

- **iframe** 隔离最彻底，但路由同步/弹窗/滚动体验都要补大量工作，且首屏性能差；
- **qiankun** 社区最成熟、接入成本中等，HTML entry + Proxy 沙箱够用；
- **micro-app** 接入成本更低，对 Web Components 更友好；
- **wujie** 的 Shadow DOM + Web Worker 沙箱最深，但对老应用的适配更复杂；
- **Module Federation** 是模块级联邦，适合跨应用组件/库共享，不适合作为"路由级应用容器"的主方案。

最终我们选 **qiankun 作为主路由容器 + Module Federation 作为模块共享层**，兼顾"拆应用"与"共享组件"两种诉求。"

### 9.3 接入骨架（指着你写的代码讲）

讲主应用 `registerMicroApps`、`start({ sandbox, prefetch })`，然后讲一个子应用的 `public-path.js`、`bootstrap/mount/unmount`、`basename` 与 `activeRule` 的关系。

### 9.4 四大问题（路由/沙箱/样式/通信）

按本文 §3 的顺序讲：路由怎么对齐、沙箱用什么原理、样式怎么组合策略、通信怎么走全局 store。

### 9.5 共享依赖与状态管理

讲 `external + <script>` 或者 `Module Federation shared`，状态分三层（全局/业务域/局部）。

### 9.6 部署策略

讲同域部署的 Nginx 配置，publicPath、contenthash、runtimeChunk。

### 9.7 性能优化与监控

讲 prefetch/CDN/loading/骨架屏/性能测量与 Sentry 上报。

### 9.8 踩过的坑

挑 3 个你项目里真的踩过的坑（资源路径 / antd Modal / 事件泄漏），讲"表现→根因→解决→预防"。

### 9.9 量化成果（面试加分项）

> "做完之后，我们实际拿到的数据是：
> - 单应用构建时间：从 **10 分钟 → 1.5 分钟**（因为每个子应用只有自己的代码）；
> - 发布频率：从 **每周 1 次 → 每日多次**；
> - 线上首屏 TTI：从 **5.8s → 2.6s**；
> - 子应用切换耗时：**< 500ms**；
> - 事故影响面：从"一个 bug 全站挂掉" → "挂掉的只是一个子应用，其他业务不受影响"。
>
> 这个数据我觉得是微前端最有价值的成果。"

---

## 10. 面试高频追问速查（Q&A）

**Q1：微前端与 Monorepo 是什么关系？**
微前端是"运行时拆分"，Monorepo 是"源码组织形式"。两者可以并存：Monorepo 里放多个子应用 + 一个主应用，共享构建配置/ESLint/工具库；运行时由主应用按需加载子应用。

**Q2：qiankun 支持 SSR/Next.js/Nuxt 吗？**
官方支持有限。一般做法：**SSR 只管首屏 HTML 吐出，hydrate 后交给前端路由跑 qiankun**；或者"主应用 SSR，子应用 SPA"模式（会复杂一些）。Nuxt 可以自定义 `routes` + `extendWebpack` 暴露生命周期。

**Q3：qiankun 的 HTML entry 和常见的 JS entry 有什么区别？**
JS entry 需要你手动指定每个子应用 `scripts/styles` 数组，且 `css/js` 的 hash 变化会让你频繁改配置；HTML entry 由 `import-html-entry` 去解析最终 HTML，能自动处理 hash、懒加载 chunk、CSS 动态插入，对生产部署更友好。

**Q4：为什么子应用必须允许跨域？**
qiankun 要 `fetch(entry)` 拿到子应用 HTML，浏览器同源策略会阻止。所以子应用的 `devServer.headers['Access-Control-Allow-Origin'] = '*'` 或 Nginx 加 CORS。

**Q5：子应用切换时，如何确保前一个子应用被正确卸载？**
要点三个：1) React/Vue 的 unmount；2) 事件/定时器/订阅手动清理（自己写 disposables）；3) qiankun 的 `afterUnmount` 钩子做断言/日志。

**Q6：`start({ singular: true })` 是什么？为什么推荐打开？**
singular=true 意味着"**同一时刻只允许一个子应用在跑**"——大多数 B 端场景都是"一个菜单 = 一个子应用"，打开后沙箱更稳、性能更好、样式冲突概率更低。需要"两个子应用同屏（页面拼图）"时才关掉。

**Q7：Module Federation 和 qiankun 冲突吗？**
不冲突。通常的组合是：**qiankun 管路由/容器/生命周期**（应用级），**Module Federation 管组件/模块级共享**。比如主应用提供一个 `@shared/header`，React/Vue 子应用都可以 `import Header from '@shared/header'`。

**Q8：微前端下怎么做单点登录（SSO）与权限控制？**
主应用做登录/鉴权：OAuth2/OIDC、CAS、Cookie JWT 任一方案都行；主应用拿到 token/permissions 后，通过 `initGlobalState` 注入或挂载到 `window.__MICRO_APP__` 暴露给子应用。子应用里的路由守卫/按钮权限只读取"主应用传来的权限表"，不自己发登录请求。

**Q9：微前端怎么做埋点？**
主应用注入一份"埋点 SDK"（`window.track(event, payload)`），统一带 `appName` 上下文；子应用只调用 `window.track('click', { page: 'home' })`，主应用负责 session、user、采样率、batch 上报等。这样所有子应用的埋点口径一致，不会各写各的。

**Q10：微前端怎么处理 404 / 路由兜底？**
主应用最后加一条 `*` → `<NotFound />`，在子应用 mount 失败或 404 时渲染；子应用内部也要各自兜底（React 的 `ErrorBoundary`、Vue 的 `errorCaptured`）。qiankun 提供 `loadAppError` 钩子可接入全局错误面板。

**Q11：微前端和"前端网关/BFF"应该怎么配合？**
BFF 负责"路由匹配 → 注入主应用 HTML → 注入鉴权 cookie"；主应用负责"微前端容器"。可以把主应用的 `registerMicroApps` 配置做成从 BFF 拉取的"配置接口"，做到"新增子应用不用改主应用代码/重新发布主应用"。

**Q12：子应用能同时支持"独立运行"和"嵌入运行"两种模式吗？**
可以（而且推荐）。关键就是 `if (!window.__POWERED_BY_QIANKUN__) render()` 和 `basename` 的差异——子应用 `npm start` 时走 `basename='/'`，独立可运行；在主应用里走 `basename='/app-xxx'`。

**Q13：微前端是不是"银弹"？**
不是。它带来的复杂度是"样式/沙箱/路由/通信 × 多团队"。适用场景：多技术栈并存、需要平滑升级、团队解耦需求明确。**小项目/单团队/同一技术栈**用微前端反而会变慢——拆完会让开发体验、部署流程、调试链路都变复杂。

---

## 11. 我在实际项目中常用的一份"最小可运行骨架"（快速上手 + 面试能展示代码）

### 11.1 主应用（Vue 3 + Vite 示例，能装 qiankun 就行）

```json
// main-app/package.json 关键依赖
{
  "vue": "^3.3",
  "vue-router": "^4.2",
  "qiankun": "^2.10",
  "pinia": "^2.1"
}
```

```js
// main-app/src/main.js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import { registerMicroApps, start, initGlobalState } from 'qiankun';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/Home.vue') },
    { path: '/about', component: () => import('./views/About.vue') },
  ],
});

const app = createApp(App);
app.use(router);
app.use(createPinia());
app.mount('#app');

registerMicroApps([
  {
    name: 'app-react',
    entry: process.env.NODE_ENV === 'production'
      ? '/app-react/'
      : '//localhost:8001',
    container: '#subapp-container',
    activeRule: '/app-react',
    props: { routerBase: '/app-react', apiBase: '/api' },
  },
  {
    name: 'app-vue',
    entry: process.env.NODE_ENV === 'production'
      ? '/app-vue/'
      : '//localhost:8002',
    container: '#subapp-container',
    activeRule: '/app-vue',
    props: { routerBase: '/app-vue', apiBase: '/api' },
  },
]);

const { setGlobalState, onGlobalStateChange } = initGlobalState({
  user: null, token: '', theme: 'light', permissions: [],
});
window.__MICRO_APP__ = { setGlobalState, onGlobalStateChange };

start({
  sandbox: { experimentalStyleIsolation: true, strictStyleIsolation: false },
  singular: true,
  prefetch: 'all',
});
```

```vue
<!-- main-app/src/App.vue -->
<template>
  <div class="main-app">
    <header>
      <router-link to="/">Home</router-link> |
      <router-link to="/app-react">React App</router-link> |
      <router-link to="/app-vue">Vue App</router-link>
    </header>
    <section>
      <router-view v-slot="{ Component }">
        <component :is="Component" v-if="Component" />
      </router-view>
      <div id="subapp-container"></div>
    </section>
  </div>
</template>
```

### 11.2 React 子应用（Webpack 5）

```js
// app-react/src/public-path.js
if (window.__POWERED_BY_QIANKUN__) {
  // eslint-disable-next-line no-undef
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}
```

```js
// app-react/src/main.jsx
import './public-path';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './views/Home';
import About from './views/About';

let root = null;

function render(props = {}) {
  const { container, routerBase } = props;
  const target = container
    ? container.querySelector('#app-react-root')
    : document.getElementById('app-react-root');

  root = ReactDOM.createRoot(target);
  root.render(
    <BrowserRouter basename={routerBase || '/'}>
      <nav>
        <Link to="/">Home</Link> | <Link to="/about">About</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}

if (!window.__POWERED_BY_QIANKUN__) render();

export async function bootstrap() { console.log('[app-react] bootstrap'); }
export async function mount(props) {
  props.onGlobalStateChange && props.onGlobalStateChange((s) => console.log(s), true);
  render(props);
}
export async function unmount(props) {
  const target = props.container
    ? props.container.querySelector('#app-react-root')
    : document.getElementById('app-react-root');
  root.unmount(target);
  root = null;
}
```

```js
// app-react/webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { name } = require('./package');

module.exports = {
  entry: path.resolve(__dirname, 'src/main.jsx'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
    publicPath: `/`,                // 由 public-path.js 动态覆盖
    library: `${name}-[name]`,
    libraryTarget: 'umd',
    globalObject: 'window',
    clean: true,
  },
  resolve: { extensions: ['.js', '.jsx'] },
  module: {
    rules: [{
      test: /\.jsx?$/,
      include: path.resolve(__dirname, 'src'),
      use: [{ loader: 'babel-loader', options: { presets: ['@babel/preset-env', '@babel/preset-react'] } }],
    }],
  },
  plugins: [new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'public/index.html') })],
  devServer: {
    port: 8001,
    historyApiFallback: true,
    hot: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
};
```

```html
<!-- app-react/public/index.html -->
<!doctype html>
<html><body><div id="app-react-root"></div></body></html>
```

> Vue 子应用的 webpack 配置与 React 同构，`library/libraryTarget/globalObject` 一模一样；主应用 `registerMicroApps` 里加一个 activeRule=`/app-vue` 的对象即可。

---

## 12. 收尾一句（面试"总结印象"）

> **我会这样收尾**："整体来看，微前端不是"要不要上"的问题，而是"**你的团队规模、技术栈差异、发布频率是否已经到了必须拆**"的临界点。
>
> 落地时我坚持三个原则：**最小改造接入**（不追求 100% 理论正确，先把容器跑起来）、**一层一层加能力**（先路由/生命周期，再补沙箱/样式，再做共享组件/模块联邦）、**量化结果**（构建时间/发布频率/首屏 TTI/事故影响面，至少记下来再说优化）。
>
> 如果团队规模小、技术栈统一，不建议上；反之，微前端是解决团队协作与技术演进的一条可持续路线。"

---

## 13. 技术路线差异速查（切换面试题的主线时对照用）

| 关注点 | qiankun | micro-app | wujie | Module Federation | iframe |
| --- | --- | --- | --- | --- | --- |
| **接入形态** | 主应用注册 + 子应用暴露生命周期 | `<micro-app>` 自定义元素 | 同样自定义元素 + Web Worker | `exposes/remotes` 配置 | `<iframe src>` |
| **子应用改动量** | 中（暴露生命周期 + publicPath + basename） | 小（基本零改） | 中（暴露生命周期/启用 window.\_\_POWERED_BY_WUJIE\_\_） | 中（exposes/remotes + 动态 import） | 几乎零 |
| **JS 沙箱** | Proxy（Legacy/Snapshot 退化） | Proxy（类似） | Proxy + Web Worker | 不提供；需要自行做 | 浏览器原生 |
| **样式沙箱** | experimental / strict（Shadow DOM） | Shadow DOM / scoped | Shadow DOM | 不提供 | 原生 |
| **通信** | initGlobalState / props | data / window.dispatchEvent / props | props / eventBus | 直接 import 对方导出 | postMessage |
| **跨子应用组件共享** | 要自己实现（UMD/全局/MF） | 同上 | 同上 | 原生支持 | 几乎不可行 |
| **SSR 支持** | 有限（hydrate 后跑微前端） | 有限 | 有限 | 需要配合 SSR 框架 | 天然支持 |
| **调试体验** | 一般（需主/子应用同时起） | 较好（子应用独立跑） | 一般 | 较差（remote 未加载时报错信息隐晦） | 好（独立控制台） |
| **社区/文档** | 丰富（阿里出品） | 较丰富（京东零售） | 在起势 | Webpack 官方文档 | 无文档需求 |
| **生产成熟度** | 高 | 中高 | 中 | 中（依赖版本与 webpack 插件生态） | 极高（浏览器原生） |

---

> **面试建议**：上面内容你不必全背。准备 3 件事最有效：
>
> 1. **一套你亲手跑过的骨架**（主应用 + 1 个 React 子应用 + 1 个 Vue 子应用），能现场演示"刷新 `/app-react/about` 能走、子应用切到主应用不白屏、`window.__MICRO_APP__` 能拿到 user"；
> 2. **一段能讲 15–20 分钟的叙事**（为什么 → 选了啥 → 怎么做 → 遇到哪些坑 → 拿到什么数据）；
> 3. **一张"坑的清单"**（资源路径、Modal、事件泄漏、cookie、路由回退、版本兼容），在面试官追问"你遇到过什么问题"时一个一个讲，每个都要"表现-根因-解决-预防"。
