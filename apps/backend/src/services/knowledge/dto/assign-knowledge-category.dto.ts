import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class AssignKnowledgeCategoryDto {
	@ValidateIf((_o, v) => v !== null)
	@IsOptional()
	@IsUUID()
	categoryId: string | null;
}
