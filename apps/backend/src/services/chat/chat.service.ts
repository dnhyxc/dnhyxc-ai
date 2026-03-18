import { randomUUID } from 'node:crypto';
import {
	AIMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { InjectQueue } from '@nestjs/bullmq';
import { Cache } from '@nestjs/cache-manager';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { catchError, Observable, Subject } from 'rxjs';
import { ModelEnum } from 'src/enum/config.enum';
import { parseFile } from '../../utils/file-parser';
import { OcrService } from '../ocr/ocr.service';
import { MessageRole } from './chat.entity';
import { ChatContinueDto } from './dto/chat-continue.dto';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ZhipuStreamData } from './dto/zhipu-stream-data.dto';
import { MessageService } from './message.service';

@Injectable()
export class ChatService {
	private readonly conversationMemory: Map<
		string,
		(HumanMessage | SystemMessage | AIMessage)[]
	> = new Map();

	// 存储会话的 AbortController，用于立即停止大模型生成
	private abortControllers = new Map<string, AbortController>();

	constructor(
		// 存储会话的取消控制器
		private configService: ConfigService,
		private cache: Cache,
		private messageService: MessageService,
		// 注入消息存储队列
		@InjectQueue('chat-message-queue')
		private readonly messageQueue: Queue,
		private readonly ocrService: OcrService,
	) {}

	private async processFileAttachments(filePaths: string[]): Promise<string> {
		if (!filePaths || filePaths.length === 0) {
			return '';
		}

		const fileContents = await Promise.all(
			filePaths.map(async (filePath) => {
				const content = await parseFile(filePath);
				return `文件 ${filePath} 内容:\n${content}\n`;
			}),
		);
		return fileContents.join('\n');
	}

	// 初始化模型
	private initModel(options?: {
		temperature?: number;
		maxTokens?: number;
		abortSignal?: AbortSignal;
	}): ChatOpenAI {
		const apiKey = this.configService.get(ModelEnum.DEEPSEEK_API_KEY);
		const baseURL = this.configService.get(ModelEnum.DEEPSEEK_BASE_URL);
		const modelName = this.configService.get(ModelEnum.DEEPSEEK_MODEL_NAME);
		const llm = new ChatOpenAI({
			apiKey,
			modelName,
			streaming: true,
			configuration: {
				baseURL,
			},
			temperature: options?.temperature ?? 0.3,
			maxTokens: options?.maxTokens ?? 4096,
			...(options?.abortSignal && {
				callOptions: { signal: options.abortSignal },
			}),
		});

		return llm;
	}

	private convertToLangChainMessages(
		messages: ChatMessageDto[],
	): (HumanMessage | SystemMessage | AIMessage)[] {
		return messages.map((msg) => {
			if (msg.role === 'user') {
				return new HumanMessage(msg.content);
			} else if (msg.role === 'assistant') {
				return new AIMessage(msg.content);
			} else {
				return new SystemMessage(msg.content);
			}
		});
	}

	private parseZhipuStreamData(dataStr: string): ZhipuStreamData | null {
		// 如果是结束标记，返回 null
		if (dataStr.trim() === '[DONE]') {
			return null;
		}

		try {
			// 首先尝试直接解析 JSON
			const data = JSON.parse(dataStr);

			// 智谱 API 流式响应格式 - 检查多种可能的字段结构
			if (data.choices?.[0]?.delta?.content) {
				return { type: 'content', data: data.choices[0].delta.content };
			}
			if (data.choices?.[0]?.message?.content) {
				return { type: 'content', data: data.choices[0].message.content };
			}
			if (data.result) {
				return { type: 'content', data: data.result };
			}
			if (data.data?.content) {
				return { type: 'content', data: data.data.content };
			}

			// 处理 reasoning_content 数据（思考内容）
			if (data.choices?.[0]?.delta?.reasoning_content) {
				const reasoningContent = data.choices[0].delta.reasoning_content;
				return { type: 'thinking', data: reasoningContent };
			}

			// 处理 tool_calls 数据
			if (data.choices?.[0]?.delta?.tool_calls) {
				return { type: 'tool_calls', data: data.choices[0].delta.tool_calls };
			}
			if (data.choices?.[0]?.message?.tool_calls) {
				return { type: 'tool_calls', data: data.choices[0].message.tool_calls };
			}

			// 处理 audio 数据
			if (data.choices?.[0]?.message?.audio) {
				return { type: 'audio', data: data.choices[0].message.audio };
			}

			// 处理 usage 数据
			if (data.usage) {
				return { type: 'usage', data: data.usage };
			}

			// 处理 video_result 数据
			if (data.video_result) {
				return { type: 'video', data: data.video_result };
			}

			// 处理 web_search 数据
			if (data.web_search) {
				return { type: 'web_search', data: data.web_search };
			}

			// 处理 content_filter 数据
			if (data.content_filter) {
				return { type: 'content_filter', data: data.content_filter };
			}
			return null;
		} catch (_error) {
			return null;
		}
	}

	/**
	 * 处理附件并构建系统提示消息
	 * @param attachments 附件列表，需包含 path 属性
	 * @param promptSuffix 提示词后缀，用于区分不同场景的指令
	 * @param role 消息角色，默认 system
	 * @returns 返回构建好的 ChatMessageDto，如果无内容则返回 null
	 */
	private async buildAttachmentMessage(
		attachments: { path: string; mimetype: string }[],
		promptSuffix: string,
		role?: MessageRole,
	): Promise<ChatMessageDto | null> {
		if (!attachments || attachments.length === 0) {
			return null;
		}

		// 分类附件并创建处理 Promise
		const imagePromises: Promise<string>[] = [];
		const filePromises: Promise<string>[] = [];

		const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

		for (const attachment of attachments) {
			if (IMAGE_TYPES.includes(attachment.mimetype)) {
				imagePromises.push(
					this.ocrService
						.imageOcrStream({
							url: attachment.path,
							prompt: `Please describe **only the actual content** in this image in full detail, including all text, objects, people, colors, layout, position, and scene elements.
Do **not** add any information, reasoning, interpretation, or content that does not exist in the image.
Stick strictly to what is visually present.`,
							stream: false,
						})
						.then((content) => `文件 ${attachment.path} 内容:\n${content}\n`),
				);
			} else {
				filePromises.push(
					parseFile(attachment.path).then(
						(content) => `文件 ${attachment.path} 内容:\n${content}\n`,
					),
				);
			}
		}

		// 并行处理所有附件（图片和文件）
		const allPromises = [...imagePromises, ...filePromises];

		if (allPromises.length === 0) return null;

		const results = await Promise.all(allPromises);
		const combinedContent = results.join('\n');

		if (!combinedContent) return null;

		// 根据附件类型构建不同的提示前缀
		const hasImages = imagePromises.length > 0;
		const hasFiles = filePromises.length > 0;

		let contentPrefix = '';
		if (hasImages && hasFiles) {
			contentPrefix = '以下是上传的图片和文件附件内容:\n';
		} else if (hasImages) {
			contentPrefix = '以下是上传的图片附件内容:\n';
		} else {
			contentPrefix = '以下是上传的附件内容:\n';
		}

		return {
			role: role || 'system',
			content: `${contentPrefix}${combinedContent}\n${promptSuffix}`,
		};
	}

	// deepseek 流式对话
	async chatStream(dto: ChatRequestDto): Promise<Observable<any>> {
		const sessionId = dto.sessionId;

		// 创建 AbortController 用于立即停止大模型生成
		const abortController = new AbortController();
		this.abortControllers.set(sessionId, abortController);

		// 从 redis 中获取，如果已有相同会话的流，先取消它
		const existingCancelController = (await this.cache.get(
			sessionId,
		)) as Subject<void>;

		if (existingCancelController) {
			existingCancelController.next();
			existingCancelController.complete();
			this.cleanupSession(sessionId);
		}

		// 创建取消控制器
		const cancel$ = new Subject<void>();
		// 缓存取消控制器，12 小时后自动过期并清除
		await this.cache.set(sessionId, cancel$, 12 * 60 * 60 * 1000);

		const llm = this.initModel({
			temperature: dto.temperature,
			maxTokens: dto.max_tokens,
			abortSignal: abortController.signal,
		});

		// 不立即保存用户消息，先缓存到临时变量
		// 等到收到第一个 AI Token 时再保存（延迟持久化 - 加入队列）
		const lastUserMessage = dto.messages.find(
			(msg) => msg.role === 'user' && !msg.noSave,
		);

		// 临时存储用户消息数据（用于延迟持久化）
		const pendingUserData =
			lastUserMessage && dto.userMessage
				? {
						sessionId,
						role: MessageRole.USER,
						content: lastUserMessage.content,
						attachments: dto.attachments,
						parentId: dto.userMessage.parentId || null,
						isRegenerate: dto.isRegenerate || false,
						chatId: dto.userMessage.chatId,
						childrenIds: dto.userMessage.childrenIds || [],
						currentChatId: dto.userMessage.chatId,
					}
				: null;

		return new Observable<any>((subscriber) => {
			const getStreamStatus = () => cancel$.isStopped || subscriber.closed;
			(async () => {
				// 将 fullContent 提升到 try 外部，确保在 catch 或停止逻辑中可访问
				let fullContent = '';
				let wasCancelledDuringIteration = false;
				// 【新增】用于追踪是否已收到第一个 Token
				let hasReceivedFirstToken = false;

				try {
					// 在开始任何耗时操作前检查是否已被停止
					if (getStreamStatus()) {
						subscriber.complete();
						return;
					}

					// 处理文件附件和消息准备
					let enhancedMessages = [...dto.messages];
					if (dto.attachments && dto.attachments?.length > 0) {
						const attachmentMsg = await this.buildAttachmentMessage(
							dto.attachments,
							dto.messages?.[0]?.content,
							MessageRole.USER,
						);
						if (attachmentMsg) {
							enhancedMessages = [attachmentMsg];
						}
					}

					// 动态构建系统提示词
					let systemContent = '';

					// 判断是否为续写模式
					if (dto.isContinuation) {
						// 续写模式：强调不要重复，直接继续
						systemContent = `You are continuing an interrupted response. The last assistant message is incomplete. Continue exactly from the last character. Do not repeat previous content. Maintain the same format, indentation, code style, and language. Output ONLY the remaining content.`;
					} else {
						// 普通模式：关注最新问题
						systemContent = `Focus on the latest user query and avoid redundancy. If the new question is unrelated to the conversation history, disregard prior context and answer independently based solely on the current input. Do not force connections to previous topics.`;
					}

					const systemPrompt: ChatMessageDto = {
						role: 'system',
						content: systemContent.trim(),
					};

					// 获取历史消息，从 memeries.messages 中提取所有包含附件的消息，通过 ASC 排序，防止消息顺序错乱导致大模型已读乱回
					const memeries = await this.messageService.findOneSession(sessionId, {
						relations: ['messages'],
						order: {
							messages: {
								createdAt: 'ASC',
							},
						},
					});

					// 从 memeries.messages 中提取所有包含附件的消息
					const attachments = (memeries?.messages ?? []).flatMap(
						(m) => m.attachments ?? [],
					);

					if (!dto.attachments && attachments && attachments?.length > 0) {
						const attachmentMsg = await this.buildAttachmentMessage(
							attachments,
							`First, assess whether the user's query is relevant to the provided attachments. If relevant, answer strictly based on the attachment content. If irrelevant, ignore the attachments and respond using your general knowledge. Do not force connections to unrelated file content.`.trim(),
						);
						if (attachmentMsg) {
							enhancedMessages = [attachmentMsg, ...enhancedMessages];
						}
					}

					// 根据 content 去重：保留 memeries.messages 中已有的，enhancedMessages 中 content 不重复的
					const existingKeySet = new Set(
						memeries?.messages.map((m) => `${m.role}::${m.content}`) || [],
					);

					const uniqueEnhanced = enhancedMessages.filter(
						(m) => !existingKeySet.has(`${m.role}::${m.content}`),
					);

					// 构建最终消息列表
					const newData: ChatMessageDto[] = [
						systemPrompt,
						...(memeries?.messages || []),
					];

					newData.push(...uniqueEnhanced);

					const allMessages = this.convertToLangChainMessages(newData);

					// 再次检查是否被取消（在数据库操作后）
					if (getStreamStatus()) {
						subscriber.complete();
						return;
					}

					const stream = await llm.stream(allMessages);

					// 在开始迭代前检查是否已取消
					if (getStreamStatus()) {
						try {
							if (typeof stream.cancel === 'function') {
								await stream.cancel();
							}
						} catch (cancelError) {
							console.error('Failed to cancel LLM stream:', cancelError);
						}
						return;
					}

					try {
						for await (const chunk of stream) {
							// 每次迭代前检查是否被取消
							if (getStreamStatus()) {
								wasCancelledDuringIteration = true;
								break;
							}

							const content = chunk.content;
							if (typeof content === 'string') {
								// 【修改】收到第一个有效的 Token 时，将用户消息加入队列（延迟持久化）
								if (!hasReceivedFirstToken && content.trim() !== '') {
									hasReceivedFirstToken = true;

									// 保存用户消息（延迟持久化 - 入队）
									if (pendingUserData) {
										await this.messageQueue
											.add('save-message', pendingUserData)
											.catch((dbError) => {
												console.error(
													'Failed to add user message job to queue:',
													dbError,
												);
											});
									}
								}

								subscriber.next(content);
								fullContent += content;
							}
						}
					} catch (error) {
						// 如果取消导致错误，忽略它
						if (getStreamStatus()) {
							wasCancelledDuringIteration = true;
						} else {
							throw error;
						}
					}

					// 如果迭代过程中被取消，尝试取消底层流
					if (wasCancelledDuringIteration) {
						try {
							if (typeof stream.cancel === 'function') {
								await stream.cancel();
							}
						} catch (cancelError) {
							console.error('Failed to cancel LLM stream:', cancelError);
						}
					}

					// 【核心修复】无论是否被取消，只要有内容，都尝试保存到数据库（入队）
					// 正常完成，cancel$.isStopped 为 false, 暂停时 cancel$.isStopped 为 true
					if (!cancel$.isStopped) {
						// 保存完整的 AI 回复到队列（使用前端传递的数据）
						if (dto.assistantMessage) {
							await this.messageQueue
								.add('save-message', {
									sessionId,
									role: MessageRole.ASSISTANT,
									content: fullContent,
									attachments: [],
									parentId: dto.assistantMessage.parentId || null,
									isRegenerate: dto.isRegenerate || false,
									chatId: dto.assistantMessage.chatId,
									childrenIds: dto.assistantMessage.childrenIds || [],
									currentChatId: dto.assistantMessage.chatId,
								})
								.catch((dbError) => {
									console.error(
										'Failed to add assistant message job to queue:',
										dbError,
									);
								});
						} else {
							// 如果没有传递 assistantMessage，使用默认逻辑
							await this.messageQueue
								.add('save-message', {
									sessionId,
									role: MessageRole.ASSISTANT,
									content: fullContent,
									attachments: [],
									parentId: dto.parentId || null, // 异步模式下 ID 获取受限
									isRegenerate: dto.isRegenerate || false,
									chatId: undefined,
									childrenIds: [],
									currentChatId: undefined,
								})
								.catch((dbError) => {
									console.error(
										'Failed to add assistant message job to queue:',
										dbError,
									);
								});
						}
					} else {
						// 被停止时，保存已生成的部分响应到队列，防止数据丢失
						if (fullContent.length > 0) {
							// 1. 保存消息到 Message 表 (入队)
							if (dto.assistantMessage) {
								await this.messageQueue
									.add('save-message', {
										sessionId,
										role: MessageRole.ASSISTANT,
										content: fullContent,
										attachments: [],
										parentId: dto.assistantMessage.parentId || null,
										isRegenerate: dto.isRegenerate || false,
										chatId: dto.assistantMessage.chatId,
										childrenIds: dto.assistantMessage.childrenIds || [],
										currentChatId: dto.assistantMessage.chatId,
									})
									.catch((dbError) => {
										console.error(
											'Failed to add partial assistant message job to queue:',
											dbError,
										);
									});
							} else {
								await this.messageQueue
									.add('save-message', {
										sessionId,
										role: MessageRole.ASSISTANT,
										content: fullContent,
										attachments: [],
										parentId: dto.parentId || null,
										isRegenerate: dto.isRegenerate || false,
										chatId: undefined,
										childrenIds: [],
										currentChatId: undefined,
									})
									.catch((dbError) => {
										console.error(
											'Failed to add partial assistant message job to queue:',
											dbError,
										);
									});
							}
						}
					}

					subscriber.complete();
				} catch (error) {
					// 发生真实错误时，如果已有部分内容，尝试保存，防止进度丢失
					if (
						fullContent.length > 0 &&
						(cancel$.isStopped || subscriber.closed)
					) {
						// 即使出错，如果是取消导致的，也保存已有内容
						try {
							await this.messageQueue.add('save-message', {
								sessionId,
								role: MessageRole.ASSISTANT,
								content: fullContent,
								attachments: [],
								parentId: dto.parentId || null,
								isRegenerate: dto.isRegenerate || false,
								chatId: undefined,
								childrenIds: [],
								currentChatId: undefined,
							});
						} catch (saveError) {
							console.error(
								'Failed to queue partial message on error:',
								saveError,
							);
						}
						subscriber.complete();
					} else {
						subscriber.error(error);
					}
				} finally {
					this.cleanupSession(sessionId);
				}
			})();
		}).pipe(
			catchError((error) => {
				throw new HttpException(
					`模型调用异常：${error}`,
					HttpStatus.BAD_REQUEST,
				);
			}),
		);
	}

	async cleanupSession(sessionId: string) {
		this.abortControllers.delete(sessionId);
		await this.cache.del(sessionId);
	}

	async stopStream(
		sessionId: string,
	): Promise<{ success: boolean; message: string }> {
		const cancelController = (await this.cache.get(sessionId)) as Subject<void>;

		// 如果缓存中没有取消控制器，但会话标记为活跃，说明正在初始化
		if (!cancelController) {
			return {
				success: false,
				message: '会话不存在或已完成',
			};
		}

		// 1. 首先触发 AbortController 立即停止大模型生成
		const abortController = this.abortControllers.get(sessionId);
		if (abortController) {
			abortController.abort('用户手动停止');
			this.abortControllers.delete(sessionId);
		}

		// 2. 然后触发 RxJS Subject 取消流式处理
		if (cancelController) {
			cancelController.next();
			cancelController.complete();
		}

		// 清理会话状态
		this.cleanupSession(sessionId);

		return {
			success: true,
			message: '已停止生成',
		};
	}

	async continueStream({
		sessionId,
		parentId,
		userMessage,
		assistantMessage,
		isRegenerate,
	}: ChatContinueDto): Promise<Observable<any>> {
		// 简化提示词，因为 chatStream 中已经将 partialContent 作为 Assistant 消息注入上下文
		// 这里只需要告诉模型"继续"即可，不需要再重复内容，避免模型困惑或重复生成
		const userContent =
			userMessage?.content ||
			`Please continue generating the previous response directly from where it stopped. Do not repeat any content.`;

		const continueMessages: ChatMessageDto[] = [
			{
				role: 'user',
				content: userContent,
			},
		];

		// 创建继续请求 DTO
		const continueDto: ChatRequestDto = {
			sessionId,
			messages: continueMessages,
			stream: true,
			max_tokens: 4096,
			temperature: 0.2,
			parentId,
			userMessage,
			assistantMessage,
			isRegenerate,
			isContinuation: true,
		};

		// 调用现有的 chatStream 方法
		// chatStream 内部会检测到 sessionId 对应的 session 有 partialContent
		// 从而自动激活续写逻辑（注入历史、修改 System Prompt）
		return this.chatStream(continueDto);
	}

	async clearSession(sessionId: string) {
		this.conversationMemory.delete(sessionId);
	}

	zhipuChatStream(dto: ChatRequestDto): Observable<ZhipuStreamData> {
		const sessionId = dto.sessionId || randomUUID();

		// 创建 AbortController 用于智谱 API
		const abortController = new AbortController();
		this.abortControllers.set(sessionId, abortController);

		return new Observable<ZhipuStreamData>((subscriber) => {
			(async () => {
				try {
					const apiKey = this.configService.get(ModelEnum.ZHIPU_API_KEY);
					const modelName = this.configService.get(ModelEnum.ZHIPU_MODEL_NAME);
					const baseURL = this.configService.get(ModelEnum.ZHIPU_BASE_URL);

					if (!apiKey) {
						throw new Error('智谱 API 密钥未配置');
					}

					// 保存用户消息到队列（异步处理）
					const lastUserMessage = dto.messages.find(
						(msg) => msg.role === 'user',
					);

					if (lastUserMessage && dto.userMessage) {
						// 使用前端传递的 userMessage 数据添加到队列
						await this.messageQueue
							.add('save-message', {
								sessionId,
								role: MessageRole.USER,
								content: lastUserMessage.content,
								attachments: dto.attachments,
								parentId: dto.userMessage.parentId || null,
								isRegenerate: false,
								chatId: dto.userMessage.chatId,
								childrenIds: dto.userMessage.childrenIds || [],
								currentChatId: dto.userMessage.chatId,
							})
							.catch((dbError) => {
								console.error(
									'Failed to add user message job to queue:',
									dbError,
								);
							});
					}

					// 处理文件附件
					let enhancedMessages = [...dto.messages];
					if (dto.attachments && dto.attachments?.length > 0) {
						const filePaths = dto.attachments.map((file) => file.path);
						const fileContent = await this.processFileAttachments(filePaths);
						if (fileContent) {
							// 创建包含文件内容的系统消息
							const fileSystemMessage: ChatMessageDto = {
								role: 'system',
								content: `以下是上传的文件内容:\n${fileContent}\n请根据文件内容回答用户问题。`,
							};
							// 将系统消息插入到消息数组的开头
							enhancedMessages = [fileSystemMessage, ...enhancedMessages];
						}
					}

					let history: (HumanMessage | SystemMessage | AIMessage)[] = [];
					if (dto.sessionId && this.conversationMemory.has(dto.sessionId)) {
						history = this.conversationMemory.get(dto.sessionId) || [];
					}

					// 将历史消息和当前消息合并
					const allMessages = [
						...history,
						...this.convertToLangChainMessages(enhancedMessages),
					];

					// 构建请求消息格式
					const requestMessages = allMessages.map((msg) => {
						if (msg instanceof HumanMessage) {
							return { role: 'user', content: msg.content as string };
						} else if (msg instanceof AIMessage) {
							return { role: 'assistant', content: msg.content as string };
						} else {
							return { role: 'system', content: msg.content as string };
						}
					});

					const requestBody = {
						model: modelName || 'glm-4.7-flash',
						messages: requestMessages,
						thinking: { type: dto.thinking || 'enabled' }, // 'enabled' | 'disabled'
						stream: dto.stream || true,
						max_tokens: dto.max_tokens || 65536,
						temperature: dto.temperature || 0.2, // [0.0, 1.0]
					};

					const url = `${baseURL}/chat/completions`;

					const response = await fetch(url, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${apiKey}`,
						},
						body: JSON.stringify(requestBody),
						signal: abortController.signal,
					});

					if (!response.ok) {
						const errorText = await response.text();
						throw new HttpException(
							`智谱 API 请求失败：${response.status} ${response.statusText} - ${errorText}`,
							response.status,
						);
					}

					const reader = response.body?.getReader();

					if (!reader) {
						throw new HttpException(
							'无法读取响应流',
							HttpStatus.INTERNAL_SERVER_ERROR,
						);
					}

					const decoder = new TextDecoder();
					let fullContent = '';

					try {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;

							const chunk = decoder.decode(value);
							const lines = chunk
								.split('\n')
								.filter((line) => line.trim() !== '');

							for (const line of lines) {
								if (line.startsWith('data: ')) {
									const dataStr = line.slice(6);
									if (dataStr === '[DONE]') {
										// 流结束
										const aiMessage = new AIMessage(fullContent);
										this.conversationMemory.set(sessionId, [
											...allMessages,
											aiMessage,
										]);
										// 保存 AI 回复到队列（异步处理）
										if (dto.assistantMessage) {
											this.messageQueue
												.add('save-message', {
													sessionId,
													role: MessageRole.ASSISTANT,
													content: fullContent,
													attachments: [],
													parentId: dto.assistantMessage.parentId || null,
													isRegenerate: false,
													chatId: dto.assistantMessage.chatId,
													childrenIds: dto.assistantMessage.childrenIds || [],
													currentChatId: dto.assistantMessage.chatId,
												})
												.catch((dbError) => {
													console.error(
														'Failed to add assistant message job to queue:',
														dbError,
													);
												});
										} else {
											// 如果没有传递 assistantMessage，使用默认逻辑
											this.messageQueue
												.add('save-message', {
													sessionId,
													role: MessageRole.ASSISTANT,
													content: fullContent,
													attachments: [],
													parentId: null, // 异步模式下 ID 获取受限
													isRegenerate: false,
													chatId: undefined,
													childrenIds: [],
													currentChatId: undefined,
												})
												.catch((dbError) => {
													console.error(
														'Failed to add assistant message job to queue:',
														dbError,
													);
												});
										}
										subscriber.complete();
										return;
									}

									const streamData = this.parseZhipuStreamData(dataStr);
									if (streamData) {
										subscriber.next(streamData);
										// 只累积内容类型的数据到完整响应中
										if (streamData.type === 'content') {
											fullContent += streamData.data;
										}
									}
								}
							}
						}
					} finally {
						reader.releaseLock();
					}
				} catch (error) {
					subscriber.error(error);
				}
			})();
		});
	}

	// deepseek 非流失对话
	async chat(dto: ChatRequestDto): Promise<any> {
		const llm = this.initModel({
			temperature: dto.temperature,
			maxTokens: dto.max_tokens,
		});
		const sessionId = dto.sessionId || randomUUID();

		// 处理文件附件
		let enhancedMessages = [...dto.messages];
		if (dto.attachments && dto.attachments?.length > 0) {
			const filePaths = dto.attachments.map((file) => file.path);
			const fileContent = await this.processFileAttachments(filePaths);
			if (fileContent) {
				// 创建包含文件内容的系统消息
				const fileSystemMessage: ChatMessageDto = {
					role: 'system',
					content: `${fileContent}\n请根据文件内容回答用户问题。`,
				};
				// 将系统消息插入到消息数组的开头
				enhancedMessages = [fileSystemMessage, ...enhancedMessages];
			}
		}

		let history: (HumanMessage | SystemMessage | AIMessage)[] = [];
		if (dto.sessionId && this.conversationMemory.has(dto.sessionId)) {
			history = this.conversationMemory.get(dto.sessionId) || [];
		}

		const newMessages = this.convertToLangChainMessages(enhancedMessages);
		const allMessages = [...history, ...newMessages];

		// 保存用户消息到队列（异步处理，不阻塞响应）
		const lastUserMessage = enhancedMessages.find((msg) => msg.role === 'user');

		if (lastUserMessage && dto.userMessage) {
			// 使用前端传递的 userMessage 数据添加到队列
			try {
				await this.messageQueue
					.add('save-message', {
						sessionId,
						role: MessageRole.USER,
						content: lastUserMessage.content,
						attachments: dto.attachments,
						parentId: dto.userMessage.parentId || null,
						isRegenerate: false,
						chatId: dto.userMessage.chatId,
						childrenIds: dto.userMessage.childrenIds || [],
						currentChatId: dto.userMessage.chatId,
					})
					.catch((dbError) => {
						console.error('Failed to add user message job to queue:', dbError);
					});
			} catch (error) {
				console.error('Error processing message:', error);
			}
		}

		const response = await llm.invoke(allMessages);
		const responseContent = response.content as string;

		const aiMessage = new AIMessage(responseContent);
		this.conversationMemory.set(sessionId, [...allMessages, aiMessage]);

		// 保存 AI 回复到队列（异步处理）
		if (dto.assistantMessage) {
			await this.messageQueue
				.add('save-message', {
					sessionId,
					role: MessageRole.ASSISTANT,
					content: responseContent,
					attachments: [],
					parentId: dto.assistantMessage.parentId || null,
					isRegenerate: false,
					chatId: dto.assistantMessage.chatId,
					childrenIds: dto.assistantMessage.childrenIds || [],
					currentChatId: dto.assistantMessage.chatId,
				})
				.catch((dbError) => {
					console.error(
						'Failed to add assistant message job to queue:',
						dbError,
					);
				});
		} else {
			// 如果没有传递 assistantMessage，使用默认逻辑
			// 注意：这里无法直接获取 savedUserMessage?.id，因为保存是异步的。
			// 如果需要强关联 parentId，需要在 Processor 中通过时间戳或额外逻辑处理，
			// 或者在此处暂时传 null，由后端服务后续修正。
			// 为了保持原有逻辑最小改动，此处 parentId 暂设为 null 或依赖前端传递
			await this.messageQueue
				.add('save-message', {
					sessionId,
					role: MessageRole.ASSISTANT,
					content: responseContent,
					attachments: [],
					parentId: null, // 异步模式下难以即时获取刚插入的用户消息 ID
					isRegenerate: false,
					chatId: undefined,
					childrenIds: [],
					currentChatId: undefined,
				})
				.catch((dbError) => {
					console.error(
						'Failed to add assistant message job to queue:',
						dbError,
					);
				});
		}

		return {
			content: responseContent,
			sessionId,
			finishReason: 'stop',
		};
	}
}
