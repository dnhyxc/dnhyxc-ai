import type { ConfigService } from '@nestjs/config';
import { type DecideInput, decide } from '../../../../utils/glm-decide';
import {
	ENGLISH_CLASSIC_QUOTES_GENERATION_MAX,
	ENGLISH_VOCAB_GENERATION_MAX,
} from '../../../english-learning/dto/generate-vocabulary.dto';

/** 只有 Agent 生成用。列表按总数取尽，生成条数仍是另一套数字。 */
export const AGENT_PACK_COUNT = 100;

export type PackSide = { topic: string; count: number };

/** 没写词数或条数时用 100。主题空则该侧不生成。 */
export type PackAsk = {
	vocab?: PackSide;
	classic?: PackSide;
};

const FILLER = /^(?:一些|这些|那些|几个|一点|若干|的|全部|所有|列表)$/;

function cleanTopic(raw: string): string {
	let t = raw.trim();
	t = t.replace(/[「『"“'']|[」』"”'']/g, '').trim();
	t = t
		.replace(
			/^(?:请|帮我|给我|帮忙|我想要|我想|我要|我还是|还是|仍然|依然|继续|重新|再来|再|又|生成|来|要|按|把|一下|一遍)+/,
			'',
		)
		.trim();
	t = t.replace(/^(?:学习)?主题\s*(?:是|用|为|改成|设为)\s*[:：]?/, '').trim();
	t = t.replace(/^(?:\d+|[零一二两三四五六七八九十]+)\s*个?\s*句/, '').trim();
	t = t
		.replace(
			/(?:\d+|[零一二两三四五六七八九十]+)\s*个\s*(?:单词|词汇|词书|词)[\s\S]*$/,
			'',
		)
		.trim();
	t = t.replace(/\d+\s*(?:条|个)[\s\S]*$/, '').trim();
	t = t.replace(/[、，,。；;：:]+$/g, '').trim();
	t = t
		.replace(
			/(?:的)?(?:单词资料|词书|单词|词汇|经典语句|经典句|语句)(?:和|与|以及)?(?:单词资料|词书|单词|词汇|经典语句|经典句|语句)?$/,
			'',
		)
		.trim();
	t = t.replace(/(?:相关|有关)的?$/, '').trim();
	t = t.replace(/的$/, '').trim();
	if (!t || FILLER.test(t) || t.length > 40) return '';
	return t;
}

const CN_DIGIT: Record<string, number> = {
	零: 0,
	一: 1,
	二: 2,
	两: 2,
	三: 3,
	四: 4,
	五: 5,
	六: 6,
	七: 7,
	八: 8,
	九: 9,
};

/** 十、十二、二十。百以上不解析，交给默认 100。 */
function cnToInt(raw: string): number | undefined {
	const s = raw.trim();
	if (s === '十') return 10;
	const ten = s.match(/^([一二两三四五六七八九])?十([一二两三四五六七八九])?$/);
	if (ten) {
		const tens = ten[1] ? CN_DIGIT[ten[1]] : 1;
		const ones = ten[2] ? CN_DIGIT[ten[2]] : 0;
		return tens * 10 + ones;
	}
	if (s.length === 1 && CN_DIGIT[s] != null) return CN_DIGIT[s];
	return undefined;
}

function clampCount(n: number, max: number): number {
	if (!Number.isFinite(n) || n < 1) return AGENT_PACK_COUNT;
	return Math.min(max, Math.floor(n));
}

function firstTopic(text: string, patterns: RegExp[]): string {
	for (const re of patterns) {
		const m = text.match(re);
		const topic = m?.[1] ? cleanTopic(m[1]) : '';
		if (topic) return topic;
	}
	return '';
}

const VOCAB_TOPIC = [
	/(?:单词资料|词书|单词|词汇)\s*(?:主题)?\s*(?:是|用|为|改成|设为)\s*[:：]?\s*([^，,。；;\n]{1,40})/,
	/关于\s*([^，,。；;\n的]{1,24})\s*的?\s*(?:单词资料|词书|单词|词汇|词)/,
	/([\u4e00-\u9fa5A-Za-z0-9]{1,24})相关的?\s*(?:单词资料|词书|单词|词汇)/,
	/([\u4e00-\u9fa5A-Za-z0-9]{1,24})的(?:单词资料|词书|单词|词汇)/,
	/([\u4e00-\u9fa5]{1,16})[」』"”']?\s*[、，,]?\s*(?:相关|有关)?的?\s*(?:\d+|[零一二两三四五六七八九十]+)\s*个\s*(?:单词|词汇|词)/,
];

const CLASSIC_TOPIC = [
	/(?:经典语句|经典句|语句)\s*(?:主题)?\s*(?:是|用|为|改成|设为)\s*([^，,。；;\n]{1,40})/,
	/关于\s*([^，,。；;\n的]{1,24})\s*的?\s*(?:经典语句|经典句|语句)/,
	/([\u4e00-\u9fa5A-Za-z0-9]{1,24})相关的?\s*(?:经典语句|经典句|语句)/,
	/([\u4e00-\u9fa5A-Za-z0-9]{1,24})的(?:经典语句|经典句|语句)/,
	/([\u4e00-\u9fa5]{1,16})[」』"”']?\s*[、，,]?\s*(?:相关|有关)?的?\s*(?:\d+|[零一二两三四五六七八九十]+)\s*(?:条|句)/,
];

const SHARED_TOPIC = [
	/主题\s*(?:是|用|为|改成|设为)?\s*[:：]?\s*[「『"“']\s*([^」』"”']{1,40})/,
	/主题\s*(?:是|用|为|改成|设为)\s*[:：]?\s*([^，,。；;\n]{1,40})/,
	/主题\s*[:：]\s*([^，,。；;\n]{1,40})/,
];

function countNear(
	text: string,
	kind: 'vocab' | 'classic',
): number | undefined {
	if (kind === 'vocab') {
		const words = text.match(/(\d+)\s*个\s*(?:单词|词汇|词)/);
		if (words?.[1]) return Number(words[1]);
		const cn = text.match(
			/([零一二两三四五六七八九十]+)\s*个\s*(?:单词|词汇|词)/,
		);
		const cnN = cn?.[1] ? cnToInt(cn[1]) : undefined;
		if (cnN) return cnN;
	}
	if (kind === 'classic') {
		const sentences = text.match(/(\d+)\s*个?\s*句/);
		if (sentences?.[1]) return Number(sentences[1]);
		const cnSentence = text.match(/([零一二两三四五六七八九十]+)\s*个?\s*句/);
		const cnSentenceN = cnSentence?.[1] ? cnToInt(cnSentence[1]) : undefined;
		if (cnSentenceN) return cnSentenceN;
		const cn = text.match(/([零一二两三四五六七八九十]+)\s*条/);
		const cnN = cn?.[1] ? cnToInt(cn[1]) : undefined;
		if (cnN) return cnN;
	}
	const re =
		kind === 'vocab'
			? /(?:单词资料|词书|单词|词汇)[^，,。\n]{0,16}?(\d+)\s*(?:条|个|词)/
			: /(?:经典语句|经典句|语句)[^，,。\n]{0,16}?(\d+)\s*(?:条|个)/;
	const after = text.match(re);
	if (after?.[1]) return Number(after[1]);
	const before =
		kind === 'vocab'
			? /(\d+)\s*(?:个|条)?\s*(?:单词资料|词书|单词|词汇)/
			: /(\d+)\s*(?:条|句)\s*(?:经典语句|经典句|语句|句子)/;
	const head = text.match(before);
	if (head?.[1]) return Number(head[1]);
	return undefined;
}

/**
 * 只读用户原话。不读模型填的 topic 或 count。
 * 只提到单词就没有 classic；两侧都提到且只有一个主题时共用。
 */
function wants(text: string): { vocab: boolean; classic: boolean } {
	return {
		vocab:
			/单词资料|词书|单词|词汇|\d+\s*个\s*词|[零一二两三四五六七八九十]+\s*个\s*(?:单词|词)/.test(
				text,
			),
		classic: /经典语句|经典句|语句/.test(text),
	};
}

/** 紧挨「个 / 条 / 句 / 词」的数量。年份这种孤立数字不算。 */
function countSignals(text: string): number[] {
	const out: number[] = [];
	const re = /(?:(\d+)|([零一二两三四五六七八九十]+))\s*(?:个|条|句|词)/g;
	for (const match of text.matchAll(re)) {
		const n = match[1] ? Number(match[1]) : cnToInt(match[2] ?? '');
		if (n != null && n >= 1) out.push(n);
	}
	return out;
}

/**
 * 正则结果能否直接用。
 * 要生成但该侧没有主题，或数量对不上原话，才打 flash。
 */
export function askTrusted(userText: string, ask: PackAsk): boolean {
	const text = userText.trim();
	const want = wants(text);
	if (!want.vocab && !want.classic) return true;
	if ((want.vocab && !ask.vocab) || (want.classic && !ask.classic))
		return false;
	const signals = countSignals(text);
	for (const side of [ask.vocab, ask.classic]) {
		if (!side) continue;
		if (!side.topic || !text.includes(side.topic)) return false;
		if (signals.length > 0 && !signals.includes(side.count)) return false;
	}
	return true;
}

function readCount(raw: unknown): number | undefined {
	if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
	if (typeof raw !== 'string' || !raw.trim()) return undefined;
	const n = Number(raw);
	if (Number.isFinite(n)) return n;
	return cnToInt(raw.trim());
}

function looseSide(raw: unknown): PackSide | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
	const topic = (raw as { topic?: unknown }).topic;
	if (typeof topic !== 'string' || !topic.trim()) return undefined;
	const n = readCount((raw as { count?: unknown }).count);
	return {
		topic: topic.trim(),
		count: n != null && n >= 1 ? Math.floor(n) : AGENT_PACK_COUNT,
	};
}

function parsePackSlotJson(raw: unknown): PackAsk | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const body = raw as { vocab?: unknown; classic?: unknown };
	for (const side of [body.vocab, body.classic]) {
		if (side == null) continue;
		if (typeof side !== 'object' || Array.isArray(side)) return null;
	}
	const ask: PackAsk = {};
	const vocab = looseSide(body.vocab);
	const classic = looseSide(body.classic);
	if (vocab) ask.vocab = vocab;
	if (classic) ask.classic = classic;
	return ask;
}

function vetted(
	text: string,
	side: PackSide | undefined,
	max: number,
): PackSide | undefined {
	if (!side) return undefined;
	const topic = cleanTopic(side.topic);
	if (!topic || !text.includes(topic)) return undefined;
	const count = countSignals(text).includes(side.count)
		? clampCount(side.count, max)
		: AGENT_PACK_COUNT;
	return { topic, count };
}

/** 丢掉不在原话里的主题。数量对不上则改成 100。 */
export function acceptSlots(userText: string, raw: unknown): PackAsk {
	const parsed = parsePackSlotJson(raw);
	if (!parsed) return {};
	const text = userText.trim();
	const ask: PackAsk = {};
	const vocab = vetted(text, parsed.vocab, ENGLISH_VOCAB_GENERATION_MAX);
	const classic = vetted(
		text,
		parsed.classic,
		ENGLISH_CLASSIC_QUOTES_GENERATION_MAX,
	);
	if (vocab) ask.vocab = vocab;
	if (classic) ask.classic = classic;
	return ask;
}

const PACK_TASK =
	'从用户原话抽出单词和语句的生成槽位，只返回 JSON，不要解释。' +
	'形状 {"vocab":{"topic":"","count":null},"classic":{"topic":"","count":null}}。' +
	'没要求的一侧设为 null。topic 必须是原话里连续出现的主题，不要编造，不要把生成、还是、一些算进主题。' +
	'count 只填原话写明的数字；没写数量就填 null，不要猜。';

/** 正则不可信时的一次 flash。失败返回 null，调用方退回正则。 */
export async function extractPackSlots(
	config: ConfigService,
	userText: string,
	complete?: DecideInput<PackAsk>['complete'],
): Promise<PackAsk | null> {
	return decide(config, {
		task: PACK_TASK,
		input: userText,
		parse: parsePackSlotJson,
		accept: (value, input) => acceptSlots(input, value),
		complete,
	});
}

/**
 * 先信正则。不可信才问 flash。flash 超时或不是 JSON 时退回正则。
 * flash 给出了 JSON 但验收后两侧都空，就不再用正则。
 */
export async function resolvePackAsk(
	config: ConfigService,
	userText: string,
	complete?: DecideInput<PackAsk>['complete'],
): Promise<PackAsk> {
	const ruled = parsePackAsk(userText);
	if (askTrusted(userText, ruled)) return ruled;
	const flashed = await extractPackSlots(config, userText, complete);
	if (!flashed) return ruled;
	return flashed;
}

export function parsePackAsk(userText: string): PackAsk {
	const text = userText.trim();
	const want = wants(text);
	const wantVocab = want.vocab;
	const wantClassic = want.classic;
	if (!wantVocab && !wantClassic) return {};

	let vocabTopic = wantVocab ? firstTopic(text, VOCAB_TOPIC) : '';
	let classicTopic = wantClassic ? firstTopic(text, CLASSIC_TOPIC) : '';
	const shared = firstTopic(text, SHARED_TOPIC);
	if (shared) {
		if (wantVocab && !vocabTopic) vocabTopic = shared;
		if (wantClassic && !classicTopic) classicTopic = shared;
	}
	if (wantVocab && wantClassic) {
		if (vocabTopic && !classicTopic) classicTopic = vocabTopic;
		if (classicTopic && !vocabTopic) vocabTopic = classicTopic;
	}

	const loose = text.match(/(\d+)\s*(?:条|句|个)/);
	const looseN = loose?.[1] ? Number(loose[1]) : undefined;
	const ask: PackAsk = {};
	if (vocabTopic) {
		const n = countNear(text, 'vocab') ?? (wantClassic ? undefined : looseN);
		ask.vocab = {
			topic: vocabTopic,
			count: clampCount(n ?? AGENT_PACK_COUNT, ENGLISH_VOCAB_GENERATION_MAX),
		};
	}
	if (classicTopic) {
		const n = countNear(text, 'classic') ?? (wantVocab ? undefined : looseN);
		ask.classic = {
			topic: classicTopic,
			count: clampCount(
				n ?? AGENT_PACK_COUNT,
				ENGLISH_CLASSIC_QUOTES_GENERATION_MAX,
			),
		};
	}
	return ask;
}
