import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as Joi from 'joi';
import { LogsModule } from './logs/logs.module';
import { PromptModule } from './prompt/prompt.module';

const envFilePath = `.env.${process.env.NODE_ENV || 'development'}`;

// 将 exports 中的模块注册为全局模块，在所有其他模块中都可以使用
@Global()
@Module({
	imports: [
		PromptModule,
		LogsModule,
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
				DB_PORT: Joi.number().default(3306),
				NODE_ENV: Joi.string()
					.valid('development', 'production')
					.default('development'),
			}),
		}),
	],
	controllers: [],
	providers: [Logger],
	exports: [Logger],
})
export class AppModule {}
