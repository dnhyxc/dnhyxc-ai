import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsOptional,
	IsString,
	MaxLength,
	ValidateNested,
} from 'class-validator';
import { ENGLISH_PRACTICE_SESSION_MAX } from '../constant';

/** 经典句看中写：请求按已分词列表标注词性 / IPA / 释义 */
export class AnnotateSentenceWordsDto {
	@IsString()
	@MaxLength(2000)
	english!: string;

	/** 与前端分词一致的词序列（保留原大小写） */
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(80)
	@IsString({ each: true })
	@MaxLength(64, { each: true })
	words!: string[];
}

/** 练习开局批量标注（与单次题量上限对齐） */
export class AnnotateSentenceWordsBatchDto {
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(ENGLISH_PRACTICE_SESSION_MAX)
	@ValidateNested({ each: true })
	@Type(() => AnnotateSentenceWordsDto)
	items!: AnnotateSentenceWordsDto[];

	/** 仅查库返回命中；miss 不调模型（开局先灌前端） */
	@IsOptional()
	@IsBoolean()
	@Type(() => Boolean)
	cacheOnly?: boolean;
}
