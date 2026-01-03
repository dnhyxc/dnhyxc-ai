import { createKeyv } from '@keyv/redis';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import * as Joi from 'joi';
import { connectionOptions } from '../ormconfig';
import { AuthModule } from './auth/auth.module';
import { RedisEnum } from './enum/config.enum';
import { LogsModule } from './logs/logs.module';
import { MailModule } from './mail/mail.module';
import { MenusModule } from './menus/menus.module';
import { PromptModule } from './prompt/prompt.module';
import { RolesModule } from './roles/roles.module';
import { UploadModule } from './upload/upload.module';
import { UserModule } from './user/user.module';
import { getEnvConfig } from './utils';

const envFilePath = `.env.${process.env.NODE_ENV || 'development'}`;

// 获取环境配置信息
const envConfig = getEnvConfig();

// 将 exports 中的模块注册为全局模块，在所有其他模块中都可以使用
@Global()
@Module({
	imports: [
		ConfigModule.forRoot({
			// 全局注册配置模块，这样就不需要在每个模块的 @Module 中都使用 ConfigModule.forRoot() 注册过后才能使用
			isGlobal: true,
			// 配置加载的 env 文件路径
			envFilePath,
			// 自动合并 .env、.env.development、.env.production 文件
			load: [() => dotenv.config({ path: '.env' })],
			// TODO: Joi 配置未生效，后续完善
			validationSchema: Joi.object({
				// 使用 Joi 验证环境变量中的DB_PORT
				NODE_ENV: Joi.string()
					.valid('development', 'production', 'test')
					.default('development'),
				DB_PORT: Joi.number().default(3090),
				DB_HOST: Joi.alternatives().try(
					Joi.string().ip(),
					Joi.string().domain(),
				),
				DB_TYPE: Joi.string().valid('mysql', 'postgres'),
				DB_USERNAME: Joi.string().required(),
				DB_PASSWORD: Joi.string().required(),
				DB_DATABASE: Joi.string().required(),
				DB_SYNC: Joi.boolean().default(false),
				LOG_LEVEL: Joi.string(),
				LOG_ON: Joi.boolean(),
			}),
		}),
		TypeOrmModule.forRoot(connectionOptions),
		// Redis 缓存
		NestCacheModule.registerAsync({
			isGlobal: true,
			useFactory: async () => {
				const store = createKeyv({
					url: envConfig[RedisEnum.REDIS_URL],
					password: envConfig[RedisEnum.REDIS_PASSWORD],
					username: envConfig[RedisEnum.REDIS_USERNAME],
				});
				// 添加错误监听
				store.on('error', (err) => {
					console.error('Keyv Store Error:', err.message);
				});
				// 测试连接
				try {
					await store.set('test_connection', Date.now(), 10000);
					const testResult = await store.get('test_connection');
					console.log(`Redis 连接测试 ${testResult ? '✅ 成功' : '❌ 失败'}`);
					await store.delete('test_connection');
				} catch (error) {
					console.error('Redis连接测试失败:', error.message);
				}
				return {
					store: store,
					// ttl（time-to-live）表示缓存项的存活时间，单位毫秒。这里设置为 120000 毫秒（120 秒），
					// 意味着写入缓存的数据默认在 5 秒后过期并被自动清除，防止脏数据长期残留。
					ttl: 120000,
				};
			},
		}),
		PromptModule,
		LogsModule,
		UserModule,
		RolesModule,
		AuthModule,
		MenusModule,
		UploadModule,
		MailModule,
	],
	controllers: [],
	providers: [
		Logger,
		// 这样配置全局守卫，就可以在 AdminGuard 或者 JwtGuard 中使用到 userService 了
		// {
		// 	provide: APP_GUARD,
		// 	useClass: JwtGuard, // AdminGuard
		// },
	],
	exports: [Logger],
})
export class AppModule {}
