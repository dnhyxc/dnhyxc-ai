import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAssistantSessionDto {
	@IsOptional()
	@IsString()
	@MaxLength(255)
	title?: string;
}
