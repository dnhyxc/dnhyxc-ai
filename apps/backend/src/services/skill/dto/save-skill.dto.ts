import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SaveSkillDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	title!: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(200_000)
	content!: string;
}
