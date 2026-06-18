import { IsIn, IsOptional } from 'class-validator';

/** 分类 summary 查询（首次 seed 默认分类时使用） */
export class QueryEbookCategoriesSummaryDto {
	@IsOptional()
	@IsIn(['zh-CN', 'en-US'])
	locale?: 'zh-CN' | 'en-US';
}
