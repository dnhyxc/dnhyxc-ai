import { IsISO8601, IsOptional } from 'class-validator';

/** 公开书想法同步：可选 since，返回版本戳 + 增量变更 */
export class QueryEbookThoughtSyncDto {
	@IsOptional()
	@IsISO8601()
	since?: string;
}
