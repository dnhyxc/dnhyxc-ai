import {
	AIMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { ModelEnum } from 'src/enum/config.enum';
import { parseFile } from '../../utils/file-parser';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatRequestDto } from './dto/chat-request.dto';

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

		console.log('responseContent', responseContent);

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
