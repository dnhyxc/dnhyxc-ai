import { Module } from '@nestjs/common';
import { SiliconflowTranscriptionService } from './siliconflow-transcription.service';
import { MinimaxTtsService } from './minimax-tts.service';
import { SpeechTranscriptionController } from './speech-transcription.controller';

/**
 * 公共语音模块：
 * - SiliconflowTranscriptionService：语音转文字（ASR）
 * - MinimaxTtsService：文字转语音（TTS，Minimax t2a_v3）
 */
@Module({
	controllers: [SpeechTranscriptionController],
	providers: [SiliconflowTranscriptionService, MinimaxTtsService],
	exports: [SiliconflowTranscriptionService, MinimaxTtsService],
})
export class SpeechTranscriptionModule {}
