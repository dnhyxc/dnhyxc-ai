import {
	IsBoolean,
	IsOptional,
	IsString,
	MaxLength,
	ValidateIf,
} from 'class-validator';

export class UpsertLlmVectorConfigDto {
	@IsBoolean()
	enabled!: boolean;

	@ValidateIf((o: UpsertLlmVectorConfigDto) => o.enabled === true)
	@IsString()
	@MaxLength(512)
	baseUrl?: string;

	@ValidateIf((o: UpsertLlmVectorConfigDto) => o.enabled === true)
	@IsString()
	@MaxLength(512)
	rerankUrl?: string;

	@ValidateIf((o: UpsertLlmVectorConfigDto) => o.enabled === true)
	@IsString()
	@MaxLength(256)
	embeddingModel?: string;

	@ValidateIf((o: UpsertLlmVectorConfigDto) => o.enabled === true)
	@IsString()
	@MaxLength(256)
	rerankModel?: string;

	@ValidateIf((o: UpsertLlmVectorConfigDto) => o.enabled === true)
	@IsString()
	@MaxLength(256)
	collectionName?: string;

	/** 省略或空字符串表示保留已保存的 apiKey */
	@IsOptional()
	@IsString()
	@MaxLength(512)
	apiKey?: string;

	/** 仅超级管理员可设置：强制 BGE 单库单向量操作 */
	@IsOptional()
	@IsBoolean()
	bgeOnly?: boolean;
}
