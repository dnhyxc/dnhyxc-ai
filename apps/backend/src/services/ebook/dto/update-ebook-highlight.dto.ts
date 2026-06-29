import {
	IsIn,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
} from 'class-validator';
import {
	EBOOK_HIGHLIGHT_COLOR_PATTERN,
	EBOOK_HIGHLIGHT_STYLES,
} from './create-ebook-highlight.dto';

export class UpdateEbookHighlightDto {
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(8192)
	quote?: string;

	@IsOptional()
	@IsIn(EBOOK_HIGHLIGHT_STYLES)
	style?: (typeof EBOOK_HIGHLIGHT_STYLES)[number];

	@IsOptional()
	@Matches(EBOOK_HIGHLIGHT_COLOR_PATTERN)
	color?: string;
}
