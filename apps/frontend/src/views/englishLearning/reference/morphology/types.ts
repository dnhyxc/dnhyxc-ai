/** 词根词缀参考：例词 */
export type MorphologyExample = {
	word: string;
	ipa: string;
	pos: string;
	translationZh: string;
};

/** 前缀 / 后缀 / 词根条目（字段名因类型而异） */
export type MorphologyAffixItem = {
	prefix?: string;
	suffix?: string;
	root?: string;
	meaning: string;
	examples: MorphologyExample[];
};

export type MorphologyCategory = {
	name: string;
	items: MorphologyAffixItem[];
};

export type MorphologySection = {
	title: string;
	description: string;
	categories: MorphologyCategory[];
};

export type MorphologyReference = {
	prefixes: MorphologySection;
	suffixes: MorphologySection;
	roots: MorphologySection;
};

export type MorphologySectionKey = keyof MorphologyReference;
