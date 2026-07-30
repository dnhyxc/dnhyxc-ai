import { IsArray, IsString, MaxLength } from 'class-validator';

/** 全量覆盖当前账号已上架插件 id 列表 */
export class UpsertPluginEnabledPrefsDto {
	@IsArray()
	@IsString({ each: true })
	@MaxLength(64, { each: true })
	enabledIds!: string[];
}
