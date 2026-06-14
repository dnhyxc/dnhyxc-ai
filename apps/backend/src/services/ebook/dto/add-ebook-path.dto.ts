import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
