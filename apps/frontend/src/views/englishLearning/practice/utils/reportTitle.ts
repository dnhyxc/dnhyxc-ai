/**
 * 练习报告标题：{种类}{模式} · {来源名}[ · 重练错题]
 */
import type { PracticeSetupConfig } from '../types';

type TFn = (key: string) => string;

export function buildPracticeReportTitle(
	config: PracticeSetupConfig,
	t: TFn,
): string {
	const kind =
		config.contentKind === 'classic'
			? t('englishLearning.practice.reportKindClassic')
			: t('englishLearning.practice.reportKindVocab');
	const mode =
		config.mode === 'dictation'
			? t('englishLearning.practice.reportModeDictation')
			: t('englishLearning.practice.reportModeSpelling');
	const source =
		config.sourceTitle?.trim() ||
		t('englishLearning.practice.reportSourceFallback');
	const base = `${kind}${mode} · ${source}`;
	if (config.isRetryWrong) {
		return `${base} · ${t('englishLearning.practice.reportRetrySuffix')}`;
	}
	return base;
}
