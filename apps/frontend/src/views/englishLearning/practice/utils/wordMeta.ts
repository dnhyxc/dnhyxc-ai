/**
 * 句内词元数据展示：词性色调 / 缩写映射（数据来自 annotate API，不再写死词表）
 */
import { ACCENT_COLORS, accentBadgeStyle } from '@/hooks/theme';

export type SentenceWordMeta = {
	posZh: string;
	ipa: string;
	meaningZh: string;
};

/** 词性徽章色调（与 ACCENT_COLORS 下标一一对应） */
export type PosTone =
	| 'article'
	| 'noun'
	| 'verb'
	| 'aux'
	| 'adj'
	| 'adv'
	| 'prep'
	| 'pron'
	| 'conj'
	| 'other';

const POS_TONE: Record<string, PosTone> = {
	冠词: 'article',
	限定词: 'article',
	名词: 'noun',
	动词: 'verb',
	助动词: 'aux',
	系动词: 'aux',
	形容词: 'adj',
	副词: 'adv',
	介词: 'prep',
	代词: 'pron',
	连词: 'conj',
};

/** 顺序对齐 ACCENT_COLORS，改主题色板即同步 */
const POS_TONES: readonly PosTone[] = [
	'article',
	'noun',
	'verb',
	'aux',
	'adj',
	'adv',
	'prep',
	'pron',
	'conj',
	'other',
];

export function posTone(posZh: string): PosTone {
	const direct = POS_TONE[posZh];
	if (direct) return direct;
	// 名词/动词 → 取首段色调
	const head = posZh.split('/')[0]?.trim() ?? '';
	if (head && POS_TONE[head]) return POS_TONE[head]!;
	if (posZh.endsWith('短语')) {
		return POS_TONE[posZh.slice(0, -2)] ?? 'other';
	}
	return 'other';
}

/** 词性徽章样式：直接取主题 ACCENT_COLORS + accentBadgeStyle */
export function posToneStyle(tone: PosTone): {
	backgroundColor: string;
	color: string;
} {
	const i = POS_TONES.indexOf(tone);
	const item =
		ACCENT_COLORS[i >= 0 ? i : ACCENT_COLORS.length - 1] ?? ACCENT_COLORS[0]!;
	return accentBadgeStyle(item.hex);
}

const POS_ZH: Record<string, string> = {
	n: '名词',
	noun: '名词',
	v: '动词',
	verb: '动词',
	adj: '形容词',
	adjective: '形容词',
	adv: '副词',
	adverb: '副词',
	prep: '介词',
	preposition: '介词',
	conj: '连词',
	conjunction: '连词',
	pron: '代词',
	pronoun: '代词',
	det: '限定词',
	art: '冠词',
	article: '冠词',
	aux: '助动词',
	num: '数词',
	int: '感叹词',
	interj: '感叹词',
	phr: '短语',
	phrase: '短语',
};

function posParts(pos: string): string[] {
	return pos
		.trim()
		.toLowerCase()
		.split(/[./]+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * 短语 IPA 按空格拆到各词。段数与词数不一致则返回 null（整段挂在短语上，不强拆）。
 */
export function splitPhraseIpa(
	ipa: string,
	wordCount: number,
): string[] | null {
	if (wordCount <= 1) return null;
	const inner = ipa.trim().replace(/\//g, ' ').trim();
	if (!inner) return null;
	const parts = inner.split(/\s+/).filter(Boolean);
	if (parts.length !== wordCount) return null;
	return parts;
}

/**
 * 英文词性缩写 → 中文。
 * - 单词性走表
 * - phr.n. / n.phr. →「名词短语」
 * - n./v. / adj./n. →「名词/动词」（多词性用 / 拼接）
 */
export function posAbbrToZh(pos: string): string {
	const raw = pos.trim();
	if (!raw) return '';
	const parts = posParts(raw);
	if (parts.length === 0) return raw;
	if (parts.length === 1) return POS_ZH[parts[0]!] ?? raw;

	const cores = parts.filter((p) => p !== 'phr' && p !== 'phrase');
	if (cores.length === 1 && cores.length < parts.length) {
		const zh = POS_ZH[cores[0]!];
		if (zh && zh !== '短语') return `${zh}短语`;
		return '短语';
	}
	if (cores.length > 1) {
		const zhs = cores.map((c) => POS_ZH[c]);
		if (zhs.every((z): z is string => Boolean(z))) return zhs.join('/');
	}
	return raw;
}
