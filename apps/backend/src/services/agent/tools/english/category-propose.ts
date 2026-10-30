import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { ChatOpenAI } from '@langchain/openai';
import type { ConfigService } from '@nestjs/config';
import { createLlm } from '../../../../utils/create-llm';
import { decideLlmOptions } from '../../../../utils/glm-decide';

/** 一次送进分类模型的「词面 | 释义」文本上限。再大就会把输出顶满，截断后整段重送。 */
const CATEGORY_BATCH_CHARS = 48_000;
/**
 * 这一段就算每个词都命中，JSON 也要装进 CATEGORY_MAX_TOKENS。
 * ponytail: 按每词约 12 token 估算。更长的词面被截断时才会续批；不要改回 65536。
 */
const CATEGORY_MAX_ROWS = 600;
/** 只约束这一段的输出。65536 会让长回答写完才返回，输入还要再送一遍。 */
const CATEGORY_MAX_TOKENS = 8_192;
/** 释义只取开头。类别通常在前几个字；整段例句不参与筛选。 */
const GLOSS_CHARS = 40;
/** 超时只包这一次分类请求。 */
const CATEGORY_TIMEOUT_MS = 120_000;

/** 进程内只建一次。每次 invoke 自带 signal。换模型需要重启进程。 */
let categoryClient: Promise<ChatOpenAI> | null = null;
/**
 * ponytail: 最多 4 路同时判。几千条词库串行会把确认条拖到超时。
 * 天花板是供应商并发；再慢就改成按 offset 分批落提案，而不是加大这一路。
 */
const CATEGORY_PARALLEL = 4;

const TASK =
	'你只做筛选。用户原话是一个类别名。下面每行是「原文 | 释义」，原文可能是单词，也可能是整句。' +
	'按语义判断这一行属不属于这个类别，不要只保留原文或释义里出现了类别名的行。这个类别下面的具体成员、例子、场景也算，即使没写出类别那个词。' +
	'只返回每行竖线左边的原文，必须与输入逐字相同，不要返回原文里的一个片段，也不要带上竖线右边的释义，不要编造。命中按输入顺序写。' +
	'只返回 JSON：{"words":["原文"]}。没有符合的行时 words 为空数组。';

type BatchReply =
	| { kind: 'done'; done: boolean; cursor: string; words: string[] }
	| { kind: 'cut'; kept: string[]; cutWord: string }
	| { kind: 'empty' };

/** 单词看词面，语句没有 word 时用 english，否则这一批是空的。 */
function lineKey(row: Record<string, unknown>): string {
	const word = typeof row.word === 'string' ? row.word.trim() : '';
	if (word) return word;
	return typeof row.english === 'string' ? row.english.trim() : '';
}

function rowLine(row: Record<string, unknown>): string {
	const word = lineKey(row);
	if (!word) return '';
	const zh =
		typeof row.translationZh === 'string' ? row.translationZh.trim() : '';
	const vocab = typeof row.word === 'string' && row.word.trim().length > 0;
	if (vocab) return `${word} | ${zh.slice(0, GLOSS_CHARS)}`;
	const note = typeof row.noteZh === 'string' ? row.noteZh.trim() : '';
	return note ? `${word} | ${zh} | ${note}` : `${word} | ${zh}`;
}

function chunkLines(chunk: Array<Record<string, unknown>>): string {
	return chunk
		.map((row) => rowLine(row))
		.filter((line) => line.length > 0)
		.join('\n');
}

/** 从下标收到段尾或字符预算。超预算时仍至少保留一行，避免空批打转。 */
function takeSlice(
	items: Array<Record<string, unknown>>,
	from: number,
	to: number,
): { rows: Array<Record<string, unknown>>; end: number } {
	const rows: Array<Record<string, unknown>> = [];
	let chars = 0;
	let end = from;
	while (end < to) {
		if (rows.length >= CATEGORY_MAX_ROWS) break;
		const line = rowLine(items[end]);
		const add = line.length === 0 ? 0 : line.length + (chars > 0 ? 1 : 0);
		if (rows.length > 0 && chars + add > CATEGORY_BATCH_CHARS) break;
		rows.push(items[end]);
		chars += add;
		end += 1;
	}
	return { rows, end };
}

function indexOfLine(
	items: Array<Record<string, unknown>>,
	word: string,
	from: number,
	to: number,
): number {
	const key = word.trim().toLowerCase();
	if (!key) return -1;
	for (let i = from; i < to; i += 1) {
		if (lineKey(items[i]).toLowerCase() === key) return i;
	}
	return -1;
}

/** 找不到游标时返回当前下标，让调用方当成没有前进。 */
function indexAfter(
	items: Array<Record<string, unknown>>,
	word: string,
	from: number,
	to: number,
): number {
	const at = indexOfLine(items, word, from, to);
	if (at < 0) return from;
	return at + 1;
}

/** 只认 words 后面已经闭合的引号。cursor 字段里的词面不是命中，半个词也不算。 */
function completeWords(text: string, allowed: Set<string>): string[] {
	const mark = text.indexOf('"words"');
	const source = mark >= 0 ? text.slice(mark + '"words"'.length) : text;
	const found = source.match(/"((?:\\.|[^"\\])*)"/g) ?? [];
	const words: string[] = [];
	for (const token of found) {
		const word = token.slice(1, -1).trim().toLowerCase();
		if (allowed.has(word)) words.push(word);
	}
	return words;
}

function parseBatch(
	text: string,
	finish: string | undefined,
	allowed: Set<string>,
): BatchReply {
	const cutOff = finish === 'length' || finish === 'max_tokens';
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		raw = undefined;
	}
	// JSON 能解析就说明这段已经写完。length 或 done:false 只表示模型还想往下说，不能据此再开下一次。
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		const body = raw as { words?: unknown };
		if (
			Array.isArray(body.words) &&
			body.words.every((word) => typeof word === 'string')
		) {
			return { kind: 'done', done: true, cursor: '', words: body.words };
		}
		return { kind: 'empty' };
	}
	if (!cutOff && raw !== undefined) return { kind: 'empty' };
	const hits = completeWords(text, allowed);
	if (!hits.length) return { kind: 'empty' };
	const cutWord = hits[hits.length - 1];
	return { kind: 'cut', kept: hits.slice(0, -1), cutWord };
}

function finishReasonOf(message: {
	response_metadata?: unknown;
}): string | undefined {
	const meta = message.response_metadata;
	if (!meta || typeof meta !== 'object') return undefined;
	const row = meta as { finish_reason?: unknown; finishReason?: unknown };
	const raw = row.finish_reason ?? row.finishReason;
	return typeof raw === 'string' ? raw : undefined;
}

function sharedCategoryLlm(config: ConfigService): Promise<ChatOpenAI> {
	if (!categoryClient) {
		const options = decideLlmOptions(
			new AbortController().signal,
			CATEGORY_MAX_TOKENS,
		);
		delete options.abortSignal;
		categoryClient = createLlm(config, options);
	}
	return categoryClient;
}

/** 一批分类。客户端复用，截断与否交给 parseBatch。 */
async function classifyChunkOnce(
	config: ConfigService,
	chunk: Array<Record<string, unknown>>,
	userText: string,
	parent?: AbortSignal,
): Promise<{ text: string; finish?: string }> {
	const lines = chunkLines(chunk);
	if (!lines || parent?.aborted) return { text: '' };
	const input = `用户原话：${userText}\n\n${lines}`;
	try {
		const timeout = AbortSignal.timeout(CATEGORY_TIMEOUT_MS);
		const signal = parent ? AbortSignal.any([timeout, parent]) : timeout;
		const llm = await sharedCategoryLlm(config);
		const message = await llm.invoke(
			[new SystemMessage(TASK), new HumanMessage(input)],
			{ signal },
		);
		const text = typeof message.content === 'string' ? message.content : '';
		return { text, finish: finishReasonOf(message) };
	} catch {
		return { text: '' };
	}
}

/** 一段内的再发一次由 judgeRange 负责，这里不再把同一批打第二遍。 */
export async function classifyChunk(
	config: ConfigService,
	chunk: Array<Record<string, unknown>>,
	userText: string,
	parent?: AbortSignal,
): Promise<{ text: string; finish?: string }> {
	if (parent?.aborted) return { text: '' };
	return classifyChunkOnce(config, chunk, userText, parent);
}

async function judgeRange(
	items: Array<Record<string, unknown>>,
	from: number,
	to: number,
	userText: string,
	signal: AbortSignal | undefined,
	classify: (
		rows: Array<Record<string, unknown>>,
		userText: string,
	) => Promise<{ text: string; finish?: string }>,
): Promise<{ words: string[]; failed: boolean }> {
	const words: string[] = [];
	let cursor = from;
	let failed = false;
	let stalled = 0;
	let calls = 0;
	while (cursor < to) {
		if (signal?.aborted) return { words, failed: true };
		const sentFrom = cursor;
		const packed = takeSlice(items, cursor, to);
		if (packed.end <= sentFrom) {
			failed = true;
			break;
		}
		if (!chunkLines(packed.rows)) {
			cursor = packed.end;
			stalled = 0;
			continue;
		}
		// 一段最多三次。截断续批再往下走就会按词刷 createLlm。
		if (calls >= 3) {
			failed = true;
			break;
		}
		calls += 1;
		const reply = await classify(packed.rows, userText);
		const allowed = new Set(
			packed.rows
				.map((row) => lineKey(row).toLowerCase())
				.filter((word) => word.length > 0),
		);
		const parsed = parseBatch(reply.text, reply.finish, allowed);
		let next = sentFrom;
		if (parsed.kind === 'done') {
			words.push(...parsed.words);
			next = parsed.done
				? packed.end
				: indexAfter(items, parsed.cursor, cursor, packed.end);
		} else if (parsed.kind === 'cut') {
			words.push(...parsed.kept);
			const at = indexOfLine(items, parsed.cutWord, cursor, packed.end);
			next = at >= sentFrom ? at : sentFrom;
		}
		if (next > sentFrom) {
			stalled = 0;
			cursor = next;
			continue;
		}
		stalled += 1;
		if (stalled > 1) {
			// 同一段再看不懂就整段放弃。逐行跳会把 107 个词打成两百次创建。
			failed = true;
			cursor = packed.end;
			stalled = 0;
		}
	}
	return { words, failed };
}

/** 提案行只从清单原行来，分类器编出来的词面进不了收藏 */
export function bodiesFromHits(
	items: Array<Record<string, unknown>>,
	hits: string[],
): Record<string, unknown>[] {
	const byWord = new Map<string, Record<string, unknown>>();
	for (const row of items) {
		const word = lineKey(row);
		if (!word || byWord.has(word.toLowerCase())) continue;
		byWord.set(word.toLowerCase(), row);
	}
	const seen = new Set<string>();
	const bodies: Record<string, unknown>[] = [];
	for (const raw of hits) {
		const key = raw.trim().toLowerCase();
		const row = key && !seen.has(key) ? byWord.get(key) : undefined;
		if (!row) continue;
		seen.add(key);
		const word = typeof row.word === 'string' ? row.word.trim() : '';
		const zh = typeof row.translationZh === 'string' ? row.translationZh : '';
		bodies.push(
			word
				? {
						word: row.word,
						ipa: typeof row.ipa === 'string' ? row.ipa : '',
						pos: typeof row.pos === 'string' ? row.pos : '',
						segmentation:
							typeof row.segmentation === 'string' ? row.segmentation : '',
						translationZh: zh,
						example: typeof row.example === 'string' ? row.example : '',
					}
				: {
						english: row.english,
						translationZh: zh,
						source: typeof row.source === 'string' ? row.source : '',
						noteZh: typeof row.noteZh === 'string' ? row.noteZh : '',
					},
		);
	}
	return bodies;
}

/**
 * 整段包在一次 propose_add 里。段与段最多 4 路，续批只发生在本段内部。
 * 失败段只计数，已经收下的命中仍然留下。
 */
export async function buildCategoryProposal(
	items: Array<Record<string, unknown>>,
	userText: string,
	classify: (
		chunk: Array<Record<string, unknown>>,
		userText: string,
	) => Promise<{ text: string; finish?: string }>,
	signal?: AbortSignal,
): Promise<{ bodies: Record<string, unknown>[]; failedChunks: number }> {
	const ranges: Array<{ from: number; to: number }> = [];
	let at = 0;
	while (at < items.length) {
		const packed = takeSlice(items, at, items.length);
		if (packed.end <= at) break;
		ranges.push({ from: at, to: packed.end });
		at = packed.end;
	}
	const judged: Array<{ words: string[]; failed: boolean } | undefined> =
		new Array(ranges.length);
	let ticket = 0;
	const worker = async () => {
		while (ticket < ranges.length) {
			if (signal?.aborted) return;
			const index = ticket;
			ticket += 1;
			const range = ranges[index];
			judged[index] = await judgeRange(
				items,
				range.from,
				range.to,
				userText,
				signal,
				classify,
			);
		}
	};
	const width = Math.min(CATEGORY_PARALLEL, ranges.length);
	await Promise.all(Array.from({ length: width }, () => worker()));
	const hits: string[] = [];
	let failedChunks = 0;
	for (let i = 0; i < ranges.length; i += 1) {
		const range = ranges[i];
		const result = judged[i];
		if (!result || result.failed) failedChunks += 1;
		if (!result) continue;
		const allowed = new Set(
			items
				.slice(range.from, range.to)
				.map((row) => lineKey(row).toLowerCase())
				.filter((word) => word.length > 0),
		);
		const matched = result.words.filter((word) =>
			allowed.has(word.trim().toLowerCase()),
		);
		const proposed = result.words.some((word) => word.trim().length > 0);
		// 模型回了「family」这种片段，对不上任何一行。这不是「这一类为空」，不能记成空命中。
		if (!result.failed && proposed && matched.length === 0) failedChunks += 1;
		hits.push(...matched);
	}
	return { bodies: bodiesFromHits(items, hits), failedChunks };
}

async function selfCheckCategoryBatch(): Promise<void> {
	const rows = ['a', 'b', 'c', 'd'].map((word) => ({ word }));
	const allowed = new Set(['a', 'b', 'c', 'd']);
	const cut = parseBatch('{"words":["a","b"]', 'length', allowed);
	if (cut.kind !== 'cut' || cut.cutWord !== 'b' || cut.kept.join() !== 'a') {
		throw new Error('cut should keep a and resume at b');
	}
	const done = parseBatch(
		'{"done":true,"cursor":"d","words":["c"]}',
		'stop',
		allowed,
	);
	if (done.kind !== 'done' || !done.done || done.words.join() !== 'c') {
		throw new Error('closed JSON should finish the slice');
	}
	const walked = parseBatch(
		'{"done":false,"cursor":"a","words":["a"]}',
		'length',
		allowed,
	);
	if (walked.kind !== 'done' || !walked.done) {
		throw new Error('closed JSON must not resume even when done is false');
	}
	const slice = takeSlice(
		Array.from({ length: 3 }, () => ({
			word: 'w',
			translationZh: 'x'.repeat(100),
		})),
		0,
		3,
	);
	if (slice.rows.length < 1 || slice.end <= 0) {
		throw new Error('slice should take at least one row');
	}
	let calls = 0;
	const result = await judgeRange(
		rows,
		0,
		rows.length,
		'动物',
		undefined,
		(chunk) => {
			calls += 1;
			const first = lineKey(chunk[0]);
			if (first === 'a') {
				return Promise.resolve({
					text: '{"words":["a","b"]',
					finish: 'length',
				});
			}
			return Promise.resolve({
				text: '{"done":true,"cursor":"d","words":["b"]}',
				finish: 'stop',
			});
		},
	);
	if (calls !== 2) throw new Error(`expected 2 calls, got ${calls}`);
	if (result.failed) throw new Error('resume should not fail the range');
	if (result.words.join() !== 'a,b') {
		throw new Error(`hits ${result.words.join()}`);
	}
	let wordsOnlyCalls = 0;
	const wordsOnly = await judgeRange(
		rows,
		0,
		rows.length,
		'动物',
		undefined,
		() => {
			wordsOnlyCalls += 1;
			return Promise.resolve({ text: '{"words":["a"]}', finish: 'stop' });
		},
	);
	if (wordsOnlyCalls !== 1) {
		throw new Error(`words-only reply called ${wordsOnlyCalls} times`);
	}
	if (wordsOnly.failed || wordsOnly.words.join() !== 'a') {
		throw new Error('words-only reply should finish the slice');
	}
	let stalledCalls = 0;
	const stalled = await judgeRange(
		rows,
		0,
		rows.length,
		'动物',
		undefined,
		() => {
			stalledCalls += 1;
			return Promise.resolve({ text: '' });
		},
	);
	if (!stalled.failed) throw new Error('stuck cursor should fail the range');
	if (stalledCalls !== 2) {
		throw new Error(`stuck cursor called ${stalledCalls} times`);
	}
}

if (process.env.CATEGORY_BATCH_CHECK === '1') {
	void selfCheckCategoryBatch().then(
		() => {
			console.log('category batch check ok');
		},
		(err: unknown) => {
			console.error(err);
			process.exitCode = 1;
		},
	);
}
