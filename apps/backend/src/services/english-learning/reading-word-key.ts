/** 与主站 `collectTarget.ts` 的预检必须一致。服务端仍是唯一入库标准。 */
const TOKEN = /^[a-z]+(?:'[a-z]+)?(?:-[a-z]+(?:'[a-z]+)?)?$/;

export function readingWordKey(raw: string): string | null {
	// 大小写和连续空格不参与去重，Gourmet 与 gourmet 是同一个键
	const text = raw.trim().replace(/\s+/g, ' ').toLowerCase();
	// 只去掉首尾标点，词内撇号要留下，don't 仍是一个词
	const stripped = text.replace(/^[^a-z']+|[^a-z']+$/g, '');
	// 纯中文或标点选区没有可入库的字母
	if (!stripped || !/[a-z]/.test(stripped)) return null;
	// 和 word_key 列长一致，超长选区直接拒绝
	if (stripped.length > 80) return null;
	const tokens = stripped.split(' ');
	// 超过 4 个词视为句子，不收进生词本
	if (tokens.length > 4) return null;
	// 词中间夹中文或其它符号时，整段不合格
	if (tokens.some((token) => !TOKEN.test(token))) return null;
	return stripped;
}
