import {
	classicQuoteFavoriteContentKey,
	type EnglishClassicQuoteItem,
	type EnglishVocabularyItem,
	normalizeEnglishVocabWordKey,
} from '@/service';
import type {
	PracticeClassicItem,
	PracticeContentKind,
	PracticeItem,
	PracticeVocabItem,
} from '../types';

export function toPracticeVocabItem(
	word: string,
	fields: Omit<EnglishVocabularyItem, 'word'>,
): PracticeVocabItem {
	const key = normalizeEnglishVocabWordKey(word);
	return { contentKind: 'vocab', word, ...fields, key };
}

export function toPracticeClassicItem(
	fields: EnglishClassicQuoteItem,
): PracticeClassicItem {
	const english = fields.english.trim();
	return {
		contentKind: 'classic',
		english,
		translationZh: fields.translationZh ?? '',
		source: fields.source ?? '',
		noteZh: fields.noteZh ?? '',
		key: classicQuoteFavoriteContentKey(english),
	};
}

export function getPracticeAnswerText(item: PracticeItem): string {
	return item.contentKind === 'classic' ? item.english : item.word;
}

export function isPracticeClassicItem(
	item: PracticeItem,
): item is PracticeClassicItem {
	return item.contentKind === 'classic';
}

export function isPracticeVocabItem(
	item: PracticeItem,
): item is PracticeVocabItem {
	return item.contentKind === 'vocab';
}

export function parsePracticeContentKind(
	raw: string | null,
): PracticeContentKind {
	return raw === 'classic' ? 'classic' : 'vocab';
}
