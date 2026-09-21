/**
 * 手动导入词标注 JSON：对齐 batch2 形态；忽略 id 等多余字段；拒原句导出。
 */

export type AnnotationImportWord = {
	word: string;
	posZh: string;
	ipa: string;
	meaningZh: string;
};

export type AnnotationImportItem = {
	english: string;
	words: AnnotationImportWord[];
};

export class AnnotationImportFormatError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AnnotationImportFormatError';
	}
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return v != null && typeof v === 'object' && !Array.isArray(v);
}

function parseWord(raw: unknown): AnnotationImportWord | null {
	if (!isPlainObject(raw)) return null;
	const word = typeof raw.word === 'string' ? raw.word.trim() : '';
	const posZh = typeof raw.posZh === 'string' ? raw.posZh.trim() : '';
	const ipa = typeof raw.ipa === 'string' ? raw.ipa.trim() : '';
	const meaningZh =
		typeof raw.meaningZh === 'string' ? raw.meaningZh.trim() : '';
	if (!word || !posZh || !ipa || !meaningZh) return null;
	return { word, posZh, ipa, meaningZh };
}

/**
 * 解析标注导入文件文本。
 * 允许 items 仅为某库/Pack 的子集（≥1 条即可）；忽略 id 等多余字段。
 * @throws AnnotationImportFormatError
 */
export function parseAnnotationImportJson(
	text: string,
): AnnotationImportItem[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new AnnotationImportFormatError('invalid_json');
	}

	const root = Array.isArray(parsed)
		? { items: parsed }
		: isPlainObject(parsed)
			? parsed
			: null;
	if (!root || !Array.isArray(root.items)) {
		throw new AnnotationImportFormatError('missing_items');
	}
	if (root.items.length === 0) {
		throw new AnnotationImportFormatError('empty');
	}

	// 原句导出：有 translationZh、无词标注对象
	const looksClassic = root.items.every((row) => {
		if (!isPlainObject(row)) return false;
		const hasTranslation =
			typeof row.translationZh === 'string' && row.translationZh.trim() !== '';
		const words = row.words;
		const hasWordAnn =
			Array.isArray(words) &&
			words.length > 0 &&
			isPlainObject(words[0]) &&
			typeof (words[0] as { posZh?: unknown }).posZh === 'string';
		return hasTranslation && !hasWordAnn;
	});
	if (looksClassic) {
		throw new AnnotationImportFormatError('classic_quotes');
	}

	const items: AnnotationImportItem[] = [];
	for (const row of root.items) {
		if (!isPlainObject(row)) continue;
		const english = typeof row.english === 'string' ? row.english.trim() : '';
		if (!english || !Array.isArray(row.words)) continue;
		const words: AnnotationImportWord[] = [];
		for (const w of row.words) {
			const parsedWord = parseWord(w);
			if (!parsedWord) {
				words.length = 0;
				break;
			}
			words.push(parsedWord);
		}
		if (words.length === 0) continue;
		items.push({ english, words });
	}

	if (items.length === 0) {
		throw new AnnotationImportFormatError('no_valid_items');
	}
	return items;
}
