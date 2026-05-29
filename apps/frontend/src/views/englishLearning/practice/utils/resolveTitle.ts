/**
 * 解析练习词表来源的展示标题（词库名 / 收藏 / 拉取主题等）
 */
import {
	getEnglishClassicQuotesHistoryDetail,
	getEnglishVocabularyHistoryDetail,
	listEnglishClassicQuotesLibraryItems,
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
		contentKind: params.contentKind,
		source: params.source,
		libraryId: params.libraryId,
		streamId: params.streamId,
	});
	if (poolKey) {
		const cached = getEnglishPracticePoolTitle(poolKey);
		if (cached) return cached;
	}

	const isClassic = params.contentKind === 'classic';

	switch (params.source) {
		case 'favorites':
			return isClassic
				? params.t('englishLearning.practice.sourceClassicFavorites')
				: params.t('englishLearning.practice.sourceFavorites');
		case 'mistakes':
			return isClassic
				? params.t('englishLearning.practice.sourceClassicMistakes')
				: params.t('englishLearning.practice.sourceMistakes');
		case 'library': {
			const libraryId = params.libraryId?.trim();
			if (!libraryId) {
				return isClassic
					? params.t('englishLearning.practice.sourceClassicLibrary')
					: params.t('englishLearning.practice.sourceLibrary');
			}
			try {
				const res = isClassic
					? await listEnglishClassicQuotesLibraryItems(libraryId, {
							limit: 1,
							offset: 0,
							silent: true,
						})
					: await listEnglishVocabularyLibraryItems(libraryId, {
							limit: 1,
							offset: 0,
							silent: true,
						});
				const title = res.data?.library?.title?.trim();
				if (title) return title;
			} catch {
				/* fallback */
			}
			return isClassic
				? params.t('englishLearning.practice.sourceClassicLibrary')
				: params.t('englishLearning.practice.sourceLibrary');
		}
		case 'pack': {
			const streamId = params.streamId?.trim();
			if (!streamId) {
				return isClassic
					? params.t('englishLearning.practice.sourceClassicPack')
					: params.t('englishLearning.practice.sourcePack');
			}
			try {
				const res = isClassic
					? await getEnglishClassicQuotesHistoryDetail(streamId)
					: await getEnglishVocabularyHistoryDetail(streamId);
				const topic = res.data?.topic?.trim();
				if (topic) return topic;
			} catch {
				/* fallback */
			}
			return isClassic
				? params.t('englishLearning.practice.sourceClassicPack')
				: params.t('englishLearning.practice.sourcePack');
		}
		case 'live': {
			const topic = isClassic
				? EnglishPackStore.classicTopic.trim()
				: EnglishPackStore.vocabTopic.trim();
			if (topic) return topic;
			return isClassic
				? params.t('englishLearning.practice.sourceClassicLive')
				: params.t('englishLearning.practice.sourceLive');
		}
		default:
			return isClassic
				? params.t('englishLearning.practice.sourceClassicFavorites')
				: params.t('englishLearning.practice.sourceFavorites');
	}
}
