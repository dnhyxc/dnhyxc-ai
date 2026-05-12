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

/** 按需求生成单词学习资料（主题 + 数量） */
export class GenerateVocabularyDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	topic!: string;

	@IsOptional()
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

	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(ENGLISH_CLASSIC_QUOTES_GENERATION_MAX)
	count?: number;
}
