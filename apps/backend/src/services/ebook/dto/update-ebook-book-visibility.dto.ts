import { IsBoolean } from 'class-validator';

export class UpdateEbookBookVisibilityDto {
	@IsBoolean()
	isPublic!: boolean;
}
