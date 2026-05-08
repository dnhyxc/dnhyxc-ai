import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgentSessionDto {
	@IsOptional()
	@IsString()
	@MaxLength(255)
	title?: string;
}
