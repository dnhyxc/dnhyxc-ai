import type { ReactNode } from 'react';
import type { EnglishDailyReadingItem } from '@/service';

export function sourceList(
	row: EnglishDailyReadingItem,
): { title: string; url: string }[] {
	if (row.extras?.sources?.length) return row.extras.sources;
	if (!row.sourceUrl) return [];
	return [{ title: row.sourceTitle || row.sourceUrl, url: row.sourceUrl }];
}

/** 长链接不断开时会整段掉到下一行，两端对齐就把上一行的词距拉开。 */
export function renderText(text: string): ReactNode {
	const re = /https?:\/\/\S+/gi;
	const out: ReactNode[] = [];
	let last = 0;
	let n = 0;
	for (const match of text.matchAll(re)) {
		const at = match.index ?? 0;
		if (at > last) out.push(text.slice(last, at));
		out.push(
			<span key={n} className="break-all">
				{match[0]}
			</span>,
		);
		n += 1;
		last = at + match[0].length;
	}
	if (!out.length) return text;
	if (last < text.length) out.push(text.slice(last));
	return out;
}

export function paragraphs(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map((part) => part.replace(/\s*\n\s*/g, ' ').trim())
		.filter(Boolean);
}

type GlossItem = { en: string; words: { w: string; zh: string }[] };
type ShownSentence = { en: string; words: { w: string; zh: string }[] | null };

function flatParagraph(text: string): string {
	return text.replace(/\s*\n\s*/g, ' ').trim();
}

/**
 * 正文分段是展示真相。wordGloss 对得上的句子挂逐词释义，
 * 对不上的原文仍留在原段，避免释义缺句时英文少一段。
 */
export function glossParagraphs(
	bodyEn: string,
	gloss: GlossItem[],
): ShownSentence[][] {
	const used = new Set<number>();
	return paragraphs(bodyEn)
		.map((part) => {
			const raw = flatParagraph(part);
			const rawLower = raw.toLowerCase();
			const hits: { item: GlossItem; at: number }[] = [];
			gloss.forEach((item, index) => {
				if (used.has(index)) return;
				const en = item.en.replace(/\s+/g, ' ').trim();
				if (!en) return;
				const at = rawLower.indexOf(en.toLowerCase());
				if (at < 0) return;
				used.add(index);
				hits.push({ item: { en, words: item.words }, at });
			});
			hits.sort((a, b) => a.at - b.at);
			const sentences: ShownSentence[] = [];
			let cursor = 0;
			for (const hit of hits) {
				const en = hit.item.en;
				const at = rawLower.indexOf(en.toLowerCase(), cursor);
				if (at < 0) continue;
				const gap = raw.slice(cursor, at).trim();
				if (gap) sentences.push({ en: gap, words: null });
				sentences.push({
					en: raw.slice(at, at + en.length),
					words: hit.item.words,
				});
				cursor = at + en.length;
			}
			const tail = raw.slice(cursor).trim();
			if (tail) sentences.push({ en: tail, words: null });
			if (!sentences.length && raw) sentences.push({ en: raw, words: null });
			return sentences;
		})
		.filter((block) => block.length > 0);
}
