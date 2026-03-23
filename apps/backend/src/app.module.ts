import { BullModule } from '@nestjs/bullmq';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { TypeOrmConfigService } from './database/typeorm-config.service';
import { TypeOrmDestroyService } from './database/typeorm-destroy.service';
import { RedisEnum } from './enum/config.enum';
import { appConfig } from './factorys/app-config.factory';
import { RedisConfigFactory } from './factorys/redis-config.factory';
// 业务模块
import { AuthModule } from './services/auth/auth.module';
import { ChatModule } from './services/chat/chat.module';
import { LogsModule } from './services/logs/logs.module';
import { MailModule } from './services/mail/mail.module';
import { MenusModule } from './services/menus/menus.module';
import { OcrModule } from './services/ocr/ocr.module';
import { PromptModule } from './services/prompt/prompt.module';
import { RolesModule } from './services/roles/roles.module';
import { ShareModule } from './services/share/share.module';
import { UploadModule } from './services/upload/upload.module';
import { UserModule } from './services/user/user.module';

// 数据库连接池
const connections = new Map();

// 将 exports 中的模块注册为全局模块，在所有其他模块中都可以使用
@Global()
@Module({
	imports: [
		ConfigModule.forRoot(appConfig()),
		// 默认数据库
		TypeOrmModule.forRootAsync({
			inject: [ConfigService],
			useClass: TypeOrmConfigService,
			dataSourceFactory: async (options) => {
				const version = (options as any)?.version;
				if (version && connections.get(version)) {
					return connections.get(version);
				}
				const dataSource = await new DataSource(options!).initialize();
				connections.set(version, dataSource);
				return dataSource;
			},
		}),
		// Redis 缓存
		NestCacheModule.registerAsync({
			isGlobal: true,
			useClass: RedisConfigFactory,
		}),
		BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				connection: {
					host: configService.get<string>(RedisEnum.REDIS_HOST),
					port: configService.get<number>(RedisEnum.REDIS_PORT),
					// TODO: 生产环境不需要用户密码
					username: configService.get<string>(RedisEnum.REDIS_USERNAME),
					password: configService.get<string>(RedisEnum.REDIS_PASSWORD),
					// 每隔 10 秒发送一次心跳，防止连接被防火墙或 Redis 服务器判定为空闲而断开
					keepAlive: 10000,
					// 增加连接超时时间，默认可能较短，建议设为 5秒或更长
					connectTimeout: 5000,
					// 增加命令超时时间，防止大任务执行时 Redis 响应慢导致超时
					commandTimeout: 10000,
					socket: {
						keepAlive: true, // 启用 TCP Keep-Alive
						// 初始发送 Keep-Alive 探测包的延迟（毫秒），建议设为比中间设备超时时间短一点
						keepAliveInitialDelay: 10000, // 10秒
					},
					// 开启自动重连策略，当连接断开时，自动尝试重连，而不是直接报错
					retryStrategy: (times: number) => {
						if (times > 5) {
							// 重试次数过多则停止
							return null;
						}
						// 间隔时间：最小 1 秒，最大 3 秒
						return Math.min(times * 100, 3000);
					},
					// 启用离线队列（默认开启），连接断开期间命令会排队，重连后自动重发
					enableOfflineQueue: true,
					// 如果是 BullMQ，建议开启 readyCheck 就绪检查，但是开启后有时 Redis 环境不支持 INFO 命令或检查耗时过长，禁用可加快重连速度
					enableReadyCheck: true,
					// 懒加载连接：只有在有任务需要处理时才建立连接，避免启动时即断开的问题
					// lazyConnect: true,
					// 自动重连：当连接断开时，自动尝试重连（关键配置）
					// 注意：ioredis 默认会尝试重连，但显式声明可以确保逻辑清晰
					// 实际上 retryStrategy 的存在就启用了自动重连，但我们可以通过 reconnectOnError 处理错误时的重连
					reconnectOnError: (err: any) => {
						const targetErrors = [
							'READONLY',
							'ECONNRESET',
							'ECONNREFUSED',
							'ETIMEDOUT',
						];
						// 如果遇到特定错误，尝试重连
						if (targetErrors.some((e) => err.message.includes(e))) {
							return true; // 返回 true 表示尝试重连
						}
						return false;
					},
				},
				defaultJobOptions: {
					// 任务失败时的最大重试次数
					attempts: 3,
					// 重试退避策略：指数退避，延迟 1000ms
					backoff: {
						type: 'exponential',
						delay: 1000,
					},
					// 任务成功完成后，保留最近 100 条记录
					removeOnComplete: 100,
					// 任务失败时，保留最近 5000 条记录
					removeOnFail: 5000,
				},
			}),
		}),
		LogsModule,
		UserModule,
		RolesModule,
		AuthModule,
		MenusModule,
		UploadModule,
		MailModule,
		PromptModule,
		OcrModule,
		ChatModule,
		ShareModule,
	],
	controllers: [],
	providers: [
		Logger,
		TypeOrmDestroyService,
		{
			provide: 'TYPEORM_CONNECTIONS',
			useValue: connections,
		},
		// 这样配置全局守卫，就可以在 AdminGuard 或者 JwtGuard 中使用到 userService 了
		// {
		// 	provide: APP_GUARD,
		// 	useClass: JwtGuard, // AdminGuard
		// },
	],
	exports: [Logger],
})
export class AppModule {}
