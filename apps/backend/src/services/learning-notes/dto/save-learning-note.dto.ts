import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SaveLearningNoteDto {
	@IsOptional()
	@IsString()
	@MaxLength(200)
	title?: string;

	@IsString()
	@MaxLength(5_000_000)
	content!: string;

	/** 新建笔记粘贴图片用的上传会话；保存时结算未写入正文的孤儿图 */
	@IsOptional()
	@IsUUID()
	uploadSessionId?: string;
}
