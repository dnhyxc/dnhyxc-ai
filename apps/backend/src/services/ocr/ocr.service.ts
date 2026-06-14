import http from 'node:http';
import https from 'node:https';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { createLlm } from '../../utils/create-llm';
import { resolveAttachmentBuffer } from '../../utils/file-parser';
import { CreateOcrDto } from './dto/create-ocr.dto';

@Injectable()
export class OcrService {
	constructor(
		// 注入数据库模型，便于操作数据库
		// @InjectRepository(Ocr) private readonly ocrRepository: Repository<Ocr>,
		private configService: ConfigService,
	) {}

	/** 固定使用 GLM_API_KEY / GLM_BASE_URL + GLM-4.6V-Flash（createLlm preset: ocr） */
	private async createOcrLlm(): Promise<ChatOpenAI> {
		return createLlm(this.configService, {
			preset: 'ocr',
			temperature: 0,
			defaultTemperature: 0,
			maxTokens: 4096,
			streaming: true,
		});
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

	/** 支持 https 绝对地址与 /images、/files 相对路径（读本地 uploads） */
	async pathOrUrlToDataUrl(pathOrUrl: string): Promise<string> {
		if (/^https?:\/\//i.test(pathOrUrl)) {
			return (await this.urlToBase64Node(pathOrUrl)) as string;
		}

		const buffer = await resolveAttachmentBuffer(pathOrUrl);
		const lower = pathOrUrl.toLowerCase();
		let contentType = 'application/octet-stream';
		if (lower.includes('.png')) contentType = 'image/png';
		else if (lower.includes('.webp')) contentType = 'image/webp';
		else if (lower.includes('.gif')) contentType = 'image/gif';
		else if (/\.jpe?g($|\?)/i.test(lower)) contentType = 'image/jpeg';

		return `data:${contentType};base64,${buffer.toString('base64')}`;
	}

	async imageOcrStream(
		dto: CreateOcrDto,
		_userId?: number,
	): Promise<string | Observable<string>> {
		try {
			const llm = await this.createOcrLlm();

			const systemPrompt =
				'You are a professional OCR and image understanding assistant. Please analyze the provided image and extract all visible text, numbers, and other content accurately. Return the extracted content in a structured format.';

			const base64Image = await this.pathOrUrlToDataUrl(dto.url);

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

			if (dto.stream) {
				// 返回 Observable 流
				return new Observable<string>((subscriber) => {
					llm
						.stream(messages)
						.then(async (stream) => {
							try {
								for await (const chunk of stream) {
									// 提取文本内容
									const content = chunk.content;
									if (typeof content === 'string') {
										subscriber.next(content);
									}
								}
								subscriber.complete();
							} catch (error) {
								subscriber.error(error);
							}
						})
						.catch((error) => {
							subscriber.error(error);
						});
				});
			} else {
				const res = await llm.invoke(messages);
				return res.content as string;
			}
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
