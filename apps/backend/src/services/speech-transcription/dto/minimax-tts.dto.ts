import {
	IsArray,
	IsBoolean,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

const MINIMAX_AUDIO_FORMATS = [
	'mp3',
	'pcm',
	'flac',
	'wav',
	'pcmu_raw',
	'pcmu_wav',
	'opus',
] as const;

/** MiniMax T2A `voice_setting.emotion`（与官网 8 项一致，不含 whisper） */
const MINIMAX_EMOTIONS = [
	'happy',
	'sad',
	'angry',
	'fearful',
	'disgusted',
	'surprised',
	'calm',
	'fluent',
] as const;

/** MiniMax T2A v2 请求体（环境变量为默认，DTO 字段可覆盖） */
export class MinimaxTtsDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(10_000)
	text!: string;

	@IsOptional()
	@IsString()
	@MaxLength(64)
	model?: string;

	@IsOptional()
	@IsString()
	@MaxLength(128)
	voiceId?: string;

	@IsOptional()
	@IsNumber()
	@Min(0.5)
	@Max(2)
	speed?: number;

	@IsOptional()
	@IsNumber()
	@Min(0.01)
	@Max(10)
	vol?: number;

	@IsOptional()
	@IsInt()
	@Min(-12)
	@Max(12)
	pitch?: number;

	@IsOptional()
	@IsIn(MINIMAX_EMOTIONS)
	emotion?: (typeof MINIMAX_EMOTIONS)[number];

	@IsOptional()
	@IsInt()
	@Min(8000)
	@Max(44100)
	sampleRate?: number;

	@IsOptional()
	@IsInt()
	@Min(32000)
	@Max(256000)
	bitrate?: number;

	@IsOptional()
	@IsIn(MINIMAX_AUDIO_FORMATS)
	format?: (typeof MINIMAX_AUDIO_FORMATS)[number];

	@IsOptional()
	@IsInt()
	@IsIn([1, 2])
	channel?: number;

	@IsOptional()
	@IsString()
	@MaxLength(32)
	languageBoost?: string;

	@IsOptional()
	@IsBoolean()
	subtitleEnable?: boolean;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	pronunciationTone?: string[];

	@IsOptional()
	@IsBoolean()
	textNormalization?: boolean;
}
