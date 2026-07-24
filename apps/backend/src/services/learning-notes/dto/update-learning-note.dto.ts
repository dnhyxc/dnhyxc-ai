import {
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
} from 'class-validator';

export class UpdateLearningNoteDto {
	@IsNotEmpty()
	@IsUUID()
	id!: string;

	@IsOptional()
	@IsString()
	@MaxLength(200)
	title?: string;

	@IsOptional()
	@IsString()
	@MaxLength(5_000_000)
	content?: string;
}
