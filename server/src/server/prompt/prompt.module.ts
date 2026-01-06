import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../server/user/user.entity';
import { PromptController } from './prompt.controller';
import { Prompt } from './prompt.entity';
import { PromptService } from './prompt.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Prompt]),
		// TypeOrmModule.forFeature([Prompt], config[ConfigEnum.DB_DB1_NAME]),
		TypeOrmModule.forFeature([User]),
	],
	controllers: [PromptController],
	providers: [PromptService],
})
export class PromptModule {}
