import { Module } from '@nestjs/common';
import { SiliconflowTranscriptionService } from './siliconflow-transcription.service';
import { SpeechTranscriptionController } from './speech-transcription.controller';

/**
 * 公共语音转写（硅基流动 ASR）：HTTP 路由 + 可导出 {@link SiliconflowTranscriptionService} 供其它模块注入。
 */
@Module({
	controllers: [SpeechTranscriptionController],
	providers: [SiliconflowTranscriptionService],
	exports: [SiliconflowTranscriptionService],
})
export class SpeechTranscriptionModule {}
