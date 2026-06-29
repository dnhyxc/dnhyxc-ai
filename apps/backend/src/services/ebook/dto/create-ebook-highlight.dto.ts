import {
	IsIn,
	IsString,
	IsUUID,
	Matches,
	MaxLength,
	MinLength,
} from 'class-validator';

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

/** 预设色或自定义 `#rrggbb` / `#rrggbbaa` */
export const EBOOK_HIGHLIGHT_COLOR_PATTERN =
	/^(pink|purple|blue|green|yellow|#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)$/;

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

	@Matches(EBOOK_HIGHLIGHT_COLOR_PATTERN)
	color: string;
}
