import {
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

/** Microsoft Edge 在线语音合成（edge-tts-universal）请求体 */
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
}
