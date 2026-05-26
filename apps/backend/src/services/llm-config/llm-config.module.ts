import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmConfigController } from './llm-config.controller';
import { LlmConfigService } from './llm-config.service';
import { LlmRuntimeConfig } from './llm-runtime-config.entity';

@Global()
@Module({
	imports: [TypeOrmModule.forFeature([LlmRuntimeConfig])],
	controllers: [LlmConfigController],
	providers: [LlmConfigService],
	exports: [LlmConfigService],
})
export class LlmConfigModule {}
