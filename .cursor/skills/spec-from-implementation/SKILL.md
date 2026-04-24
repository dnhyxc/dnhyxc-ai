---
name: spec-from-implementation
description: 从现有代码实现反推并生成“企业级 SPEC”文档（Markdown）。当需要为某个模块/页面/组件/Store/Hook 输出可验收的规范说明，或用户提到“反推 spec / 写 spec / 生成 spec / 规范文档 / spec-from-implementation”，且目标是写入仓库内的 *.md（例如 apps/frontend/spec/*.md、apps/*/design/*.md）时使用。适用于 React+TypeScript 前端（含 MobX、SSE 流式、分支消息树、Monaco 编辑器等复杂交互），也适用于一般 TypeScript 模块。
---

## 目标

把“实现即规范”固化成可验收、可维护的企业级 SPEC：
- **覆盖每个功能点**：从用户可见交互到隐藏的状态机与边界条件
- **覆盖实现细节**：关键字段、状态来源、互斥条件、协议/接口、错误提示、性能策略
- **可落盘**：最终写入用户指定的 Markdown 文件路径

## 输出要求（硬约束）

- **语言**：简体中文；保留英文技术术语，首次出现时括号注明中文
- **结构**：使用 `###`/`####` 分层；每节内容可直接转为验收用 checklist
- **以代码为准**：不要猜；任何“功能存在”都要能在代码里找到依据
- **不写空话**：避免泛泛的“提升体验/优化性能”，必须写到“做了什么/为什么/如何触发/怎么回滚”

## 工作流（按顺序执行）

### 1) 定位入口与边界

- 明确范围：用户给的目录/文件（如 `@apps/frontend/src/views/chat`）
- 找“入口文件”：
  - 路由页面（`views/*/index.tsx`、`routes` 注册处）
  - 组件入口（`index.tsx`/`export default`）
- 列出模块依赖面：
  - Store（MobX）、Hooks、service/api、utils、types、contexts

### 2) 拉齐“用户动作 → 状态机 → 网络 → UI”

对每个用户动作，必须写清楚：
- **触发入口**：按钮/快捷键/右键菜单/滚动事件等
- **前置条件**：登录、正文非空、loading/streaming 互斥、只读限制等
- **状态变化**：哪些 state/ref/map 被写入，何时清理
- **网络调用**：endpoint、请求体、回调事件、错误处理与回滚
- **UI 表现**：哪些组件/区域变更，提示文案、禁用态、滚动行为

### 3) 把“隐式实现细节”变成 SPEC 条款

重点抓以下“经常漏写但会出 bug”的实现点：
- **key/canonicalKey**：身份映射、nonce 后缀、换篇/切会话是否串状态
- **流式（SSE）**：协议字段、done/error、缓冲/节流、abort/stop
- **回滚策略**：未收到流式数据就 stop/错误时如何恢复
- **互斥关系**：preview vs diff vs assistant、sharing vs input 等
- **性能策略**：rAF 合并、ResizeObserver/MutationObserver、lazy mount、稳定引用
- **跨组件共享**：Context 的 ref/map、受控/非受控模式契约

### 4) 生成 SPEC（用模板）

读取并使用 `references/spec-outline.md` 的章节骨架，按模块实际情况增删。

### 5) 写入目标文件并自检

- 把内容写入用户指定的 `*.md`
- 自检清单：
  - 是否覆盖所有入口文件？
  - 是否覆盖所有关键 hooks/store/service？
  - 是否包含“验收清单”与“边界条件”？
  - 是否存在与代码不一致的断言？

## 参考模板

- `references/spec-outline.md`：企业级 SPEC 章节骨架（可直接复制到目标文档）

