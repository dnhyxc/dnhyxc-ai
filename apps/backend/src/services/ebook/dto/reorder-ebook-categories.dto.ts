import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderEbookCategoriesDto {
	@IsArray()
	@ArrayMinSize(1)
	@IsUUID('4', { each: true })
	orderedIds: string[];
}
