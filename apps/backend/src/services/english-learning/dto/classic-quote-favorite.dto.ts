import {
	ArrayMaxSize,
	IsArray,
	IsNotEmpty,
	IsString,
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

/** 取消收藏：传入英文原句（与服务端计算 content_key 的规则一致） */
export class ClassicQuoteFavoriteRemoveDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(12000)
	english!: string;
}

/** 批量查询当前列表中哪些句已收藏（返回 content_key） */
export class ClassicQuoteFavoriteStatusDto {
	@IsArray()
	@ArrayMaxSize(500)
	@IsString({ each: true })
	@MaxLength(12000, { each: true })
	englishes!: string[];
}
