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
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import { ENGLISH_PRACTICE_SESSION_MAX } from '../constant';

export class PracticeReportItemDto {
	@IsString()
	@MaxLength(200)
	itemKey!: string;

	@IsIn(['vocab', 'classic'])
	contentKind!: 'vocab' | 'classic';

	@IsString()
	@MaxLength(12000)
	userInput!: string;

	@IsBoolean()
	correct!: boolean;

	@IsString()
	@MaxLength(12000)
	answerText!: string;

	@IsString()
	@MaxLength(8000)
	translationZh!: string;

	@IsOptional()
	@IsString()
	@MaxLength(500)
	ipa?: string;

	@IsOptional()
	@IsString()
	@MaxLength(64)
	pos?: string;
}

export class CreatePracticeReportDto {
	@IsUUID('4')
	reportId!: string;

	@IsIn(['vocab', 'classic'])
	contentKind!: 'vocab' | 'classic';

	@IsIn(['dictation', 'spelling'])
	mode!: 'dictation' | 'spelling';

	@IsString()
	@MaxLength(32)
	source!: string;

	@IsIn(['random', 'sequential'])
	order!: 'random' | 'sequential';

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(ENGLISH_PRACTICE_SESSION_MAX)
	count!: number;

	@IsOptional()
	@IsString()
	@MaxLength(200)
	sourceTitle?: string;

	@IsString()
	@MaxLength(240)
	title!: string;

	@IsOptional()
	@IsBoolean()
	isRetryWrong?: boolean;

	@IsOptional()
	@IsIn(['manual', 'auto'])
	saveMode?: 'manual' | 'auto';

	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(ENGLISH_PRACTICE_SESSION_MAX)
	@ValidateNested({ each: true })
	@Type(() => PracticeReportItemDto)
	items!: PracticeReportItemDto[];
}

export class PracticeReportListQueryDto {
	@IsOptional()
	@IsIn(['vocab', 'classic'])
	contentKind?: 'vocab' | 'classic';

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset?: number;
}

export class PracticeReportRemoveBatchDto {
	@IsArray()
	@ArrayMaxSize(3000)
	@IsUUID('4', { each: true })
	ids!: string[];
}
