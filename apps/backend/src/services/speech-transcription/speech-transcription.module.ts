import { Module } from '@nestjs/common';
import { MinimaxTtsService } from './minimax-tts.service';
import { SiliconflowTranscriptionService } from './siliconflow-transcription.service';
import { SpeechTranscriptionController } from './speech-transcription.controller';

/**
 * 公共语音：硅基 ASR/TTS + MiniMax 流式 TTS；HTTP 路由 + 可导出 Service 供其它模块注入。
 */
@Module({
	controllers: [SpeechTranscriptionController],
	providers: [SiliconflowTranscriptionService, MinimaxTtsService],
	exports: [SiliconflowTranscriptionService, MinimaxTtsService],
})
export class SpeechTranscriptionModule {}
