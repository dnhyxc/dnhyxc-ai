import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsNumber,
	IsOptional,
	IsUUID,
	Max,
	Min,
} from 'class-validator';

/** 保存听书倍速：默认写全局；bookOnly 时只写本书 */
export class SaveEbookListenRateDto {
	@Type(() => Number)
	@IsNumber()
	@Min(0.5)
	@Max(3)
	rate: number;

	/** true = 仅本书；false/省略 = 全局（并清除本书覆盖） */
	@IsOptional()
	@IsBoolean()
	bookOnly?: boolean;

	@IsOptional()
	@IsUUID()
	bookId?: string;

	/**
	 * 勾选「仅本书」时把全局倍速恢复为此值（避免先改速写全局、再勾本书后污染其它书）。
	 * 仅 bookOnly=true 时生效。
	 */
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0.5)
	@Max(3)
	restoreGlobalRate?: number;
}
