import type { PracticeItem, PracticeMode } from '../types';
import { isPracticeClassicItem } from './item';

export function hasPracticeHintContent(
	item: PracticeItem,
	mode: PracticeMode,
): boolean {
	if (isPracticeClassicItem(item)) {
		if (mode === 'dictation') {
			return (
				Boolean(item.translationZh?.trim()) ||
				Boolean(item.source?.trim()) ||
				Boolean(item.noteZh?.trim())
			);
		}
		return Boolean(item.source?.trim()) || Boolean(item.noteZh?.trim());
	}
	const hasIpa = Boolean(item.ipa?.trim());
	if (mode === 'dictation') {
		return hasIpa || Boolean(item.translationZh?.trim());
	}
	return hasIpa;
}

export function buildPracticeHintContent(item: PracticeItem): {
	ipa?: string | null;
	translationZh?: string | null;
	source?: string | null;
	noteZh?: string | null;
} {
	if (isPracticeClassicItem(item)) {
		return {
			translationZh: item.translationZh,
			source: item.source,
			noteZh: item.noteZh,
		};
	}
	return {
		ipa: item.ipa,
		translationZh: item.translationZh,
	};
}
