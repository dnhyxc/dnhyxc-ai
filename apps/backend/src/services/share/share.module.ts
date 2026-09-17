import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentMessage } from '../agent/agent-message.entity';
import { AgentSession } from '../agent/agent-session.entity';
import { AssistantMessage } from '../assistant/assistant-message.entity';
import { AssistantSession } from '../assistant/assistant-session.entity';
import { Attachments } from '../chat/attachments.entity';
import { ChatMessages } from '../chat/chat.entity';
import { ChatModule } from '../chat/chat.module';
import { ChatSessions } from '../chat/session.entity';
import { EbookAssistantMessage } from '../ebook-assistant/ebook-assistant-message.entity';
import { EbookAssistantSession } from '../ebook-assistant/ebook-assistant-session.entity';
import { EnglishAgentMessage } from '../english-learning/entity/english-agent-message.entity';
import { EnglishAgentSession } from '../english-learning/entity/english-agent-session.entity';
import { Knowledge } from '../knowledge/knowledge.entity';
import { SkillTryMessage } from '../skill/skill-try-message.entity';
import { SkillTrySession } from '../skill/skill-try-session.entity';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';

@Module({
	imports: [
		// 导入 ChatModule 以使用 MessageService
		ChatModule,
		// 注册 TypeORM 实体
		TypeOrmModule.forFeature([
			ChatMessages,
			ChatSessions,
			Attachments,
			AssistantSession,
			AssistantMessage,
			AgentSession,
			AgentMessage,
			EnglishAgentSession,
			EnglishAgentMessage,
			SkillTrySession,
			SkillTryMessage,
			EbookAssistantSession,
			EbookAssistantMessage,
			Knowledge,
		]),
	],
	controllers: [ShareController],
	providers: [ShareService],
})
export class ShareModule {}
