import { IsString } from 'class-validator';

export class CreatePromptDto {
	@IsString()
	name: string;

	@IsString()
	prompt: string;
}
