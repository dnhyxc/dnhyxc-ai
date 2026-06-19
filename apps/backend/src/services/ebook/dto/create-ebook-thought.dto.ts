import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateEbookThoughtDto {
	@IsUUID()
	bookId: string;

	@IsString()
	@MinLength(1)
	@MaxLength(8192)
	cfiRange: string;

	@IsString()
	@MinLength(1)
	@MaxLength(8192)
	quote: string;

	@IsString()
	@MinLength(1)
	@MaxLength(16384)
	content: string;
}
