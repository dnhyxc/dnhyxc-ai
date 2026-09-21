import {
	IsIn,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
} from 'class-validator';

export class CreateAnnotateSourceTaskDto {
	@IsIn(['library', 'pack'])
	source!: 'library' | 'pack';

	@IsOptional()
	@IsString()
	@MaxLength(64)
	libraryId?: string;

	@IsOptional()
	@IsString()
	@MaxLength(128)
	streamId?: string;

	@IsString()
	@MinLength(1)
	@MaxLength(200)
	title!: string;
}

export class AnnotateSourceTaskIdParamDto {
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	id!: string;
}
