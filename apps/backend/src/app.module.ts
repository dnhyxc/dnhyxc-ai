import { BullModule } from '@nestjs/bullmq';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { TypeOrmConfigService } from './database/typeorm-config.service';
import { TypeOrmDestroyService } from './database/typeorm-destroy.service';
import { appConfig } from './factorys/app-config.factory';
import { createBullRedisConnectionOptions } from './factorys/bull-redis-connection.factory';
import { RedisConfigFactory } from './factorys/redis-config.factory';
import { AssistantModule } from './services/assistant/assistant.module';
// 业务模块
import { AuthModule } from './services/auth/auth.module';
import { ChatModule } from './services/chat/chat.module';
import { KnowledgeModule } from './services/knowledge/knowledge.module';
import { KnowledgeQaModule } from './services/knowledge-qa/knowledge-qa.module';
import { LogsModule } from './services/logs/logs.module';
import { MailModule } from './services/mail/mail.module';
import { MenusModule } from './services/menus/menus.module';
import { OcrModule } from './services/ocr/ocr.module';
import { PayModule } from './services/pay/pay.module';
import { PromptModule } from './services/prompt/prompt.module';
import { QdrantModule } from './services/qdrant/qdrant.module';
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
				connection: createBullRedisConnectionOptions(configService),
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
		QdrantModule,
		KnowledgeModule,
		KnowledgeQaModule,
		ShareModule,
		PayModule,
		AssistantModule,
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
