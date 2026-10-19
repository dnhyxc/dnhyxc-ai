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

export type ReadingExtras = {
	level: ReadingLevel;
	length: ReadingLength;
	focus: ReadingFocus;
	glossary?: { word: string; zh: string }[];
	/** 按句列出正文里的词，zh 是该词在这一句里的意思。 */
	wordGloss?: { en: string; words: { w: string; zh: string }[] }[];
	grammarNotes?: string[];
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

/** 脏枚举回默认，不让整单失败。 */
export function normalizeProfile(input: unknown): ReadingProfile {
	const src =
		input && typeof input === 'object'
			? (input as Record<string, unknown>)
			: {};
	const level =
		LEVELS.find((item) => item === src.level) ?? DEFAULT_PROFILE.level;
	const length =
		LENGTHS.find((item) => item === src.length) ?? DEFAULT_PROFILE.length;
	const focus =
		FOCUSES.find((item) => item === src.focus) ?? DEFAULT_PROFILE.focus;
	const questions =
		src.questions === 0 || src.questions === 2 || src.questions === 3
			? src.questions
			: DEFAULT_PROFILE.questions;
	const useWeb =
		typeof src.useWeb === 'boolean' ? src.useWeb : DEFAULT_PROFILE.useWeb;
	return { level, length, focus, questions, useWeb };
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

function sentenceStillMissing(
	sentence: string,
	words: { w: string; zh: string }[],
): boolean {
	const have = new Map<string, number>();
	for (const item of words) {
		const key = item.w.toLowerCase();
		have.set(key, (have.get(key) ?? 0) + 1);
	}
	for (const token of passageWords(sentence)) {
		const key = token.toLowerCase();
		const left = have.get(key) ?? 0;
		if (left <= 0) return true;
		have.set(key, left - 1);
	}
	return false;
}

function isCovered(
	sentence: string,
	rows: NonNullable<ReadingExtras['wordGloss']>,
): boolean {
	const hit = rows.find((row) => includesEither(sentence, row.en));
	return !!hit && !sentenceStillMissing(sentence, hit.words);
}

/** 还要再请求的句子。整句没有释义，或句中仍有词没有中文，都算缺。 */
export function missingSentences(
	bodyEn: string,
	gloss: ReadingExtras['wordGloss'],
): string[] {
	const rows = gloss ?? [];
	return passageSentences(bodyEn).filter(
		(sentence) => !isCovered(sentence, rows),
	);
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

/** 同一句里补全优先；只有首次写过的词按正文顺序留下。 */
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
		const zh = fillQueue.get(key)?.shift() ?? firstQueue.get(key)?.shift();
		if (zh) words.push({ w: token, zh });
	}
	return words;
}

export function pickWordGloss(
	raw: unknown,
	bodyEn: string,
): ReadingExtras['wordGloss'] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const body = stripZw(bodyEn).toLowerCase();
	const out: NonNullable<ReadingExtras['wordGloss']> = [];
	for (const item of raw) {
		if (out.length >= 40) break;
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const en = typeof row.en === 'string' ? stripZw(row.en) : '';
		const enNorm = en.toLowerCase().replace(/\s+/g, ' ');
		if (!en || en.length > 600 || !body.replace(/\s+/g, ' ').includes(enNorm))
			continue;
		const wordsRaw = Array.isArray(row.words) ? row.words : [];
		const words: { w: string; zh: string }[] = [];
		for (const piece of wordsRaw) {
			if (words.length >= 80) break;
			if (!piece || typeof piece !== 'object') continue;
			const cell = piece as Record<string, unknown>;
			const w = typeof cell.w === 'string' ? stripZw(cell.w) : '';
			const zh = typeof cell.zh === 'string' ? stripZw(cell.zh) : '';
			if (!w || w.length > 40 || !zh || zh.length > 24) continue;
			if (!/[\u4e00-\u9fff]/.test(zh) || !inBody(en, w)) continue;
			words.push({ w, zh });
		}
		if (words.length > 0) out.push({ en, words });
	}
	return out.length > 0 ? out : undefined;
}

function inBody(bodyEn: string, word: string): boolean {
	const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`\\b${escaped}\\b`, 'i').test(bodyEn);
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
		const rawNotes = Array.isArray(o.grammarNotes)
			? o.grammarNotes
			: typeof o.grammarNote === 'string'
				? [o.grammarNote]
				: [];
		const grammarNotes: string[] = [];
		for (const item of rawNotes) {
			if (grammarNotes.length >= 3) break;
			if (typeof item !== 'string') continue;
			const note = stripZw(item);
			if (!note || note.length > 120 || !/[\u4e00-\u9fff]/.test(note)) continue;
			if (grammarNotes.includes(note)) continue;
			grammarNotes.push(note);
		}
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
			const answer = row.answer;
			if (!q || q.length > 200 || options.length !== 3) continue;
			if (answer !== 0 && answer !== 1 && answer !== 2) continue;
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

/** 某一类一个都没有才需要再要。已有若干条就不补。 */
export function emptyExtraKeys(
	extras: ReadingExtras,
	profile: ReadingProfile,
): ReadingExtraKey[] {
	return requestedExtraKeys(profile).filter((key) => {
		if (key === 'glossary') return !extras.glossary?.length;
		if (key === 'grammarNotes') return !extras.grammarNotes?.length;
		return !extras.questions?.length;
	});
}

/** 同一类两次都有时留下先拿到的，避免补请求盖掉已合格的条目。 */
export function mergeExtras(
	first: ReadingExtras,
	second: ReadingExtras,
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
	const questions = first.questions?.length
		? first.questions
		: second.questions;
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
