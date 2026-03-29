// chat-message.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, type LoggerService } from '@nestjs/common';
import type { Job } from 'bullmq';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MessageRole } from './chat.entity';
import { MessageService } from './message.service';
import type { SerperOrganicItem } from './serper.service';

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
	isContinuation?: boolean; // 续写标志：true 表示续写模式，需要追加内容而不是替换
	/** 助手消息：Serper organic 热点，与流式推送一致 */
	searchOrganic?: SerperOrganicItem[];
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
 * 自定义错误：需要等待其他任务完成
 * 用于触发延迟重试机制
 */
class WaitingForLockError extends Error {
	constructor(public readonly chatId: string) {
		super(`Waiting for lock on chatId: ${chatId}`);
		this.name = 'WaitingForLockError';
	}
}

/**
 * 聊天消息队列处理器
 * 负责消费 chat-message-queue 队列中的任务
 *
 * 顺序保证机制：
 * 1. 使用内存锁（processingChatIds）记录正在处理的 chatId
 * 2. 如果 chatId 正在被处理，抛出 WaitingForLockError 触发延迟重试
 * 3. 不同 chatId 的消息可以并发处理
 * 4. 没有 chatId 的消息不需要锁，直接处理
 */
@Processor('chat-message-queue', {
	// 同时并发处理的任务数
	concurrency: 5,
	// 限流器：每 1 秒最多处理 100 个任务，超出部分排队等待
	limiter: {
		max: 100,
		duration: 1000,
	},
})
export class ChatMessageProcessor extends WorkerHost {
	// 正在处理中的 chatId 集合（内存锁）
	private static readonly processingChatIds = new Set<string>();

	constructor(
		private readonly messageService: MessageService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {
		super();
	}

	/**
	 * MQ 消息需要注意竞态条件，因为MQ消息可能无法保证保存的顺序，在停止后，再继续生成时，继续生成的内容可能存在冲突，导致消息丢失。
	 *
	 * 解决方案：
	 * 1. 使用内存锁确保同一 chatId 的消息串行处理
	 * 2. 如果 chatId 正在被处理，延迟重试
	 * 3. 不同 chatId 的消息可以并发处理
	 *
	 * @param job
	 * @returns
	 */
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

	/**
	 * 处理保存消息任务
	 * 使用内存锁确保同一 chatId 的消息按顺序处理，因为是单机部署，所以直接使用内存锁，如果是分布式部署，这里需要改为 redis 分布式锁
	 */
	private async handleSaveMessage(
		data: SaveMessageJobData,
		attemptsMade: number,
	): Promise<JobResult> {
		const { chatId } = data;

		// 如果有 chatId，需要获取锁
		if (chatId) {
			// 检查是否有相同 chatId 的消息正在处理
			if (ChatMessageProcessor.processingChatIds.has(chatId)) {
				// 有相同 chatId 的消息正在处理，抛出错误触发延迟重试
				this.logger.debug?.(
					`[ChatMessageProcessor] ChatId ${chatId} is being processed, waiting...`,
				);
				throw new WaitingForLockError(chatId);
			}

			// 获取锁
			ChatMessageProcessor.processingChatIds.add(chatId);

			try {
				// 处理消息
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
			} finally {
				// 释放锁
				ChatMessageProcessor.processingChatIds.delete(chatId);
			}
		}

		// 没有 chatId，直接处理（不需要锁）
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

		// 如果是等待锁的错误，使用较短的延迟重试
		if (error instanceof WaitingForLockError) {
			this.logger.debug?.(
				`[ChatMessageProcessor] Job ${id} waiting for lock on chatId: ${error.chatId}, will retry`,
			);
			// 抛出错误触发 BullMQ 的重试机制
			// 由于 app.module.ts 中配置了指数退避，会自动延迟重试
			throw error;
		}

		const isRetryable = this.isRetryableError(error);

		this.logger.error?.(
			`[ChatMessageProcessor] Job ${id} error | Attempt: ${attemptsMade + 1} | Retryable: ${isRetryable}`,
			{
				jobId: id,
				sessionId: data.sessionId,
				role: data.role,
				chatId: data.chatId,
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
		// 等待锁的错误是可重试的
		if (error instanceof WaitingForLockError) {
			return true;
		}

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
