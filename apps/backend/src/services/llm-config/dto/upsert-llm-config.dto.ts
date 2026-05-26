import {
	IsBoolean,
	IsOptional,
	IsString,
	MaxLength,
	ValidateIf,
} from 'class-validator';

export class UpsertLlmConfigDto {
	@IsBoolean()
	enabled!: boolean;

	@ValidateIf((o: UpsertLlmConfigDto) => o.enabled === true)
	@IsString()
	@MaxLength(512)
	baseUrl?: string;

	@ValidateIf((o: UpsertLlmConfigDto) => o.enabled === true)
	@IsString()
	@MaxLength(256)
	modelName?: string;

	/** 省略或空字符串表示保留已保存的 apiKey */
	@IsOptional()
	@IsString()
	@MaxLength(512)
	apiKey?: string;
}
