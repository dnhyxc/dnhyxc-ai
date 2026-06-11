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

const MINIMAX_TTS_MODELS = [
	'speech-2.8-hd',
	'speech-2.8-turbo',
	'speech-2.6-hd',
	'speech-2.6-turbo',
	'speech-02-hd',
	'speech-02-turbo',
	'speech-01-hd',
	'speech-01-turbo',
] as const;

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
	@IsIn(['local', 'cloud'])
	playbackSource!: 'local' | 'cloud';

	@IsString()
	@IsIn(MINIMAX_TTS_MODELS)
	model!: (typeof MINIMAX_TTS_MODELS)[number];

	@IsString()
	@MaxLength(128)
	voiceId!: string;

	@IsNumber()
	@Min(0.5)
	@Max(2)
	speed!: number;

	@IsNumber()
	@Min(0.01)
	@Max(10)
	vol!: number;

	@IsInt()
	@Min(-12)
	@Max(12)
	pitch!: number;

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
}
