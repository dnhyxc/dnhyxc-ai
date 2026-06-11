import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MinimaxTtsService } from './minimax-tts.service';
import { MinimaxTtsPrefsController } from './minimax-tts-prefs.controller';
import { MinimaxTtsPrefsService } from './minimax-tts-prefs.service';
import { MinimaxTtsUserConfig } from './minimax-tts-user-config.entity';
import { SiliconflowTranscriptionService } from './siliconflow-transcription.service';
import { SpeechTranscriptionController } from './speech-transcription.controller';

/**
 * 公共语音：硅基 ASR/TTS + MiniMax 流式 TTS；HTTP 路由 + 可导出 Service 供其它模块注入。
 */
@Module({
	imports: [TypeOrmModule.forFeature([MinimaxTtsUserConfig])],
	controllers: [SpeechTranscriptionController, MinimaxTtsPrefsController],
	providers: [
		SiliconflowTranscriptionService,
		MinimaxTtsService,
		MinimaxTtsPrefsService,
	],
	exports: [
		SiliconflowTranscriptionService,
		MinimaxTtsService,
		MinimaxTtsPrefsService,
	],
})
export class SpeechTranscriptionModule {}
