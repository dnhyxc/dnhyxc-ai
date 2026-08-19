import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderKnowledgeCategoriesDto {
	@IsArray()
	@ArrayMinSize(1)
	@IsUUID('4', { each: true })
	orderedIds: string[];
}
