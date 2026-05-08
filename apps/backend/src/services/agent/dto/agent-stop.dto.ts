import { IsUUID } from 'class-validator';

export class AgentStopDto {
	@IsUUID()
	sessionId!: string;
}
