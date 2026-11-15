import type { ReadingWordSource } from './entity/english-daily-reading-word.entity';

export const READING_EXPORT_TITLE = '每日阅读生词';

export type ReadingWordExportItem = {
	word: string;
	ipa: string;
	pos: string;
	segmentation: string;
	translationZh: string;
	example: string;
};

/** 最近一条非空原句。没有则空串。 */
export function latestReadingSentence(
	sources: ReadingWordSource[] | null | undefined,
): string {
	let sentence = '';
	let at = '';
	for (const source of sources ?? []) {
		const text = source.sentence?.trim() ?? '';
		if (!text) continue;
		if (!sentence || source.collectedAt > at) {
			sentence = text;
			at = source.collectedAt ?? '';
		}
	}
	return sentence;
}

/** 词库导出同形。生词没有音标，空串也保留这一行。 */
export function readingExportItem(row: {
	word: string;
	zh?: string | null;
	sources?: ReadingWordSource[] | null;
}): ReadingWordExportItem {
	return {
		word: row.word,
		ipa: '',
		pos: '',
		segmentation: '',
		translationZh: row.zh ?? '',
		example: latestReadingSentence(row.sources),
	};
}
