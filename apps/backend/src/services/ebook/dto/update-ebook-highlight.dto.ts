import {
	IsIn,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
} from 'class-validator';
import {
	EBOOK_HIGHLIGHT_COLORS,
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
	@IsIn(EBOOK_HIGHLIGHT_COLORS)
	color?: (typeof EBOOK_HIGHLIGHT_COLORS)[number];
}
