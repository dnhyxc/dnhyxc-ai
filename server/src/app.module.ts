import { Module } from '@nestjs/common';
import { PromptModule } from './prompt/prompt.module';

@Module({
	imports: [PromptModule],
	controllers: [],
	providers: [],
})
export class AppModule {}
