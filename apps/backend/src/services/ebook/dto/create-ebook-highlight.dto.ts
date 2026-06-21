import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const EBOOK_HIGHLIGHT_STYLES = [
	'highlight',
	'underline',
	'wavy',
] as const;

export const EBOOK_HIGHLIGHT_COLORS = [
	'pink',
	'purple',
	'blue',
	'green',
	'yellow',
] as const;

export class CreateEbookHighlightDto {
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

	@IsIn(EBOOK_HIGHLIGHT_STYLES)
	style: (typeof EBOOK_HIGHLIGHT_STYLES)[number];

	@IsIn(EBOOK_HIGHLIGHT_COLORS)
	color: (typeof EBOOK_HIGHLIGHT_COLORS)[number];
}
