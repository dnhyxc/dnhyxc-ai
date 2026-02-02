# 聊天服务 API 使用文档

## 概述

本服务提供多模型聊天接口，支持 DeepSeek 和智谱 GLM-4 模型，具备文件附件解析、多轮对话记忆和流式响应功能。

## 环境配置

在 `.env.development` 或 `.env.production` 中配置以下环境变量：

```bash
# DeepSeek API 配置
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL_NAME=deepseek-chat

# 智谱 GLM API 配置
ZHIPU_API_KEY=your_zhipu_api_key
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_MODEL_NAME=glm-4.7-flash
```

## API 端点

### 1. 非流式聊天 (DeepSeek)

**POST** `/chat/message`

```bash
curl -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "sessionId": "optional_session_id",
    "filePaths": ["https://example.com/document.pdf"]
  }'
```

**响应示例：**

```json
{
  "content": "你好！我是DeepSeek AI助手。",
  "sessionId": "session_1741101234567_abc123",
  "finishReason": "stop"
}
```

### 2. 流式聊天 (DeepSeek)

**POST** `/chat/sse`

```bash
curl -X POST http://localhost:3000/chat/sse \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "解释一下量子计算"}
    ],
    "sessionId": "optional_session_id",
    "filePaths": []
  }'
```

**响应格式：** Server-Sent Events (SSE)

```
data: {"content":"量子","done":false}
data: {"content":"计算","done":false}
...
data: {"done":true}
```

### 3. 智谱 GLM-4 流式聊天 (支持 reasoning 和多类型输出)

**POST** `/chat/zhipu-stream`

```bash
curl -X POST http://localhost:3000/chat/zhipu-stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "写一首关于春天的诗"}
    ],
    "sessionId": "optional_session_id",
    "filePaths": ["https://example.com/report.docx"]
  }'
```

**响应格式：** Server-Sent Events (SSE)

```
data: {"content":"春","type":"content","done":false}
data: {"content":"天","type":"content","done":false}
data: {"content":"模型思考中...","type":"reasoning","done":false}
data: {"content":"来了","type":"content","done":false}
data: {"content":{"prompt_tokens":10,"completion_tokens":20},"type":"usage","done":false}
data: {"content":[{"name":"search","arguments":"{}"}],"type":"tool_calls","done":false}
...
data: {"done":true}
```

**支持的数据类型：**

- `content`: 主要回复内容
- `reasoning`: 模型思考过程 (原thinking)
- `tool_calls`: 工具调用信息
- `audio`: 音频数据
- `usage`: Token使用统计
- `video`: 视频结果
- `web_search`: 网络搜索结果
- `content_filter`: 内容过滤信息

### 4. 清空会话历史

**DELETE** `/chat/session/:sessionId`

```bash
curl -X DELETE http://localhost:3000/chat/session/session_123456
```

## 数据结构

### ChatRequestDto

```typescript
{
  messages: ChatMessageDto[];    // 消息数组
  sessionId?: string;            // 可选会话ID，用于多轮对话
  filePaths?: string[];          // 可选文件URL数组，支持远程文件
}
```

### ChatMessageDto

```typescript
{
  role: "user" | "assistant" | "system"; // 消息角色
  content: string; // 消息内容
}
```

## 文件附件支持

### 支持的文件格式

- **PDF** (.pdf) - 使用 pdf-parse 库解析
- **Word 文档** (.docx) - 使用 mammoth 库解析
- **Excel 文件** (.xlsx, .xls) - 使用 xlsx 库解析
- **文本文件** (.txt) - 直接读取

### 文件处理流程

1. 文件内容被提取为文本
2. 内容作为系统消息添加到对话开头
3. AI 模型基于文件内容回答用户问题

### 文件路径格式

- 支持 HTTP/HTTPS URL：`https://example.com/document.pdf`
- 文件内容将被自动下载并解析

## 多轮对话记忆

### 会话管理

- 每个 `sessionId` 对应一个独立的对话历史
- 历史消息自动保存在内存中（可扩展为 Redis）
- 最大历史长度：所有消息总和（目前无限制）

### 清空历史

使用 `DELETE /chat/session/:sessionId` 清除特定会话的历史记录。

## 错误处理

### 常见错误响应

```json
{
  "statusCode": 500,
  "message": "PDF 解析失败: ...",
  "error": "Internal Server Error"
}
```

### 错误类型

1. **API 密钥未配置** - 检查环境变量
2. **文件解析失败** - 检查文件格式和网络连接
3. **网络请求失败** - 检查 API 端点可达性
4. **流式响应中断** - 检查客户端连接

## 开发说明

### 依赖安装

```bash
cd apps/backend
npm install pdf-parse mammoth xlsx
```

### 启动开发服务器

```bash
npm run start:dev
```

### 构建生产版本

```bash
npm run build
npm run start:prod
```

## 注意事项

1. **文件大小限制**：大文件可能导致解析时间较长
2. **网络超时**：远程文件下载依赖网络状况
3. **内存使用**：会话历史存储在内存中，长时间运行可能需考虑持久化
4. **API 速率限制**：注意 DeepSeek 和智谱 API 的调用限制

## 扩展建议

1. **持久化存储**：将会话历史存储到 Redis 或数据库
2. **文件上传**：集成 Multer 处理本地文件上传
3. **更多模型**：扩展支持 OpenAI、Claude 等模型
4. **流控限流**：添加速率限制防止滥用
5. **监控日志**：添加详细的请求日志和性能监控
