import {
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
}
