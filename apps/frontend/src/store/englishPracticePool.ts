/**
 * 练习词表总量与展示标题：由各入口列表页在加载后写入，练习页读取。
 */
import type {
	PracticeContentKind,
	PracticeSource,
} from '@/views/englishLearning/practice/types';

const totals = new Map<string, number>();
const titles = new Map<string, string>();

function kindPrefix(contentKind: PracticeContentKind): string {
	return contentKind === 'classic' ? 'classic' : 'vocab';
}

export const englishPracticePoolKeys = {
	favorites: (contentKind: PracticeContentKind) =>
		`${kindPrefix(contentKind)}:favorites`,
	mistakes: (contentKind: PracticeContentKind) =>
		`${kindPrefix(contentKind)}:mistakes`,
	dailyMemorize: () => 'vocab:daily-memorize',
	library: (libraryId: string, contentKind: PracticeContentKind) =>
		`${kindPrefix(contentKind)}:library:${libraryId}`,
	pack: (streamId: string, contentKind: PracticeContentKind) =>
		`${kindPrefix(contentKind)}:pack:${streamId}`,
	live: (contentKind: PracticeContentKind) => `${kindPrefix(contentKind)}:live`,
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

/** 切换账号时清空练习页标题/总量缓存 */
export function clearEnglishPracticePoolCache(): void {
	totals.clear();
	titles.clear();
}

export function resolveEnglishPracticePoolKey(params: {
	contentKind?: PracticeContentKind;
	source: PracticeSource;
	libraryId?: string;
	streamId?: string;
}): string | null {
	const contentKind = params.contentKind ?? 'vocab';
	switch (params.source) {
		case 'favorites':
			return englishPracticePoolKeys.favorites(contentKind);
		case 'mistakes':
			return englishPracticePoolKeys.mistakes(contentKind);
		case 'dailyMemorize':
			return englishPracticePoolKeys.dailyMemorize();
		case 'library': {
			const id = params.libraryId?.trim();
			return id ? englishPracticePoolKeys.library(id, contentKind) : null;
		}
		case 'pack': {
			const id = params.streamId?.trim();
			return id ? englishPracticePoolKeys.pack(id, contentKind) : null;
		}
		case 'live':
			return englishPracticePoolKeys.live(contentKind);
		default:
			return null;
	}
}
