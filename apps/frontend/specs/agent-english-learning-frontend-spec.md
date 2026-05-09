# 英语学习（Agent）前端 SPEC

> **依据**  
> - 产品/能力：[`apps/backend/specs/agent-english-learning-spec.md`](../../backend/specs/agent-english-learning-spec.md)  
> - 后端实现入口：[`apps/backend/src/services/agent`](../../backend/src/services/agent)（`AgentController`、`AgentChatDto`、流式 `chatStream` 等）  
> **本文档性质**：仅定义前端产品行为、接口对接约定与状态/UI 要求；**不修改任何现有代码**。  
> **版本**：v1。

---

## 1. 目标与范围

### 1.1 目标

- 在前端提供面向 **大众人群** 的 **英语学习中心** 体验：覆盖 **单词、短语、句子、语法、名著/文献导读、按需阅读材料、实时翻译** 等能力，与后端 `agent-english-learning-spec` 一致。
- 与现有 **LangChain Agent** 能力对齐：**SSE 流式**、**会话**、**可中断**、**工具事件**（知识库检索、互联网搜索等）在 UI 上可感知（至少不破坏解析）。
- **JWT**：所有 Agent 接口均需登录态；未登录时引导登录，不向 `/agent/*` 发请求。

### 1.2 范围（前端）

| 包含 | 不包含（可作为后续 SPEC） |
|------|---------------------------|
| 学习中心布局、模式与难度、快捷意图、对话区、流式展示、停止生成 | 后端新增字段以外的服务端改动 |
| 对接 `POST /agent/sse`、`POST /agent/stop`、会话创建/查询/删除 | TTS、发音评分、独立错题本数据库表（见后端 SPEC 增强项） |
| 免责声明与未成年人提示文案占位 | 替代「知识库入库」全流程的产品重构 |

### 1.3 后端接口基线（实现对接时以仓库为准）

以下取自当前后端 **`AgentController`（`@Controller('agent')`）** 与 **`AgentChatDto`**，前端 SPEC 依赖该契约：

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/agent/session` | 创建会话，`CreateAgentSessionDto` |
| `GET` | `/agent/session/:sessionId` | 会话详情 |
| `DELETE` | `/agent/session/:sessionId` | 删除会话 |
| `POST` | `/agent/sse` | **SSE**，body 为 `AgentChatDto` |
| `POST` | `/agent/stop` | 停止当前 session 流，`AgentStopDto` |

**`AgentChatDto`（当前）主要字段**：

- `content`（必填，字符串，有最大长度约束）
- `sessionId`（可选，UUID）
- `title`（可选）
- `maxTokens`、`temperature`（可选）

> **与《英语学习》后端 SPEC 的衔接**：该文档提出可通过 **`assistMode: english_learning`**（或等价字段）附加专项系统提示。若 **`AgentChatDto` 尚未包含该字段**，前端有两类策略（二选一或并存，由产品定）：  
> - **A. 契约就绪后**：在 `POST /agent/sse` 的 JSON body 中增加 `assistMode: "english_learning"`（需与后端发布同步）。  
> - **B. 过渡期**：仅在 `content` 首行或固定前缀中携带「英语学习模式」说明（易碎，仅临时）；**推荐尽快走后端字段**。  
> 本 SPEC 下文默认 **存在专项模式字段时的交互**；未上线时 UI 可先隐藏开关或走后端默认提示词策略。

---

## 2. 术语（与后端 SPEC 对齐）

- **SSE（Server-Sent Events）**：前端用 `EventSource` 或等价方式消费 `/agent/sse` 的流。
- **英语学习模式（English learning mode）**：用户显式进入的学习意图集合；请求层对应 **`assistMode`**（若后端提供）。
- **档位（Level tier）**：基础 / 进阶 / 提高，对应后端 SPEC §3；前端可用 Segmented / Select，并写入用户消息或请求扩展字段（见 §5）。

---

## 3. 信息架构与路由建议

### 3.1 入口

- **一级入口**：应用内「学习」或「英语」入口，进入 **英语学习会话页**（可与通用 Agent 页签分离，避免与普通聊天混淆）。
- **可选**：从知识库页「用 Agent 精读本文」跳转时，带上 **上下文摘要** 写入首条 `content` 或会话 `title`（具体字段以后端为准）。

### 3.2 页面区块（建议）

1. **顶栏**：会话标题（可编辑）、返回列表、新建会话。  
2. **配置条（可选折叠）**：  
   - **专项模式**：英语学习 ON（映射 `assistMode`）。  
   - **难度档位**：基础 / 进阶 / 提高（影响默认 prompt 组装方式见 §5）。  
   - **快捷意图**（ chips ）：例如「背单词」「翻译这段」「短文精读」「名著导读」「语法纠错」。  
3. **对话区**：用户消息 / 助手消息列表；助手消息支持 **Markdown** 渲染（与现有聊天组件能力对齐）。  
4. **输入区**：多行文本、发送、**停止生成**（调用 `/agent/stop`）。  
5. **底栏提示**：翻译免责声明、版权与名著节选说明（引用后端 SPEC §4.5、§4.7）。

---

## 4. 核心交互流程

### 4.1 新建会话并发首条消息

1. 用户点击「新对话」→ 调用 `POST /agent/session` 拿到 `sessionId`（字段名以实际响应为准）。  
2. 用户输入问题 → `POST /agent/sse`，body 包含 `sessionId`、`content`；若启用英语学习模式，附带 **`assistMode`**（若后端已支持）。  
3. 前端订阅 SSE，按 chunk 追加助手正文（打字机效果）。

### 4.2 继续对话

- 沿用同一 `sessionId`，仅追加 `content`。  
- 依赖后端 **会话记忆 / 摘要**，用户无需手动粘贴上文（与 `agent` 模块行为一致）。

### 4.3 停止生成

- 用户点击「停止」→ `POST /agent/stop`，body 含 `sessionId`。  
- UI 立即结束加载态；允许保留已输出片段。

### 4.4 工具调用可见性

- SSE payload 中若包含 `type: 'tool'` 与 `raw`（见 `AgentController` 映射），前端宜：  
  - **MVP**：展示「检索中 / 已检索」等轻量状态，避免空白等待。  
  - **增强**：列表展示工具名与阶段（start/end），不暴露敏感参数。

---

## 5. 请求组装策略（英语学习）

下列逻辑属于 **前端契约**，便于与 [`agent-english-learning-spec.md`](../../backend/specs/agent-english-learning-spec.md) 对齐。

### 5.1 `assistMode`（后端就绪时）

- 英语学习专用会话：**每次** `POST /agent/sse` 建议携带 `assistMode: "english_learning"`，避免用户忘记切换导致通用提示占主导。

### 5.2 档位与快捷意图

- **档位**：将所选档位写入 `content` 的前缀或单独结构化字段（若后端扩展 DTO）。推荐文案模板示例（产品可改）：  
  - `[档位：基础]` / `[档位：进阶]` / `[档位：提高]`  
- **快捷意图**：在 `content` 前拼接简短指令，例如：  
  - 「请按英语学习助手规范：帮我讲解单词 …」  
  - 「请提供中英逐句对照翻译：…」  
  具体是否与后端 `assistMode` 重复，以避免冗余为准。

### 5.3 实时翻译

- 用户粘贴大段文本时：输入区允许「翻译 / 对照 / 仅要术语表」选项映射到首句指令。  
- **流式展示**：SSE `content` 增量拼接即为「实时翻译」体验；无需额外轮询。

### 5.4 名著与文献

- 快捷意图「名著导读」：默认提示用户选择 **公版导读 / 摘要讨论**，符合后端版权条款；前端展示简短 **版权提示**（非法律文本）。

### 5.5 与知识库（RAG）协同

- 若应用内已有「知识库」与入库能力：英语学习页可提供文案引导用户「先把生词本/摘录入库再提问」；**实际检索由 Agent 工具调用完成**，前端只需保留工具状态反馈（§4.4）。

---

## 6. SSE 事件处理（前端）

### 6.1 与控制器契约对齐

`chatSse` 将流式块映射为：

- `data.type`：`'content' | 'tool'`（以实际 `chunk.type` 为准）  
- `data.content`：`type === 'content'` 时的文本增量  
- `data.raw`：`type === 'tool'` 时的工具载荷  
- `data.done`：流是否结束；最后一包可为 `{ done: true }`  
- `data.error`：错误信息（含未登录等）

### 6.2 前端状态机（建议）

- `idle` → `streaming`（收到首个 content 或 tool）→ `done` / `error` / `stopped`。  
- **重试**：错误时可保留用户输入，允许一键重发（注意幂等与会话状态）。

---

## 7. UI/UX 与可访问性

- **长文本**：翻译场景下允许助手消息区域独立滚动；输入框与消息区键盘焦点顺序合理。  
- **加载**：首 token 未到达时显示明确 loading，避免用户重复点击发送。  
- **移动端**：输入区与发送按钮易于触达；长 SSE 不断流时考虑性能（虚拟列表可选）。  
- **免责声明**：在设置翻译或首次进入英语学习模式时展示一次性 **简短** 说明（重要场合人工校对）。

---

## 8. 验收标准（前端）

与后端 SPEC §7.1 对齐，从前端可验证：

- [ ] 登录用户可创建会话并通过 SSE **连续收到**英语学习相关回复（打字机）。  
- [ ] **停止** 生效，且界面状态正确。  
- [ ] 用户可选择 **档位** 与 **快捷意图**，且体现在发出的请求或可观测的 `content` 中。  
- [ ] 助手消息支持 **Markdown**，公式/代码块若有需求与全局聊天一致。  
- [ ] 工具调用阶段用户可见 **非空白等待**（MVP 级即可）。  
- [ ] 展示 **翻译与版权相关提示**（占位文案即可）。  

---

## 9. 非目标与风险

- **不保证** 离线可用。  
- **版权**：前端仅提示；内容合规以后端与模型为准。  
- **字段不同步**：若先上前端开关而后端未发布 `assistMode`，需 feature flag 或降级为纯 `content` 指令。

---

## 10. 文档维护

- **关联后端 SPEC**：[`apps/backend/specs/agent-english-learning-spec.md`](../../backend/specs/agent-english-learning-spec.md)  
- **关联代码目录**：[`apps/backend/src/services/agent`](../../backend/src/services/agent)  
- **变更记录**：v1 — 初稿，仅 SPEC，无代码变更。
