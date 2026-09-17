import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantMessage } from '../assistant/assistant-message.entity';
import { AssistantSession } from '../assistant/assistant-session.entity';
import { AssistantSessionSummary } from '../assistant/assistant-session-summary.entity';
import { AssistantTableMemory } from '../assistant/assistant-table-memory';
import { EnglishTableMemory } from '../english-learning/english-table-memory';
import { EnglishAgentMessage } from '../english-learning/entity/english-agent-message.entity';
import { EnglishAgentSession } from '../english-learning/entity/english-agent-session.entity';
import { EnglishAgentSessionSummary } from '../english-learning/entity/english-agent-session-summary.entity';
import { KnowledgeQaModule } from '../knowledge-qa/knowledge-qa.module';
import { SkillModule } from '../skill/skill.module';
import { SkillTryMessage } from '../skill/skill-try-message.entity';
import { SkillTrySession } from '../skill/skill-try-session.entity';
import { SkillTrySessionSummary } from '../skill/skill-try-session-summary.entity';
import { SkillTryTableMemory } from '../skill/skill-try-table-memory';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentMemoryService } from './agent-memory.service';
import { AgentMessage } from './agent-message.entity';
import { AgentSession } from './agent-session.entity';
import { AgentSessionSummary } from './agent-session-summary.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			AgentSession,
			AgentMessage,
			AgentSessionSummary,
			SkillTrySession,
			SkillTryMessage,
			SkillTrySessionSummary,
			AssistantSession,
			AssistantMessage,
			AssistantSessionSummary,
			EnglishAgentSession,
			EnglishAgentMessage,
			EnglishAgentSessionSummary,
		]),
		KnowledgeQaModule,
		SkillModule,
	],
	controllers: [AgentController],
	providers: [
		AgentService,
		AgentMemoryService,
		AssistantTableMemory,
		EnglishTableMemory,
		SkillTryTableMemory,
	],
	exports: [AgentService, AgentMemoryService],
})
export class AgentModule {}
