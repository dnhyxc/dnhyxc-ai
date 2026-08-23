/** 英语学习列表续读模块开关（与前端 ElResumeModuleKey 一致） */
export const ENGLISH_LEARNING_RESUME_MODULE_KEYS = [
	'library-vocab',
	'library-classic',
	'favorites',
	'mistakes',
	'daily-memorize',
] as const;

export type EnglishLearningResumeModuleKey =
	(typeof ENGLISH_LEARNING_RESUME_MODULE_KEYS)[number];

export function isEnglishLearningResumeModuleKey(
	value: string,
): value is EnglishLearningResumeModuleKey {
	return (ENGLISH_LEARNING_RESUME_MODULE_KEYS as readonly string[]).includes(
		value,
	);
}
