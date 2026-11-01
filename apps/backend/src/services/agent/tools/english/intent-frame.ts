import type { EnglishIntent, EnglishIntentKind } from './english-intent';
import {
	isFavoriteQuery,
	resolveFavoriteIntent,
	unfavoriteFromCards,
} from './favorite-ask';
import type {
	IntentFrame,
	IntentFrameContext,
	IntentSlots,
	PlanStep,
	PriorFrameSummary,
} from './intent-frame.types';
import {
	inferPhraseDomain,
	intentFrameEnabled,
	wantsLibraryCatalog,
} from './intent-phrases';
import {
	categoryLabels,
	inheritedKind,
	isCategoryAsk,
	isPackGenerateAsk,
	isReadingGenerateAsk,
	listIntent,
	resolveMentionedLibrary,
} from './spill';

export type {
	IntentFrame,
	IntentFrameContext,
	IntentSlots,
	PlanStep,
	PriorFrameSummary,
} from './intent-frame.types';

/** 「那本库再筛家庭」类续问：无「关于」也认筛选，且继承 prior。 */
function isFilterFollowUp(text: string, prior?: PriorFrameSummary): boolean {
	if (!prior?.categoryAsk && !prior?.libraryCue) return false;
	if (isPackGenerateAsk(text) || isReadingGenerateAsk(text)) return false;
	if (isFavoriteQuery(text) || unfavoriteFromCards(text)) return false;
	return /那本|同上|继续|(再|还要?)?(筛|找|列)|关于|有关|相关/.test(text);
}

/** 续问类别：categoryLabels 为空时从「筛家庭 / 关于家庭」抽。 */
function followUpFilterLabels(text: string): string[] {
	const fromCat = categoryLabels(text);
	if (fromCat.length) return fromCat;
	const labels: string[] = [];
	const push = (raw: string) => {
		const label = raw.replace(/的$/u, '').trim();
		if (label.length >= 1 && label.length <= 8) labels.push(label);
	};
	for (const re of [
		/(?:关于|有关|相关)([\u4e00-\u9fff]{1,8})/u,
		/筛(?:选|出|一下)?([\u4e00-\u9fff]{1,8})/u,
		/那本库再筛([\u4e00-\u9fff]{1,8})/u,
	]) {
		const m = text.match(re);
		if (m?.[1]) push(m[1]);
	}
	return [...new Set(labels)];
}

/**
 * 从 prior 用户句 + 库卡标题推导上一轮槽位摘要。
 * 不递归带 priorFrame，避免链式爆炸。
 */
export function buildPriorFrameSummary(
	priorUserTexts: string[],
	priorLibraryCards: {
		title: string;
		contentKind?: 'vocab' | 'classic';
	}[] = [],
): PriorFrameSummary | undefined {
	for (let i = priorUserTexts.length - 1; i >= 0; i -= 1) {
		const text = priorUserTexts[i]?.trim();
		if (!text) continue;
		const snap = resolveIntentFrame(text, { priorUserTexts: [] });
		if (
			!snap.slots.categoryAsk &&
			!snap.slots.inventory &&
			!snap.slots.catalog
		) {
			continue;
		}
		const kind = inheritedKind(
			priorUserTexts.slice(0, i + 1),
			priorLibraryCards,
		);
		const cards = kind
			? priorLibraryCards.filter((c) => c.contentKind === kind)
			: priorLibraryCards;
		const titles = [
			...new Set(cards.map((c) => c.title.trim()).filter((t) => t.length > 0)),
		];
		const summary: PriorFrameSummary = {
			categoryAsk: snap.slots.categoryAsk,
			filterLabels: snap.slots.filterLabels,
			domain: snap.slots.domain,
			contentKind: kind ?? undefined,
		};
		if (titles.length === 1) {
			summary.libraryCue = { raw: titles[0], status: 'one' };
		}
		return summary;
	}
	const titles = [
		...new Set(
			priorLibraryCards.map((c) => c.title.trim()).filter((t) => t.length > 0),
		),
	];
	if (titles.length !== 1) return undefined;
	const cardKind = priorLibraryCards[0]?.contentKind;
	return {
		libraryCue: { raw: titles[0], status: 'one' },
		contentKind:
			cardKind === 'vocab' || cardKind === 'classic' ? cardKind : undefined,
		categoryAsk: true,
	};
}

export function resolveIntentFrame(
	userText: string,
	ctx: IntentFrameContext = { priorUserTexts: [] },
): IntentFrame {
	const text = userText.trim();
	if (!text) {
		return {
			slots: {
				catalog: false,
				inventory: false,
				filterLabels: [],
				categoryAsk: false,
				mutate: { action: null, side: 'card' },
				generate: null,
			},
			plan: [{ type: 'noop' }],
		};
	}

	const prior = ctx.priorFrame;
	const genPack = isPackGenerateAsk(text);
	const genRead = isReadingGenerateAsk(text);
	const cancel = unfavoriteFromCards(text);
	const favQuery = isFavoriteQuery(text);
	const fav = resolveFavoriteIntent(text);
	const list = listIntent(text);
	const catalog = wantsLibraryCatalog(text);
	const followUp = isFilterFollowUp(text, prior);
	const categoryAsk = (!genPack && !genRead && isCategoryAsk(text)) || followUp;
	const filterLabels = categoryAsk
		? followUp
			? followUpFilterLabels(text)
			: categoryLabels(text)
		: [];

	const slots: IntentSlots = {
		catalog,
		inventory: list === 'inventory',
		filterLabels,
		categoryAsk,
		domain: inferPhraseDomain(text) ?? prior?.domain,
		mutate: cancel
			? { action: 'remove', side: cancel }
			: favQuery
				? { action: 'query', side: 'card' }
				: {
						action: fav.action === 'add' ? 'add' : null,
						side: fav.side,
					},
		generate: genPack ? 'pack' : genRead ? 'reading' : null,
	};

	// 本句未点名库时，先挂上 prior 的 cue（id 可能稍后由 fillLibraryCue 补）
	if (
		categoryAsk &&
		prior?.libraryCue?.status === 'one' &&
		prior.libraryCue.raw
	) {
		slots.libraryCue = { ...prior.libraryCue };
	}

	return { slots, plan: planEnglishTurn(slots) };
}

export function planEnglishTurn(slots: IntentSlots): PlanStep[] {
	const steps: PlanStep[] = [];
	if (slots.catalog) steps.push({ type: 'hangCatalog', setPresented: false });
	if (slots.categoryAsk || slots.inventory) {
		steps.push({ type: 'resolveLibrary' });
	}
	if (slots.inventory) {
		steps.push({ type: 'hangInventory', setPresented: true });
	}
	if (slots.categoryAsk) {
		steps.push({ type: 'classify', labels: slots.filterLabels });
	}
	if (slots.mutate.action === 'add' && slots.categoryAsk) {
		steps.push({ type: 'ensureFilterThenPropose' });
	} else if (slots.mutate.action === 'add') {
		steps.push({ type: 'proposeFavorite' });
	}
	return steps.length ? steps : [{ type: 'noop' }];
}

export function primaryKindFrom(slots: IntentSlots): EnglishIntentKind {
	if (slots.mutate.action === 'remove') return 'favorite_remove';
	if (slots.mutate.action === 'query') return 'favorite_query';
	if (slots.generate === 'pack') return 'pack_generate';
	if (slots.generate === 'reading') return 'reading_generate';
	if (slots.mutate.action === 'add') return 'favorite_add';
	if (slots.categoryAsk) return 'category_filter';
	if (slots.inventory) return 'inventory';
	return 'chat';
}

export function intentFromFrame(frame: IntentFrame): EnglishIntent {
	const kind = primaryKindFrom(frame.slots);
	const side = frame.slots.mutate.side;
	return {
		kind,
		...(kind === 'favorite_remove' || kind === 'favorite_add' ? { side } : {}),
		needsFilterCards: frame.plan.some(
			(s) => s.type === 'ensureFilterThenPropose',
		),
	};
}

export function planHas(
	frame: IntentFrame | undefined,
	type: PlanStep['type'],
	fallback: () => boolean,
): boolean {
	if (!intentFrameEnabled() || !frame) return fallback();
	return frame.plan.some((s) => s.type === type);
}

function matchCueInCatalog(
	cue: NonNullable<IntentSlots['libraryCue']>,
	libs: { id: string; title: string }[],
): { id: string; title: string } | null {
	if (cue.libraryId) {
		const byId = libs.find((lib) => lib.id === cue.libraryId);
		if (byId) return byId;
	}
	const key = cue.raw.trim();
	if (!key) return null;
	const hits = libs.filter((lib) => {
		const title = lib.title.trim();
		return (
			title.length > 0 &&
			(title === key || title.includes(key) || key.includes(title))
		);
	});
	if (hits.length === 1) return hits[0];
	const ranked = [...hits].sort((a, b) => b.title.length - a.title.length);
	if (ranked.length >= 2 && ranked[0].title.length > ranked[1].title.length) {
		return ranked[0];
	}
	if (ranked.length === 1) return ranked[0];
	return null;
}

/** 目录就绪后填 libraryCue；本句 miss 时继承 priorFrame。 */
export function fillLibraryCue(
	frame: IntentFrame,
	userText: string,
	libs: { id: string; title: string }[],
	markSource?: RegExp,
	priorFrame?: PriorFrameSummary,
): void {
	if (!frame.plan.some((s) => s.type === 'resolveLibrary')) return;
	const named = resolveMentionedLibrary(userText, libs, markSource);
	if (named.kind === 'one') {
		frame.slots.libraryCue = {
			raw: named.lib.title,
			libraryId: named.lib.id,
			status: 'one',
		};
		return;
	}
	if (named.kind === 'ambiguous') {
		frame.slots.libraryCue = {
			raw: named.candidates[0]?.title ?? '',
			status: 'ambiguous',
		};
		return;
	}
	// absent / none：尝试 prior 或已挂在 slots 上的 raw
	const inherit = frame.slots.libraryCue ?? priorFrame?.libraryCue;
	if (inherit?.status === 'one') {
		const hit = matchCueInCatalog(inherit, libs);
		if (hit) {
			frame.slots.libraryCue = {
				raw: hit.title,
				libraryId: hit.id,
				status: 'one',
			};
			return;
		}
	}
	frame.slots.libraryCue = {
		raw: '',
		status: named.kind === 'absent' ? 'absent' : 'none',
	};
}

/** cue 已 ambiguous 时跳过后续 classify。 */
export function libraryCueBlocksClassify(
	frame: IntentFrame | undefined,
): boolean {
	return frame?.slots.libraryCue?.status === 'ambiguous';
}

/**
 * 从 frame 取续查库；无则 null（交给 legacy shouldFilterContinue）。
 */
export function libraryFromFrame(
	frame: IntentFrame | undefined,
	catalog: { id: string; title: string }[],
): { id: string; title: string } | null {
	if (!frame?.slots.categoryAsk) return null;
	const cue = frame.slots.libraryCue;
	if (!cue || cue.status !== 'one') return null;
	return matchCueInCatalog(cue, catalog);
}
