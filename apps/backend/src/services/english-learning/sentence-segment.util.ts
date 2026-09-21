/**
 * 经典句分词：与前端 `practice/utils/segmentSentence.ts` 同源正则，
 * 保证整集预热 cache_key 与练习开局一致。
 */
export type SentenceWordToken = {
	raw: string;
	expect: string;
	after?: string;
};

/** 从英文原句提取词槽（保留原大小写；比对用小写） */
export function segmentEnglishSentence(english: string): SentenceWordToken[] {
	const re = /([\p{L}\p{N}'']+)([^\p{L}\p{N}\s'']*)/gu;
	const out: SentenceWordToken[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(english)) !== null) {
		const raw = m[1]!;
		const after = (m[2] ?? '').trim();
		out.push({
			raw,
			expect: raw.toLowerCase().replace(/['']/g, "'"),
			...(after ? { after } : {}),
		});
	}
	return out;
}

/** 仅取 raw 词序列，供标注 API / cache_key */
export function segmentEnglishSentenceWords(english: string): string[] {
	return segmentEnglishSentence(english).map((t) => t.raw);
}
