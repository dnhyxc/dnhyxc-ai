import type { PracticeItem, PracticeMode } from '../types';

export function hasPracticeHintContent(
	item: PracticeItem,
	mode: PracticeMode,
): boolean {
	const hasIpa = Boolean(item.ipa?.trim());
	if (mode === 'dictation') {
		return hasIpa || Boolean(item.translationZh?.trim());
	}
	return hasIpa;
}
