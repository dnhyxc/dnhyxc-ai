/**
 * 单词库 / 拉取历史：分页拉全后存成导入兼容 JSON（不写半截文件）。
 */
import {
	listEnglishVocabularyLibraryItems,
	listEnglishVocabularyPackItems,
} from '@/service';
import { saveFileWithPicker } from '@/utils';
import { safeExportBaseName } from './exportFileName';

export type VocabExportSource =
	| {
			source: 'library';
			libraryId: string;
			title: string;
			wordCount?: number;
	  }
	| {
			source: 'pack';
			streamId: string;
			title: string;
			wordCount?: number;
	  };

type VocabRow = {
	word: string;
	ipa: string;
	pos?: string | null;
	segmentation?: string | null;
	translationZh?: string | null;
	example?: string | null;
};

async function fetchPage(
	input: VocabExportSource,
	limit: number,
	offset: number,
): Promise<{ rows: VocabRow[]; total: number }> {
	if (input.source === 'library') {
		const res = await listEnglishVocabularyLibraryItems(input.libraryId, {
			limit,
			offset,
			silent: true,
		});
		const rows = res.data?.items ?? [];
		const total = Math.max(
			input.wordCount ?? 0,
			res.data?.library.wordCount ?? 0,
		);
		return { rows, total };
	}
	const res = await listEnglishVocabularyPackItems(input.streamId, {
		limit,
		offset,
	});
	const rows = res.data?.items ?? [];
	const total = Math.max(input.wordCount ?? 0, res.data?.itemCount ?? 0);
	return { rows, total };
}

export async function exportVocabularyJson(
	input: VocabExportSource,
): Promise<void> {
	// 库接口上限 1000；历史 service 上限 200，多要会被截断却看起来像取完
	const pageSize = input.source === 'library' ? 1000 : 200;
	const items: VocabRow[] = [];
	let offset = 0;
	// ponytail: 最多 40 页（库 4 万 / 历史 8000），防 total 虚高死循环
	for (let page = 0; page < 40; page += 1) {
		const { rows, total } = await fetchPage(input, pageSize, offset);
		if (rows.length === 0) break;
		for (const row of rows) {
			const word = row.word?.trim();
			const ipa = row.ipa?.trim();
			if (!word || !ipa) continue;
			items.push({
				word,
				ipa,
				pos: row.pos ?? '',
				segmentation: row.segmentation ?? '',
				translationZh: row.translationZh ?? '',
				example: row.example ?? '',
			});
		}
		offset += rows.length;
		if (rows.length < pageSize || (total > 0 && offset >= total)) break;
	}
	if (items.length === 0) throw new Error('empty');
	await saveFileWithPicker({
		content: JSON.stringify({ title: input.title, items }, null, 2),
		file_name: `${safeExportBaseName(input.title, 'vocabulary')}.json`,
	});
}
