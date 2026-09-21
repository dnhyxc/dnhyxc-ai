import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 语句库整集词标注预热 */
export class AnnotateClassicLibraryDto {
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	libraryId!: string;

	/** 可选：绑定持久化任务，进度快照写库 */
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	taskId?: string;
}

/** Pack 历史/结果整集词标注预热 */
export class AnnotateClassicPackDto {
	@IsString()
	@MinLength(1)
	@MaxLength(128)
	streamId!: string;

	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	taskId?: string;
}
