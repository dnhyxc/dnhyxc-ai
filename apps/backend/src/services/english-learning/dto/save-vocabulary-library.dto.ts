import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	ValidateNested,
} from 'class-validator';
import { ENGLISH_VOCAB_GENERATION_MAX } from './generate-vocabulary.dto';

/** 单词库单条：与前端 EnglishVocabularyItem / 收藏 DTO 字段上限对齐 */
export class SaveVocabularyLibraryItemDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	word!: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(2000)
	ipa!: string;

	@IsOptional()
	@IsString()
	@MaxLength(64)
	pos?: string;

	@IsString()
	@MaxLength(8000)
	translationZh!: string;

	@IsString()
	@MaxLength(8000)
	example!: string;
}

/** 保存一整包到单词库（标题 + 词条数组） */
export class SaveVocabularyLibraryDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	title!: string;

	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(ENGLISH_VOCAB_GENERATION_MAX)
	@ValidateNested({ each: true })
	@Type(() => SaveVocabularyLibraryItemDto)
	items!: SaveVocabularyLibraryItemDto[];
}
