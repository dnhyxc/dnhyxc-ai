import { IsString, MaxLength } from 'class-validator';

export class UpdateKnowledgeCommentDto {
	@IsString()
	@MaxLength(1000)
	content!: string;
}
