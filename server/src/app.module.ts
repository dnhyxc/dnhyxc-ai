import { Global, Logger, Module } from '@nestjs/common';
import { LogsModule } from './logs/logs.module';
import { PromptModule } from './prompt/prompt.module';

// 将 exports 中的模块注册为全局模块，在所有其他模块中都可以使用
@Global()
@Module({
	imports: [PromptModule, LogsModule],
	controllers: [],
	providers: [Logger],
	exports: [Logger],
})
export class AppModule {}
