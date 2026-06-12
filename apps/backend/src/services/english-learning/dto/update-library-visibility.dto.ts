import { IsBoolean } from 'class-validator';

export class UpdateLibraryVisibilityDto {
	@IsBoolean()
	isPublic!: boolean;
}
