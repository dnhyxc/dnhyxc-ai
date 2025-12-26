import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import * as Joi from 'joi';
import { connectionOptions } from '../ormconfig';
import { AuthModule } from './auth/auth.module';
import { LogsModule } from './logs/logs.module';
import { MenusModule } from './menus/menus.module';
import { PromptModule } from './prompt/prompt.module';
import { RolesModule } from './roles/roles.module';
import { UserModule } from './user/user.module';

const envFilePath = `.env.${process.env.NODE_ENV || 'development'}`;

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
		PromptModule,
		LogsModule,
		UserModule,
		RolesModule,
		AuthModule,
		MenusModule,
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
