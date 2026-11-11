/** 详解缓存版本。栏目或提示词约定变化时改这里，旧行不再命中。 */
export const VOCAB_DETAIL_CACHE_VERSION = 'v1';

export type VocabDetailPart = {
	form: string;
	kind: 'prefix' | 'root' | 'suffix' | 'base';
	meaningZh: string;
};

export type VocabDetail = {
	lemma: string;
	morphology: {
		parts: VocabDetailPart[];
		storyZh: string;
	};
	memory: { hookZh: string };
	senses: { pos: string; glossZh: string; nuanceZh: string }[];
	examples: { en: string; zh: string }[];
	family: { word: string; pos: string; glossZh: string }[];
	collocations: { phrase: string; glossZh: string }[];
	synonyms: { word: string; pos: string; glossZh: string }[];
	tags: string[];
};

const KINDS = new Set(['prefix', 'root', 'suffix', 'base']);

/** 去空白、合并空格、转小写。超过 120 的原文由调用方拒绝，这里不再截成假词。 */
export function normalizeVocabLemma(word: string): string {
	return word.trim().replace(/\s+/g, ' ').toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function asList(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function asText(value: unknown, max = 500): string | null {
	if (typeof value !== 'string') return null;
	const text = value.trim().slice(0, max);
	return text || null;
}

function take<T>(
	value: unknown,
	parse: (item: unknown) => T | null,
	limit: number,
): T[] {
	const rows: T[] = [];
	for (const item of asList(value)) {
		const row = parse(item);
		if (row === null) continue;
		rows.push(row);
		if (rows.length === limit) break;
	}
	return rows;
}

function parsePart(value: unknown): VocabDetailPart | null {
	const row = asRecord(value);
	if (!row) return null;
	const form = asText(row.form, 80);
	const meaningZh = asText(row.meaningZh);
	const kind = typeof row.kind === 'string' ? row.kind : '';
	if (!form || !meaningZh || !KINDS.has(kind)) return null;
	return { form, kind: kind as VocabDetailPart['kind'], meaningZh };
}

function parseSense(value: unknown): VocabDetail['senses'][number] | null {
	const row = asRecord(value);
	if (!row) return null;
	const pos = asText(row.pos, 32);
	const glossZh = asText(row.glossZh);
	if (!pos || !glossZh) return null;
	return { pos, glossZh, nuanceZh: asText(row.nuanceZh) ?? '' };
}

function parseExample(value: unknown): VocabDetail['examples'][number] | null {
	const row = asRecord(value);
	if (!row) return null;
	const en = asText(row.en);
	const zh = asText(row.zh);
	if (!en || !zh) return null;
	return { en, zh };
}

function parseFamily(value: unknown): VocabDetail['family'][number] | null {
	const row = asRecord(value);
	if (!row) return null;
	const word = asText(row.word, 80);
	const pos = asText(row.pos, 32);
	const glossZh = asText(row.glossZh);
	if (!word || !pos || !glossZh) return null;
	return { word, pos, glossZh };
}

function parseCollocation(
	value: unknown,
): VocabDetail['collocations'][number] | null {
	const row = asRecord(value);
	if (!row) return null;
	const phrase = asText(row.phrase, 120);
	const glossZh = asText(row.glossZh);
	if (!phrase || !glossZh) return null;
	return { phrase, glossZh };
}

/** 必填栏目缺失返回 null，调用方不得入库。 */
export function parseVocabDetail(
	raw: unknown,
	lemma: string,
): VocabDetail | null {
	const body = asRecord(raw);
	if (!body) return null;
	const morphology = asRecord(body.morphology);
	const parts = take(morphology?.parts, parsePart, 8);
	if (parts.length === 0) return null;
	const memory = asRecord(body.memory);
	const hookZh = asText(memory?.hookZh);
	if (!hookZh) return null;
	const senses = take(body.senses, parseSense, 6);
	if (senses.length === 0) return null;
	const examples = take(body.examples, parseExample, 4);
	if (examples.length === 0) return null;
	return {
		lemma,
		morphology: { parts, storyZh: asText(morphology?.storyZh) ?? '' },
		memory: { hookZh },
		senses,
		examples,
		family: take(body.family, parseFamily, 6),
		collocations: take(body.collocations, parseCollocation, 6),
		synonyms: take(body.synonyms, parseFamily, 6),
		tags: take(body.tags, (tag) => asText(tag, 32), 4),
	};
}
