import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateKnowledgeCommentDto {
	@IsString()
	@MaxLength(1000)
	content!: string;

	/** 被点的行。服务端会抬到根，客户端不能指定受众。 */
	@IsOptional()
	@IsUUID()
	parentId?: string;
}
