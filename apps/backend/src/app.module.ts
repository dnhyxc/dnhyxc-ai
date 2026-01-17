import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { TypeOrmDestroyService } from './database/typeorm-destroy.service';
import { appConfig } from './factorys/app-config.factory';
import { RedisConfigFactory } from './factorys/redis-config.factory';
import { AuthModule } from './services/auth/auth.module';
import { LogsModule } from './services/logs/logs.module';
import { MailModule } from './services/mail/mail.module';
import { MenusModule } from './services/menus/menus.module';
import { PromptModule } from './services/prompt/prompt.module';
import { RolesModule } from './services/roles/roles.module';
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
		LogsModule,
		UserModule,
		RolesModule,
		AuthModule,
		MenusModule,
		UploadModule,
		MailModule,
		PromptModule,
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
