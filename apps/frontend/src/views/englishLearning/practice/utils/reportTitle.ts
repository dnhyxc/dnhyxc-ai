/**
 * 练习报告标题：{种类}{模式} · {来源名}[ · 重练错题]
 */
import type {
	PracticeMode,
	PracticeOrder,
	PracticeSetupConfig,
} from '../types';

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

/** 结算/详情作答明细行：听写 / 看中写 / 认读（今日记词报告） */
export function practiceModeShortLabel(
	mode: PracticeMode | 'recognition',
	t: TFn,
): string {
	if (mode === 'recognition') {
		return t('englishLearning.daily.modeRecognition');
	}
	return mode === 'dictation'
		? t('englishLearning.practice.modeDictation')
		: t('englishLearning.practice.modeSpelling');
}

/** 结算/详情作答明细行：随机 / 顺序 */
export function practiceOrderShortLabel(order: PracticeOrder, t: TFn): string {
	return order === 'random'
		? t('englishLearning.practice.orderRandom')
		: t('englishLearning.practice.orderSequential');
}
