## 创建模块

使用命令 `nest g MODULE_NAME FILE_NAME [--no-spec] [-d]` 创建模块。

```bash
# --no-spec 不创建测试文件文件，即 prompt.container.spec.ts 文件
# -d 只在终端中显示最终创建出来的文件路径，不会在项目中添加该文件
$ nest g container prompt --no-spec -d
```

创建 `prompt` module 模块：

```bash
$ nest g module prompt
```

执行完成之后就会在 `src` 目录下创建 `prompt` 目录，目录下包含 `prompt.module.ts` 文件。

创建 `prompt` controller 控制器：

```bash
$ nest g controller prompt
```

执行完成之后就会在 `src` 目录下创建 `prompt` 目录，目录下包含 `prompt.controller.ts` 文件。

创建 `prompt` service 服务：

```bash
$ nest g service prompt
```

执行完成之后就会在 `src` 目录下创建 `prompt` 目录，目录下包含 `prompt.service.ts` 文件。

## 日志配置

安装依赖：[nestjs-winston](https://www.npmjs.com/package/nest-winston)、[winston-daily-rotate-file](https://www.npmjs.com/package/winston-daily-rotate-file)

```bash
pnpm i winston nestjs-winston
pnpm i winston-daily-rotate-file
```

## docker 使用说明

### 停止并删除现有容器

```bash
# 停止并删除容器
docker-compose down -v

# 删除所有相关镜像和数据卷
docker system prune -a --volumes
```

### 创建数据目录和初始化脚本【可选】

```bash
# 确保本地目录权限
mkdir -p ./mysql_data
chmod 755 ./mysql_data

# 创建初始化SQL文件（可选）
cat > init.sql << EOF
-- 示例：创建初始数据库和用户
CREATE DATABASE IF NOT EXISTS myapp;
CREATE USER IF NOT EXISTS 'myuser'@'%' IDENTIFIED BY 'mypassword';
GRANT ALL PRIVILEGES ON myapp.* TO 'myuser'@'%';
FLUSH PRIVILEGES;
EOF
```

### 重新启动并初始化

```bash
# 拉取指定版本镜像
docker pull mysql:8.0

# 启动服务
docker-compose up -d

# 查看启动日志
docker-compose logs -f db

# 等待MySQL完全启动（约30秒），然后进入容器检查
docker exec -it mysql_db mysql -uroot -pexample -e "SHOW DATABASES;"
```

## docker 启动数据库配置

- docker-compose.yml

```yml
version: "3.8"

services:
  db:
    image: mysql:8.0 # 指定具体版本，避免使用 latest
    container_name: mysql_db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: example
      MYSQL_DATABASE: app_db # 添加默认数据库
    command:
      - --default-authentication-plugin=mysql_native_password
      - --innodb-buffer-pool-size=128M
      - --skip-name-resolve
    ports:
      - 3090:3306
    volumes:
      - mysql_data:/var/lib/mysql # 持久化数据
      # - ./init.sql:/docker-entrypoint-initdb.d/init.sql # 可选初始化脚本
    healthcheck:
      test:
        [
          "CMD",
          "mysqladmin",
          "ping",
          "-h",
          "localhost",
          "-u",
          "root",
          "-p$$MYSQL_ROOT_PASSWORD",
        ]
      timeout: 20s
      retries: 10

  adminer:
    image: adminer:latest
    restart: always
    ports:
      - 3091:8080
    depends_on:
      db:
        condition: service_healthy

volumes:
  mysql_data:
    driver: local
```

## MySQL

[MySQL](https://hub.docker.com/_/mysql)
