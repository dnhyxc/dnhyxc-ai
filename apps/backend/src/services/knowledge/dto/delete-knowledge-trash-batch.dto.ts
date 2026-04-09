import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/** 回收站批量删除入参 */
export class DeleteKnowledgeTrashBatchDto {
	@IsArray()
	@ArrayMinSize(1)
	@IsUUID('all', { each: true })
	ids: string[];
}
