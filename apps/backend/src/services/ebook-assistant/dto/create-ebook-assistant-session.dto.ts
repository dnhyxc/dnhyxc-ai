import {
	IsBoolean,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
} from 'class-validator';

export class CreateEbookAssistantSessionDto {
	@IsUUID()
	bookId!: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	title?: string;

	/** true：强制新建（「新对话」）；false/不传：复用该书最近会话 */
	@IsOptional()
	@IsBoolean()
	forceNew?: boolean;
}
