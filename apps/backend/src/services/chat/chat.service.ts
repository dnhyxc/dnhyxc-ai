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
			temperature: options?.temperature ?? 0.7,
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

	// deepseek 非流失对话
	async chat(dto: ChatRequestDto): Promise<any> {
		const llm = this.initModel({
			temperature: dto.temperature,
			maxTokens: dto.max_tokens,
		});
		const sessionId = dto.sessionId || randomUUID();

		// 处理文件附件
		let enhancedMessages = [...dto.messages];
		if (dto.filePaths && dto.filePaths.length > 0) {
			const fileContent = await this.processFileAttachments(dto.filePaths);
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

		// 保存用户消息到数据库
		let parentId: string | null = null;
		if (dto.sessionId) {
			const lastMessage = await this.messageService.findOneMessage(sessionId, {
				order: { createdAt: 'DESC' },
			});
			// const lastMessage = await this.chatMessagesRepository.findOne({
			// 	where: { session: { id: sessionId } },
			// 	order: { createdAt: 'DESC' },
			// });
			if (lastMessage) {
				parentId = lastMessage.id;
			}
		}

		const lastUserMessage = enhancedMessages.find((msg) => msg.role === 'user');
		let savedUserMessage: ChatMessages | null = null;

		if (lastUserMessage) {
			// 异步保存，不等待结果
			savedUserMessage = await this.messageService
				.saveMessage(
					sessionId,
					MessageRole.USER,
					lastUserMessage.content,
					dto.filePaths,
					parentId,
				)
				.catch((dbError) => {
					console.error('Failed to save user message to database:', dbError);
					return null;
				});
		}

		const response = await llm.invoke(allMessages);
		const responseContent = response.content as string;

		const aiMessage = new AIMessage(responseContent);
		this.conversationMemory.set(sessionId, [...allMessages, aiMessage]);

		// 保存AI回复到数据库
		// 异步保存，不等待结果
		await this.messageService
			.saveMessage(
				sessionId,
				MessageRole.ASSISTANT,
				responseContent,
				[],
				savedUserMessage?.id,
			)
			.catch((dbError) => {
				console.error('Failed to save assistant message to database:', dbError);
			});

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

		// 保存用户消息到数据库
		let parentId: string | null = null;

		if (dto.sessionId) {
			const lastMessage = await this.messageService.findOneMessage(
				dto.sessionId,
				{
					order: {
						createdAt: 'DESC',
					},
				},
			);
			if (lastMessage) {
				parentId = lastMessage.id;
			}
		}

		const lastUserMessage = dto.messages.find(
			(msg) => msg.role === 'user' && !msg.noSave,
		);

		let savedUserMessage: ChatMessages | null = null;

		if (lastUserMessage) {
			// 异步保存，不等待结果
			savedUserMessage = await this.messageService
				.saveMessage(
					sessionId,
					MessageRole.USER,
					lastUserMessage.content,
					dto.filePaths,
					parentId,
				)
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
					if (dto.filePaths && dto.filePaths.length > 0) {
						const fileContent = await this.processFileAttachments(
							dto.filePaths,
						);
						if (fileContent) {
							const fileSystemMessage: ChatMessageDto = {
								role: 'system',
								content: `以下是上传的文件内容:\n${fileContent}\n请根据文件内容回答用户问题。`,
							};
							enhancedMessages = [fileSystemMessage, ...enhancedMessages];
						}
					}

					const memeries = await this.messageService.findOneSession(sessionId, {
						relations: ['messages'],
					});

					// 根据 content 去重：保留 memeries.messages 中已有的，enhancedMessages 中 content 不重复的
					const existingKeySet = new Set(
						memeries?.messages.map((m) => `${m.role}::${m.content}`) || [],
					);
					const uniqueEnhanced = enhancedMessages.filter(
						(m) => !existingKeySet.has(`${m.role}::${m.content}`),
					);
					const newData = [...(memeries?.messages || []), ...uniqueEnhanced];

					const allMessages = this.convertToLangChainMessages(newData);

					// 检查是否被取消
					if (getStreamStatus()) {
						subscriber.complete();
						return;
					}

					console.log('allMessages:', allMessages);

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
						// 保存完整的AI回复到数据库
						await this.messageService.saveMessage(
							sessionId,
							MessageRole.ASSISTANT,
							finalContent,
							[],
							savedUserMessage?.id,
						);
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
				// console.error('Stream interrupted in catchError:', error);
				// // 注意：不在这里调用 cleanupSession，因为 finally 块已经处理了清理
				// return throwError(() => new Error('Stream interrupted'));
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
	async continueStream(sessionId: string): Promise<Observable<any>> {
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

		const continueMessages: ChatMessageDto[] = [
			{
				role: 'user',
				content: `你刚才的回答中断了，最后一部分内容如下：

...${tailContent}

请紧接着上面的内容继续生成剩余部分。
要求：
1. 严禁重复上面已经展示的内容。
2. 保持与上文完全一致的格式、缩进和风格。
3. 直接开始生成后续内容，不要输出任何解释性文字。`,
			},
		];

		// 创建继续请求 DTO
		const continueDto: ChatRequestDto = {
			sessionId,
			messages: continueMessages,
			stream: true,
			max_tokens: 4096,
			temperature: 0.3, // 降低温度以减少随机性
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

					// 保存用户消息到数据库
					let parentId: string | null = null;
					if (dto.sessionId) {
						const lastMessage = await this.messageService.findOneMessage(
							sessionId,
							{
								order: {
									createdAt: 'DESC',
								},
							},
						);
						if (lastMessage) {
							parentId = lastMessage.id;
						}
					}

					const lastUserMessage = dto.messages.find(
						(msg) => msg.role === 'user',
					);
					let savedUserMessage: ChatMessages | null = null;

					if (lastUserMessage) {
						// 异步保存，不等待结果
						savedUserMessage = await this.messageService
							.saveMessage(
								sessionId,
								MessageRole.USER,
								lastUserMessage.content,
								dto.filePaths,
								parentId,
							)
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
					if (dto.filePaths && dto.filePaths.length > 0) {
						const fileContent = await this.processFileAttachments(
							dto.filePaths,
						);
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
										// 保存AI回复到数据库
										// 异步保存，不等待结果
										this.messageService
											.saveMessage(
												sessionId,
												MessageRole.ASSISTANT,
												fullContent,
												[],
												savedUserMessage?.id,
											)
											.catch((dbError) => {
												console.error(
													'Failed to save assistant message to database:',
													dbError,
												);
											});
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
