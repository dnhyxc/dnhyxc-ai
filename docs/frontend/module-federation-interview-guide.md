# Module Federation 动态远程——面试口语版

> 这是一份可以"直接跟面试官聊"的口语化版本，不讲概念定义，直接从问题出发，讲清楚"为什么这么做"、"解决了什么问题"、"我踩过什么坑"。

---

## 面试开头：先抛出一个痛点

"我们先说背景。"

假设你们公司有个后台系统，最开始是一个人维护的 React 单体应用。后来业务扩张，变成了五六个团队一起开发，每次合并代码都跟打仗一样——冲突、回归测试、发布窗口受限。所以你们想拆成独立模块，每个团队管自己的那一块，独立开发、独立部署。

但问题是，拆开之后，这些模块怎么组合起来？用户在浏览器里访问的，始终还是同一个页面，只是不同区域属于不同团队。

主流方案有几个，我了解过：

- **Qiankun / micro-app**：基于 iframe 或 JS 沙箱，做运行时隔离。上手快，但 iframe 性能差，JS 沙箱要处理各种全局变量覆盖，很脆弱，样式隔离也比较麻烦。
- **single-spa**：比较老了，要每个子应用主动"注册 + 激活"，子应用改造量不小。
- **Module Federation（模块联邦）**：Webpack 5 原生出的概念，直接在打包阶段把模块边界打通，运行时像本地 import 一样用远程模块。最吸引我的是——不需要子应用做太多改造。

---

## Module Federation 是什么：跟面试官这么解释

"你可以理解成，Webpack 5 在打包阶段给了我们一个能力：把某些模块标记为'可被外部使用'，同时在运行时可以'加载别人暴露出来的模块'。"

具体有两个角色：

- **Host（主应用）**：负责组合和调度，像一个空的壳子。
- **Remote（子应用）**：负责具体的业务模块，把自己打包成一个可被引用的东西。

```
Host（壳子） ──动态加载──▶ Remote A（结账模块）
                        Remote B（用户中心）
                        Remote C（活动模块）...以后还可以加更多
```

"关键是：Host 打包的时候，并不知道未来会有哪些 Remote 加入。它只需要具备'能够加载远程模块'的能力就行。这个能力来自于 Webpack 5 的 ModuleFederationPlugin。"

---

## 动态远程是什么：为什么不用静态配置

"好的，接下来是动态远程。"

普通的 Module Federation 用法，是 Host 在构建时就声明好"我要加载哪些 Remote"：

```js
// 静态写法——Host 必须在构建期知道 Remote 的 URL
new ModuleFederationPlugin({
  remotes: {
    checkout: 'checkout@https://checkout.xxx.com/remoteEntry.js',
  },
  shared: { react: { singleton: true } },
});
```

"这样做的问题是：每次新增一个子应用，Host 必须改配置、重新 build、重新发布。如果你想让 A 团队随时上线新模块，不需要通知 B 团队，这个方案就不行了。"

**动态远程要解决的就是：Host 构建一次，以后新增 Remote 只需要改一个配置文件，不需要重构建。**

"这听起来像微前端热插拔对吧？实际上确实就是。"

---

## 核心思路：三个关键点

### 第一个：Host 怎么"具备加载能力"而不是"声明加载谁"

"Host 不在代码里声明 remotes，但必须在 plugins 里声明 ModuleFederationPlugin。否则 Webpack 不会在运行时生成 `__webpack_init_sharing__` 这些全局函数。"

但又不能什么都不写——Plugin 至少需要一个占位符：

```js
new ModuleFederationPlugin({
  name: 'shell',
  // 写一个永远不会被真正调用的占位符
  remotes: {
    _placeholder: '_placeholder@about:blank',
  },
  shared: {
    react: { singleton: true, requiredVersion: pkg.dependencies.react },
    'react-dom': { singleton: true },
    'react-router-dom': { singleton: true },
  },
});
```

"面试官可能会问：为什么要占位符？我当时也想了很久，后来才明白——Webpack 5 的共享模块机制（shared scope）是靠 Plugin 在构建期注册到运行时上下文的。只要有 Plugin，就会生成 `__webpack_init_sharing__` 和 `__webpack_share_scopes__` 这两个全局函数，之后的运行时才能调用它们来动态加载 Remote。占位符只是为了让 Plugin 存在。"

### 第二个：运行时路由表 manifest

"Host 启动时，会 fetch 一个 JSON 文件，我们叫它 manifest——就是一张路由表。"

```json
{
  "version": 1,
  "remotes": [
    {
      "name": "checkout",
      "url": "https://checkout.xxx.com/remoteEntry.js",
      "routes": [
        { "path": "/checkout/*", "module": "./CheckoutPage", "title": "结账页" }
      ]
    }
  ]
}
```

"这个文件里写了现在有哪些 Remote、URL 是什么、对应哪些路由。"

"Host 拿到这个 JSON，动态生成路由，然后根据路由懒加载对应的远程模块组件。整个过程都是运行时行为，没有重新 build。"

"新增一个 Remote 怎么做？就是在这个 JSON 里加一条记录，然后把这个 JSON 文件更新到 Host 的静态资源目录。不需要改一行 JS 代码。"

### 第三个：shared 的设计——共享依赖但要避免两套 React

"这是个踩坑重灾区。"

"React / React-dom 必须在 Host 和所有 Remote 之间共享，而且两边版本要一致。否则用户页面上会同时存在两个 React 实例，组件里的 hooks 就全乱了。"

"具体怎么配？两边都声明 `singleton: true`，让 Webpack 只保留一份。如果版本不一致，`requiredVersion` 会让 Webpack 报警告，这时候必须对齐版本。"

---

## shared 配置为什么抽成公共包

"在我们项目里，这个 shared 配置抽成了一个独立包，叫 `mf-config`。"

"原因是：每个 Remote 都要配 shared，而且 react / react-dom 版本要统一管理。如果配在每个项目的 webpack.config.js 里，改一次版本要改六七个地方，不现实。"

"抽成包之后，每个项目只需要一行："

```js
const { MfWebpackPlugin } = require('@xxx/mf-config');
new MfWebpackPlugin({ name: 'checkout', exposes: { './CheckoutPage': './src/...' } });
```

"版本号从哪里来？`mf-config` 内部会自动读调用方的 `package.json`，提取出 `dependencies.react` 的版本号，作为 `requiredVersion` 的值。"

"这样做的好处：新团队接入 Module Federation，不需要知道 shared 要怎么配，也不用担心版本漏配。"

---

## 跨技术栈：React Host 里怎么加载 Vue 组件

"这是个常见问题。我当时也折腾了一阵。"

"Vue 组件和 React 组件的渲染模型不一样——React 是在 DOM 里直接 render，Vue 是创建自己的 app 实例。你不能直接把 Vue 组件丢给 React.lazy 用。"

"解决方案是让 Vue 组件对外暴露一个 mount 函数，而不是一个组件对象："

```js
// Vue Remote 端导出 mount 工厂函数
export default function mountProfilePage(el, props) {
  const app = createApp({ /* Vue 组件 */ });
  app.mount(el);
  return {
    update(nextProps) { /* props 更新逻辑 */ },
    unmount() { app.unmount(); },
  };
}
```

"React Host 端写一个通用的 VueBridge 组件："

```jsx
function VueBridge({ name, url, module, props }) {
  const elRef = useRef(null);

  useEffect(() => {
    const factory = await loadRemoteModule({ name, url, module });
    instanceRef.current = factory(elRef.current, props);
    return () => instanceRef.current?.unmount();
  }, [name, url, module]);

  return <div ref={elRef} />;
}
```

"这样 Vue 组件在自己的 app 实例里渲染，和 React 完全隔离，卸载时也能正确清理。"

---

## 部署流程：新 Remote 怎么上线

"我跟面试官讲一下我们实际怎么操作的。"

1. Remote 团队自己 build：`npm run build`，得到 `remoteEntry.js` 和一些 chunk。
2. 部署到 CDN：`https://checkout.xxx.com/remoteEntry.js`，保证这个 URL 可访问。
3. 更新 manifest JSON：在 `remotes` 数组里追加一条 `{ name, url, routes }`。
4. 只把 JSON 文件同步到 Host 的静态资源目录。

"第 3 步和第 4 步加在一起，叫'新 Remote 无须改 Host 代码发布'。Host 不需要 rebuild，不需要重启，用户刷新浏览器就能看到新的 Remote。"

"这个过程里有一个细节：`remoteEntry.js` 的 HTTP 响应头必须禁止缓存，因为每次 Remote 发版，这个文件的 hash 会变，如果浏览器用了旧缓存，加载的就是旧的 Remote。我们配的是 `Cache-Control: no-cache`。"

---

## 生产环境踩过的坑

### 坑 1：刷新页面 404

"这种情况最常见。"

"原因是 BrowserRouter 的 history 模式依赖服务端 fallback——所有路径都应该 fallback 到 `index.html`。Host 的 Nginx 如果没配 `try_files $uri $uri/ /index.html`，用户直接访问 `/checkout` 就会 404。"

### 坑 2：CORS 被浏览器拦截

"Remote 的 `remoteEntry.js` 必须允许 Host 域的跨域请求。Nginx 里加 `Access-Control-Allow-Origin`。"

"还有一点——`script` 标签要带 `crossOrigin='anonymous'`，否则 Webpack 的 shared scope 协商会失败。"

### 坑 3：远程组件报 Invalid hook call

"基本上是 React 版本不一致，或者 shared 没有加 `singleton: true`，导致页面上有两个 React 实例。"

"排查方法：控制台打印 `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` 的 `_renderers` 长度，大于 1 就说明有多个实例。"

### 坑 4：manifest 加载失败导致白屏

"manifest 是运行时依赖，如果加载失败（比如网络问题或 JSON 格式错误），不能把整个 Host 搞挂。"

"我们的做法是 manifest fetch 加 try-catch，失败时降级到空路由表，保证 Host 能启动，只是远程模块区域显示加载失败。"

---

## 面试官可能追问的问题和我的回答

**Q：为什么不直接用 iframe？**
"A：iframe 性能差，样式隔离虽然好做，但通信困难，URL 不同步，用户体验割裂。JS 沙箱方案（Qiankun）能解决一部分，但全局变量劫持的边界情况多，第三方 SDK（比如地图、微信 SDK）经常出问题。Module Federation 不需要沙箱，因为 webpack 打包层面的模块隔离本来就做到了。"

**Q：remoteEntry.js 加载失败怎么办？**
"A：我们在 `loadRemote` 函数里对 script load 事件加了错误监听，失败时会 reject。组件层面有 `RemoteFallback` ErrorBoundary 兜底，不影响整个页面。"

**Q：多个 Remote 同时发布，怎么保证兼容性？**
"A：manifest 支持灰度字段，可以按百分比切流量，让一部分用户先跑新版本，没问题再全量。同时 Webpack 的 shared scope 会在加载时协商版本，如果主应用用的是 react@18.2，Remote 用 18.3，只要 major 版本一致就可以协商通过。"

**Q：Remote 之间的依赖共享怎么处理？**
"A：如果两个 Remote 都需要 lodash，不会让它们各自打包一份，而是通过 shared 的非 singleton 模式——允许版本共存，但不会两份代码都加载。Webpack 5 的 shared scope 机制会选择一个兼容版本，或者两者都加载（non-singleton 模式）。"

**Q：热更新怎么做的？**
"A：Remote 发版后，新的 `remoteEntry.js` 有了新的 contenthash，浏览器加载新的文件后，组件也就更新了。因为 remoteEntry.js 本身禁止缓存，所以发版后用户刷新拿到的就是最新代码。"

---

## 总结：动态远程的核心价值

"我觉得动态远程方案最大的价值，不是技术本身有多复杂，而是它解决了一个组织协作问题："

"以前新增一个模块，需要全团队协调发布窗口。现在每个团队可以自主决定什么时候发自己的模块——只需要告诉主应用'我上线了一个新模块'（改一行 JSON），主应用的用户刷新就能用到。"

"这背后依赖的是 Webpack 5 Module Federation 的运行时模块加载能力，加上我们设计的那张运行时路由表 manifest，以及一个足够健壮的 shared scope 机制。"

"整套方案下来，我认为是一个可以在生产环境跑的、真正支持热插拔的微前端架构。"
