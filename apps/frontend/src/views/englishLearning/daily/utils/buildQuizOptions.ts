import type { DailyQuizOption, DailyVocabCard } from '../types';

export type BuildQuizOptionsParams = {
	/** 本轮已用作干扰项的中文释义，避免同一选项在多题中反复出现 */
	usedDistractorLabels?: ReadonlySet<string>;
};

function shuffle<T>(arr: T[]): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

function normalizePos(pos: string): string {
	return (
		pos
			.trim()
			.toLowerCase()
			.replace(/\.$/, '')
			.split(/[/,、]/)[0]
			?.trim() ?? ''
	);
}

function sharedHanCount(a: string, b: string): number {
	if (!a || !b) return 0;
	const setB = new Set([...b]);
	let n = 0;
	for (const ch of a) {
		if (setB.has(ch)) n += 1;
	}
	return n;
}

/** 干扰项迷惑度：同词性、释义长度接近、与答案有少量汉字重叠更优；已用过的大幅降权 */
function scoreDistractor(
	candidate: DailyVocabCard,
	card: DailyVocabCard,
	answerLen: number,
	used: ReadonlySet<string>,
): number {
	const label = candidate.translationZh.trim();
	let score = 0;

	if (used.has(label)) score -= 200;

	const cardPos = normalizePos(card.pos);
	const candPos = normalizePos(candidate.pos);
	if (cardPos && candPos && cardPos === candPos) score += 5;

	const len = label.length;
	const ratio = len / Math.max(answerLen, 1);
	if (ratio >= 0.45 && ratio <= 2.2) score += 4;
	else if (ratio > 3.5) score -= 3;

	score += Math.min(sharedHanCount(label, card.translationZh.trim()), 2);

	score += Math.random();
	return score;
}

const FALLBACK_LABELS = [
	'学习',
	'城市',
	'电脑',
	'天气',
	'音乐',
	'旅行',
	'家庭',
	'工作',
	'时间',
	'朋友',
	'问题',
	'方法',
];

/**
 * 构建四选一：优先从本轮其它词中选「更像真答案」的干扰项，并尽量不在多题中重复同一释义。
 */
export function buildQuizOptions(
	card: DailyVocabCard,
	pool: DailyVocabCard[],
	options?: BuildQuizOptionsParams,
): DailyQuizOption[] {
	const used = options?.usedDistractorLabels ?? new Set<string>();
	const answer = card.translationZh.trim();

	const candidates = pool.filter(
		(w) =>
			w.key !== card.key &&
			w.translationZh.trim() &&
			w.translationZh.trim() !== answer,
	);

	const scored = candidates.map((w) => ({
		w,
		score: scoreDistractor(w, card, answer.length, used),
	}));
	scored.sort((a, b) => b.score - a.score);

	const picked: string[] = [];
	const seen = new Set<string>();
	for (const { w } of scored) {
		const label = w.translationZh.trim();
		if (seen.has(label)) continue;
		seen.add(label);
		picked.push(label);
		if (picked.length >= 3) break;
	}

	for (const label of shuffle(FALLBACK_LABELS)) {
		if (picked.length >= 3) break;
		if (label === answer || picked.includes(label) || used.has(label)) continue;
		picked.push(label);
	}
	for (const label of shuffle(FALLBACK_LABELS)) {
		if (picked.length >= 3) break;
		if (label === answer || picked.includes(label)) continue;
		picked.push(label);
	}

	const quizOptions: DailyQuizOption[] = [
		{ id: 'correct', label: answer, correct: true },
		...picked.slice(0, 3).map((label, i) => ({
			id: `d${i}`,
			label,
			correct: false,
		})),
	];
	return shuffle(quizOptions);
}
