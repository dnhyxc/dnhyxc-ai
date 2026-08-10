# @dnhyxc-ai/federation-kit 实现文档索引

> **以源码为准**：若文档与 `packages/federation-kit/src` / `apps/frontend/src/federation` 不一致，以工作区源码为准。  
> **范围**：讲清「当前仓库里微前端（Module Federation Host）具体怎么实现」；含逐行中文注释的实现摘录。  
> **非目标**：不改业务源码；不替代插件业务开发教程（插件侧见本仓 `apps/frontend/src/federation/docs/`）。

## 阅读顺序（推荐）

| 顺序 | 文档 | 内容 | 约略篇幅 |
|------|------|------|----------|
| 1 | [01-architecture-overview.md](./01-architecture-overview.md) | **先读**：一句话模型、分层、总功能点索引、端到端旅程、问题总表、文档地图 | 总览 |
| 2 | [07-api-method-reference.md](./07-api-method-reference.md) | **方法字典**：`resolvePluginBust` / `ensurePlugin` / `loadPlugin` / `runLoad` / `createPluginRuntime` 等——作用、目的、签名、调用链、副作用、失败 | 方法详解 |
| 3 | [02-runtime-mf-bridge.md](./02-runtime-mf-bridge.md) | `createFederation` / `PluginManager` / MF 加载 / 校验 / 偏好 / 路由侧栏注入 / Bridge / iframe / EventBus | 核心运行时 |
| 4 | [03-style-isolation.md](./03-style-isolation.md) | realm、`claimUnmarked`、head/CSSOM、认领/reclaim、Portal、z-index vs Toast、双入口 `globalThis` | 样式隔离 |
| 5 | [04-react-host-view.md](./04-react-host-view.md) | `FederationPlugin` / `PluginHostView` / slots / untrusted iframe / hooks | React 挂载 |
| 6 | [05-host-adapter-frontend.md](./05-host-adapter-frontend.md) | 本仓 `@/federation` 适配层（Toast/COS/偏好/ebook/全屏/design slots） | Host 接线 |
| 7 | [06-replication-playbook.md](./06-replication-playbook.md) | **跨项目复刻**：前置条件、建造顺序、MVP、验收清单、常见失误 | 可落地手册 |
| 8 | [08-lifecycle-hooks.md](./08-lifecycle-hooks.md) | **生命周期变更**：`pickPluginLifecycle`、缺钩子 `console.info`、`runLoad`/`unload`、React/Vue 导出（逐行注释） | 生命周期 |

## 三层心智模型（30 秒）

```text
┌─────────────────────────────────────────────────────────────┐
│  业务页 / Layout / Router（只 import @/federation）            │
├─────────────────────────────────────────────────────────────┤
│  Host 适配层 apps/frontend/src/federation                     │
│  （能力注入、registry、偏好、PluginHostPage/Surface）          │
├─────────────────────────────────────────────────────────────┤
│  @dnhyxc-ai/federation-kit                                    │
│  · runtime + MF + Bridge                                      │
│  · style-isolation（sandbox + portal）                        │
│  · react（FederationPlugin / PluginHostView）                 │
└─────────────────────────────────────────────────────────────┘
```

## 和旧文档的关系

| 位置 | 角色 |
|------|------|
| **本目录 `packages/federation-kit/docs/`** | 以 **抽包后的 kit + 适配层** 为准的实现思路与逐行注释 |
| `apps/frontend/src/federation/docs/` | 面向 Host/插件开发者的接入与开发指南（历史路径曾为 `plugins/docs`） |
| `docs/ideas/federation-kit-extract.md` 等 | 规划/想法类文档，可能滞后于源码 |

## 包入口速查

| 入口 | 用途 |
|------|------|
| `@dnhyxc-ai/federation-kit` | `createFederation`、runtime、bridge、style-isolation 再导出 |
| `@dnhyxc-ai/federation-kit/react` | `FederationPlugin` / `PluginHostView` / hooks（独立打包，单例靠 `globalThis`） |
| `@dnhyxc-ai/federation-kit/style-isolation` | 仅样式隔离 |
| 本仓业务 | **只**从 `@/federation` 导入 |

## 维护约定

1. 改 kit 行为时：优先更新本目录对应分册，并在 [01](./01-architecture-overview.md) 的功能点索引补一行。  
2. 代码块规范：可执行代码行上方必须有中文意图注释（见 feature-impl-guide）。  
3. 禁止在文档中粘贴密钥、真实 `.env`、生产 COS 凭证。
