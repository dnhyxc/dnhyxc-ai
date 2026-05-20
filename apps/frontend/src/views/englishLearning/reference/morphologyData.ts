import { dataSource } from './dataSource';
import type { MorphologyReference, MorphologySectionKey } from './types';

/** 词根词缀参考数据（来自 `dataSource.morphology`） */
export const morphologyReference: MorphologyReference = dataSource.morphology;

export const MORPHOLOGY_SECTION_KEYS: MorphologySectionKey[] = [
	'prefixes',
	'suffixes',
	'roots',
];

export function getMorphologyAffixLabel(
	item: { prefix?: string; suffix?: string; root?: string },
	sectionKey: MorphologySectionKey,
): string {
	if (sectionKey === 'prefixes') return item.prefix ?? '—';
	if (sectionKey === 'suffixes') return item.suffix ?? '—';
	return item.root ?? '—';
}

/** 左侧导航选中项（大类 + 分类下标） */
export type MorphologyNavSelection = {
	sectionKey: MorphologySectionKey;
	categoryIndex: number;
};

export function parseMorphologyNavSelection(
	sectionRaw: string | null,
	categoryRaw: string | null,
): MorphologyNavSelection {
	const sectionKey: MorphologySectionKey =
		sectionRaw === 'suffixes' || sectionRaw === 'roots'
			? sectionRaw
			: 'prefixes';
	const section = dataSource.morphology[sectionKey];
	const n = categoryRaw == null ? 0 : parseInt(categoryRaw, 10);
	const categoryIndex =
		Number.isFinite(n) && n >= 0
			? Math.min(n, Math.max(0, section.categories.length - 1))
			: 0;
	return { sectionKey, categoryIndex };
}
