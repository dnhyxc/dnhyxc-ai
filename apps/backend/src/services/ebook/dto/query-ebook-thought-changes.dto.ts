import { IsISO8601 } from 'class-validator';

/** 公开书想法增量同步：返回 updatedAt 严格晚于 since 的条目 */
export class QueryEbookThoughtChangesDto {
	@IsISO8601()
	since!: string;
}
