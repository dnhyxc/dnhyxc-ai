import { Transform } from 'class-transformer';
import {
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

/** 单次拉取单词条数上限（与前端 VOCAB_COUNT_MAX 对齐） */
export const ENGLISH_VOCAB_GENERATION_MAX = 12000;

/** 单次拉取经典语句条数上限（与前端 ClassicQuotesSection 对齐） */
export const ENGLISH_CLASSIC_QUOTES_GENERATION_MAX = 6000;

/** 未传 count 时的默认条数（与前端 PACK_COUNT_DEFAULT、Agent AGENT_PACK_COUNT 对齐） */
export const ENGLISH_PACK_GENERATION_DEFAULT = 100;

/**
 * 解析单词包目标条数：未传 `count` 时默认 100；传入时夹在 [1, MAX]。
 */
export function resolveVocabularyPackTargetCount(
	count: number | undefined | null,
): number {
	if (count == null) return ENGLISH_PACK_GENERATION_DEFAULT;
	return Math.min(ENGLISH_VOCAB_GENERATION_MAX, Math.max(1, count));
}

/**
 * 解析经典句目标条数：未传 `count` 时默认 100；传入时夹在 [1, MAX]。
 */
export function resolveClassicQuotesPackTargetCount(
	count: number | undefined | null,
): number {
	if (count == null) return ENGLISH_PACK_GENERATION_DEFAULT;
	return Math.min(ENGLISH_CLASSIC_QUOTES_GENERATION_MAX, Math.max(1, count));
}

/** 按需求生成单词学习资料（主题 + 可选数量） */
export class GenerateVocabularyDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	topic!: string;

	/** 目标词数；省略则默认 ENGLISH_PACK_GENERATION_DEFAULT */
	@IsOptional()
	@Transform(({ value }) =>
		value === null || value === '' ? undefined : value,
	)
	@IsInt()
	@Min(1)
	@Max(ENGLISH_VOCAB_GENERATION_MAX)
	count?: number;
}

/** 经典语句拉取：字段与单词包相同，条数上限更低 */
export class GenerateClassicQuotesDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	topic!: string;

	/** 目标条数；省略则默认 ENGLISH_PACK_GENERATION_DEFAULT */
	@IsOptional()
	@Transform(({ value }) =>
		value === null || value === '' ? undefined : value,
	)
	@IsInt()
	@Min(1)
	@Max(ENGLISH_CLASSIC_QUOTES_GENERATION_MAX)
	count?: number;
}
