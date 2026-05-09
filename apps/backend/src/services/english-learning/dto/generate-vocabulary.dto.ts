import {
	IsIn,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

/** 按需求生成单词学习资料（主题 + 难度 + 数量） */
export class GenerateVocabularyDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	topic!: string;

	@IsOptional()
	@IsInt()
	@Min(3)
	@Max(3000)
	count?: number;

	/** 与前端档位一致：基础 / 进阶 / 提高 */
	@IsOptional()
	@IsIn(['basic', 'intermediate', 'advanced'])
	level?: 'basic' | 'intermediate' | 'advanced';
}
