import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';

export class PracticeReviewQueueQueryDto {
	@IsIn(['vocab', 'classic'])
	contentKind!: 'vocab' | 'classic';

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	count?: number;

	/** 逗号分隔，本轮已练条目 key */
	@IsOptional()
	@IsString()
	@MaxLength(8000)
	excludeKeys?: string;
}

export class PracticeReviewRecordItemDto {
	@IsIn(['vocab', 'classic'])
	contentKind!: 'vocab' | 'classic';

	@IsString()
	@MaxLength(200)
	itemKey!: string;

	@IsBoolean()
	correct!: boolean;
}

export class PracticeReviewRecordDto {
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => PracticeReviewRecordItemDto)
	attempts!: PracticeReviewRecordItemDto[];
}
