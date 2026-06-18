import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class AssignEbookCategoryDto {
	@ValidateIf((_o, v) => v !== null)
	@IsOptional()
	@IsUUID()
	categoryId: string | null;
}
