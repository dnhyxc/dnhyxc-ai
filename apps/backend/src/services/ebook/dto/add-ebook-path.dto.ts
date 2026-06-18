import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddEbookPathDto {
	@IsString()
	@MaxLength(1024)
	path: string;

	@IsIn(['epub', 'pdf'])
	fmt: 'epub' | 'pdf';

	@IsOptional()
	@IsString()
	@MaxLength(512)
	title?: string;

	@IsOptional()
	@IsUUID()
	categoryId?: string;
}
