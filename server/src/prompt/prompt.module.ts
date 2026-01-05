import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigEnum } from '../enum/config.enum';
import { User } from '../user/user.entity';
import { getEnvConfig } from '../utils';
import { PromptController } from './prompt.controller';
import { Prompt } from './prompt.entity';
import { PromptService } from './prompt.service';

const config = getEnvConfig();

@Module({
	imports: [
		TypeOrmModule.forFeature([Prompt], config[ConfigEnum.DB_DB1_NAME]),
		TypeOrmModule.forFeature([User]),
	],
	controllers: [PromptController],
	providers: [PromptService],
})
export class PromptModule {}
