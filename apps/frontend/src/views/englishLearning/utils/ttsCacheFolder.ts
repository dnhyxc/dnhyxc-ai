import type { PracticeContentKind, PracticeSource } from '../practice/types';

/** 无实体 id 的保留目录（语义固定，可改名场景不适用） */
export const TTS_CACHE_FOLDER = {
	favorites: '收藏',
	mistakes: '错题',
	daily: '今日记词',
	review: '复习',
	morphology: '词根词缀',
} as const;

/** 稳定 scope：改库名不改目录 */
export function ttsCacheScopeVocab(libraryId: string): string {
	return `vocab_${libraryId.trim()}`;
}

export function ttsCacheScopeClassic(libraryId: string): string {
	return `classic_${libraryId.trim()}`;
}

export function ttsCacheScopePack(streamId: string): string {
	return `pack_${streamId.trim()}`;
}

export function ttsCacheScopeDailyReading(id: string): string {
	return `daily_reading_${id.trim()}`;
}

export type TtsDiskCacheOpts = {
	cacheFolder?: string;
	cacheTitle?: string;
};

/** 练习/结算：按来源解析稳定目录键 + 可选展示标题 */
export function resolvePracticeTtsCache(input: {
	contentKind: PracticeContentKind;
	source: PracticeSource;
	libraryId?: string;
	streamId?: string;
	sourceTitle?: string;
}): TtsDiskCacheOpts {
	const title = input.sourceTitle?.trim() || undefined;
	const libraryId = input.libraryId?.trim();
	const streamId = input.streamId?.trim();

	if (input.source === 'library' && libraryId) {
		return {
			cacheFolder:
				input.contentKind === 'classic'
					? ttsCacheScopeClassic(libraryId)
					: ttsCacheScopeVocab(libraryId),
			cacheTitle: title,
		};
	}
	if ((input.source === 'pack' || input.source === 'live') && streamId) {
		return {
			cacheFolder: ttsCacheScopePack(streamId),
			cacheTitle: title,
		};
	}
	if (input.source === 'favorites') {
		return { cacheFolder: TTS_CACHE_FOLDER.favorites };
	}
	if (input.source === 'mistakes') {
		return { cacheFolder: TTS_CACHE_FOLDER.mistakes };
	}
	if (input.source === 'review') {
		return { cacheFolder: TTS_CACHE_FOLDER.review };
	}
	if (input.source === 'dailyMemorize') {
		return { cacheFolder: TTS_CACHE_FOLDER.daily };
	}
	return title ? { cacheTitle: title } : {};
}
