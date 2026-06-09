import {
	BadRequestException,
	ClassSerializerInterceptor,
	Controller,
	Post,
	UploadedFile,
	UseGuards,
	UseInterceptors,
	HttpStatus,
	Res,
	Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtGuard } from 'src/guards/jwt.guard';
import { SiliconflowTranscriptionService } from './siliconflow-transcription.service';
import { MinimaxTtsService } from './minimax-tts.service';

/**
 * 语音接口：上传录音 -> 识别文本（STT）/ 文本 -> 音频（TTS）。
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

	/**
	 * 文本转语音（Minimax t2a_v3），优先推荐英文朗读。
	 * 响应体直接返回二进制音频（默认 mp3），前端可 new Audio(url).play() 或 URL.createObjectURL(blob) 播放。
	 */
	@Post('speech')
	async textToSpeech(
		@Body() body: { text: string; model?: string; voiceId?: string; speed?: number; vol?: number; pitch?: number; outputFormat?: 'mp3' | 'wav' | 'pcm' | 'flac' },
		@Res() res: Response,
	) {
		const text = typeof body?.text === 'string' ? body.text.trim() : '';
		if (!text) {
			throw new BadRequestException('请传入要朗读的文本');
		}
		const result = await this.minimaxTtsService.synthesize(text, {
			model: body.model,
			voiceId: body.voiceId,
			speed: body.speed,
			vol: body.vol,
			pitch: body.pitch,
			outputFormat: body.outputFormat,
		});
		res.status(HttpStatus.OK);
		res.setHeader('Content-Type', result.contentType);
		res.setHeader('Cache-Control', 'public, max-age=3600');
		res.setHeader('Accept-Ranges', 'bytes');
		res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
		res.send(result.buffer);
	}

	/**
	 * 查询 Minimax 配置状态（无需鉴权，仅提示是否可用，便于前端决定调用链路）。
	 */
	@Post('speech/status')
	async speechStatus() {
		return { available: this.minimaxTtsService.isConfigured() };
	}
}
