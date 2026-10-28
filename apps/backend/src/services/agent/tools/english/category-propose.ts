import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { ConfigService } from '@nestjs/config';
import {
	type CreateLlmOptions,
	createLlm,
	GLM_THINKING_DISABLED_KWARGS,
} from '../../../../utils/create-llm';
import { DECIDE_MODEL_NAME } from '../../../../utils/glm-decide';

/** 一批大约 80 行，词面列表才放得进加长后的 Flash 上限 */
export const CATEGORY_CHUNK = 80;
/** 不沿用 decide() 的 2 秒。80 个词面需要更长的一次往返 */
const CATEGORY_TIMEOUT_MS = 8_000;
/** 不沿用 decide() 的 400 token，避免命中词被截断 */
const CATEGORY_MAX_TOKENS = 1_500;
/**
 * ponytail: 最多 4 路同时判。几千条词库串行会把确认条拖到超时。
 * 天花板是供应商并发；再慢就改成按 offset 分批落提案，而不是加大这一路。
 */
const CATEGORY_PARALLEL = 4;

/** null 表示这一批超时或无法解析，不能和空数组混成「没有命中」 */
export type ChunkHit = { words: string[] } | null;

const TASK =
	'你只做筛选。用户原话描述要哪一类词。下面每行是「词面 | 释义」。只挑出符合原话的词面，不要编造不在这批里的词。只返回 JSON：{"words":["word"]}。没有符合的返回 {"words":[]}。';

function chunkLines(chunk: Array<Record<string, unknown>>): string {
	return chunk
		.map((row) => {
			const word = typeof row.word === 'string' ? row.word.trim() : '';
			if (!word) return '';
			const zh =
				typeof row.translationZh === 'string' ? row.translationZh.trim() : '';
			return `${word} | ${zh}`;
		})
		.filter((line) => line.length > 0)
		.join('\n');
}

function parseWords(text: string): ChunkHit {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return null;
	}
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const words = (raw as { words?: unknown }).words;
	if (!Array.isArray(words) || words.some((word) => typeof word !== 'string')) {
		return null;
	}
	return { words };
}

/** 同一批最多两次。空词数组是「没有命中」，只有 null 才再判一次。 */
export async function retryChunkHit(
	run: () => Promise<ChunkHit>,
): Promise<ChunkHit> {
	const first = await run();
	if (first) return first;
	return run();
}

/** 一批 Flash。超时、非 JSON、形状不对返回 null。 */
async function classifyChunkOnce(
	config: ConfigService,
	chunk: Array<Record<string, unknown>>,
	userText: string,
): Promise<ChunkHit> {
	const lines = chunkLines(chunk);
	if (!lines) return { words: [] };
	const input = `用户原话：${userText}\n\n${lines}`;
	try {
		const signal = AbortSignal.timeout(CATEGORY_TIMEOUT_MS);
		const options: CreateLlmOptions = {
			preset: 'decide',
			modelName: DECIDE_MODEL_NAME,
			streaming: false,
			temperature: 0,
			defaultTemperature: 0,
			maxTokens: CATEGORY_MAX_TOKENS,
			modelKwargs: {
				...GLM_THINKING_DISABLED_KWARGS,
				response_format: { type: 'json_object' },
			},
			abortSignal: signal,
		};
		const llm = await createLlm(config, options);
		const message = await llm.invoke(
			[new SystemMessage(TASK), new HumanMessage(input)],
			{ signal },
		);
		const text = typeof message.content === 'string' ? message.content : '';
		if (!text.trim()) return null;
		return parseWords(text);
	} catch {
		return null;
	}
}

/** 失败批再判一次，仍包在同一次 propose_add 里，不增加图步。 */
export async function classifyChunk(
	config: ConfigService,
	chunk: Array<Record<string, unknown>>,
	userText: string,
): Promise<ChunkHit> {
	return retryChunkHit(() => classifyChunkOnce(config, chunk, userText));
}

/** 提案行只从清单原行来，分类器编出来的词面进不了收藏 */
export function bodiesFromHits(
	items: Array<Record<string, unknown>>,
	hits: string[],
): Record<string, unknown>[] {
	const byWord = new Map<string, Record<string, unknown>>();
	for (const row of items) {
		const word = typeof row.word === 'string' ? row.word.trim() : '';
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
		bodies.push({
			word: row.word,
			ipa: typeof row.ipa === 'string' ? row.ipa : '',
			pos: typeof row.pos === 'string' ? row.pos : '',
			segmentation:
				typeof row.segmentation === 'string' ? row.segmentation : '',
			translationZh:
				typeof row.translationZh === 'string' ? row.translationZh : '',
			example: typeof row.example === 'string' ? row.example : '',
		});
	}
	return bodies;
}

/**
 * 整段包在一次 propose_add 里。分批不增加图步。
 * 失败批只计数，不当作这一批没有相关词。
 */
export async function buildCategoryProposal(
	items: Array<Record<string, unknown>>,
	userText: string,
	classify: (
		chunk: Array<Record<string, unknown>>,
		userText: string,
	) => Promise<ChunkHit>,
): Promise<{ bodies: Record<string, unknown>[]; failedChunks: number }> {
	const chunks: Array<Record<string, unknown>>[] = [];
	for (let i = 0; i < items.length; i += CATEGORY_CHUNK) {
		chunks.push(items.slice(i, i + CATEGORY_CHUNK));
	}
	const judged: ChunkHit[] = new Array(chunks.length);
	let cursor = 0;
	const worker = async () => {
		while (cursor < chunks.length) {
			const index = cursor;
			cursor += 1;
			judged[index] = await classify(chunks[index], userText);
		}
	};
	const width = Math.min(CATEGORY_PARALLEL, chunks.length);
	await Promise.all(Array.from({ length: width }, () => worker()));
	const hits: string[] = [];
	let failedChunks = 0;
	for (let i = 0; i < chunks.length; i += 1) {
		const chunk = chunks[i];
		const result = judged[i];
		if (!result) {
			failedChunks += 1;
			continue;
		}
		const allowed = new Set(
			chunk
				.map((row) =>
					typeof row.word === 'string' ? row.word.trim().toLowerCase() : '',
				)
				.filter((word) => word.length > 0),
		);
		hits.push(
			...result.words.filter((word) => allowed.has(word.trim().toLowerCase())),
		);
	}
	return { bodies: bodiesFromHits(items, hits), failedChunks };
}
