import {
	BadRequestException,
	Body,
	ClassSerializerInterceptor,
	Controller,
	Post,
	Res,
	StreamableFile,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtGuard } from 'src/guards/jwt.guard';
import { MinimaxTtsDto } from './dto/minimax-tts.dto';
import { MinimaxTtsService } from './minimax-tts.service';
import { SiliconflowTranscriptionService } from './siliconflow-transcription.service';

/**
 * 语音转文字 HTTP 接口（与 Chat / Knowledge 等业务解耦，仅做上传与 ASR）。
 */
@Controller('speech-transcription')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtGuard)
export class SpeechTranscriptionController {
	constructor(
		private readonly siliconflowTranscriptionService: SiliconflowTranscriptionService,
		private readonly minimaxTtsService: MinimaxTtsService,
	) {}

	/**
	 * 上传录音文件，返回识别文本。multipart 字段名：file
	 */
	@Post('transcription')
	@UseInterceptors(
		FileInterceptor('file', {
			storage: memoryStorage(),
			limits: { fileSize: 25 * 1024 * 1024 },
		}),
	)
	async transcribe(@UploadedFile() file: Express.Multer.File) {
		if (!file?.buffer?.length) {
			throw new BadRequestException('请上传有效的音频文件');
		}
		return this.siliconflowTranscriptionService.transcribe(file);
	}

	/** 文本转语音（硅基 CosyVoice2 等），返回 MP3 流 */
	@Post('speech')
	async speech(@Body() body: { text?: string }) {
		const text = typeof body?.text === 'string' ? body.text.trim() : '';
		if (!text) {
			throw new BadRequestException('请提供有效的 text');
		}
		const buffer =
			await this.siliconflowTranscriptionService.synthesizeSpeech(text);
		return new StreamableFile(buffer, { type: 'audio/mpeg' });
	}

	/**
	 * MiniMax T2A 非流式：默认 speech-2.8-hd + English_captivating_female1，请求体可覆盖音色/语速等。
	 * @see https://platform.minimaxi.com/docs/api-reference/speech-t2a-http
	 */
	@Post('minimax/speech')
	async minimaxSpeech(@Body() body: MinimaxTtsDto) {
		console.log('minimaxSpeech body', body);
		const resolved = this.minimaxTtsService.resolveOptions(body);
		const buffer = await this.minimaxTtsService.synthesizeSpeech(body);
		return new StreamableFile(buffer, {
			type: this.minimaxTtsService.resolveContentType(resolved.format),
		});
	}

	/**
	 * MiniMax T2A 流式：chunked 二进制音频，前端可在首包到达后尽早开始播放。
	 */
	@Post('minimax/speech/stream')
	async minimaxSpeechStream(
		@Body() body: MinimaxTtsDto,
		@Res({ passthrough: false }) res: Response,
	) {
		const resolved = this.minimaxTtsService.resolveOptions(body);
		res.status(200);
		res.setHeader(
			'Content-Type',
			this.minimaxTtsService.resolveContentType(resolved.format),
		);
		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('X-Content-Type-Options', 'nosniff');

		try {
			for await (const chunk of this.minimaxTtsService.streamSpeech(body)) {
				res.write(chunk);
			}
		} catch (err) {
			if (!res.headersSent) {
				throw err;
			}
			res.end();
			return;
		}
		res.end();
	}
}
