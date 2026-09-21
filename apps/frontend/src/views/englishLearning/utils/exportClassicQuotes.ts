/**
 * 语句库 / 拉取历史：分页拉全后存成原句 JSON（不写半截文件）。
 */
import {
	listEnglishClassicQuotesLibraryItems,
	listEnglishClassicQuotesPackItems,
} from '@/service';
import { saveFileWithPicker } from '@/utils';

export type ClassicExportSource =
	| {
			source: 'library';
			libraryId: string;
			title: string;
			quoteCount?: number;
	  }
	| {
			source: 'pack';
			streamId: string;
			title: string;
			quoteCount?: number;
	  };

type QuoteRow = {
	english: string;
	translationZh?: string | null;
	source?: string | null;
	noteZh?: string | null;
};

function safeFileName(title: string): string {
	const s = title
		.trim()
		.replace(/[\\/:*?"<>|]/g, '_')
		.slice(0, 80);
	return s || 'quotes';
}

async function fetchPage(
	input: ClassicExportSource,
	limit: number,
	offset: number,
): Promise<{ rows: QuoteRow[]; total: number }> {
	if (input.source === 'library') {
		const res = await listEnglishClassicQuotesLibraryItems(input.libraryId, {
			limit,
			offset,
			silent: true,
		});
		const rows = res.data?.items ?? [];
		const total = Math.max(
			input.quoteCount ?? 0,
			res.data?.library.quoteCount ?? 0,
		);
		return { rows, total };
	}
	const res = await listEnglishClassicQuotesPackItems(input.streamId, {
		limit,
		offset,
	});
	const rows = res.data?.items ?? [];
	const total = Math.max(input.quoteCount ?? 0, res.data?.itemCount ?? 0);
	return { rows, total };
}

export async function exportClassicQuotesJson(
	input: ClassicExportSource,
): Promise<void> {
	// 库接口上限 1000；历史 service 上限 200，多要会被截断却看起来像取完
	const pageSize = input.source === 'library' ? 1000 : 200;
	const items: QuoteRow[] = [];
	let offset = 0;
	// ponytail: 最多 40 页（库 4 万 / 历史 8000），防 total 虚高死循环
	for (let page = 0; page < 40; page += 1) {
		const { rows, total } = await fetchPage(input, pageSize, offset);
		if (rows.length === 0) break;
		for (const row of rows) {
			const english = row.english?.trim();
			if (!english) continue;
			items.push({
				english,
				translationZh: row.translationZh ?? '',
				source: row.source ?? '',
				noteZh: row.noteZh ?? '',
			});
		}
		offset += rows.length;
		if (rows.length < pageSize || (total > 0 && offset >= total)) break;
	}
	if (items.length === 0) throw new Error('empty');
	await saveFileWithPicker({
		content: JSON.stringify({ title: input.title, items }, null, 2),
		file_name: `${safeFileName(input.title)}.json`,
	});
}
