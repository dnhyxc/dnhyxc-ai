/**
 * 每日阅读播放句模型：句界与 speech cadence 共用 buildSentenceOffsetSpans。
 */
import { buildSentenceOffsetSpans, stripMarkdownForTts } from '@/utils/speech';
import { paragraphs } from './body';

export type PlaySentence = {
	/** 全局句下标，等于 onCadenceChunk.sentenceIndex */
	si: number;
	en: string;
	words: { w: string; zh: string }[] | null;
	zh?: string;
};

type GlossItem = { en: string; words: { w: string; zh: string }[] };

export function resolveSentenceZh(input: {
	si: number;
	sentenceZh?: string[] | null;
	alignedHeuristic?: string[];
}): string | undefined {
	const fromExtras = input.sentenceZh?.[input.si]?.trim();
	if (fromExtras) return fromExtras;
	const fromHeuristic = input.alignedHeuristic?.[input.si]?.trim();
	return fromHeuristic || undefined;
}

/** 与 cadence 同坐标系的英文句数 */
export function playSentenceCount(bodyEn: string): number {
	const plain = stripMarkdownForTts(bodyEn);
	if (!plain) return 0;
	return buildSentenceOffsetSpans(plain).length;
}

/** 仅当中文切句数与英文句数全等时配对，避免错位译文。 */
export function alignBodyZhHeuristic(
	bodyZh: string,
	enCount: number,
): string[] | undefined {
	const parts = bodyZh
		.split(/(?<=[。！？；])\s*/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (parts.length !== enCount) return undefined;
	return parts;
}

function norm(text: string): string {
	return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * 选区朗读的切句下标 → 正文全局 si。
 * 用当前选区纯文本的第 selectionSentenceIndex 句，在正文句列表里找包含关系。
 */
export function resolveArticleSiFromSelection(
	sentences: PlaySentence[],
	selectedText: string,
	selectionSentenceIndex: number,
): number | null {
	const plain = stripMarkdownForTts(selectedText) || norm(selectedText);
	if (!plain || !sentences.length) return null;
	const spans = buildSentenceOffsetSpans(plain);
	const span = spans[selectionSentenceIndex];
	if (!span) return null;
	const chunk = norm(plain.slice(span.start, span.end));
	if (!chunk) return null;
	const hit = sentences.find((s) => {
		const en = norm(s.en);
		return en.includes(chunk) || chunk.includes(en);
	});
	return hit?.si ?? null;
}

/**
 * 与 cloudSingleUtterance 路径一致：先 stripMarkdownForTts 再切句。
 * 段界仍按原文空行；gloss 只挂词不定义句界。
 */
export function buildPlaySentences(
	bodyEn: string,
	gloss: GlossItem[] | undefined,
	zhBySi: (si: number) => string | undefined,
): PlaySentence[][] {
	const plain = stripMarkdownForTts(bodyEn);
	if (!plain) return [];

	const spans = buildSentenceOffsetSpans(plain);
	const glossUsed = new Set<number>();
	const sentences: PlaySentence[] = spans.map((span, si) => {
		const en = plain.slice(span.start, span.end);
		const enNorm = norm(en);
		let words: PlaySentence['words'] = null;
		if (gloss?.length && enNorm) {
			const hitAt = gloss.findIndex((g, index) => {
				if (glossUsed.has(index)) return false;
				const gEn = norm(g.en);
				return gEn.length > 0 && enNorm.includes(gEn);
			});
			if (hitAt >= 0) {
				glossUsed.add(hitAt);
				words = gloss[hitAt]!.words;
			}
		}
		return { si, en, words, zh: zhBySi(si) };
	});

	const placed = new Set<number>();
	const blocks = paragraphs(bodyEn)
		.map((part) => {
			const flat = norm(part);
			return sentences.filter((s) => {
				if (placed.has(s.si)) return false;
				if (!flat.includes(norm(s.en))) return false;
				placed.add(s.si);
				return true;
			});
		})
		.filter((block) => block.length > 0);

	const rest = sentences.filter((s) => !placed.has(s.si));
	if (rest.length) {
		if (blocks.length) blocks[blocks.length - 1]!.push(...rest);
		else blocks.push(rest);
	}
	return blocks;
}
