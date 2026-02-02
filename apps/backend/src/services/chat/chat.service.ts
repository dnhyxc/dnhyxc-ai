import {
	AIMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
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

	private initDeepSeekLLM(): ChatOpenAI {
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
			temperature: 0.7,
			maxTokens: 4096,
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
		const llm = this.initDeepSeekLLM();
		const sessionId =
			dto.sessionId ||
			`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

		console.log('allMessages', allMessages);

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

	chatStream(dto: ChatRequestDto): Observable<string> {
		const llm = this.initDeepSeekLLM();

		const sessionId =
			dto.sessionId ||
			`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		return new Observable<string>((subscriber) => {
			// 异步处理文件附件和消息准备
			(async () => {
				try {
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

					const newMessages = this.convertToLangChainMessages(enhancedMessages);
					const allMessages = [...history, ...newMessages];

					// 开始流式传输
					const stream = await llm.stream(allMessages);

					let fullContent = '';

					for await (const chunk of stream) {
						const content = chunk.content;
						if (typeof content === 'string') {
							subscriber.next(content);
							fullContent += content;
						}
					}

					const aiMessage = new AIMessage(fullContent);
					this.conversationMemory.set(sessionId, [...allMessages, aiMessage]);

					subscriber.complete();
				} catch (error) {
					subscriber.error(error);
				}
			})();
		});
	}

	clearSession(sessionId: string): void {
		this.conversationMemory.delete(sessionId);
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

					const sessionId =
						dto.sessionId ||
						`session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

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

	create(createChatDto: any) {
		return 'This action adds a new chat';
	}

	findAll() {
		return `This action returns all chat`;
	}

	findOne(id: number) {
		return `This action returns a #${id} chat`;
	}

	update(id: number, updateChatDto: any) {
		return `This action updates a #${id} chat`;
	}

	remove(id: number) {
		return `This action removes a #${id} chat`;
	}
}
