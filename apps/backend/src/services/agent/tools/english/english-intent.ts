import {
	type FavoriteIntent,
	favoriteNeedsFilterCards,
	isFavoriteQuery,
	resolveFavoriteIntent,
	unfavoriteFromCards,
} from './favorite-ask';
import {
	isCategoryAsk,
	isPackGenerateAsk,
	isReadingGenerateAsk,
	listIntent,
} from './spill';

/** 一轮唯一主意图，避免多闸并行打架。 */
export type EnglishIntentKind =
	| 'favorite_query'
	| 'favorite_remove'
	| 'favorite_add'
	| 'pack_generate'
	| 'reading_generate'
	| 'category_filter'
	| 'inventory'
	| 'chat';

export type EnglishIntent = {
	kind: EnglishIntentKind;
	side?: 'vocab' | 'classic' | 'both' | 'card';
	/** 添加收藏且句内含关于类：先出筛选卡。 */
	needsFilterCards?: boolean;
};

/** 复用 ElListSurface 已有字段，不新持久化。 */
export type EnglishIntentContext = {
	priorUserTexts: string[];
	priorLibraryCards: { title: string; contentKind?: string }[];
	openProposalKind?: string | null;
};

/** 从主意图回填旧 favoriteIntent，供尚未改读 kind 的路径兼容。 */
export function favoriteIntentFrom(intent: EnglishIntent): FavoriteIntent {
	if (intent.kind === 'favorite_remove') {
		return { action: 'remove', side: intent.side ?? 'both' };
	}
	if (intent.kind === 'favorite_add') {
		return { action: 'add', side: intent.side ?? 'card' };
	}
	return { action: null, side: 'card' };
}

/**
 * 固定优先级：cancel → query → generate → add → category → inventory → chat。
 * ctx 预留给 M2/M3 继承策略；M1 判定只靠原话。
 */
export function resolveEnglishIntent(
	userText: string,
	_ctx: EnglishIntentContext = {
		priorUserTexts: [],
		priorLibraryCards: [],
	},
): EnglishIntent {
	const text = userText.trim();
	if (!text) return { kind: 'chat' };

	const cancel = unfavoriteFromCards(text);
	if (cancel) return { kind: 'favorite_remove', side: cancel };

	if (isFavoriteQuery(text)) return { kind: 'favorite_query' };

	if (isPackGenerateAsk(text)) return { kind: 'pack_generate' };
	if (isReadingGenerateAsk(text)) return { kind: 'reading_generate' };

	const fav = resolveFavoriteIntent(text);
	if (fav.action === 'add') {
		return {
			kind: 'favorite_add',
			side: fav.side,
			needsFilterCards: favoriteNeedsFilterCards(text),
		};
	}

	if (isCategoryAsk(text)) return { kind: 'category_filter' };
	if (listIntent(text) === 'inventory') return { kind: 'inventory' };
	return { kind: 'chat' };
}
