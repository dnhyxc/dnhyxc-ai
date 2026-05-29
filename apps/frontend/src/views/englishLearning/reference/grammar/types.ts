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
