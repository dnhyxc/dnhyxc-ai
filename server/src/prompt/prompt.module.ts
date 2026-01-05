import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptController } from './prompt.controller';
import { Prompt } from './prompt.entity';
import { PromptService } from './prompt.service';

@Module({
	imports: [TypeOrmModule.forFeature([Prompt])],
	controllers: [PromptController],
	providers: [PromptService],
})
export class PromptModule {}
