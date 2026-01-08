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

## 权鉴控制

使用 [@casl/ability](https://www.npmjs.com/package/@casl/ability) 库来实现权限控制。

[casl-ability 官网](https://casl.js.org/v5/en/api/casl-ability)

### 权鉴控制实现文件

权限控制服务 casl-ability.service.ts:

- /Users/dnhyxc/Documents/code/dnhyxc-ai/server/src/auth/casl-ability.service.ts

```ts
// 通过 casl/ability 来控制权限 Servives
import {
	AbilityBuilder,
	createMongoAbility,
	ExtractSubjectType,
	Subject,
} from "@casl/ability";
import { Injectable } from "@nestjs/common";
// import { Logs } from '../logs/logs.entity';
import { UserService } from "../user/user.service";
import { getEntities } from "../utils/common";

@Injectable()
export class CaslAbilityService {
	constructor(private userService: UserService) {}
	async forRoot(username: string) {
		const { can, build } = new AbilityBuilder(createMongoAbility);

		/**
		 * 控制权限的思路：
		 * 1. menu 名称、路径、acl -> actions -> 名称、路径 -> 实体对应
		 * path -> prefix -> 写死在项目代码里
		 *
		 * 2. acl -> 通过表来进行存储 -> LogController + Action
		 * log -> sys:log -> sys:log:read, sys:log:write
		 */

		// TODO：这里使用方式一，写死在项目中，后续进行优化，通过数据库表来存储
		const user = await this.userService.findByUsername(username);
		user?.roles.forEach((o) => {
			o.menus.forEach((menu) => {
				// path -> acl -> actions
				const actions = menu.acl.split(",");
				for (let i = 0; i < actions.length; i++) {
					const action = actions[i];
					can(action, getEntities(menu.path));
				}
			});
		});

		// user -> 1:n roles -> 1:n menus -> 去重 {}
		// can('read', Logs);
		// can('update', Logs);
		// can('manage', 'all');

		const ability = build({
			detectSubjectType: (object) =>
				object.constructor as ExtractSubjectType<Subject>,
		});

		return ability;
	}
}
```

权限控制自定义装饰器 casl.decorator.ts:

- /Users/dnhyxc/Documents/code/dnhyxc-ai/server/src/decorators/casl.decorator.ts

```ts
// 权限控制自定义装饰器
import { AnyMongoAbility, InferSubjects } from "@casl/ability";
import { SetMetadata } from "@nestjs/common";
import { Action } from "../enum/action.enum";

/**
 * 用于在 NestJS 路由处理器上挂载权限元数据的键名枚举。
 * 守卫（Guard）通过反射读取这些键，拿到对应的策略回调并执行。
 */
export enum CHECK_POLICIES_KEY {
	/** 对应 @CheckPolicies 装饰器，可放置任意自定义策略回调 */
	HANDLER = "CHECK_POLICIES_HANDLER",
	/** 对应 @Can 装饰器，内部调用 ability.can() */
	CAN = "CHECK_POLICIES_CAN",
	/** 对应 @Cannot 装饰器，内部调用 ability.cannot() */
	CANNOT = "CHECK_POLICIES_CANNOT",
}

/**
 * 策略回调类型：接收 CASL 的 Ability 实例，返回 true 表示通过，false 表示拒绝。
 */
export type PolicyHandlerCallback = (ability: AnyMongoAbility) => boolean;

/**
 * 允许单个回调或回调数组，方便装饰器参数灵活书写。
 */
export type CaslHandlerType = PolicyHandlerCallback | PolicyHandlerCallback[];

/**
 * 将一组自定义策略回调挂载到路由元数据上。
 * 守卫通过 CHECK_POLICIES_KEY.HANDLER 取出这些回调并依次执行。
 *
 * @example
 * \@CheckPolicies((ability) => ability.can(Action.Read, 'Article'))
 * async findAll() { ... }
 */
export const CheckPolicies = (...handlers: PolicyHandlerCallback[]) =>
	SetMetadata(CHECK_POLICIES_KEY.HANDLER, handlers);

/**
 * 快速声明“允许”某操作的装饰器，底层调用 ability.can(action, subject, conditions)。
 * 守卫通过 CHECK_POLICIES_KEY.CAN 取出该回调并执行。
 *
 * @param action     动作枚举，如 Action.Read
 * @param subject    主体（资源）类型或对象
 * @param conditions 可选的额外条件，对应 CASL 条件对象
 *
 * @example
 * \@Can(Action.Update, Article)
 * async update(\@Body() dto) { ... }
 */
export const Can = (
	action: Action,
	subject: InferSubjects<any>,
	conditions?: any
) =>
	SetMetadata(CHECK_POLICIES_KEY.CAN, (ability: AnyMongoAbility) =>
		ability.can(action, subject, conditions)
	);

/**
 * 快速声明“禁止”某操作的装饰器，底层调用 ability.cannot(action, subject, conditions)。
 * 守卫通过 CHECK_POLICIES_KEY.CANNOT 取出该回调并执行。
 *
 * @param action     动作枚举，如 Action.Delete
 * @param subject    主体（资源）类型或对象
 * @param conditions 可选的额外条件，对应 CASL 条件对象
 *
 * @example
 * \@Cannot(Action.Delete, Article, { status: 'published' })
 * async remove() { ... }
 */
export const Cannot = (
	action: Action,
	subject: InferSubjects<any>,
	conditions?: any
) =>
	SetMetadata(CHECK_POLICIES_KEY.CANNOT, (ability: AnyMongoAbility) =>
		ability.cannot(action, subject, conditions)
	);
```

权限控制守卫 casl.guard.ts:

- /Users/dnhyxc/Documents/code/dnhyxc-ai/server/src/guards/casl.guard.ts

```ts
// 通过 casl/ability 来控制权限的守卫
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CaslAbilityService } from "../auth/casl-ability.service";
import {
	CaslHandlerType,
	CHECK_POLICIES_KEY,
	PolicyHandlerCallback,
} from "../decorators/casl.decorator";

/**
 * 如果需要控制权限，需要在每个 Controller 方法上添加 @UseGuards(CaslGuard) 装饰器，
 * 并且还需要在对应的接口之上中添加 @Can(Action.XXX, Logs 或 User 或 Menus 或 Roles 或 'Auth'（因为 Auth 没有 entity.ts 文件，没法导入 Auth，因此只能传字符串 'Auth'）])
 */
@Injectable()
export class CaslGuard implements CanActivate {
	constructor(
		private reflector: Reflector,
		private caslAbilityService: CaslAbilityService
	) {}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const handlers = this.reflector.getAllAndMerge<PolicyHandlerCallback[]>(
			CHECK_POLICIES_KEY.HANDLER,
			[
				context.getHandler(), // 当前路由的处理函数（如 @Get() 修饰的方法）
				context.getClass(), // 当前路由所属的控制器类
			]
		);
		const canHandlers = this.reflector.getAllAndMerge<PolicyHandlerCallback[]>(
			CHECK_POLICIES_KEY.CAN,
			[
				context.getHandler(), // 当前路由的处理函数（如 @Get() 修饰的方法）
				context.getClass(), // 当前路由所属的控制器类
			]
		) as CaslHandlerType;
		const cannotHandlers = this.reflector.getAllAndMerge<
			PolicyHandlerCallback[]
		>(CHECK_POLICIES_KEY.CANNOT, [
			context.getHandler(), // 当前路由的处理函数（如 @Get() 修饰的方法）
			context.getClass(), // 当前路由所属的控制器类
		]) as CaslHandlerType;

		// 判断用户未设置上述的任何一个，那么直接返回 true
		if (!handlers || !canHandlers || !cannotHandlers) {
			return true;
		}

		const req = context.switchToHttp().getRequest();

		if (req?.user) {
			// 获取当前用户权限
			const ability = await this.caslAbilityService.forRoot(
				req?.user?.username
			);

			let flag = true;

			if (handlers) {
				flag = flag && handlers.every((handler) => handler(ability));
			}

			if (canHandlers) {
				if (Array.isArray(canHandlers)) {
					flag = flag && canHandlers.every((handler) => handler(ability));
				} else if (typeof canHandlers === "function") {
					flag = flag && canHandlers(ability);
				}
			}

			if (cannotHandlers) {
				if (Array.isArray(cannotHandlers)) {
					flag = flag && cannotHandlers.every((handler) => handler(ability));
				} else if (typeof cannotHandlers === "function") {
					flag = flag && cannotHandlers(ability);
				}
			}
			return flag;
		} else {
			return false;
		}
	}
}
```

common.ts:

- /Users/dnhyxc/Documents/code/dnhyxc-ai/server/src/utils/common.ts

```ts
import { Logs } from "src/logs/logs.entity";
import { Menus } from "src/menus/menus.entity";
import { Roles } from "src/roles/roles.entity";
import { User } from "src/user/user.entity";

// 获取对应有权限的实体，用于在 casl-ability.service.ts 中方便 casl/ability 使用来控制权限
export const getEntities = (path: string) => {
	// users -> User, /logs -> Logs, /menus -> Menus, /roles -> Roles, /auth -> 'Auth'
	const map = {
		"/user": User,
		"/logs": Logs,
		"/roles": Roles,
		"/menus": Menus,
		"/auth": "Auth",
	};

	for (let i = 0; i < Object.keys(map).length; i++) {
		const key = Object.keys(map)[i];
		if (path.startsWith(key)) {
			return map[key];
		}
	}
};
```

### 使用方式

logs.controller.ts:

- server/src/logs/logs.controller.ts

```ts
import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Expose } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";
import { Can, CheckPolicies } from "../decorators/casl.decorator";
import { Serialize } from "../decorators/serialize.decorator";
import { Action } from "../enum/action.enum";
import { AdminGuard } from "../guards/admin.guard";
import { CaslGuard } from "../guards/casl.guard";
import { JwtGuard } from "../guards/jwt.guard";
import { Logs } from "./logs.entity";

class LogsDto {
	@IsString()
	@IsNotEmpty()
	msg: string;

	@IsString()
	id: string;

	@IsString()
	name: string;
}

class PublicLogsDto {
	@Expose()
	msg: string;
	@Expose()
	name: string;
}

@Controller("logs")
// UseGuards 用于在控制器或路由处理器级别注册守卫（Guards），守卫会在请求到达控制器方法之前执行，以决定是否允许继续处理请求。
// 守卫的执行顺序为从左到右：JwtGuard -> AdminGuard -> CaslGuard。
// JwtGuard：验证请求是否携带有效的 JWT 访问令牌，确保用户已登录。
// AdminGuard：检查当前用户是否具备管理员身份，只有管理员才能继续访问。
// CaslGuard：基于 CASL 权限策略，检查用户是否拥有对目标资源（这里是 Logs）执行特定操作的权限。
// 只有当所有守卫都通过时，请求才会被放行到控制器方法。
@UseGuards(JwtGuard, AdminGuard, CaslGuard)
/*
  CheckPolicies 是一个自定义装饰器，用来在**控制器类或路由方法**上声明“需要满足哪些 CASL 权限策略才能访问”。
  1. 它接收一个回调函数 `(ability) => boolean` 作为参数；
     - `ability` 是 CASL 根据当前登录用户动态创建的 Ability 实例，里面已挂载该用户拥有的全部权限规则。
  2. 当请求进入时，CaslGuard 会：
     a) 解析 `@CheckPolicies` 给出的回调；
     b) 把 `ability` 传进去执行；
     c) 若返回 `true` 则放行，返回 `false` 则抛出 `ForbiddenException`，前端收到 403。
  3. 因此本行代码的含义是：
     “只有当当前用户对 Logs 实体拥有 READ 权限时，才允许访问整个 LogsController 里的所有路由。”
  4. 如果只想对单个路由生效，把 `@CheckPolicies` 写到具体的方法上即可；
     多个策略可用 `&&`、`||` 组合，也可多次调用 `ability.can` / `ability.cannot`。
*/
@CheckPolicies((ability) => ability.can(Action.READ, Logs))
// 使用 Can 自定义装饰器
@Can(Action.READ, Logs)
export class LogsController {
	@Get("/getLogs")
	@Can(Action.READ, Logs)
	getLogs() {
		return "get logs";
	}

	@Post("/addLogs")
	// @Cannot(Action.CREATE, Logs)
	@Can(Action.CREATE, Logs)
	// 添加 SerializeInterceptor 后置拦截器对响应字段进行序列化
	// @UseInterceptors(new SerializeInterceptor(PublicLogsDto))
	// 使用自定义的 Serialize 系列化装饰器对响应字段进行序列化
	@Serialize(PublicLogsDto)
	addLogs(@Body() dto: LogsDto) {
		return dto;
	}
}
```

## 集成 Redis

[@keyv/redis](https://github.com/jaredwray/keyv/tree/main/packages/redis#using-with-nestjs)

[@nestjs/cache-manager cache-manager](https://docs.nestjs.com/techniques/caching)

```bash
pnpm install --save keyv @keyv/redis

pnpm i @nestjs/cache-manager cache-manager

pnpm i @keyv/redis keyv @nestjs/cache-manager cache-manager cacheable
```

## CentOs 安装 Redis

参考：

- [CentOS下Redis简洁安装（无坑版](https://cloud.tencent.com/developer/article/2346429)

- [Redis（一）Centos7.6安装Redis服务](https://developer.aliyun.com/article/897019)

## 本地连接

```ts
import { createClient } from "redis";

const client = createClient({
	username: "default",
	password: "Jgj0WUDmD1XNaItbvTCDaKocHopeqoT4",
	socket: {
		host: "redis-18382.c238.us-central1-2.gce.cloud.redislabs.com",
		port: 18382,
	},
});

client.on("error", (err) => console.log("Redis Client Error", err));

await client.connect();

await client.set("foo", "bar");
const result = await client.get("foo");
console.log(result); // >>> bar
```

## Redis 环境变量设置问题

执行 `source .bash_profile` 时报错：

> manpath: can't set the locale; make sure $LC\_\* and $LANG are correct

解决方式，执行如下命令：

```bash
sudo yum install -y glibc-common
sudo localedef -v -c -i en_US -f UTF-8 en_US.UTF-8
source ~/.bash_profile
```

具体解决参考：

[deepseek-环境变量处理](https://chat.deepseek.com/a/chat/s/eeeace28-a831-49a4-826d-53e1c468cb3e)

### 执行 `./install_server.sh` 后提示

```
Welcome to the redis service installer
This script will help you easily set up a running redis server

Please select the redis port for this instance: [6379] 12029
Please select the redis config file name [/etc/redis/12029.conf]
Selected default - /etc/redis/12029.conf
Please select the redis log file name [/var/log/redis_12029.log]
Selected default - /var/log/redis_12029.log
Please select the data directory for this instance [/var/lib/redis/12029]
Selected default - /var/lib/redis/12029
Please select the redis executable path [/usr/local/redis//bin/redis-server]
Selected config:
Port           : 12029
Config file    : /etc/redis/12029.conf
Log file       : /var/log/redis_12029.log
Data dir       : /var/lib/redis/12029
Executable     : /usr/local/redis//bin/redis-server
Cli Executable : /usr/local/redis//bin/redis-cli
Is this ok? Then press ENTER to go on or Ctrl-C to abort.
Copied /tmp/12029.conf => /etc/init.d/redis_12029
Installing service...
Successfully added to chkconfig!
Successfully added to runlevels 345!
Starting Redis server...
Installation successful!
```

### 启动 Redis

```bash
ps -ef | grep redis
```

启动过后提示：

```
root     15307     1  0 20:50 ?        00:00:00 /usr/local/redis/bin/redis-server 127.0.0.1:12029
root     21505 10337  0 20:53 pts/0    00:00:00 grep --color=auto redis
```

看到上述的提示，说明 Redis 已经成功启动了，启动在 12029 端口上。

### 运行 redis-cli

运行 redis-cli 命令，进入 Redis 的命令行模式：

```bash
# 指定端口，因为默认端口是 6379，我们设置的端口号是 12029
redis-cli -p 12029
```

## Redis 实现验证码校验

[deepseek](https://chat.deepseek.com/a/chat/s/024b9e19-7c4c-4b20-8689-8babb2a6d894)

[案例视频](https://www.bilibili.com/video/BV1Sa27B7EKE/?spm_id_from=333.337.search-card.all.click&vd_source=048c1562000d83337f08ff7451ab1f76)

```ts
// auth.service.ts
import { ForbiddenException, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import * as svgCaptcha from "svg-captcha";
import { UserService } from "../user/user.service";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { randomUUID } from "crypto";

@Injectable()
export class AuthService {
	// Redis key 前缀
	private readonly CAPTCHA_PREFIX = "captcha:";

	constructor(
		private readonly userService: UserService,
		private jwt: JwtService,
		@InjectRedis() private readonly redis: Redis
	) {}

	/**
	 * 生成验证码
	 */
	async generateCaptcha() {
		const captcha = svgCaptcha.create({
			size: 4,
			fontSize: 32,
			width: 100,
			height: 36,
			background: "#cc9966",
		});

		// 生成唯一 captchaId
		const captchaId = randomUUID();

		// 将验证码文本存储到 Redis，设置5分钟过期
		const key = `${this.CAPTCHA_PREFIX}${captchaId}`;
		await this.redis.setex(key, 300, captcha.text.toLowerCase()); // 5分钟过期

		// 返回 captchaId 和图片数据
		return {
			captchaId,
			data: captcha.data, // SVG 图片数据
			// 或者返回 base64 格式
			// base64: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`
		};
	}

	/**
	 * 验证验证码
	 */
	async verifyCaptcha(
		captchaId: string,
		captchaText: string
	): Promise<boolean> {
		if (!captchaId || !captchaText) {
			return false;
		}

		const key = `${this.CAPTCHA_PREFIX}${captchaId}`;

		// 从 Redis 获取验证码
		const storedCaptcha = await this.redis.get(key);

		// 验证后删除验证码（防止重复使用）
		await this.redis.del(key);

		if (!storedCaptcha) {
			return false; // 验证码已过期或不存在
		}

		// 比较验证码（不区分大小写）
		return storedCaptcha.toLowerCase() === captchaText.toLowerCase();
	}

	/**
	 * 登录接口（带验证码校验）
	 */
	async login(
		username: string,
		password: string,
		captchaId: string,
		captchaText: string
	) {
		// 1. 先验证验证码
		const isCaptchaValid = await this.verifyCaptcha(captchaId, captchaText);
		if (!isCaptchaValid) {
			throw new ForbiddenException("验证码错误或已过期");
		}

		// 2. 验证用户
		const user = await this.userService.findByUsername(username);
		if (!user) {
			throw new ForbiddenException("用户不存在，请先前往注册");
		}

		// 3. 验证密码
		const isPasswordValid = await argon2.verify(user.password, password);
		if (!isPasswordValid) {
			throw new ForbiddenException("用户名或密码错误");
		}

		// 4. 生成 JWT token
		const token = await this.jwt.signAsync({
			username: user.username,
			sub: user.id,
		});

		return {
			token,
			user: {
				id: user.id,
				username: user.username,
			},
		};
	}

	/**
	 * 登录接口（保持原有兼容，可选）
	 */
	async loginWithoutCaptcha(username: string, password: string) {
		const user = await this.userService.findByUsername(username);
		if (!user) {
			throw new ForbiddenException("用户不存在，请先前往注册");
		}

		const isPasswordValid = await argon2.verify(user.password, password);
		if (isPasswordValid) {
			return await this.jwt.signAsync({
				username: user.username,
				sub: user.id,
			});
		} else {
			throw new ForbiddenException("用户名或密码错误");
		}
	}

	/**
	 * 注册接口（可以加上验证码校验）
	 */
	async register(
		username: string,
		password: string,
		captchaId?: string,
		captchaText?: string
	) {
		// 如果需要验证码校验
		if (captchaId && captchaText) {
			const isCaptchaValid = await this.verifyCaptcha(captchaId, captchaText);
			if (!isCaptchaValid) {
				throw new ForbiddenException("验证码错误或已过期");
			}
		}

		const user = await this.userService.findByUsername(username);
		if (user) {
			throw new ForbiddenException("用户已存在");
		} else {
			return await this.userService.create({
				username,
				password,
			});
		}
	}
}
```

## 密码脱敏处理

[参考](https://juejin.cn/post/7306780139744182323)：https://juejin.cn/post/7306780139744182323

## 生成接口文档

需要安装 [swagger-ui-express](https://www.npmjs.com/package/swagger-ui-express)、[@nestjs/swagger](https://www.npmjs.com/package/@nestjs/swagger)

[使用参考视频](https://www.bilibili.com/video/BV1NG41187Bs?spm_id_from=333.788.player.switch&vd_source=048c1562000d83337f08ff7451ab1f76&p=23)

## 接入邮件服务

使用的库：

[@nestjs-modules/mailer](https://www.npmjs.com/package/@nestjs-modules/mailer)

[mailer](https://nest-modules.github.io/mailer/docs/mailer.html)

### QQ 邮箱服务

[QQ 邮箱服务](https://wx.mail.qq.com/account/index?sid=zfxkMozHYVUuKEVSADdGZAAA#/?tab=safety&r=1767434868588)

找到“账号与安全” -> 安全设置 -> “POP3/IMAP/SMTP/Exchange/CardDAV 服务”, 开启服务，获取到授权码（pass）：`dnjqczdqtbofbdgd`。

### 拷贝邮件模版到 dist 目录

不拷贝文件到dist 目录，会导致在 `mail.module.ts` 中 `MailerModule.forRoot()` 配置项中的 `template` 下的 `dir` 无法正确找到模版，因此需要修改 `nest-cli.json` 中的 `assets` 配置项，将 `mail/templates/**/*.hbs` 拷贝到 `dist/src/auth/templates` 目录下。

```json
{
	"$schema": "https://json.schemastore.org/nest-cli",
	"collection": "@nestjs/schematics",
	"sourceRoot": "src",
	"compilerOptions": {
		"deleteOutDir": true,
		"watchAssets": true,
		"assets": [
			{
				"include": "mail/templates/**/*.hbs",
				"outDir": "dist/src"
			}
		]
	}
}
```

## 后端项目部署

打包项目生成 dist 文件，如果需要安装新包，需要将 `dist.zip` 和 `package.json` 文件上传到服务器的 `/usr/local/dnhyxc-ai/server` 目录下。

如果需要更新 docker 配置，需要将 `docker-compose.yml` 文件上传到服务器的 `/usr/local/dnhyxc-ai/mysql` 目录下。

如果 `.evn` 和 `.env.production` 内容有更新，需要将它们也上传到服务器的 `/usr/local/dnhyxc-ai/server` 目录下，或者在服务器上手动修改，建议手动修改。

只有运行 `pm2 start npm --name server -- run start:prod` 启动服务器。

## 部署

### 安装 [nvm](https://github.com/nvm-sh/nvm)

在服务器中执行如下命令进行安装：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# 或
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

设置 nvm 环境变量：将如下命令移动到 `.bashrc` 文件中：

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" # This loads nvm bash_completion
```

设置完成之后，执行 `source ~/.bashrc` 让配置生效。

### 安装 node

使用 `nvm` 安装 node：

```bash
nvm install node@16.14.2

node -v
```

### 安装 nrm

这一步可以忽略，根据自己的网络，带宽进行选择，如果网速快就不需要安装 nrm 去切换源了。

```bash
npm install -g nrm

nrm --version
```

### 安装 pnpm

```bash
npm install -g pnpm

pnpm --version
```

### 安装 [pm2](https://pm2.keymetrics.io/docs/usage/quick-start/)

```bash
npm install -g pm2

pm2 --version
```

### 安装 docker

在服务器任意目录执行如下命令进行安装：

```bash
curl -fsSL https://get.docker.com | bash -s docker

docker --version
```

### 安装 docker-compose

可通过 [github docker](https://github.com/docker/compose/releases) 查看具体版本，之后通过如下命令进行安装：

```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

sudo chmod +x /usr/local/bin/docker-compose

docker-compose --version
```

可参考：[菜鸟教程](https://www.runoob.com/docker/docker-compose.html)。

### 创建数据库

在服务器 `/usr/local/dnhyxc-ai/mysql` 目录下创建 `docker-compose.yml` 文件，内容如下：

```yml
services:
  db:
    image: mysql:8.0 # 指定具体版本，避免使用 latest
    # container_name: mysql_db # dnhyxc_db
    container_name: dnhyxc_ai_db # dnhyxc_db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: dnh@902209
      MYSQL_DATABASE: dnhyxc_ai_db # 添加默认数据库
    command:
      - --default-authentication-plugin=mysql_native_password
      - --innodb-buffer-pool-size=128M
      - --skip-name-resolve
    ports:
      - 12009:3306
    volumes:
      - /dnhyxc-ai/mysql/db:/var/lib/mysql # 持久化数据
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

  db1:
    image: mysql:8.0 # 指定具体版本，避免使用 latest
    # container_name: mysql_db # dnhyxc_db
    container_name: dnhyxc_ai_db_1 # dnhyxc_db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: dnh@902209
      MYSQL_DATABASE: dnhyxc_ai_db # 添加默认数据库
    command:
      - --default-authentication-plugin=mysql_native_password
      - --innodb-buffer-pool-size=128M
      - --skip-name-resolve
    ports:
      - 12006:3306
    volumes:
      - /dnhyxc-ai/mysql/db1:/var/lib/mysql # 持久化数据
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
      - 12011:8080 # dev 3091:8080
    depends_on:
      db:
        condition: service_healthy
```

之后在当前目录下执行 `docker-compose up -d` 创建数据库容器。

创建成功后，可以通过 `docker ps` 命令查看容器状态。

### 安装 Redis

[redis 版本列表](https://download.redis.io/releases/)。

可以在上述列表中选择一个版本（redis-7.4.7.tar.gz ），并下载到本地的桌面目录。之后上传到服务器上的 `/usr/local` 目录下。之后在 `/usr/local` 目录下执行 `tar -zxvf redis-7.4.7.tar.gz` 解压。

```bash
# 从本地 /Users/dnhyxc/Desktop 目录下上传 redis-7.4.7.tar.gz 到服务器 /usr/local 目录下
scp /Users/dnhyxc/Desktop/redis-7.4.7.tar.gz root@101.29.209.188:/usr/local

cd /usr/local

# 解压 redis-7.4.7.tar.gz
tar -zxvf redis-7.4.7.tar.gz
```

之后进入 `/usr/local/redis-7.4.7` 目录下对 redis 进行编译：

```bash
cd /usr/local/redis-7.4.7

# 编译 redis 并指定安装到 /usr/local/redis
make && make PREFIX=/usr/local/redis install
```

安装完成之后进入 `/usr/local/redis/bin` 目录下，查看对应的文件列表：

```bash
cd /usr/local/redis/bin

ls
```

如果 `bin` 目录下没有以下文件，则需要从 `/usr/local/redis-7.4.7/src` 目录下复制以下文件到 `/usr/local/redis/bin` 目录下：

bin 目录下完全的文件列表：

```bash
-rwxr-xr-x 1 root root      903 Dec 27 20:04 mkreleasehdr.sh
-rwxr-xr-x 1 root root  6830832 Dec 27 20:00 redis-benchmark
lrwxrwxrwx 1 root root       12 Dec 27 20:00 redis-check-aof -> redis-server
lrwxrwxrwx 1 root root       12 Dec 27 20:00 redis-check-rdb -> redis-server
-rwxr-xr-x 1 root root  7804057 Dec 27 20:56 redis-cli
lrwxrwxrwx 1 root root       12 Dec 27 20:00 redis-sentinel -> redis-server
-rwxr-xr-x 1 root root 16198936 Dec 27 20:00 redis-server
```

如果缺少可以执行如下命令从 `/usr/local/redis-7.4.7/src` 中拷贝：

```bash
cd /usr/local/redis-7.4.7/src

cp mkreleasehdr.sh /usr/local/redis/bin
cp redis-check-aof /usr/local/redis/bin
cp redis-check-rdb /usr/local/redis/bin
cp redis-sentinel /usr/local/redis/bin
```

之后进入 `/usr/local/redis` 目录下，创建一个 `etc` 目录。

```bash
mkdir -p /usr/local/redis/etc

# 进入到 /usr/local/redis 目录下
cd /usr/local/redis
mkdir etc
```

etc 文件夹创建完成之后，进入到 `/usr/local/redis-7.4.7` 文件夹下拷贝 `redis.conf` 文件到 `/usr/local/redis/etc` 文件夹下。

```bash
cd /usr/local/redis-7.4.7

cp redis.conf /usr/local/redis/etc
```

之后进入 `/usr/local/redis/etc` 文件夹下，编辑 `redis.conf` 文件，修改该配置文件，大概在 **310 行** 左右，将 **daemonize** 由 **no** 修改为 **yes**。daemonize 表示是否以守护进程的方式启动 Redis 服务器。

```bash
cd /usr/local/redis/etc

vi +310 redis.conf

# 显示行号
set nu
```

修改完成之后，就需要配置 redis 的环境变量了，通过 `vi ~/.bash_profile` 命令进行设置。

```bash
vi ~/.bash_profile
```

在 ~/.bash_profile 文件最后添加如下内容：

```bash
# REDIS
export REDIS_HOME=/usr/local/redis/

PATH=$PATH:$HOME/bin:$REDIS_HOME/bin
```

配置完成之后，运行 `source ~/.bash_profile` 命令，使配置生效。

如果执行 `source .bash_profile` 时报错：

> manpath: can't set the locale; make sure $LC\_\* and $LANG are correct

解决方式，执行如下命令：

```bash
sudo yum install -y glibc-common
sudo localedef -v -c -i en_US -f UTF-8 en_US.UTF-8
source ~/.bash_profile
```

具体解决参考：

[deepseek-环境变量处理](https://chat.deepseek.com/a/chat/s/eeeace28-a831-49a4-826d-53e1c468cb3e)

上述操作处理完成之后，再进入 `/usr/local/redis-7.4.7/utils` 目录下执行 `./install_server.sh` 文件。

但是在执行之前，需要修改 `./install_server.sh` 文件的第 77 行到 84行的代码注释掉，防止执行报错。

```bash
vi +77 install_server.sh
```

需要注释的内容为：

```sh
_pip_1_exe="$(readlink -f /proc/1/exe)"
if [ "${_pip_1_exe##*/}" = systemd ]
then
	echo "This systems seems to use systemd."
	echo "Please take a look at the provided example service unit files in this directory, and adapt and install them, Sorry!"
	exit 1
fi
unset _pip_1_exe
```

注释完成之后再运行 `install_server.sh` 脚本，通过 `./install_server.sh` 这个服务脚本的安装，可以保证 redis 随着系统的启动而启动，即使系统重启也会帮助我们启动 redis 服务。

```bash
./install_server.sh
```

运行过后，按照指引进行安装即可，直接使用默认的，直接回车即可，如果不想要默认的端口号，可以输入其他端口（12029）。

如果修改了端口号，那么就需要将 `redis.conf` 文件中的 `port 6379` 修改为 `port 你在上述步骤中设置的端口号（12029）`。

修改完成之后运行 `ps -ef | grep redis` 命令查看 `redis` 是否启动成功。

```bash
ps -ef | grep redis
```

运行过后，如果看到如下提示，说明 redis 就启动成功了。

```
root     15307     1  0 20:50 ?        00:00:00 /usr/local/redis/bin/redis-server 127.0.0.1:12029
root     21505 10337  0 20:53 pts/0    00:00:00 grep --color=auto redis
```

之后可以通过 `redis-cli` 命令进行测试。

```bash
cd /usr/local/redis/bin

redis-cli -p 12029

set test "hello world"

get test
```

如果上述 `get test` 命令返回结果为 `"hello world"`，则说明 redis 配置已经成功了。

如果想要关闭 redis，可以使用 `redis-cli` 连接服务器之后输入 `SHUTDOWN` 命令进行关闭。或者通过进程 id 运行 `kill -9 15307` 命令进行关闭。

### 防火墙设置

防火墙设置使用 `firewall-cmd` 命令进行设置。

```bash
# 添加 12009 端口
firewall-cmd --zone=public --add-port=12009/tcp --permanent

# 添加 12006 端口
firewall-cmd --zone=public --add-port=12006/tcp --permanent

# 添加 12011 端口
firewall-cmd --zone=public --add-port=12011/tcp --permanent

# 添加 9112 端口
firewall-cmd --zone=public --add-port=9112/tcp --permanent

# 重新加载防火墙
firewall-cmd --reload

# 查看防火墙配置
firewall-cmd --list-all

# 查看所有开放端口
firewall-cmd --list-ports

# 查看所有允许的服务
firewall-cmd --list-services

# 查看防火墙状态
firewall-cmd --state

# 查看防火墙命令
firewall-cmd --help

# 查看最近 100 条日志
journalctl -u firewalld -n 100
```

之后在浏览器中访问 `http://你的服务器IP:12011` 看是否能访问 `adminer` 界面，成功访问就说明配置成功了，即可通过 `docker-compose.yml` 中设置的 `mysql` 账号和密码登录数据库了，如果忘记了可以通过 `cat docker-compose.yml` 查看该文件中设置的密码。

### 打包 nest 项目

使用命令 `pnpm build` 打包 nest 项目。之后在服务器 `/usr/local` 目录下创建一个存放 nest 项目的文件夹，这里以 `dnhyxc-ai/server` 为例，之后将打包好的 `dist` 目录压缩成 `dist.zip` 之后，通过在 mac 端通过 `scp /Users/dnhyxc/Documents/code/dnhyxc-ai/dist.zip root@101.29.209.188:/usr/local/dnhyxc-ai/server`。注意：上传文件时不能先登录服务器，要在没有登录的状态下上传文件。如果是 windows，可以使用 xshell 上传文件，或者使用 git 的终端进行上传。

上传完成中后，就可以在服务器目录 `/usr/local/dnhyxc-ai/server` 下使用 `unzip dist.zip` 来解压文件。

```bash
# 在服务器上创建 dnhyxc-ai/server 文件夹

cd /usr/local

mkdir dnhyxc-ai

cd dnhyxc-ai

mkdir server

pnpm build

压缩 dist 文件

scp /Users/dnhyxc/Documents/code/dnhyxc-ai/dist.zip root@101.29.209.188:/usr/local/dnhyxc-ai/server

unzip dist.zip
```

之后将项目中的 `package.json` 文件也上传到服务器中的 `dnhyxc-ai/server` 文件目录下，方便安装响应的依赖：

```bash
scp /Users/dnhyxc/Documents/code/dnhyxc-ai/package.json root@101.29.209.188:/usr/local/dnhyxc-ai/server
```

package.json 文件上传完成后，在服务器 `/user/local/dnhyxc-ai/server` 目录下执行以下命令安装项目所需的 `dependencies` 依赖：

```bash
# -P 只会安装 dependencies 依赖
pnpm install -P
```

之后在服务器 `/user/local/dnhyxc-ai/server` 目录下分别创建 `.env` 和 `.env.production` 文件。并写入对应的环境变量，因为 env 文件默认是隐藏的，如果想要显示，可以使用 `ls -a` 命令。

```bash
touch .env

touch .env.production
```

在 `.env` 文件中写入：

```bash
# 数据库
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_USER=root
DB_USERNAME=root
DB_PASSWORD=example
DB_DATABASE=dnhyxc_ai_db
DB_SYNC=false
DB_PORT=3090

# 数据库2
DB_DB1_PORT=3092
DB_DB1_NAME=db1
DB_DB1_SYNC=true

# 日志
LOG_ON=true
LOG_LEVEL=info

# 文件存储路径
FILE_ROOT=../../uploads

# 邮件服务 dnjqczdqtbofbdgd 授权码
EMAIL_TRANSPORT=smtps://925419516@qq.com:dnjqczdqtbofbdgd@smtp.qq.com
EMAIL_FROM=925419516@qq.com
```

在 `.env.production` 文件中写入：

```bash
# 数据库
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_USER=root
DB_USERNAME=root
DB_PASSWORD=dnh@902209
DB_DATABASE=dnhyxc_ai_db
# 初始化环境时设置为 true，省的使用 typeorm cli 进行同步
DB_SYNC=false
DB_PORT=12009
DB_DB1_PORT=12006
DB_DB1_NAME=db1
DB_DB1_SYNC=true

# 日志
LOG_ON=true
LOG_LEVEL=info

# JWT SECRET
SECRET="wO4lVKu2MkW4viddIlLUsJXjyaS36VbXxlHKQSlrboDa7J0NQewZtXkSrfnBGFiY"

# Redis
REDIS_URL='redis://127.0.0.1:12029'

# qiniu
ACCESS_KEY=G4wtUYvoOUDeS0YdYIUqbV-DH3oe8hhjQiBqaG9E
SECRET_KEY=YvrcD2RzNuClVawTXQ7DzqdZuMI4J5WW_urejemn
BUCKET_NAME=dnhyxc-ai
DOMAIN=http://t80w8cw4d.hd-bkt.clouddn.com/
```

上述操作都完成之后，就可以在 `server` 目录下运行 `node run start:prod` 命令尝试启动服务了。如果没有任何报错，那最好不过，如果有报错，则根据报错内容解决错误即可。没有报错之后，就可以使用 `pm2` 来启动服务了。

在服务器 `/usr/local/dnhyxc-ai/server` 目录下运行如下命令来启动服务：

```bash
# 启动服务
pm2 start npm --name server -- run start:prod

# 查看服务列表
pm2 list

# 停止服务
pm2 delete 服务ID（如 0）

# 查看最近 100 行日志
pm2 logs server 100
```

项目启动成功之后，可以运行 `pm2 save` 来保存当前配置，之后可以使用 `pm2 startup` 来将我们的项目添加到系统级别的启动进程中了。这样当系统启动时，pm2 就会自动启动我们的服务。

```bash
pm2 save

pm2 startup
```
