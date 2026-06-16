import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateEbookTitleDto {
	@IsUUID()
	bookId: string;

	@IsString()
	@MinLength(1)
	@MaxLength(512)
	title: string;
}
