import type { EnglishDailyReadingExtras } from '@/service';

const TOKEN = /^[a-z]+(?:'[a-z]+)?(?:-[a-z]+(?:'[a-z]+)?)?$/;

/** 与后端 `readingWordKey` 同一套规则，只用来决定按钮文案和要不要发请求。 */
export function wordKey(raw: string): string | null {
	const text = raw.trim().replace(/\s+/g, ' ').toLowerCase();
	const stripped = text.replace(/^[^a-z']+|[^a-z']+$/g, '');
	if (!stripped || !/[a-z]/.test(stripped)) return null;
	if (stripped.length > 80) return null;
	const tokens = stripped.split(' ');
	if (tokens.length > 4) return null;
	if (tokens.some((token) => !TOKEN.test(token))) return null;
	return stripped;
}

function lookupGloss(
	extras: EnglishDailyReadingExtras | null,
	key: string,
): string {
	for (const sentence of extras?.wordGloss ?? []) {
		const hit = sentence.words.find((item) => wordKey(item.w) === key);
		if (hit?.zh) return hit.zh;
	}
	return '';
}

export type CollectSurface = 'selection' | 'gloss' | 'glossary';

export type CollectTarget =
	| { ok: false; reason: 'pick-word' }
	| {
			ok: true;
			key: string;
			word: string;
			zh: string;
			sentence: string;
			surface: CollectSurface;
	  };

export function resolveCollectTarget(
	text: string,
	givenZh: string,
	extras: EnglishDailyReadingExtras | null,
	surface: CollectSurface,
	sentence: string,
): CollectTarget {
	const key = wordKey(text);
	if (!key) return { ok: false, reason: 'pick-word' };
	const card = (extras?.glossary ?? []).find(
		(item) => wordKey(item.word) === key,
	);
	// 多个词必须正好是一张词汇卡，避免把随意短语收成生词
	if (key.split(' ').length > 1 && !card)
		return { ok: false, reason: 'pick-word' };
	const word = surface === 'selection' && card ? card.word : text.trim();
	// 选区没有自带释义，先用词卡，再用句中逐词释义；气泡和词汇卡用界面上已经显示的
	const zh =
		surface === 'selection'
			? (card?.zh ?? lookupGloss(extras, key))
			: givenZh.trim();
	return { ok: true, key, word, zh, sentence, surface };
}
