import {
	IsBoolean,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

/** Microsoft Edge 在线语音合成（@andresaya/edge-tts）请求体 */
export class EdgeTtsDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(10_000)
	text!: string;

	/** Edge 发音人 ShortName，如 zh-CN-XiaoxiaoNeural */
	@IsOptional()
	@IsString()
	@MaxLength(128)
	voice?: string;

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

	/** 为 true 时写读 Redis/uploads/tts；默认 false（听书等不落盘） */
	@IsOptional()
	@IsBoolean()
	persistDisk?: boolean;

	/**
	 * 稳定落盘目录键（如 vocab_<libraryId> / 收藏）；勿传可变库标题。
	 * persistDisk 时落盘到 uploads/tts/<消毒后目录>/
	 */
	@IsOptional()
	@IsString()
	@MaxLength(120)
	cacheFolder?: string;

	/** 当前展示标题；仅写 _meta.json，不进路径/Redis 指纹 */
	@IsOptional()
	@IsString()
	@MaxLength(200)
	cacheTitle?: string;
}
