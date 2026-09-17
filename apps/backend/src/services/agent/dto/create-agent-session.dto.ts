import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgentSessionDto {
	@IsOptional()
	@IsString()
	@MaxLength(255)
	title?: string;

	/** english_learning：同时创建 english_agent_sessions（与 agent 同 id） */
	@IsOptional()
	@IsIn(['english_learning'])
	memorySource?: 'english_learning';
}
