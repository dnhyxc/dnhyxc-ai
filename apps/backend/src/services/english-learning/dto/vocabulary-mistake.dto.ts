import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested,
} from 'class-validator';
import { VocabularyFavoriteBodyDto } from './vocabulary-favorite.dto';

export class VocabularyMistakeBatchItemDto extends VocabularyFavoriteBodyDto {
	@IsOptional()
	@IsString()
	@MaxLength(500)
	lastUserInput?: string;
}

/** 结算页批量加入错题集（已存在词形跳过，不更新） */
export class VocabularyMistakeBatchDto {
	@IsArray()
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => VocabularyMistakeBatchItemDto)
	items!: VocabularyMistakeBatchItemDto[];
}

export class VocabularyMistakeRemoveDto {
	@IsUUID('4')
	id!: string;
}

export class VocabularyMistakeRemoveBatchDto {
	@IsArray()
	@ArrayMaxSize(3000)
	@IsUUID('4', { each: true })
	ids!: string[];
}
