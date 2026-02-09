import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatMessages } from './chat.entity';
import { ChatService } from './chat.service';
import { ChatSessions } from './session.entity';
import { Attachments } from './attachments.entity';

@Module({
	imports: [
		ConfigModule,
		TypeOrmModule.forFeature([ChatMessages, ChatSessions, Attachments]),
	],
	controllers: [ChatController],
	providers: [ChatService],
})
export class ChatModule {}
