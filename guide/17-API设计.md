# 十七、API 设计

## 17.1 RESTful 规范

### 17.1.1 URL 结构

```
/api/v{version}/{resource}[/{resource_id}][/{sub_resource}]
```

| 方法 | 说明 | 示例 |
|------|------|------|
| GET | 读取资源 | `GET /api/v1/chat/sessions` |
| POST | 创建资源 | `POST /api/v1/chat/sessions` |
| PUT | 全量更新 | `PUT /api/v1/chat/sessions/:id` |
| PATCH | 部分更新 | `PATCH /api/v1/chat/sessions/:id` |
| DELETE | 删除资源 | `DELETE /api/v1/chat/sessions/:id` |

### 17.1.2 响应格式

```typescript
// 成功响应
interface ApiResponse<T> {
  code: 0;
  data: T;
  message: string;
}

// 分页响应
interface PaginatedResponse<T> {
  code: 0;
  data: {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// 错误响应
interface ErrorResponse {
  code: number;
  error: string;
  message: string;
  details?: Record<string, any>;
}
```

### 17.1.3 分页参数

```typescript
interface PaginationParams {
  page?: number;       // 默认 1
  pageSize?: number;   // 默认 20，最大 100
  sortBy?: string;     // 排序字段
  sortOrder?: 'asc' | 'desc';
}
```

---

## 17.2 认证 API

### 17.2.1 邮箱注册

```
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "string (3-20)",
  "email": "string (unique)",
  "password": "string (min 8)"
}

Response:
{
  "code": 0,
  "data": {
    "user": { "id": "uuid", "username": "demo", "email": "demo@example.com" },
    "token": "jwt-token"
  }
}
```

### 17.2.2 微信登录

```
GET /api/v1/auth/wechat/qrcode
→ 返回二维码 URL

GET /api/v1/auth/wechat/status?state=xxx
→ 轮询扫码状态

POST /api/v1/auth/wechat/login
Body: { "code": "xxx" }
Response: { "user": {...}, "token": "jwt" }
```

### 17.2.3 Token 刷新

```
POST /api/v1/auth/refresh
Authorization: Bearer {refresh_token}

Response:
{
  "code": 0,
  "data": { "token": "new-jwt", "expiresIn": 86400 }
}
```

---

## 17.3 聊天 API

### 17.3.1 创建会话

```
POST /api/v1/chat/sessions
Body: { "title": "新对话" }
→ Session { id, title, createdAt }
```

### 17.3.2 列出会话

```
GET /api/v1/chat/sessions?page=1&pageSize=20
→ PaginatedResponse<Session>
```

### 17.3.3 发送消息（SSE 流式）

```
POST /api/v1/chat/stream
Content-Type: application/json
Accept: text/event-stream

Body:
{
  "sessionId": "uuid",
  "content": "你好",
  "model": "doubao-pro-32k",
  "enableWebSearch": false,
  "attachments": [
    { "type": "document", "id": "uuid" }
  ]
}

Stream Events:
data: {"type":"thinking","data":"正在思考..."}
data: {"type":"token","data":"你"}
data: {"type":"token","data":"好"}
data: {"type":"token","data":"！"}
data: {"type":"usage","data":{"prompt_tokens":10,"completion_tokens":3}}
data: {"type":"done","data":null}
```

### 17.3.4 分支消息

```
POST /api/v1/chat/stream
Body: {
  "sessionId": "uuid",
  "parentMessageId": "uuid",  // 父消息 ID
  "branchId": "branch-1",    // 分支 ID
  "content": "重新生成",
  "branchSiblingIndex": 1
}
→ SSE stream
```

### 17.3.5 编辑/删除

```
PUT /api/v1/chat/messages/:id
Body: { "content": "新内容" }

DELETE /api/v1/chat/messages/:id
```

---

## 17.4 知识库 API

### 17.4.1 文档 CRUD

```
POST   /api/v1/knowledge/documents        创建文档
GET    /api/v1/knowledge/documents        列出文档
GET    /api/v1/knowledge/documents/:id     获取文档
PUT    /api/v1/knowledge/documents/:id     更新文档
DELETE /api/v1/knowledge/documents/:id     删除文档
POST   /api/v1/knowledge/documents/:id/index  触发索引
```

### 17.4.2 文档上传

```
POST /api/v1/knowledge/documents/upload
Content-Type: multipart/form-data

Form Data:
- file: <File> (markdown/pdf/epub)
- title: "string"
- type: "markdown|pdf|epub"

→ Document { id, title, type, isIndexed }
```

### 17.4.3 知识问答

```
POST /api/v1/knowledge/qa
Body:
{
  "question": "如何使用 TypeORM？",
  "documentIds": ["uuid"],    // 可选：限定文档
  "topK": 5,                  // 检索数量
  "stream": true              // SSE 流式
}

→ SSE stream
data: {"type":"retrieval","data":[{"content":"...","score":0.95}]}
data: {"type":"token","data":"TypeORM 是..."}
data: {"type":"done","data":null}
```

### 17.4.4 向量搜索

```
POST /api/v1/knowledge/search
Body:
{
  "query": "string",
  "filters": {
    "documentIds": ["uuid"],
    "dateRange": { "from": "2024-01-01", "to": "2024-12-31" }
  },
  "topK": 10,
  "searchMode": "hybrid"
}

Response:
{
  "code": 0,
  "data": {
    "results": [
      {
        "id": "uuid",
        "content": "chunk text...",
        "score": 0.92,
        "documentId": "uuid",
        "documentTitle": "TypeORM Guide",
        "position": 15
      }
    ]
  }
}
```

---

## 17.5 英语学习 API

### 17.5.1 词包生成（SSE）

```
POST /api/v1/english-learning/vocabulary-pack/stream
Body:
{
  "topic": "科技",
  "count": 10,
  "enableWebSearch": true,
  "level": "intermediate"
}

→ SSE stream
data: {"type":"progress","data":"正在检索最新信息..."}
data: {"type":"agent_tool","data":"web_search"}
data: {"type":"chunk","data":[{"word":"AI","phonetic":"...","definition":"..."}]}
data: {"type":"complete","data":{"total":10}}
```

### 17.5.2 经典语句（SSE）

```
POST /api/v1/english-learning/classic-quotes/stream
Body: { "topic": "自由", "count": 5 }
→ SSE stream
```

### 17.5.3 Agent 对话

```
GET    /api/v1/agent/sessions              列出会话
POST   /api/v1/agent/sessions              创建会话
DELETE /api/v1/agent/sessions/:id          删除会话
POST   /api/v1/agent/chat                  发送消息（SSE）
```

### 17.5.4 今日记词

```
POST   /api/v1/practice/daily/start        开始今日记词
GET    /api/v1/practice/daily/status       获取今日状态
POST   /api/v1/practice/daily/complete    完成记词
POST   /api/v1/practice/review/start      开始复习
POST   /api/v1/practice/review/complete   完成复习
GET    /api/v1/practice/wrong-book         获取错题本
POST   /api/v1/practice/mark-review       标记复习结果
```

### 17.5.5 TTS

```
POST /api/v1/speech-transcription/minimax/speech/stream
Body:
{
  "text": "Hello, welcome to English learning.",
  "model": "speech-2.8-turbo",
  "voice_id": "Wise_Woman",
  "speed": 1.0,
  "format": "pcm",
  "sample_rate": 24000
}

→ 二进制音频流（hex 编码逐块）
```

---

## 17.6 电子书 API

### 17.6.1 书架管理

```
GET    /api/v1/ebook/shelf                 获取书架聚合
POST   /api/v1/ebook/shelf/upload          上传书籍
DELETE /api/v1/ebook/shelf/:id             从书架移除
GET    /api/v1/ebook/file/:id              下载文件
```

### 17.6.2 阅读进度

```
GET    /api/v1/ebook/progress/:bookId      获取进度
PUT    /api/v1/ebook/progress              保存进度
Body: { "bookId": "uuid", "cfi": "...", "percentage": 0.65 }
```

### 17.6.3 划线 CRUD

```
GET    /api/v1/ebook/highlights?bookId=:id
POST   /api/v1/ebook/highlights
Body: { "bookId": "uuid", "cfi": "...", "selectedText": "...", "style": "highlight" }
PUT    /api/v1/ebook/highlights/:id
DELETE /api/v1/ebook/highlights/:id
```

### 17.6.4 想法 CRUD

```
GET    /api/v1/ebook/thoughts?bookId=:id
POST   /api/v1/ebook/thoughts
Body: { "bookId": "uuid", "cfi": "...", "selectedText": "...", "content": "想法..." }
PUT    /api/v1/ebook/thoughts/:id
DELETE /api/v1/ebook/thoughts/:id
GET    /api/v1/ebook/thoughts/sync?since=timestamp  增量同步
```

### 17.6.5 听书进度

```
GET    /api/v1/ebook/listen-progress/:bookId
PUT    /api/v1/ebook/listen-progress
Body: { "bookId": "uuid", "chapterId": "uuid", "cfi": "...", "speed": 1.0 }
```

---

## 17.7 支付 API

### 17.7.1 创建订阅

```
POST /api/v1/payments/subscriptions
Body:
{
  "plan": "premium",
  "paymentMethod": "stripe"
}

Response:
{
  "code": 0,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_xxx",
    "subscriptionId": "sub_xxx"
  }
}
```

### 17.7.2 支付回调

```
POST /api/v1/payments/webhook/stripe
Headers:
  Stripe-Signature: t=timestamp,v1=signature

Body: (Stripe event)
{
  "type": "checkout.session.completed",
  "data": { ... }
}
```

### 17.7.3 会员状态

```
GET    /api/v1/membership/status          当前会员状态
POST   /api/v1/membership/cancel          取消会员
POST   /api/v1/membership/resume          恢复会员
```

---

## 17.8 视频 API

```
POST /api/v1/video/upload                  上传视频
GET  /api/v1/video/list                    列出视频
GET  /api/v1/video/:id                     获取视频详情
DELETE /api/v1/video/:id                   删除视频
POST /api/v1/video/:id/transcode           转码
GET  /api/v1/video/:id/stream              获取播放流
```

---

## 17.9 错误码

| 码 | 含义 | 建议 |
|----|------|------|
| 0 | 成功 | |
| 40001 | 参数校验失败 | 检查请求参数 |
| 40002 | 资源不存在 | 检查资源 ID |
| 40101 | 未认证 | 重新登录 |
| 40102 | Token 过期 | 刷新 Token |
| 40301 | 无权限 | 检查角色权限 |
| 42901 | 请求过于频繁 | 稍后重试 |
| 50001 | 内部错误 | 查看日志 |
| 50002 | 数据库错误 | 查看日志 |
| 50003 | LLM 提供方错误 | 检查 API Key |
| 50004 | 向量库错误 | 检查 Qdrant 连接 |
| 60001 | 文件过大 | 压缩或分片 |
| 60002 | 文件格式不支持 | 支持的格式：markdown/pdf/epub |
