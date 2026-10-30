import { type ElEnvelope, elOk } from './envelope';
import type { ElProposalPayload } from './proposal.store';
import { collectProposeBodies } from './propose-bodies';
import { isCategoryAsk } from './spill';

export type FavoriteAsk = {
	action: 'add';
	kind: 'vocab' | 'classic' | 'card';
};

export type FavoriteIntent = {
	action: 'add' | 'remove' | null;
	side: 'vocab' | 'classic' | 'both' | 'card';
};

const SAVE_RE =
	/进行收藏|加入收藏|重新收藏|再收藏|又收藏|收藏这些|收藏它们|收藏他们|帮我收藏|把.{0,24}收藏|将.{0,12}收藏|都收藏|一起收藏/;
const CLASSIC_RE = /语句|句子|经典句/;
const VOCAB_RE = /单词|词汇|词书/;
// 盘点/疑问优先，避免「当前收藏了哪些」被打成 add
const FAVORITE_QUERY_RE =
	/收藏(列表|夹)|看看收藏|查看收藏|打开收藏|我的收藏|语句收藏里|单词收藏里|当前收藏|收藏了哪些|收藏了什么|有哪些收藏|有什么收藏|哪些单词和语句|收藏了哪些单词|收藏了哪些语句/;
const SOFT_ADD_RE = /需要收藏|想收藏|要收藏|给我收藏/;
const SOFT_REF_RE = /之前|上述|这些|它们|他们|刚才|刚刚/;

/**
 * 没点名英文的取消。含「还是取消吧」。
 * 返回 null：原话里有英文词，或这句同时在找新内容，仍走原来的工具或当作新话题。
 * 非 null 只表示这句是取消。撤哪些由 lastFavoriteScope 决定。
 */
// 含「那帮我取消」：不进闸会在回扫处断窗，下一句「上述」会落到整库卡
const CANCEL_RE =
	/取消收藏|移除收藏|不要收藏|别收藏|取消吧|(?:那)?(?:帮我)?取消(?:吧|掉|了)?$/;
const CANCEL_TOPIC_RE = /找出|生成|分类|关于|有关/;

export function unfavoriteFromCards(
	userText: string,
): 'both' | 'vocab' | 'classic' | null {
	const text = userText.trim();
	if (!text || /[A-Za-z]{2,}/.test(text)) return null;
	if (CANCEL_TOPIC_RE.test(text) || !CANCEL_RE.test(text)) return null;
	const classic = CLASSIC_RE.test(text);
	const vocab = VOCAB_RE.test(text);
	if (vocab && !classic) return 'vocab';
	if (classic && !vocab) return 'classic';
	return 'both';
}

/** 询问已有收藏：不挂添加确认。 */
export function isFavoriteQuery(userText: string): boolean {
	const text = userText.trim();
	if (!text || !/收藏/.test(text)) return false;
	if (FAVORITE_QUERY_RE.test(text)) return true;
	if (/哪些|什么|多少|有没有|列出/.test(text) && /收藏/.test(text)) {
		// 「帮我收藏哪些」仍走保存动词
		if (SAVE_RE.test(text)) return false;
		return true;
	}
	return false;
}

/** 无 SAVE_RE 时的添加：需要收藏… / 指代 + 收藏。 */
export function isFavoriteSoftAdd(userText: string): boolean {
	const text = userText.trim();
	if (SOFT_ADD_RE.test(text)) return true;
	if (SOFT_REF_RE.test(text) && /收藏/.test(text)) return true;
	return false;
}

/** 收藏且关于类：必须先有筛选卡，不能直接抱怨「上面没有」。 */
export function favoriteNeedsFilterCards(userText: string): boolean {
	const intent = resolveFavoriteIntent(userText);
	if (intent.action !== 'add') return false;
	return isCategoryAsk(userText);
}

/** 复合句分类仍失败时的软失败文案（禁止「上面没有可收藏的单词卡」）。 */
export function favoriteFilterMissReply(labels: string[] = []): string {
	if (labels.length) {
		return `没有从指定词库/语句库筛出可收藏的「${labels.join('、')}」类条目。`;
	}
	return '没有从指定词库/语句库筛出可收藏的条目。';
}

/**
 * 本轮收藏意图总闸。取消优先；查询优先于添加；添加靠 SAVE_RE 或软添加。
 * 查询收藏夹返回 null。
 */
export function resolveFavoriteIntent(userText: string): FavoriteIntent {
	const text = userText.trim();
	if (!text) return { action: null, side: 'card' };
	const cancel = unfavoriteFromCards(text);
	if (cancel) return { action: 'remove', side: cancel };
	if (!/收藏/.test(text)) return { action: null, side: 'card' };
	if (isFavoriteQuery(text)) return { action: null, side: 'card' };
	const verb = SAVE_RE.test(text);
	const soft = isFavoriteSoftAdd(text);
	if (!verb && !soft) return { action: null, side: 'card' };
	const classic = CLASSIC_RE.test(text);
	const vocab = VOCAB_RE.test(text);
	if (classic && vocab) return { action: 'add', side: 'both' };
	if (vocab) return { action: 'add', side: 'vocab' };
	if (classic) return { action: 'add', side: 'classic' };
	return { action: 'add', side: 'card' };
}

/** 只看用户原话。查询「语句收藏」不算保存。两侧都点名时 kind 仍是 card。 */
export function favoriteAsk(userText: string): FavoriteAsk | null {
	const intent = resolveFavoriteIntent(userText);
	if (intent.action !== 'add') return null;
	if (intent.side === 'vocab') return { action: 'add', kind: 'vocab' };
	if (intent.side === 'classic') return { action: 'add', kind: 'classic' };
	return { action: 'add', kind: 'card' };
}

/** 收藏句里同时写了单词和语句。只写「这些」仍是 card，不在这里。 */
export function favoriteAsksBoth(userText: string): boolean {
	const intent = resolveFavoriteIntent(userText);
	return intent.action === 'add' && intent.side === 'both';
}

export const FAVORITE_CARD_CAP = 40;

export function cardOk(
	card:
		| {
				contentKind?: string;
				items?: unknown[];
		  }
		| null
		| undefined,
): boolean {
	if (!card) return false;
	if (card.contentKind !== 'vocab' && card.contentKind !== 'classic')
		return false;
	const n = card.items?.length ?? 0;
	return n >= 1 && n <= FAVORITE_CARD_CAP;
}

type CardRow = {
	contentKind?: 'vocab' | 'classic';
	items?: unknown[];
	artifactId?: string;
};

export function pickFavoriteCards<T extends CardRow>(
	ask: FavoriteAsk,
	lists: T[],
): T[] {
	const cards: T[] = [];
	for (const card of lists) {
		if (!cardOk(card)) continue;
		if (ask.kind !== 'card' && ask.kind !== card.contentKind) continue;
		cards.push(card);
	}
	return cards;
}

export function pickFavoriteCard<T extends CardRow>(
	ask: FavoriteAsk,
	lists: T[],
): T | null {
	const cards = pickFavoriteCards(ask, lists);
	return cards.at(-1) ?? null;
}

type FavoriteLookup = {
	listVocabularyFavoriteRefsForWords(
		userId: number,
		words: string[],
	): Promise<Array<{ wordKey: string }>>;
	normalizeVocabularyFavoriteWordKey(word: string): string;
	listClassicQuoteFavoriteRefsForEnglishes(
		userId: number,
		englishes: string[],
	): Promise<Array<{ contentKey: string }>>;
	classicQuoteFavoriteContentKey(english: string): string;
};

type ProposalPut = {
	put(userId: number, payload: ElProposalPayload): Promise<string>;
};

/**
 * 挂确认条。cardCounts 时条目和数字都用卡片全量，已在收藏的行留给 commit 记已存在。
 * 全无新行则不挂。
 */
export async function proposeFavoriteRows(
	learning: FavoriteLookup,
	proposals: ProposalPut,
	userId: number,
	kind: 'vocab' | 'classic',
	rows: Record<string, unknown>[],
	cardCounts = false,
): Promise<ElEnvelope> {
	const built = collectProposeBodies(kind, { items: rows });
	if (!built.ok) return built.env;
	const kept = await dropSaved(learning, userId, kind, built.items);
	if (!kept.length) {
		return elOk(
			{ matched: 0 },
			{ message: '这些已经在收藏里，没有新的可确认项' },
		);
	}
	const items = cardCounts ? built.items : kept;
	const proposalId = await proposals.put(userId, {
		kind: 'favorite_add',
		contentKind: kind,
		body: items[0] ?? {},
		items,
	});
	const label =
		kind === 'classic'
			? `确认收藏 ${items.length} 条语句`
			: `确认收藏 ${items.length} 个词`;
	return elOk(
		{ proposalId, count: kept.length },
		{
			message: `请用户确认后再写入。确认条：${label}`,
			ui: [{ type: 'confirm_proposal', proposalId, label }],
		},
	);
}

function keptKeyRows(
	rows: Record<string, unknown>[],
	field: 'word' | 'english',
	have: Set<string>,
	keyOf: (value: string) => string,
): Record<string, unknown>[] {
	return rows.filter((row) => !have.has(keyOf(String(row[field] ?? ''))));
}

async function dropSaved(
	learning: FavoriteLookup,
	userId: number,
	kind: 'vocab' | 'classic',
	rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
	if (kind === 'vocab') {
		const refs = await learning.listVocabularyFavoriteRefsForWords(
			userId,
			rows.map((row) => String(row.word ?? '')),
		);
		const have = new Set(refs.map((row) => row.wordKey));
		return keptKeyRows(rows, 'word', have, (value) =>
			learning.normalizeVocabularyFavoriteWordKey(value),
		);
	}
	const refs = await learning.listClassicQuoteFavoriteRefsForEnglishes(
		userId,
		rows.map((row) => String(row.english ?? '')),
	);
	const have = new Set(refs.map((row) => row.contentKey));
	return keptKeyRows(rows, 'english', have, (value) =>
		learning.classicQuoteFavoriteContentKey(value),
	);
}

function dedupeField(
	rows: Record<string, unknown>[],
	field: 'word' | 'english',
): Record<string, unknown>[] {
	const seen = new Set<string>();
	const items: Record<string, unknown>[] = [];
	for (const row of rows) {
		const key = String(row[field] ?? '')
			.trim()
			.toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		items.push(row);
	}
	return items;
}

export function cardItemRows(
	cards: { items?: unknown[] }[],
): Record<string, unknown>[] {
	const rows: Record<string, unknown>[] = [];
	for (const card of cards) {
		for (const row of card.items ?? []) {
			if (row && typeof row === 'object' && !Array.isArray(row)) {
				rows.push(row as Record<string, unknown>);
			}
		}
	}
	return rows;
}

/** 收藏工具参数里的行。没有 items 时，顶层 word 或 english 算一行。 */
export function rowsOfProposeArgs(
	args: Record<string, unknown>,
): Record<string, unknown>[] {
	const items = Array.isArray(args.items) ? args.items : [];
	const rows = items.filter(
		(row): row is Record<string, unknown> =>
			!!row && typeof row === 'object' && !Array.isArray(row),
	);
	if (rows.length) return rows;
	if (typeof args.word === 'string' || typeof args.english === 'string') {
		return [args];
	}
	return [];
}

/** 有 word 的进单词，只有 english 的进语句。 */
export function splitFavoriteRows(rows: Record<string, unknown>[]): {
	vocab: Record<string, unknown>[];
	classic: Record<string, unknown>[];
} {
	const vocab: Record<string, unknown>[] = [];
	const classic: Record<string, unknown>[] = [];
	for (const row of rows) {
		const word = typeof row.word === 'string' ? row.word.trim() : '';
		const english = typeof row.english === 'string' ? row.english.trim() : '';
		if (word) vocab.push(row);
		else if (english) classic.push(row);
	}
	return { vocab, classic };
}

/**
 * 两边都有卡片行才挂一条。数字用卡片行数，不用剔除后的剩余。
 * 有一边本来就是空则返回 null。两边都已在收藏里则不挂条。
 */
export async function proposePairedFavorites(
	learning: FavoriteLookup,
	proposals: ProposalPut,
	userId: number,
	vocabRows: Record<string, unknown>[],
	classicRows: Record<string, unknown>[],
): Promise<ElEnvelope | null> {
	const words = dedupeField(vocabRows, 'word');
	const quotes = dedupeField(classicRows, 'english');
	if (!words.length || !quotes.length) return null;
	const keptWords = await dropSaved(learning, userId, 'vocab', words);
	const keptQuotes = await dropSaved(learning, userId, 'classic', quotes);
	if (!keptWords.length && !keptQuotes.length) {
		return elOk(
			{ matched: 0 },
			{ message: '这些已经在收藏里，没有新的可确认项' },
		);
	}
	const proposalId = await proposals.put(userId, {
		kind: 'favorite_add',
		contentKind: 'classic',
		body: quotes[0] ?? {},
		items: quotes,
		paired: { contentKind: 'vocab', items: words },
	});
	const label = `确认收藏 ${words.length} 个词、${quotes.length} 条语句`;
	return elOk(
		{ proposalId, count: words.length + quotes.length },
		{
			message: `请用户确认后再写入。确认条：${label}`,
			ui: [{ type: 'confirm_proposal', proposalId, label }],
		},
	);
}

type ScopeCard = {
	title?: string;
	contentKind?: string;
	items?: unknown[];
	source?: string;
	libraryId?: string;
	categoryLabels?: string[];
	artifactId?: string;
};

export type FavoriteSet = {
	side: 'vocab' | 'classic' | 'both';
	vocab: ScopeCard[];
	classic: ScopeCard[];
};

export type FavoritePlan = {
	label: string;
	reply: string;
	hang: boolean;
	vocab: ScopeCard[];
	classic: ScopeCard[];
};

export type FavoriteScopeMessage = {
	role: string;
	content?: string | null;
	elResources?: ScopeCard[] | null;
};

export type FavoriteScope = {
	side: 'vocab' | 'classic' | 'both';
	cards: ScopeCard[];
	askIndex: number;
};

/** 收藏原话的类别。「将这些进行收藏」只算语句。 */
export function inheritedSide(text: string): 'vocab' | 'classic' | 'both' {
	if (favoriteAsksBoth(text)) return 'both';
	if (favoriteAsk(text)?.kind === 'vocab') return 'vocab';
	return 'classic';
}

/** 取消句单独点了一类时收窄；两类都点了就两边一起撤。没点名则沿用上一次收藏。 */
export function cancelSide(
	cancelText: string,
	inherited: 'vocab' | 'classic' | 'both',
): 'vocab' | 'classic' | 'both' {
	const classic = CLASSIC_RE.test(cancelText);
	const vocab = VOCAB_RE.test(cancelText);
	if (classic && vocab) return 'both';
	if (classic && !vocab) return 'classic';
	if (vocab && !classic) return 'vocab';
	return inherited;
}

/**
 * 上一次收藏那一轮的卡。先看这句后面助手自己挂的；没有再看这句前面的分类窗。
 * 取消若把类别扩成 both，仍走这里，才能把更早的单词卡一并找回。
 */
export function favoriteScopeCards(
	messages: FavoriteScopeMessage[],
	askIndex: number,
	side: 'vocab' | 'classic' | 'both',
	priorIndexes: (
		slice: FavoriteScopeMessage[],
		bridgeFavorites: boolean,
	) => number[],
): ScopeCard[] {
	const own = cardsOf(messages, askIndex, side, 'after', false, priorIndexes);
	if (own.length) return own;
	// 跨过更早的收藏句，才能摸到分类卡。和 favoriteSet 同一扇窗。
	return cardsOf(messages, askIndex, side, 'before', true, priorIndexes);
}

/** 添加/范围选卡只认词库语句库；复习 other、收藏夹等不进名单。 */
export function favoriteEligibleCard(
	card: { source?: string; items?: unknown[] } | null | undefined,
): boolean {
	if (!card?.items?.length) return false;
	return card.source === 'library';
}

function keepCard(
	card: ScopeCard,
	side: 'vocab' | 'classic' | 'both',
): boolean {
	if (!favoriteEligibleCard(card)) return false;
	if (side === 'both') {
		return card.contentKind === 'vocab' || card.contentKind === 'classic';
	}
	return card.contentKind === side;
}

/** 同一库同一类别留行数最多的一张。没有类别的卡不互相覆盖。 */
function richest(cards: ScopeCard[]): ScopeCard[] {
	const groups = new Map<string, ScopeCard>();
	const rest: ScopeCard[] = [];
	for (const card of cards) {
		const label = card.categoryLabels?.[0];
		if (!card.libraryId || !label) {
			rest.push(card);
			continue;
		}
		const key = `${card.libraryId}:${label}`;
		const prev = groups.get(key);
		if (!prev || (card.items?.length ?? 0) > (prev.items?.length ?? 0)) {
			groups.set(key, card);
		}
	}
	return [...rest, ...groups.values()];
}

/** 同侧已有分类筛选卡时，无类别的整库「词条」卡不能冒充「上述」。 */
function dropFullLibraryCards(cards: ScopeCard[]): ScopeCard[] {
	const hasFiltered = (kind: string) =>
		cards.some(
			(card) =>
				card.contentKind === kind && (card.categoryLabels?.length ?? 0) > 0,
		);
	return cards.filter((card) => {
		const kind = card.contentKind ?? '';
		if (!hasFiltered(kind)) return true;
		return (card.categoryLabels?.length ?? 0) > 0;
	});
}

/** 这句要收藏的卡。历史窗口与本轮库卡同一池再 richest。 */
export function favoriteSet(
	messages: FavoriteScopeMessage[],
	userText: string,
	priorIndexes: (
		slice: FavoriteScopeMessage[],
		bridgeFavorites: boolean,
	) => number[],
	turnCards: ScopeCard[] = [],
): FavoriteSet | null {
	const ask = favoriteAsk(userText);
	if (!ask) return null;
	const side = favoriteAsksBoth(userText)
		? 'both'
		: ask.kind === 'vocab'
			? 'vocab'
			: 'classic';
	const indexes = priorIndexes(messages, true);
	const fromHistory = indexes.flatMap((index) =>
		(messages[index]?.elResources ?? []).filter((card) =>
			favoriteEligibleCard(card),
		),
	);
	const fromTurn = turnCards.filter((card) => favoriteEligibleCard(card));
	const full = dropFullLibraryCards(richest([...fromHistory, ...fromTurn]));
	return {
		side,
		vocab:
			side === 'classic'
				? []
				: full.filter((card) => card.contentKind === 'vocab'),
		classic:
			side === 'vocab'
				? []
				: full.filter((card) => card.contentKind === 'classic'),
	};
}

function cardCount(cards: ScopeCard[]): number {
	return cards.reduce((sum, card) => sum + (card.items?.length ?? 0), 0);
}

/** 以 set 为准；某侧空时才用本轮库卡兜底。两类缺一侧不挂条。 */
export function planFavoriteHang(input: {
	set: FavoriteSet;
	turnVocab: ScopeCard[];
	turnClassic: ScopeCard[];
}): FavoritePlan {
	const turnVocab = input.turnVocab.filter((card) =>
		favoriteEligibleCard(card),
	);
	const turnClassic = input.turnClassic.filter((card) =>
		favoriteEligibleCard(card),
	);
	const vocab = input.set.vocab.length ? input.set.vocab : turnVocab;
	const classic = input.set.classic.length ? input.set.classic : turnClassic;
	const vocabCount = cardCount(vocab);
	const classicCount = cardCount(classic);
	const side = input.set.side;
	if (side === 'both' && (vocabCount === 0 || classicCount === 0)) {
		return {
			label: '',
			reply:
				vocabCount === 0
					? '上面没有可收藏的单词卡。'
					: '上面没有可收藏的语句卡。',
			hang: false,
			vocab,
			classic,
		};
	}
	if (
		(side === 'vocab' && vocabCount === 0) ||
		(side === 'classic' && classicCount === 0)
	) {
		return {
			label: '',
			reply:
				side === 'vocab'
					? '上面没有可收藏的单词卡。'
					: '上面没有可收藏的语句卡。',
			hang: false,
			vocab,
			classic,
		};
	}
	const lines = [
		...vocab.map(
			(card) => `${card.title ?? '单词'}：${card.items?.length ?? 0} 个词。`,
		),
		...classic.map(
			(card) => `${card.title ?? '语句'}：${card.items?.length ?? 0} 条语句。`,
		),
	];
	const label =
		side === 'both'
			? `确认收藏 ${vocabCount} 个词、${classicCount} 条语句`
			: side === 'vocab'
				? `确认收藏 ${vocabCount} 个词`
				: `确认收藏 ${classicCount} 条语句`;
	return { label, reply: lines.join('\n'), hang: true, vocab, classic };
}

export function alreadySavedReply(plan: FavoritePlan): string {
	const vocabCount = cardCount(plan.vocab);
	const classicCount = cardCount(plan.classic);
	if (vocabCount > 0 && classicCount > 0) {
		return `这 ${vocabCount} 个词、${classicCount} 条语句已在收藏里。`;
	}
	if (vocabCount > 0) return `这 ${vocabCount} 个词已在收藏里。`;
	return `这 ${classicCount} 条语句已在收藏里。`;
}

/** 取消确认条与正文共用同一组 id 个数，不用 list 全量。 */
export function unfavoriteHangCopy(
	vocabCount: number,
	classicCount: number,
): { label: string; reply: string } | null {
	if (vocabCount <= 0 && classicCount <= 0) return null;
	if (vocabCount > 0 && classicCount > 0) {
		return {
			label: `确认取消收藏 ${vocabCount} 个词、${classicCount} 条语句`,
			reply: `将取消收藏 ${vocabCount} 个词、${classicCount} 条语句。`,
		};
	}
	if (vocabCount > 0) {
		return {
			label: `确认取消收藏 ${vocabCount} 个词`,
			reply: `将取消收藏 ${vocabCount} 个词。`,
		};
	}
	return {
		label: `确认取消收藏 ${classicCount} 条语句`,
		reply: `将取消收藏 ${classicCount} 条语句。`,
	};
}

function cardsOf(
	messages: FavoriteScopeMessage[],
	askIndex: number,
	side: 'vocab' | 'classic' | 'both',
	where: 'after' | 'before',
	bridgeFavorites: boolean,
	priorIndexes: (
		slice: FavoriteScopeMessage[],
		bridgeFavorites: boolean,
	) => number[],
): ScopeCard[] {
	const loose: ScopeCard[] = [];
	if (where === 'after') {
		for (let i = askIndex + 1; i < messages.length; i += 1) {
			const row = messages[i];
			if (row.role === 'user') break;
			if (row.role !== 'assistant') continue;
			loose.push(...(row.elResources ?? []));
		}
	} else {
		const slice = messages.slice(0, askIndex + 1);
		for (const index of priorIndexes(slice, bridgeFavorites)) {
			loose.push(...(slice[index]?.elResources ?? []));
		}
	}
	return richest(loose.filter((card) => keepCard(card, side)));
}

/**
 * 最近一条收藏原话圈定的卡片。
 * 跳过取消句。先碰到别的用户句则没有范围。
 * 那一轮自己有卡就只用那一轮；没有才看这句前面的分类窗。
 * 词句一起收藏的退路要跨过取消句，和添加时用的是同一扇窗。
 */
export function lastFavoriteScope(
	messages: FavoriteScopeMessage[],
	priorIndexes: (
		slice: FavoriteScopeMessage[],
		bridgeFavorites: boolean,
	) => number[],
): FavoriteScope | null {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const row = messages[i];
		if (row.role !== 'user') continue;
		if (unfavoriteFromCards(row.content ?? '')) continue;
		if (!favoriteAsk(row.content ?? '')) return null;
		const side = inheritedSide(row.content ?? '');
		return {
			side,
			askIndex: i,
			cards: favoriteScopeCards(messages, i, side, priorIndexes),
		};
	}
	return null;
}
