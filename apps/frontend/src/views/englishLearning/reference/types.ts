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

/** 语法参考：知识点 */
export type GrammarPoint = {
	name?: string;
	description?: string;
	examples?: string[];
	rules?: string[];
	subtypes?: GrammarPoint[];
};

export type GrammarSubsection = {
	id: string;
	title: string;
	content?: string;
	points?: GrammarPoint[];
	subsections?: GrammarSubsection[];
};

export type GrammarSection = {
	id: string;
	title: string;
	content?: string;
	subsections?: GrammarSubsection[];
	points?: GrammarPoint[];
};

export type GrammarChapter = {
	id: string;
	title: string;
	sections: GrammarSection[];
};

export type GrammarPart = {
	id: string;
	title: string;
	description?: string;
	chapters: GrammarChapter[];
};

export type GrammarReference = {
	title: string;
	description: string;
	parts: GrammarPart[];
};

export type GrammarNavItem = {
	sectionId: string;
	label: string;
	depth: 0 | 1 | 2;
	partIndex: number;
	chapterIndex: number;
	sectionIndex: number;
};
