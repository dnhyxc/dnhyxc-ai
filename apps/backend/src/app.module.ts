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
