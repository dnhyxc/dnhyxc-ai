import http from 'node:http';
import https from 'node:https';
import {
	type ContentBlock,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ModelEnum } from 'src/enum/config.enum';
import { Repository } from 'typeorm';
import { CreateOcrDto } from './dto/create-ocr.dto';
import { Ocr } from './ocr.entity';

@Injectable()
export class OcrService {
	constructor(
		// 注入数据库模型，便于操作数据库
		@InjectRepository(Ocr) private readonly ocrRepository: Repository<Ocr>,
		private configService: ConfigService,
	) {}

	initLLM(): ChatOpenAI {
		const apiKey = this.configService.get(ModelEnum.QWEN_API_KEY);
		const baseURL = this.configService.get(ModelEnum.QWEN_BASE_URL);
		const modelName = this.configService.get(ModelEnum.QWEN_MODEL_NAME);

		const llm = new ChatOpenAI({
			apiKey,
			modelName,
			configuration: {
				baseURL,
			},
			temperature: 0,
			maxTokens: 4096,
		});

		return llm;
	}

	async urlToBase64Node(url: string) {
		return new Promise((resolve, reject) => {
			const protocol = url.startsWith('https') ? https : http;

			protocol
				.get(url, (response) => {
					const chunks: any[] = [];

					response.on('data', (chunk) => {
						chunks.push(chunk);
					});

					response.on('end', () => {
						const buffer = Buffer.concat(chunks);
						const base64 = buffer.toString('base64');

						// 获取 MIME 类型
						const contentType =
							response.headers['content-type'] || 'application/octet-stream';
						const dataUrl = `data:${contentType};base64,${base64}`;

						resolve(dataUrl);
					});
				})
				.on('error', reject);
		});
	}

	async imageOcr(dto: CreateOcrDto): Promise<string | (ContentBlock | Text)[]> {
		try {
			const llm = this.initLLM();

			const systemPrompt =
				'You are a professional OCR and image understanding assistant. Please analyze the provided image and extract all visible text, numbers, and other content accurately. Return the extracted content in a structured format.';

			const base64Image = await this.urlToBase64Node(dto.url);

			const messages = [
				new SystemMessage(systemPrompt),
				new HumanMessage({
					content: [
						{ type: 'image_url', image_url: { url: base64Image } },
						{
							type: 'text',
							text: dto.prompt || 'Please extract all text from this image.',
						},
					],
				}),
			];

			const response = await llm.invoke(messages);

			return response.content;
		} catch (error) {
			throw new InternalServerErrorException(error?.message || '解析失败');
		}
	}

	findAll() {
		return `This action returns all ocr`;
	}

	findOne(id: number) {
		return `This action returns a #${id} ocr`;
	}

	remove(id: number) {
		return `This action removes a #${id} ocr`;
	}
}
