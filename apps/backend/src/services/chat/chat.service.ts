import { randomUUID } from 'node:crypto';
import {
	AIMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { Cache } from '@nestjs/cache-manager';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, Observable, Subject } from 'rxjs';
import { ModelEnum } from 'src/enum/config.enum';
import { parseFile } from '../../utils/file-parser';
import { ChatMessages, MessageRole } from './chat.entity';
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

	// 存储正在进行的会话
	private activeSessions = new Map<string, boolean>();

	constructor(
		// 存储会话的取消控制器
		private configService: ConfigService,
		private cache: Cache,
		private messageService: MessageService,
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
		// 如果是结束标记，返回null
		if (dataStr.trim() === '[DONE]') {
			return null;
		}

		try {
			// 首先尝试直接解析JSON
			const data = JSON.parse(dataStr);

			// 智谱API流式响应格式 - 检查多种可能的字段结构
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

			// 处理reasoning_content数据（思考内容）
			if (data.choices?.[0]?.delta?.reasoning_content) {
				const reasoningContent = data.choices[0].delta.reasoning_content;
				return { type: 'thinking', data: reasoningContent };
			}

			// 处理tool_calls数据
			if (data.choices?.[0]?.delta?.tool_calls) {
				return { type: 'tool_calls', data: data.choices[0].delta.tool_calls };
			}

			if (data.choices?.[0]?.message?.tool_calls) {
				return { type: 'tool_calls', data: data.choices[0].message.tool_calls };
			}

			// 处理audio数据
			if (data.choices?.[0]?.message?.audio) {
				return { type: 'audio', data: data.choices[0].message.audio };
			}

			// 处理usage数据
			if (data.usage) {
				return { type: 'usage', data: data.usage };
			}

			// 处理video_result数据
			if (data.video_result) {
				return { type: 'video', data: data.video_result };
			}

			// 处理web_search数据
			if (data.web_search) {
				return { type: 'web_search', data: data.web_search };
			}

			// 处理content_filter数据
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
		attachments: { path: string }[],
		promptSuffix: string,
		role?: MessageRole,
	): Promise<ChatMessageDto | null> {
		if (!attachments || attachments.length === 0) {
			return null;
		}

		const filePaths = attachments.map((file) => file.path);
		const fileContent = await this.processFileAttachments(filePaths);

		if (!fileContent) {
			return null;
		}

		return {
			role: role || 'system',
			content: `以下是上传的附件内容:\n${fileContent}，\n${promptSuffix}`,
		};
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

		// 保存用户消息到数据库（使用前端传递的数据）
		const lastUserMessage = enhancedMessages.find((msg) => msg.role === 'user');
		let savedUserMessage: ChatMessages | null = null;

		if (lastUserMessage && dto.userMessage) {
			// 使用前端传递的 userMessage 数据
			savedUserMessage = await this.messageService
				.saveMessage({
					sessionId,
					role: MessageRole.USER,
					content: lastUserMessage.content,
					attachments: dto.attachments,
					parentId: dto.userMessage.parentId || null,
					isRegenerate: false,
					chatId: dto.userMessage.chatId, // chatId
					childrenIds: dto.userMessage.childrenIds || [], // childrenIds
					currentChatId: dto.userMessage.chatId, // currentChatId: 使用消息自己的chatId作为默认值
				})
				.catch((dbError) => {
					console.error('Failed to save user message to database:', dbError);
					return null;
				});
		}

		const response = await llm.invoke(allMessages);
		const responseContent = response.content as string;

		const aiMessage = new AIMessage(responseContent);
		this.conversationMemory.set(sessionId, [...allMessages, aiMessage]);

		// 保存AI回复到数据库（使用前端传递的数据）
		// 异步保存，不等待结果
		if (dto.assistantMessage) {
			await this.messageService
				.saveMessage({
					sessionId,
					role: MessageRole.ASSISTANT,
					content: responseContent,
					attachments: [],
					parentId: dto.assistantMessage.parentId || null,
					isRegenerate: false,
					chatId: dto.assistantMessage.chatId, // chatId
					childrenIds: dto.assistantMessage.childrenIds || [], // childrenIds
					currentChatId: dto.assistantMessage.chatId, // currentChatId: 使用消息自己的chatId作为默认值
				})
				.catch((dbError) => {
					console.error(
						'Failed to save assistant message to database:',
						dbError,
					);
				});
		} else {
			// 如果没有传递 assistantMessage，使用默认逻辑
			await this.messageService
				.saveMessage({
					sessionId,
					role: MessageRole.ASSISTANT,
					content: responseContent,
					attachments: [],
					parentId: savedUserMessage?.id,
					isRegenerate: false,
					chatId: undefined, // chatId
					childrenIds: [], // childrenIds
					currentChatId: undefined, // currentChatId
				})
				.catch((dbError) => {
					console.error(
						'Failed to save assistant message to database:',
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

	// deepseek 流式对话
	async chatStream(dto: ChatRequestDto): Promise<Observable<any>> {
		const llm = this.initModel({
			temperature: dto.temperature,
			maxTokens: dto.max_tokens,
		});
		const sessionId = dto.sessionId || randomUUID();

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
		// 缓存取消控制器，1天后自动过期并清除
		await this.cache.set(sessionId, cancel$, 12 * 60 * 60 * 1000);
		this.activeSessions.set(sessionId, true);

		// 保存用户消息到数据库（使用前端传递的数据）
		const lastUserMessage = dto.messages.find(
			(msg) => msg.role === 'user' && !msg.noSave,
		);

		let savedUserMessage: ChatMessages | null = null;

		if (lastUserMessage && dto.userMessage) {
			// 使用前端传递的 userMessage 数据
			savedUserMessage = await this.messageService
				.saveMessage({
					sessionId,
					role: MessageRole.USER,
					content: lastUserMessage.content,
					attachments: dto.attachments,
					parentId: dto.userMessage.parentId || null,
					isRegenerate: dto.isRegenerate || false,
					chatId: dto.userMessage.chatId, // chatId
					childrenIds: dto.userMessage.childrenIds || [], // childrenIds
					currentChatId: dto.userMessage.chatId, // currentChatId: 使用消息自己的chatId作为默认值
				})
				.catch((dbError) => {
					console.error('Failed to save user message to database:', dbError);
					return null;
				});
		}

		return new Observable<string>((subscriber) => {
			const getStreamStatus = () => cancel$.isStopped || subscriber.closed;
			(async () => {
				try {
					// 获取部分响应（如果有）
					const session = await this.messageService.findOneSession(sessionId);

					const partialContent = session?.partialContent;

					// 处理文件附件和消息准备（保持不变）
					let enhancedMessages = [...dto.messages];
					if (dto.attachments && dto.attachments?.length > 0) {
						// 这里之所以作为单独的 user 消息，而不是和下面的一样，作为 system 消息，是为了防止大模型已读乱回
						const attachmentMsg = await this.buildAttachmentMessage(
							dto.attachments,
							dto.messages?.[0]?.content,
							MessageRole.USER,
						);
						if (attachmentMsg) {
							enhancedMessages = [attachmentMsg];
						}
					}

					// 添加系统提示词：如果问题与之前的问题不相关，则忽略之前的问答
					const systemPrompt: ChatMessageDto = {
						role: 'system',
						content:
							`Focus on the latest user query and avoid redundancy. If the new question is unrelated to the conversation history, disregard prior context and answer independently based solely on the current input. Do not force connections to previous topics.`.trim(),
					};

					// 从 memeries.messages 中提取所有包含附件的消息，通过 ASC 排序，防止消息顺序错乱导致大模型已读乱回
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

					const newData = [
						systemPrompt,
						...(memeries?.messages || []),
						...uniqueEnhanced,
					];

					const allMessages = this.convertToLangChainMessages(newData);

					// 检查是否被取消
					if (getStreamStatus()) {
						subscriber.complete();
						return;
					}

					const stream = await llm.stream(allMessages);
					let fullContent = '';

					// 在开始迭代前检查是否已取消
					if (getStreamStatus()) {
						// 尝试取消大模型调用
						try {
							if (typeof stream.cancel === 'function') {
								await stream.cancel();
							}
						} catch (cancelError) {
							console.error('Failed to cancel LLM stream:', cancelError);
						}
						return;
					}

					let wasCancelledDuringIteration = false;

					try {
						for await (const chunk of stream) {
							// 每次迭代前检查是否被取消
							if (getStreamStatus()) {
								wasCancelledDuringIteration = true;
								break;
							}

							const content = chunk.content;

							if (typeof content === 'string') {
								subscriber.next(JSON.stringify({ content, sessionId }));
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

					// 计算最终内容，考虑部分响应
					let finalContent = fullContent;
					if (partialContent && partialContent.length > 0) {
						// 如果新生成的内容已经以部分内容开头，避免重复
						if (fullContent.startsWith(partialContent)) {
							finalContent = fullContent;
						} else {
							// 合并部分内容和新内容
							finalContent = partialContent + fullContent;
						}
					}

					// 正常完成，cancel$.isStopped 为 false, 暂停时 cancel$.isStopped 为 true
					if (!cancel$.isStopped) {
						// 保存完整的AI回复到数据库（使用前端传递的数据）
						if (dto.assistantMessage) {
							await this.messageService.saveMessage({
								sessionId,
								role: MessageRole.ASSISTANT,
								content: finalContent,
								attachments: [],
								parentId: dto.assistantMessage.parentId || null,
								isRegenerate: dto.isRegenerate || false,
								chatId: dto.assistantMessage.chatId, // chatId
								childrenIds: dto.assistantMessage.childrenIds || [], // childrenIds
								currentChatId: dto.assistantMessage.chatId, // currentChatId: 使用消息自己的chatId作为默认值
							});
						} else {
							// 如果没有传递 assistantMessage，使用默认逻辑
							await this.messageService.saveMessage({
								sessionId,
								role: MessageRole.ASSISTANT,
								content: finalContent,
								attachments: [],
								parentId: dto.parentId || savedUserMessage?.id,
								isRegenerate: dto.isRegenerate || false,
								chatId: undefined, // chatId
								childrenIds: [], // childrenIds
								currentChatId: undefined, // currentChatId
							});
						}
						// 清除部分响应（因为已经完成）更新会话的partialContent为null
						await this.messageService.updateSessionPartialContent(
							sessionId,
							null,
							null,
						);
					} else {
						// 保存部分响应用于继续生成
						if (finalContent.length > 0) {
							// 更新会话的partialContent
							await this.messageService.updateSessionPartialContent(
								sessionId,
								finalContent,
								lastUserMessage?.content || '',
							);
						}
					}

					subscriber.complete();
				} catch (error) {
					// 如果是取消操作，不视为错误
					if (cancel$.isStopped || subscriber.closed) {
						subscriber.complete();
					} else {
						subscriber.error(error);
					}
				} finally {
					// 清理资源
					this.cleanupSession(sessionId);
				}
			})();
		}).pipe(
			catchError((error) => {
				throw new HttpException(
					`模型调用异常: ${error}`,
					HttpStatus.BAD_REQUEST,
				);
			}),
		);
	}

	// 清理会话资源
	async cleanupSession(sessionId: string) {
		this.activeSessions.delete(sessionId);
		await this.cache.del(sessionId);
		// 注意：partialResponses 不在这里清理，因为需要用于继续生成
	}

	// 停止指定会话
	async stopStream(
		sessionId: string,
	): Promise<{ success: boolean; message: string }> {
		const cancelController = (await this.cache.get(sessionId)) as Subject<void>;

		if (!cancelController) {
			return {
				success: false,
				message: '会话不存在或已完成',
			};
		}

		// 发出取消信号
		cancelController.next();
		cancelController.complete();

		// 清理资源
		this.cleanupSession(sessionId);

		return {
			success: true,
			message: '已停止生成',
		};
	}

	// 继续生成指定会话
	async continueStream({
		sessionId,
		parentId,
		userMessage,
		assistantMessage,
		// currentChatId,
		isRegenerate,
	}: ChatContinueDto): Promise<Observable<any>> {
		const session = await this.messageService.findOneSession(sessionId);

		const partialContent = session?.partialContent;

		if (!partialContent) {
			throw new Error('会话不存在或已完成');
		}

		// 策略变更：只取最后一段内容作为上下文，强制模型只关注接续
		// 取最后 300 个字符（足够包含最近的上下文，又不足以让模型从头开始）
		const tailLength = 300;
		const tailContent =
			partialContent.length > tailLength
				? partialContent.slice(-tailLength)
				: partialContent;

		// 使用前端传递的用户消息内容，如果未提供则使用默认的继续提示
		const userContent =
			userMessage?.content ||
			`Response interrupted. Resume seamlessly from the breakpoint.

Last content:
...${tailContent}

Requirements:
1. Do NOT repeat any previous content. Continue directly from the last character.
2. Strictly maintain the same format, indentation, code style, and language.
3. Output ONLY the remaining content. No explanations, greetings, or markers.
`.trim();

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
			temperature: 0.3, // 降低温度以减少随机性
			parentId,
			userMessage,
			assistantMessage,
			isRegenerate,
		};

		// 调用现有的 chatStream 方法
		return this.chatStream(continueDto);
	}

	async clearSession(sessionId: string) {
		this.conversationMemory.delete(sessionId);
		await this.messageService.updateSessionPartialContent(
			sessionId,
			null,
			null,
		);
	}

	zhipuChatStream(dto: ChatRequestDto): Observable<ZhipuStreamData> {
		return new Observable<ZhipuStreamData>((subscriber) => {
			(async () => {
				try {
					const apiKey = this.configService.get(ModelEnum.ZHIPU_API_KEY);
					const modelName = this.configService.get(ModelEnum.ZHIPU_MODEL_NAME);
					const baseURL = this.configService.get(ModelEnum.ZHIPU_BASE_URL);

					if (!apiKey) {
						throw new Error('智谱API密钥未配置');
					}

					const sessionId = dto.sessionId || randomUUID();

					// 保存用户消息到数据库（使用前端传递的数据）
					const lastUserMessage = dto.messages.find(
						(msg) => msg.role === 'user',
					);
					let savedUserMessage: ChatMessages | null = null;

					if (lastUserMessage && dto.userMessage) {
						// 使用前端传递的 userMessage 数据
						savedUserMessage = await this.messageService
							.saveMessage({
								sessionId,
								role: MessageRole.USER,
								content: lastUserMessage.content,
								attachments: dto.attachments,
								parentId: dto.userMessage.parentId || null,
								isRegenerate: false, // isRegenerate: user 消息不是重新生成
								chatId: dto.userMessage.chatId, // chatId
								childrenIds: dto.userMessage.childrenIds || [], // childrenIds
								currentChatId: dto.userMessage.chatId, // currentChatId: 使用消息自己的chatId作为默认值
							})
							.catch((dbError) => {
								console.error(
									'Failed to save user message to database:',
									dbError,
								);
								return null;
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
					});

					if (!response.ok) {
						const errorText = await response.text();
						throw new HttpException(
							`智谱API请求失败: ${response.status} ${response.statusText} - ${errorText}`,
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
										// 保存AI回复到数据库（使用前端传递的数据）
										// 异步保存，不等待结果
										if (dto.assistantMessage) {
											this.messageService
												.saveMessage({
													sessionId,
													role: MessageRole.ASSISTANT,
													content: fullContent,
													attachments: [],
													parentId: dto.assistantMessage.parentId || null,
													isRegenerate: false, // isRegenerate: 正常回复
													chatId: dto.assistantMessage.chatId, // chatId
													childrenIds: dto.assistantMessage.childrenIds || [], // childrenIds
													currentChatId: dto.assistantMessage.chatId, // currentChatId: 使用消息自己的chatId作为默认值
												})
												.catch((dbError) => {
													console.error(
														'Failed to save assistant message to database:',
														dbError,
													);
												});
										} else {
											// 如果没有传递 assistantMessage，使用默认逻辑
											this.messageService
												.saveMessage({
													sessionId,
													role: MessageRole.ASSISTANT,
													content: fullContent,
													attachments: [],
													parentId: savedUserMessage?.id,
													isRegenerate: false, // isRegenerate: 正常回复
													chatId: undefined, // chatId
													childrenIds: [], // childrenIds
													currentChatId: undefined, // currentChatId
												})
												.catch((dbError) => {
													console.error(
														'Failed to save assistant message to database:',
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
}
