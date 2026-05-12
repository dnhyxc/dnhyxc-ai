import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeQaModule } from '../knowledge-qa/knowledge-qa.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentMemoryService } from './agent-memory.service';
import { AgentMessage } from './agent-message.entity';
import { AgentSession } from './agent-session.entity';
import { AgentSessionSummary } from './agent-session-summary.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([AgentSession, AgentMessage, AgentSessionSummary]),
		KnowledgeQaModule,
	],
	controllers: [AgentController],
	providers: [AgentService, AgentMemoryService],
	exports: [AgentService, AgentMemoryService],
})
export class AgentModule {}
