import {
	IsBoolean,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

/** 讯飞在线语音合成（WebSocket 流式）请求体 */
export class XfyunTtsDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(10_000)
	text!: string;

	/** 发音人 vcn，默认读环境变量 XFYUN_TTS_VCN */
	@IsOptional()
	@IsString()
	@MaxLength(64)
	vcn?: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(100)
	speed?: number;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(100)
	volume?: number;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(100)
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
