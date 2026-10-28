/** 发布日是上海日历日，禁止用数据库 CURRENT_DATE（库时区常常是 UTC）。 */
const SHANGHAI = 'Asia/Shanghai';

export const DEFAULT_THEMES = [
	'日常',
	'自然',
	'城市',
	'科学随笔',
	'旅行见闻',
	'校园',
	'工作',
	'美食',
	'运动',
	'家庭',
	'读书',
] as const;

const THEME_MAX = 16;
const THEME_LIMIT = 24;

const ZW = /\u200b|\u200c|\u200d|\ufeff/g;

export type PassageDraft = {
	titleEn: string;
	titleZh: string;
	bodyEn: string;
	bodyZh: string;
};

export function shanghaiToday(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: SHANGHAI,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now);
}

/** 与 cron 的 Asia/Shanghai 同一套钟。 */
export function hourInShanghai(now = new Date()): number {
	const hour = new Intl.DateTimeFormat('en-GB', {
		timeZone: SHANGHAI,
		hour: 'numeric',
		hourCycle: 'h23',
	})
		.formatToParts(now)
		.find((part) => part.type === 'hour')?.value;
	const n = Number(hour);
	return Number.isInteger(n) ? n : 0;
}

/** 已过今天的整点则补明天，否则只可能补上一档产出的今天。 */
export function duePublishDate(hour: number, now = new Date()): string {
	const h = hour >= 0 && hour <= 23 ? hour : 23;
	const today = shanghaiToday(now);
	return hourInShanghai(now) >= h ? addCalendarDays(today, 1) : today;
}

/** 在 YYYY-MM-DD 上加减天数，不经过「现在」的时区。 */
export function addCalendarDays(ymd: string, days: number): string {
	const [y, m, d] = ymd.split('-').map((n) => Number(n));
	const utc = new Date(Date.UTC(y, m - 1, d + days));
	const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(utc.getUTCDate()).padStart(2, '0');
	return `${utc.getUTCFullYear()}-${mm}-${dd}`;
}

export type ReadingLevel = 'A2' | 'B1' | 'B2' | 'C1';
export type ReadingLength = 'short' | 'medium' | 'long';
export type ReadingFocus = 'reading' | 'vocab' | 'grammar' | 'both';

/** 设置可记住随机。提示词和 extras 只用抽完的具体档。 */
export type StoredProfile = {
	level: ReadingLevel | 'random';
	length: ReadingLength | 'random';
	focus: ReadingFocus | 'random';
	questions: 0 | 2 | 3 | 'random';
	useWeb: boolean;
};

/** 没改过设置时等于现在的生成：B1、中篇、不要附件、允许联网。 */
export type ReadingProfile = {
	level: ReadingLevel;
	length: ReadingLength;
	focus: ReadingFocus;
	questions: 0 | 2 | 3;
	useWeb: boolean;
};

/** 词汇上限。不够这个数时，合格的有多少留多少。 */
export function glossaryLimit(length: ReadingLength): number {
	if (length === 'short') return 10;
	if (length === 'long') return 20;
	return 15;
}

export const DEFAULT_PROFILE: ReadingProfile = {
	level: 'B1',
	length: 'medium',
	focus: 'reading',
	questions: 0,
	useWeb: true,
};

/** 一条语法：名称、正文里的英文片段、用法。纯中文句子不是讲解。 */
export type GrammarNote = {
	point: string;
	excerpt: string;
	explain: string;
};

export type ReadingExtras = {
	level: ReadingLevel;
	length: ReadingLength;
	focus: ReadingFocus;
	/** 这次设置要几道理解题。和 questions 数组分开，条数没凑满时仍显示设定。 */
	questionCount?: 0 | 2 | 3;
	glossary?: { word: string; zh: string }[];
	/** 按句列出正文里的词，zh 是该词在这一句里的意思。 */
	wordGloss?: { en: string; words: { w: string; zh: string }[] }[];
	grammarNotes?: GrammarNote[];
	questions?: { q: string; options: string[]; answer: number }[];
	/** 这次联网取材用到的条目，详情全部展示。 */
	sources?: { title: string; url: string }[];
};

const LEVELS: readonly ReadingLevel[] = ['A2', 'B1', 'B2', 'C1'];
const LENGTHS: readonly ReadingLength[] = ['short', 'medium', 'long'];
const FOCUSES: readonly ReadingFocus[] = [
	'reading',
	'vocab',
	'grammar',
	'both',
];
const QUESTION_COUNTS = [0, 2, 3] as const;

function pick<T>(items: readonly T[]): T {
	return items[Math.floor(Math.random() * items.length)] as T;
}

function kept<T extends string>(
	value: unknown,
	allowed: readonly T[],
	fallback: T,
): T {
	return allowed.find((item) => item === value) ?? fallback;
}

/** 脏枚举回默认。random 要留下来，否则保存后的随机会被收成 B1。 */
export function normalizeProfile(input: unknown): StoredProfile {
	const src =
		input && typeof input === 'object'
			? (input as Record<string, unknown>)
			: {};
	const level = kept(src.level, [...LEVELS, 'random'], DEFAULT_PROFILE.level);
	const length = kept(
		src.length,
		[...LENGTHS, 'random'],
		DEFAULT_PROFILE.length,
	);
	const focus = kept(src.focus, [...FOCUSES, 'random'], DEFAULT_PROFILE.focus);
	const questions =
		src.questions === 'random' ||
		src.questions === 0 ||
		src.questions === 2 ||
		src.questions === 3
			? src.questions
			: DEFAULT_PROFILE.questions;
	const useWeb =
		typeof src.useWeb === 'boolean' ? src.useWeb : DEFAULT_PROFILE.useWeb;
	return { level, length, focus, questions, useWeb };
}

/** 每个 random 字段均匀抽一次。具体字段保持原值，同一次生成复用返回值。 */
export function resolveProfile(stored: StoredProfile): ReadingProfile {
	return {
		level: stored.level === 'random' ? pick(LEVELS) : stored.level,
		length: stored.length === 'random' ? pick(LENGTHS) : stored.length,
		focus: stored.focus === 'random' ? pick(FOCUSES) : stored.focus,
		questions:
			stored.questions === 'random' ? pick(QUESTION_COUNTS) : stored.questions,
		useWeb: stored.useWeb,
	};
}

/** 原话点名的键才出现。缺省表示沿用已保存的自选档，不能填默认档。 */
export type ReadingOverride = {
	themes?: string[];
	level?: StoredProfile['level'];
	length?: StoredProfile['length'];
	focus?: StoredProfile['focus'];
	questions?: StoredProfile['questions'];
	useWeb?: boolean;
};

function nearNo(text: string, at: number): boolean {
	const pre = text.slice(Math.max(0, at - 2), at);
	return pre === '不要' || pre === '不是' || pre.endsWith('别');
}

function hits(
	text: string,
	re: RegExp,
	skip?: (at: number) => boolean,
): number[] {
	const out: number[] = [];
	for (const m of text.matchAll(re)) {
		const at = m.index ?? 0;
		if (nearNo(text, at) || skip?.(at)) continue;
		out.push(at);
	}
	return out;
}

function lastAt(list: number[]): number {
	return list.length ? Math.max(...list) : -1;
}

/** 「学习的长篇」只留主题。篇幅词本身不是主题。 */
function trimThemePiece(raw: string): string {
	let t = raw
		.trim()
		.replace(/[「」『』"“”'']/g, '')
		.trim();
	t = t.replace(/^(?:关于|有关)/, '').trim();
	t = t.replace(/(?:的)?(?:长篇|短篇|中篇|长文|短文)[\s\S]*$/, '').trim();
	t = t.replace(/的$/, '').trim();
	return t;
}

function themesFromClause(raw: string): string[] | null {
	const parts = raw
		.split(/[、,，]|和/)
		.map((part) => trimThemePiece(part))
		.filter(Boolean);
	return normalizeThemeList(parts);
}

/**
 * 自选生成的原话词表。只覆盖点名的字段。
 * savedThemes 用来认「原话里出现的已保存主题全文」。
 */
export function parseReadingOverride(
	userText: string,
	savedThemes: readonly string[] = [],
): ReadingOverride {
	const text = userText ?? '';
	const said: ReadingOverride = {};
	const levelHits: { at: number; value: StoredProfile['level'] }[] = [];
	for (const m of text.matchAll(/中高级|初级|中级|高级|难度随机/g)) {
		const at = m.index ?? 0;
		if (nearNo(text, at)) continue;
		if (m[0] === '高级' && text[at - 1] === '中') continue;
		const value =
			m[0] === '中高级'
				? 'B2'
				: m[0] === '初级'
					? 'A2'
					: m[0] === '中级'
						? 'B1'
						: m[0] === '高级'
							? 'C1'
							: 'random';
		levelHits.push({ at, value });
	}
	for (const m of text.matchAll(/A2|B1|B2|C1/gi)) {
		const at = m.index ?? 0;
		const word = m[0];
		const before = text[at - 1] ?? '';
		const after = text[at + word.length] ?? '';
		if (/[A-Za-z0-9]/.test(before) || /[A-Za-z0-9]/.test(after)) continue;
		if (nearNo(text, at)) continue;
		levelHits.push({
			at,
			value: word.toUpperCase() as StoredProfile['level'],
		});
	}
	if (levelHits.length) {
		said.level = levelHits.reduce((a, b) => (b.at >= a.at ? b : a)).value;
	}
	const lengthMap: [RegExp, StoredProfile['length']][] = [
		[/短篇/g, 'short'],
		[/中篇/g, 'medium'],
		[/长篇|长文/g, 'long'],
		[/\bshort\b/gi, 'short'],
		[/\bmedium\b/gi, 'medium'],
		[/\blong\b/gi, 'long'],
	];
	const lengthHits: { at: number; value: StoredProfile['length'] }[] = [];
	for (const [re, value] of lengthMap) {
		for (const at of hits(text, re)) lengthHits.push({ at, value });
	}
	if (lengthHits.length) {
		said.length = lengthHits.reduce((a, b) => (b.at >= a.at ? b : a)).value;
	}
	const vocabAt = [...hits(text, /附词汇/g), ...hits(text, /只要词汇/g)];
	const grammarAt = [...hits(text, /附语法/g), ...hits(text, /只要语法/g)];
	const readingAt = hits(text, /只读短文/g);
	const focusRandomAt = hits(text, /侧重随机/g);
	const pairAt = Math.max(lastAt(vocabAt), lastAt(grammarAt));
	const exclusiveAt = Math.max(lastAt(readingAt), lastAt(focusRandomAt));
	if (vocabAt.length && grammarAt.length && pairAt > exclusiveAt) {
		said.focus = 'both';
	} else if (exclusiveAt >= 0 && exclusiveAt >= pairAt) {
		said.focus =
			lastAt(focusRandomAt) > lastAt(readingAt) ? 'random' : 'reading';
	} else if (vocabAt.length || grammarAt.length) {
		said.focus = lastAt(vocabAt) >= lastAt(grammarAt) ? 'vocab' : 'grammar';
	}
	const questionHits: { at: number; value: StoredProfile['questions'] }[] = [];
	for (const at of hits(text, /不出题|不要题/g)) {
		questionHits.push({ at, value: 0 });
	}
	for (const at of hits(text, /题数随机/g)) {
		questionHits.push({ at, value: 'random' });
	}
	for (const at of hits(text, /两道|两题|2\s*题/g)) {
		questionHits.push({ at, value: 2 });
	}
	for (const at of hits(text, /三道|三题|3\s*题/g)) {
		questionHits.push({ at, value: 3 });
	}
	if (questionHits.length) {
		said.questions = questionHits.reduce((a, b) =>
			b.at >= a.at ? b : a,
		).value;
	}
	const webHits: { at: number; value: boolean }[] = [];
	for (const at of hits(text, /关闭智能搜索|不要联网|别搜/g)) {
		webHits.push({ at, value: false });
	}
	for (const at of hits(
		text,
		/开启智能搜索|要联网/g,
		(at) => text[at - 1] === '不',
	)) {
		webHits.push({ at, value: true });
	}
	if (webHits.length) {
		said.useWeb = webHits.reduce((a, b) => (b.at >= a.at ? b : a)).value;
	}
	let themeAt = -1;
	let themes: string[] | undefined;
	const use = (at: number, list: string[]) => {
		if (at >= themeAt) {
			themeAt = at;
			themes = list;
		}
	};
	for (const m of text.matchAll(/默认配置|恢复默认/g)) {
		const at = m.index ?? 0;
		if (nearNo(text, at)) continue;
		said.level =
			said.level && levelHits.some((h) => h.at > at)
				? said.level
				: DEFAULT_PROFILE.level;
		said.length =
			said.length && lengthHits.some((h) => h.at > at)
				? said.length
				: DEFAULT_PROFILE.length;
		said.focus =
			said.focus &&
			Math.max(pairAt, exclusiveAt, lastAt(vocabAt), lastAt(grammarAt)) > at
				? said.focus
				: DEFAULT_PROFILE.focus;
		said.questions =
			said.questions !== undefined && questionHits.some((h) => h.at > at)
				? said.questions
				: DEFAULT_PROFILE.questions;
		said.useWeb =
			said.useWeb !== undefined && webHits.some((h) => h.at > at)
				? said.useWeb
				: DEFAULT_PROFILE.useWeb;
		use(at, [...DEFAULT_THEMES]);
	}
	const explicitSpans: { start: number; end: number }[] = [];
	for (const m of text.matchAll(
		/主题\s*(?:是|用|为|改成|设为|关于|有关)\s*([^，。；\n]{1,24})/g,
	)) {
		const at = m.index ?? 0;
		explicitSpans.push({ start: at, end: at + m[0].length });
		if (nearNo(text, at)) continue;
		const list = themesFromClause(m[1] ?? '');
		if (list) use(at, list);
	}
	for (const m of text.matchAll(
		/(?:关于|有关)\s*([^，。；\n的]{1,16})\s*的\s*(?:长篇|短篇|中篇|长文|短文)/g,
	)) {
		const at = m.index ?? 0;
		const inside = explicitSpans.some(
			(span) => at >= span.start && at < span.end,
		);
		explicitSpans.push({ start: at, end: at + m[0].length });
		if (inside || nearNo(text, at)) continue;
		const list = themesFromClause(m[1] ?? '');
		if (list) use(at, list);
	}
	const savedHits: { at: number; label: string }[] = [];
	for (const label of savedThemes) {
		if (!label) continue;
		let from = 0;
		while (from <= text.length) {
			const at = text.indexOf(label, from);
			if (at < 0) break;
			const inside = explicitSpans.some(
				(span) => at >= span.start && at < span.end,
			);
			if (!inside && !nearNo(text, at)) savedHits.push({ at, label });
			from = at + label.length;
		}
	}
	if (savedHits.length && lastAt(savedHits.map((h) => h.at)) > themeAt) {
		const seen = new Set<string>();
		themes = [];
		for (const hit of savedHits) {
			if (seen.has(hit.label)) continue;
			seen.add(hit.label);
			themes.push(hit.label);
		}
		themeAt = lastAt(savedHits.map((h) => h.at));
	}
	if (themes) said.themes = themes;
	return said;
}

/** Agent 自选生成：已保存档为底，原话点名的键覆盖。不写回设置。 */
export function resolveAgentManual(
	saved: { themes: string[]; profile: StoredProfile },
	userText: string,
): { themes: string[]; profile: StoredProfile } {
	const said = parseReadingOverride(userText, saved.themes);
	return {
		themes: said.themes ?? saved.themes,
		profile: {
			level: said.level ?? saved.profile.level,
			length: said.length ?? saved.profile.length,
			focus: said.focus ?? saved.profile.focus,
			questions: said.questions ?? saved.profile.questions,
			useWeb: said.useWeb ?? saved.profile.useWeb,
		},
	};
}

export function themeForDate(
	ymd: string,
	themes: readonly string[] = DEFAULT_THEMES,
): string {
	const list = themes.length > 0 ? themes : DEFAULT_THEMES;
	let h = 0;
	for (const c of ymd) h = (h * 33 + c.charCodeAt(0)) >>> 0;
	return list[h % list.length] ?? DEFAULT_THEMES[0];
}

/** 不合格返回 null。空项跳过，重复项只留第一次。 */
export function normalizeThemeList(input: unknown): string[] | null {
	if (!Array.isArray(input)) return null;
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of input) {
		if (typeof item !== 'string') return null;
		const label = stripZw(item).replace(/\s+/g, ' ');
		if (!label) continue;
		if (label.length > THEME_MAX || /[<>]/.test(label)) return null;
		if (seen.has(label)) continue;
		seen.add(label);
		out.push(label);
	}
	if (out.length < 1 || out.length > THEME_LIMIT) return null;
	return out;
}

/** 库存主题不合法时用当前默认。 */
export function themesForSettings(stored: unknown): string[] {
	return normalizeThemeList(stored) ?? [...DEFAULT_THEMES];
}

/** 同一天再写一篇时换个主题。列表只剩被避开的那一个时仍用它。 */
export function pickManualTheme(
	themes: readonly string[],
	avoid: string | null,
): string {
	const rest = avoid ? themes.filter((item) => item !== avoid) : [...themes];
	const list = rest.length > 0 ? rest : [...themes];
	return list[Math.floor(Math.random() * list.length)] ?? DEFAULT_THEMES[0];
}

export function stripZw(raw: string): string {
	return raw.replace(ZW, '').trim();
}

export function normalizeBody(raw: string): string {
	return stripZw(raw).toLowerCase().replace(/\s+/g, ' ');
}

function count(text: string, re: RegExp): number {
	return text.match(re)?.length ?? 0;
}

/** 连续这么多个英文词与检索材料相同，才算照搬。8 个词会误伤常用说法。 */
export const SNIPPET_COPY_WORDS = 16;

export function copiesSnippet(body: string, snippet: string): boolean {
	const words = body.toLowerCase().match(/[a-z']+/g) ?? [];
	const src = snippet.toLowerCase().match(/[a-z']+/g) ?? [];
	const n = SNIPPET_COPY_WORDS;
	if (src.length < n || words.length < n) return false;
	const grams = new Set<string>();
	for (let i = 0; i + n <= src.length; i += 1) {
		grams.add(src.slice(i, i + n).join(' '));
	}
	for (let i = 0; i + n <= words.length; i += 1) {
		if (grams.has(words.slice(i, i + n).join(' '))) return true;
	}
	return false;
}

export function sanitizeHttpUrl(raw: string | undefined): string | null {
	const v = raw?.trim() ?? '';
	if (!v || v.length > 500) return null;
	try {
		const u = new URL(v);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
		return u.toString().slice(0, 500);
	} catch {
		return null;
	}
}

/** 不合格返回原因；合格返回 null。不截断正文。 */
export function rejectPassage(
	draft: PassageDraft,
	recentNorms: string[],
	snippet?: string | null,
): string | null {
	const titleEn = stripZw(draft.titleEn);
	const titleZh = stripZw(draft.titleZh);
	const bodyEn = stripZw(draft.bodyEn);
	const bodyZh = stripZw(draft.bodyZh);
	if (!titleEn || !titleZh || !bodyEn || !bodyZh) return 'empty';
	if (titleEn.length > 80 || titleZh.length > 80) return 'title';
	if (bodyEn.length > 6000 || bodyZh.length > 6000) return 'length';
	if (/[<>]|```/.test(bodyEn) || /[<>]|```/.test(bodyZh)) return 'markup';
	if (count(bodyEn, /[.!?]/g) < 2) return 'sentences';
	const letters = count(bodyEn, /[A-Za-z]/g);
	const cjkEn = count(bodyEn, /[\u4e00-\u9fff]/g);
	if (letters < cjkEn) return 'english';
	if (count(bodyZh, /[\u4e00-\u9fff]/g) < 1) return 'chinese';
	const norm = normalizeBody(bodyEn);
	if (recentNorms.some((n) => n === norm)) return 'duplicate';
	if (snippet && copiesSnippet(bodyEn, snippet)) return 'snippet';
	return null;
}

/** 废稿原因给接口展示。未知码原样返回，避免再收成一句「生成失败」。 */
export function rejectReasonText(reason: string): string {
	const text: Record<string, string> = {
		json: '模型没有返回可解析的短文',
		empty: '标题或正文是空的',
		title: '标题超过 80 字',
		length: '正文超过 6000 字',
		markup: '正文含有标记或代码块',
		sentences: '英文句子不足两句',
		english: '英文正文不像英文',
		chinese: '中文译文缺少汉字',
		duplicate: '和最近的短文重复',
		snippet: '正文抄了检索材料',
	};
	return text[reason] ?? reason;
}

export function parseModelObject(raw: string): Record<string, unknown> | null {
	const s = raw.trim().replace(/^\uFEFF/, '');
	const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const candidate = (fence?.[1] ?? s).trim();
	const start = candidate.indexOf('{');
	const end = candidate.lastIndexOf('}');
	const slice =
		start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
	let value: unknown;
	try {
		value = JSON.parse(slice);
	} catch {
		try {
			value = JSON.parse(slice.replace(/,\s*([\]}])/g, '$1'));
		} catch {
			return null;
		}
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

export function parsePassageJson(raw: string): PassageDraft | null {
	const o = parseModelObject(raw);
	if (!o) return null;
	const pick = (k: string) =>
		typeof o[k] === 'string' ? (o[k] as string) : '';
	return {
		titleEn: pick('titleEn'),
		titleZh: pick('titleZh'),
		bodyEn: pick('bodyEn'),
		bodyZh: pick('bodyZh'),
	};
}

/** 模型常把正确项放在中间。打乱后 answer 仍指向原来的正确项。 */
export function shuffleOptions(
	options: string[],
	answer: number,
	roll: () => number = Math.random,
): { options: string[]; answer: number } {
	const next = options.map((text, index) => ({ text, ok: index === answer }));
	for (let i = next.length - 1; i > 0; i -= 1) {
		const j = Math.floor(roll() * (i + 1));
		[next[i], next[j]] = [next[j], next[i]];
	}
	return {
		options: next.map((item) => item.text),
		answer: next.findIndex((item) => item.ok),
	};
}

/** 短文重试时，这两个模型的预览接在上一轮下面。释义对所有模型都另请求。 */
const FLASH_GLOSS_MODELS = new Set(['glm-4-flash', 'glm-4.7-flash']);

/** 网关常把厂商前缀写在名字前面。去掉前缀后全等，避免「名字里有 flash」误伤别的模型。 */
export function isFlashGlossModel(modelName: string): boolean {
	const bare = modelName.trim().split('/').pop()?.toLowerCase() ?? '';
	return FLASH_GLOSS_MODELS.has(bare);
}

function passageWords(text: string): string[] {
	return text
		.split(/\s+/)
		.map((token) => token.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, ''))
		.filter(Boolean);
}

function wordQueues(words: { w: string; zh: string }[]): Map<string, string[]> {
	const queues = new Map<string, string[]>();
	for (const item of words) {
		const key = item.w.toLowerCase();
		const list = queues.get(key);
		if (list) list.push(item.zh);
		else queues.set(key, [item.zh]);
	}
	return queues;
}

/** 漏掉的词次数，只写进日志，不写正文。 */
export function missingGlossCount(
	bodyEn: string,
	gloss: ReadingExtras['wordGloss'],
): number {
	const have = new Map<string, number>();
	for (const sentence of gloss ?? []) {
		for (const item of sentence.words) {
			const key = item.w.toLowerCase();
			have.set(key, (have.get(key) ?? 0) + 1);
		}
	}
	let missing = 0;
	for (const word of passageWords(bodyEn)) {
		const key = word.toLowerCase();
		const left = have.get(key) ?? 0;
		if (left <= 0) missing += 1;
		else have.set(key, left - 1);
	}
	return missing;
}

/** 一批缺句的句数。四句的逐词 JSON 停在 8192 的一半以下。 */
export const GLOSS_BATCH = 4;

// ponytail: 句号后的大写才切句。Mr. / U.S. 可能被切开；用 includesEither 兜住，不引入分句库。
function passageSentences(bodyEn: string): string[] {
	return stripZw(bodyEn)
		.split(/\n\s*\n/)
		.flatMap((paragraph) =>
			paragraph
				.split(/(?<=[.!?])\s+(?=[A-Z])/)
				.map((sentence) => sentence.replace(/\s+/g, ' ').trim())
				.filter(Boolean),
		);
}

function includesEither(sentence: string, en: string): boolean {
	const left = sentence.replace(/\s+/g, ' ').trim().toLowerCase();
	const right = en.replace(/\s+/g, ' ').trim().toLowerCase();
	if (Math.min(left.length, right.length) < 8) return false;
	return left.includes(right) || right.includes(left);
}

/** 给模型的编号文本。序号是全文里的编号。 */
export function glossUserText(bodyEn: string): string {
	return passageSentences(bodyEn)
		.map((sentence, index) => `${index + 1}. ${sentence}`)
		.join('\n');
}

/** 已有 en 就保持原对照。只有序号时换成切句结果，越界则空。 */
export function glossFromIndex(
	row: Record<string, unknown>,
	sentences: string[],
): string {
	const en = typeof row.en === 'string' ? stripZw(row.en) : '';
	if (en) return en;
	const index = typeof row.i === 'number' ? row.i : Number.NaN;
	if (!Number.isInteger(index)) return '';
	return sentences[index - 1] ?? '';
}

/** 一句里还没有中文的词。已有释义的词不在这里。 */
export function missingWordSlots(
	bodyEn: string,
	gloss: ReadingExtras['wordGloss'],
): { sentence: string; words: string[] }[] {
	const rows = gloss ?? [];
	const out: { sentence: string; words: string[] }[] = [];
	for (const sentence of passageSentences(bodyEn)) {
		const hit = rows.find((row) => includesEither(sentence, row.en));
		const have = new Map<string, number>();
		for (const item of hit?.words ?? []) {
			const key = item.w.toLowerCase();
			have.set(key, (have.get(key) ?? 0) + 1);
		}
		const words: string[] = [];
		for (const token of passageWords(sentence)) {
			const key = token.toLowerCase();
			const left = have.get(key) ?? 0;
			if (left <= 0) words.push(token);
			else have.set(key, left - 1);
		}
		if (words.length) out.push({ sentence, words });
	}
	return out;
}

/** 补词请求只带序号和缺词。序号仍是全文里的编号。 */
export function glossGapText(
	bodyEn: string,
	gaps: { sentence: string; words: string[] }[],
): string {
	const all = passageSentences(bodyEn);
	const used = new Set<number>();
	const lines: string[] = [];
	for (const gap of gaps) {
		const index = all.findIndex(
			(item, i) => !used.has(i) && item === gap.sentence,
		);
		if (index < 0) continue;
		used.add(index);
		lines.push(`${index + 1}. ${gap.words.join(' ')}`);
	}
	return lines.join('\n');
}

function balancedObjectEnd(text: string, open: number): number {
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = open; i < text.length; i += 1) {
		const ch = text[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === '\\') escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === '{') depth += 1;
		else if (ch === '}') {
			depth -= 1;
			if (depth === 0) return i;
		}
	}
	return -1;
}

function closedGlossObjects(raw: string): unknown[] {
	const keyAt = raw.indexOf('"wordGloss"');
	if (keyAt < 0) return [];
	const start = raw.indexOf('[', keyAt);
	if (start < 0) return [];
	const out: unknown[] = [];
	let i = start + 1;
	while (i < raw.length) {
		const ch = raw[i];
		if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === ',') {
			i += 1;
			continue;
		}
		if (ch !== '{') break;
		const end = balancedObjectEnd(raw, i);
		if (end < 0) break;
		try {
			out.push(JSON.parse(raw.slice(i, end + 1)));
		} catch {
			break;
		}
		i = end + 1;
	}
	return out;
}

/** 整段 JSON 被截断时，留下括号已经配平的句子。末尾半截丢掉。 */
export function salvageWordGloss(
	raw: string,
	bodyEn: string,
): ReadingExtras['wordGloss'] {
	return pickWordGloss(closedGlossObjects(raw), bodyEn);
}

function glossEnKey(en: string): string {
	return en.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** 同一句里已有中文优先。补上的词只填还空着的位置。 */
export function mergeWordGloss(
	first: ReadingExtras['wordGloss'],
	second: ReadingExtras['wordGloss'],
): ReadingExtras['wordGloss'] {
	const prev = first ?? [];
	const next = second ?? [];
	if (!next.length) return prev.length ? prev : undefined;
	const used = new Set<number>();
	const out: NonNullable<ReadingExtras['wordGloss']> = [];
	for (const sentence of next) {
		const key = glossEnKey(sentence.en);
		const index = prev.findIndex(
			(item, i) => !used.has(i) && glossEnKey(item.en) === key,
		);
		const kept = index >= 0 ? prev[index] : undefined;
		if (index >= 0) used.add(index);
		const words = mergeSentenceWords(
			sentence.en,
			kept?.words ?? [],
			sentence.words,
		);
		if (words.length) out.push({ en: sentence.en, words });
	}
	for (let i = 0; i < prev.length; i += 1) {
		if (!used.has(i)) out.push(prev[i]);
	}
	return out.length ? out : undefined;
}

function mergeSentenceWords(
	en: string,
	first: { w: string; zh: string }[],
	fill: { w: string; zh: string }[],
): { w: string; zh: string }[] {
	const fillQueue = wordQueues(fill);
	const firstQueue = wordQueues(first);
	const words: { w: string; zh: string }[] = [];
	for (const token of passageWords(en)) {
		const key = token.toLowerCase();
		const zh = firstQueue.get(key)?.shift() ?? fillQueue.get(key)?.shift();
		if (zh) words.push({ w: token, zh });
	}
	return words;
}

// 把模型的 wordGloss 收成可入库的 {en, words}。序号和旧的英文原句都收，对不上正文的整句丢掉。
export function pickWordGloss(
	// 模型给出的句子数组。截断抢救也可能把未解析完的片段传进来。
	raw: unknown,
	// 已经定稿的英文正文。句子必须能在这里找到，词也必须出现在对应句里。
	bodyEn: string,
	// 没有合格句子时返回 undefined，调用方不会把空的 wordGloss 写进 extras。
): ReadingExtras['wordGloss'] | undefined {
	// 不是数组就无法逐句看 en、i 和 words，直接当成这次没有释义。
	if (!Array.isArray(raw)) return undefined;
	// 编号和落库用同一套切句，模型返回的 1 才对应正文第一句。
	const sentences = passageSentences(bodyEn);
	// 整篇去掉零宽字符并转小写，后面用包含关系确认这句确实来自这篇正文。
	const body = stripZw(bodyEn).toLowerCase();
	// 同一个序号只收第一次。重复的 i 不再挂第二份词表。
	const usedIndex = new Set<number>();
	// 通过正文对照和词校验的句子。详情页只读这里的 en 和 words。
	const out: NonNullable<ReadingExtras['wordGloss']> = [];
	// 按模型给出的顺序收。先出现的序号占住后，后面的重复项会被跳过。
	for (const item of raw) {
		// 单篇最多留 40 句，避免模型写出远超正文的释义列表。
		if (out.length >= 40) break;
		// 空位或非对象拿不到 en、i、words，跳过这一项，继续看后面的句子。
		if (!item || typeof item !== 'object') continue;
		// 收成字段记录，后面分别读取英文原句、序号和词表。
		const row = item as Record<string, unknown>;
		// 旧格式自带英文原句。有这段就沿用原来的对照，不用序号改写它。
		const direct = typeof row.en === 'string' ? stripZw(row.en) : '';
		// 新格式的序号必须是数字。缺字段或写成字符串都视为没有序号。
		const index = typeof row.i === 'number' ? row.i : Number.NaN;
		// 没有英文原句时才依赖序号。序号不是整数，或这个序号已经用过，这句不要。
		if (!direct) {
			if (!Number.isInteger(index) || usedIndex.has(index)) continue;
			// 先占住序号。后面词校验失败也不会让同一个 i 再挂到另一份词表。
			usedIndex.add(index);
			// 结束只靠序号的这一支。带 en 的旧格式不进这里。
		}
		// 有 en 就用 en。只有合法序号时换成切出来的那一句，越界序号会变成空串。
		const en = glossFromIndex(row, sentences);
		// 对照前压掉多余空白并转小写，避免模型多写的换行让同一句对不上。
		const enNorm = en.toLowerCase().replace(/\s+/g, ' ');
		// 空句、超过 600 字，或压空白后的正文里找不到这句，都不能挂词，否则详情会错位。
		if (!en || en.length > 600 || !body.replace(/\s+/g, ' ').includes(enNorm))
			// 这句对不上正文，丢掉，继续看模型给出的下一句。
			continue;
		// words 不是数组就当成这句没有词，下面的循环不会收集任何词。
		const wordsRaw = Array.isArray(row.words) ? row.words : [];
		// 只留下能在这句里对上的词。入库后的每一项仍是 {w, zh}。
		const words: { w: string; zh: string }[] = [];
		// 按模型给出的词序收集，缺词判断才能按出现次数对齐。
		for (const piece of wordsRaw) {
			// 一句最多 80 个词，挡住把标点或重复项无限列下去。
			if (words.length >= 80) break;
			// 词项必须是对象，否则没有 w 和 zh 可取。
			if (!piece || typeof piece !== 'object') continue;
			// 取出这一项的词面和中文，后面分别检查长度和是否在句中。
			const cell = piece as Record<string, unknown>;
			// 词面只收字符串，并去掉零宽字符。其它类型当成这个词不存在。
			const w = typeof cell.w === 'string' ? stripZw(cell.w) : '';
			// 中文释义同样只收字符串。空串会在下一行被丢掉。
			const zh = typeof cell.zh === 'string' ? stripZw(cell.zh) : '';
			// 词面或释义为空、词面超过 40、释义超过 24，都不是能展示的逐词释义。
			if (!w || w.length > 40 || !zh || zh.length > 24) continue;
			// 释义里要有汉字，并且 w 必须作为整词出现在这句里，避免把别的句子的词挂过来。
			if (!/[\u4e00-\u9fff]/.test(zh) || !inBody(en, w)) continue;
			// 这个词通过校验，按模型顺序放进这句的词表。
			words.push({ w, zh });
			// 结束这一句的词过滤，words 里只剩能挂上正文的词。
		}
		// 一个词都没留下的句子不入库。详情里这句会继续显示纯英文。
		if (words.length > 0) out.push({ en, words });
		// 结束对模型句子数组的遍历，out 是准备写入 extras 的释义。
	}
	// 整段都没有合格句子时返回 undefined，调用方不会把空数组写进 extras。
	return out.length > 0 ? out : undefined;
}

function inBody(bodyEn: string, word: string): boolean {
	const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`\\b${escaped}\\b`, 'i').test(bodyEn);
}

function acceptedGlossWords(
	wordsRaw: unknown,
	en: string,
): { w: string; zh: string }[] {
	const words: { w: string; zh: string }[] = [];
	if (!Array.isArray(wordsRaw)) return words;
	for (const piece of wordsRaw) {
		if (words.length >= 80) break;
		if (!piece || typeof piece !== 'object') continue;
		const cell = piece as Record<string, unknown>;
		const w = typeof cell.w === 'string' ? stripZw(cell.w) : '';
		const zh = typeof cell.zh === 'string' ? stripZw(cell.zh) : '';
		if (!w || !zh || zh.length > 24 || !/[\u4e00-\u9fff]/.test(zh)) continue;
		for (const token of w.split(/\s+/)) {
			if (words.length >= 80) break;
			if (!token || token.length > 40 || !inBody(en, token)) continue;
			words.push({ w: token, zh });
		}
	}
	return words;
}

/**
 * 缺词批挂回这批句子。模型常把唯一一行改成 i:1，按原序号对上才收，对不上就按顺序挂。
 */
export function placeGapGloss(
	raw: unknown,
	bodyEn: string,
	gaps: { sentence: string; words: string[] }[],
	salvageText?: string,
): ReadingExtras['wordGloss'] | undefined {
	const all = passageSentences(bodyEn);
	const used = new Set<number>();
	const slots: { i: number; en: string }[] = [];
	for (const gap of gaps) {
		const at = all.findIndex(
			(item, n) => !used.has(n) && item === gap.sentence,
		);
		if (at < 0) continue;
		used.add(at);
		slots.push({ i: at + 1, en: all[at] });
	}
	if (!slots.length) return undefined;
	let list = Array.isArray(raw) ? raw : [];
	if (!list.length && salvageText) list = closedGlossObjects(salvageText);
	const items = list.filter(
		(item): item is Record<string, unknown> =>
			!!item && typeof item === 'object',
	);
	const slotByI = new Map(slots.map((slot) => [slot.i, slot]));
	const taken = new Set<number>();
	const wordsAt = new Map<number, { w: string; zh: string }[]>();
	const leftover: Record<string, unknown>[] = [];
	for (const row of items) {
		const i = typeof row.i === 'number' ? row.i : Number(row.i);
		const slot = slotByI.get(i);
		if (slot && !taken.has(i)) {
			taken.add(i);
			wordsAt.set(i, acceptedGlossWords(row.words, slot.en));
		} else leftover.push(row);
	}
	const open = slots.filter((slot) => !taken.has(slot.i));
	leftover.forEach((row, n) => {
		const slot = open[n];
		if (!slot) return;
		wordsAt.set(slot.i, acceptedGlossWords(row.words, slot.en));
	});
	const out = slots.flatMap((slot) => {
		const words = wordsAt.get(slot.i) ?? [];
		return words.length ? [{ en: slot.en, words }] : [];
	});
	return out.length ? out : undefined;
}

/** 正文已经合格。学习块不合格就省略该键，不让附件废掉整篇。 */
export function pickExtras(
	payload: unknown,
	bodyEn: string,
	profile: ReadingProfile,
): ReadingExtras {
	const extras: ReadingExtras = {
		level: profile.level,
		length: profile.length,
		focus: profile.focus,
	};
	const o =
		payload && typeof payload === 'object'
			? (payload as Record<string, unknown>)
			: {};
	if (
		(profile.focus === 'vocab' || profile.focus === 'both') &&
		Array.isArray(o.glossary)
	) {
		const glossary: { word: string; zh: string }[] = [];
		for (const item of o.glossary) {
			if (glossary.length >= glossaryLimit(profile.length)) break;
			if (!item || typeof item !== 'object') continue;
			const row = item as Record<string, unknown>;
			const word = typeof row.word === 'string' ? stripZw(row.word) : '';
			const zh = typeof row.zh === 'string' ? stripZw(row.zh) : '';
			if (!word || word.length > 40 || !zh || zh.length > 40) continue;
			if (!inBody(bodyEn, word)) continue;
			glossary.push({ word, zh });
		}
		if (glossary.length > 0) extras.glossary = glossary;
	}
	if (profile.focus === 'grammar' || profile.focus === 'both') {
		const grammarNotes = pickGrammarNotes(o.grammarNotes, bodyEn);
		if (grammarNotes.length > 0) extras.grammarNotes = grammarNotes;
	}
	const wordGloss = pickWordGloss(o.wordGloss, bodyEn);
	if (wordGloss) extras.wordGloss = wordGloss;
	if (profile.questions > 0 && Array.isArray(o.questions)) {
		const questions: NonNullable<ReadingExtras['questions']> = [];
		for (const item of o.questions) {
			if (!item || typeof item !== 'object') continue;
			const row = item as Record<string, unknown>;
			const q = typeof row.q === 'string' ? stripZw(row.q) : '';
			const options = Array.isArray(row.options)
				? row.options.filter(
						(opt): opt is string => typeof opt === 'string' && !!stripZw(opt),
					)
				: [];
			const answer = questionAnswer(row.answer);
			if (!q || q.length > 200 || options.length !== 3 || answer == null)
				continue;
			const placed = shuffleOptions(
				options.map((opt) => stripZw(opt).slice(0, 80)),
				answer,
			);
			questions.push({ q, ...placed });
		}
		if (questions.length > 0) {
			extras.questions = questions.slice(0, profile.questions);
		}
	}
	return extras;
}

const GRAMMAR_CUE = /表示|用于/;

/** 摘录折叠空白后必须出现在这篇正文里，避免讲到别的文章。 */
function excerptInBody(bodyEn: string, excerpt: string): boolean {
	const left = stripZw(bodyEn).replace(/\s+/g, ' ').toLowerCase();
	const right = excerpt.replace(/\s+/g, ' ').trim().toLowerCase();
	if (right.length < 8 || right.length > 80) return false;
	if (!/[a-z]/i.test(right)) return false;
	return left.includes(right);
}

/** 只留讲到本文的语法。字符串和整句中文翻译都丢掉，好让外层再要一次。 */
export function pickGrammarNotes(raw: unknown, bodyEn: string): GrammarNote[] {
	if (!Array.isArray(raw)) return [];
	const notes: GrammarNote[] = [];
	for (const item of raw) {
		if (notes.length >= 3) break;
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const point = typeof row.point === 'string' ? stripZw(row.point) : '';
		const excerpt = typeof row.excerpt === 'string' ? stripZw(row.excerpt) : '';
		const explain = typeof row.explain === 'string' ? stripZw(row.explain) : '';
		if (!point || point.length > 20 || !/[\u4e00-\u9fff]/.test(point)) continue;
		if (!excerptInBody(bodyEn, excerpt)) continue;
		if (
			!explain ||
			explain.length > 120 ||
			!/[\u4e00-\u9fff]/.test(explain) ||
			!GRAMMAR_CUE.test(explain)
		) {
			continue;
		}
		const key = excerpt.replace(/\s+/g, ' ').trim().toLowerCase();
		if (
			notes.some(
				(note) =>
					note.excerpt.replace(/\s+/g, ' ').trim().toLowerCase() === key,
			)
		) {
			continue;
		}
		notes.push({ point, excerpt, explain });
	}
	return notes;
}

export type ReadingExtraKey = 'glossary' | 'grammarNotes' | 'questions';

/** 只阅读且不出题时不发附件请求。 */
export function extrasRequested(profile: ReadingProfile): boolean {
	return profile.focus !== 'reading' || profile.questions > 0;
}

/** 这次设置要的附件键。补空类时只取其中为空的那些。 */
export function requestedExtraKeys(profile: ReadingProfile): ReadingExtraKey[] {
	const keys: ReadingExtraKey[] = [];
	if (profile.focus === 'vocab' || profile.focus === 'both')
		keys.push('glossary');
	if (profile.focus === 'grammar' || profile.focus === 'both')
		keys.push('grammarNotes');
	if (profile.questions > 0) keys.push('questions');
	return keys;
}

/** 词汇和语法一个都没有才再要。题目没凑满设定条数也再要。 */
export function emptyExtraKeys(
	extras: ReadingExtras,
	profile: ReadingProfile,
): ReadingExtraKey[] {
	return requestedExtraKeys(profile).filter((key) => {
		if (key === 'glossary') return !extras.glossary?.length;
		if (key === 'grammarNotes') return !extras.grammarNotes?.length;
		return (extras.questions?.length ?? 0) < profile.questions;
	});
}

/** 答案常被模型写成字符串。只接受 0、1、2。 */
function questionAnswer(raw: unknown): 0 | 1 | 2 | null {
	const n = typeof raw === 'string' ? Number(raw.trim()) : raw;
	if (n === 0 || n === 1 || n === 2) return n;
	return null;
}

/** 题目按题干去重，凑满设定条数为止。先留下的优先。 */
function fillQuestions(
	first: ReadingExtras['questions'],
	second: ReadingExtras['questions'],
	cap: number,
): NonNullable<ReadingExtras['questions']> {
	const out = [...(first ?? [])];
	for (const item of second ?? []) {
		if (out.length >= cap) break;
		if (out.some((row) => row.q === item.q)) continue;
		out.push(item);
	}
	return out.slice(0, cap);
}

/** 同一类两次都有时留下先拿到的。题目不足时用后一次补满。 */
export function mergeExtras(
	first: ReadingExtras,
	second: ReadingExtras,
	profile: ReadingProfile,
): ReadingExtras {
	const extras: ReadingExtras = {
		level: first.level,
		length: first.length,
		focus: first.focus,
	};
	const glossary = first.glossary?.length ? first.glossary : second.glossary;
	const grammarNotes = first.grammarNotes?.length
		? first.grammarNotes
		: second.grammarNotes;
	const questions = fillQuestions(
		first.questions,
		second.questions,
		profile.questions,
	);
	const wordGloss = first.wordGloss?.length
		? first.wordGloss
		: second.wordGloss;
	if (glossary?.length) extras.glossary = glossary;
	if (grammarNotes?.length) extras.grammarNotes = grammarNotes;
	if (questions?.length) extras.questions = questions;
	if (wordGloss?.length) extras.wordGloss = wordGloss;
	return extras;
}

function balancedStringEnd(text: string, open: number): number {
	let escaped = false;
	for (let i = open + 1; i < text.length; i += 1) {
		const ch = text[i];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (ch === '\\') {
			escaped = true;
			continue;
		}
		if (ch === '"') return i;
	}
	return -1;
}

function closedArrayItems(raw: string, key: string): unknown[] | undefined {
	const keyAt = raw.indexOf(`"${key}"`);
	if (keyAt < 0) return undefined;
	const start = raw.indexOf('[', keyAt);
	if (start < 0) return undefined;
	const out: unknown[] = [];
	let i = start + 1;
	while (i < raw.length) {
		const ch = raw[i];
		if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === ',') {
			i += 1;
			continue;
		}
		if (ch === ']') break;
		if (ch !== '{' && ch !== '"') break;
		const end =
			ch === '{' ? balancedObjectEnd(raw, i) : balancedStringEnd(raw, i);
		if (end < 0) break;
		try {
			out.push(JSON.parse(raw.slice(i, end + 1)));
		} catch {
			break;
		}
		i = end + 1;
	}
	return out;
}

/** 整段 JSON 被截断时，留下已闭合的词汇、语法和题目。末尾半截丢掉。 */
export function salvageExtras(
	raw: string,
	bodyEn: string,
	profile: ReadingProfile,
): ReadingExtras {
	const payload: Record<string, unknown> = {};
	const glossary = closedArrayItems(raw, 'glossary');
	const grammarNotes = closedArrayItems(raw, 'grammarNotes');
	const questions = closedArrayItems(raw, 'questions');
	if (glossary) payload.glossary = glossary;
	if (grammarNotes) payload.grammarNotes = grammarNotes;
	if (questions) payload.questions = questions;
	return pickExtras(payload, bodyEn, profile);
}
