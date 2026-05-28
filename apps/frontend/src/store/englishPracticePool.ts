/**
 * 练习词表总量与展示标题：由各入口列表页在加载后写入，练习页读取。
 */
import type { PracticeSource } from '@/views/englishLearning/practice/types';

const totals = new Map<string, number>();
const titles = new Map<string, string>();

export const englishPracticePoolKeys = {
	favorites: 'favorites',
	library: (libraryId: string) => `library:${libraryId}`,
	pack: (streamId: string) => `pack:${streamId}`,
	live: 'live',
} as const;

export function setEnglishPracticePoolTotal(key: string, total: number): void {
	if (!Number.isFinite(total) || total <= 0) return;
	totals.set(key, Math.floor(total));
}

export function setEnglishPracticePoolTitle(key: string, title: string): void {
	const trimmed = title.trim();
	if (!trimmed) return;
	titles.set(key, trimmed);
}

export function setEnglishPracticePoolMeta(
	key: string,
	meta: { total?: number; title?: string },
): void {
	if (meta.total != null) setEnglishPracticePoolTotal(key, meta.total);
	if (meta.title != null) setEnglishPracticePoolTitle(key, meta.title);
}

export function getEnglishPracticePoolTotal(key: string): number | undefined {
	const n = totals.get(key);
	return n != null && n > 0 ? n : undefined;
}

export function getEnglishPracticePoolTitle(key: string): string | undefined {
	return titles.get(key);
}

export function resolveEnglishPracticePoolKey(params: {
	source: PracticeSource;
	libraryId?: string;
	streamId?: string;
}): string | null {
	switch (params.source) {
		case 'favorites':
			return englishPracticePoolKeys.favorites;
		case 'library': {
			const id = params.libraryId?.trim();
			return id ? englishPracticePoolKeys.library(id) : null;
		}
		case 'pack': {
			const id = params.streamId?.trim();
			return id ? englishPracticePoolKeys.pack(id) : null;
		}
		case 'live':
			return englishPracticePoolKeys.live;
		default:
			return null;
	}
}
