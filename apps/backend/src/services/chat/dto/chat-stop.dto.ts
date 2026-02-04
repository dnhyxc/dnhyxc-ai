import { IsString } from 'class-validator';

export class ChatStopDto {
	@IsString()
	sessionId: string;
}
