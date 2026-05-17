import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsNotEmpty,
	IsString,
	MaxLength,
	ValidateNested,
} from 'class-validator';
import { ENGLISH_CLASSIC_QUOTES_GENERATION_MAX } from './generate-vocabulary.dto';

/** 经典语句库单条：与前端 EnglishClassicQuoteItem 字段上限对齐 */
export class SaveClassicQuotesLibraryItemDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(8000)
	english!: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(8000)
	translationZh!: string;

	@IsString()
	@MaxLength(2000)
	source!: string;

	@IsString()
	@MaxLength(8000)
	noteZh!: string;
}

/** 保存一整包到经典语句库（标题 + 语句数组） */
export class SaveClassicQuotesLibraryDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	title!: string;

	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(ENGLISH_CLASSIC_QUOTES_GENERATION_MAX)
	@ValidateNested({ each: true })
	@Type(() => SaveClassicQuotesLibraryItemDto)
	items!: SaveClassicQuotesLibraryItemDto[];
}
