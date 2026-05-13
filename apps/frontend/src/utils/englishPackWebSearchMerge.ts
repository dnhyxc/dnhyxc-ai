import type { SearchOrganicItem } from '@/types/chat';

/** 与后端 `EnglishPackWebSearchRoundJson` 对齐 */
export type EnglishPackWebSearchRoundDto = {
	query?: string | null;
	organic: SearchOrganicItem[];
};

/** 多轮联网结果按 link 去重合并，供胶囊/抽屉一条列表展示 */
export function mergeEnglishPackWebSearchOrganics(
	rounds: EnglishPackWebSearchRoundDto[] | null | undefined,
): SearchOrganicItem[] {
	if (!Array.isArray(rounds) || !rounds.length) return [];
	const seen = new Set<string>();
	const out: SearchOrganicItem[] = [];
	for (const r of rounds) {
		if (!r?.organic?.length) continue;
		for (const o of r.organic) {
			const link = typeof o.link === 'string' ? o.link.trim() : '';
			if (!link || seen.has(link)) continue;
			seen.add(link);
			out.push(o);
		}
	}
	return out;
}
