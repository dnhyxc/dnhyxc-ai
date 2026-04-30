## 后端 SSH 部署配置（apps/backend）

本目录用于配合 `packages/ci` 的 `dnhyxc-ci ssh:deploy` 命令，完成：

- 构建后端
- 打包 `dist.zip`
- SSH 上传到服务器并解压到指定目录
- 可选安装依赖（默认不安装）
- 可选 `pm2 restart <name>` 重启
- 可选重启/重载 nginx

### 快速开始

1) 复制示例配置：

```bash
cp apps/backend/ci/deploy.backend.example.json apps/backend/ci/deploy.backend.json
```

2) 修改 `apps/backend/ci/deploy.backend.json`：

- `servers.prod-1.host`：服务器 IP/域名
- `auth`：使用 `password` 或 `privateKeyPath` 二选一
- `targets[0].remoteDir`：远端部署目录
- `targets[0].pm2Name`：pm2 应用名（与你服务器上的进程一致）
- `installDeps`：后端是否需要在远端安装依赖（默认 false）
- `restartNginx`：是否重启/重载 nginx（默认 false）

3) 部署：

```bash
pnpm -C packages/ci build
pnpm -C apps/backend deploy:ssh
```

### 只部署（不打包）

你也可以直接调用 CLI：

```bash
node packages/ci/dist/cli.js ssh:deploy -c apps/backend/ci/deploy.backend.json
```

