import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, type LoggerService } from '@nestjs/common';
import type { Job } from 'bullmq';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { KnowledgeMessageRole } from './knowledge-chat-message.entity';
import { KnowledgeMessageService } from './knowledge-message.service';

interface SaveMessageJobData {
	sessionId: string;
	role: KnowledgeMessageRole;
	content: string;
	parentId: string | null;
	chatId?: string;
	childrenIds?: string[];
	currentChatId?: string;
	isContinuation?: boolean;
}

interface JobResult {
	success: boolean;
	messageId?: string;
	error?: string;
	attemptsMade: number;
}

class WaitingForLockError extends Error {
	constructor(public readonly chatId: string) {
		super(`Waiting for lock on chatId: ${chatId}`);
		this.name = 'WaitingForLockError';
	}
}

@Processor('knowledge-chat-message-queue', {
	concurrency: 5,
	limiter: { max: 100, duration: 1000 },
})
export class KnowledgeChatMessageProcessor extends WorkerHost {
	private static readonly processingChatIds = new Set<string>();

	constructor(
		private readonly messageService: KnowledgeMessageService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {
		super();
	}

	async process(job: Job<SaveMessageJobData, JobResult>): Promise<JobResult> {
		const { name, data, attemptsMade } = job;
		try {
			switch (name) {
				case 'save-message': {
					return await this.handleSaveMessage(data, attemptsMade);
				}
				default:
					this.logger.warn?.(
						`[DeepseekChatMessageProcessor] Unknown job name: ${name}`,
					);
					return {
						success: false,
						error: `Unknown job name: ${name}`,
						attemptsMade: attemptsMade + 1,
					};
			}
		} catch (error: any) {
			return this.handleError(job, error);
		}
	}

	private async handleSaveMessage(
		data: SaveMessageJobData,
		attemptsMade: number,
	): Promise<JobResult> {
		const { chatId } = data;
		if (chatId) {
			if (KnowledgeChatMessageProcessor.processingChatIds.has(chatId)) {
				this.logger.debug?.(
					`[DeepseekChatMessageProcessor] ChatId ${chatId} is being processed, waiting...`,
				);
				throw new WaitingForLockError(chatId);
			}
			KnowledgeChatMessageProcessor.processingChatIds.add(chatId);
			try {
				const messageId = await this.messageService.saveMessage(data);
				if (!messageId)
					return { success: false, attemptsMade: attemptsMade + 1 };
				return { success: true, messageId, attemptsMade: attemptsMade + 1 };
			} finally {
				KnowledgeChatMessageProcessor.processingChatIds.delete(chatId);
			}
		}

		const messageId = await this.messageService.saveMessage(data);
		if (!messageId) return { success: false, attemptsMade: attemptsMade + 1 };
		return { success: true, messageId, attemptsMade: attemptsMade + 1 };
	}

	private handleError(
		job: Job<SaveMessageJobData, JobResult>,
		error: any,
	): never | JobResult {
		const { id, attemptsMade, data } = job;
		if (error instanceof WaitingForLockError) {
			this.logger.debug?.(
				`[KnowledgeChatMessageProcessor] Job ${id} waiting for lock on chatId: ${error.chatId}, will retry`,
			);
			throw error;
		}
		this.logger.error?.(
			`[DeepseekChatMessageProcessor] Job ${id} error | Attempt: ${attemptsMade + 1}`,
			{
				jobId: id,
				sessionId: data.sessionId,
				role: data.role,
				chatId: data.chatId,
				attemptsMade: attemptsMade + 1,
				error: {
					name: error.name,
					message: error.message,
					code: error.code,
					stack: error.stack,
				},
				timestamp: new Date().toISOString(),
			},
		);
		throw error;
	}
}
