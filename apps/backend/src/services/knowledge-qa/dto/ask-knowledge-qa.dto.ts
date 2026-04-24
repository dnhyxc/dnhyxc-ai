import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AskKnowledgeQaDto {
	@IsString()
	question: string;

	/** 可选：topK 覆盖，默认由服务端配置 */
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(20)
	topK?: number;

	/** 可选：是否返回检索明细（默认 true） */
	@IsOptional()
	includeEvidences?: boolean;
}
