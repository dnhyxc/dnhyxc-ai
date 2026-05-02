import {
	BadRequestException,
	ClassSerializerInterceptor,
	Controller,
	Post,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtGuard } from 'src/guards/jwt.guard';
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
}
