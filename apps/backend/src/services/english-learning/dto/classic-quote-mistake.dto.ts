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
import { ClassicQuoteFavoriteBodyDto } from './classic-quote-favorite.dto';

export class ClassicQuoteMistakeBatchItemDto extends ClassicQuoteFavoriteBodyDto {
	@IsOptional()
	@IsString()
	@MaxLength(12000)
	lastUserInput?: string;
}

/** 结算页批量加入语句错题集（已存在内容键：错拼不同则更新 lastUserInput） */
export class ClassicQuoteMistakeBatchDto {
	@IsArray()
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => ClassicQuoteMistakeBatchItemDto)
	items!: ClassicQuoteMistakeBatchItemDto[];
}

export class ClassicQuoteMistakeRemoveDto {
	@IsUUID('4')
	id!: string;
}

export class ClassicQuoteMistakeRemoveBatchDto {
	@IsArray()
	@ArrayMaxSize(3000)
	@IsUUID('4', { each: true })
	ids!: string[];
}
