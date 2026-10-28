import type { ElResourceListPayload, ElResourceSource } from './artifact.store';
import { type ElEnvelope, elOk, fitItemsByChars } from './envelope';

/** 条数达到则外溢，不再把全表塞进模型上下文 */
export const EL_SPILL_MIN_ITEMS = 30;
/** 模型可见 JSON 达到则外溢 */
export const EL_SPILL_MIN_CHARS = 4_000;
/** 单帧 SSE 内联上限（条） */
export const EL_SSE_INLINE_MAX_ITEMS = 200;
/** 单帧 SSE 内联上限（字符） */
export const EL_SSE_INLINE_MAX_CHARS = 100_000;

export const EL_LIST_BAN =
	'清单已在卡片中展示，禁止逐条复述全文或输出 Markdown 长表；只用一两句导语说明范围与条数。不要写见上方或见下方。禁止提及导出。';

/** 瘦索引放不下时，单页行数 */
export const EL_SLIM_PAGE = 80;
/** 词库 list 不自动出卡时，瘦字段仍整表给模型的条数上限 */
export const EL_SLIM_MAX_ITEMS = 400;
/** 瘦字段 JSON 上限；超过则只给 preview */
export const EL_SLIM_MAX_CHARS = 12_000;

export type ListIntent = 'inventory' | 'filter' | 'other';

const FILTER_RE = /找出|筛|相关|有关|哪些是|属于|人体|挑出|主题/;
const INVENTORY_RE =
	/全部|所有单词|所有词|整个库|导出|列出全部|哪些错题|有哪些错|错题库|我的错题|列出错题|重新练习/;
/** 「所有英语四级单词库中的单词」：库名隔在「所有」和「单词」之间 */
const ALL_WORDS_RE = /所有.{0,16}(单词|词条|的词)/;

/** 只看用户原话。筛选词优先于「列出 / 全部」。 */
export function listIntent(userText: string): ListIntent {
	if (FILTER_RE.test(userText)) return 'filter';
	if (INVENTORY_RE.test(userText) || ALL_WORDS_RE.test(userText))
		return 'inventory';
	return 'other';
}

export type ElListSurface = {
	userText: string;
	/** 索引类 list 外溢的全量，默认不推卡片 */
	libraryLists: ElResourceListPayload[];
	presented: boolean;
	/** 本轮已经挂出的库或 artifact，同一 id 不再挂第二张 */
	shownLibraryIds: Set<string>;
	/** 库名清单，用来和原话做包含匹配 */
	catalog: { id: string; title: string }[];
	catalogKind?: 'vocab' | 'classic';
	/** 本轮已挂出的确认条。收尾补收藏时用来避免再挂一条。 */
	openProposalId?: string | null;
};

/** 库名整段出现在原话里才算命中。「英语系级」对不上「英语四级单词」。 */
export function matchLibraries(
	userText: string,
	libs: { id: string; title: string }[],
): { id: string; title: string }[] {
	return libs.filter(
		(lib) => lib.title.length > 0 && userText.includes(lib.title),
	);
}

/**
 * 整库词条卡只在原话恰好对上一个库、且该库本轮还没挂过时挂上。
 * 0 个或多个库名都不挂，避免模型每次猜不同的库。
 */
export function inventoryCardDecision(
	userText: string,
	libs: { id: string; title: string }[],
	libraryId: string,
	shown: ReadonlySet<string>,
): 'hang' | 'skip-shown' | 'no-card' {
	if (listIntent(userText) !== 'inventory') return 'no-card';
	const hits = matchLibraries(userText, libs);
	if (hits.length !== 1 || hits[0].id !== libraryId) return 'no-card';
	if (shown.has(libraryId)) return 'skip-shown';
	return 'hang';
}

/** 这些 id 都已经挂过卡。空列表不算已挂。 */
export function cardAlreadyShown(
	ids: Array<string | undefined>,
	shown: ReadonlySet<string>,
): boolean {
	const keys = ids.filter((id): id is string => !!id && id.length > 0);
	return keys.length > 0 && keys.every((id) => shown.has(id));
}

export function shouldSpill(items: unknown[]): boolean {
	if (items.length >= EL_SPILL_MIN_ITEMS) return true;
	return JSON.stringify(items).length >= EL_SPILL_MIN_CHARS;
}

export function canInlineItems(items: unknown[]): boolean {
	if (items.length > EL_SSE_INLINE_MAX_ITEMS) return false;
	return JSON.stringify(items).length <= EL_SSE_INLINE_MAX_CHARS;
}

/** SSE 帧：过大则去掉 items，前端凭 artifactId 再拉 */
export function forSse(row: ElResourceListPayload): ElResourceListPayload {
	if (row.items && canInlineItems(row.items)) return row;
	const { items: _items, ...rest } = row;
	return rest;
}

export function toPreview(
	items: unknown[],
): Array<{ en: string; zh?: string }> {
	return items.slice(0, 5).map((item) => {
		const row = previewOf(item);
		return row.zh ? row : { en: row.en };
	});
}

function textOf(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

export function previewOf(item: unknown): { en: string; zh?: string } {
	if (!item || typeof item !== 'object') {
		return { en: String(item ?? '').slice(0, 200) };
	}
	const o = item as Record<string, unknown>;
	const en =
		textOf(o.english) ||
		textOf(o.word) ||
		textOf(o.title) ||
		textOf(o.titleEn) ||
		textOf(o.topic) ||
		textOf(o.text) ||
		JSON.stringify(o).slice(0, 180);
	const zh =
		textOf(o.translationZh) ||
		textOf(o.zh) ||
		textOf(o.meaning) ||
		textOf(o.titleZh);
	return { en: en.slice(0, 200), ...(zh ? { zh: zh.slice(0, 200) } : {}) };
}

function sourceOf(tool: string): ElResourceSource {
	if (tool === 'el_items_search' || tool === 'el_libraries') return 'library';
	if (tool === 'el_favorites') return 'favorites';
	if (tool === 'el_mistakes') return 'mistakes';
	if (tool === 'el_daily_memo') return 'memo';
	if (tool === 'el_daily_reading') return 'reading';
	if (tool === 'el_packs') return 'pack';
	if (tool === 'el_notes') return 'notes';
	return 'other';
}

const TOOL_TITLE: Record<string, string> = {
	el_items_search: '词条',
	el_libraries: '库列表',
	el_favorites: '收藏',
	el_mistakes: '错题',
	el_daily_memo: '记词',
	el_daily_reading: '每日阅读',
	el_packs: '单词资料',
	el_notes: '学习笔记',
};

/** 顶层 items，或日推 origin=all 的 system/manual.items */
function collectItems(record: Record<string, unknown>): unknown[] | null {
	if (Array.isArray(record.items)) return record.items;
	const nested: unknown[] = [];
	for (const key of ['system', 'manual']) {
		const child = record[key];
		if (!child || typeof child !== 'object' || Array.isArray(child)) continue;
		const items = (child as { items?: unknown }).items;
		if (Array.isArray(items)) nested.push(...items);
	}
	return nested.length ? nested : null;
}

function artifactTitle(tool: string, items: unknown[]): string {
	const first = items[0];
	if (first && typeof first === 'object') {
		const title = textOf((first as { libraryTitle?: unknown }).libraryTitle);
		if (title) return title;
	}
	return TOOL_TITLE[tool] ?? '清单';
}

const INDEX_TOOL_OP: Record<string, string | readonly string[]> = {
	el_daily_reading: 'list',
	el_items_search: 'list',
	el_favorites: 'list',
	el_mistakes: 'list',
	el_review: 'peek_queue',
	el_daily_memo: 'records',
	el_packs: ['history', 'items', 'generate'],
	el_notes: 'list',
};

/** 检索命中也不自动出卡，要看由模型再 present。 */
export function isSearchOp(tool: string, op: string): boolean {
	return (
		(tool === 'el_items_search' || tool === 'el_favorites') && op === 'search'
	);
}

/** 这些 op 过阈后给瘦索引，不自动出整表卡。search 不在内。 */
export function isIndexOp(tool: string, op: string): boolean {
	const spec = INDEX_TOOL_OP[tool];
	return Array.isArray(spec) ? spec.includes(op) : spec === op;
}

/** 卡片/清单行抽出唯一笔记 id。多篇返回空，避免 get 打开错篇。 */
export function noteIdFromCardItems(items: unknown[] | undefined): string {
	if (!items?.length) return '';
	const ids: string[] = [];
	for (const item of items) {
		if (!item || typeof item !== 'object') continue;
		const raw = (item as { id?: unknown }).id;
		const id = typeof raw === 'string' ? raw.trim() : '';
		if (id && !ids.includes(id)) ids.push(id);
	}
	return ids.length === 1 ? ids[0] : '';
}

export function slimRow(item: unknown): Record<string, string> {
	if (!item || typeof item !== 'object')
		return { word: String(item ?? '').slice(0, 120) };
	const o = item as Record<string, unknown>;
	const topic = textOf(o.topic).slice(0, 80);
	if (topic) {
		const row: Record<string, string> = { topic };
		if (textOf(o.id)) row.id = textOf(o.id);
		if (o.targetCount != null && String(o.targetCount) !== '') {
			row.targetCount = String(o.targetCount);
		}
		const n = o.wordCount ?? o.quoteCount;
		if (n != null && String(n) !== '') row.count = String(n);
		return row;
	}
	const titleEn = textOf(o.titleEn).slice(0, 80);
	const titleZh = textOf(o.titleZh).slice(0, 40);
	if (titleEn || titleZh) {
		const lead = (textOf(o.lead) || textOf(o.bodyZh) || textOf(o.bodyEn)).slice(
			0,
			24,
		);
		return {
			...(textOf(o.id) ? { id: textOf(o.id) } : {}),
			...(titleEn ? { titleEn } : {}),
			...(titleZh ? { titleZh } : {}),
			...(textOf(o.publishDate) ? { publishDate: textOf(o.publishDate) } : {}),
			...(textOf(o.origin) ? { origin: textOf(o.origin) } : {}),
			...(textOf(o.mine) ? { mine: textOf(o.mine) } : {}),
			...(textOf(o.updatedAt)
				? { updatedAt: textOf(o.updatedAt).slice(0, 40) }
				: {}),
			...(lead ? { lead } : {}),
		};
	}
	const zh = textOf(o.translationZh).slice(0, 80);
	const word = textOf(o.word);
	const english = textOf(o.english).slice(0, 120);
	const row: Record<string, string> = {};
	if (textOf(o.id)) row.id = textOf(o.id);
	if (word) row.word = word;
	else if (english) row.english = english;
	if (zh) row.translationZh = zh;
	if (typeof o.lastCorrect === 'boolean')
		row.lastCorrect = o.lastCorrect ? 'true' : 'false';
	return Object.keys(row).length ? row : { word: String(item).slice(0, 120) };
}

/** 放不下整表索引时的一页。nextOffset 用同一 artifact 接着翻。 */
export function slimPage(
	items: unknown[],
	offset = 0,
): { rows: Record<string, string>[]; nextOffset?: number } {
	const all = items.map(slimRow);
	const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
	const rows = all.slice(start, start + EL_SLIM_PAGE);
	const next = start + rows.length;
	return next < all.length ? { rows, nextOffset: next } : { rows };
}

/** 中等词库把词面+释义留在回执里，供模型做语义筛选 */
export function slimFits(items: unknown[]): boolean {
	if (items.length > EL_SLIM_MAX_ITEMS) return false;
	return JSON.stringify(items.map(slimRow)).length <= EL_SLIM_MAX_CHARS;
}

/** id、词面、标题都能点中原行。同一键只保留先出现的行。 */
export function keysOf(item: unknown): string[] {
	if (!item || typeof item !== 'object') return [];
	const o = item as Record<string, unknown>;
	const keys: string[] = [];
	const add = (raw: string) => {
		const key = raw.trim().toLowerCase().slice(0, 120);
		if (key && !keys.includes(key)) keys.push(key);
	};
	add(textOf(o.id));
	add(textOf(o.word));
	add(textOf(o.english).slice(0, 120));
	add(textOf(o.titleEn).slice(0, 80));
	add(textOf(o.titleZh).slice(0, 40));
	add(textOf(o.topic).slice(0, 80));
	return keys;
}

function queryKey(raw: string): string {
	return raw.trim().toLowerCase().slice(0, 120);
}

/** 点名的词面换成 artifact 原行；重复只留第一次，对不上的进 dropped */
export function presentRows(
	items: unknown[],
	mode: 'all' | 'subset',
	words: string[],
): { matched: unknown[]; dropped: string[] } {
	if (mode === 'all') return { matched: items, dropped: [] };
	const byFace = new Map<string, unknown>();
	for (const item of items) {
		for (const key of keysOf(item)) {
			if (!byFace.has(key)) byFace.set(key, item);
		}
	}
	const matched: unknown[] = [];
	const dropped: string[] = [];
	const seen = new Set<string>();
	for (const word of words) {
		const key = queryKey(word);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		const row = byFace.get(key);
		if (row) matched.push(row);
		else dropped.push(word.trim());
	}
	return { matched, dropped };
}

/**
 * 筛选题拒绝整库或几乎整库。
 * ponytail: 命中 ≥80% 源行也拒绝；「几乎全库都符合」的筛选会被挡，要放行就只保留 mode=all。
 */
export function presentTooWide(
	intent: ListIntent,
	mode: 'all' | 'subset',
	matched: number,
	source: number,
): boolean {
	if (intent !== 'filter' || source <= 0 || matched <= 0) return false;
	if (mode === 'all') return true;
	return matched >= Math.max(1, Math.floor(source * 0.8));
}

/**
 * 整库问法里还没挂出的每一份清单各补一张。同一 id 用最后一次。
 * 筛选和讲解不补。restash：裁过尾的行必须另存 artifact。
 */
export function inventoryFallback(
	userText: string,
	libraryLists: ElResourceListPayload[],
	shownIds: ReadonlySet<string>,
): { payload: ElResourceListPayload; restash: boolean }[] {
	if (listIntent(userText) !== 'inventory') return [];
	const byId = new Map<string, ElResourceListPayload>();
	for (const row of libraryLists) {
		const id = row.libraryId ?? row.artifactId;
		if (shownIds.has(id)) continue;
		byId.set(id, row);
	}
	return [...byId.values()].map((row) => {
		if (
			row.source === 'library' &&
			row.libraryId &&
			(row.contentKind === 'vocab' || row.contentKind === 'classic')
		) {
			return { payload: { ...row, truncated: false }, restash: false };
		}
		const items = row.items ?? [];
		const fit = fitItemsByChars({ title: row.title }, items);
		if (!fit.truncated) return { payload: row, restash: false };
		return {
			restash: true,
			payload: {
				...row,
				items: fit.items,
				truncated: true,
				title: `${row.title}（已列出 ${fit.items.length} / ${row.totalCount}）`,
			},
		};
	});
}

/**
 * 大 list 外溢。返回 null 表示仍把原信封交给模型。
 * put 由调用方注入，避免本文件依赖 Nest。
 * slim：词库 list 不自动出卡，中等体积把瘦字段留在回执里。
 */
const PARTIAL_TITLE = /前\s*\d+|尚未|没有展示|未展示|没展示/;

/** 模型标题若把上下文页说成用户看到的条数，改回资源原名。 */
export function shownTitle(
	raw: string,
	full: boolean,
	fallback: string,
): string {
	const title = raw.trim();
	if (!title || (full && PARTIAL_TITLE.test(title))) return fallback;
	return title;
}

export async function spillListResult(
	tool: string,
	env: ElEnvelope,
	put: (row: Omit<ElResourceListPayload, 'artifactId'>) => Promise<string>,
	opts?: { slim?: boolean; always?: boolean; inventory?: boolean },
): Promise<{ model: ElEnvelope; full: ElResourceListPayload } | null> {
	const data = env.data;
	if (!env.ok || !data || typeof data !== 'object' || Array.isArray(data)) {
		return null;
	}
	const record = data as Record<string, unknown>;
	const items = collectItems(record);
	const spill = !!items && shouldSpill(items);
	if (!items || (!spill && !opts?.always)) return null;
	const contentKind =
		record.kind === 'classic' || record.kind === 'vocab'
			? record.kind
			: undefined;
	const libraryId =
		typeof record.libraryId === 'string' ? record.libraryId : undefined;
	const totalCount =
		typeof record.totalCount === 'number' ? record.totalCount : items.length;
	const truncated = env.meta?.truncated === true;
	const named = textOf(record.title);
	const draft: Omit<ElResourceListPayload, 'artifactId'> = {
		title: named || artifactTitle(tool, items),
		source: sourceOf(tool),
		...(contentKind ? { contentKind } : {}),
		...(libraryId ? { libraryId } : {}),
		totalCount,
		truncated,
		items,
	};
	const artifactId = await put(draft);
	const full: ElResourceListPayload = { ...draft, artifactId };
	if (opts?.inventory) {
		const preview = toPreview(items);
		return {
			full,
			model: elOk(
				{
					artifactId,
					title: full.title,
					kind: contentKind,
					libraryId,
					totalCount,
					returned: preview.length,
					truncated,
					preview,
				},
				{
					message: truncated
						? `查询没有拿满总数，卡片列出 ${items.length} / 共 ${totalCount} 条。禁止说只给了前若干条。`
						: `卡片已列出全部 ${totalCount} 条。不要写见上方或见下方。禁止把预览条数说成用户能看到的条数，禁止再调用 el_present，禁止逐条复述。`,
					meta: { total: totalCount, truncated, limit: items.length },
					ui: env.ui,
				},
			),
		};
	}
	if (!spill) {
		return {
			full,
			model: elOk(
				{ ...record, artifactId },
				{
					message: '未出卡片，要看再 el_present。',
					meta: env.meta,
					ui: env.ui,
				},
			),
		};
	}
	const keepSlim = opts?.slim === true && slimFits(items);
	const page = slimPage(items, 0);
	const slimNote =
		'未出卡片，要看再 el_present。阅读传 id，词条传词面。成组列出只写组标题，禁止顿号或逗号词表。';
	const pageNote = `上下文只有前 ${page.rows.length} 条供筛选，不是用户看到的条数。全量 ${totalCount} 在该 artifact。要给人看用 el_present mode=subset。禁止把这 ${page.rows.length} 条说成尚未展示。`;
	const model = elOk(
		{
			artifactId,
			title: full.title,
			kind: contentKind,
			libraryId,
			totalCount,
			returned: opts?.slim
				? keepSlim
					? items.length
					: page.rows.length
				: items.length,
			truncated: truncated || (opts?.slim === true && !keepSlim),
			...(opts?.slim
				? {
						items: keepSlim ? items.map(slimRow) : page.rows,
						...(keepSlim || page.nextOffset === undefined
							? {}
							: { nextOffset: page.nextOffset }),
					}
				: { preview: toPreview(items) }),
		},
		{
			message: opts?.slim
				? truncated
					? `查询没有拿满总数。${keepSlim ? slimNote : pageNote}`
					: keepSlim
						? slimNote
						: `索引一次放不下。用同一 artifactId 与 offset=nextOffset 翻页。${pageNote}`
				: truncated
					? `查询没有拿满总数。${EL_LIST_BAN}`
					: EL_LIST_BAN,
			meta: {
				total: totalCount,
				truncated: truncated || (opts?.slim === true && !keepSlim),
				limit: items.length,
			},
		},
	);
	return { model, full };
}

/**
 * 本轮已把整表放进卡片时，只剥「几乎整卡复述」的长列表。
 * 成组顿号/逗号词表（至少 8 个英文词）一并去掉，卡片已经在锚点上。
 */
export function elCardAnchor(artifactId: string): string {
	return `\n\n[[el:${artifactId}]]\n\n`;
}

function isCommaWordLine(line: string): boolean {
	const words = line
		.split(/[、,，]/)
		.map((part) => part.trim())
		.filter((part) => /^[A-Za-z][A-Za-z'’-]*$/.test(part));
	return words.length >= 8;
}

export function stripDumpedList(
	content: string,
	spilled: boolean,
	cardItems = 0,
): string {
	if (!spilled) return content;
	const lines = content.split('\n').filter((line) => !isCommaWordLine(line));
	const tables = lines.filter((l) => l.trim().startsWith('|')).length;
	const bullets = lines.filter((l) => /^\s*(\d+\.|[-*])\s+\S/.test(l)).length;
	const listLines = tables + bullets;
	const dumpAt = cardItems > 0 ? Math.max(80, Math.floor(cardItems * 0.8)) : 80;
	if (listLines < dumpAt) return lines.join('\n');
	const kept = lines.filter((l) => {
		const t = l.trim();
		if (t.startsWith('|')) return false;
		if (/^\d+\.\s/.test(t) || /^[-*]\s/.test(t)) return false;
		return true;
	});
	const text = kept
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return text || '完整清单在卡片中。';
}

/** 卡片不靠上下方位说明。整库卡去掉裁剪条数；无锚点时去掉「见上方 / 见下方」。 */
export function placeCardHint(
	content: string,
	cardAtEnd: boolean,
	fullLibrary = false,
): string {
	let text = content;
	if (fullLibrary) {
		text = text
			.replace(/，?\s*本次列出\s*\d+\s*条（[^）]*）/g, '')
			.replace(/（已列出\s*\d+\s*\/\s*\d+）/g, '')
			.replace(/（未穷尽，已达硬顶）/g, '');
	}
	text = text
		.replace(/浏览或导出/g, '浏览')
		.replace(/[，,]?\s*或导出/g, '')
		.replace(/可导出/g, '');
	if (!cardAtEnd || text.includes('[[el:')) return text;
	return text.replace(/见[上下]方[，,]?\s*/g, '');
}
