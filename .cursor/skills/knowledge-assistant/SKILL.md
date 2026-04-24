---
name: knowledge-assistant
description: 在任意 React + TypeScript 项目中复用“文档侧边助手”的会话/流式/持久化(ephemeral)逻辑与 UI 样式逻辑。
license: Internal
---

本 Skill 用于在**不同项目**中复用你当前仓库里的「知识库右侧通用助手」实现范式：包括按 `documentKey`（文档标识）隔离会话、SSE（Server-Sent Events，服务端事件）流式增量渲染、ephemeral（临时态/不落库）与持久化会话切换、以及与之匹配的布局/交互/样式逻辑。

你将得到一套**可复制的模板代码**（见 `templates/`），并通过少量“适配器（Adapter，适配层）”把它接入任意项目的 UI 组件库、路由/状态管理、以及后端接口。

---

## 你会得到什么

- **可复用的核心逻辑**
  - `AssistantStore`：按文档维度隔离 state；支持持久化与 ephemeral 模式；支持流式中断、以及“首次保存后迁入对话（import transcript）”的迁移策略。
  - `streamAssistantSse`：解析后端 SSE `data: { type, content, done, error }` 协议，向上提供 `onDelta/onThinking/onComplete` 回调。
- **可复用的 UI 结构与样式**
  - 主布局：空态提示/快捷卡片、消息列表、输入框、滚动角落 FAB（toTop/toBottom）、流式贴底滚动。
  - 消息气泡：用户/助手两种样式、操作区（复制/写入文档等）的挂载位置与间距。
- **可移植的模板文件**
  - 见 `templates/assistant/*`，可直接复制到新项目再按“适配点”替换。

---

## 适用范围与前置条件

- **技术栈**
  - React + TypeScript
  - 推荐 Tailwind CSS（本模板的样式类以 Tailwind 为主；不使用 Tailwind 时可把 className 提取为 CSS Modules/Styled Components）
- **后端能力**
  - SSE 流式接口（`POST /assistant/sse` 或等价），返回 `text/event-stream`，每行形如 `data: {...}\n`
  - 可选：持久化会话接口（create/get/detail/stop/import transcript/patch binding）

---

## 接入步骤（最短路径）

1. **复制模板**
   - 将 `templates/assistant/` 复制到你的项目中（例如 `src/assistant/`）。
2. **实现 UI 适配器**
   - 在 `KnowledgeAssistant.tsx` 里替换 `AssistantUiAdapter`：把 `Toast`、`Button`、`ScrollArea`、以及你项目里的输入组件挂进去。
3. **对接接口层**
   - 在 `assistantApi.ts` 中实现（或映射）：
     - `createAssistantSession`
     - `getAssistantSessionByArticle`
     - `getAssistantSessionDetail`
     - `patchAssistantSessionBinding`
     - `importAssistantTranscript`
     - `stopAssistantStream`
4. **提供文档上下文**
   - 将 `documentKey` 作为 props 传给 `KnowledgeAssistant`，并在文档切换时调用 `assistantStore.activateForDocument(documentKey)`（模板已内置）。
5. **落地“是否允许持久化”策略**
   - 当文档尚未保存（没有稳定的云端 id）时，将 `persistenceAllowed=false`（ephemeral 模式）。
   - 首次保存完成后调用 `flushEphemeralTranscriptIfNeeded(...)` 或在仍流式时 `scheduleEphemeralFlushAfterStreaming(...)`。

---

## 关键概念与实现要点（迁移时不要丢）

- **documentKey（文档标识）**
  - UI 层可能携带 nonce 后缀（例如回收站分栏），Store 内需通过 `canonicalKey()` 抹平，避免切换视图导致会话“丢失”。
- **ephemeral 与持久化切换**
  - `persistenceAllowed=false`：不创建 sessionId，不落库；发送时携带 `contextTurns` 作为多轮上下文。
  - `persistenceAllowed=true`：确保 sessionId；流式完成后可拉取后端落库消息做最终对齐。
- **流式补丁与 MobX/状态更新**
  - 流式 delta 建议“替换消息对象”而不是原地 mutate，确保列表子组件能稳定刷新。
- **贴底滚动**
  - 流式阶段默认贴底；用户上滑阅读后解除贴底；点击角落 FAB 可回到底部或到顶部。

---

## 模板文件清单

- `templates/assistant/assistantStore.ts`：核心 Store（按文档隔离、ephemeral/持久化、迁入策略）
- `templates/assistant/assistantSse.ts`：SSE 客户端与协议解析
- `templates/assistant/assistantApi.ts`：接口层（你需要按项目实现）
- `templates/assistant/knowledgeAssistantKeys.ts`：`documentKey`/binding 的拼装工具
- `templates/assistant/KnowledgeAssistant.tsx`：UI 壳（含样式类与适配点）

