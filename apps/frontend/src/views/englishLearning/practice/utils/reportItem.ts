/**
 * 报告快照 → WrongListItem 可用的 PracticeItem（仅展示字段）
 */
import type { EnglishPracticeReportItem } from '@/service';
import type { PracticeItem } from '../types';

export function reportItemToPracticeItem(
	it: EnglishPracticeReportItem,
): PracticeItem {
	if (it.contentKind === 'classic') {
		return {
			contentKind: 'classic',
			key: it.itemKey,
			english: it.answerText,
			translationZh: it.translationZh ?? '',
			source: '',
			noteZh: '',
		};
	}
	return {
		contentKind: 'vocab',
		key: it.itemKey,
		word: it.answerText,
		ipa: it.ipa ?? '',
		pos: it.pos ?? '',
		segmentation: '',
		translationZh: it.translationZh ?? '',
		example: '',
	};
}
