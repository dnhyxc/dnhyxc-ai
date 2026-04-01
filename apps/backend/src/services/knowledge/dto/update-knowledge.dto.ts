import { Type } from 'class-transformer';
import {
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
} from 'class-validator';

/** 更新知识库条目（字段均可选，但至少应传一项；由 Service 校验） */
export class UpdateKnowledgeDto {
	@IsNotEmpty()
	@IsUUID()
	id: string;

	@IsOptional()
	@IsString()
	@MaxLength(200)
	title?: string;

	@IsOptional()
	@IsString()
	@MaxLength(5_000_000)
	content?: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	author?: string;

	/** 与实体 `authorId: number | null` 一致；query/部分客户端会以字符串传参时用 Type 转换 */
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	authorId?: number;
}
