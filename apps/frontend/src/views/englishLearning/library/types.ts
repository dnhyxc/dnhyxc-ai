import type {
	EnglishClassicQuotesLibraryListItem,
	EnglishVocabularyLibraryListItem,
} from '@/service';

export type LibraryKind = 'vocab' | 'classic';

export type EnglishLibraryListItem =
	| EnglishVocabularyLibraryListItem
	| EnglishClassicQuotesLibraryListItem;

export function getLibraryItemCount(
	lib: EnglishLibraryListItem,
	kind: LibraryKind,
): number {
	return kind === 'vocab'
		? (lib as EnglishVocabularyLibraryListItem).wordCount
		: (lib as EnglishClassicQuotesLibraryListItem).quoteCount;
}

export function parseLibraryKind(raw: string | null): LibraryKind {
	return raw === 'classic' ? 'classic' : 'vocab';
}
