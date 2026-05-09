# NestJS 接入 ChatTTS 服务实现 SPEC

> **文档性质**：后端实现规格说明，用于在 Cursor / 评审中落地「自建或内网 ChatTTS 推理服务 → NestJS 统一封装 → 前端或其它服务消费」的全链路；撰写本文档时**不要求**立即修改业务源码，但以本仓库现有模式（如 `speech-transcription`、`english-learning`）为对齐参考。  
> **ChatTTS 背景**：开源对话场景语音合成模型，仓库见 [2noise/ChatTTS](https://github.com/2noise/ChatTTS)；官方提供基于 FastAPI 的 HTTP 示例（`examples/api`）。

---

## 1. 目标与范围

### 1.1 目标

- 在 **NestJS** 侧提供 **稳定、可观测、可配置** 的 TTS（文本转语音，Text-to-Speech）能力，底层推理引擎为 **ChatTTS**（通常以 **独立进程 / 容器** 部署，通过 HTTP 调用）。
- 与现有 **`speech-transcription`（ASR，语音转写）** 对称：ASR 负责「音频 → 文本」，本 SPEC 负责「文本 → 音频」。
- 支持后续业务扩展（如英语学习单词朗读、助手语音播报等），**不绑定**某一具体前端页面。

### 1.2 范围（本 SPEC 覆盖）

| 维度 | 说明 |
|------|------|
| 部署假设 | ChatTTS 以 **HTTP 服务** 暴露（官方 `examples/api/main.py` 或 `openai_api.py`，或社区 OpenAI 兼容封装）；NestJS **不负责**模型加载与 GPU 调度，仅做 **网关与策略** |
| API 形态 | 至少支持 **同步返回音频体**（`application/octet-stream` 或 `audio/wav` / `audio/mpeg`）；可选支持 **流式**（若上游提供 chunk） |
| 安全 | 内网 URL、可选共享密钥、文本长度与并发限制、防 SSRF |
| 可运维 | 配置项、超时、日志字段、失败降级策略（可选） |

### 1.3 非目标

- 不在本 SPEC 内规定 **前端播放器** 具体实现（Web Audio、`audio` 标签、Range 请求等由前端 SPEC 或业务 PR 决定）。
- 不强制替换现有 **云端 TTS**（如硅基、浏览器 SpeechSynthesis）；ChatTTS 可作为 **可选后端实现** 之一。
- 不在此文档展开 **模型训练 / 微调 / 声线克隆** 流程。

---

## 2. 术语（中英对照）

- **ChatTTS**：本项目所指的开源 TTS 模型与配套推理代码（2noise 维护）。
- **推理服务（Inference Server）**：运行 ChatTTS 并暴露 HTTP 的进程（常为 FastAPI + Uvicorn）。
- **NestJS 适配层**：`ChatTtsModule` + `ChatTtsService` + `ChatTtsController`（名称可微调，但职责需一致）。
- **SSRF（服务端请求伪造，Server-Side Request Forgery）**：禁止由客户端任意指定上游 `baseURL` 导致内网探测；**仅允许**服务端配置的固定上游。

---

## 3. 上游 ChatTTS HTTP 形态（实现前必须选定其一）

官方仓库提供两种示例入口（见 [examples/api README](https://github.com/2noise/ChatTTS/blob/main/examples/api/README.md)）：

| 模式 | 启动示例（官方文档） | NestJS 集成建议 |
|------|----------------------|-----------------|
| **A. 原生 FastAPI** | `fastapi dev examples/api/main.py` | 在 SPEC 附录中 **锁定**实际路由、请求体、响应 `Content-Type`（以实现时抓包或读源码为准），在 `ChatTtsService` 内写死映射 |
| **B. OpenAI 兼容 API** | `fastapi dev examples/api/openai_api.py` | 优先对齐 **OpenAI Audio Speech** 形态（`POST .../audio/speech`），NestJS 可用 **统一 DTO** 转发；便于与社区封装（如第三方 OpenAPI 包装）互换 |

**规格约束（强制）**

1. 在项目 `README` 或运维文档中 **写明**生产环境采用的模式 **A 或 B** 及版本号（ChatTTS commit / tag）。
2. NestJS **不得**同时假设两套路径混用；若需切换，通过 **配置切换 endpoint 路径前缀**，而非运行时猜测。
3. 若上游返回 **WAV / PCM** 与 **MP3** 不一致，适配层须在响应头中 **透传或规范 `Content-Type`**，并在接口文档中声明。

---

## 4. NestJS 模块设计（建议目录）

与现有 `apps/backend/src/services/speech-transcription` 并列：

```
apps/backend/src/services/chat-tts/
├── chat-tts.module.ts
├── chat-tts.controller.ts
├── chat-tts.service.ts
├── dto/
│   └── synthesize-chat-tts.dto.ts
└── README.md                    # 可选：运维链接与环境变量速查
```

### 4.1 职责划分

| 组件 | 职责 |
|------|------|
| `ChatTtsService` | 读取配置、`HttpService`/`axios` 调用上游、超时、错误映射、可选缓存键生成（若未来加缓存） |
| `ChatTtsController` | 暴露 **JWT 或其它与业务一致的鉴权**、校验 DTO、返回 StreamableFile 或 Buffer + Headers |
| `ChatTtsModule` | 注册 `HttpModule`（若使用 `@nestjs/axios`）、导出 Service 供其它模块注入 |

### 4.2 与 `AppModule` 的集成

- 在 `app.module.ts` 中 `imports: [ ChatTtsModule ]`（与其它 feature module 同级）。
- 若仅允许内网管理端调用，可增加 **RoleGuard** 或独立前缀 `/internal/chat-tts`（产品决策）。

---

## 5. 配置与环境变量（建议在 `ModelEnum` 或独立 `ChatTtsEnum`）

下列键名为建议命名，实现时可合并到 `ModelEnum` 或新建 `ChatTtsEnum`（与 `KnowledgeQaEnum` 风格一致）。

| 键名 | 必填 | 说明 |
|------|------|------|
| `CHAT_TTS_BASE_URL` | 是 | 上游根地址，如 `http://chattts-inference:8000`，**无尾斜杠**；仅内网或 Service 名 |
| `CHAT_TTS_API_KEY` | 否 | 若推理服务前加 API Gateway，使用 Bearer 或 `X-Api-Key` |
| `CHAT_TTS_SYNTH_PATH` | 否 | 自定义路径，如 `/v1/audio/speech`；未配置则代码内按选定模式 A/B 写死默认 |
| `CHAT_TTS_TIMEOUT_MS` | 否 | 默认建议 `60000`～`120000`（长文本合成较慢） |
| `CHAT_TTS_MAX_TEXT_LENGTH` | 否 | 默认如 `2000` 字符，防止滥用；与上游最大上下文对齐后调整 |

**安全（强制）**

- `CHAT_TTS_BASE_URL` **只能来自环境变量**，禁止请求体传入完整 URL。
- 生产环境建议在启动时校验 host 为 **预期内网段或 K8s Service 名称**，避免配置失误指向公网随机地址。

---

## 6. 对外 HTTP API 设计（NestJS 暴露给前端或其它服务）

### 6.1 建议路由

- `POST /chat-tts/synthesize`（或 `/tts/chattts/synthesize`，与全局路由风格统一即可）

### 6.2 请求 DTO（建议字段）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | 是 | 待合成文本；trim 后非空 |
| `language` | enum | 否 | `zh` / `en` / `auto`；若上游不支持则由 prompt 或默认音色策略消化 |
| `voice` / `speaker` | string | 否 | 映射上游音色 id；未传则用服务端默认 |
| `format` | enum | 否 | `mp3` / `wav`；若上游固定格式则忽略并文档说明 |

**校验**

- 使用 `class-validator`：`text` `MaxLength` 对齐 `CHAT_TTS_MAX_TEXT_LENGTH`。
- 过滤不可见控制字符（可选），降低上游异常概率。

### 6.3 响应

- **成功**：`200`，body 为 **音频二进制**，`Content-Type` 与上游一致或显式 `audio/mpeg`、`audio/wav`。
- **失败**：统一 NestJS 异常过滤器格式；业务错误信息区分：
  - 上游超时 / 5xx → `502` 或 `504`，日志带 `requestId`（若有）。
  - 参数非法 → `400`。
  - 未配置 `CHAT_TTS_BASE_URL` → `503`。

### 6.4 流式（可选扩展）

若上游支持 chunk 流式输出音频：

- NestJS 可使用 `@Res({ passthrough: false })` + `response.write`，或返回 `StreamableFile`；
- SPEC 要求：**Content-Type、Transfer-Encoding** 与上游契约一致，并在接口文档标注「仅部分部署可用」。

---

## 7. 调用上游的实现契约（`ChatTtsService`）

### 7.1 HTTP 客户端

- 使用 `@nestjs/axios` `HttpService` 或项目既有 HTTP 工具；**必须**设置：
  - `timeout`（来自 `CHAT_TTS_TIMEOUT_MS`）
  - `maxRedirects: 0`（降低 SSRF 链风险，若适用）
  - 合理的 `maxContentLength` / `maxBodyLength`（防止超大响应撑爆内存）

### 7.2 错误映射

| 场景 | 行为 |
|------|------|
| 上游返回非 2xx | 记录 **status、响应体摘要（截断）**，向上抛 `HttpException` |
| 上游返回 JSON 错误 | 解析 `message` 字段写入日志；对用户返回模糊文案（避免泄露内网细节） |
| 网络错误 / DNS | `502`，日志含 `CHAT_TTS_BASE_URL` host（不含密钥） |

### 7.3 观测性

- **结构化日志**：`chat_tts.synthesize` + `duration_ms` + `text_length` + `upstream_status`。
- **可选指标**：Prometheus counter（成功/失败）、histogram（延迟）；与现有后端监控栈对齐。

---

## 8. 安全与合规

| 项目 | 要求 |
|------|------|
| 鉴权 | 与 `english-learning`、`speech-transcription` 一致：默认 **JwtGuard**；按需 Role |
| 限流 | 建议按用户 id 或 IP 配置速率限制（可在网关层） |
| 内容 | 日志中 **禁止**打印完整 `text`（或仅打印 hash + 长度），防止敏感台词泄露 |
| 版权 / 使用条款 | 产品侧提示：合成语音用途需符合 ChatTTS 开源协议及本地法务要求 |

---

## 9. 验收标准（实现 PR 可勾选）

1. 配置有效 `CHAT_TTS_BASE_URL` 时，`POST /chat-tts/synthesize` 能返回 **可播放** 音频（前端或 curl `--output` 验证）。
2. `text` 超长、`text` 为空、未登录访问分别返回 **400 / 401** 等预期状态。
3. 上游宕机或超时时，接口 **不会挂死进程**，返回 **5xx** 且日志可定位。
4. **环境变量缺失**时启动行为明确：要么启动失败（fail-fast），要么接口返回 **503** 并在文档说明（二选一，团队统一）。
5. OpenAPI / Swagger（若项目已启用）中能查到该接口的 **请求体与响应类型（binary）** 说明。

---

## 10. 与现有模块的关系

| 模块 | 关系 |
|------|------|
| `speech-transcription` | 职责相反；可共享 `HttpModule` 配置模式，不要混在一个 Controller |
| `english-learning` | 前端当前可直连云端 TTS；若改为后端 ChatTTS，应 **新增调用** `ChatTtsService` 或由前端改调新路由（产品决策） |
| `ConfigModule` / `ModelEnum` | 新增键与 `.env.example` 同步更新 |

---

## 11. 附录：官方示例入口（便于运维对照）

- ChatTTS 仓库：`https://github.com/2noise/ChatTTS`
- API 示例说明：`examples/api/README.md`（安装依赖、`main.py` / `openai_api.py` 启动方式）

**说明**：不同版本 ChatTTS 的请求字段可能变化；**实现阶段**应以部署实例的实际 OpenAPI / 源码为准，并在本 SPEC 第 3 节表格中 **回填最终选定路径与示例 curl**。

---

## 12. Vibe Coding 清单（改代码前自检）

1. 已选定上游模式 **A 或 B**，避免 Controller 里写死错误路径。  
2. `BASE_URL` **绝不**来自客户端 body / query。  
3. 超时与 `maxTextLength` 已配置，避免长文拖垮事件循环（大 Buffer 时注意内存）。  
4. 错误时对用户 **模糊**、对日志 **具体**（截断 body）。  
5. `.env.example` 与 `README` 已补充 ChatTTS 部署链接与必填环境变量。
