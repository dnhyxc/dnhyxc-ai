/**
 * 解析练习词表来源的展示标题（词库名 / 收藏 / 拉取主题等）
 */
import {
	getEnglishVocabularyHistoryDetail,
	listEnglishVocabularyLibraryItems,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import {
	getEnglishPracticePoolTitle,
	resolveEnglishPracticePoolKey,
} from '@/store/englishPracticePool';
import type { ResolvePracticeSourceTitleParams } from '../types';

export async function resolvePracticeSourceTitle(
	params: ResolvePracticeSourceTitleParams,
): Promise<string> {
	const fromUrl = params.sourceTitleFromUrl?.trim();
	if (fromUrl) return fromUrl;

	const poolKey = resolveEnglishPracticePoolKey({
		source: params.source,
		libraryId: params.libraryId,
		streamId: params.streamId,
	});
	if (poolKey) {
		const cached = getEnglishPracticePoolTitle(poolKey);
		if (cached) return cached;
	}

	switch (params.source) {
		case 'favorites':
			return params.t('englishLearning.practice.sourceFavorites');
		case 'library': {
			const libraryId = params.libraryId?.trim();
			if (!libraryId) {
				return params.t('englishLearning.practice.sourceLibrary');
			}
			try {
				const res = await listEnglishVocabularyLibraryItems(libraryId, {
					limit: 1,
					offset: 0,
					silent: true,
				});
				const title = res.data?.library?.title?.trim();
				if (title) return title;
			} catch {
				/* fallback */
			}
			return params.t('englishLearning.practice.sourceLibrary');
		}
		case 'pack': {
			const streamId = params.streamId?.trim();
			if (!streamId) {
				return params.t('englishLearning.practice.sourcePack');
			}
			try {
				const res = await getEnglishVocabularyHistoryDetail(streamId);
				const topic = res.data?.topic?.trim();
				if (topic) return topic;
			} catch {
				/* fallback */
			}
			return params.t('englishLearning.practice.sourcePack');
		}
		case 'live': {
			const topic = EnglishPackStore.vocabTopic.trim();
			if (topic) return topic;
			return params.t('englishLearning.practice.sourceLive');
		}
		default:
			return params.t('englishLearning.practice.sourceFavorites');
	}
}
