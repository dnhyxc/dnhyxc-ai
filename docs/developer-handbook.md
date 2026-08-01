# dnhyxc-ai 开发手册

> 本手册面向**项目维护者与新增开发者**，目标是让你看完后能独立完成：环境搭建、配置更换、新增需求、维护现有需求、排查与部署。
> 内容以仓库**当前源码**为准。面向最终用户的产品说明见 [`project-guide.md`](./project-guide.md)，按版本整理的更新说明见 [`project-update-info.md`](./project-update-info.md)。

---

## 目录

1. [项目概览](#1-项目概览)
2. [Monorepo 目录结构](#2-monorepo-目录结构)
3. [开发环境搭建](#3-开发环境搭建)
4. [配置体系总览](#4-配置体系总览)
5. [后端开发指南（NestJS）](#5-后端开发指南nestjs)
6. [前端开发指南（React + Tauri）](#6-前端开发指南react--tauri)
7. [动态插件系统（Module Federation）](#7-动态插件系统module-federation)
8. [LLM / 知识库 RAG / TTS 接入](#8-llm--知识库-rag--tts-接入)
9. [对象存储 COS 与上传落盘](#9-对象存储-cos-与上传落盘)
10. [支付与会员（Stripe）](#10-支付与会员stripe)
11. [代码规范与协作流程](#11-代码规范与协作流程)
12. [部署与运维](#12-部署与运维)
13. [维护现有需求：排查与文档索引](#13-维护现有需求排查与文档索引)
14. [常用命令速查](#14-常用命令速查)
15. [关键文件索引](#15-关键文件索引)

---

## 1. 项目概览

### 1.1 一句话定位

dnhyxc-ai 是一个**集成 AI 能力的全栈桌面/Web 应用 monorepo**：流式智能对话、Markdown 知识库与 RAG 文档助手、英语学习（单词包/经典句/Agent/听写/间隔复习）、电子书阅读（EPUB/PDF + 听书 + 划线 + 读书想法）、对话/知识/书摘分享、Stripe 会员、动态插件中心。

### 1.2 整体架构

```
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│  前端 Tauri/React 19  │──▶│  后端 NestJS (9112)   │──▶│  MySQL (TypeORM)      │
│  Vite + MF Host       │   │  LangChain + Qdrant   │   │  Redis + BullMQ       │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
        │                          │                          │
        │                          └──────────┬───────────────┘
        │                                     ▼
        │                          ┌──────────────────────┐
        └── Module Federation ─────▶│  Remote Plugins (静态) │
            (运行时加载独立模块)        │  Nginx 静态托管        │
                                      └──────────────────────┘
```

### 1.3 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Tauri 2（Rust，全局快捷键/剪贴板/自启/更新） |
| 前端 | React 19 + Vite 7 + TypeScript 5.8 + Tailwind CSS v4 + shadcn/ui (Radix) + MobX 6 + react-router 7 + Monaco + md-editor + epubjs + pdfjs |
| 微前端 | `@module-federation/vite` + `@module-federation/enhanced`（Host + Remote） |
| 后端 | NestJS 11 + TypeORM 0.3 + MySQL 8 + Redis + BullMQ + LangChain 1 + Qdrant |
| 鉴权 | JWT (Passport) + CASL 细粒度权限 |
| 存储 | 腾讯云 COS（头像/附件）+ 本地 uploads（图片/文件/remotes）|
| AI | 硅基流动（OpenAI 兼容，Chat/Embedding/Rerank/TTS/转写）+ 智谱 GLM（OCR）|
| 支付 | Stripe（会员订阅）|
| 部署 | Docker Compose（DB/Qdrant）+ PM2 + Nginx + 自研 `dnhyxc-ci` SSH 工具 |

### 1.4 端口约定

| 端口 | 用途 |
|---|---|
| `9002` | 前端 Vite dev / Web 生产站 |
| `9112` | 后端 NestJS（对外 HTTPS，Nginx 终止 TLS）|
| `9226` | 生产本机 NestJS（pm2，不对外）|
| `3090` / `3092` | 开发 MySQL `db` / `db1`（docker-compose）|
| `3091` | Adminer（数据库管理）|
| `6333` / `6334` | Qdrant HTTP / gRPC |
| `9008` | Remote Plugins dev / 生产静态站 |
| `12009` / `12006` / `12011` / `12029` | 生产 MySQL db / db1 / Adminer / Redis |

---

## 2. Monorepo 目录结构

```
dnhyxc-ai/
├── apps/
│   ├── backend/              # NestJS 后端
│   │   ├── src/
│   │   │   ├── services/     # 业务模块（28 个：auth/user/chat/knowledge/ebook/...）
│   │   │   ├── database/     # TypeOrmConfigService / Destroy
│   │   │   ├── decorators/   # @Roles / @Can / @Serialize
│   │   │   ├── enum/         # config.enum.ts（环境变量名单一事实源）+ roles/action
│   │   │   ├── factorys/     # app-config / redis / bull 连接工厂
│   │   │   ├── filters/      # 全局异常过滤器
│   │   │   ├── guards/       # jwt / admin / role / casl
│   │   │   ├── interceptors/ # response / serialize
│   │   │   ├── middleware/   # serve-upload-static（中文文件名解码）
│   │   │   ├── migrations/   # TypeORM 迁移（56 个，成对：create + generate）
│   │   │   ├── polyfills/    # node-crypto-global
│   │   │   ├── utils/        # create-llm / bcrypt / db / upload-paths / ...
│   │   │   ├── app.module.ts # 模块注册总入口
│   │   │   └── main.ts       # bootstrap（helmet/rate-limit/swagger/CORS）
│   │   ├── specs/            # 后端需求 spec（开发前设计稿）
│   │   ├── scripts/          # typeorm-prod.cjs（生产迁移入口）
│   │   ├── ormconfig.ts      # TypeORM DataSource（CLI 用）
│   │   ├── deploy.backend.json # SSH 部署配置
│   │   └── package.json
│   ├── frontend/             # Tauri + React 前端（主站 Host）
│   │   ├── src/
│   │   │   ├── views/        # 页面（26 个：chat/knowledge/ebook/englishLearning/...）
│   │   │   ├── components/   # design/（业务）+ ui/（shadcn）
│   │   │   ├── store/        # MobX 多 store + RootStore 聚合
│   │   │   ├── service/      # api.ts（端点常量）+ index.ts（调用封装）
│   │   │   ├── router/       # routes.ts / buildRoutes.ts / authPaths.ts
│   │   │   ├── plugins/      # MF Host 引擎（core/hooks/host/host-api/inject）
│   │   │   ├── hooks/        # ~20 个业务 hooks
│   │   │   ├── i18n/         # zh-CN / en-US
│   │   │   ├── constants/    # BASE_URL / 套餐 / TTS 配置 / 分页阈值
│   │   │   ├── utils/        # fetch.ts（自研 HttpClient）/ sse / crypto / tauri / ...
│   │   │   ├── layout/       # 整体布局
│   │   │   └── main.tsx      # 入口（按 pathname 分流 about / 主应用）
│   │   ├── src-tauri/        # Rust 壳（tauri.conf.json / capabilities / icons）
│   │   ├── specs/            # 前端需求 spec
│   │   └── vite.config.ts
│   ├── remote-demo/          # MF 示例 Remote
│   └── remote-plugins/       # 生产 MF 插件包（学习笔记 / 电子书想法 / 划线）
├── packages/
│   ├── ci/                   # 自研 SSH 部署 CLI（dnhyxc-ci）
│   ├── markdown-kit/         # @dnhyxc-ai/markdown-kit（Markdown/mermaid/highlight 工具）
│   └── mcps/                 # MCP catalog
├── docs/                     # 开发文档（按功能域分目录，见 §13）
├── .changeset/               # 版本管理
├── .cursor/ .opencode/       # AI 编码规则与 skills
├── docker-compose.yml        # 开发用 DB/Qdrant
├── biome.json                # 代码格式与 lint
├── commitlint.config.js      # 提交信息校验
├── .cz-config.js             # commitizen 交互模板
└── package.json              # monorepo 根脚本
```

---

## 3. 开发环境搭建

### 3.1 前置依赖

- **Node.js v18+**（推荐 v20）
- **pnpm 10.8.1**（`corepack enable && corepack prepare pnpm@10.8.1 --activate`）
- **Docker + Docker Compose**（跑 MySQL/Qdrant）
- **Rust + Tauri CLI**（仅打包桌面端需要；纯 Web 开发可不装）

### 3.2 安装与启动

```bash
# 1. 克隆
git clone <repository-url> && cd dnhyxc-ai

# 2. 安装依赖
pnpm install

# 3. 启动开发数据库与 Qdrant
docker compose up -d            # MySQL 3090/3092 + Adminer 3091 + Qdrant 6333

# 4. 配置后端环境变量（仓库不提交 .env，需自建）
cp -n apps/backend/.env.example apps/backend/.env 2>/dev/null || true
# 手动编辑 apps/backend/.env，至少填 DB_* / SECRET / REDIS_URL / SILICONFLOW_*，见 §4

# 5. 初始化数据库表结构
pnpm -C apps/backend m:run      # 或临时设 DB_SYNC=true 自动同步

# 6. 启动后端
pnpm server:dev                 # = pnpm -C apps/backend start:dev，监听 9112

# 7. 启动前端（另开终端）
pnpm dev:frontend               # = pnpm -C apps/frontend dev，监听 9002
# 或桌面端开发：
pnpm dev                        # = pnpm -C apps/frontend tauri dev

# 8. 启动 Remote 插件开发（按需）
pnpm dev:remote-plugins         # 监听 9008
```

### 3.3 访问地址

- 前端：<http://localhost:9002>
- 后端 API：<http://localhost:9112/api>
- Swagger 文档：<http://localhost:9112/api-docs>
- Adminer（DB 管理）：<http://localhost:3091>
- Qdrant Dashboard：<http://localhost:6333/dashboard>

### 3.4 数据库初始化注意

- 开发期可在 `.env` 设 `DB_SYNC=true` 让 TypeORM 自动同步实体到表（**生产务必 `false`**）。
- 首次起服务若报实体未建表，先用 `pnpm -C apps/backend m:run` 跑迁移，或临时 `DB_SYNC=true` 起一次再改回。
- MySQL 时区统一 `Z`（UTC），见 [ormconfig.ts](../apps/backend/ormconfig.ts)，避免东八区时间偏移 8h。

---

## 4. 配置体系总览

### 4.1 环境变量加载机制

- **后端**：`apps/backend/src/factorys/app-config.factory.ts` 通过 `ConfigModule.forRoot` 加载 `.env.<NODE_ENV>`，并用 Joi 校验。`apps/backend/src/utils/index.ts` 的 `getEnvConfig()` 合并 `.env` 与 `.env.<NODE_ENV>`（后者覆盖前者）。
- **前端**：Vite `loadEnv` 注入 `VITE_` 前缀变量；`apps/frontend/src/constants/index.ts` 的 `BASE_URL = PROD ? VITE_PROD_API_DOMAIN : VITE_DEV_API_DOMAIN`。
- **仓库不提交任何 `.env*` 文件**（`.gitignore` 显式忽略）。新机器需手动创建。

### 4.2 环境变量名「单一事实源」

后端所有环境变量名集中在 [apps/backend/src/enum/config.enum.ts](../apps/backend/src/enum/config.enum.ts)，分枚举组织：

| 枚举 | 域 | 关键变量 |
|---|---|---|
| `ConfigEnum` | DB / JWT | `DB_TYPE/DB_HOST/DB_PORT/DB_DB1_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE/DB_SYNC/DB_DB1_SYNC/SECRET` |
| `LogEnum` | 日志 | `LOG_LEVEL/LOG_ON` |
| `RedisEnum` | Redis | `REDIS_URL/REDIS_HOST/REDIS_PORT/REDIS_PASSWORD/REDIS_USERNAME` |
| `CosEnum` | 腾讯云 COS | `COS_SECRET_ID/COS_SECRET_KEY/COS_BUCKET/COS_REGION/COS_PUBLIC_DOMAIN/COS_OBJECT_ACL` |
| `FileEnum` | 文件落盘 | `FILE_ROOT/SERVER_ROOT/UPLOAD_ROOT` |
| `EmailEnum` | 邮件 | `EMAIL_TRANSPORT/EMAIL_FROM` |
| `WechatEnum` | 微信小程序 | `WECHAT_MINIPROGRAM_APPID/WECHAT_MINIPROGRAM_SECRET` |
| `StripeEnum` | 支付 | `STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET` |
| `ModelEnum` | LLM / 搜索 | `SILICONFLOW_API_KEY/BASE_URL/MODEL_NAME/EMBEDDING_URL/RERANK_URL`、`GLM_API_KEY/BASE_URL/MODEL_NAME/OCR_MODEL_NAME`、`QWEN_*`、`SERPER_API_KEY`、`TAVILY_API_KEY`、`WEB_SEARCH_DEFAULT_PROVIDER`、`ASSISTANT_MODEL_MAX_INPUT_TOKENS` |
| `QdrantEnum` | 向量库 | `QDRANT_URL/QDRANT_KNOWLEDGE_COLLECTION/QDRANT_KNOWLEDGE_COLLECTION_MEMBER` |
| `KnowledgeQaEnum` | 知识库 RAG | `KNOWLEDGE_EMBEDDING_MODEL(_MEMBER)`、`KNOWLEDGE_RERANK_MODEL(_MEMBER)`、`KNOWLEDGE_QA_MODEL/KNOWLEDGE_QA_TOPK`、`SILICONFLOW_TRANSCRIPTION_MODEL/LANGUAGE`、`SILICONFLOW_TTS_MODEL/VOICE` |
| `MinimaxEnum` | MiniMax TTS | `MINIMAX_API_KEY/GROUP_ID/TTS_BASE_URL/TTS_MODEL/TTS_VOICE_ID` |
| `XfyunEnum` | 讯飞 TTS | `XFYUN_APP_ID/API_KEY/API_SECRET/TTS_VCN` |

> **新增环境变量的正确做法**：先在 `config.enum.ts` 加枚举值 → 必要时在 `app-config.factory.ts` 的 Joi schema 加校验 → 在 `.env` 使用。**不要散落字符串字面量。**

### 4.3 后端 `.env` 模板（照抄后改值）

可直接参考 [apps/backend/README.md](../apps/backend/README.md) 末尾的模板，核心项：

```bash
# —— 数据库 ——
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_USERNAME=root
DB_PASSWORD=example
DB_DATABASE=dnhyxc_ai_db
DB_SYNC=false                 # 生产务必 false
DB_PORT=3090                  # 开发；生产 12009
DB_DB1_PORT=3092              # 开发；生产 12006
DB_DB1_NAME=db1
DB_DB1_SYNC=true

# —— 日志 ——
LOG_ON=true
LOG_LEVEL=info

# —— JWT ——
SECRET="<足够长的随机串>"

# —— Redis ——
REDIS_URL=redis://127.0.0.1:6379   # 开发；生产 12029

# —— 文件落盘（见 §9）——
FILE_ROOT=uploads
# UPLOAD_ROOT=/usr/local/dnhyxc-ai/server/uploads   # 线上推荐绝对路径

# —— 邮件 ——
EMAIL_TRANSPORT=smtps://<user>:<授权码>@smtp.qq.com
EMAIL_FROM=<user>@qq.com

# —— 腾讯云 COS（见 §9）——
COS_SECRET_ID=...
COS_SECRET_KEY=...
COS_BUCKET=<name>-<appid>
COS_REGION=ap-guangzhou
COS_PUBLIC_DOMAIN=https://<name>-<appid>.cos.ap-guangzhou.myqcloud.com/
COS_OBJECT_ACL=public-read

# —— LLM / RAG（见 §8）——
SILICONFLOW_API_KEY=sk-...
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL_NAME=Pro/zai-org/GLM-5.1
SILICONFLOW_EMBEDDING_URL=https://api.siliconflow.cn/v1/embeddings
SILICONFLOW_RERANK_URL=https://api.siliconflow.cn/v1/rerank
KNOWLEDGE_EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5
KNOWLEDGE_RERANK_MODEL=BAAI/bge-reranker-v2-m3
KNOWLEDGE_QA_MODEL=Pro/zai-org/GLM-5.1
KNOWLEDGE_QA_TOPK=10
GLM_API_KEY=...               # OCR 用
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_OCR_MODEL_NAME=GLM-4.6V-Flash
WEB_SEARCH_DEFAULT_PROVIDER=tavily
TAVILY_API_KEY=...

# —— 向量库 ——
QDRANT_URL=http://127.0.0.1:6333
QDRANT_KNOWLEDGE_COLLECTION=knowledge_chunks_v1
QDRANT_KNOWLEDGE_COLLECTION_MEMBER=knowledge_chunks_member_v1

# —— 支付（见 §10）——
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# —— TTS（按需）——
MINIMAX_API_KEY=...  MINIMAX_GROUP_ID=...  MINIMAX_TTS_MODEL=speech-2.8-turbo
XFYUN_APP_ID=...  XFYUN_API_KEY=...  XFYUN_API_SECRET=...
```

### 4.4 前端 `.env` 模板

在 `apps/frontend/` 下创建 `.env` / `.env.production`：

```bash
# API 域名（端点路径自带，无需 /api 后缀处理；fetch.ts 的 baseURL 直接用此值）
VITE_DEV_API_DOMAIN=http://localhost:9112/api
VITE_PROD_API_DOMAIN=https://your-domain.com:9112/api

# COS 域名（必须与后端 COS_PUBLIC_DOMAIN 一致！换桶时三处同步：env / Nginx / Tauri allowlist）
VITE_COS_PUBLIC_DOMAIN=https://<name>-<appid>.cos.ap-guangzhou.myqcloud.com/
VITE_COS_PROXY_PREFIX=/ext-cos/

# Stripe 前端公钥
VITE_STRIPE_PUBLISHABLE_KEY=pk_...

# 插件 registry（可选覆盖）
# VITE_PROD_PLUGIN_REGISTRY_URL=...
# VITE_DEV_PLUGIN_REGISTRY_URL=...

# Remote 插件源（桌面端 / 生产）
VITE_REMOTE_PUBLIC_ORIGIN=https://your-domain.com:9008
VITE_HOST_API_VERSION=1.0.0
```

### 4.5 配置更换速查表

| 想改什么 | 改哪里 | 联动 |
|---|---|---|
| 数据库连接 | 后端 `.env` 的 `DB_*` | `docker-compose.yml` 端口映射需一致 |
| JWT 密钥/有效期 | `SECRET`（env）+ `auth.module.ts` 的 `signOptions.expiresIn` | 改密钥后所有旧 token 失效 |
| 会员套餐价格 | `apps/frontend/src/constants/membershipPlans.ts`（**硬编码**）+ 后端 `pay` 模块校验 | Stripe 后台需同步创建对应 Price |
| COS 桶 | 后端 `COS_*` + 前端 `VITE_COS_*` + Nginx `/ext-cos/` proxy + Tauri `http.allowlist` | **四处必须同步**，详见 [cos/cos-object-storage.md](./cos/cos-object-storage.md) §5 |
| 主站对话模型 | `SILICONFLOW_MODEL_NAME`（env）或用户设置页自定义覆盖 | 见 §8 |
| 默认联网检索源 | `WEB_SEARCH_DEFAULT_PROVIDER`（tavily/serper） | 单次请求可用 DTO 字段覆盖 |
| 上传体积限制 | `main.ts` 的 `useBodyParser('json',{limit})` + `multer` 配置 + Nginx `client_max_body_size` | 三处上限需对齐 |
| rate-limit | `main.ts` 的 `rateLimit({windowMs,max})` | 生产需 `trust proxy`，见 [ops/trust-proxy-rate-limit.md](./ops/trust-proxy-rate-limit.md) |
| 桌面端窗口/更新 | `apps/frontend/src-tauri/tauri.conf.json` | 更新 pubkey 与 endpoints |
| 端口 | 后端 `PORT`（默认 9112）+ Nginx + docker-compose | 防火墙/安全组同步放行 |

---

## 5. 后端开发指南（NestJS）

### 5.1 模块注册总入口

[apps/backend/src/app.module.ts](../apps/backend/src/app.module.ts) 是所有业务模块的注册入口。新增模块必须在此 `imports` 数组追加（已用注释标注「业务模块」区域）。

```ts
@Global()  // exports 中的 provider 全局可用
@Module({
  imports: [
    ConfigModule.forRoot(appConfig()),
    TypeOrmModule.forRootAsync({ inject:[ConfigService], useClass: TypeOrmConfigService, dataSourceFactory: ... }),
    NestCacheModule.registerAsync({ isGlobal:true, useClass: RedisConfigFactory }),
    BullModule.forRootAsync({ ... defaultJobOptions: { attempts:3, backoff:{type:'exponential',delay:1000} } }),
    // —— 业务模块 ——
    LogsModule, UserModule, AuthModule, MenusModule, UploadModule, MailModule,
    PromptModule, OcrModule, SpeechTranscriptionModule, EnglishLearningModule,
    LearningNotesModule, EbookModule, EbookAssistantModule, WebSearchModule,
    ChatModule, QdrantModule, KnowledgeModule, KnowledgeQaModule, ShareModule,
    PayModule, PluginPrefsModule, AssistantModule, AgentModule,
  ],
  ...
})
export class AppModule {}
```

### 5.2 标准模块文件结构（参照 `user` / `auth` 模块）

```
src/services/<name>/
├── dto/
│   ├── create-<name>.dto.ts        # class-validator 装饰器
│   ├── update-<name>.dto.ts
│   └── query-<name>.dto.ts
├── <name>.module.ts                # @Module + TypeOrmModule.forFeature + exports
├── <name>.controller.ts            # @Controller + @UseGuards + @UseInterceptors
├── <name>.service.ts               # @Injectable 业务逻辑
├── <name>.entity.ts                # TypeORM 实体（可多个，平铺或放 entity/）
└── <name>.swagger.ts               # applyDecorators 封装 Swagger 注解（推荐）
```

### 5.3 实体（Entity）规范

参照 [user.entity.ts](../apps/backend/src/services/user/user.entity.ts)：

```ts
@Entity()
export class User {
  @PrimaryGeneratedColumn() id: number;                      // 主键统一自增 number
  @Column({ unique: true }) username: string;
  @Column() @Exclude() password: string;                     // 敏感字段 @Exclude()
  @CreateDateColumn({ type: 'timestamp' }) createTime: Date; // 创建时间统一 timestamp

  @OneToMany(() => Logs, (logs) => logs.user) logs: Logs[];
  @ManyToMany(() => Roles, (roles) => roles.users)
  @JoinTable({ name: 'user_roles' })                         // 多对多中间表自定义名
  roles: Roles[];
  @OneToOne(() => Profile, (p) => p.user, { cascade: true }) profile: Profile;
}
```

> **时区**：`ormconfig.ts` 设 `timezone: 'Z'`，TIMESTAMP 按 UTC 读写，避免东八区偏移。
> **synchronize**：开发可 `DB_SYNC=true` 自动同步表结构；**生产一律 `false`，用迁移**。

### 5.4 控制器（Controller）规范

```ts
@Controller('foo')
@UseGuards(JwtGuard)                                          // 类级登录校验
@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor) // 过滤@Exclude + 统一响应
export class FooController {
  constructor(private readonly fooService: FooService) {}

  @Get(':id')
  @SwaggerGetFooById()                                        // 抽离的 Swagger 装饰器
  getOne(@Param('id', ParseIntPipe) id: number) {             // 参数转换/校验用 Pipe
    return this.fooService.findOne(id);
  }

  @Post()
  @UseGuards(AdminGuard)                                      // 方法级覆盖：需管理员
  @Roles(Role.ADMIN)                                          // 配合 RoleGuard
  create(@Body() dto: CreateFooDto) { return this.fooService.create(dto); }
}
```

- **当前登录用户**：`@Req() req` 后取 `req.user.userId` / `req.user.username`（由 [JwtStrategy.validate](../apps/backend/src/services/auth/auth.strategy.ts) 注入）。
- **统一响应**：`ResponseInterceptor` 自动把返回值包成 `{ data, code:200, message:'请求成功', success:true }`；若 handler 已用 `@Res()` 写完二进制则不包。
- **Swagger 注解抽离**：把 `@ApiOperation/@ApiQuery/@ApiResponse` 用 `applyDecorators` 封成命名函数放 `<name>.swagger.ts`，控制器保持整洁。

### 5.5 守卫与装饰器

[guards/](../apps/backend/src/guards/) 与 [decorators/](../apps/backend/src/decorators/)：

| 守卫/装饰器 | 用途 | 用法 |
|---|---|---|
| `JwtGuard` | JWT 登录校验，失败抛「请先登录后再试」 | `@UseGuards(JwtGuard)` |
| `AdminGuard` | 管理员校验（注入 UserService 判断角色） | `@UseGuards(AdminGuard)` |
| `RoleGuard` + `@Roles(Role.ADMIN)` | 路由级角色校验（Reflector 读元数据，方法级优先于类级） | `@UseGuards(RoleGuard)` + `@Roles(...)` |
| `CaslGuard` + `@Can(Action.Update, User)` / `@Cannot` / `@CheckPolicies` | CASL 细粒度权限 | `@UseGuards(CaslGuard)` + `@Can(...)` |
| `@Serialize(...)` | 自定义序列化 | 见 [decorators/serialize.decorator.ts](../apps/backend/src/decorators/serialize.decorator.ts) |

角色枚举：`enum Role { ADMIN=1, USER=2 }`（[enum/roles.enum.ts](../apps/backend/src/enum/roles.enum.ts)）；动作枚举：`enum Action { MANAGE, CREATE, READ, UPDATE, DELETE }`。

### 5.6 数据库迁移（Migration）

**命名**：`<13位时间戳>-<语义名>.ts`，类名 `<PascalCase><时间戳>`。脚本定义在 [apps/backend/package.json](../apps/backend/package.json)：

```bash
pnpm -C apps/backend m:c  <name>      # 创建空壳（migration:create）
pnpm -C apps/backend m:g  <name>      # 对比实体生成 SQL（migration:generate -p）
pnpm -C apps/backend m:run            # 执行未跑的迁移
pnpm -C apps/backend m:revert         # 回滚最近一条
# 生产（dist/scripts/typeorm-prod.cjs）：
pnpm -C apps/backend m:g:prod <name>
pnpm -C apps/backend m:run:prod
pnpm -C apps/backend m:show:prod      # 查看执行状态
```

迁移样板：

```ts
export class Auth1781208831821 implements MigrationInterface {
  name = 'Auth1781208831821';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE \`english_vocabulary_library\` ADD \`is_public\` tinyint NOT NULL DEFAULT 0`);
    await q.query(`CREATE INDEX \`idx_evl_public\` ON \`english_vocabulary_library\` (\`is_public\`)`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX \`idx_evl_public\` ON \`english_vocabulary_library\``);
    await q.query(`ALTER TABLE \`english_vocabulary_library\` DROP COLUMN \`is_public\``);
  }
}
```

> **注意**：`ormconfig.ts` 的 `DataSource.migrations` 路径同时兼容源码（`src/migrations`）与编译后（`dist/src/migrations`）。生产构建会把 `scripts/typeorm-prod.cjs` 拷到 `dist/scripts/`。

### 5.7 全局中间件与启动配置（main.ts）

[main.ts](../apps/backend/src/main.ts) 关键点（**改动需谨慎**）：

- `cors: true` + `rawBody: true`（Stripe Webhook 签名校验需要原始请求体）
- `useBodyParser('json', { limit: '6mb' })`：知识库 content 允许至 5MB（DTO 校验），故 JSON 上限设 6MB
- `serveUploadStaticMiddleware`：在 `globalPrefix('api')` **之前**注册，直接处理 `/images`、`/files`、`/remotes`（解码中文文件名）
- `helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })`：允许 9002 页面/Tauri WebView 跨端口加载 9112 图片
- 生产 `app.set('trust proxy', 1)`：信任 Nginx 的 `X-Forwarded-*`，否则 rate-limit 抛 `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`
- `rateLimit({ windowMs: 60_000, max: 300 })`：每 IP 每分钟 300 请求
- Swagger 挂在 `/api-docs`
- 端口 `process.env.PORT ?? 9112`

### 5.8 新增后端模块完整步骤

以新增 `foo` 模块为例：

1. 新建 `src/services/foo/`，按 §5.2 创建 `foo.module.ts` / `foo.controller.ts` / `foo.service.ts` / `foo.entity.ts` / `dto/` / `foo.swagger.ts`
2. 实体用 TypeORM 装饰器（主键 `@PrimaryGeneratedColumn()`，敏感字段 `@Exclude()`，多对多 `@JoinTable`）
3. 模块内 `TypeOrmModule.forFeature([Foo])` 注册实体；需要被别处用就 `exports: [FooService]`，全局共享加 `@Global()`
4. 控制器加 `@UseGuards(JwtGuard)` + `@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor)`；Swagger 注解抽到 `foo.swagger.ts`
5. 在 [app.module.ts](../apps/backend/src/app.module.ts) 的 `imports` 数组追加 `FooModule`（「业务模块」注释区）
6. 表结构变更：开发期可 `DB_SYNC=true`；生产用 `pnpm m:g -- foo` 生成迁移 → `pnpm m:run:prod`
7. 若引入新环境变量：先在 [config.enum.ts](../apps/backend/src/enum/config.enum.ts) 加枚举 → 必要时在 [app-config.factory.ts](../apps/backend/src/factorys/app-config.factory.ts) Joi schema 加校验
8. 前端在 [service/api.ts](../apps/frontend/src/service/api.ts) 加端点常量 → [service/index.ts](../apps/frontend/src/service/index.ts) 加调用封装

### 5.9 多数据库切换（可选）

[TypeOrmConfigService](../apps/backend/src/database/typeorm-config.service.ts) 通过 `@Inject(REQUEST)` 读请求 `query.version` / `body.version`，`v1` 走 `DB_DB1_PORT`（db1 容器），否则走默认 `DB_PORT`。**注意：这会让该 Service 变成 request-scoped**。`app.module.ts` 用连接池 Map 缓存 DataSource 避免重复初始化。

---

## 6. 前端开发指南（React + Tauri）

### 6.1 入口与路由

- [main.tsx](../apps/frontend/src/main.tsx)：按 `window.location.pathname` 分流——`/about` 走轻量 chunk（关于窗），其余走 `router/`
- [router/index.tsx](../apps/frontend/src/router/index.tsx)：装配 `RouterProvider`，初始化 `pluginManager`，监听 Tauri `about` / `logout` 事件
- [router/routes.ts](../apps/frontend/src/router/routes.ts)：静态路由表（Layout 壳 + 各业务页 + 法律/分享独立页）
- [router/buildRoutes.ts](../apps/frontend/src/router/buildRoutes.ts)：合并静态路由与**插件动态路由**（注入到 Layout children 末尾）
- [router/authPaths.ts](../apps/frontend/src/router/authPaths.ts)：`isPublicPath()` 白名单（`/`、`/login`、`/win`、`/about`、`/service-policy`、`/user-agreement`、`/update-info`、`/project-guide`、`/plugin-dev-guide`、`/download-desktop`、`/knowledge`、`/setting` 及子路径、`/share/:shareId`）；`hasValidAuthToken()` 读 `localStorage.token`

### 6.2 新增页面步骤

1. 在 `src/views/<name>/` 创建页面组件
2. 在 [routes.ts](../apps/frontend/src/router/routes.ts) 注册路由（Layout 内的需登录页放 `Layout.children`；公开页放顶层独立路由）
3. 需要鉴权的页**不要**加进 `authPaths.ts` 的白名单；公开页必须加
4. 路由 `meta.titleKey` 指向 i18n key（[i18n/locales/zh-CN.ts](../apps/frontend/src/i18n/locales/zh-CN.ts) 与 `en-US.ts` 同步加）
5. 涉及后端的，在 [service/api.ts](../apps/frontend/src/service/api.ts) 加端点常量 + [service/index.ts](../apps/frontend/src/service/index.ts) 加调用函数
6. 涉及全局状态的，在 `src/store/` 加 MobX store 并挂到 [store/index.ts](../apps/frontend/src/store/index.ts) 的 `RootStore`

### 6.3 HTTP 客户端（重要：两套并存）

项目存在**两套 HTTP 客户端**：

- **生产用**：[utils/fetch.ts](../apps/frontend/src/utils/fetch.ts) 的自研 `HttpClient`（基于 fetch）。`service/index.ts` 全部走这个。
  - baseURL = `BASE_URL`（来自 `constants/index.ts`，`PROD ? VITE_PROD_API_DOMAIN : VITE_DEV_API_DOMAIN`）
  - 默认头 `Content-Type: application/json` + `Authorization: Bearer <localStorage.token>`
  - 超时 `50000ms`
  - **平台自适应**：Tauri 环境动态 `import('@tauri-apps/plugin-http')`，浏览器用原生 fetch
  - **401 自动登出**：清 token + `notifyUnauthorized()` 跳登录
  - **网络瞬时错误重试**：Tauri 默认 2 次（指数退避 `400*(attempt+1)ms`），Web 0 次
  - **错误 Toast**：非 `silent` 请求失败弹 Toast，文案优先取 `data.data.error.message` → `data.data.message` → `message`，并把「网络错误」类屏蔽为友好提示
  - 导出单例 `export const http = new HttpClient()`
- **历史遗留**：[utils/axios.ts](../apps/frontend/src/utils/axios.ts)（baseURL `/api`，60s 超时）。**新代码不要用**。

> **新增 API 调用一律用 `http` 单例**，不要直接 `import axios`。

### 6.4 状态管理（MobX）

[store/index.ts](../apps/frontend/src/store/index.ts) 采用多 store + RootStore 聚合：

```ts
class RootStore {
  authStore = AuthStore;       // 各子 store 文件 export default new XxxStore()（已是单例）
  userStore = UserStore;
  chatStore = ChatStore;
  knowledgeStore = KnowledgeStore;
  assistantStore = AssistantStore;
  ebookStore = EbookStore;
  knowledgeRagQaStore = KnowledgeRagQaStore;
}
const store = new RootStore();
const Context = createContext(store);
export default function useStore() { return useContext(Context); }
```

- 子 store 用 `makeAutoObservable(this)` 自动 observable
- `user.ts` 的 `setUserInfo()` 检测 userId 变化时调 `resetUserState()` 清理其它 store，并 `window.dispatchEvent(new Event('userInfoChanged'))` 广播
- 登出清态见 [app/logout-unify-theme-sync.md](./app/logout-unify-theme-sync.md)（`performLogout` 集中清态 + 动态 import 规避循环依赖）

### 6.5 i18n

[i18n/index.ts](../apps/frontend/src/i18n/index.ts)：

- `Locale = 'zh-CN' | 'en-US'`，默认 `zh-CN`
- `getActiveLocale()` 优先级：`globalThis.__dnhyxc_locale_runtime__`（运行时注入，MF 插件用）→ URL `?lang=`/`?locale=` → `localStorage['dnhyxc_locale_bootstrap']` → `zh-CN`
- `translateSync(key, params)`：同步翻译，供非 React 模块（如 HttpClient Toast）使用
- React 组件用 [hooks/i18n.ts](../apps/frontend/src/hooks/i18n.ts) 响应式翻译
- **新增界面文案**：同时改 `zh-CN.ts` 与 `en-US.ts`，键名用点分层级（如 `route.chat.title`）

### 6.6 Vite 配置要点

[vite.config.ts](../apps/frontend/vite.config.ts)：

- **MF Host** 必须用 `federation({ name:'host', shared:{ react:{singleton:true}, 'react-dom':{singleton:true} } })`，否则 Remote 共享 React 易挂
- **勿 shared `react-router`**：生产 loadShare 易拆成双实例导致 `useLocation` 找不到 Router context（线上 `/plugins` 白屏）
- `optimizeDeps.exclude` 禁止把 `react/react-dom/react-jsx-runtime` 打进 `.vite/deps`（否则写进 `virtual:mf` 重启解析失败）
- 开发代理：`/api`、`/images`、`/files`、`/remotes` → 后端；`/ext-cos/` → COS 域名
- 端口 `9002`（strictPort）

### 6.7 Tauri 桌面壳

[src-tauri/tauri.conf.json](../apps/frontend/src-tauri/tauri.conf.json)：

- `productName: dnhyxc-ai`，`identifier: com.dnhyxc.dnhyxc-ai`
- 窗口 `1050x720`，最小 `1050x720`，`titleBarStyle: Overlay`
- 更新器 pubkey + endpoints（GitHub releases `latest.json`）
- `capabilities/`：`default.json` + `desktop.json` 定义插件权限白名单
- macOS：`Info.plist` + `macos/Entitlements.plist`
- Rust 入口：`src-tauri/src/main.rs` / `lib.rs`

### 6.8 常量文件

[constants/](../apps/frontend/src/constants/)：

- `index.ts`：`BASE_URL`、附件类型白名单、词汇/经典句数量上下限、分页阈值、`getChatMarkdownHighlightTheme()`
- `membershipPlans.ts`：会员套餐定价（月 ¥9.9/30天、季 ¥25.9/90天、年 ¥99.9/365天，**硬编码**）
- `edgeTts.ts` / `minimaxTts.ts` / `xfyunTts.ts`：三套 TTS 发音人表与参数换算

---

## 7. 动态插件系统（Module Federation）

### 7.1 架构

主站前端是 **MF Host**，运行时加载独立部署的 **Remote 插件**（`apps/remote-plugins/`）。两类信任级别：

- `first-party`：直接加载 Remote 模块
- `untrusted`：走 iframe + postMessage 桥接（`attachIframeBridge` / `MF_IFRAME_CHANNEL`）

插件可注入：路由（`routeInjector`）、侧边栏（`sidebarInjector`）、Host API（`eventBus`、电子书 `createEbookModulesApi`）。

### 7.2 插件中心

- 入口：`/plugins`（[views/plugins](../apps/frontend/src/views/plugins)）
- 注册表编辑：`/plugins/registry`，JSON 原文编辑，保存后自动重载
- 启用态：账号级云端偏好（`pluginEnabledPrefs.ts`），换端/换号自动同步；新账号默认全关
- 样式隔离：`plugins/host/styleIsolation.ts` 运行时 `@scope([data-mf-plugin])`
- 缓存破坏：`version@manifestHash`（[plugin-entry-cache-bust.md](./app/plugin-entry-cache-bust.md)）

### 7.3 新增 Remote 插件步骤

参照 [apps/remote-plugins/plugin-info.md](../apps/remote-plugins/plugin-info.md)：

1. 在 `apps/remote-plugins/src/views/<name>/` 创建模块
2. 在 [vite.config.ts](../apps/remote-plugins/vite.config.ts) 的 `federation.exposes` 加一条
3. 在 `plugins-registry.json` 加一条（共用 `remoteName: "remotePlugins"` + 同一 `entry`）
4. 生产构建需设 `VITE_REMOTE_PUBLIC_ORIGIN`（与 registry `entry` 同源）
5. **CORS**：生产 Remote 源站 Nginx 必须放行 `https://your-domain:9002` 与 `tauri://localhost`（用 `map` 放行多 origin，见 §12.4）
6. 详细开发手册见 [app/plugin-development-guide.md](./app/plugin-development-guide.md)、[app/host-plugin-integration-guide.md](./app/host-plugin-integration-guide.md)、[app/dynamic-plugin-system.md](./app/dynamic-plugin-system.md)

### 7.4 Remote 部署

[apps/remote-plugins/publish.config.json](../apps/remote-plugins/publish.config.json) 把构建产物 SCP 到远端 `/usr/local/nginx/remote-plugins`（Nginx 静态托管，非 Node 服务）。`pnpm -C apps/remote-plugins deploy` = `build && publish`。

---

## 8. LLM / 知识库 RAG / TTS 接入

### 8.1 LLM 工厂 `createLlm`

[utils/create-llm.ts](../apps/backend/src/utils/create-llm.ts) 是统一凭证解析入口。`SiliconFlowLlmPreset` 与业务一一对应：

| preset | 用途 | 凭证来源 |
|---|---|---|
| `chat` | 主站对话 | `SILICONFLOW_*`，用户设置页可覆盖 |
| `assistant` | 知识库助手 | `SILICONFLOW_*` / `GLM_*` |
| `knowledgeQa` | 知识库 RAG 问答 | `SILICONFLOW_*` + `KNOWLEDGE_QA_MODEL` |
| `englishLearning` | 英语学习词句拉取 | `SILICONFLOW_*` |
| `ocr` | 图片 OCR | `GLM_*`（固定 GLM-4.6V-Flash，不走设置页覆盖） |

- 默认值：`DEFAULT_SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1`，`DEFAULT_SILICONFLOW_MODEL_NAME=Pro/zai-org/GLM-5.1`
- `GLM_THINKING_DISABLED_KWARGS = { thinking: { type: 'disabled' } }`：agent/assistant 工具链和正文流式调用会关闭思考链
- 缺 ApiKey 抛 503（http）或 Error（普通）

### 8.2 知识库 RAG

- **向量库**：Qdrant（`QDRANT_URL` + 两个 collection：默认 bge 库 + 会员 Qwen3 库）
- **入库**：`knowledge` 模块分片（见 [knowledge-chunk-boundaries.md](./knowledge/knowledge-chunk-boundaries.md)），调用硅基 `/v1/embeddings`
- **检索**：`knowledge-qa` 模块，topK=10，rerank 走硅基 `/v1/rerank`
- **会员档位**：有效会员用 Qwen3-Embedding-4B（2560 维）+ Qwen3-Reranker-4B；非会员用 BAAI/bge-large-zh-v1.5
- **用户自定义向量**：设置页 `/setting/llm` 向下滚动到「向量模型」区块保存（见 [project-guide.md](./project-guide.md) §8.3）
- **全站 BGE 模式**：超级管理员开「仅使用 BGE 向量库」后全站走系统 BGE（见 [vector-bge-global-round.md](./knowledge/vector-bge-global-round.md)）

### 8.3 TTS（语音合成）

四条链路，由前端「朗读来源」选择（设置页 `/setting/cloud-tts`）：

| 来源 | 可用性 | 实现 |
|---|---|---|
| 本机语音 | 所有用户 | 浏览器 SpeechSynthesis |
| Edge 云端 | 所有用户（免费） | `edge-tts-universal`，[english/cloud-tts-edge-voice.md](./english/cloud-tts-edge-voice.md) |
| MiniMax 云端 | 有效会员 | `MinimaxEnum`，[english/minimax-cloud-tts.md](./english/minimax-cloud-tts.md) |
| 讯飞云端 | 有效会员 | `XfyunEnum`（WebSocket 流式），[english/xfyun-cloud-tts.md](./english/xfyun-cloud-tts.md) |

- 三套云端参数（语速/音量/音高）**分别保存**，账号级同步
- 长文按句读分段合成，首段完成即出声，预取下一段（[cloud-tts-segment-pipeline.md](./english/cloud-tts-segment-pipeline.md)）
- 云端不可用时回退本机
- 电子书听书共用同一套播放会话（[ebook/epub-chapter-listen.md](./ebook/epub-chapter-listen.md)）

### 8.4 联网搜索

`WEB_SEARCH_DEFAULT_PROVIDER`（`tavily` 默认 / `serper`）+ `TAVILY_API_KEY` / `SERPER_API_KEY`。单次请求可用 `ChatRequestDto.webSearchProvider` 覆盖。详见 [chat/web-search.md](./chat/web-search.md)。

---

## 9. 对象存储 COS 与上传落盘

### 9.1 两套存储

- **腾讯云 COS**：头像、聊天附件（`POST /api/upload/uploadCos`），后端 `putObject`，ACL 默认 `public-read`
- **本地 uploads**：图片 `/images`、文件 `/files`、插件静态 `/remotes`，由 `serveUploadStaticMiddleware` 提供静态服务

### 9.2 上传路径解析

[utils/upload-paths.ts](../apps/backend/src/utils/upload-paths.ts)：

- `getUploadsRoot()` 优先级：
  1. `UPLOAD_ROOT`（绝对路径；**仅当本机路径或父目录存在时才采用**，避免本地 Mac 误用线上 `/usr/local/...`）
  2. `SERVER_ROOT` + `FILE_ROOT`（默认 `uploads`）
  3. 自动识别：从编译产物位置向上找「含 dist 子目录」的包根
- `uploads` 与 `dist` 同级，**不在 dist 内**（避免重新构建丢失文件）

### 9.3 换 COS 桶（**四处必须同步**）

1. 后端 `.env`：`COS_SECRET_ID/SECRET_KEY/BUCKET/REGION/PUBLIC_DOMAIN/OBJECT_ACL`
2. 前端 `.env`：`VITE_COS_PUBLIC_DOMAIN` / `VITE_COS_PROXY_PREFIX`
3. Nginx：`/ext-cos/` 的 `proxy_pass` 与 `Host` header
4. Tauri：`src-tauri/capabilities/` 的 http allowlist

详见 [cos/cos-object-storage.md](./cos/cos-object-storage.md) §5、[cos/cos-dev-http-proxy.md](./cos/cos-dev-http-proxy.md)。

### 9.4 常见排查

| 现象 | 文档 |
|---|---|
| COS 上传 AccessDenied | [cos-object-storage.md](./cos/cos-object-storage.md) §3.4、§6 |
| COS 能传不能显（403/ATS） | [cos-object-storage.md](./cos/cos-object-storage.md) §3.3 + [cos-dev-http-proxy.md](./cos/cos-dev-http-proxy.md) |
| 生产 `/images/` 400 | [chat/chat-upload-access-prod.md](./chat/chat-upload-access-prod.md) + [ops/nginx.md](./ops/nginx.md) |
| UPLOAD_ROOT 落盘 | [ops/upload-storage-paths.md](./ops/upload-storage-paths.md) |

---

## 10. 支付与会员（Stripe）

### 10.1 配置

- 后端：`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`（未配置时创建 Checkout 返回服务不可用）
- 前端：`VITE_STRIPE_PUBLISHABLE_KEY`
- 套餐定价：[constants/membershipPlans.ts](../apps/frontend/src/constants/membershipPlans.ts) **硬编码**（月 ¥9.9/30天、季 ¥25.9/90天、年 ¥99.9/365天），**不读环境变量**
- Webhook 路由：`/api/pay/webhook`（`main.ts` 的 `rawBody: true` 即为签名校验）

### 10.2 本地调试 Webhook

```bash
stripe listen --forward-to localhost:9112/api/pay/webhook
```

### 10.3 会员状态

- 支付成功自动跳个人主页，显示金色「会员」徽章与有效期
- 再购在原到期日之后续期叠加
- 到期后重新登录恢复非会员
- 详见 [pay/stripe-membership-billing.md](./pay/stripe-membership-billing.md)、[pay/membership-active-hook.md](./pay/membership-active-hook.md)、[pay/membership-grant-idempotency.md](./pay/membership-grant-idempotency.md)

---

## 11. 代码规范与协作流程

### 11.1 格式与 Lint（Biome）

[biome.json](../biome.json)（Biome 2.4.13）：

- **格式化**：`indentStyle: "tab"`、`quoteStyle: "single"`、`semicolons: "always"`、`formatWithErrors: true`
- **CSS**：开启 `tailwindDirectives: true`
- **assist**：`organizeImports: "on"`
- **overrides**：`**/migrations/**` 关闭 lint + format + assist
- Lint 关闭一批干扰项（`useExhaustiveDependencies`、`noExplicitAny`、`useImportType` 等）

```bash
pnpm check          # biome check --write（格式化 + 修复）
pnpm check:staged   # 仅检查暂存区（pre-commit 用）
pnpm format         # biome format --write
```

### 11.2 Git Hooks（Husky）

- [.husky/pre-commit](../.husky/pre-commit)：跑 `biome check --staged`
- [.husky/commit-msg](../.husky/commit-msg)：跑 commitlint

### 11.3 提交规范（Commitizen + Commitlint）

[.cz-config.js](../.cz-config.js) 定义 15 种 type：`feat / bug / fix / ui / docs / style / perf / refactor / release / deploy / test / chore / revert / other / build`。[commitlint.config.js](../commitlint.config.js) 强制校验。

```bash
pnpm commit    # 交互式生成符合规范的 commit message（中文提示）
```

- `subjectLimit: 72`，`skipQuestions: ['body','footer']`，`allowCustomScopes: true`
- type 必须小写，subject 不能为空

### 11.4 版本管理（Changeset）

```bash
pnpm changeset          # 交互式记录变更
pnpm changeset:version  # 应用变更生成版本号
pnpm changeset:publish  # 发布
```

### 11.5 桌面端发布

```bash
pnpm build:patch   # patch 版本：bump + tauri build + update-latest + upload-release + upload-dmg
pnpm build:minor   # minor 版本
pnpm build:major   # major 版本
```

需先设 Tauri 签名环境变量（`release-kit print-tauri-signing-env` 输出 eval 命令）。

---

## 12. 部署与运维

### 12.1 开发环境（Docker Compose）

[docker-compose.yml](../docker-compose.yml) 起 4 个服务：

- `db`（MySQL 8.0，端口 3090，数据卷 `../mysql/db`）
- `db1`（MySQL 8.0，端口 3092，数据卷 `../mysql/db1`）
- `adminer`（端口 3091）
- `qdrant`（端口 6333/6334，数据卷 `../qdrant/storage`）

```bash
docker compose up -d
docker compose ps
docker compose logs -f db
```

### 12.2 生产部署（以 [ops/server-deployment.md](./ops/server-deployment.md) 为准）

> **注意**：[ops/deploy.md](./ops/deploy.md) 是早期 Koa+MongoDB 旧流程，**仅作历史参考**；当前主流程是 NestJS + MySQL/Redis + PM2 + Docker Compose。

**服务器一次性准备**：

1. **目录约定**：Nest 运行 `/usr/local/dnhyxc-ai/server`；MySQL Compose `/usr/local/dnhyxc-ai/mysql`；数据卷 `/dnhyxc-ai/mysql/db`、`/dnhyxc-ai/mysql/db1`
2. **依赖**：nvm → Node v16+ → pnpm → PM2 → Docker → docker-compose
3. **MySQL**：在 `/usr/local/dnhyxc-ai/mysql/docker-compose.yml` 起 `db`(12009)、`db1`(12006)、`adminer`(12011)
4. **Redis**：编译安装到 `/usr/local/redis`，端口改 `12029`，`daemonize yes`，`install_server.sh` 开机自启
5. **防火墙**：三层同步放行（云安全组 + firewalld + 监听 0.0.0.0）：
   ```bash
   sudo firewall-cmd --permanent --zone=public --add-port=9112/tcp
   sudo firewall-cmd --permanent --zone=public --add-port=12009/tcp
   sudo firewall-cmd --reload && sudo firewall-cmd --list-ports
   ```

**后端部署流程**：

```bash
# 1. 本地构建并打包
cd apps/backend
pnpm build                  # 产 dist
pnpm dist:zip               # cd dist && zip -qr ../dist.zip .

# 2. 上传到服务器 /usr/local/dnhyxc-ai/server
scp dist.zip package.json root@<IP>:/usr/local/dnhyxc-ai/server/
ssh root@<IP> "cd /usr/local/dnhyxc-ai/server && unzip -o dist.zip && pnpm install -P"

# 3. 配置 .env / .env.production（见 §4.3）

# 4. 跑生产迁移
NODE_ENV=production node dist/scripts/typeorm-prod.cjs migration:run

# 5. 验证启动
pnpm start:prod             # = cross-env NODE_ENV=production node dist/src/main

# 6. 交给 PM2
pm2 start npm --name server -- run start:prod
pm2 save && pm2 startup     # 按提示执行输出的 sudo 命令
```

**前端部署**：`pnpm -C apps/frontend build` 产 `dist`，SCP 到 `/usr/local/nginx/dnhyxc-ai/dist`，Nginx `try_files` 兜底 SPA。

**更新代码典型动作**：`pnpm build` → 上传新 `dist` → `pm2 restart server`。

### 12.3 CI / SSH 部署工具（`packages/ci`）

自研 `dnhyxc-ci` CLI，避免手动 scp/ssh。配置已就绪：[apps/backend/deploy.backend.json](../apps/backend/deploy.backend.json)。

```bash
pnpm -C packages/ci build

# 全量部署（按 deploy.backend.json）
node packages/ci/dist/cli.js ssh:deploy -c apps/backend/deploy.backend.json

# 只部署某 target
node packages/ci/dist/cli.js ssh:deploy -c ./deploy.config.json --only backend-api

# 干跑（只打印命令不执行）
node packages/ci/dist/cli.js ssh:deploy -c ./deploy.config.json --dry-run
```

**执行顺序**（`deploy.ts` 的 `deployZipViaSsh`）：
1. 解析配置 → 按 `--only` 过滤 target
2. 按 `server.kind` 选连接方式（`ssh-cli` 走外部 ssh 命令；默认走 `ssh2` 库支持 password/privateKey）
3. `preCommands` → 上传 zip 到 `remoteTmpZip` → `mkdir -p remoteDir` →（可选 `cleanRemoteDir` 清空）→ `unzip -o -d remoteDir`
4. （可选）`installCommand` 装依赖 → （可选）`pm2 restart` → （可选）`nginx reload` → `postCommands`

**注意事项**：

- 远端需 `unzip`（缺失时在 `preCommands` 装 `apt-get install -y unzip`）
- `nginxRestartCommand` 用 `sudo` 需免密 sudo
- `cleanRemoteDir: true` 会 `rm -rf <remoteDir>/*`，**生产慎用**（后端配置设 `false` 避免误删 `.env`/`uploads`）
- 后端 `installDeps: false`：`dist.zip` 不含 `node_modules`，需保证服务器已有依赖或改 `true`
- 首次部署需先手动 `pm2 start npm --name server -- run start:prod`

**认证**（`ssh.ts` 的 `fromConfig`）：`password` 或 `privateKeyPath`（可带 `passphrase`）二选一。`deploy.backend.json` 用 `kind: "ssh-cli"` 走外部 ssh，不写 auth（依赖本机 ssh-agent/默认私钥）。

配置样例：[packages/ci/examples/deploy.config.example.json](../packages/ci/examples/deploy.config.example.json)（含前后端两个 target）。

### 12.4 Nginx 配置要点

详见 [ops/nginx.md](./ops/nginx.md)。核心：

```nginx
# 全局
client_max_body_size 100m;
gzip on; gzip_min_length 1k; gzip_comp_level 5;

# 9112 server 块
server {
  listen 9112 ssl;
  # 前端 SPA
  location / {
    root /usr/local/nginx/dnhyxc-ai/dist;
    try_files $uri $uri/ /index.html;
  }
  # API 反代到本机 NestJS 9226（关闭 buffering/cache 适配 SSE 流式）
  location /api/ {
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_buffering off; proxy_cache off;
    proxy_pass http://127.0.0.1:9226;
  }
  # 附件静态（alias 末尾 / 与 location / 成对，勿与 root/proxy_pass 混用 → 400）
  location ^~ /images/ { alias /usr/local/dnhyxc-ai/server/uploads/images/; add_header Cross-Origin-Resource-Policy cross-origin; expires 7d; }
  location ^~ /files/  { alias /usr/local/dnhyxc-ai/server/uploads/files/;  add_header Cross-Origin-Resource-Policy cross-origin; expires 7d; }
  # 插件 registry：禁止缓存（与后端 no-store 对齐）
  location ^~ /remotes/ {
    alias /usr/local/dnhyxc-ai/server/uploads/remotes/;
    add_header Cross-Origin-Resource-Policy cross-origin;
    add_header Cache-Control "no-store, max-age=0, must-revalidate";
  }
  # COS 同源代理（避免 mixed content）
  location /ext-cos/ {
    proxy_set_header Host <桶名>.cos.<region>.myqcloud.com;
    rewrite ^/ext-cos/(.*)$ /$1 break;
    proxy_pass https://<桶名>.cos.<region>.myqcloud.com;
    add_header Cache-Control "public, max-age=604800";
  }
}

# MF Remote 跨域：用 map 放行多 origin（只放行 9002 会导致桌面端 tauri://localhost 失败）
map $http_origin $mf_cors_origin {
  default "";
  "https://your-domain.com:9002" $http_origin;
  "http://tauri.localhost"  $http_origin;
  "https://tauri.localhost" $http_origin;
  "tauri://localhost"       $http_origin;
}
```

**易错点**：

- `proxy_pass https: //host`（冒号后有空格）→ invalid number of arguments
- `/remotes/` 若另设 `expires` 必须与后端 `no-store` 一致，否则桌面/代理吃旧 registry
- Nest 不能与本机 9112 同时监听；由 Nginx 占 9112 终止 TLS，后端跑 9226
- 后端 `main.ts` 生产 `app.set('trust proxy', 1)` 必须配 Nginx 反代，否则 rate-limit 报错

### 12.5 数据库导出

```bash
# 仅结构
pnpm -C apps/backend sql         # 用 package.json 的 sql 脚本
# 结构 + 数据
docker exec dnhyxc_ai_db sh -lc 'mysqldump -uroot -p<密码> --databases dnhyxc_ai_db --single-transaction --set-gtid-purged=OFF --routines --triggers --events --default-character-set=utf8mb4'
```

---

## 13. 维护现有需求：排查与文档索引

### 13.1 文档体系

[docs/](.) 按**功能域**组织，每个域有 `README.md` 索引：

| 目录 | 域 | 入口 |
|---|---|---|
| `chat/` | 主站对话、分享、联网、附件 | [chat/README.md](./chat/README.md) |
| `knowledge/` | 知识库、RAG、文档助手 | [knowledge/README.md](./knowledge/README.md) |
| `english/` | 英语学习（词包、收藏、TTS、Agent） | [english/README.md](./english/README.md) |
| `ebook/` | 电子书书架、EPUB/PDF 阅读与进度 | [ebook/README.md](./ebook/README.md) |
| `ebook/developer/` | EPUB 开发者实现手册 | [ebook/developer/README.md](./ebook/developer/README.md) |
| `cos/` | 腾讯云 COS | [cos/README.md](./cos/README.md) |
| `llm/` | 大模型接入 | [llm/README.md](./llm/README.md) |
| `ops/` | 部署、Nginx、上传 | [ops/README.md](./ops/README.md) |
| `app/` | 前端壳层：路由鉴权、Tauri、i18n | [app/README.md](./app/README.md) |
| `monaco/` | Monaco / Markdown 编辑器 | [monaco/README.md](./monaco/README.md) |
| `mermaid/` | Mermaid 围栏与预览 | [mermaid/markdown-zoom-and-preview.md](./mermaid/markdown-zoom-and-preview.md) |
| `tools/` | `@dnhyxc-ai/markdown-kit` | [tools/index.md](./tools/index.md) |
| `react/` | React Hooks 专题 | 按文件名检索 |
| `setting/` | 系统快捷键 | [setting/system-shortcuts-implementation-record.md](./setting/system-shortcuts-implementation-record.md) |
| `pay/` | Stripe 会员 | [pay/stripe-membership-billing.md](./pay/stripe-membership-billing.md) |
| `meta/` | 发布与更新同步 | [meta/project-features-update.md](./meta/project-features-update.md) |
| `ideas/` | **规划态**功能实现思路（架构/流程图） | [ideas/README.md](./ideas/README.md) |
| `Influence-point/` | 跨功能改动影响面分析 | [Influence-point/README.md](./Influence-point/README.md) |

**文档类型**：

- **实现 / 修复**：各域下 `*-implementation*`、`*-complete*` 或专题名 md
- **规划 / 实现思路**：`ideas/` — 需求阶段的架构图、流程图与分阶段步骤
- **运维**：`ops/deploy.md`、`ops/nginx.md`、`ops/server-deployment.md`
- **用户向**：根目录 `project-guide.md`、`project-update-info.md`（正文不出现仓库路径）

### 13.2 新增专题文档约定

新增专题时请在对应域 `README.md` 登记一行，并视需要更新 [docs/README.md](./README.md) 的「常见排查」表。

### 13.3 常见排查速查（节选，完整表见 [docs/README.md](./README.md)）

| 现象 | 优先阅读 |
|---|---|
| COS 上传 AccessDenied | [cos/cos-object-storage.md](./cos/cos-object-storage.md) §3.4、§6 |
| COS 能传不能显（403/ATS） | [cos/cos-object-storage.md](./cos/cos-object-storage.md) §3.3 + [cos/cos-dev-http-proxy.md](./cos/cos-dev-http-proxy.md) |
| 知识分享「更新时间」差 8h | [chat/share-knowledge-timezone.md](./chat/share-knowledge-timezone.md) |
| Web HTTPS mixed content | [app/route-auth.md](./app/route-auth.md) §12 + [ops/nginx.md](./ops/nginx.md) |
| Tauri macOS ATS | [app/tauri-macos-ats-http.md](./app/tauri-macos-ats-http.md) |
| 对话硅基接入 / createLlm 400 | [llm/siliconflow-chat-unification.md](./llm/siliconflow-chat-unification.md) + [llm/create-llm.md](./llm/create-llm.md) |
| 生产 `/images/` 400 | [chat/chat-upload-access-prod.md](./chat/chat-upload-access-prod.md) + [ops/nginx.md](./ops/nginx.md) |
| 插件 registry 跨域 / `/remotes` 404 | [ops/remotes-registry-static.md](./ops/remotes-registry-static.md) |
| 桌面插件 Origin tauri://localhost | 对方 CORS 漏配；见上 + [apps/remote-plugins/README.md](../apps/remote-plugins/README.md) |
| 桌面发新版插件仍是旧版 | [app/plugin-entry-cache-bust.md](./app/plugin-entry-cache-bust.md) + [ops/remotes-no-store-cache.md](./ops/remotes-no-store-cache.md) |
| 线上 `/plugins` useLocation 无 Router context | [app/mf-shared-react-router.md](./app/mf-shared-react-router.md) |
| 保存 registry 报 hostApi 不兼容 | [app/plugin-registry-hostapi.md](./app/plugin-registry-hostapi.md) |
| 知识库向量 404/400 入库失败 | [knowledge/siliconflow-vector-full-url.md](./knowledge/siliconflow-vector-full-url.md) |
| 保存知识库后 Invalid array length / OOM | [knowledge/knowledge-chunk-infinite-loop-oom.md](./knowledge/knowledge-chunk-infinite-loop-oom.md) |
| 对话运行久后 Node OOM | [chat/chat-memory-oom.md](./chat/chat-memory-oom.md) |
| 生产 rate-limit ERR_ERL_UNEXPECTED_X_FORWARDED_FOR | [ops/trust-proxy-rate-limit.md](./ops/trust-proxy-rate-limit.md) |
| 换号后仍看到上一账号草稿 | [app/user-switch-state-reset.md](./app/user-switch-state-reset.md) |
| Tauri 桌面频繁 Toast「网络异常」 | [app/tauri-http-all-method-retry.md](./app/tauri-http-all-method-retry.md) |
| 云端朗读 404 / MiniMax 502 余额不足 | [english/minimax-cloud-tts.md](./english/minimax-cloud-tts.md) §12 |
| 讯飞 WebSocket is not defined（Node 18） | [english/xfyun-cloud-tts.md](./english/xfyun-cloud-tts.md) §3.3、§5 |
| EPUB 用户划线如何实现 | [ebook/developer/epub-user-highlight-dev.md](./ebook/developer/epub-user-highlight-dev.md)（从 §0 读起） |
| EPUB 想法添加与虚线如何实现 | [ebook/developer/epub-thought-add-underline-dev.md](./ebook/developer/epub-thought-add-underline-dev.md)（从 §0 读起） |
| 强制刷新后 EPUB 续读位置丢失 | [ebook/ebook-progress-remote-debounce.md](./ebook/ebook-progress-remote-debounce.md) |
| 支付成功但资料页仍非会员 | [pay/stripe-membership-billing.md](./pay/stripe-membership-billing.md) §6–§7 |

### 13.4 维护现有需求的工作流建议

1. **改前先查文档**：在对应功能域 `README.md` 与 [docs/README.md](./README.md)「常见排查」表找是否已有专题文档
2. **改后写文档**：用仓库内置 skills（`implementation-doc-from-diff`、`influence-point-from-diff`、`feature-implementation-idea`）生成实现文档 / 影响面分析 / 实现思路
3. **跨功能改动**：先用 `influence-point-from-diff` 评估影响面，避免回归
4. **新增功能**：先用 `feature-implementation-idea` 在 `docs/ideas/` 落规划态文档（架构图/流程图/分阶段步骤），再实现
5. **EPUB 相关**：先读 [ebook/developer/](./ebook/developer/) 下的开发者手册
6. **发布前**：保持 `project-update-info.md` 与前端 `updateInfo` 数据模块同源；`project-guide.md` 与前端 `projectGuide` 数据模块同源（见 [meta/release-wiki-sync.md](./meta/release-wiki-sync.md)）

---

## 14. 常用命令速查

### 14.1 根目录（monorepo）

```bash
pnpm install                # 安装依赖
pnpm dev                    # 桌面端开发（tauri dev）
pnpm dev:frontend           # Web 前端开发（vite，9002）
pnpm server:dev             # 后端开发（nest --watch，9112）
pnpm dev:remote-plugins     # Remote 插件开发（9008）
pnpm dev:mf                 # 同时起多个 MF Remote + Host

pnpm check                  # biome check --write
pnpm format                 # biome format --write
pnpm commit                 # commitizen 交互式提交
pnpm changeset              # 记录变更

pnpm build:patch            # 桌面端 patch 发布
pnpm build:minor            # minor 发布
pnpm build:major            # major 发布
pnpm deploy                 # 前端 build + publish
pnpm update-wiki            # 同步更新说明到 wiki
pnpm test                   # 跑 markdown-kit 测试
```

### 14.2 后端（`apps/backend`）

```bash
pnpm -C apps/backend start:dev      # 开发（watch）
pnpm -C apps/backend start:debug    # debug
pnpm -C apps/backend build          # 生产构建
pnpm -C apps/backend start:prod     # 生产启动
pnpm -C apps/backend test           # jest 单测
pnpm -C apps/backend test:e2e       # e2e

# TypeORM 迁移
pnpm -C apps/backend m:c <name>     # 创建空壳
pnpm -C apps/backend m:g <name>     # 对比实体生成
pnpm -C apps/backend m:run          # 执行
pnpm -C apps/backend m:revert       # 回滚
pnpm -C apps/backend m:run:prod     # 生产执行
pnpm -C apps/backend m:show:prod    # 生产查看状态
pnpm -C apps/backend schema:drop    # 清空表（慎用）

# 部署
pnpm -C apps/backend dist:zip       # 打包 dist.zip
pnpm -C apps/backend deploy:ssh     # 构建+打包+SSH 部署

# 数据库导出
pnpm -C apps/backend sql            # 仅结构
pnpm -C apps/backend sql:safe       # 仅结构（IF NOT EXISTS）
```

### 14.3 前端（`apps/frontend`）

```bash
pnpm -C apps/frontend dev           # vite 开发（9002）
pnpm -C apps/frontend build         # tsc + vite build
pnpm -C apps/frontend tauri         # tauri 命令
pnpm -C apps/frontend tauri:build   # tauri build --debug
pnpm -C apps/frontend publish       # dnhyxc-ci publish
pnpm -C apps/frontend deploy        # build + publish
pnpm -C apps/frontend test:branch-smoke  # 分支逻辑冒烟
```

### 14.4 Docker / DB

```bash
docker compose up -d                # 起 DB/Qdrant
docker compose ps
docker compose logs -f db
docker exec dnhyxc_ai_db mysql -uroot -pexample dnhyxc_ai_db
```

### 14.5 CI 部署

```bash
pnpm -C packages/ci build
node packages/ci/dist/cli.js ssh:deploy -c apps/backend/deploy.backend.json
node packages/ci/dist/cli.js ssh:deploy -c <config> --only <target> --dry-run
```

---

## 15. 关键文件索引

### 15.1 后端核心

| 用途 | 路径 |
|---|---|
| 模块注册总入口 | [apps/backend/src/app.module.ts](../apps/backend/src/app.module.ts) |
| 启动配置（helmet/rate-limit/swagger/CORS） | [apps/backend/src/main.ts](../apps/backend/src/main.ts) |
| ORM 配置（CLI 用） | [apps/backend/ormconfig.ts](../apps/backend/ormconfig.ts) |
| TypeORM 运行时配置（多 DB 切换） | [apps/backend/src/database/typeorm-config.service.ts](../apps/backend/src/database/typeorm-config.service.ts) |
| 环境变量枚举（单一事实源） | [apps/backend/src/enum/config.enum.ts](../apps/backend/src/enum/config.enum.ts) |
| 环境加载与 Joi 校验 | [apps/backend/src/factorys/app-config.factory.ts](../apps/backend/src/factorys/app-config.factory.ts) |
| env 合并工具 | [apps/backend/src/utils/index.ts](../apps/backend/src/utils/index.ts) |
| LLM 工厂 `createLlm` | [apps/backend/src/utils/create-llm.ts](../apps/backend/src/utils/create-llm.ts) |
| 上传路径解析 | [apps/backend/src/utils/upload-paths.ts](../apps/backend/src/utils/upload-paths.ts) |
| 守卫 | [apps/backend/src/guards/](../apps/backend/src/guards/)（jwt/admin/role/casl） |
| 装饰器 | [apps/backend/src/decorators/](../apps/backend/src/decorators/)（roles/casl/serialize） |
| 拦截器 | [apps/backend/src/interceptors/](../apps/backend/src/interceptors/)（response/serialize） |
| JWT 策略（req.user 来源） | [apps/backend/src/services/auth/auth.strategy.ts](../apps/backend/src/services/auth/auth.strategy.ts) |
| 迁移目录 | [apps/backend/src/migrations/](../apps/backend/src/migrations/) |
| SSH 部署配置 | [apps/backend/deploy.backend.json](../apps/backend/deploy.backend.json) |
| 后端 README（含 .env 模板） | [apps/backend/README.md](../apps/backend/README.md) |

### 15.2 前端核心

| 用途 | 路径 |
|---|---|
| 入口分流（about / 主应用） | [apps/frontend/src/main.tsx](../apps/frontend/src/main.tsx) |
| 路由装配 + Tauri 事件 | [apps/frontend/src/router/index.tsx](../apps/frontend/src/router/index.tsx) |
| 静态路由表 | [apps/frontend/src/router/routes.ts](../apps/frontend/src/router/routes.ts) |
| 动态路由合并 | [apps/frontend/src/router/buildRoutes.ts](../apps/frontend/src/router/buildRoutes.ts) |
| 鉴权白名单 | [apps/frontend/src/router/authPaths.ts](../apps/frontend/src/router/authPaths.ts) |
| HTTP 客户端（生产用） | [apps/frontend/src/utils/fetch.ts](../apps/frontend/src/utils/fetch.ts) |
| API 端点常量 | [apps/frontend/src/service/api.ts](../apps/frontend/src/service/api.ts) |
| API 调用封装 | [apps/frontend/src/service/index.ts](../apps/frontend/src/service/index.ts) |
| MobX RootStore 聚合 | [apps/frontend/src/store/index.ts](../apps/frontend/src/store/index.ts) |
| 插件系统出口 | [apps/frontend/src/plugins/index.ts](../apps/frontend/src/plugins/index.ts) |
| i18n | [apps/frontend/src/i18n/index.ts](../apps/frontend/src/i18n/index.ts) |
| 常量（BASE_URL/套餐/TTS） | [apps/frontend/src/constants/](../apps/frontend/src/constants/) |
| Vite 配置（MF Host） | [apps/frontend/vite.config.ts](../apps/frontend/vite.config.ts) |
| Tauri 配置 | [apps/frontend/src-tauri/tauri.conf.json](../apps/frontend/src-tauri/tauri.conf.json) |

### 15.3 工程化

| 用途 | 路径 |
|---|---|
| Biome 格式/lint | [biome.json](../biome.json) |
| Commitizen 模板 | [.cz-config.js](../.cz-config.js) |
| Commitlint | [commitlint.config.js](../commitlint.config.js) |
| Husky hooks | [.husky/](../.husky/) |
| Changeset | [.changeset/](../.changeset/) |
| CI 部署 CLI | [packages/ci/](../packages/ci/) |
| CI 配置示例 | [packages/ci/examples/deploy.config.example.json](../packages/ci/examples/deploy.config.example.json) |
| Markdown 工具包 | [packages/markdown-kit/](../packages/markdown-kit/) |
| 开发 Docker | [docker-compose.yml](../docker-compose.yml) |

### 15.4 文档

| 用途 | 路径 |
|---|---|
| 文档总索引 | [docs/README.md](./README.md) |
| 用户产品指南 | [docs/project-guide.md](./project-guide.md) |
| 更新说明 | [docs/project-update-info.md](./project-update-info.md) |
| 部署总览（主） | [docs/ops/server-deployment.md](./ops/server-deployment.md) |
| Nginx 配置 | [docs/ops/nginx.md](./ops/nginx.md) |
| COS 主文档 | [docs/cos/cos-object-storage.md](./cos/cos-object-storage.md) |
| LLM 工厂 | [docs/llm/create-llm.md](./llm/create-llm.md) |
| Stripe 会员 | [docs/pay/stripe-membership-billing.md](./pay/stripe-membership-billing.md) |
| 插件开发手册 | [docs/app/plugin-development-guide.md](./app/plugin-development-guide.md) |
| EPUB 开发者手册 | [docs/ebook/developer/](./ebook/developer/) |

---

> **维护本手册**：项目演进时请同步更新本文件与对应功能域文档。新增模块/配置项/部署步骤后，在对应章节补充；废弃内容及时删除（避免过时信息误导）。
