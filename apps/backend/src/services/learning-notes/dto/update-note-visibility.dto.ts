import { IsBoolean } from 'class-validator';

export class UpdateNoteVisibilityDto {
	@IsBoolean()
	isPublic!: boolean;
}
