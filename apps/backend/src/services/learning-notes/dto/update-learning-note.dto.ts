import {
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
} from 'class-validator';

export class UpdateLearningNoteDto {
	@IsNotEmpty()
	@IsUUID()
	id!: string;

	@IsOptional()
	@IsString()
	@MaxLength(200)
	title?: string;

	@IsOptional()
	@IsString()
	@MaxLength(5_000_000)
	content?: string;

	/** 本次编辑的上传会话；更新后结算未写入正文的孤儿图 */
	@IsOptional()
	@IsUUID()
	uploadSessionId?: string;
}
