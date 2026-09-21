import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsIn,
	IsOptional,
	IsString,
	MaxLength,
	ValidateNested,
} from 'class-validator';

/** 导入文件中单词语标注行（与外部模型 / batch2 形态对齐） */
export class ImportSentenceWordAnnotationWordDto {
	@IsString()
	@MaxLength(64)
	word!: string;

	@IsString()
	@MaxLength(32)
	posZh!: string;

	@IsString()
	@MaxLength(128)
	ipa!: string;

	@IsString()
	@MaxLength(500)
	meaningZh!: string;
}

/** 单句：english + words 对象数组；id 等多余字段由校验管线丢掉 */
export class ImportSentenceWordAnnotationItemDto {
	@IsString()
	@MaxLength(2000)
	english!: string;

	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(80)
	@ValidateNested({ each: true })
	@Type(() => ImportSentenceWordAnnotationWordDto)
	words!: ImportSentenceWordAnnotationWordDto[];
}

/** 手动导入词标注：source 仅鉴权，不写入 cache 行；items 可为源句集子集 */
export class ImportSentenceWordAnnotationsDto {
	@IsIn(['library', 'pack'])
	source!: 'library' | 'pack';

	@IsOptional()
	@IsString()
	@MaxLength(64)
	libraryId?: string;

	@IsOptional()
	@IsString()
	@MaxLength(128)
	streamId?: string;

	/** 至少 1 条；不要求等于库/Pack 总句数 */
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(6000)
	@ValidateNested({ each: true })
	@Type(() => ImportSentenceWordAnnotationItemDto)
	items!: ImportSentenceWordAnnotationItemDto[];
}
