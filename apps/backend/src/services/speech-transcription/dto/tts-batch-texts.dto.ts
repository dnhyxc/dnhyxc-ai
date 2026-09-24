import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsString,
	MaxLength,
} from 'class-validator';

/** 练习预取：单次 HTTP 最多条数（与滑动窗口 ahead 对齐） */
export const TTS_PREFETCH_BATCH_MAX = 8;

/** 批量合成共用 texts 字段 */
export class TtsBatchTextsDto {
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(TTS_PREFETCH_BATCH_MAX)
	@IsString({ each: true })
	@MaxLength(10_000, { each: true })
	texts!: string[];
}
