// src/services/chat/queue-events.listener.ts
import {
	Inject,
	Injectable,
	type LoggerService,
	OnModuleDestroy,
	OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueEvents } from 'bullmq';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { RedisEnum } from '../enum/config.enum';

/**
 * 独立的队列事件监听器
 *
 * 使用 BullMQ 原生的 QueueEvents，完全独立于 Processor
 * 不受 Processor 作用域影响，可以在任何情况下正常工作
 *
 * 这是解决 @OnWorkerEvent 在 request-scoped Provider 中无法使用的唯一方案
 */
@Injectable()
export class QueueEventsListener implements OnModuleInit, OnModuleDestroy {
	private queueEvents: QueueEvents;

	constructor(
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
		private readonly configService: ConfigService,
	) {
		// 创建 QueueEvents 实例
		this.queueEvents = new QueueEvents('chat-message-queue', {
			connection: {
				host:
					this.configService.get<string>(RedisEnum.REDIS_HOST) || 'localhost',
				port: this.configService.get<number>(RedisEnum.REDIS_PORT) || 6379,
				password: this.configService.get<string>(RedisEnum.REDIS_PASSWORD),
			},
		});
	}

	onModuleInit() {
		// ==================== Job 激活事件 ====================
		// this.queueEvents.on('active', ({ jobId, prev }) => {
		// 	this.logger.log?.(
		// 		`[QueueEventsListener] 🔄 Job ${jobId} started processing`,
		// 		{
		// 			event: 'active',
		// 			jobId,
		// 			prev,
		// 			timestamp: new Date().toISOString(),
		// 		},
		// 	);
		// });

		// ==================== Job 完成事件 ====================
		this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
			try {
				const result =
					typeof returnvalue === 'string'
						? JSON.parse(returnvalue)
						: returnvalue;

				this.logger.log?.(
					`[QueueEventsListener] ✅ Job ${jobId} completed | Attempts: ${result?.attemptsMade || 0}`,
					{
						event: 'completed',
						jobId,
						messageId: result?.messageId,
						attemptsMade: result?.attemptsMade || 1,
						success: result?.success,
						timestamp: new Date().toISOString(),
					},
				);
			} catch (error) {
				this.logger.error?.(
					`[QueueEventsListener] Failed to parse completed event for job ${jobId}, error: ${error?.message}`,
				);
			}
		});

		// ==================== Job 失败事件 ====================
		this.queueEvents.on('failed', ({ jobId, failedReason, prev }) => {
			this.logger.error?.(
				`[QueueEventsListener] ❌ Job ${jobId} failed: ${failedReason}`,
				{
					event: 'failed',
					jobId,
					failedReason,
					prev,
					timestamp: new Date().toISOString(),
				},
			);
		});

		// ==================== Job 停滞事件 ====================
		this.queueEvents.on('stalled', ({ jobId }) => {
			this.logger.warn?.(`[QueueEventsListener] ⚠️ Job ${jobId} stalled`, {
				event: 'stalled',
				jobId,
				timestamp: new Date().toISOString(),
			});
		});

		// ==================== Job 进度事件 ====================
		this.queueEvents.on('progress', ({ jobId, data }) => {
			this.logger.debug?.(`[QueueEventsListener] 📊 Job ${jobId} progress`, {
				event: 'progress',
				jobId,
				data,
				timestamp: new Date().toISOString(),
			});
		});

		// ==================== 等待中事件 ====================
		this.queueEvents.on('waiting', ({ jobId }) => {
			this.logger.debug?.(`[QueueEventsListener] ⏳ Job ${jobId} waiting`, {
				event: 'waiting',
				jobId,
				timestamp: new Date().toISOString(),
			});
		});

		// ==================== 错误事件 ====================
		this.queueEvents.on('error', (error) => {
			this.logger.error?.(`[QueueEventsListener] 🔴 Error: ${error.message}`, {
				event: 'error',
				error: {
					name: error.name,
					message: error.message,
					stack: error.stack,
				},
				timestamp: new Date().toISOString(),
			});
		});

		this.logger.log?.('[QueueEventsListener] ✅ Initialized successfully');
	}

	onModuleDestroy() {
		if (this.queueEvents) {
			this.queueEvents
				.close()
				.then(() => {
					this.logger.log?.('[QueueEventsListener] Closed');
				})
				.catch((error) => {
					this.logger.error?.(
						`[QueueEventsListener] Failed to close: ${error.message}`,
					);
				});
		}
	}
}
