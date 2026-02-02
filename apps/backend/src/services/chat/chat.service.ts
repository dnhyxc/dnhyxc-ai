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
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';

@Injectable()
export class ChatService {
	private readonly conversationMemory: Map<
		string,
		(HumanMessage | SystemMessage | AIMessage)[]
	> = new Map();

	constructor(private configService: ConfigService) {}

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

	async chat(dto: ChatRequestDto): Promise<ChatResponseDto> {
		const llm = this.initDeepSeekLLM();
		const sessionId =
			dto.sessionId ||
			`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		let history: (HumanMessage | SystemMessage | AIMessage)[] = [];
		if (dto.sessionId && this.conversationMemory.has(dto.sessionId)) {
			history = this.conversationMemory.get(dto.sessionId) || [];
		}

		const newMessages = this.convertToLangChainMessages(dto.messages);
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

	chatStream(dto: ChatRequestDto): Observable<string> {
		const llm = this.initDeepSeekLLM();
		const sessionId =
			dto.sessionId ||
			`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		let history: (HumanMessage | SystemMessage | AIMessage)[] = [];
		if (dto.sessionId && this.conversationMemory.has(dto.sessionId)) {
			history = this.conversationMemory.get(dto.sessionId) || [];
		}

		const newMessages = this.convertToLangChainMessages(dto.messages);
		const allMessages = [...history, ...newMessages];

		return new Observable<string>((subscriber) => {
			llm
				.stream(allMessages)
				.then(async (stream) => {
					try {
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
				})
				.catch((error) => {
					subscriber.error(error);
				});
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
