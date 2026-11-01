import {
	type FavoriteIntent,
	favoriteNeedsFilterCards,
	isFavoriteQuery,
	resolveFavoriteIntent,
	unfavoriteFromCards,
} from './favorite-ask';
import {
	buildPriorFrameSummary,
	intentFromFrame,
	resolveIntentFrame,
} from './intent-frame';
import type { PriorFrameSummary } from './intent-frame.types';
import { intentFrameEnabled } from './intent-phrases';
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
	priorLibraryCards: { title: string; contentKind?: 'vocab' | 'classic' }[];
	openProposalKind?: string | null;
	priorFrame?: PriorFrameSummary;
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
 * `EL_INTENT_FRAME=0` 时走本函数，不经 IntentFrame。
 */
export function resolveEnglishIntentLegacy(
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

/**
 * 默认经 IntentFrame 再映射 kind；开关关闭时回退 legacy。
 */
export function resolveEnglishIntent(
	userText: string,
	ctx: EnglishIntentContext = {
		priorUserTexts: [],
		priorLibraryCards: [],
	},
): EnglishIntent {
	if (!intentFrameEnabled()) {
		return resolveEnglishIntentLegacy(userText, ctx);
	}
	const frame = resolveIntentFrame(userText, ctx);
	return intentFromFrame(frame);
}

/** 双写 surface.frame + intent + favoriteIntent；并挂 priorFrame。 */
export function bindEnglishIntentSurface(surface: {
	userText: string;
	priorUserTexts: string[];
	priorLibraryCards: { title: string; contentKind?: 'vocab' | 'classic' }[];
	openProposalId?: string | null;
	intent?: EnglishIntent;
	favoriteIntent?: FavoriteIntent;
	frame?: import('./intent-frame.types').IntentFrame;
	priorFrame?: PriorFrameSummary;
}): EnglishIntent {
	const priorFrame =
		surface.priorFrame ??
		buildPriorFrameSummary(surface.priorUserTexts, surface.priorLibraryCards);
	surface.priorFrame = priorFrame;
	const ctx: EnglishIntentContext = {
		priorUserTexts: surface.priorUserTexts,
		priorLibraryCards: surface.priorLibraryCards,
		openProposalKind: surface.openProposalId ?? null,
		priorFrame,
	};
	if (!intentFrameEnabled()) {
		const intent = resolveEnglishIntentLegacy(surface.userText, ctx);
		surface.intent = intent;
		surface.favoriteIntent = favoriteIntentFrom(intent);
		surface.frame = undefined;
		return intent;
	}
	const frame = resolveIntentFrame(surface.userText, ctx);
	surface.frame = frame;
	const intent = intentFromFrame(frame);
	surface.intent = intent;
	surface.favoriteIntent = favoriteIntentFrom(intent);
	return intent;
}
