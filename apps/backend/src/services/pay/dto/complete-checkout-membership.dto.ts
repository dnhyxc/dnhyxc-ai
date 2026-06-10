import { IsString, MaxLength, MinLength } from 'class-validator';

export class CompleteCheckoutMembershipDto {
	@IsString()
	@MinLength(8)
	@MaxLength(256)
	sessionId!: string;
}
