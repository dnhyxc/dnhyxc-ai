import { IsBoolean } from 'class-validator';

export class UpdateKnowledgeVisibilityDto {
	@IsBoolean()
	isPublic!: boolean;
}
