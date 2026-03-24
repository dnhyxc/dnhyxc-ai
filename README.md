# dnhyxc-ai

## 项目介绍

dnhyxc-ai 是一个集成了人工智能功能的现代化桌面应用程序，采用前后端分离架构，使用 Tauri 作为前端框架，NestJS 作为后端框架。该项目旨在提供一个功能丰富的 AI 助手平台，支持多种 AI 功能，包括文本生成、代码辅助、文件处理等。

## 核心功能

- **AI 对话系统**：基于 LangChain 的智能对话功能
- **用户管理**：完整的用户认证和权限管理系统
- **文件处理**：支持多种文件格式的上传、解析和处理
- **提示管理**：AI 提示词管理和优化
- **菜单系统**：可定制的功能菜单
- **日志系统**：详细的操作日志记录
- **邮件服务**：内置邮件通知功能
- **缓存系统**：高性能的数据缓存机制
- **任务队列**：基于 BullMQ 的异步任务处理

## 技术架构

### 整体架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端 (Tauri)  │───▶│   后端 (NestJS)  │───▶│   数据库 (MySQL) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
      │                        │                        │
      │                        │                        │
      └────────────────────────┼────────────────────────┘
                              │
                      ┌────────┴────────┐
                      │   缓存/队列系统  │
                      │ (Redis/BullMQ)  │
                      └─────────────────┘
```

### 前端技术栈

- **框架**：Tauri + React 19
- **构建工具**：Vite
- **UI 框架**：Tailwind CSS + Radix UI
- **状态管理**：MobX
- **表单处理**：React Hook Form + Zod
- **代码编辑器**：Monaco Editor
- **Markdown 编辑器**：md-editor-rt
- **响应式布局**：react-resizable-panels

### 后端技术栈

- **框架**：NestJS
- **数据库**：TypeORM + MySQL
- **AI 集成**：LangChain + OpenAI
- **认证**：JWT + Passport
- **权限管理**：CASL
- **文件处理**：Multer + Qiniu
- **邮件服务**：Nodemailer
- **缓存**：Cache Manager + Redis
- **任务队列**：BullMQ
- **日志**：Winston
- **API 文档**：Swagger

## 项目结构

```
dnhyxc-ai/
├── apps/                 # 应用程序目录
│   ├── backend/          # 后端服务
│   │   ├── src/          # 源代码
│   │   │   ├── services/ # 业务服务模块
│   │   │   │   ├── user/     # 用户管理
│   │   │   │   ├── prompt/   # 提示管理
│   │   │   │   ├── menus/    # 菜单管理
│   │   │   │   ├── logs/     # 日志管理
│   │   │   │   ├── upload/   # 文件上传
│   │   │   │   └── ...      # 其他服务
│   │   │   ├── guards/     # 权限守卫
│   │   │   ├── entities/   # 数据实体
│   │   │   └── ...        # 其他模块
│   │   └── test/          # 测试文件
│   └── frontend/         # 前端应用
│       ├── src/          # 源代码
│       │   ├── components/ # React 组件
│       │   ├── pages/     # 页面组件
│       │   ├── services/  # API 服务
│       │   └── ...       # 其他目录
├── packages/             # 共享包
│   └── scripts/          # 脚本工具
├── docker-compose.yml    # Docker 配置
└── package.json         # 项目配置
```

## 开发环境

### 前提条件

- Node.js (v18+)
- pnpm
- Docker & Docker Compose
- MySQL

### 安装步骤

1. 克隆项目

```bash
git clone <repository-url>
cd dnhyxc-ai
```

2. 安装依赖

```bash
pnpm install
```

3. 启动开发环境

```bash
# 启动后端服务
pnpm -C apps/backend start:dev

# 启动前端应用
pnpm dev
```

4. 访问应用

- 前端：http://localhost:9002
- 后端 API：http://localhost:9112
- 数据库管理：http://localhost:3091

## 部署

### Docker 部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 生产环境

```bash
# 构建后端
pnpm -C apps/backend build

# 启动生产服务
pnpm -C apps/backend start:prod

# 构建前端
pnpm -C apps/frontend tauri build
```

## API 文档

后端 API 文档可通过 Swagger 访问：

- 开发环境：http://localhost:3000/api
- 生产环境：http://your-domain.com/api

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系方式

- 邮箱：dnhyxc@gmail.com
- 项目主页：https://github.com/dnhyxc/dnhyxc-ai
- 相关文档：https://github.com/dnhyxc/dnhyxc-ai/wiki

## 版本历史

- v0.0.1 - 初始版本，包含基础 AI 功能和用户管理系统

## 未来规划

- [ ] 多语言支持
- [ ] 高级 AI 模型集成
- [ ] 实时协作功能
- [ ] 移动端支持
- [ ] 更多的 AI 插件和扩展
- [ ] 性能优化和缓存策略改进

## 实现 AI Agent 代码审查功能

### 技术栈使用

1. 前端技术栈：React + Vite + Tailwindcss + shadcn 组件库 + lucide 图标库。
2. 后端技术栈：Nestjs + Langchain + TypeOrm MySql + Redis + BullMQ 消息队列 + GLM 4.7 模型 + RAG + 你自行选择一个开源免费的、最热门的，最方便使用的向量数据库。

### 主要实现的功能

1. 多范围审查：支持项目/目录/文件/代码片段/Git 项目审查，适配不同开发阶段与场景。
2. 深度分析（AI+规则）：LLM 结合规则引擎（PMD/Checkstyle/SpotBugs/Semgrep），既有上下文推理又有规范落地。
3. RAG 增强：基于代码库与知识库的检索增强生成（Hybrid：BM25 + 向量检索 + Rerank），提供相似问题与修复示例。
4. Function Calling：以结构化工具调用驱动本地分析器与解析器（JavaParser/Semgrep），强制输出严格 JSON 结果（Finding/Report）。
5. 专业报告：生成 HTML/Markdown/PDF 报告，包含问题分布、严重级别统计、位置与 Diff、可执行建议。
6. 历史与检索：审查记录留存、分页与查询（名称/范围/时间）、二次检索与复盘。
7. 规范与规则：内置阿里/Google/Airbnb/PEP8 规范模板，支持自定义规范（名称+要点）、权重调优。
8. Git 集成：支持 Git 地址配置（账户与令牌），拉取并增量分析模块级问题。
9. CI/CD 集成：REST API 与 Webhook，在 PR/MR、构建、发布前自动触发审查与阻断策略。
10. 安全与合规：敏感信息脱敏、凭据仅会话态、审计日志与链路追踪。

注意：要给出完整的实现代码

本人拥有 6 年前端开发经验，同时了解后端热门的技术，长期致力于 SaaS 产品的开发。作为一个前端开发长期与产品及后端开发人员打交道，充分了解一个产品从起步到落地的完整实现过程，同时作为一个有前端开发的产品，更能直观的知道要实现的功能具体能不能做，用什么技术方案能实现出来，同时也能站在用户的视角，能充分理解用户的需求，以及用什么方案落地。希望能得到您的回复。

我拥有长达 6 年的前端开发经验，多年来始终专注于 SaaS 产品的开发领域。在日常工作中，作为前端开发人员，我与产品团队及后端开发人员紧密协作，深度参与其中，因此对产品从构思起步到最终落地的完整流程有着透彻的认知。凭借丰富的前端开发经验，我不仅能够迅速判断一项功能在技术层面是否可行，还能凭借专业知识规划出切实有效的技术实现方案。更为关键的是，我能够设身处地站在用户的角度，充分理解用户需求，并思考如何通过最合适的方案将这些需求转化为实际产品功能。衷心期待能得到您的回复。

我具备 6 年前端开发经验，长期专注于 SaaS 产品开发。工作中常与产品、后端人员协作，深入了解产品从构思到落地全流程。基于专业积累，我能快速判断功能可行性，规划技术方案。同时，我还能站在用户视角，理解需求并思考落地策略。期待您的回复。
