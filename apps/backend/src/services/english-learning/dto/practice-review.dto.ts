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
import { VocabularyMistakeBatchItemDto } from './vocabulary-mistake.dto';

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

export class PracticeDailyQueueQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	count?: number;

	/** @deprecated 今日记词仅词汇库随机，间隔复习见 practice/review */
	@IsOptional()
	@IsIn(['library'])
	source?: 'library';

	@IsOptional()
	@IsString()
	@MaxLength(8000)
	excludeKeys?: string;
}

/** 今日记词场次结算：词汇库随机练完写入错题集、记词记录与 SRS */
export class PracticeDailyRecordDto {
	@IsIn(['library'])
	source!: 'library';

	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => PracticeReviewRecordItemDto)
	attempts!: PracticeReviewRecordItemDto[];

	/** source=library 时传入本轮练过的词条快照，用于加入错题集 */
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => VocabularyMistakeBatchItemDto)
	vocabItems?: VocabularyMistakeBatchItemDto[];
}
