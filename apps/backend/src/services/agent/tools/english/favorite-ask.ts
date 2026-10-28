import { type ElEnvelope, elOk } from './envelope';
import type { ElProposalPayload } from './proposal.store';
import { collectProposeBodies } from './propose-bodies';

export type FavoriteAsk = {
	action: 'add';
	kind: 'vocab' | 'classic' | 'card';
};

const REJECT_RE = /取消收藏|移除收藏|不要收藏|别收藏/;
const SAVE_RE =
	/进行收藏|加入收藏|收藏这些|收藏它们|收藏他们|帮我收藏|把.{0,24}收藏/;

/** 只看用户原话。查询「语句收藏」不算保存。 */
export function favoriteAsk(userText: string): FavoriteAsk | null {
	const text = userText.trim();
	if (!text || REJECT_RE.test(text) || !SAVE_RE.test(text)) return null;
	const classic = /语句|句子|经典句/.test(text);
	const vocab = /单词|词汇|词书/.test(text);
	if (classic && !vocab) return { action: 'add', kind: 'classic' };
	if (vocab && !classic) return { action: 'add', kind: 'vocab' };
	return { action: 'add', kind: 'card' };
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

export function pickFavoriteCard<T extends CardRow>(
	ask: FavoriteAsk,
	lists: T[],
): T | null {
	for (let i = lists.length - 1; i >= 0; i -= 1) {
		const card = lists[i];
		if (!cardOk(card)) continue;
		if (ask.kind !== 'card' && ask.kind !== card.contentKind) continue;
		return card;
	}
	return null;
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

/** 去掉已收藏的，剩下的挂确认条。空的不挂。 */
export async function proposeFavoriteRows(
	learning: FavoriteLookup,
	proposals: ProposalPut,
	userId: number,
	kind: 'vocab' | 'classic',
	rows: Record<string, unknown>[],
): Promise<ElEnvelope> {
	const built = collectProposeBodies(kind, { items: rows });
	if (!built.ok) return built.env;
	let kept = built.items;
	if (kind === 'vocab') {
		const refs = await learning.listVocabularyFavoriteRefsForWords(
			userId,
			kept.map((row) => String(row.word ?? '')),
		);
		const have = new Set(refs.map((row) => row.wordKey));
		kept = kept.filter(
			(row) =>
				!have.has(
					learning.normalizeVocabularyFavoriteWordKey(String(row.word ?? '')),
				),
		);
	} else {
		const refs = await learning.listClassicQuoteFavoriteRefsForEnglishes(
			userId,
			kept.map((row) => String(row.english ?? '')),
		);
		const have = new Set(refs.map((row) => row.contentKey));
		kept = kept.filter(
			(row) =>
				!have.has(
					learning.classicQuoteFavoriteContentKey(String(row.english ?? '')),
				),
		);
	}
	if (!kept.length) {
		return elOk(
			{ matched: 0 },
			{ message: '这些已经在收藏里，没有新的可确认项' },
		);
	}
	const proposalId = await proposals.put(userId, {
		kind: 'favorite_add',
		contentKind: kind,
		body: kept[0] ?? {},
		items: kept,
	});
	const label =
		kind === 'classic'
			? `确认收藏 ${kept.length} 条语句`
			: `确认收藏 ${kept.length} 个词`;
	return elOk(
		{ proposalId, count: kept.length },
		{
			message: `请用户确认后再写入。确认条：${label}`,
			ui: [{ type: 'confirm_proposal', proposalId, label }],
		},
	);
}
