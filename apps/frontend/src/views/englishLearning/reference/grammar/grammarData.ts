import { grammarDataSource } from './dataSource';
import type { GrammarNavItem, GrammarReference, GrammarSection } from './types';

/** 语法参考数据（来自 `grammarDataSource`） */
export const grammarReference: GrammarReference = grammarDataSource;

export function buildGrammarNavItems(): GrammarNavItem[] {
	const items: GrammarNavItem[] = [];
	grammarDataSource.parts.forEach((part, partIndex) => {
		part.chapters.forEach((chapter, chapterIndex) => {
			chapter.sections.forEach((section, sectionIndex) => {
				items.push({
					sectionId: section.id,
					label: section.title,
					depth: 2,
					partIndex,
					chapterIndex,
					sectionIndex,
				});
			});
		});
	});
	return items;
}

export type GrammarNavRow = GrammarNavItem & {
	showChapter: boolean;
};

export function buildGrammarNavRows(): GrammarNavRow[] {
	const items = buildGrammarNavItems();
	let lastChapterKey = '';
	return items.map((item) => {
		const chapterKey = `${item.partIndex}-${item.chapterIndex}`;
		const showChapter = chapterKey !== lastChapterKey;
		lastChapterKey = chapterKey;
		return { ...item, showChapter };
	});
}

export function resolveGrammarSection(
	partIndex: number,
	chapterIndex: number,
	sectionIndex: number,
): GrammarSection | null {
	const part = grammarDataSource.parts[partIndex];
	const chapter = part?.chapters[chapterIndex];
	return chapter?.sections[sectionIndex] ?? null;
}

export function findGrammarNavBySectionId(
	sectionId: string,
): GrammarNavItem | undefined {
	return buildGrammarNavItems().find((n) => n.sectionId === sectionId);
}
