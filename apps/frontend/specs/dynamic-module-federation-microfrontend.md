# 动态模块联邦：实时可插拔微前端改造方案

> **调研日期**：2026-07-17  
> **实现状态**：**未落地**（仓库内无 Module Federation / qiankun / single-spa 相关依赖与配置）  
> **信息来源**：[Module Federation Runtime](https://module-federation.io/guide/runtime/)、[Runtime API](https://module-federation.io/guide/runtime/runtime-api)、[`@module-federation/vite`](https://www.npmjs.com/package/@module-federation/vite)、本仓库 `apps/frontend` 现状  
> **关联代码**：`apps/frontend/vite.config.ts`、`apps/frontend/src/router/routes.ts`、`apps/frontend/src/utils/updater.ts`、`apps/frontend/src-tauri/tauri.conf.json`  
> **性质**：架构选型与改造路径说明；**非实现承诺**。落地前须完成 M0 PoC（Web 端可独立验证）。

---

## 1. 结论摘要（TL;DR）

| 问题 | 结论 |
|------|------|
| **能否做到子应用/插件更新后主应用不发版？** | **能**。关键不是「构建期写死 remotes」，而是 **运行时 Manifest 注册 + `loadRemote` 动态加载**；主应用只依赖「加载协议」，不依赖具体业务包版本。 |
| **本仓库推荐技术栈** | Host 继续 **Vite 7 + React 19**；采用 **`@module-federation/vite`（构建）+ `@module-federation/enhanced/runtime`（运行时）**；Remote 可 Vite 或 Rspack，协议统一走 MF 2.0。 |
| **「实时可插拔」最小闭环** | 后端/CDN 下发 `plugin-manifest.json` → Host `registerRemotes` → 路由/菜单按 manifest 挂载 → `loadRemote('id/App')` 渲染；Remote 发版只更新 CDN + manifest 的 `entry`/`version`。 |
| **与现有发布的关系** | **Web**：主壳与子包可分开发布（`dnhyxc-ci publish` 扩展为 host / remotes 多产物）。**Tauri 桌面**：壳内嵌静态资源仍整包升级；**业务 Remote 可走外网 CDN** 实现「壳不升、功能升」，但受 CSP / 离线 / 安全约束，须单独设计。 |
| **首批拆分建议** | **不要**一次拆 chat/ebook/english 全部大盘。优先 **边界清晰、可独立迭代** 的能力作 Remote（如 `coding`、实验性 Agent、外部合作插件）；核心壳（Layout / 鉴权 / 设置 / 路由编排）留 Host。 |

**推荐策略（一句话）**

> Host 固定「插件契约 + Runtime 加载器」；业务以 Remote 形式发布到 CDN；启动与进入路由时拉取 **带版本与 content-hash 的 Manifest**，实现 **主项目不重发即可热插拔加载最新插件**。

---

## 2. 项目现状基线（改造前）

### 2.1 形态

| 维度 | 现状 | 对 MF 的含义 |
|------|------|----------------|
| 应用结构 | 单一 `apps/frontend` SPA | Host 即现有前端；尚无 Remote 包 |
| 构建 | Vite `^7` + `@vitejs/plugin-react`；产物 `dist/` | 需接入 MF Vite 插件；`shared` 需显式声明 |
| 路由 | `createBrowserRouter` + **静态** `routes.ts`（同步 `import` 全部 views） | 插件路由须改为 **动态注册**；首屏包体积亦会受益 |
| 状态 | MobX；HTTP/`fetch` 工具集中在 `@/utils` | Host 暴露 **桥接 API** 给 Remote，避免双份 axios/token |
| 共享包 | `workspace:*` 的 `@dnhyxc-ai/markdown-kit` | 可作 shared，或 Remote 自行打包（体积更大） |
| Web 发布 | `pnpm build` → `dnhyxc-ci publish dnhyxcAI` | 需支持 **多包/多路径** 发布（host + remotes） |
| 桌面 | Tauri 2；`frontendDist: ../dist`；`plugin-updater` 整包升级 | 内嵌资源变更仍要壳升级；外链 Remote 可绕开壳发版 |
| 安全 | `tauri.conf.json` 中 `csp: null`（生产应收紧） | 加载远程脚本后 **必须** 设 CSP / 域名白名单 |

### 2.2 痛点（驱动改造）

1. **任何业务改动**（含独立实验功能）都走主仓构建与全量发布；Web 与桌面链路耦合。  
2. **路由与 views 静态耦合**：新增模块必改 `routes.ts` 与主包体积。  
3. **无插件契约**：第三方/实验能力无法在不改 Host 源码的前提下挂载。  
4. **更新粒度粗**：Tauri updater 与 Web 静态资源均为「整前端」粒度，无法「只更英语学习」或「只更插件」。

### 2.3 非目标（YAGNI）

- 不引入 qiankun / single-spa / iframe 沙箱作为主路径（与 React 同构组件树、共享依赖目标不符）。  
- 不把 NestJS 后端拆成「微前端」；本方案仅前端 Host/Remote。  
- 不要求首期跨团队多仓治理完备（可先 monorepo 内多 `apps/*-remote`）。  
- 不承诺桌面端离线场景下也能热更新 Remote（离线仍依赖壳内资源或本地缓存策略，见 §7）。

---

## 3. 「主项目不发版」如何成立

### 3.1 错误理解 vs 正确机制

| 误解 | 正确做法 |
|------|----------|
| 构建配置里写死 `remotes: { app: 'http://localhost:5001/assets/remoteEntry.js' }` 就算微前端 | 写死 entry 后，Remote **换域名/换 hash 文件名** 仍可能逼 Host 改配置重发 |
| Host `import('remote/App')` 静态依赖 Remote 版本 | 运行时用 **`registerRemotes` + `loadRemote`**，entry 来自 Manifest |
| 只发 Remote、不发 Manifest | 浏览器会强缓存旧 `remoteEntry.js`；须 **Manifest 指针 + entry content-hash** |

### 3.2 推荐发布模型

```text
CDN /
  host/                 ← 主应用（低频发版：壳、鉴权、Runtime、契约）
    index.html
    assets/...
  remotes/
    coding/1.2.3/       ← 某插件版本目录（content-hash 资源）
      mf-manifest.json
      remoteEntry.js
      ...
  registry/
    plugins.json        ← 全局或按租户的「当前启用插件」清单（短缓存 / no-cache）
```

**主应用不发版即可更新插件的充要条件：**

1. Host 已内置 MF Runtime 与插件加载器（**一次性**改造发版）。  
2. 启用列表与 entry URL **不写死在 Host 包内**，而从 `plugins.json`（或后端 API）读取。  
3. Remote 每次发版生成 **新 URL**（版本目录或带 hash 的 entry），并更新 registry。  
4. Host 对 registry 使用 **短 TTL 或协商缓存**；进入插件路由时可选强制 `?_v=` 刷新。

---

## 4. 技术选型对比

### 4.1 方案对照

| 方案 | 与本仓契合度 | 动态 Remote | 共享 React | 成熟度 | 说明 |
|------|-------------|-------------|------------|--------|------|
| **`@module-federation/vite` + enhanced runtime** | ★★★★★ | ✅ `registerRemotes` / `loadRemote` | ✅ `shared` singleton | 活跃，MF 2.0 | **推荐**；与 webpack/Rspack Remote 可互通 |
| `@originjs/vite-plugin-federation` | ★★★ | 弱（偏构建期） | 有 | 老牌但自研 runtime | 新项目不优先 |
| 纯 Runtime（无构建插件） | ★★★★ | ✅ | 需手动 `registerShared` | 可行 | 适合极简 Host；生产仍建议 Remote 用官方插件出 `mf-manifest` |
| qiankun / micro-app | ★★ | ✅ | 弱（多实例） | 成熟 | JS 沙箱/样式隔离重；与现有 design/ui 同树渲染冲突多 |
| iframe | ★★ | ✅ | ❌ | 极稳 | 隔离强、体验与桥接成本高；仅适合不信任第三方 |

### 4.2 为何选 Module Federation 2.0 Runtime

- **构建与运行解耦**：Vite Host 可加载 Rspack/webpack Remote。  
- **动态注册**：官方明确「插件配置 remotes」**不支持**运行时增删；**Runtime 注册**才支持动态模块。  
- **Runtime Plugin**：可在 beforeRequest / error 等钩子做重试、降级 URL、埋点（不必改业务代码）。  
- **`mf-manifest.json`**：生产用 manifest 协议比裸 `remoteEntry.js` 更利于版本与依赖协商。

### 4.3 Host 构建插件职责边界

| 能力 | 构建插件 (`@module-federation/vite`) | Runtime API |
|------|--------------------------------------|-------------|
| 声明 name / exposes / shared | ✅ | `registerShared` 可补 |
| 静态 remotes | ✅（本方案 **尽量不用**） | — |
| 运行时增删插件 | ❌ | ✅ `registerRemotes` |
| 加载模块 | `import` 语法（需构建期知道 remote） | ✅ `loadRemote('name/expose')` |
| 影响加载过程 | 有限 | ✅ runtime plugins |

**本方案原则**：构建期只配置 **Host name + shared**；**所有业务 Remote 走 Runtime 动态注册**。

---

## 5. 目标架构

### 5.1 分层

```text
┌─────────────────────────────────────────────────────────┐
│  Host（apps/frontend）                                    │
│  Layout · 鉴权 · 设置 · HTTP/Token · i18n · Theme         │
│  PluginRegistry · MfRuntime · DynamicRouteBridge          │
└─────────────┬───────────────────────────┬───────────────┘
              │ registerRemotes / loadRemote
              ▼                           ▼
     ┌────────────────┐          ┌────────────────┐
     │ Remote: coding │   ...    │ Remote: pluginX│
     │ exposes: ./App │          │ exposes: ./App │
     └────────────────┘          └────────────────┘
              │                           │
              └────────── shared ─────────┘
                 react / react-dom / react-router（singleton）
```

### 5.2 核心流程图（进入插件页）

```text
用户打开 /plugins/:id
        │
        ▼
  读本地缓存的 plugins.json？──否──► GET /api/plugins/registry（或 CDN registry）
        │ 是（未过期）                      │
        ▼                                  ▼
  解析 PluginDescriptor ───────────────────┘
        │
        ▼
  registerRemotes([{ name, entry: manifestOrEntryUrl }])
        │
        ▼
  loadRemote(`${name}/App`) ──失败──► 重试备用 entry / 展示降级页
        │ 成功
        ▼
  React.createElement(RemoteApp, hostProps) 挂到 Outlet
```

### 5.3 时序（Happy path）

```text
Browser          HostLoader         Registry API/CDN      Remote CDN
  │                  │                    │                   │
  │  enter route     │                    │                   │
  │─────────────────►│  GET plugins.json  │                   │
  │                  │───────────────────►│                   │
  │                  │  [{id,entry,ver}]  │                   │
  │                  │◄───────────────────│                   │
  │                  │  registerRemotes   │                   │
  │                  │  GET mf-manifest   │                   │
  │                  │───────────────────────────────────────►│
  │                  │  manifest+chunks   │                   │
  │                  │◄───────────────────────────────────────│
  │                  │  loadRemote → module.default           │
  │  render Remote   │                                        │
  │◄─────────────────│                                        │
```

---

## 6. 插件契约（Host ↔ Remote）

### 6.1 Manifest / Registry 字段（建议）

```ts
/** CDN 或后端下发的启用清单（可短缓存） */
interface PluginRegistry {
  updatedAt: string;
  plugins: PluginDescriptor[];
}

interface PluginDescriptor {
  /** 联邦 name，稳定 ID，如 `coding` */
  id: string;
  /** 展示名 / i18n key */
  titleKey?: string;
  /** 挂载路由前缀，如 `/coding` */
  routePath: string;
  /** MF 入口：优先 mf-manifest.json URL */
  entry: string;
  /** semver，用于 UI 与兼容判断 */
  version: string;
  /** Host 契约最低版本；不满足则拒绝加载 */
  hostApiRange: string; // 如 `^1.0.0`
  /** 可选：菜单、权限码、预加载策略 */
  menu?: { order: number; icon?: string };
  permissions?: string[];
  preload?: 'eager' | 'route' | 'idle';
}
```

### 6.2 Remote 必须 exposes

| expose | 类型 | 说明 |
|--------|------|------|
| `./App` | `React.ComponentType<HostBridgeProps>` | 页面根组件（默认） |
| `./routes`（可选） | `() => RouteConfig[]` | 子路由表，由 Host 合并 |
| `./menu`（可选） | `MenuContribution` | 侧栏/顶栏贡献点 |

### 6.3 Host 注入桥接（避免 Remote 直连 Host 内部路径）

```ts
interface HostBridgeProps {
  api: {
    http: typeof import('@/utils/fetch').http; // 或窄接口
    t: (key: string, params?: Record<string, unknown>) => string;
    navigate: (to: string) => void;
    theme: 'light' | 'dark';
  };
  /** 插件自身 descriptor，便于 Remote 读 version */
  plugin: Pick<PluginDescriptor, 'id' | 'version' | 'routePath'>;
}
```

**原则（Ponytail）**：桥接面 **尽量窄**；禁止 Remote `import '@/stores/...'`。共享 UI 通过：

1. **shared 单例**（`react` / `react-dom`），或  
2. Host 再 exposes 少量 `./ui/Button` 等（慎用，易绑死 Host 发版），或  
3. Remote 自带 Tailwind 原子类（样式隔离成本低、体积略增）。

### 6.4 `shared` 建议（Host）

| 包 | singleton | 备注 |
|----|-----------|------|
| `react` / `react-dom` | 必须 | 与仓库 `^19.1.0` 对齐 |
| `react-router` | 建议 | 否则双 Router 上下文 |
| `mobx` / `mobx-react` | 按需 | 若 Remote 用 MobX 读 Host store，须 singleton；更推荐 props/事件 |
| `@dnhyxc-ai/markdown-kit` | 可选 | 大包；多 Remote 共用时值得 shared |

---

## 7. 与本仓库发布 / Tauri 的衔接

### 7.1 Web

| 步骤 | 动作 |
|------|------|
| Host 发版 | 现有 `build` + `publish`；仅壳/契约/Runtime 变更时执行 |
| Remote 发版 | 独立 pipeline：构建 → 上传 `remotes/<id>/<version>/` → 更新 `registry/plugins.json` |
| 回滚 | 改 registry 指针指回旧 version 目录；**无需**回滚 Host |
| 灰度 | registry 按用户/百分比返回不同 `entry` |

### 7.2 Tauri 桌面（关键约束）

| 策略 | 壳是否要发版 | 说明 |
|------|--------------|------|
| **A. Remote 走 HTTPS CDN** | 否（业务） | 与 Web 同 registry；须 CSP `script-src` / `connect-src` 白名单；`plugin-http` 若拦截 fetch 需对齐 |
| **B. Remote 打进 `frontendDist`** | 是 | 与今天一致，无「热插拔」收益 |
| **C. 本地插件目录** | 否 | 下载 zip 到 appData，`convertFileSrc` / asset 协议加载；适合离线，实现成本高 |

**建议**：Web 与桌面 **统一走策略 A**；壳升级仅保留「Runtime/契约破坏性变更」与「原生能力」。现有 `checkForUpdates`（`utils/updater.ts`）继续负责 **壳与 Rust 侧**；业务插件更新走 Manifest，**不要**混进 Tauri updater 包。

**安全必做（落地前）**：将 `csp: null` 改为显式策略，仅允许可信 CDN；Remote 资源建议 **SRI** 或 manifest 内 integrity 字段校验。

### 7.3 开发体验

| 场景 | 做法 |
|------|------|
| 本地联调 | Remote `vite --port 5xxx`；Host registry 指向 `http://127.0.0.1:5xxx/mf-manifest.json` |
| 无 Remote 时 | Host 保留本地 fallback 组件或隐藏菜单 |
| 类型 | MF 2.0 dts / 手动 `remotes.d.ts`；契约包可抽 `packages/plugin-contract`（仅类型，可选） |

---

## 8. 落地点与现有代码映射

| 能力 | 已有位置 | 改造用法 |
|------|----------|----------|
| Vite 配置 | `apps/frontend/vite.config.ts` | 增加 federation 插件：`name: 'host'`、`shared`；**不写死 remotes** |
| 路由表 | `apps/frontend/src/router/routes.ts` | 拆「静态壳路由」+「动态插件路由合并」 |
| Router 入口 | `apps/frontend/src/router/index.tsx` | 启动时拉取 registry，再 `createBrowserRouter`；或运行时 `router.patchRoutes`（React Router 7） |
| 鉴权 | `authPaths.ts` / Layout | 插件 `routePath` 纳入 `requiresAuth` 规则；权限码对接 `permissions` |
| HTTP | `utils/fetch.ts` | 经 `HostBridgeProps.api.http` 注入；Remote 禁止自建一套 token |
| 桌面更新 | `utils/updater.ts` | 保持壳更新；插件更新另做「插件中心」UI（可选） |
| 发布 | `package.json` `deploy` / `dnhyxc-ci` | 扩展 remote 上传与 registry 写入（待确认现有 CI API） |
| 共享 Markdown | `packages/markdown-kit` | 优先 shared；避免 Remote 打两份 highlighter |

**待确认**（落地前用 PoC 验证）：

1. `@module-federation/vite` 对 **Vite 7** 的官方支持矩阵与已知 issue。  
2. React Router 7 与联邦子路由的 **context 共享**（是否必须 shared `react-router`）。  
3. Tauri WebView 加载跨域 `remoteEntry` 是否受 `dangerousRemoteDomainIpcAccess` / CSP 额外限制。  
4. `dnhyxc-ci publish` 是否支持多 prefix 上传；否则用 COS/现有对象存储脚本。

---

## 9. 分阶段落地（M0–M4）

| 阶段 | 目标 | 验收要点 | 预估改动 |
|------|------|----------|----------|
| **M0 PoC** | Host + 1 个 demo Remote（Hello） | 改 Remote 文案、只发 Remote+registry，Host 刷新即见新文案 | 新 `apps/remote-demo`；Host 加 Runtime 加载页 |
| **M1 契约** | `PluginDescriptor` + `HostBridgeProps` + 错误降级 | 契约版本不匹配时拒绝加载并提示升级壳 | `src/plugins/*` 小组件；后端或静态 registry |
| **M2 首个真插件** | 拆一个真实边界模块（建议 `coding` 或独立实验页） | 生产 CDN 热更新；主仓无业务改动发版 | 迁 views + 独立 CI |
| **M3 动态路由/菜单** | registry 驱动菜单与 `routePath` | 启用/停用插件无需发 Host | Layout 菜单数据源改造 |
| **M4 生产加固** | CSP、SRI、重试、灰度、监控 | 失败可观测；可一键回滚 registry | Runtime plugin + 运维文档 |

**明确延后**：多团队 npm 私服、完整设计系统联邦暴露、桌面本地插件市场。

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| React / Router 多实例 | Hooks 报错、路由断裂 | `shared` singleton + `requiredVersion`；CI 检查 Remote 勿打包 react |
| 样式冲突 | 插件污染全局 | Remote 约定前缀 / CSS Modules；Tailwind 预检 prefix（若启用） |
| 缓存旧入口 | 「发了但看不到」 | version 目录 + registry `Cache-Control: no-cache`；entry 带 hash |
| Host 契约破坏 | 全插件挂掉 | `hostApiRange` + 壳 semver；破坏性变更才升 Host |
| 安全（远程脚本） | XSS / 供应链 | CDN 鉴权、SRI、CSP、仅内网签名构建 |
| Tauri 离线 | 插件不可用 | 关键路径保留 Host 内降级或上次成功缓存 |
| 过度拆分 | 运维成本 > 收益 | 坚持 §1 首批只拆边界清晰模块 |

---

## 11. 验收清单（方案级）

- [ ] Host **零业务改动** 发版时，仅更新 Remote + registry，浏览器硬刷新（或进页拉取 registry）后可见新插件 UI。  
- [ ] 同一 Host 可 **启用 / 停用** 插件（改 registry），菜单与路由同步消失/出现。  
- [ ] Remote 加载失败有 **降级 UI**，且不影响壳内 chat/ebook 等静态路由。  
- [ ] `react` / `react-dom` 在运行时为 **单例**（React DevTools / 自检脚本可证）。  
- [ ] Web 与（可选）Tauri 使用 **同一 registry 协议**；桌面 CSP 已收紧且白名单含插件 CDN。  
- [ ] 回滚：registry 指回上一 version 后，无需重新发布 Host。

---

## 12. 最小接口草图（实现期参考，非当前代码）

```ts
// apps/frontend/src/plugins/runtime.ts（规划）
import { createInstance } from '@module-federation/enhanced/runtime';

export const mf = createInstance({
  name: 'host',
  // remotes 初始为空；由 registry 填充
  remotes: [],
});

export async function ensurePlugin(d: PluginDescriptor) {
  mf.registerRemotes([
    { name: d.id, entry: d.entry, alias: d.id },
  ]);
  return mf.loadRemote<{ default: React.ComponentType<HostBridgeProps> }>(
    `${d.id}/App`,
  );
}
```

```ts
// Remote vite 侧（规划）：exposes: { './App': './src/App.tsx' }
// shared 与 Host 对齐 react@19
```

---

## 13. 总结

本仓库当前是 **Vite 单体 SPA + Tauri 整包更新**，不具备微前端热插拔能力。采用 **Module Federation 2.0：构建期只配 Host/shared，运行期 Manifest 动态 `registerRemotes` + `loadRemote`**，可以在 **主壳不重新发布** 的前提下完成子应用/插件的实时加载与回滚。

改造应 **先 PoC、再拆一个真模块、再动态菜单**，并单独处理 **Tauri CSP 与壳/插件双轨更新**。在 Host 契约稳定之前，避免大规模拆分 chat / ebook / english-learning 等重业务，以免共享依赖与路由上下文成本淹没收益。
`)