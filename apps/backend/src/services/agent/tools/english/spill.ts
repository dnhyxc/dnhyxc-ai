import type { ConfigService } from '@nestjs/config';
import { decide } from '../../../../utils/glm-decide';
import type { ElResourceListPayload, ElResourceSource } from './artifact.store';
import type { EnglishIntent } from './english-intent';
import { type ElEnvelope, elOk, fitItemsByChars } from './envelope';
import type { FavoriteIntent } from './favorite-ask';

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
/**
 * 整表/盘点问法。须盖住「错题集有哪些资源」这类：旧式「有哪些错」对不上「有哪些资源」。
 */
const INVENTORY_RE =
	/全部|所有单词|所有词|整个库|导出|列出全部|哪些错题|有哪些错|错题集|错题库|我的错题|列出错题|错题.{0,12}(有哪些|哪些|资源)|有哪些.{0,12}错题|重新练习/;
/** 「所有英语四级单词库中的单词」：库名隔在「所有」和「单词」之间 */
const ALL_WORDS_RE = /所有.{0,16}(单词|词条|的词)/;

/** 只看用户原话。筛选词优先于「列出 / 全部」。 */
export function listIntent(userText: string): ListIntent {
	if (FILTER_RE.test(userText)) return 'filter';
	if (INVENTORY_RE.test(userText) || ALL_WORDS_RE.test(userText))
		return 'inventory';
	return 'other';
}

export type PriorLibraryCard = {
	title: string;
	contentKind?: 'vocab' | 'classic';
};

export type ElListSurface = {
	userText: string;
	/** 整库筛选用的类别句。纯收藏口令不放这里。 */
	quoteCategoryText?: string;
	/** 当前句之前的用户原话，近的在后。 */
	priorUserTexts: string[];
	/** 上一张助手消息里的库卡标题。只用于沿用，不参与整库挂卡。 */
	priorLibraryCards: PriorLibraryCard[];
	/** 带类别名的历史分类卡。只按库和类别查找，不参与整卡收藏。 */
	labeledCards: ElResourceListPayload[];
	/** 索引类 list 外溢的全量，默认不推卡片 */
	libraryLists: ElResourceListPayload[];
	/** 同时点名单词和语句时，回扫窗口里的单词卡。其他收藏句保持空。 */
	vocabLists: ElResourceListPayload[];
	presented: boolean;
	/** 本轮已经挂出的库或 artifact，同一 id 不再挂第二张 */
	shownLibraryIds: Set<string>;
	/** 库名清单，用来和原话做包含匹配 */
	catalog: { id: string; title: string }[];
	catalogKind?: 'vocab' | 'classic';
	/** 本轮已挂出的确认条。收尾补收藏时用来避免再挂一条。 */
	openProposalId?: string | null;
	/** 本轮主意图（总路由）。收尾 / 筛选续查 / 挂条优先读 kind。 */
	intent?: EnglishIntent;
	/** 本轮收藏意图。propose_* 延期与轮末挂条都读它；由 intent 同步。 */
	favoriteIntent?: FavoriteIntent;
	/**
	 * 本轮每个库正在进行或已经结束的分类。
	 * 键是 kind:libraryId 或 kind:libraryId:类别。先写入再等待，同键后来者共用这一次，失败也不删除。
	 */
	categoryJobs: Map<
		string,
		Promise<Omit<ElResourceListPayload, 'artifactId'> | null>
	>;
};

/** 用户要丢掉已记下的命中，再判一次。 */
export function reclassifyAsked(userText: string): boolean {
	return /重新分类/.test(userText);
}

/**
 * 从「关于 / 有关 / 相关」后切出类别名。
 * 「家庭的和问候的」是两类；「有关家庭的所有语句」只留家庭。
 */
export function categoryLabels(userText: string): string[] {
	const labels: string[] = [];
	const seen = new Set<string>();
	const push = (raw: string) => {
		const label = raw.replace(/的/gu, '').trim();
		if (label.length < 1 || label.length > 8 || seen.has(label)) return;
		seen.add(label);
		labels.push(label);
	};
	for (const mark of userText.matchAll(/(?:关于|有关|相关)/gu)) {
		let rest = userText.slice((mark.index ?? 0) + mark[0].length);
		const names: string[] = [];
		const first = rest.match(/^([^和与、及的，。；\s]{1,8})/u);
		if (!first) continue;
		names.push(first[1]);
		rest = rest.slice(first[0].length);
		while (true) {
			const conj = rest.match(/^(?:和|与|、|以及)/u);
			if (!conj) break;
			const after = rest.slice(conj[0].length);
			const next = after.match(/^([^和与、及的，。；\s]{1,8})/u);
			if (!next) break;
			names.push(next[1]);
			rest = after.slice(next[0].length);
		}
		if (!rest.startsWith('的')) continue;
		rest = rest.slice(1);
		for (const name of names) push(name);
		while (true) {
			const conj = rest.match(/^(?:和|与|、|以及)/u);
			if (!conj) break;
			const after = rest.slice(conj[0].length);
			const next = after.match(/^([^和与、及的，。；\s]{1,8})的/u);
			if (!next) break;
			push(next[1]);
			rest = after.slice(next[0].length);
		}
	}
	return labels;
}

/** 关于类且不是整库问法。整库句仍走 inventory，避免「列出全部」被拿去分类。 */
export function isCategoryAsk(userText: string): boolean {
	if (listIntent(userText) === 'inventory') return false;
	return /关于|相关|有关|属于/.test(userText);
}

/**
 * 自选阅读生成。主题里的「关于」不是在筛语句库。
 * 句中点了语句库或词汇库时仍留给分类，避免「生成语句库里关于家庭的句子」被挡掉。
 */
export function isReadingGenerateAsk(userText: string): boolean {
	const text = userText.trim();
	if (!text) return false;
	if (/语句库|语料库|词汇库|单词库|词库/.test(text)) return false;
	const passage = /阅读资料|阅读材料|自选阅读|每日阅读|英语阅读|短文|文章|长文/;
	const make = /生成|写一|来一|做一/;
	const sized = /长篇|短篇|中篇|长文|短文/;
	if (passage.test(text) && (make.test(text) || sized.test(text))) return true;
	return sized.test(text) && make.test(text) && /阅读/.test(text);
}

/**
 * 词书/语句生成。主题里的「关于」不是在筛已有库。
 * 点名 *库* 时仍走分类（与 isReadingGenerateAsk 同一边界）。
 */
export function isPackGenerateAsk(userText: string): boolean {
	const text = userText.trim();
	if (!text) return false;
	if (/语句库|语料库|词汇库|单词库|词库/.test(text)) return false;
	if (!/生成|写一|来一|做一|出一|来份|来一份/.test(text)) return false;
	return /语句|句子|经典句|单词资料|词书|单词|词汇/.test(text);
}

/** 原句快路径。三组词都在才扫全部词汇库，换说法交给 decide。 */
export function isAllVocabCategory(userText: string): boolean {
	if (!isCategoryAsk(userText)) return false;
	if (!/词汇库|单词库/.test(userText)) return false;
	return /所有|全部|各个/.test(userText);
}

/** 原句快路径。三组词都在才扫全部语句库，换说法交给 decide。 */
export function isAllClassicCategory(userText: string): boolean {
	if (!isCategoryAsk(userText)) return false;
	if (!/语句库|语料库/.test(userText)) return false;
	return /所有|全部|各个/.test(userText);
}

const ALL_VOCAB_TASK =
	'只返回 JSON {"scope":"all_vocab|one_vocab|classic|none","cue":""}，不要解释。' +
	'只有用户要把某一类单词从词汇库全体里找出来、分类或列出来时，scope 才是 all_vocab。' +
	'点名一本库是 one_vocab，只要语句是 classic，其它是 none。' +
	'cue 必须是原话中连续出现的一段，不要编。';

/** 线索必须是原话里的连续子串。编出来的范围不能打开全库扫描。 */
export function acceptAllVocabCue(
	userText: string,
	raw: unknown,
): { scope: 'all_vocab' } | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const body = raw as { scope?: unknown; cue?: unknown };
	if (body.scope !== 'all_vocab') return null;
	if (typeof body.cue !== 'string') return null;
	const cue = body.cue.trim();
	if (cue.length < 2 || !userText.includes(cue)) return null;
	if (!/所有|全部|各个/.test(userText)) return null;
	if (!/词汇库|单词库/.test(userText)) return null;
	return { scope: 'all_vocab' };
}

/** 词表能确定就直接进。不能确定时问一次 decide，失败不扫全部库。 */
export async function resolveAllVocabAsk(
	config: ConfigService,
	userText: string,
): Promise<boolean> {
	if (isAllVocabCategory(userText)) return true;
	const slot = await decide(config, {
		task: ALL_VOCAB_TASK,
		input: userText,
		parse: (raw) =>
			raw && typeof raw === 'object' && !Array.isArray(raw)
				? (raw as { scope: 'all_vocab' })
				: null,
		accept: (_value, input) => acceptAllVocabCue(input, _value),
	});
	return slot?.scope === 'all_vocab';
}

const ALL_CLASSIC_TASK =
	'只返回 JSON {"scope":"all_classic|one|none","cue":""}，不要解释。' +
	'只有用户要把某一类句子从语句库全体里找出来、分类或列出来时，scope 才是 all_classic。' +
	'点名一本语句库是 one，其它是 none。' +
	'cue 必须是原话中连续出现的一段，不要编。';

/** 线索必须是原话里的连续子串。编出来的范围不能打开全部语句库。 */
export function acceptAllClassicCue(
	userText: string,
	raw: unknown,
): { scope: 'all_classic' } | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const body = raw as { scope?: unknown; cue?: unknown };
	if (body.scope !== 'all_classic') return null;
	if (typeof body.cue !== 'string') return null;
	const cue = body.cue.trim();
	if (cue.length < 2 || !userText.includes(cue)) return null;
	if (!/所有|全部|各个/.test(userText)) return null;
	if (!/语句库|语料库/.test(userText)) return null;
	return { scope: 'all_classic' };
}

/** 词表能确定就直接进。不能确定时问一次 decide，失败不扫全部语句库。 */
export async function resolveAllClassicAsk(
	config: ConfigService,
	userText: string,
): Promise<boolean> {
	if (isAllClassicCategory(userText)) return true;
	const slot = await decide(config, {
		task: ALL_CLASSIC_TASK,
		input: userText,
		parse: (raw) =>
			raw && typeof raw === 'object' && !Array.isArray(raw)
				? (raw as { scope: 'all_classic' })
				: null,
		accept: (_value, input) => acceptAllClassicCue(input, _value),
	});
	return slot?.scope === 'all_classic';
}

type LibrarySlot = {
	scope: 'all_vocab' | 'one_vocab' | 'classic' | 'none';
	libraryCue: string;
};

export type NamedLibrary =
	| { kind: 'one'; lib: { id: string; title: string } }
	| { kind: 'ambiguous'; candidates: { id: string; title: string }[] }
	| { kind: 'none' };

const LIBRARY_CUE_TASK =
	'只返回 JSON {"scope":"all_vocab|one_vocab|classic|none","libraryCue":""}。' +
	'点名一本库时 scope 为 one_vocab，libraryCue 必须是原话里连续的库名，不要编。' +
	'没有点库名时 libraryCue 为空字符串。';

/** 去掉结尾泛称。「小学三年级词汇库」才能对上标题「小学三年级」。 */
function normalizeCue(cue: string): string {
	return cue
		.replace(/(词汇库|单词库|语句库|语料库|经典语句|词库)$/u, '')
		.trim();
}

/** 「所有 / 全部 / 各个」和单独的「词汇库」不是库名，空线索才允许扫全部库。 */
function usableCue(cue: string): string {
	const trimmed = cue.trim();
	const key = normalizeCue(trimmed);
	if (key.length < 2) return '';
	if (/^(所有|全部|各个)$/.test(key)) return '';
	return trimmed;
}

/** 整段标题恰好一本时直接用标题，不再抽槽。 */
export function cueFromExactTitle(
	text: string,
	libs: { id: string; title: string }[],
): string {
	const hits = matchLibraries(text, libs);
	if (hits.length !== 1) return '';
	return hits[0].title;
}

/**
 * 整段标题优先。否则一次 decide，线索必须是原话连续子串。
 * 泛称线索当成没抽到，避免「词汇库」挡住未点名的全库扫描。
 */
export async function resolveLibraryCue(
	config: ConfigService,
	text: string,
	libs: { id: string; title: string }[],
): Promise<string> {
	const exact = cueFromExactTitle(text, libs);
	if (exact) return exact;
	const slot = await decide(config, {
		task: LIBRARY_CUE_TASK,
		input: text,
		parse: (raw) => {
			if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
			const body = raw as { scope?: unknown; libraryCue?: unknown };
			const scope = body.scope;
			if (
				scope !== 'all_vocab' &&
				scope !== 'one_vocab' &&
				scope !== 'classic' &&
				scope !== 'none'
			) {
				return null;
			}
			const libraryCue =
				typeof body.libraryCue === 'string' ? body.libraryCue : '';
			return { scope, libraryCue } satisfies LibrarySlot;
		},
		accept: (value, input) => {
			const libraryCue = usableCue(value.libraryCue);
			if (!libraryCue || !input.includes(libraryCue)) return null;
			return { ...value, libraryCue };
		},
	});
	return slot?.libraryCue ?? '';
}

const GENERIC_STEM = /^(词汇|单词|英语|词库|相关|分类)$/;

/** 原话里「X词汇库」的 X，和各标题共有的最长一段。泛称如「词汇」不算。 */
function stemInCatalog(span: string, libs: { title: string }[]): string {
	let best = '';
	for (const lib of libs) {
		const title = lib.title.trim();
		let shared = '';
		for (let i = 0; i < span.length; i++) {
			for (let j = i + 2; j <= span.length; j++) {
				const slice = span.slice(i, j);
				if (slice.length <= shared.length || !title.includes(slice)) continue;
				shared = slice;
			}
		}
		if (shared.length > best.length && !GENERIC_STEM.test(shared))
			best = shared;
	}
	return best;
}

const VOCAB_LIBRARY_MARK = /词汇库|单词库|词库/;

/**
 * 「我有哪些语句库」里的「我有哪些」不是库名；若当 miss 会把后面的「三年级语句库」误判成 ambiguous。
 */
function isCatalogAskSpan(span: string): boolean {
	const s = span.trim();
	if (s.length < 2) return true;
	if (/^(我)?(有)?(哪些|什么|所有|全部|各个)$/u.test(s)) return true;
	if (/^(我有)?(哪些|什么)/u.test(s) && !/[年级册级四五六]/.test(s))
		return true;
	return false;
}

/**
 * 原话点了「X + 库后缀」时先在目录里对，不再交给「所有」去扫全部库。
 * 不传后缀时仍认词汇库。语句工具传入语句后缀。「所有词汇库」没有具体库名，返回 absent。
 */
export function resolveMentionedLibrary(
	text: string,
	libs: { id: string; title: string }[],
	markSource: RegExp = VOCAB_LIBRARY_MARK,
): NamedLibrary | { kind: 'absent' } {
	const spans: string[] = [];
	const mark = new RegExp(markSource.source, 'gu');
	const tail = new RegExp(`(?:${markSource.source})$`, 'u');
	for (const match of text.matchAll(mark)) {
		const end = match.index ?? 0;
		let start = end;
		while (start > 0 && end - start < 32) {
			const ch = text[start - 1] ?? '';
			if (!/[A-Za-z0-9\u4e00-\u9fff]/u.test(ch)) break;
			if (tail.test(text.slice(0, start))) break;
			start -= 1;
		}
		const span = text.slice(start, end);
		if (span.length < 2 || !usableCue(`${span}词库`)) continue;
		if (isCatalogAskSpan(span)) continue;
		spans.push(span);
	}
	if (!spans.length) return { kind: 'absent' };
	const picked: { id: string; title: string }[] = [];
	for (const span of spans) {
		const stem = stemInCatalog(span, libs);
		if (!stem) continue;
		const named = resolveNamedLibrary(stem, libs);
		if (named.kind === 'one') picked.push(named.lib);
		else if (named.kind === 'ambiguous') return named;
	}
	const uniq: { id: string; title: string }[] = [];
	for (const lib of picked) {
		if (!uniq.some((row) => row.id === lib.id)) uniq.push(lib);
	}
	if (uniq.length === 1) return { kind: 'one', lib: uniq[0] };
	if (uniq.length > 0)
		return { kind: 'ambiguous', candidates: uniq.slice(0, 10) };
	return { kind: 'none' };
}

/** 用户还要看「有哪些库」清单（可与关于类筛选同句，不走 inventory 独占）。 */
export function wantsLibraryCatalog(userText: string): boolean {
	return /有哪些.{0,8}(语句库|语料库|词汇库|单词库|词库)|我有哪些.{0,8}库|所有语句库|所有词汇库|所有单词库|列出.{0,6}(语句库|语料库|词汇库|单词库)|需要的是所有(语句库|词汇库)/u.test(
		userText,
	);
}

/** 双向包含后只接受严格更长的一本。等长或落空都不猜。 */
export function resolveNamedLibrary(
	cue: string,
	libs: { id: string; title: string }[],
): NamedLibrary {
	const key = normalizeCue(cue);
	if (key.length < 2) return { kind: 'none' };
	const hits = libs.filter((lib) => {
		const title = lib.title.trim();
		return title.length > 0 && (title.includes(key) || key.includes(title));
	});
	if (hits.length === 0) return { kind: 'none' };
	const ranked = [...hits].sort((a, b) => b.title.length - a.title.length);
	const top = ranked[0];
	const second = ranked[1];
	if (!second || top.title.length > second.title.length) {
		return { kind: 'one', lib: top };
	}
	return { kind: 'ambiguous', candidates: ranked.slice(0, 10) };
}

/** 库名整段出现在原话里才算命中。「英语系级」对不上「英语四级单词」。 */
export function matchLibraries(
	userText: string,
	libs: { id: string; title: string }[],
): { id: string; title: string }[] {
	return libs.filter(
		(lib) => lib.title.length > 0 && userText.includes(lib.title),
	);
}

/** 上一句点中的那一本。多本命中则停，不往更早的句子猜。 */
export function inheritedLibrary(
	priorUserTexts: string[],
	priorCards: { title: string }[],
	catalog: { id: string; title: string }[],
	mark?: RegExp,
): { id: string; title: string } | null {
	for (let i = priorUserTexts.length - 1; i >= 0; i -= 1) {
		const text = priorUserTexts[i] ?? '';
		if (!text.trim()) continue;
		const exact = matchLibraries(text, catalog);
		if (exact.length > 1) return null;
		if (exact.length === 1) return exact[0];
		const mentioned = resolveMentionedLibrary(text, catalog, mark);
		if (mentioned.kind === 'ambiguous') return null;
		if (mentioned.kind === 'one') return mentioned.lib;
	}
	const titles = [
		...new Set(
			priorCards
				.map((card) => card.title.trim())
				.filter((title) => title.length > 0),
		),
	];
	if (titles.length !== 1) return null;
	const title = titles[0];
	const hits = catalog.filter((lib) => {
		const name = lib.title.trim();
		return name.length > 0 && (title === name || title.startsWith(`${name}（`));
	});
	if (!hits.length) return null;
	const ranked = [...hits].sort((a, b) => b.title.length - a.title.length);
	const top = ranked[0];
	const second = ranked[1];
	if (!second || top.title.length > second.title.length) return top;
	return null;
}

/** 沿用时先看上一句点的是语句还是词汇。两种都有则不猜。 */
export function inheritedKind(
	priorUserTexts: string[],
	cards: { contentKind?: 'vocab' | 'classic' }[],
): 'vocab' | 'classic' | null {
	for (let i = priorUserTexts.length - 1; i >= 0; i -= 1) {
		const text = priorUserTexts[i] ?? '';
		const classic = /语句库|语料库|经典语句/.test(text);
		const vocab = /词汇库|单词库|词库/.test(text);
		if (classic && vocab) return null;
		if (classic) return 'classic';
		if (vocab) return 'vocab';
	}
	const kinds = [
		...new Set(
			cards
				.map((card) => card.contentKind)
				.filter(
					(kind): kind is 'vocab' | 'classic' =>
						kind === 'vocab' || kind === 'classic',
				),
		),
	];
	return kinds.length === 1 ? kinds[0] : null;
}

/** 筛选句在模型停手后是否还要由服务端拉词。已出卡、非整句「关于」返回 null。当前句不是恰好一本时，沿用上一本。 */
export function shouldFilterContinue(
	userText: string,
	catalog: { id: string; title: string }[],
	presented: boolean,
	prior?: {
		userTexts: string[];
		cards: { title: string }[];
		mark?: RegExp;
	},
): { id: string; title: string } | null {
	if (presented) return null;
	if (isReadingGenerateAsk(userText) || isPackGenerateAsk(userText))
		return null;
	if (!isCategoryAsk(userText)) return null;
	const hits = matchLibraries(userText, catalog);
	if (hits.length === 1) return hits[0];
	if (hits.length > 1 || !prior) return null;
	return inheritedLibrary(prior.userTexts, prior.cards, catalog, prior.mark);
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

function artifactTitle(tool: string, items: unknown[], kind?: string): string {
	const first = items[0];
	if (first && typeof first === 'object') {
		const title = textOf((first as { libraryTitle?: unknown }).libraryTitle);
		if (title) return title;
	}
	if (tool === 'el_mistakes') {
		if (kind === 'classic') return '语句错题';
		if (kind === 'vocab') return '单词错题';
	}
	if (tool === 'el_favorites') {
		if (kind === 'classic') return '语句收藏';
		if (kind === 'vocab') return '单词收藏';
	}
	if (tool === 'el_libraries') {
		if (kind === 'classic') return '语句库';
		if (kind === 'vocab') return '词汇库';
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
		if (row.fromPrior) continue;
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
	const kindHint =
		contentKind ?? (typeof record.kind === 'string' ? record.kind : undefined);
	const draft: Omit<ElResourceListPayload, 'artifactId'> = {
		title: named || artifactTitle(tool, items, kindHint),
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
