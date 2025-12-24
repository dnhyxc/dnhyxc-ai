## nestjs 中文文档

[nestjs 中文文档](https://docs.nestjs.cn/introduction)

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

## TypeORM

[TypeORM](https://typeorm.bootcss.com/) 是一个ORM框架，它可以运行在 NodeJS、Browser、Cordova、PhoneGap、Ionic、React Native、Expo 和 Electron 平台上，可以与 TypeScript 和 JavaScript (ES5,ES6,ES7,ES8)一起使用。 它的目标是始终支持最新的 JavaScript 特性并提供额外的特性以帮助你开发任何使用数据库的（不管是只有几张表的小型应用还是拥有多数据库的大型企业应用）应用程序。

## @nestjs/typeorm

[@nestjs/typeorm](https://www.npmjs.com/package/@nestjs/typeorm) 是一个 Nest 的 TypeORM 模块。方便在 nestjs 中使用 TypeORM。

```ts
import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import { ConfigEnum } from "./enum/config.enum";

// 将 exports 中的模块注册为全局模块，在所有其他模块中都可以使用
@Global()
@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) =>
				({
					type: configService.get(ConfigEnum.DB_TYPE),
					host: configService.get(ConfigEnum.DB_HOST),
					port: configService.get(ConfigEnum.DB_PORT),
					username: configService.get(ConfigEnum.DB_USERNAME),
					password: configService.get(ConfigEnum.DB_PASSWORD),
					database: configService.get(ConfigEnum.DB_DATABASE),
					entities: [User, Profile, Roles, Logs],
					synchronize: configService.get(ConfigEnum.DB_SYNC),
					logging: ["error"],
				}) as TypeOrmModuleOptions,
		}),
	],
	controllers: [],
	providers: [],
	exports: [],
})
export class AppModule {}
```

## MySQL

[MySQL](https://hub.docker.com/_/mysql)

## 从已有的数据库中导入数据

这主要是通过 typeorm-model-generator 这个第三方库来实现的。

### [typeorm-model-generator](https://www.npmjs.com/package/typeorm-model-generator)

安装：

```bash
pnpm i typeorm-model-generator
```

配置运行脚本：

```json
"scripts": {
  "generator:models": "typeorm-model-generator -h 127.0.0.1 -d database -u root -p 3306 -x example -e mysql -o ./src/entities"
}
```

- 脚本参数说明：
  - `-h` 数据库地址
  - `-d` 数据库名称
  - `-p` 数据库启动的端口号
  - `-u` 数据库用户名
  - `-x` 数据库密码
  - `-e` 数据库类型
  - `-o` 模型生成目录

运行完 `generator:models` 命令之后，就会在 `./src/entities` 生成对应的模型文件了。

之后在 `app.module.ts` 中引入对应的模型即可：

```ts
TypeOrmModule.forRootAsync({
  // ...
	useFactory: (configService: ConfigService) =>
		({
      // ...
      // 导入刚刚生成的模型 User, Profile, Roles, Logs
			entities: [User, Profile, Roles, Logs]
      // ...
		}) as TypeOrmModuleOptions,
}),
```

## QueryBuilder

[QueryBuilder](https://typeorm.bootcss.com/select-query-builder) 是 TypeORM 最强大的功能之一，它允许你使用优雅便捷的语法构建 SQL 查询，执行并获得自动转换的实体。

简单示例：

```ts
const firstUser = await connection
	.getRepository(User)
	.createQueryBuilder("user")
	// "user.id = :id", { id: 1 } 这种做法，而不是使用字符串拼接的方式传参，是为了防止 SQL 注入攻击
	.where("user.id = :id", { id: 1 })
	.getOne();
```

上述代码会生成以下 SQL 语句：

```sql
SELECT
  user.id AS userId,
  user.firstName AS userFirstName,
  user.lastName AS userLastName,
FROM users user
WHERE user.id = 1
```

然后返回一个 `User` 实例：

```ts
User {
  id: 1,
  firstName: 'Dnh',
  lastName: 'Yxc',
}
```

## [class-validator](https://github.com/typestack/class-validator?tab=readme-ov-file#custom-validation-classes)

`class-validator` 是一个用于验证 JavaScript 对象的库。它允许你定义验证规则，并使用这些规则验证对象。

## [class-transformer](https://github.com/typestack/class-transformer)

基于装饰器的对象和类之间的转换、序列化和反序列化。

## [@nestjs/jwt](https://github.com/nestjs/jwt?tab=readme-ov-file#async-options)

## [@nestjs/passport](https://docs.nestjs.cn/recipes/passport)

将 Passport 与 NestJS 集成实现认证。

## 守卫

[守卫](https://docs.nestjs.cn/overview/guards)

守卫是一个用 @Injectable() 装饰器注解的类，它实现了 CanActivate 接口。

## [argon2](https://www.npmjs.com/package/argon2)

## [node-rs/argon2](https://www.npmjs.com/package/@node-rs/argon2)

使用 argon2 对密码加密

## [nestjs 拦截器](https://docs.nestjs.cn/overview/interceptors)

使用 nestjs 拦截器对不需要响应给前端的字段过滤掉。

## [使用序列化对响应给用户的字段进行过滤](https://docs.nestjs.cn/techniques/serialization)

通过在 entry.ts 文件中定义字段时，使用 @Exclude() 装饰器来修饰需要过滤的字段，同时在 controller.ts 文件中使用 @UseInterceptors(ClassSerializerInterceptor) 来对通过 @Expose() 修饰的字段进行过滤。之后响应给前端的数据就没有通过 @Exclude() 标记的字段了。
