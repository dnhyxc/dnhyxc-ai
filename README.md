# dnhyxc-ai

一个基于 Tauri + React + NestJS 的 AI 应用程序，提供跨平台的桌面应用体验和强大的后端服务支持。

## 🏗️ 项目架构

### 整体架构
```
dnhyxc-ai/
├── client/          # 前端桌面应用 (Tauri + React)
├── server/          # 后端 API 服务 (NestJS)
├── docker-compose.yml    # Docker 容器编排
└── README.md        # 项目文档
```

### 前端架构 (Tauri + React)
- **桌面应用框架**: Tauri 2.x
- **前端框架**: React 19.x
- **状态管理**: MobX 6.x
- **路由**: React Router 7.x
- **UI 组件库**: Radix UI + Tailwind CSS
- **表单处理**: React Hook Form + Zod
- **HTTP 请求**: Axios
- **工具库**: 
  - crypto-js (加密)
  - js-md5 (MD5 哈希)
  - qiniu-js (七牛云上传)
  - lucide-react (图标)

### 后端架构 (NestJS)
- **后端框架**: NestJS 11.x
- **数据库**: MySQL 8.0
- **ORM**: TypeORM
- **身份认证**: JWT + Passport
- **权限控制**: CASL
- **API 文档**: Swagger
- **日志管理**: Winston
- **缓存**: Redis (Keyv)
- **邮件服务**: Nodemailer
- **文件上传**: Multer + 七牛云
- **安全**: 
  - Helmet (头部安全)
  - Express Rate Limit (请求限制)
  - bcrypt (密码加密)
  - Argon2 (密码哈希)

## 🚀 技术栈

### 前端技术
| 技术 | 版本 | 描述 |
|------|------|------|
| Tauri | ^2 | 跨平台桌面应用框架 |
| React | ^19.1.0 | 用户界面构建库 |
| TypeScript | ^5.8.3 | 类型安全的 JavaScript |
| Vite | ^7.0.4 | 现代前端构建工具 |
| Tailwind CSS | ^4.1.18 | 实用优先的 CSS 框架 |
| Radix UI | ^1.x | 无样式的可访问组件 |
| MobX | ^6.15.0 | 简单可扩展的状态管理 |
| React Router | ^7.10.1 | React 路由库 |

### 后端技术
| 技术 | 版本 | 描述 |
|------|------|------|
| NestJS | ^11.0.1 | 高效的 Node.js 服务端框架 |
| TypeScript | ^5.x | 类型安全的 JavaScript |
| MySQL | ^8.0 | 关系型数据库 |
| TypeORM | ^0.3.28 | Node.js ORM 框架 |
| JWT | ^11.0.2 | JSON Web Token 认证 |
| Redis | ^5.1.5 | 内存数据库缓存 |
| Winston | ^3.19.0 | 日志管理库 |
| Swagger | ^11.2.3 | API 文档生成 |

### 开发工具
| 工具 | 版本 | 描述 |
|------|------|------|
| pnpm | ^10.8.1 | 高效的包管理器 |
| Biome | ^2.3.9 | 代码格式化和检查 |
| Husky | ^8.0.3 | Git hooks 管理 |
| Commitizen | - | 规范化提交信息 |
| Docker | - | 容器化部署 |
| ESLint | ^9.18.0 | 代码质量检查 |

## 🛠️ 开发环境搭建

### 环境要求
- Node.js >= 18
- Rust >= 1.70
- MySQL >= 8.0
- Redis >= 6.0
- Docker (可选)

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/dnhyxc/dnhyxc-ai.git
cd dnhyxc-ai
```

2. **安装依赖**
```bash
# 安装根目录依赖
pnpm install

# 安装前端依赖
pnpm -C client install

# 安装后端依赖
pnpm -C server install
```

3. **配置环境变量**
```bash
# 复制后端环境配置文件
cp server/.env.example server/.env
# 编辑 server/.env 文件，配置数据库连接等信息
```

4. **启动数据库服务**
```bash
# 使用 Docker 启动 MySQL
docker-compose up -d db
```

5. **运行数据库迁移**
```bash
# 进入后端目录
cd server
# 运行数据库迁移
pnpm m:run
```

## 🎯 核心功能

### 用户认证与授权
- JWT 身份认证
- 基于角色的权限控制 (RBAC)
- 密码加密存储 (bcrypt + argon2)
- 登录状态管理

### 文件管理
- 文件上传 (支持本地和七牛云)
- 文件下载管理
- 文件类型验证
- 上传进度追踪

### 提示词管理
- 提示词模板管理
- 分类和标签系统
- 模板版本控制
- 快速检索功能

### 系统功能
- 菜单管理
- 操作日志记录
- 系统监控
- 错误处理

### 桌面应用特性
- 系统托盘集成
- 全局快捷键支持
- 文件系统访问
- 原生系统集成

## 📱 部署

### 开发环境

```bash
# 启动前端开发服务器
pnpm dev

# 启动后端开发服务器
pnpm server:dev
```

### 生产环境

```bash
# 构建前端应用
pnpm build

# 构建后端应用
pnpm server:build

# 启动生产环境服务
pnpm server:start:prod
```

### Docker 部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

## 🧪 测试

```bash
# 运行单元测试
pnpm -C server test

# 运行测试并生成覆盖率报告
pnpm -C server test:cov

# 运行端到端测试
pnpm -C server test:e2e
```

## 📝 代码规范

- 使用 TypeScript 进行类型安全开发
- 遵循 ESLint 和 Prettier 代码规范
- 使用 Conventional Commits 规范化提交信息
- 使用 Husky 进行 Git hooks 管理

## 🔧 配置说明

### 后端配置 (server/.env)
```env
NODE_ENV=development
PORT=9112
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=example
DB_DATABASE=dnhyxc_ai_db
JWT_SECRET=your-jwt-secret
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 前端配置
前端配置主要通过 Tauri 配置文件和 Vite 配置文件管理。

## 📊 项目状态

- ✅ 基础架构搭建完成
- ✅ 用户认证系统
- ✅ 文件上传功能
- ✅ 提示词管理
- ✅ 系统日志
- 🚧 桌面应用集成
- 🚧 更多 AI 功能集成

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👨‍💻 作者

- **dnhyxc** - *项目初始开发* - [dnhyxc](https://github.com/dnhyxc)

## 🙏 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [React](https://reactjs.org/) - 用户界面库
- [NestJS](https://nestjs.com/) - Node.js 服务端框架
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的 JavaScript