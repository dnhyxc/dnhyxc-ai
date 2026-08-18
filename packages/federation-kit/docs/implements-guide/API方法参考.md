# 方法级 API 详解（federation-kit）

> **一句话**：把微前端链路里**每一个关键方法**说清楚——做什么、为了什么、参数/返回、谁调谁、副作用、失败时怎样。  
> **入口**：读完 [01 总览](./架构概览.md) 后，用本文当「字典」查具体函数。  
> **关联源码**：`packages/federation-kit/src/**`、`apps/frontend/src/federation/**`。  
> **非目标**：不重复粘贴整文件逐行附录（见 02–05）；本文专注**方法语义**。

---

## 0. 先看：主调用链与状态

### 0.1 主链（记住这一条）

```text
createFederation(options)
  └─ createPluginRuntime(config)
       └─ PluginManager
            ├─ init() / start()          → 挂「壳」+ eager 预加载
            ├─ ensurePlugin(id)          → 页面进入时「保证已激活」
            │    └─ resolvePluginBust()  → 算缓存指纹
            │    └─ loadPlugin()         → 去重 / 重载编排
            │         └─ runLoad()       → 真正加载流水线
            │              ├─ verifyPlugin
            │              ├─ registerRemote
            │              ├─ beginPluginStyleCapture  ←┐
            │              ├─ loadRemoteApp              │ 短窗
            │              └─ endCapture  ───────────────┘
            │              └─ createHostBridge + activate
            └─ unloadPlugin / setEnabled

挂载 UI：PluginHostView
  ├─ ensurePlugin
  └─ attachPluginStyleIsolation  → 长窗 CSS + Portal
```

### 0.2 `LoadedPlugin.status` 状态机

| 状态 | 含义 | 进入条件 |
|------|------|----------|
| `loading` | 正在跑 `runLoad` | `runLoad` 开头写入 |
| `activated` | 可渲染 / untrusted 已就绪 | `runLoad` 成功 |
| `failed` | 加载失败，带 `error` | `runLoad` catch |
| `unloaded` | 已停用，壳已拆 | `unloadPlugin` |

### 0.3 两个容易混的概念

| 概念 | 含义 |
|------|------|
| **壳（shell）** | 只注入路由/侧栏，**不**下载 Remote JS（`mountShell`） |
| **肉（load）** | `runLoad`：校验 + MF 下载 + activate |
| **bust** | 缓存指纹字符串，形如 `1.2.0@a1b2c3`；同 bust 且已 activated → 跳过重载 |

---

## 1. 模块联邦加载：`mf/mf.ts`

### 1.1 `withBust(url, bust)`

| 项 | 说明 |
|----|------|
| **作用** | 给任意 URL 写入或覆盖查询参数 `v=<bust>`。 |
| **目的** | 打破浏览器 / WKWebView 对固定文件名（如 `remoteEntry.js`）的强缓存，保证发新包后能拉到新脚本。 |
| **签名** | `withBust(url: string, bust: string): string` |
| **参数** | `url`：manifest 或 remoteEntry 地址；`bust`：指纹（空则原样返回）。 |
| **返回** | 带 `?v=` 的 URL；非法 URL 时手工拼 query。 |
| **谁调谁** | ← `fetchManifestMeta` / `registerRemote` / `bustRemoteEntryPlugin.afterResolve`；→ `URL` API。 |
| **副作用** | 无（纯函数）。 |
| **失败** | 几乎不抛；非法 URL 走字符串回退。 |

**为何需要**：MF 运行时有时会把 entry 改写成无 query 的 `…/remoteEntry.js`，若不补 `v=`，客户端会一直用旧文件。

---

### 1.2 `pluginBust(meta, buildId?)`

| 项 | 说明 |
|----|------|
| **作用** | 把「插件版本 + 可选构建指纹」拼成可读的 bust 字符串。 |
| **目的** | 给 `ensurePlugin` / `loadPlugin` 一个**可比较**的 token，判断「要不要重新加载」。**故意不用** Host registry 的 `updatedAt`——发布者只更新自己域名静态资源即可失效缓存。 |
| **签名** | `pluginBust(meta: Pick<PluginDescriptor, 'version'>, buildId?: string): string` |
| **参数** | `meta.version`：语义化版本；`buildId`：通常是 manifest 内容 hash。 |
| **返回** | `"1.2.0"` 或 `"1.2.0@deadbeef"`。 |
| **谁调谁** | ← `resolvePluginBust`；不调外部。 |
| **副作用** | 无。 |
| **失败** | 无。 |

---

### 1.3 `fetchEntryBuildId(entry)`

| 项 | 说明 |
|----|------|
| **作用** | 拉取 Remote 的 `mf-manifest`，返回内容指纹（FNV-1a，仅作 bust，非安全哈希）。 |
| **目的** | 只关心「构建变没变」时用；完整 bust 请用 `resolvePluginBust`。 |
| **签名** | `async fetchEntryBuildId(entry: string): Promise<string>` |
| **参数** | `entry`：通常是 `https://…/mf-manifest.json`。 |
| **返回** | hex 指纹字符串。 |
| **谁调谁** | 公开 API；内部 → `fetchManifestMeta`。 |
| **副作用** | 网络请求；写入 `remoteEntryByManifest`（顺便解析 remoteEntry 绝对地址）。 |
| **失败** | HTTP 非 2xx → `Error('entry buildId …')`；CORS/离线失败。 |

---

### 1.4 `resolvePluginBust(meta)` ★

| 项 | 说明 |
|----|------|
| **作用** | 按插件信任级别算出**最终** bust token。 |
| **目的** | **trusted MF**：`version@manifestHash`，发布者更新静态资源即失效；**untrusted iframe**：只返回 `version`（不走 MF entry，不必拉 manifest）。 |
| **签名** | `async resolvePluginBust(meta: Pick<PluginDescriptor, 'version' \| 'entry' \| 'trust'>): Promise<string>` |
| **参数** | 至少含 `version` / `entry` / `trust`。 |
| **返回** | bust 字符串，交给 `ensurePlugin` 与已激活插件的 `LoadedPlugin.bust` 比较。 |
| **谁调谁** | ← **`PluginManager.ensurePlugin` / `loadPlugin`**；→ `fetchManifestMeta` + `pluginBust`。 |
| **副作用** | trusted 时：带 `cache: 'no-store'` 的 fetch；缓存 `remoteEntryByManifest`，供随后 `registerRemote` **跳过第二次拉 manifest**。 |
| **失败** | manifest 拉取失败、CORS、非 JSON 时仍可能推出 remoteEntry 回退路径；网络错误向上抛。 |

**和相邻方法的关系**：

```text
resolvePluginBust
  ├─ untrusted → pluginBust(version)
  └─ trusted   → fetchManifestMeta(entry)
                    ├─ hashText(manifest) → buildId
                    └─ resolveRemoteEntryUrl → 存 map
                 → pluginBust(version, buildId)
```

---

### 1.5 `registerRemote(d, bust?)`

| 项 | 说明 |
|----|------|
| **作用** | 向 Module Federation runtime **注册或强制覆盖**一个 remote。 |
| **目的** | 在 `loadRemote` 之前声明「这个名字从哪加载」；挂上 React shared 与 bust 钩子。 |
| **签名** | `registerRemote(d: PluginDescriptor, bust?: string): void` |
| **参数** | `d`：插件描述符；`bust`：缺省用 `d.version`。 |
| **返回** | `void`。 |
| **谁调谁** | ← `runLoad`；→ `ensureShared` / `ensureBustPlugin` / `getMf().registerRemotes({ force: true })` / `withBust`。 |
| **副作用** | 写入 `bustByRemote`；幂等注册 shared react/react-dom；**不** shared vue（Host 不装 Vue）。 |
| **失败** | 注册本身很少抛；坏 entry 会在 `loadRemoteApp` 暴露。 |

**实现要点**：优先用 `resolvePluginBust` 已解析的 `remoteEntry.js` 绝对地址注册，避免 MF 再请求一次 `mf-manifest.json`。

---

### 1.6 `loadRemoteApp(d)`

| 项 | 说明 |
|----|------|
| **作用** | 执行 `mf.loadRemote('<remoteName>/<expose>')`，并把结果规范成 Host 可用的 `PluginModule`。 |
| **目的** | 拿到可渲染的 `default` 组件；解析生命周期；Vue Remote 在此转成 React 包装组件。 |
| **签名** | `async loadRemoteApp(d: PluginDescriptor): Promise<PluginModule>` |
| **参数** | 完整 descriptor（用 `remoteName\|\|id`、`expose` 默认 `./App`）。 |
| **返回** | `{ default, activate?, deactivate? }`（经 `normalizePluginModule` / `pickPluginLifecycle`）。 |
| **谁调谁** | ← `runLoad`（且位于样式捕获窗内）；→ `normalizePluginModule`。 |
| **副作用** | 下载并执行 Remote 脚本；注入 CSS（须在捕获窗内）；缺钩子时 `console.info`。 |
| **失败** | 无 `default` → `plugin ${id}: expose ./X missing default export`；网络/MF 错误向上抛（由 `runLoad` 收成 `failed`）。 |

> 生命周期解析细节见 [生命周期钩子.md](./生命周期钩子.md)。

---

### 1.6b `pickPluginLifecycle(raw)` / `normalizePluginModule(raw, meta)`

| 项 | 说明 |
|----|------|
| **作用** | 从 MF 原始模块提取钩子并产出 `PluginModule`。 |
| **解析顺序** | ① `raw.activate` named export → ② `raw.default.activate` 静态属性（React FC / Vue `{ mount, activate }`）。 |
| **缺钩子** | `console.info('[federation-kit] plugin "…": 未导出 activate/deactivate …')`，**不抛错**。 |
| **Vue** | 先 `pickPluginLifecycle`，再 `createVueHostBridge`（桥组件不携带钩子，钩子摊到 `PluginModule` 顶层）。 |
| **导出** | 均从 `@dnhyxc-ai/federation-kit` 公开导出。 |
| **详解** | [生命周期钩子.md](./生命周期钩子.md)（含完整带注释源码）。 |

---

### 1.7 内部配套（读源码时会碰到）

| 符号 | 作用 | 目的 |
|------|------|------|
| `getMf()` | 获取/创建 MF 单例 `name:'host'` | 全 Host 共用一个 runtime |
| `fetchManifestMeta` | 一次 GET：指纹 + remoteEntry URL | 减少重复请求 |
| `resolveRemoteEntryUrl` | 从 manifest JSON 推 remoteEntry | 支持 publicPath |
| `bustRemoteEntryPlugin` | `afterResolve` 给 entry 补 `?v=` | 对抗 MF 去掉 query 的行为 |
| `ensureShared` | 注册 react/react-dom singleton | 避免双 React |
| `hashText` | FNV-1a 32-bit | 仅 bust，非安全 |

---

## 2. 运行时中枢：`PluginManager`

> 文件：`runtime/createPluginRuntime.ts`  
> 一句话：**壳、加载、卸载、上架开关**全在这里。

### 2.1 `constructor(config, opts?)`

| 项 | 说明 |
|----|------|
| **作用** | 创建管理器：持有 `plugins` Map、`inflight` Map、路由/侧栏注入器、导航函数。 |
| **目的** | 把「配置」变成可调用的生命周期 API。 |
| **参数** | `config: PluginHostConfig`；可选自定义 `routeInjector` / `createRoute`。 |
| **副作用** | 无（仅赋值）。 |

---

### 2.2 `setNavigate(fn)`

| 项 | 说明 |
|----|------|
| **作用** | 替换插件导航实现。 |
| **目的** | 启动早期可用 `location.assign`；Host router 就绪后切到 `router.navigate`，插件 `nav:subtree` 才走 SPA。 |
| **签名** | `setNavigate(fn: (to: string) => void): void` |
| **谁调谁** | ← `mf.setNavigate`（本仓 `router/index.tsx`）。 |
| **注意** | 已激活插件手里的旧 bridge **不会**自动重绑 navigate；通常在首次插件加载前设置。 |

---

### 2.3 `get(id)` / `list()`

| 项 | 说明 |
|----|------|
| **作用** | 查询单个 / 全部已登记的 `LoadedPlugin`。 |
| **目的** | UI 读 `status` / `bridge` / `mod` / `error`（如 `PluginHostView`）。 |
| **返回** | `get` → `LoadedPlugin \| undefined`；`list` → 数组拷贝。 |
| **副作用** | 无。 |

---

### 2.4 `init()` ★（≈ `mf.start()`）

| 项 | 说明 |
|----|------|
| **作用** | Host 启动入口：加载偏好 → 强制拉 registry → 对已上架插件 `mountShell` → 对 `preload:'eager'` 后台 `loadPlugin`。 |
| **目的** | 用户一进站就能看到侧栏/路由壳；重量级 Remote 可延后到进页或 eager 预取。 |
| **签名** | `async init(): Promise<void>` |
| **谁调谁** | ← `FederationHost.start` / 本仓 `mf.start()`；→ `enabledStore.load`、`fetchRegistry({force:true})`、`mountShell`、`loadPlugin`。 |
| **副作用** | 路由/侧栏变化；微任务里触发真实加载。 |
| **失败** | 单个 eager 失败只把该插件标 `failed`，**不**让整个 `init` 失败。 |

---

### 2.5 `syncEnabledShells()`

| 项 | 说明 |
|----|------|
| **作用** | 按当前上架偏好重新对齐壳：启用 → `mountShell`；禁用 → `unloadPlugin`。 |
| **目的** | 登录后偏好从服务端回来、或管理页批量变更后，侧栏/路由与偏好一致（**不**强制重下 JS）。 |
| **谁调谁** | ← 本仓 `store/user.ts` 等。 |
| **副作用** | 路由重建订阅、侧栏更新、`notifyPluginEnabled()`。 |

---

### 2.6 `mountShell(meta)`（private）

| 项 | 说明 |
|----|------|
| **作用** | **只**注入路由与侧栏菜单，不下载 Remote。 |
| **目的** | 「先有入口，再按需加载」——刷新时也能靠壳占住路径，减少闪 404。 |
| **逻辑** | `injectRoute !== false` 且存在 `createRoute` → `routeInjector.inject`；有 `menu` → `sidebarInjector.add`。 |
| **谁调谁** | ← `init` / `syncEnabledShells` / `ensurePlugin` / 重载路径 / `setEnabled(true)`。 |

---

### 2.7 `ensurePlugin(id, opts?)` ★

| 项 | 说明 |
|----|------|
| **作用** | **保证**指定已启用插件处于 `activated`，否则加载；可 `force` 强制重载。 |
| **目的** | 页面/Surface 进入时的**主入口**（`PluginHostView` 只依赖它）。合并并发、短路同 bust、失败可感知。 |
| **签名** | `async ensurePlugin(id: string, opts?: { force?: boolean }): Promise<LoadedPlugin>` |
| **参数** | `id`：插件 id；`force`：忽略「已激活同 bust」与「同 bust 失败缓存」。 |
| **返回** | 状态为 `activated` 的 `LoadedPlugin`（否则抛错）。 |
| **流程** | ① `enabledStore.load` ② `fetchRegistry({force:true})` ③ 找「在清单且已上架」 ④ `resolvePluginBust` ⑤ 若已 activated 且 bust 相同且非 force → 直接返回 ⑥ 若 failed 同 bust 非 force → 抛旧错误 ⑦ 若有 inflight → await ⑧ `mountShell` + `loadPlugin` ⑨ 校验 activated。 |
| **谁调谁** | ← `PluginHostView`；→ `resolvePluginBust` / `loadPlugin`。 |
| **副作用** | 可能网络、MF 加载、样式捕获、路由壳。 |
| **失败** | 未启用/不在清单 → `registry 中无启用插件 ${id}`；加载后非 activated → 抛 `error` 文案。 |

**与 `loadPlugin` 的分工**：

- `ensurePlugin`：**面向 UI**，要结果对象，失败要抛。  
- `loadPlugin`：**面向批处理/eager**，失败多记在 `status:failed`，不总是抛。

---

### 2.8 `loadPlugin(meta, opts?, bustToken?)` ★

| 项 | 说明 |
|----|------|
| **作用** | 编排「是否需要加载 / 是否先卸载旧版 / inflight 去重」，真正干活交给 `runLoad`。 |
| **目的** | 避免同一插件并发加载两次；版本（bust）变了先 `unloadPlugin` 再加载。 |
| **签名** | `async loadPlugin(meta: PluginDescriptor, opts?: { force?: boolean }, bustToken?: string): Promise<void>` |
| **参数** | `meta`：描述符；`bustToken`：可传入已算好的 bust，避免重复拉 manifest。 |
| **返回** | `Promise<void>`（注意：多数失败**不向上抛**，写在 `LoadedPlugin.error`）。 |
| **流程** | 算 bust → 同 bust 已激活非 force → return → 已激活但 bust 变 → unload+mountShell → 有 inflight 则复用或 force 等待后重跑 → `runLoad` 放进 inflight。 |
| **谁调谁** | ← `init`（eager）、`ensurePlugin`；→ `runLoad` / `unloadPlugin`。 |

---

### 2.9 `runLoad(meta, bust)`（private）★

| 项 | 说明 |
|----|------|
| **作用** | **单次真实加载流水线**（verify → 注册 → 捕获 CSS → loadRemote → activate）。 |
| **目的** | 把「安全校验、样式隔离短窗、MF 加载、生命周期钩子」收成一个原子过程；错误统一落成 `failed`。 |
| **签名** | `private async runLoad(meta: PluginDescriptor, bust: string): Promise<void>` |
| **步骤** | 1. 写入 `status:'loading'` + 临时 bridge<br>2. `verifyPlugin(meta)`<br>3. 若 `trust==='untrusted'`：标 activated（空 default），**不**走 MF<br>4. `registerRemote(meta, bust)`<br>5. `beginPluginStyleCapture`<br>6. `try { loadRemoteApp } finally { endCapture }`（内部 `pickPluginLifecycle`；缺钩子 `console.info`）<br>7. `createHostBridge` + `await mod.activate?.(bridge.api)`（渲染前）<br>8. 写入 `status:'activated'` |
| **失败** | catch 后 `status:'failed'` + `console.error`，**不 rethrow**（由 `ensurePlugin` 再检查并抛）。`activate` 抛错同样进此路径。 |
| **为何 finally 关捕获窗** | 无论加载成败都要拆 head 劫持，防止泄漏到后续 Host 样式注入。 |
| **生命周期专章** | [生命周期钩子.md](./生命周期钩子.md) |

---

### 2.10 `unloadPlugin(id)`

| 项 | 说明 |
|----|------|
| **作用** | 停用插件：调 `deactivate`、清事件、拆路由/侧栏，状态改 `unloaded`。 |
| **目的** | 下架、换版本重载前清理；**不**从 Map 删除（保留失败信息等可选）。 |
| **谁调谁** | ← `loadPlugin`（重载）、`syncEnabledShells`、`setEnabled(false)`。 |
| **副作用** | `eventBus.clearPlugin`；路由/侧栏订阅触发。 |
| **失败** | `deactivate` 异常只打日志。 |

---

### 2.11 `setEnabled(id, enabled)`

| 项 | 说明 |
|----|------|
| **作用** | 持久化上架开关，并挂壳或卸载。 |
| **目的** | 插件管理页开关；默认走 `enabledStore.set` + 强制刷新 registry。 |
| **注意** | 启用时只 `mountShell`，**不**自动 `loadPlugin`——进页再 `ensurePlugin`。 |
| **谁调谁** | ← 本仓插件管理 UI。 |

---

## 3. 工厂：`createPluginRuntime` / `createFederation`

### 3.1 `createPluginRuntime(config, opts?)` ★

| 项 | 说明 |
|----|------|
| **作用** | 装配校验环境、偏好 getter、surface 缓存键、样式隔离配置，并 `new PluginManager`。 |
| **目的** | **低层可测入口**：不绑「默认 localStorage / 默认 toast」；测试与高级 Host 可直接用。 |
| **签名** | `createPluginRuntime<TRoute>(config: PluginHostConfig, opts?: { routeInjector?; createRoute?; HostPage? }): PluginRuntime<TRoute>` |
| **返回** | `{ config, manager, routeInjector, sidebarInjector, init, hostApiVersion }`。 |
| **关键副作用** | `configureVerifyEnv` / `configureEnabledGetter` / `configureEnabledReady` / `configureHostSurfaceCacheKey` / `configureStyleIsolation`——这些是**模块级全局**，影响后续所有调用。 |
| **HostPage 糖** | 若只给 `HostPage` 不给 `createRoute`，会生成「path=`routePath`、Component 渲染 HostPage」的路由工厂。 |

**和 `createFederation` 的关系**：`createFederation` = 填好默认 capabilities/store/fetch + 调用 `createPluginRuntime` + 包一层 `start/setNavigate/...`。

---

### 3.2 `createFederation(options?)` ★

| 项 | 说明 |
|----|------|
| **作用** | 面向业务的「一行接入」门面（类比 qiankun `registerMicroApps`+`start`）。 |
| **目的** | 降低 Host 样板代码：默认 registry fetch+缓存、localStorage 上架、基础 theme/locale/navigate。 |
| **签名** | `createFederation<TRoute>(options?: CreateFederationOptions<TRoute>): FederationHost<TRoute>` |
| **关键 options** | `registryUrl` 或 `fetchRegistry`；`capabilities`；`enabledStore`；`createRoute`/`HostPage`；`styleIsolation`；`asDefault`（默认 true → `setDefaultFederation`）。 |
| **返回对象要点** | `start()`≡`manager.init()`；`manager`；`setNavigate`；`onRoutesChange`；`getIframeBridgeOptions`。 |
| **本仓用法** | `apps/frontend/src/federation/runtime/index.ts` 注入 Toast/http/ebook/COS prefs 后导出 `mf`。 |

---

### 3.3 `getDefaultFederation` / `setDefaultFederation`

| 项 | 说明 |
|----|------|
| **作用** | 读写全局默认 `FederationHost`。 |
| **目的** | `<FederationPlugin />` 无 Context 时也能找到 Host；**且**跨 tsup `.` / `./react` 双入口用 `globalThis` 共实例。 |
| **失败** | `useFederation()` 在两者皆空时抛错，提示先 `createFederation`。 |

---

### 3.4 `createFederationFromUrl(registryUrl, opts?)`

| 项 | 说明 |
|----|------|
| **作用** | `createFederation({ registryUrl, ...opts })` 语法糖。 |
| **目的** | 最简演示 / 文档示例。 |

---

## 4. Bridge 三件套

### 4.1 `createHostBridge(d, capabilities, navigate?)`

| 项 | 说明 |
|----|------|
| **作用** | 按 `permissions ∩ capabilities` 裁剪 Host API，再 `deepFreeze`。 |
| **目的** | 插件**只能**用被授权的能力；无法改写 Host 函数引用。 |
| **返回** | `HostBridgeProps`（含 `api`、locale 等）。 |
| **谁调谁** | ← `runLoad`（loading 与 activated 各建一次）。 |
| **失败** | 无权限则字段缺失；调用越权导航 → `NAV_OUT_OF_SCOPE` 等。 |

---

### 4.2 `createVueHostBridge(expose, pluginId?)`

| 项 | 说明 |
|----|------|
| **作用** | 把 Vue Remote 的 `mount(el, bridge)` 包成 React 组件。 |
| **目的** | Host **不安装 Vue**，仍能嵌 Vue 插件。 |
| **谁调谁** | ← `normalizePluginModule`。 |
| **副作用** | `useLayoutEffect` 里 mount（早于 paint，配合 Portal）。 |

---

### 4.3 `attachIframeBridge(iframe, bridge, targetOrigin, opts)`

| 项 | 说明 |
|----|------|
| **作用** | 给 untrusted iframe 挂 postMessage RPC（http/ui/自定义）。 |
| **目的** | 不共享 JS 堆时仍能调 Host 能力。 |
| **返回** | cleanup 函数。 |
| **谁调谁** | ← `PluginHostView` 的 UntrustedIframe。 |

---

### 4.4 `deepFreeze(value)` / `eventBus.*`

| 方法 | 作用 | 目的 |
|------|------|------|
| `deepFreeze` | 递归冻结对象图 | Bridge 防篡改 |
| `eventBus.on/off/emit` | 按 pluginId 隔离事件 | 插件间不串台 |
| `eventBus.clearPlugin` | 卸插件时清监听 | 防泄漏 |

---

## 5. 校验：`PluginVerifier`

### 5.1 `verifyPlugin(d)`

| 项 | 说明 |
|----|------|
| **作用** | 加载前校验信任边界：iframe 必备字段、entry/iframe URL 协议、hostApi 版本范围、可选 integrity/签名。 |
| **目的** | 把「明显不该加载」的描述符挡在 `loadRemote` 之前。 |
| **谁调谁** | ← `runLoad` 第一步。 |
| **失败** | 抛 `PluginVerifyError`（带 code：ORIGIN / HOST_API / INTEGRITY / …）。 |

### 5.2 `configureVerifyEnv` / `satisfiesRange` / `entryUrlAllowed`

| 方法 | 作用 |
|------|------|
| `configureVerifyEnv` | 注入 hostApiVersion、prod、skipIntegrity、translate |
| `satisfiesRange` | 简单 semver 范围判断（`^` / `>=` / exact） |
| `entryUrlAllowed` | prod 下限制 https 等 |

---

## 6. 样式隔离关键方法

### 6.1 `beginPluginStyleCapture(pluginId, entry, remoteName?, opts?)`

| 项 | 说明 |
|----|------|
| **作用** | 打开样式捕获窗：压栈、劫持 head/CSSOM、reclaim、监听 head 新增 style/link。 |
| **目的** | 在窗内注入的 Remote CSS 被加上 realm 前缀。 |
| **关键参数** | `claimUnmarked`：**load 短窗 true**（可认无标记新 style）；**mount 长窗 false**（只认 Remote 正信号，避免误收 Host Markdown/sonner）。 |
| **返回** | dispose：断 MO、出栈、release head patch。 |
| **谁调谁** | ← `runLoad`；也被 `attachPluginStyleIsolation` 调用（false）。 |

---

### 6.2 `attachPluginStyleIsolation(pluginId, entry, remoteName?)`

| 项 | 说明 |
|----|------|
| **作用** | 挂载期：`beginPluginStyleCapture({claimUnmarked:false})` + `attachPortalScopeBridge`。 |
| **目的** | 延迟 CSS / HMR / body 弹层继续隔离，且不误伤 Host 全局样式。 |
| **谁调谁** | ← `PluginHostView` 的 `useLayoutEffect`。 |
| **返回** | dispose（先 portal 后 CSS）。 |

---

### 6.3 `styleRealmKey(entry, remoteName?, pluginId?)`

| 项 | 说明 |
|----|------|
| **作用** | 生成稳定的样式域键（优先 `entry:origin+path`）。 |
| **目的** | **同一 Remote 多插件**共用 CSS，切换不丢样式、不串域。 |

---

### 6.4 `looksLikeRemoteStyle` / `reclaimEntryStyles` / `repairHostCriticalStyles`

| 方法 | 作用 | 目的 |
|------|------|------|
| `looksLikeRemoteStyle` | 判断节点是否属当前 Remote | **正信号认领**（owner/origin/vite host/apps 路径/短窗未标记） |
| `reclaimEntryStyles` | 把 head 里已属该 entry 的样式收回当前 realm | 切回插件时样式还在 |
| `repairHostCriticalStyles` | 剥掉误加在 sonner/Host vite 样式上的前缀 | 误伤恢复 |
| `processNode` | 处理单个新增 head 节点 | MO 回调入口 |
| `scopeStyleElement` | 对 style 文本做前缀隔离并打标 | 真正改写 CSS |

---

### 6.5 Portal：`claimPluginPortalTarget` / `clearPluginPortalClaim` / `ensureBodyPortalScope`

| 方法 | 作用 | 目的 |
|------|------|------|
| `claimPluginPortalTarget` | Host 开 Drawer 前同步认领 | 首帧 createPortal 就进 scope |
| `clearPluginPortalClaim` | 关闭时清认领 | 配对释放 patch |
| `ensureBodyPortalScope` | 创建全屏 `data-mf-portal-scope` 容器 | 收编 body 弹层；`pointer-events:none` + 子节点可点；**z-index 低于 Toast** |
| `stampRealmOnPortalNode` | 给弹层根打 realm | 自身选择器生效 |

---

## 7. 偏好 / Surface / 注入器 / Registry

### 7.1 上架偏好

| 方法 | 作用 | 目的 |
|------|------|------|
| `configureEnabledGetter` | 注入「id→是否上架」 | Manager 与 hooks 共用 |
| `configureEnabledReady` | 注入偏好是否已从服务端就绪 | 避免闪「已下架」 |
| `isPluginEnabled` | 读上架 | 过滤壳/ensure |
| `notifyPluginEnabled` / `subscribePluginEnabled` | 广播变更 | UI 刷新 |

### 7.2 `listHostSurfacePlugins(surface)`

| 项 | 说明 |
|----|------|
| **作用** | 从 registry 缓存筛 `host.surface === surface` 且已上架的插件，按 order 排序。 |
| **目的** | ebook 等业务面挂 toolbar/drawer，不必每次网络。 |

### 7.3 `RouteInjector` / `SidebarInjector`

| 方法 | 作用 |
|------|------|
| `inject` / `add` | 挂路由或侧栏项 |
| `remove` | 按 pluginId 移除 |
| `subscribe` | 变更通知（Host 重建 router / 重绘侧栏） |
| `getRoutes` / `items` | 只读快照 |

### 7.4 Registry 缓存

| 方法 | 作用 |
|------|------|
| `readRegistryCache` / `writeRegistryCache` | 断网回落 |
| `clearRegistryCache` | 强制清空 |
| `assertRegistryHostApiCompatible` | 清单与 Host API 版本兼容性 |

---

## 8. React 挂载层（方法）

| 方法/组件 | 作用 | 目的 |
|-----------|------|------|
| `FederationProvider` | Context 注入 Host | 多 Host 或测试 |
| `useFederation` | 取 Host（Context→默认单例） | 声明式组件找 runtime |
| `FederationPlugin` | 声明式挂载（传 name/pluginId） | 类 micro-app 用法 |
| `PluginHostView` | ensure + 渲染 + 样式隔离/iframe | 真正干活的视图 |
| `usePluginEnabled` | 订阅上架布尔值 | 下架提示 |
| `useHostSurfacePlugins` | 订阅某 surface 插件列表 | Surface 模版 |

`PluginHostView` 内部关键效应：

1. `useEffect` → `manager.ensurePlugin(pluginId)`  
2. `useLayoutEffect` → `attachPluginStyleIsolation`（activated 且非 untrusted）  
3. untrusted → `attachIframeBridge`

---

## 9. 本仓适配层（方法级）

| 符号 | 作用 | 目的 |
|------|------|------|
| `mf`（`createFederation` 结果） | 本仓全局 Host | 注入 Toast/http/ebook/COS/偏好 |
| `mf.start()` | ≡ `manager.init()` | 路由层启动 |
| `registerPluginHostPage` | 注册路由用的 `PluginHostPage` | `createRoute` 闭包能渲染 design 壳 |
| `fetchPluginRegistry` | 拉 COS/本地清单 | 产品 registry |
| `persistPluginEnabled` | 写账号上架偏好 | 多端同步 |
| `PluginHostPage` | slots 包装 `FederationPlugin` | Loading/错误/外壳皮肤 |
| `PluginHostSurface` | 按 surface+slot 挂插件 | ebook 抽屉/工具栏 |
| `setAppFullscreen` | 影院全屏 | 藏壳 + Tauri/Web 全屏 |
| ebook host api 绑定 | 可变绑定阅读器能力 | 插件跳 CFI 等 |

---

## 10. 典型失败矩阵

| 现象 | 最可能的方法/环节 | 排查 |
|------|-------------------|------|
| `registry 中无启用插件` | `ensurePlugin` | 偏好未上架 / id 写错 |
| 一直 loading | `runLoad` / `loadRemoteApp` | 网络、remoteName、expose |
| `missing default export` | `loadRemoteApp` | Remote expose 路径 |
| Toast/Markdown 样式坏 | `beginPluginStyleCapture` 长窗误认领 | 确认 mount 用 `claimUnmarked:false` |
| Toast 不能悬停 | Portal z-index | `ensureBodyPortalScope` 样式 |
| 刷新闪 404 | 壳注入时序 | Host `pluginsReady` 占位 |
| `PluginHostPage not registered` | `createRoute` | 先 `registerPluginHostPage` |
| Vue 挂不上 | `normalizePluginModule` | `framework:'vue'` + mount 导出 |

---

## 11. 与其它文档的关系

| 需求 | 文档 |
|------|------|
| 方法干什么（本文） | **07（本文）** |
| 架构与旅程 | [01](./架构概览.md) |
| 运行时全文+逐行注释 | [02](./运行时与桥接.md) |
| 样式隔离全文 | [03](./样式隔离实现.md) |
| React 组件 | [04](./React宿主视图.md) |
| 本仓接线 | [05](./宿主适配层.md) |
| 换项目怎么搭 | [06](./复刻方案.md) |

---

## 12. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-08-10 | 初版：按用户要求补齐方法级「作用/目的/签名/调用/副作用/失败」阐述 |
