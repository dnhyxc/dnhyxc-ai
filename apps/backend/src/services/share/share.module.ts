import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantMessage } from '../assistant/assistant-message.entity';
import { AssistantSession } from '../assistant/assistant-session.entity';
import { Attachments } from '../chat/attachments.entity';
import { ChatMessages } from '../chat/chat.entity';
import { ChatModule } from '../chat/chat.module';
import { ChatSessions } from '../chat/session.entity';
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
		]),
	],
	controllers: [ShareController],
	providers: [ShareService],
})
export class ShareModule {}
