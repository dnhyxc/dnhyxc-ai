import { randomUUID } from 'node:crypto';
import {
	AIMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { InjectQueue } from '@nestjs/bullmq';
import { Cache } from '@nestjs/cache-manager';
import {
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	type LoggerService,
	Scope,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Queue } from 'bullmq';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { catchError, Observable, Subject } from 'rxjs';
import { ModelEnum } from 'src/enum/config.enum';
import type { ChatContinueDto } from './dto/chat-continue.dto';
import type { ChatMessageDto } from './dto/chat-message.dto';
import type { ChatRequestDto } from './dto/chat-request.dto';
import { KnowledgeMessageRole } from './knowledge-chat-message.entity';
import { KnowledgeMessageService } from './knowledge-message.service';

@Injectable({ scope: Scope.REQUEST })
export class KnowledgeChatService {
	private abortControllers = new Map<string, AbortController>();

	constructor(
		private configService: ConfigService,
		private cache: Cache,
		private messageService: KnowledgeMessageService,
		@InjectQueue('knowledge-chat-message-queue')
		private readonly messageQueue: Queue,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {}

	private initModel(options?: {
		temperature?: number;
		maxTokens?: number;
		abortSignal?: AbortSignal;
	}): ChatOpenAI {
		const apiKey = this.configService.get(ModelEnum.DEEPSEEK_API_KEY);
		const baseURL = this.configService.get(ModelEnum.DEEPSEEK_BASE_URL);
		const modelName = this.configService.get(ModelEnum.DEEPSEEK_MODEL_NAME);
		return new ChatOpenAI({
			apiKey,
			modelName,
			streaming: true,
			configuration: { baseURL },
			temperature: options?.temperature ?? 0.3,
			...(options?.maxTokens !== undefined && { maxTokens: options.maxTokens }),
			...(options?.abortSignal && {
				callOptions: { signal: options.abortSignal },
			}),
		});
	}

	private convertToLangChainMessages(
		messages: ChatMessageDto[],
	): (HumanMessage | SystemMessage | AIMessage)[] {
		return messages.map((msg) => {
			if (msg.role === 'user') return new HumanMessage(msg.content);
			if (msg.role === 'assistant') return new AIMessage(msg.content);
			return new SystemMessage(msg.content);
		});
	}

	private cleanupSession(sessionId: string) {
		this.abortControllers.delete(sessionId);
		this.cache.del(sessionId).catch(() => {});
	}

	async stopStream(sessionId: string) {
		const cancel$ = (await this.cache.get(sessionId)) as Subject<void>;
		if (cancel$) {
			cancel$.next();
			cancel$.complete();
		}
		const abortController = this.abortControllers.get(sessionId);
		abortController?.abort();
		this.cleanupSession(sessionId);
		return { success: true };
	}

	async chatStream(dto: ChatRequestDto): Promise<Observable<string>> {
		const sessionId = dto.sessionId || randomUUID();

		const abortController = new AbortController();
		this.abortControllers.set(sessionId, abortController);

		const existingCancel$ = (await this.cache.get(sessionId)) as Subject<void>;
		if (existingCancel$) {
			existingCancel$.next();
			existingCancel$.complete();
			this.cleanupSession(sessionId);
		}

		const cancel$ = new Subject<void>();
		await this.cache.set(sessionId, cancel$, 12 * 60 * 60 * 1000);

		const llm = this.initModel({
			temperature: dto.temperature,
			maxTokens: dto.maxTokens || 8192,
			abortSignal: abortController.signal,
		});

		const lastUserMessage = dto.messages.find(
			(msg) => msg.role === 'user' && !(msg as any).noSave,
		);
		const pendingUserData =
			lastUserMessage && dto.userMessage
				? {
						sessionId,
						role: KnowledgeMessageRole.USER,
						content: lastUserMessage.content,
						parentId: dto.userMessage.parentId || null,
						chatId: dto.userMessage.chatId,
						childrenIds: dto.userMessage.childrenIds || [],
						currentChatId: dto.userMessage.chatId,
						isContinuation: Boolean(dto.isContinuation),
					}
				: null;

		return new Observable<string>((subscriber) => {
			const getStreamStatus = () => cancel$.isStopped || subscriber.closed;
			(async () => {
				let fullContent = '';
				let hasReceivedFirstToken = false;
				try {
					if (getStreamStatus()) {
						subscriber.complete();
						return;
					}

					const baseMsgs = [...dto.messages];
					const systemContent = dto.isContinuation
						? '你正在续写被中断的回答：从上次中断处继续，不要重复已输出内容。'
						: '聚焦最新用户问题，避免冗余。';
					const finalMessages: ChatMessageDto[] = [
						{ role: 'system', content: systemContent },
						...baseMsgs.filter((m) => m.role !== 'system'),
					];

					const lcMessages = this.convertToLangChainMessages(finalMessages);
					const stream = await llm.stream(lcMessages, {});

					for await (const chunk of stream) {
						if (getStreamStatus()) break;
						const token =
							chunk.content?.toString?.() ?? String(chunk.content ?? '');
						if (!token) continue;

						if (!hasReceivedFirstToken) {
							hasReceivedFirstToken = true;
							await this.messageService.createSession(sessionId);
							if (pendingUserData) {
								await this.messageQueue.add('save-message', pendingUserData);
							}
						}

						fullContent += token;
						subscriber.next(token);
					}

					const assistantChatId =
						dto.assistantMessage?.chatId || `asst_${randomUUID()}`;
					const assistantParentId =
						dto.assistantMessage?.parentId || dto.userMessage?.chatId || null;
					await this.messageQueue.add('save-message', {
						sessionId,
						role: KnowledgeMessageRole.ASSISTANT,
						content: fullContent,
						parentId: assistantParentId,
						chatId: assistantChatId,
						childrenIds: dto.assistantMessage?.childrenIds || [],
						currentChatId: dto.assistantMessage?.chatId || assistantChatId,
						isContinuation: Boolean(dto.isContinuation),
					});

					subscriber.complete();
				} catch (error: any) {
					this.logger.error?.('[KnowledgeChatService] chatStream failed', {
						error: {
							name: error?.name,
							message: error?.message,
							stack: error?.stack,
						},
					});
					subscriber.error(
						new HttpException(
							error?.message || '处理失败',
							HttpStatus.INTERNAL_SERVER_ERROR,
						),
					);
				} finally {
					cancel$.complete();
					this.abortControllers.delete(sessionId);
				}
			})().catch((e) => subscriber.error(e));

			return () => {
				cancel$.next();
				cancel$.complete();
			};
		}).pipe(
			catchError((error) => {
				throw error;
			}),
		);
	}

	async continueStream(dto: ChatContinueDto): Promise<Observable<string>> {
		return this.chatStream(dto as any);
	}
}
