/**
 * 听书/听当前：把节/选区 plain 切成「合成单元」（多句打包），供按段 TTS + 逐句高亮。
 * ponytail: 不盲信 \n——网文常一句一 <p>；也不整节一次（易超 Edge/讯飞 8KB 回退逐句）。
 */
import { buildSentenceOffsetSpans, stripMarkdownForTts } from '@/utils/speech';

export type ParagraphUnit = {
	/** 段在 plain 内 [start, end) */
	start: number;
	end: number;
	/** 覆盖的全局句下标 [siStart, siEnd) */
	siStart: number;
	siEnd: number;
};

type SentenceSpan = { start: number; end: number };

/** 软目标：凑够约这么多字再在段落边界切开 */
const SPEAK_TARGET_CHARS = 420;
/** 硬上限：略低于 Edge/讯飞 8000 字节 */
const SPEAK_MAX_BYTES = 7500;

function utf8Bytes(text: string): number {
	return new TextEncoder().encode(text).length;
}

/** 按换行切出 plain 内软段落 [start, end) */
function splitPlainParagraphSpans(
	plain: string,
): Array<{ start: number; end: number }> {
	const spans: Array<{ start: number; end: number }> = [];
	const re = /\n+/gu;
	let last = 0;
	let m = re.exec(plain);
	while (m !== null) {
		if (m.index > last) spans.push({ start: last, end: m.index });
		last = m.index + m[0].length;
		m = re.exec(plain);
	}
	if (last < plain.length) spans.push({ start: last, end: plain.length });
	return spans.filter((s) => plain.slice(s.start, s.end).trim().length > 0);
}

function assignSentencesToParagraphs(
	paraSpans: Array<{ start: number; end: number }>,
	sentences: SentenceSpan[],
): ParagraphUnit[] {
	if (paraSpans.length === 0 || sentences.length === 0) return [];

	const units: ParagraphUnit[] = paraSpans.map((p) => ({
		start: p.start,
		end: p.end,
		siStart: -1,
		siEnd: -1,
	}));

	for (let si = 0; si < sentences.length; si += 1) {
		const sent = sentences[si]!;
		const mid = (sent.start + sent.end) / 2;
		let pi = paraSpans.findIndex((p) => mid >= p.start && mid < p.end);
		if (pi < 0) {
			pi = paraSpans.findIndex((p) => sent.start < p.end && sent.end > p.start);
		}
		if (pi < 0) pi = units.length - 1;
		const unit = units[pi]!;
		if (unit.siStart < 0) unit.siStart = si;
		unit.siEnd = si + 1;
	}

	return units.filter((u) => u.siStart >= 0 && u.siEnd > u.siStart);
}

/**
 * 按句打包合成单元：优先在软段落下刀，凑够 targetChars；永不超 maxBytes。
 */
function packSpeakUnits(
	plain: string,
	sentences: SentenceSpan[],
	softUnits: ParagraphUnit[],
	targetChars: number,
	maxBytes: number,
): ParagraphUnit[] {
	if (sentences.length === 0) return [];

	const softEndSi = new Set(softUnits.map((u) => u.siEnd));
	const out: ParagraphUnit[] = [];
	let startSi = 0;

	while (startSi < sentences.length) {
		let endSi = startSi;
		while (endSi < sentences.length) {
			const nextEnd = endSi + 1;
			const slice = plain.slice(
				sentences[startSi]!.start,
				sentences[nextEnd - 1]!.end,
			);
			if (utf8Bytes(slice) > maxBytes) break;
			endSi = nextEnd;
			if (slice.length >= targetChars && softEndSi.has(endSi)) break;
			if (slice.length >= targetChars * 2) break;
		}
		if (endSi <= startSi) endSi = startSi + 1;

		out.push({
			start: sentences[startSi]!.start,
			end: sentences[endSi - 1]!.end,
			siStart: startSi,
			siEnd: endSi,
		});
		startSi = endSi;
	}

	return out;
}

/**
 * 由 plain + 句表构建合成单元（多句一段，受字节上限约束）。
 */
export function buildParagraphUnits(
	plain: string,
	sentences?: SentenceSpan[],
): ParagraphUnit[] {
	const trimmed = plain.trim();
	if (!trimmed) return [];
	const spans = sentences ?? buildSentenceOffsetSpans(trimmed);
	if (spans.length === 0) return [];

	const paraSpans = splitPlainParagraphSpans(trimmed);
	const softUnits =
		paraSpans.length <= 1
			? [
					{
						start: 0,
						end: trimmed.length,
						siStart: 0,
						siEnd: spans.length,
					},
				]
			: assignSentencesToParagraphs(paraSpans, spans);

	const soft =
		softUnits.length > 0
			? softUnits
			: [
					{
						start: 0,
						end: trimmed.length,
						siStart: 0,
						siEnd: spans.length,
					},
				];

	return packSpeakUnits(
		trimmed,
		spans,
		soft,
		SPEAK_TARGET_CHARS,
		SPEAK_MAX_BYTES,
	);
}

export function paragraphIndexForSentence(
	units: ParagraphUnit[],
	sentenceIndex: number,
): number {
	if (units.length === 0) return -1;
	for (let i = 0; i < units.length; i += 1) {
		const u = units[i]!;
		if (sentenceIndex >= u.siStart && sentenceIndex < u.siEnd) return i;
	}
	if (sentenceIndex < units[0]!.siStart) return 0;
	return units.length - 1;
}

/** 从句 si 截到该合成单元末的 TTS 文本 */
export function sliceParagraphFromSentence(
	plain: string,
	unit: ParagraphUnit,
	sentences: SentenceSpan[],
	si: number,
): string {
	const clamped = Math.min(unit.siEnd - 1, Math.max(unit.siStart, si));
	const sent = sentences[clamped];
	if (!sent) return '';
	return stripMarkdownForTts(plain.slice(sent.start, unit.end)).trim();
}
