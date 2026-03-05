import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachments } from './attachments.entity';
import { ChatController } from './chat.controller';
import { ChatMessages } from './chat.entity';
import { ChatService } from './chat.service';
import { ChatMessageProcessor } from './chat-message.processor';
import { MessageService } from './message.service';
import { ChatSessions } from './session.entity';

@Module({
	imports: [
		BullModule.registerQueueAsync({
			name: 'chat-message-queue',
		}),
		ConfigModule,
		TypeOrmModule.forFeature([ChatMessages, ChatSessions, Attachments]),
	],
	controllers: [ChatController],
	providers: [ChatService, MessageService, ChatMessageProcessor],
	exports: [MessageService],
})
export class ChatModule {}
