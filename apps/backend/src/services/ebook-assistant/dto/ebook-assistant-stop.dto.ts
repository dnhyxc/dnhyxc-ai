import { IsUUID } from 'class-validator';

export class EbookAssistantStopDto {
	@IsUUID()
	sessionId!: string;
}
