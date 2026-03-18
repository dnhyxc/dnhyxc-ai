import { IsOptional, IsString } from 'class-validator';

export class UpdateChatDto {
	@IsString()
	sessionId: string;

	@IsString()
	@IsOptional()
	title?: string;

	@IsString()
	@IsOptional()
	modelName?: string;
}
