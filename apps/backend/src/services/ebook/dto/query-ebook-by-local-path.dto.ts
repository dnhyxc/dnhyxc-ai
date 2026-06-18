import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class QueryEbookByLocalPathDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(1024)
	path: string;
}
