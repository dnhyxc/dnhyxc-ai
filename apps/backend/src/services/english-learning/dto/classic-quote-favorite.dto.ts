import {
	ArrayMaxSize,
	IsArray,
	IsNotEmpty,
	IsString,
	IsUUID,
	MaxLength,
} from 'class-validator';

/** 新增收藏：与经典句单条条目字段一致 */
export class ClassicQuoteFavoriteBodyDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(12000)
	english!: string;

	@IsString()
	@MaxLength(12000)
	translationZh!: string;

	@IsString()
	@MaxLength(2000)
	source!: string;

	@IsString()
	@MaxLength(12000)
	noteZh!: string;
}

/** 取消收藏：按收藏记录 id */
export class ClassicQuoteFavoriteRemoveDto {
	@IsUUID('4')
	id!: string;
}

/** 批量取消收藏（单次请求） */
export class ClassicQuoteFavoriteRemoveBatchDto {
	@IsArray()
	@ArrayMaxSize(3000)
	@IsUUID('4', { each: true })
	ids!: string[];
}

/** 批量查询当前列表中哪些句已收藏 */
export class ClassicQuoteFavoriteStatusDto {
	@IsArray()
	@ArrayMaxSize(500)
	@IsString({ each: true })
	@MaxLength(12000, { each: true })
	englishes!: string[];
}
