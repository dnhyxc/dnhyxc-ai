import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantMessage } from './assistant-message.entity';
import { AssistantSession } from './assistant-session.entity';

@Module({
	imports: [TypeOrmModule.forFeature([AssistantSession, AssistantMessage])],
	controllers: [AssistantController],
	providers: [AssistantService],
	exports: [AssistantService],
})
export class AssistantModule {}
