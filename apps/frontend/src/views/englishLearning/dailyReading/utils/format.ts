export function formatElapsed(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
	return `${pad(m)}:${pad(s)}`;
}

export function lengthLabel(
	length: 'short' | 'medium' | 'long' | null,
	t: (key: string) => string,
): string {
	if (length === 'short') return t('englishLearning.dailyReading.lengthShort');
	if (length === 'medium')
		return t('englishLearning.dailyReading.lengthMedium');
	if (length === 'long') return t('englishLearning.dailyReading.lengthLong');
	return '';
}

export function focusLabel(
	focus: 'reading' | 'vocab' | 'grammar' | 'both' | null,
	t: (key: string) => string,
): string {
	if (focus === 'both') {
		return `${t('englishLearning.dailyReading.focusVocab')} · ${t('englishLearning.dailyReading.focusGrammar')}`;
	}
	if (focus === 'vocab') return t('englishLearning.dailyReading.focusVocab');
	if (focus === 'grammar')
		return t('englishLearning.dailyReading.focusGrammar');
	if (focus === 'reading')
		return t('englishLearning.dailyReading.focusReading');
	return '';
}

export function questionsLabel(
	count: number | null,
	t: (key: string) => string,
): string {
	if (count == null) return '';
	if (count >= 3) return t('englishLearning.dailyReading.questions3');
	if (count === 2) return t('englishLearning.dailyReading.questions2');
	if (count === 1) return t('englishLearning.dailyReading.questions1');
	return t('englishLearning.dailyReading.questions0');
}
