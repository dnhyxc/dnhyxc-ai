import {
	ArrayMaxSize,
	IsArray,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
} from 'class-validator';

/** 新增收藏：与单词包单条条目字段一致 */
export class VocabularyFavoriteBodyDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	word!: string;

	@IsString()
	@MaxLength(2000)
	ipa!: string;

	/** 词性英文缩写（可选，与生成条目 pos 一致） */
	@IsOptional()
	@IsString()
	@MaxLength(32)
	pos?: string;

	@IsString()
	@MaxLength(8000)
	translationZh!: string;

	@IsString()
	@MaxLength(8000)
	example!: string;
}

/** 取消收藏：仅需词面（服务端按与新增相同的规则规范化） */
export class VocabularyFavoriteRemoveDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	word!: string;
}

/** 批量查询当前列表中哪些词已收藏 */
export class VocabularyFavoriteStatusDto {
	@IsArray()
	@ArrayMaxSize(500)
	@IsString({ each: true })
	@MaxLength(500, { each: true })
	words!: string[];
}
