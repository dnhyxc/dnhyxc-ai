# 跨项目复刻手册（federation-kit 微前端）

> **一句话**：按依赖从底向上在新 Host 搭出「清单 → 壳 → 加载 → Bridge → 样式隔离 → 声明式挂载」；本仓产品能力用适配层替换。  
> **前置阅读**：[01 总览](./01-architecture-overview.md)；细节与逐行代码见 [02](./02-runtime-mf-bridge.md)–[05](./05-host-adapter-frontend.md)。  
> **成功标准**：新项目能 `createFederation` + `start`，打开一个信任 Remote 页面且 CSS/弹层不污染 Host Toast。

---

## 0. 前置条件

| 项 | 要求 | 不做会怎样 |
|----|------|------------|
| 打包 | Host / Remote 均配置 Module Federation（如 `@module-federation/enhanced`） | `loadRemote` 失败 |
| React | Host 为 React 18+（Vue Remote 需 expose mount） | Vue 桥无法挂 |
| 共享依赖 | React / react-dom singleton 共享 | 双 React 状态分裂 |
| registry | 可 HTTP(S) 访问的 JSON 清单 | 无插件列表 |
| 浏览器 | 现代浏览器（MutationObserver、CSSOM） | 样式隔离失效 |

---

## 1. 建造顺序（必须按序）

### Phase A — 契约与门面（无 UI）

1. 引入或复制 `@dnhyxc-ai/federation-kit`（推荐直接依赖包）。  
2. 准备 `plugins-registry.json`（id / entry / remoteName / permissions / routes / sidebar…）。  
3. `createFederation({ registryUrl })` → `await mf.start()` → `mf.setNavigate(...)`。  
4. **验收 A**：控制台无抛错；`mf.manager.getRegistry()` 有数据。

### Phase B — 壳注入

5. 订阅 `mf.onRoutesChange`，把 `manager.getRoutes()` 并进 Host router。  
6. 侧栏读 `manager.getSidebarItems()`（或 kit SidebarInjector 订阅）。  
7. **验收 B**：已启用插件出现菜单；点击进壳路由不 404（异步注入需 ready 占位，见本仓路由防闪）。

### Phase C — 声明式挂载

8. 页面使用：

```tsx
// 从 kit react 入口引入声明式插件组件
import { FederationPlugin } from '@dnhyxc-ai/federation-kit/react';

// 路由页里只传插件 id（与 registry 一致）
export function NotesPage() {
	// 渲染学习笔记 Remote
	return <FederationPlugin name="learningNotes" />;
}
```

9. 提供 slots（loading/error）以免白屏无提示。  
10. **验收 C**：进入页后 Remote UI 出现；失败可重试。

### Phase D — 能力注入（适配层）

11. 新建 `src/federation/runtime.ts`：`createFederation({ capabilities: { toast, http, … }, fetchRegistry, enabledStore })`。  
12. 业务**只**从该门面导入（对标本仓 `@/federation`）。  
13. **验收 D**：插件调 toast/http 命中 Host 实现；无权限方法为 undefined。

### Phase E — 样式隔离（默认已含）

14. `loadRemote` 路径确认包了 `beginPluginStyleCapture`（Manager 内置）。  
15. 挂载路径确认 `attachPluginStyleIsolation`（PluginHostView 内置）。  
16. Host 根节点加 `data-mf-host-portal`；Toaster 显式高 z-index。  
17. 可选 `configureStyleIsolation({ hostViteRootMarker })`。  
18. **验收 E**：见下方 T 表。

### Phase F — 增强

19. surface 插件：`useHostSurfacePlugins` + 自有 Surface 组件。  
20. 不受信：`trust: 'untrusted'` + `iframeUrl` + iframe 能力表。  
21. Vue Remote：`framework: 'vue'` + expose `{ mount, unmount }`。

---

## 2. 最小可运行切片（MVP）

只做这些即可演示主路径：

| 步骤 | 内容 |
|------|------|
| M1 | 一个静态 registry + 一个 React Remote |
| M2 | `createFederation` + `start` + 路由合并 |
| M3 | 一页 `<FederationPlugin name="demo" />` |
| M4 | capabilities 只实现 `toast` |

然后再加：偏好开关、Portal 弹层、surface、iframe、Vue。

---

## 3. 替身表（换栈时）

| 本项目 | 抽象动作 | 其他栈常见替身 |
|--------|----------|----------------|
| `Toast` (sonner) | 提示用户 | antd message / ElMessage |
| `http` (本仓封装) | 带 cookie 的 API | axios / fetch wrapper |
| COS registry | 远程清单 | 自建 CDN / 配置中心 |
| 账号 prefs | 上架持久化 | localStorage（kit 默认）/ 用户服务 |
| `PluginHostPage` design | 皮肤 | 任意 Loading/Button |
| Tauri `setAppFullscreen` | 桌面全屏 | 忽略或 Fullscreen API |

---

## 4. 验收用例（打勾）

| ID | 步骤 | 期望 | 对应 |
|----|------|------|------|
| T1 | `start` 后看侧栏 | 已启用插件壳可见 | Phase B |
| T2 | 打开信任插件 | UI 正常 | Phase C |
| T3 | 插件内打开 Select/Dialog | 浮层有插件主题、可点 | Phase E |
| T4 | 宿主页 Markdown / 代码高亮 | 样式不被插件搞坏 | Phase E |
| T5 | 宿主 Toast | 自动关；悬停暂停；关闭钮可出 | Phase E |
| T6 | 关闭插件页再开 | 样式仍在（同 entry reclaim） | Phase E |
| T7 | 断网启动（有缓存） | 仍能见上次清单 | Phase A |
| T8 | 下架插件 | 入口消失 | Phase D |
| T9 | 不受信插件（若做） | iframe + RPC | Phase F |
| T10 | Vue Remote（若做） | 挂载与卸载干净 | Phase F |

---

## 5. 移植时容易踩的坑

| 若忘记… | 会出现… | 对照 |
|---------|----------|------|
| 双入口共用默认 Host / 捕获栈 | 样式偶发不隔离或 release 错乱 | [03 F9](./03-style-isolation.md) |
| 挂载长窗仍 `claimUnmarked=true` | Host Markdown/Toast 被 scope | [03 F2](./03-style-isolation.md) |
| portal z-index 高于 Toast | Toast 不能悬停/关不掉观感异常 | [03 F8](./03-style-isolation.md) |
| App 根无 `data-mf-host-portal` | Host portal 被收进插件域 | [05](./05-host-adapter-frontend.md) |
| Bridge 不 `deepFreeze` | 插件可篡改 Host 函数 | [02 F15](./02-runtime-mf-bridge.md) |
| 业务直连 kit 包名 | 换适配困难、双实例风险 | [05](./05-host-adapter-frontend.md) |
| 异步路由无 ready 占位 | 刷新闪 404 | 本仓 router 方案 |
| Remote expose 未 import 样式 | 插件「没样式」 | 插件开发指南 |

---

## 6. 建议目录（新 Host）

```text
src/
  federation/
    index.ts          # 对外唯一出口
    runtime.ts        # createFederation 接线
    registry.ts       # 可选自定义拉取
    host/
      PluginPage.tsx  # slots 皮肤
  pages/
    plugin-demo.tsx   # <FederationPlugin />
```

---

## 7. 与分册的对应

| 复刻阶段 | 精读 |
|----------|------|
| Phase A–B | [02](./02-runtime-mf-bridge.md) F1–F7、F13–F14 |
| Phase C | [04](./04-react-host-view.md) |
| Phase D | [05](./05-host-adapter-frontend.md) + [02](./02-runtime-mf-bridge.md) F15 |
| Phase E | [03](./03-style-isolation.md) 全文 |
| Phase F | [02](./02-runtime-mf-bridge.md) F10/F16、[04](./04-react-host-view.md) F6/F8 |

---

## 8. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-08-10 | 初版复刻手册，与 01–05 分册对齐 |
