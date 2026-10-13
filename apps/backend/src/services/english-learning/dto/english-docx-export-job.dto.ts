import {
	ArrayMaxSize,
	IsArray,
	IsIn,
	IsOptional,
	IsUUID,
	ValidateIf,
} from 'class-validator';

export const ENGLISH_DOCX_EXPORT_KINDS = [
	'vocabulary-favorites',
	'classic-quote-favorites',
	'vocabulary-mistakes',
	'classic-quote-mistakes',
	'practice-review',
] as const;

export type EnglishDocxExportKindDto =
	(typeof ENGLISH_DOCX_EXPORT_KINDS)[number];

/** 创建大集合 DOCX 异步导出任务 */
export class CreateEnglishDocxExportJobDto {
	@IsIn(ENGLISH_DOCX_EXPORT_KINDS)
	kind!: EnglishDocxExportKindDto;

	/** practice-review 必填 */
	@ValidateIf(
		(o: CreateEnglishDocxExportJobDto) => o.kind === 'practice-review',
	)
	@IsIn(['vocab', 'classic'])
	contentKind?: 'vocab' | 'classic';

	@IsOptional()
	@IsArray()
	@ArrayMaxSize(20000)
	@IsUUID('4', { each: true })
	ids?: string[];
}
