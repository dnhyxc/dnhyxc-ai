import type { EnglishDailyReadingProfile } from '@/service';

export function sameThemes(a: string[], b: string[]) {
	return a.length === b.length && a.every((item, index) => item === b[index]);
}

export function sameProfile(
	a: EnglishDailyReadingProfile,
	b: EnglishDailyReadingProfile,
) {
	return (
		a.level === b.level &&
		a.length === b.length &&
		a.focus === b.focus &&
		a.questions === b.questions &&
		a.useWeb === b.useWeb
	);
}

export function nextFocus(
	current: EnglishDailyReadingProfile['focus'],
	key: 'reading' | 'vocab' | 'grammar',
): EnglishDailyReadingProfile['focus'] {
	if (key === 'reading') return 'reading';
	const vocab = current === 'vocab' || current === 'both';
	const grammar = current === 'grammar' || current === 'both';
	const nextVocab = key === 'vocab' ? !vocab : vocab;
	const nextGrammar = key === 'grammar' ? !grammar : grammar;
	if (nextVocab && nextGrammar) return 'both';
	if (nextVocab) return 'vocab';
	if (nextGrammar) return 'grammar';
	return 'reading';
}
