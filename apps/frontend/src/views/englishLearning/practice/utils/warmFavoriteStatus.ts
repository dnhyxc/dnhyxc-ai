/**
 * 练习开局预热收藏状态：整队一次（或吃内嵌 favoriteId），避免 Session Toggle 逐题打 status。
 */
import { warmClassicQuoteFavoriteStatusSession } from '@/hooks/useIncrementalClassicQuoteFavoriteStatus';
import { warmVocabFavoriteStatusSession } from '@/hooks/useIncrementalVocabFavoriteStatus';
import type { PracticeItem } from '../types';
import { isPracticeClassicItem, isPracticeVocabItem } from './item';

export function warmPracticeFavoriteStatus(items: PracticeItem[]): void {
	const classic = items.filter(isPracticeClassicItem).map((it) => ({
		english: it.english,
		...('favoriteId' in it ? { favoriteId: it.favoriteId } : {}),
	}));
	const vocab = items.filter(isPracticeVocabItem).map((it) => ({
		word: it.word,
		...('favoriteId' in it ? { favoriteId: it.favoriteId } : {}),
	}));
	if (classic.length > 0) {
		void warmClassicQuoteFavoriteStatusSession(classic);
	}
	if (vocab.length > 0) {
		void warmVocabFavoriteStatusSession(vocab);
	}
}
