import {
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	Min,
} from 'class-validator';

export class SaveEbookProgressDto {
	@IsUUID()
	bookId: string;

	@IsOptional()
	@IsString()
	epubCfi?: string;

	@IsOptional()
	@IsNumber()
	@Min(0)
	pdfPage?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	percent?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	chapterIndex?: number;

	@IsOptional()
	@IsString()
	chapterHref?: string;

	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(1)
	scrollPercent?: number;
}
