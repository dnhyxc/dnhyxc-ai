import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeChatController } from './knowledge-chat.controller';
import { KnowledgeChatService } from './knowledge-chat.service';
import { KnowledgeChatMessages } from './knowledge-chat-message.entity';
import { KnowledgeChatMessageProcessor } from './knowledge-chat-message.processor';
import { KnowledgeChatSessions } from './knowledge-chat-session.entity';
import { KnowledgeMessageService } from './knowledge-message.service';

@Module({
	imports: [
		BullModule.registerQueueAsync({
			name: 'knowledge-chat-message-queue',
		}),
		ConfigModule,
		TypeOrmModule.forFeature([KnowledgeChatMessages, KnowledgeChatSessions]),
	],
	controllers: [KnowledgeChatController],
	providers: [
		KnowledgeChatService,
		KnowledgeMessageService,
		KnowledgeChatMessageProcessor,
	],
})
export class DeepseekChatModule {}
