import { IsInt, Min } from 'class-validator';

/** 更新单词库 / 语句库词条列表续读 offset（页起点） */
export class UpdateLibraryItemsResumeDto {
	@IsInt()
	@Min(0)
	offset!: number;
}
