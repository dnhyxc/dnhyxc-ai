import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueEventsListener } from '../../utils/queue-events-listener';
import { OcrService } from '../ocr/ocr.service';
import { Attachments } from './attachments.entity';
import { ChatController } from './chat.controller';
import { ChatMessages } from './chat.entity';
import { ChatService } from './chat.service';
import { ChatMessageProcessor } from './chat-message.processor';
import { MessageService } from './message.service';
import { ChatSessions } from './session.entity';

@Module({
	imports: [
		// 注册队列，使用 app.module.ts 中的全局 defaultJobOptions 配置
		BullModule.registerQueueAsync({
			name: 'chat-message-queue',
		}),
		ConfigModule,
		TypeOrmModule.forFeature([ChatMessages, ChatSessions, Attachments]),
	],
	controllers: [ChatController],
	// QueueEventsListener 是一个 BullMQ 独立的队列事件监听器，可以在任何地方使用
	providers: [
		ChatService,
		MessageService,
		ChatMessageProcessor,
		OcrService,
		QueueEventsListener,
	],
	exports: [MessageService],
})
export class ChatModule {}
