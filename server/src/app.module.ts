import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
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
			envFilePath,
			load: [() => dotenv.config({ path: '.env' })],
		}),
	],
	controllers: [],
	providers: [Logger],
	exports: [Logger],
})
export class AppModule {}
