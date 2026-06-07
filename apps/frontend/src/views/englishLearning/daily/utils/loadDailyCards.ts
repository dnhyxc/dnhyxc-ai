import { hasValidAuthToken } from '@/router/authPaths';
import { getEnglishDailyMemorizeQueue } from '@/service';
import type { DailyVocabCard } from '../types';
import { getDailyWordCount } from './dailyWordCount';
import { pickStarterRandomWords } from './localSrs';

export async function loadDailyCards(
	excludeKeys: string[] = [],
): Promise<DailyVocabCard[]> {
	const wordCount = getDailyWordCount();
	if (hasValidAuthToken()) {
		try {
			const res = await getEnglishDailyMemorizeQueue({
				count: wordCount,
				source: 'library',
				excludeKeys,
				silent: true,
			});
			const items = res.data?.items ?? [];
			if (items.length > 0) {
				return items.map((item) => ({
					key: item.key,
					word: item.word,
					ipa: item.ipa ?? '',
					pos: item.pos ?? '',
					segmentation: item.segmentation ?? '',
					translationZh: item.translationZh ?? '',
					example: item.example ?? '',
					origin: 'server' as const,
				}));
			}
		} catch {
			// 回退内置词表
		}
	}

	return pickStarterRandomWords(wordCount, excludeKeys);
}
