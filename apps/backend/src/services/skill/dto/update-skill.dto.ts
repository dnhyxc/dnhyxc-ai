import {
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
} from 'class-validator';

export class UpdateSkillDto {
	@IsUUID()
	id!: string;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	title?: string;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(200_000)
	content?: string;
}
