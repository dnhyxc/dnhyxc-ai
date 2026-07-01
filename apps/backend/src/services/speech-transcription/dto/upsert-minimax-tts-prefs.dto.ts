import {
	IsBoolean,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';
import {
	MINIMAX_TTS_MODELS,
	type MinimaxTtsModel,
} from '../minimax-tts-models';

const MINIMAX_AUDIO_FORMATS = [
	'mp3',
	'pcm',
	'flac',
	'wav',
	'pcmu_raw',
	'pcmu_wav',
	'opus',
] as const;

const MINIMAX_LANGUAGE_BOOST = ['auto', 'English', 'Chinese'] as const;

/** 设置页保存的云端朗读偏好（不含 text） */
export class UpsertMinimaxTtsPrefsDto {
	@IsBoolean()
	enabled!: boolean;

	@IsString()
	@IsIn(['local', 'cloud', 'xfyun', 'edge'])
	playbackSource!: 'local' | 'cloud' | 'xfyun' | 'edge';

	@IsString()
	@MaxLength(64)
	@IsIn([...MINIMAX_TTS_MODELS])
	model!: MinimaxTtsModel;

	@IsString()
	@MaxLength(128)
	voiceId!: string;

	/** 讯飞发音人 vcn */
	@IsOptional()
	@IsString()
	@MaxLength(128)
	xfyunVoiceId?: string;

	/** Edge TTS 发音人 ShortName */
	@IsOptional()
	@IsString()
	@MaxLength(128)
	edgeVoiceId?: string;

	@IsNumber()
	@Min(0.5)
	@Max(2)
	minimaxSpeed!: number;

	@IsNumber()
	@Min(0.01)
	@Max(10)
	minimaxVol!: number;

	@IsInt()
	@Min(-12)
	@Max(12)
	minimaxPitch!: number;

	@IsNumber()
	@Min(0)
	@Max(100)
	xfyunSpeed!: number;

	@IsNumber()
	@Min(0)
	@Max(100)
	xfyunVolume!: number;

	@IsInt()
	@Min(0)
	@Max(100)
	xfyunPitch!: number;

	@IsNumber()
	@Min(0.5)
	@Max(2)
	edgeSpeed!: number;

	@IsNumber()
	@Min(0.01)
	@Max(10)
	edgeVol!: number;

	@IsInt()
	@Min(-12)
	@Max(12)
	edgePitch!: number;

	/** 空字符串表示不传 emotion */
	@IsOptional()
	@IsString()
	@MaxLength(32)
	emotion?: string;

	@IsString()
	@IsIn(MINIMAX_AUDIO_FORMATS)
	format!: (typeof MINIMAX_AUDIO_FORMATS)[number];

	@IsString()
	@IsIn(MINIMAX_LANGUAGE_BOOST)
	languageBoost!: (typeof MINIMAX_LANGUAGE_BOOST)[number];

	@IsInt()
	@Min(8000)
	@Max(44_100)
	sampleRate!: number;

	@IsInt()
	@Min(32_000)
	@Max(256_000)
	bitrate!: number;

	@IsInt()
	@IsIn([1, 2])
	channel!: number;

	/** 讯飞 APPID；空表示使用服务端环境变量 */
	@IsOptional()
	@IsString()
	@MaxLength(64)
	xfyunAppId?: string;

	@IsOptional()
	@IsString()
	@MaxLength(128)
	xfyunApiKey?: string;

	@IsOptional()
	@IsString()
	@MaxLength(128)
	xfyunApiSecret?: string;

	/** MiniMax API Key；空表示使用服务端环境变量 */
	@IsOptional()
	@IsString()
	@MaxLength(256)
	minimaxApiKey?: string;
}
