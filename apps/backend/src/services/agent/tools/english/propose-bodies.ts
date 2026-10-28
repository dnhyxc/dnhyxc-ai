import { asString, type ElEnvelope, elFail } from './envelope';

export type VocabLibrarySnap = {
	ipa: string;
	pos: string;
	segmentation: string;
	translationZh: string;
	example: string;
};

export type LibrarySnapRow = VocabLibrarySnap & {
	wordKey: string;
	libraryId: string;
	ownerId: number;
};

function clipSnap(row: LibrarySnapRow): VocabLibrarySnap {
	return {
		ipa: (row.ipa ?? '').slice(0, 500),
		pos: (row.pos ?? '').trim().slice(0, 32),
		segmentation: (row.segmentation ?? '').trim().slice(0, 500),
		translationZh: row.translationZh ?? '',
		example: row.example ?? '',
	};
}

/**
 * 一批词尽量取自同一词库（覆盖词最多的那个）。
 * 单词则按译文完全一致、再按本人词库挑。
 */
export function pickLibrarySnapshots(
	rows: LibrarySnapRow[],
	userId: number,
	hints: ReadonlyMap<string, string>,
): Map<string, VocabLibrarySnap> {
	const byWord = new Map<string, LibrarySnapRow[]>();
	const wordsByLib = new Map<string, Set<string>>();
	for (const row of rows) {
		if (!row.wordKey) continue;
		const list = byWord.get(row.wordKey) ?? [];
		list.push(row);
		byWord.set(row.wordKey, list);
		if (!row.ipa?.trim() || !row.libraryId) continue;
		const set = wordsByLib.get(row.libraryId) ?? new Set<string>();
		set.add(row.wordKey);
		wordsByLib.set(row.libraryId, set);
	}
	let bestLib = '';
	let bestCount = 0;
	let bestHintHits = -1;
	for (const [libraryId, set] of wordsByLib) {
		let hintHits = 0;
		for (const key of set) {
			const hint = hints.get(key)?.trim();
			if (!hint) continue;
			const hit = (byWord.get(key) ?? []).some(
				(row) =>
					row.libraryId === libraryId && row.translationZh?.trim() === hint,
			);
			if (hit) hintHits += 1;
		}
		if (
			set.size > bestCount ||
			(set.size === bestCount && hintHits > bestHintHits)
		) {
			bestCount = set.size;
			bestHintHits = hintHits;
			bestLib = libraryId;
		}
	}
	const useLib = bestCount >= 2 ? bestLib : '';
	const map = new Map<string, VocabLibrarySnap>();
	for (const [key, list] of byWord) {
		const hint = hints.get(key)?.trim() ?? '';
		const best = [...list].sort((a, b) => {
			const score = (row: LibrarySnapRow) => {
				const exact = hint && row.translationZh?.trim() === hint ? 0 : 1;
				const own = Number(row.ownerId) === userId ? 0 : 1;
				const ipa = row.ipa?.trim() ? 0 : 1;
				const fromBatch = useLib && row.libraryId === useLib ? 0 : 1;
				return fromBatch * 8 + exact * 4 + own * 2 + ipa;
			};
			return score(a) - score(b);
		})[0];
		if (best) map.set(key, clipSnap(best));
	}
	return map;
}

type FavoriteWrite = {
	word: string;
	ipa?: string;
	pos?: string;
	segmentation?: string;
	translationZh?: string;
	example?: string;
};

export type FavoriteInsert = {
	wordKey: string;
	word: string;
	ipa: string;
	pos: string;
	segmentation: string;
	translationZh: string;
	example: string;
};

/** 已有收藏只在音标为空时补字段，规则与单条 addVocabularyFavorite 相同。 */
export function fillEmptyFavoriteFields(
	existed: {
		ipa: string;
		pos: string;
		segmentation: string;
		example: string;
		translationZh: string;
	},
	item: FavoriteWrite,
): boolean {
	const incomingIpa = typeof item.ipa === 'string' ? item.ipa.trim() : '';
	if (existed.ipa.trim() || !incomingIpa) return false;
	existed.ipa = incomingIpa.slice(0, 500);
	const pos = typeof item.pos === 'string' ? item.pos.trim().slice(0, 32) : '';
	const segmentation =
		typeof item.segmentation === 'string'
			? item.segmentation.trim().slice(0, 500)
			: '';
	if (!existed.pos.trim() && pos) existed.pos = pos;
	if (!existed.segmentation.trim() && segmentation) {
		existed.segmentation = segmentation;
	}
	if (!existed.example.trim() && item.example?.trim()) {
		existed.example = item.example;
	}
	if (!existed.translationZh.trim() && item.translationZh?.trim()) {
		existed.translationZh = item.translationZh;
	}
	return true;
}

/**
 * 确认写入前的内存划分：新词插入，已有词只补空音标。
 * existed 是库里已有的行数，不是本次补了音标的行数。
 */
export function applyFavoriteBatch<
	T extends {
		wordKey: string;
		ipa: string;
		pos: string;
		segmentation: string;
		example: string;
		translationZh: string;
	},
>(items: FavoriteWrite[], existing: T[]) {
	const byKey = new Map<string, FavoriteWrite>();
	for (const item of items) {
		const wordKey = item.word.trim().toLowerCase();
		if (!wordKey || byKey.has(wordKey)) continue;
		byKey.set(wordKey, item);
	}
	const have = new Map(existing.map((row) => [row.wordKey, row]));
	const fresh: FavoriteInsert[] = [];
	const patched: T[] = [];
	for (const [wordKey, item] of byKey) {
		const row = have.get(wordKey);
		if (!row) {
			fresh.push({
				wordKey,
				word: item.word.trim(),
				ipa: typeof item.ipa === 'string' ? item.ipa : '',
				pos: typeof item.pos === 'string' ? item.pos.trim().slice(0, 32) : '',
				segmentation:
					typeof item.segmentation === 'string'
						? item.segmentation.trim().slice(0, 500)
						: '',
				translationZh: item.translationZh ?? '',
				example: item.example ?? '',
			});
			continue;
		}
		if (fillEmptyFavoriteFields(row, item)) patched.push(row);
	}
	return {
		fresh,
		patched,
		created: fresh.length,
		existed: existing.length,
	};
}

function keptField(
	row: Record<string, unknown>,
	key: string,
	next: string,
	max?: number,
): string {
	const cur = row[key];
	const text = typeof cur === 'string' && cur.trim() ? cur : next;
	return max ? text.slice(0, max) : text;
}

/** 模型没带的音标、词性、音节、例句用词库快照补上；已有内容不动。 */
export function fillFavoriteFields(
	row: Record<string, unknown>,
	snap: VocabLibrarySnap | undefined,
): Record<string, unknown> {
	if (!snap) return row;
	return {
		...row,
		ipa: keptField(row, 'ipa', snap.ipa, 500),
		pos: keptField(row, 'pos', snap.pos, 32),
		segmentation: keptField(row, 'segmentation', snap.segmentation, 500),
		translationZh: keptField(row, 'translationZh', snap.translationZh),
		example: keptField(row, 'example', snap.example),
	};
}

export type ProposeBodies =
	| { ok: true; items: Record<string, unknown>[] }
	| { ok: false; env: ElEnvelope };

/** 单条收藏/错题字段。`add` 直写仍走这里。 */
export function buildFavoriteBody(
	kind: 'vocab' | 'classic',
	args: Record<string, unknown>,
):
	| { ok: true; body: Record<string, unknown> }
	| { ok: false; env: ElEnvelope } {
	if (kind === 'vocab') {
		const word = asString(args.word)?.trim();
		if (!word) return { ok: false, env: elFail('bad_args', '需要 word') };
		return {
			ok: true,
			body: {
				word,
				ipa: asString(args.ipa) ?? '',
				pos: asString(args.pos) ?? '',
				segmentation: asString(args.segmentation) ?? '',
				translationZh: asString(args.translationZh) ?? '',
				example: asString(args.example) ?? '',
				lastUserInput: asString(args.lastUserInput) ?? '',
			},
		};
	}
	const english = asString(args.english)?.trim();
	if (!english) return { ok: false, env: elFail('bad_args', '需要 english') };
	return {
		ok: true,
		body: {
			english,
			translationZh: asString(args.translationZh) ?? '',
			source: asString(args.source) ?? '',
			noteZh: asString(args.noteZh) ?? '',
			lastUserInput: asString(args.lastUserInput) ?? '',
		},
	};
}

/** 显式 kind 优先。只有 english、没有 word 时是语句，其余保持单词。 */
export function inferContentKind(
	args: Record<string, unknown>,
): 'vocab' | 'classic' {
	if (args.kind === 'classic') return 'classic';
	if (args.kind === 'vocab') return 'vocab';
	const items = Array.isArray(args.items) ? args.items : [];
	const rows = items.filter(
		(row): row is Record<string, unknown> =>
			!!row && typeof row === 'object' && !Array.isArray(row),
	);
	const pool = rows.length > 0 ? rows : [args];
	const hasEnglish = pool.some(
		(row) => typeof row.english === 'string' && row.english.trim().length > 0,
	);
	const hasWord = pool.some(
		(row) => typeof row.word === 'string' && row.word.trim().length > 0,
	);
	if (hasEnglish && !hasWord) return 'classic';
	return 'vocab';
}

function rowKey(
	kind: 'vocab' | 'classic',
	row: Record<string, unknown>,
): string {
	const raw = kind === 'vocab' ? row.word : row.english;
	return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/**
 * 多词一次收成数组。有 items 时忽略顶层 word/english。
 * 按词形去重。一次调用里的词全部留下，同轮第二次提案由 stop_tools 拦住。
 */
export function collectProposeBodies(
	kind: 'vocab' | 'classic',
	args: Record<string, unknown>,
): ProposeBodies {
	const rawItems = Array.isArray(args.items) ? args.items : null;
	const sources =
		rawItems && rawItems.length > 0
			? rawItems.filter(
					(row): row is Record<string, unknown> =>
						!!row && typeof row === 'object' && !Array.isArray(row),
				)
			: [args];
	const rows: Record<string, unknown>[] = [];
	if (sources.length === 1 && sources[0] === args) {
		const one = buildFavoriteBody(kind, args);
		if (!one.ok) return { ok: false, env: one.env };
		rows.push(one.body);
	} else {
		for (const src of sources) {
			const one = buildFavoriteBody(kind, src);
			if (one.ok) rows.push(one.body);
		}
		if (!rows.length) {
			return { ok: false, env: elFail('bad_args', 'items 里没有有效词条') };
		}
	}
	const seen = new Set<string>();
	const deduped: Record<string, unknown>[] = [];
	for (const row of rows) {
		const key = rowKey(kind, row);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		deduped.push(row);
	}
	return { ok: true, items: deduped };
}

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pushRemoveToken(raw: unknown, ids: string[], words: string[]): void {
	if (typeof raw === 'string') {
		const text = raw.trim();
		if (!text) return;
		if (UUID_RE.test(text)) ids.push(text);
		else words.push(text);
		return;
	}
	if (Array.isArray(raw)) {
		for (const item of raw) pushRemoveToken(item, ids, words);
		return;
	}
	if (!raw || typeof raw !== 'object') return;
	const row = raw as Record<string, unknown>;
	const id = typeof row.id === 'string' ? row.id.trim() : '';
	if (id && UUID_RE.test(id)) {
		ids.push(id);
		return;
	}
	const word = typeof row.word === 'string' ? row.word.trim() : '';
	const english = typeof row.english === 'string' ? row.english.trim() : '';
	if (word) words.push(word);
	else if (english) words.push(english);
}

function uniqueText(list: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of list) {
		const key = item.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(item);
	}
	return out;
}

/** 取消收藏：id 与词面都收。id 可以是字符串或数组，词面同理。 */
export function collectRemoveRequest(args: Record<string, unknown>): {
	ids: string[];
	words: string[];
} {
	const ids: string[] = [];
	const words: string[] = [];
	pushRemoveToken(args.ids, ids, words);
	pushRemoveToken(args.id, ids, words);
	pushRemoveToken(args.items, ids, words);
	pushRemoveToken(args.words, ids, words);
	pushRemoveToken(args.word, ids, words);
	return { ids: uniqueText(ids), words: uniqueText(words) };
}
