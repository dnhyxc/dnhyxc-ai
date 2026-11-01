/** 分域短语桶：新说法加一行，禁止万能「有哪些」。 */

export type PhraseDomain =
	| 'mistakes'
	| 'favorites'
	| 'libraries'
	| 'notes'
	| 'packs'
	| 'reading';

export type PhraseFlag = 'catalog' | 'inventory' | 'mistakes';

export type PhraseBucket = {
	domain: PhraseDomain;
	flag: PhraseFlag;
	re: RegExp;
};

/** 库清单（可与关于类同句）；须带库后缀。 */
const CATALOG_RE =
	/有哪些.{0,8}(语句库|语料库|词汇库|单词库|词库)|我有哪些.{0,8}库|所有语句库|所有词汇库|所有单词库|列出.{0,6}(语句库|语料库|词汇库|单词库)|需要的是所有(语句库|词汇库)/u;

/**
 * 整表/盘点。须盖住「错题集有哪些资源」；勿把泛「有哪些」并进来。
 */
const INVENTORY_RE =
	/全部|所有单词|所有词|整个库|导出|列出全部|哪些错题|有哪些错|错题集|错题库|我的错题|列出错题|错题.{0,12}(有哪些|哪些|资源)|有哪些.{0,12}错题|重新练习/;

const MISTAKES_RE =
	/错题集|错题库|我的错题|哪些错题|有哪些错|列出错题|错题.{0,12}(有哪些|哪些|资源)|有哪些.{0,12}错题/;

export const PHRASE_BUCKETS: PhraseBucket[] = [
	{ domain: 'libraries', flag: 'catalog', re: CATALOG_RE },
	{ domain: 'mistakes', flag: 'mistakes', re: MISTAKES_RE },
	{ domain: 'mistakes', flag: 'inventory', re: MISTAKES_RE },
	{ domain: 'libraries', flag: 'inventory', re: INVENTORY_RE },
];

export function phraseHit(userText: string, flag: PhraseFlag): boolean {
	return PHRASE_BUCKETS.some((b) => b.flag === flag && b.re.test(userText));
}

/** 用户还要看「有哪些库」清单（可与关于类筛选同句）。 */
export function wantsLibraryCatalog(userText: string): boolean {
	return phraseHit(userText, 'catalog');
}

/** 与历史 listIntent inventory 分支同一张表。 */
export function inventoryPhraseHit(userText: string): boolean {
	return INVENTORY_RE.test(userText);
}

export function inferPhraseDomain(userText: string): PhraseDomain | undefined {
	if (phraseHit(userText, 'catalog')) return 'libraries';
	if (phraseHit(userText, 'mistakes')) return 'mistakes';
	return undefined;
}

/** `EL_INTENT_FRAME=0` 时跳过 plan 执行，保留 M0 旁路。 */
export function intentFrameEnabled(): boolean {
	return process.env.EL_INTENT_FRAME !== '0';
}
