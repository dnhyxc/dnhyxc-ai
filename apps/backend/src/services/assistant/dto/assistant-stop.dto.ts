import { IsUUID } from 'class-validator';

export class AssistantStopDto {
	@IsUUID()
	sessionId: string;
}
