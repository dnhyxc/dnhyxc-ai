# dnhyxc-ai

## 项目介绍

dnhyxc-ai 是一个基于 pnpm Monorepo 的全栈 AI 助手平台，前端采用 React 19 + Tauri 2 双端架构（桌面 / Web），后端基于 NestJS + MySQL + Redis，集成 Module Federation 动态插件系统。项目旨在提供一个功能丰富的 AI 工作台，覆盖流式智能对话、知识库 RAG 问答、EPUB 电子书阅读器（高亮批注 + TTS 听书）、英语学习（SRS 记忆 + Agent）、会员支付、权限管理及后台管理等完整功能，支持硅基流动等 OpenAI 兼容大模型自由配置。

## 核心功能

### AI 对话系统

- 基于 LangChain 的流式智能对话，支持多会话管理、上下文分支、消息编辑与重新生成
- AI Agent 模式，支持工具调用（Function Calling）、网络搜索、附件解析
- 对话内容分享，生成独立分享链接供他人查看
- 支持 Markdown 渲染、代码高亮、Mermaid 图表、数学公式（KaTeX）
- 代码模式内置 Monaco Editor，支持代码格式化与运行

### 知识库与 RAG

- Markdown 知识库管理，支持文档分类、公开/私有设置、回收站
- 基于 Qdrant 向量数据库的 RAG 检索增强问答
- 文档分块（chunk）策略，支持相似度检索与上下文增强
- 知识库对话分享

### EPUB 电子书阅读器

- 基于 epub.js 的 EPUB 阅读器，支持书架管理、分类、排序
- 阅读进度同步、章节目录导航、分页翻阅
- 文本高亮、批注、读书想法（笔记）
- TTS 听书功能，支持 Edge TTS / MiniMax / 讯飞等多引擎
- 句级高亮跟随、语速调节、后台预加载
- 电子书分享与协作权限管理

### 英语学习

- 单词包管理（导入 / 收藏 / 错题本 / 笔记）
- 基于 SRS（间隔重复）的记忆复习算法
- 每日打卡与学习记录追踪
- 经典句库、语法参考、形态参考
- 英语 Agent 智能对话练习
- 云 TTS 发音朗读

### 动态插件系统

- 基于 Module Federation 的微前端架构，支持远程插件动态加载
- 插件注册表（Registry）管理，支持启用/禁用、信任级别、权限控制
- HostBridge API：插件可访问宿主的 HTTP 请求、Toast、路由导航、事件总线等能力
- 支持业务页嵌入（EPUB 阅读页抽屉 / 工具栏）与独立路由页面两种形态
- iframe 模式用于不可信插件的安全隔离

### 用户与权限

- JWT 认证 + Passport 策略，支持邮箱注册/登录、微信快捷登录
- 基于 CASL 的细粒度权限控制（角色 / 资源 / 操作）
- 会员体系，支持 Stripe / 云支付会员订阅
- 用户资料管理、头像上传（腾讯云 COS）

### 后台管理系统

- 独立的 Admin 管理后台（React 19 + TypeScript）
- 仪表盘数据统计（Recharts 可视化）
- 用户管理、角色管理、菜单管理
- 电子书管理、知识库管理
- 操作日志、会员管理

### 其他功能

- 深色 / 浅色主题切换
- 中英双语国际化（i18n）
- Tauri 桌面端特性：系统托盘、全局快捷键、自动启动、应用自动更新
- OCR 文字识别
- 语音转文字
- 文件上传与管理（本地存储 + 腾讯云 COS）

## 技术架构

### 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                    客户端（双端）                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │ Tauri 桌面端 │  │  Web 浏览器  │  │ MF Remote 插件   │  │
│  │ (React 19)  │  │ (React 19)  │  │ (remote-plugins) │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘  │
│         │                │                  │             │
│         └────────────────┼──────────────────┘             │
│                          │ HTTPS /api                     │
└──────────────────────────┼───────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────┐
│                    后端服务 (NestJS)                       │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐      │
│  │ Auth │ Chat │Ebook │Know- │Agent │ Pay  │ ...  │      │
│  │      │      │      │ledge │      │      │      │      │
│  └──┬───┴──┬───┴──┬───┴──┬───┴──┬───┴──┬───┴──────┘      │
│     │      │      │      │      │      │                  │
│  ┌──┴──────┴──────┴──────┴──────┴──────┴──┐               │
│  │          TypeORM / MySQL 8.0           │               │
│  └────────────────────────────────────────┘               │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Redis (Cache)  │  │ BullMQ (队列) │  │ Qdrant (向量) │  │
│  └─────────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Monorepo 结构

```
dnhyxc-ai/
├── apps/
│   ├── frontend/          # 主应用（Tauri + React 19，桌面/Web 双端）
│   │   ├── src/           # 前端源码
│   │   │   ├── components/  # UI 组件（shadcn/ui + 业务组件）
│   │   │   ├── views/       # 页面视图
│   │   │   ├── router/      # 路由配置
│   │   │   ├── store/       # MobX 状态管理
│   │   │   ├── service/     # API 服务层
│   │   │   ├── hooks/       # 自定义 Hooks
│   │   │   ├── plugins/     # MF 插件系统核心
│   │   │   ├── i18n/        # 国际化（zh-CN / en-US）
│   │   │   └── utils/       # 工具函数
│   │   └── src-tauri/     # Tauri 原生层（Rust）
│   │       └── src/
│   │           ├── command/  # Tauri 命令（下载、剪贴板等）
│   │           ├── system/   # 系统集成（菜单、托盘、快捷键）
│   │           └── plugin/   # 插件初始化
│   ├── backend/           # 后端服务（NestJS）
│   │   └── src/
│   │       ├── services/    # 业务模块（20+ 模块）
│   │       ├── guards/      # 权限守卫（JWT / CASL / Admin）
│   │       ├── filters/     # 异常过滤器
│   │       ├── interceptors/# 响应拦截器
│   │       ├── middleware/  # 中间件（操作日志等）
│   │       ├── migrations/  # TypeORM 数据库迁移
│   │       └── utils/       # 工具函数
│   ├── remote-demo/       # MF 插件最小样例（音频播放器）
│   └── remote-plugins/    # 官方业务插件包（EPUB想法/划线 + 学习笔记）
├── packages/
│   ├── markdown-kit/      # Markdown 渲染组件库（公开 npm 包）
│   ├── release-kit/       # Tauri 发布辅助 CLI（版本/上传/Wiki）
│   ├── release-run/       # 发布脚本运行时
│   ├── ci/                # CI/部署工具（SSH 部署 + pm2 重启）
│   └── mcps/              # 组件目录 MCP Server（AI 编码辅助）
├── docs/                  # 项目文档（按功能域分类）
├── docker-compose.yml     # Docker 编排（MySQL + Adminer + Qdrant）
└── package.json           # Monorepo 根配置
```

### 前端技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Tauri 2 + React 19 |
| 构建 | Vite 7 |
| UI | Tailwind CSS v4 + Radix UI (shadcn/ui) |
| 状态管理 | MobX 6 |
| 路由 | React Router 7 |
| 表单 | React Hook Form + Zod |
| 代码编辑器 | Monaco Editor |
| 电子书 | epub.js + pdfjs-dist |
| 微前端 | Module Federation (@module-federation/vite) |
| 图标 | Lucide React |
| 动画 | Framer Motion |
| HTTP | Axios |
| 国际化 | 自定义 i18n（zh-CN / en-US） |

### 后端技术栈

| 分类 | 技术 |
|------|------|
| 框架 | NestJS 11 |
| 数据库 | TypeORM + MySQL 8.0 |
| AI 集成 | LangChain + OpenAI 兼容 API |
| 向量数据库 | Qdrant |
| 认证 | JWT + Passport |
| 权限 | CASL |
| 缓存 | Cache Manager + Redis |
| 任务队列 | BullMQ |
| 邮件 | Nodemailer |
| 文件存储 | Multer（本地）+ 腾讯云 COS |
| 支付 | Stripe |
| 日志 | Winston |
| API 文档 | Swagger |
| 安全 | Helmet + Express Rate Limit |

### Tauri 原生层（Rust）

| 功能 | 实现 |
|------|------|
| 系统托盘 | `src/system/tray.rs` |
| 应用菜单 | `src/system/menu.rs` |
| 全局快捷键 | `src/system/shortcut.rs` |
| Dock 管理 | `src/system/dock.rs` |
| 窗口缩放 | `src/system/zoom.rs` |
| 系统事件 | `src/system/event.rs` |
| 文件下载 | `src/command/download.rs` |
| 电子书处理 | `src/command/ebook.rs` |
| 剪贴板 | `src/command/clipboard.rs` |
| 应用自动更新 | Tauri Updater Plugin |

## 后端模块一览

| 模块 | 说明 |
|------|------|
| AuthModule | 用户认证（邮箱注册/登录、微信登录、验证码） |
| UserModule | 用户管理（资料、头像、密码） |
| RolesModule | 角色管理 |
| MenusModule | 菜单管理 |
| ChatModule | AI 对话（流式响应、会话管理、消息分支） |
| AssistantModule | AI 助手（文档对话） |
| AgentModule | AI Agent（工具调用、网络搜索） |
| KnowledgeModule | 知识库管理（Markdown 文档 CRUD、回收站） |
| KnowledgeQaModule | 知识库 RAG 问答 |
| QdrantModule | Qdrant 向量数据库服务 |
| EbookModule | EPUB 电子书（书架、章节解析、阅读进度、高亮、想法） |
| EbookAssistantModule | 电子书 AI 助手 |
| EnglishLearningModule | 英语学习（单词包、SRS 复习、每日打卡） |
| LearningNotesModule | 学习笔记 |
| WebSearchModule | 网络搜索（Serper / Tavily） |
| ShareModule | 内容分享 |
| PayModule | 会员支付（Stripe / 云支付） |
| UploadModule | 文件上传（本地 + 腾讯云 COS） |
| OcrModule | OCR 文字识别 |
| SpeechTranscriptionModule | 语音转文字 |
| MailModule | 邮件服务 |
| LlmConfigModule | 大模型配置管理（加密存储） |
| LogsModule | 操作日志 |
| PromptModule | 提示词管理 |
| PluginPrefsModule | 插件偏好设置 |

## 开发环境

### 前提条件

- Node.js v18+
- pnpm v10+
- Rust（Tauri 桌面端构建）
- Docker & Docker Compose（MySQL / Qdrant）

### 快速开始

1. 克隆项目

```bash
git clone https://github.com/dnhyxc/dnhyxc-ai.git
cd dnhyxc-ai
```

2. 安装依赖

```bash
pnpm install
```

3. 启动基础设施（MySQL + Qdrant）

```bash
docker-compose up -d
```

4. 启动后端服务

```bash
pnpm server:dev
```

5. 启动前端应用

```bash
# Web 开发模式
pnpm dev:frontend

# Tauri 桌面端开发模式
pnpm dev
```

6. 访问应用

| 服务 | 地址 |
|------|------|
| 前端（Web） | http://localhost:9002 |
| 后端 API | http://localhost:9112/api |
| Swagger 文档 | http://localhost:9112/api-docs |
| Adminer（数据库管理） | http://localhost:3091 |
| Qdrant 控制台 | http://localhost:6333/dashboard |

### Module Federation 联调

同时启动 Host + Remote 插件：

```bash
# 启动所有 MF 远端 + Host
pnpm dev:mf

# 或单独启动各远端
pnpm dev:remote-demo     # 端口 9007
pnpm dev:remote-plugins  # 端口 9008
```

## 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Tauri 桌面端开发 |
| `pnpm dev:frontend` | 启动 Web 前端开发 |
| `pnpm server:dev` | 启动后端开发服务 |
| `pnpm dev:mf` | 同时启动 Host + 所有 MF 远端 |
| `pnpm build` | 构建并发布 Tauri 桌面端 |
| `pnpm server:build` | 构建后端 |
| `pnpm server:start` | 启动后端生产服务 |
| `pnpm check` | Biome 代码检查与格式化 |
| `pnpm commit` | 交互式规范提交（Commitizen） |
| `pnpm changeset` | 生成 Changeset |

## 部署

### Docker 部署

```bash
# 启动 MySQL + Adminer + Qdrant
docker-compose up -d
```

### 后端部署

```bash
# 构建后端
pnpm -C apps/backend build

# 启动生产服务
pnpm -C apps/backend start:prod

# SSH 远程部署
pnpm -C apps/backend deploy:ssh
```

### 前端 / 桌面端部署

```bash
# 构建 Tauri 桌面端安装包（自动签名 + 上传 Release）
pnpm build:patch    # patch 版本
pnpm build:minor    # minor 版本
pnpm build:major    # major 版本

# 仅构建 Web 前端
pnpm -C apps/frontend build
```

### 数据库迁移

```bash
# 生成迁移文件
pnpm -C apps/backend m:g MigrationName

# 执行迁移
pnpm -C apps/backend m:run

# 回滚迁移
pnpm -C apps/backend m:revert
```

## 项目文档

项目按功能域维护文档，位于 `docs/` 目录下：

- `docs/app/` — 前端应用文档（插件系统、i18n、路由鉴权、Tauri 集成等）
- `docs/ebook/` — EPUB 阅读器文档（阅读器、听书、高亮、想法等）
- `docs/chat/` — AI 对话文档（流式响应、分享、上传、网络搜索等）
- `docs/english/` — 英语学习文档（SRS、TTS、每日打卡等）
- `docs/cos/` — 腾讯云 COS 对象存储文档
- `docs/Influence-point/` — 改动影响点分析

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改（使用规范提交：`pnpm commit`）
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 提交规范

项目使用 Commitizen + commitlint 规范提交信息，支持以下类型：

- `feat` — 新功能
- `fix` — Bug 修复
- `docs` — 文档变更
- `style` — 代码格式（不影响功能）
- `refactor` — 重构
- `perf` — 性能优化
- `test` — 测试
- `chore` — 构建/工具变更

## 许可证

ISC License

## 联系方式

- 邮箱：dnhyxc@163.com
- 项目主页：https://github.com/dnhyxc/dnhyxc-ai
- 在线体验：https://dnhyxc.cn:9002
