// chat-message.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { MessageRole } from './chat.entity';
import { MessageService } from './message.service';

interface SaveMessageJobData {
	sessionId: string;
	role: MessageRole;
	content: string;
	attachments: any[];
	parentId: string | null;
	isRegenerate: boolean;
	chatId?: string;
	childrenIds?: string[];
	currentChatId?: string;
}

@Processor('chat-message-queue')
export class ChatMessageProcessor extends WorkerHost {
	constructor(private readonly messageService: MessageService) {
		super();
	}

	async process(job: Job<SaveMessageJobData, any, string>): Promise<any> {
		try {
			switch (job.name) {
				case 'save-message': {
					await this.messageService.saveMessage(job.data);
					break;
				}
				default:
					console.warn(`⚠️ [Processor] Unknown job name: ${job.name}`);
			}
		} catch (error) {
			console.error('❌ [Processor] Job failed:', error);
			throw error; // 让 BullMQ 重试
		}
	}
}
