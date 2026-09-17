import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateAssistantSessionTitleDto {
	@IsUUID()
	sessionId!: string;

	@IsString()
	@MinLength(1)
	@MaxLength(255)
	title!: string;
}
