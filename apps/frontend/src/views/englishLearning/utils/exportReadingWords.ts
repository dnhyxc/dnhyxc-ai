import { Toast } from '@ui/sonner';
import {
	downloadEnglishDailyReadingWordsDocx,
	getEnglishDailyReadingWordExport,
} from '@/service';
import { saveFileWithPicker } from '@/utils';
import { isTauriRuntime } from '@/utils/runtime';
import { exportDocxFileName, safeExportBaseName } from './exportFileName';

type Translate = (key: string) => string;

function exportArg(arg: unknown): {
	format: unknown;
	readingId: string;
	q: string;
	titleZh: string;
} {
	if (typeof arg === 'string') {
		return { format: arg, readingId: '', q: '', titleZh: '' };
	}
	if (!arg || typeof arg !== 'object') {
		return { format: arg, readingId: '', q: '', titleZh: '' };
	}
	const row = arg as {
		format?: unknown;
		readingId?: unknown;
		q?: unknown;
		titleZh?: unknown;
	};
	return {
		format: typeof row.format === 'string' ? row.format : arg,
		readingId: typeof row.readingId === 'string' ? row.readingId : '',
		q: typeof row.q === 'string' ? row.q : '',
		titleZh: typeof row.titleZh === 'string' ? row.titleZh : '',
	};
}

/** 按当前篇目和搜索词导出。不走词库 JSON 导出，否则没有音标的行会被丢掉。 */
export async function exportDailyReadingWords(
	arg: unknown,
	t: Translate,
): Promise<void> {
	const { format, readingId, q, titleZh } = exportArg(arg);
	if (format !== 'json' && format !== 'docx') return;
	const query = { readingId, q };
	const res = await getEnglishDailyReadingWordExport(query);
	const title = titleZh.trim() || res.data?.title?.trim() || '每日阅读生词';
	const items = res.data?.items ?? [];
	if (items.length === 0) {
		Toast({
			type: 'error',
			title: t('englishLearning.vocab.exportEmpty'),
		});
		return;
	}
	if (format === 'json') {
		await saveFileWithPicker({
			content: JSON.stringify({ title, items }, null, 2),
			file_name: `${safeExportBaseName(title, 'daily-reading-words')}.json`,
		});
		return;
	}
	await downloadEnglishDailyReadingWordsDocx(exportDocxFileName(title), query);
	if (!isTauriRuntime()) {
		Toast({
			type: 'success',
			title: t('englishLearning.vocab.exportDocxSuccess'),
		});
	}
}
