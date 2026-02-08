import { randomUUID } from 'node:crypto';
import {
	AIMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, Observable, Subject, takeUntil, throwError } from 'rxjs';
import { ModelEnum } from 'src/enum/config.enum';
import { parseFile } from '../../utils/file-parser';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ZhipuStreamData } from './dto/zhipu-stream-data.dto';

@Injectable()
export class ChatService {
	private readonly conversationMemory: Map<
		string,
		(HumanMessage | SystemMessage | AIMessage)[]
	> = new Map();

	// 存储会话的取消控制器
	private cancelControllers = new Map<string, Subject<void>>();
	// 存储正在进行的会话
	private activeSessions = new Map<string, boolean>();
	// 存储部分响应内容（用于继续生成）
	private partialResponses = new Map<string, string>();

	// 清理会话资源
	private cleanupSession(sessionId: string): void {
		this.cancelControllers.delete(sessionId);
		this.activeSessions.delete(sessionId);
		// 注意：partialResponses 不在这里清理，因为需要用于继续生成
	}

	constructor(private configService: ConfigService) {}

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

	private initDeepSeekLLM(options?: {
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

	async chat(dto: ChatRequestDto): Promise<any> {
		const llm = this.initDeepSeekLLM({
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

		const response = await llm.invoke(allMessages);
		const responseContent = response.content as string;

		const aiMessage = new AIMessage(responseContent);
		this.conversationMemory.set(sessionId, [...allMessages, aiMessage]);

		return {
			content: responseContent,
			sessionId,
			finishReason: 'stop',
		};
	}

	// 修改后的 chatStream 方法
	async chatStream(dto: ChatRequestDto): Promise<Observable<any>> {
		const llm = this.initDeepSeekLLM();
		const sessionId = dto.sessionId || randomUUID();

		// 如果已有相同会话的流，先取消它
		const existingCancelController = this.cancelControllers.get(sessionId);
		if (existingCancelController) {
			existingCancelController.next();
			existingCancelController.complete();
			this.cleanupSession(sessionId);
		}

		// 创建取消控制器
		const cancel$ = new Subject<void>();
		this.cancelControllers.set(sessionId, cancel$);
		this.activeSessions.set(sessionId, true);

		return new Observable<string>((subscriber) => {
			(async () => {
				try {
					// 获取部分响应（如果有）
					const partialContent = this.partialResponses.get(sessionId);

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

					let history: (HumanMessage | SystemMessage | AIMessage)[] = [];
					if (dto.sessionId && this.conversationMemory.has(dto.sessionId)) {
						history = this.conversationMemory.get(dto.sessionId) || [];
					}

					const newMessages = this.convertToLangChainMessages(enhancedMessages);
					const allMessages = [...history, ...newMessages];

					// 检查是否被取消
					if (cancel$.closed || subscriber.closed) {
						subscriber.complete();
						return;
					}

					const stream = await llm.stream(allMessages);
					let fullContent = '';

					// 在开始迭代前检查是否已取消
					if (cancel$.closed || subscriber.closed) {
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
							if (cancel$.closed || subscriber.closed) {
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
						if (cancel$.closed || subscriber.closed) {
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

					// 只有在正常完成时才保存消息
					const isCancelled = cancel$.closed || subscriber.closed;

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

					if (!isCancelled) {
						const aiMessage = new AIMessage(finalContent);
						this.conversationMemory.set(sessionId, [...allMessages, aiMessage]);
						// 清除部分响应（因为已经完成）
						this.partialResponses.delete(sessionId);
					} else {
						// 保存部分响应用于继续生成
						if (finalContent.length > 0) {
							this.partialResponses.set(sessionId, finalContent);
							// 将部分助手消息保存到对话记忆中
							const partialAiMessage = new AIMessage(finalContent);
							this.conversationMemory.set(sessionId, [
								...allMessages,
								partialAiMessage,
							]);
						}
					}

					subscriber.complete();
				} catch (error) {
					// 如果是取消操作，不视为错误
					if (cancel$.closed || subscriber.closed) {
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
			takeUntil(cancel$), // 当 cancel$ 发出时自动取消订阅
			catchError(() => {
				// 错误处理
				this.cleanupSession(sessionId);
				return throwError(() => new Error('Stream interrupted'));
			}),
		);
	}

	// 停止指定会话
	stopStream(sessionId: string): { success: boolean; message: string } {
		const cancelController = this.cancelControllers.get(sessionId);

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
		const partialContent = this.partialResponses.get(sessionId);
		if (!partialContent) {
			throw new Error('会话不存在或已完成');
		}

		// 清除部分响应，因为历史中已包含部分助手消息
		// 这样 chatStream 不会重复合并部分内容
		this.partialResponses.delete(sessionId);

		// 构建继续提示，不包含部分内容（部分内容已在历史中）
		const continuePrompt: ChatMessageDto = {
			role: 'user',
			content: `以下是你之前生成的部分回答：

\`\`\`
${partialContent}
\`\`\`

请继续你之前的回答，直接继续生成新的内容，不要以任何形式重复、总结或引用已经生成的内容。`,
		};

		// 创建继续请求 DTO
		const continueDto: ChatRequestDto = {
			sessionId,
			messages: [continuePrompt],
			filePaths: [],
			stream: true,
			max_tokens: 4096,
			temperature: 0.3, // 降低温度以减少随机性
		};

		// 调用现有的 chatStream 方法
		return this.chatStream(continueDto);
	}

	clearSession(sessionId: string): void {
		this.conversationMemory.delete(sessionId);
		this.partialResponses.delete(sessionId);
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

	create(_createChatDto: any) {
		return 'This action adds a new chat';
	}

	findAll() {
		return `This action returns all chat`;
	}

	findOne(id: number) {
		return `This action returns a #${id} chat`;
	}

	update(id: number, _updateChatDto: any) {
		return `This action updates a #${id} chat`;
	}

	remove(id: number) {
		return `This action removes a #${id} chat`;
	}
}
