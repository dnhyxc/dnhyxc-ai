## dnhyxc-ci（SSH 部署）

该工具用于在 CI/本地通过 **SSH（安全外壳协议）** 将指定的 `dist.zip` 上传到服务器，并在远端执行：

- 上传 zip 到远端临时路径
- 解压到指定目录（可选清空旧目录）
- （可选）安装依赖（后端常见；默认不安装）
- （可选）`pm2 restart <name>` 重启服务
- （可选）重启/重载 nginx

### 安装/构建

在仓库根目录：

```bash
pnpm -C packages/ci build
```

### 配置文件

配置文件是 JSON，示例见 `packages/ci/examples/deploy.config.example.json`。

关键字段：

- `servers.<id>`：服务器连接信息（host/port/auth）
- `targets[]`：每个部署目标（本地 zip、远端目录、重启策略等）

认证（auth）二选一：

- `password`
- `privateKeyPath`（可配 `passphrase`）

### 使用

在仓库根目录执行：

```bash
pnpm -C packages/ci build
node packages/ci/dist/cli.js ssh:deploy -c packages/ci/examples/deploy.config.example.json
```

只部署某个 target：

```bash
node packages/ci/dist/cli.js ssh:deploy -c ./deploy.config.json --only backend-api
```

干跑（只打印命令，不执行）：

```bash
node packages/ci/dist/cli.js ssh:deploy -c ./deploy.config.json --dry-run
```

### 注意事项

- 远端需要 `unzip` 命令；如果没有，请在 `preCommands` 里安装（如 `sudo apt-get update && sudo apt-get install -y unzip`）。
- 如果 `nginxRestartCommand` 里用了 `sudo`，请自行确保免密 sudo 或改为可执行命令。
- `cleanRemoteDir=true` 会执行 `rm -rf <remoteDir>/*`，请谨慎。

