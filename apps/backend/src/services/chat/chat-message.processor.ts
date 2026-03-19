// chat-message.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, type LoggerService } from '@nestjs/common';
import type { Job } from 'bullmq';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
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

interface JobResult {
	success: boolean;
	messageId?: string;
	error?: string;
	attemptsMade: number;
}

const RETRYABLE_ERROR_CODES = new Set([
	'ECONNREFUSED',
	'ENOTFOUND',
	'EHOSTUNREACH',
	'EPIPE',
	'ECONNRESET',
	'ETIMEDOUT',
	'PROTOCOL_CONNECTION_LOST',
	'ER_CON_COUNT_ERROR',
	'40P01',
	'1213',
	'NR_CLOSED',
]);

/**
 * 聊天消息队列处理器
 * 负责消费 chat-message-queue 队列中的任务
 */
@Processor('chat-message-queue', {
	// 同时并发处理的任务数，避免数据库瞬时压力过大
	concurrency: 5,
	// 限流器：每 1 秒最多处理 100 个任务，超出部分排队等待
	limiter: {
		max: 100,
		duration: 1000,
	},
})
export class ChatMessageProcessor extends WorkerHost {
	constructor(
		private readonly messageService: MessageService,
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
						`[ChatMessageProcessor] Unknown job name: ${name}`,
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
		const messageId = await this.messageService.saveMessage(data);
		if (!messageId) {
			return {
				success: false,
				attemptsMade: attemptsMade + 1,
			};
		}
		return {
			success: true,
			messageId,
			attemptsMade: attemptsMade + 1,
		};
	}

	private handleError(
		job: Job<SaveMessageJobData>,
		error: any,
	): never | JobResult {
		const { id, attemptsMade, data } = job;
		const isRetryable = this.isRetryableError(error);

		this.logger.error?.(
			`[ChatMessageProcessor] Job ${id} error | Attempt: ${attemptsMade + 1} | Retryable: ${isRetryable}`,
			{
				jobId: id,
				sessionId: data.sessionId,
				role: data.role,
				attemptsMade: attemptsMade + 1,
				isRetryable,
				error: {
					name: error.name,
					message: error.message,
					code: error.code,
					stack: error.stack,
				},
				timestamp: new Date().toISOString(),
			},
		);

		if (isRetryable) {
			throw error;
		}

		return {
			success: false,
			error: error.message,
			attemptsMade: attemptsMade + 1,
		};
	}

	private isRetryableError(error: any): boolean {
		if (
			RETRYABLE_ERROR_CODES.has(error.code) ||
			RETRYABLE_ERROR_CODES.has(String(error.errno))
		) {
			return true;
		}

		if (this.isDatabaseConnectionError(error)) {
			return true;
		}

		if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
			return true;
		}

		if (
			error.status === 400 ||
			error.code === 'VALIDATION_ERROR' ||
			error.code === 'INVALID_DATA'
		) {
			return false;
		}

		if (error.code === '23505' || error.code === 'ER_DUP_ENTRY') {
			return false;
		}

		return true;
	}

	private isDatabaseConnectionError(error: any): boolean {
		const dbErrorPatterns = [
			'connection',
			'connect',
			'ECONNREFUSED',
			'ETIMEDOUT',
			'PROTOCOL',
			'handshake',
		];

		const message = (error.message || '').toLowerCase();
		return dbErrorPatterns.some((pattern) =>
			message.includes(pattern.toLowerCase()),
		);
	}
}
