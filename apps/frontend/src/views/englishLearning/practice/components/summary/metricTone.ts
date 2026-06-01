/**
 * 结算统计格配色 — 沿用项目色相，低透明度渐变底（对齐 EnglishSource 示例区等淡色底）
 */
import type { SummaryMetricTone } from '../../types';

type SummaryMetricToneStyle = {
	shell: string;
	label: string;
	value: string;
};

export const SUMMARY_METRIC_TONE: Record<
	SummaryMetricTone,
	SummaryMetricToneStyle
> = {
	accent: {
		shell: 'bg-linear-to-r from-teal-400/10 to-cyan-500/10',
		label: 'text-textcolor/65',
		value: 'text-teal-700 dark:text-teal-400',
	},
	correct: {
		shell: 'bg-linear-to-r from-lime-400/10 to-green-500/10',
		label: 'text-textcolor/65',
		value: 'text-green-700 dark:text-lime-400',
	},
	wrong: {
		shell: 'bg-linear-to-r from-rose-400/10 to-rose-600/10',
		label: 'text-textcolor/65',
		value: 'text-rose-500/70 dark:text-rose-400',
	},
	total: {
		shell: 'bg-linear-to-r from-cyan-400/10 to-blue-500/12',
		label: 'text-textcolor/65',
		value: 'text-sky-700 dark:text-cyan-400',
	},
	practiced: {
		shell: 'bg-linear-to-r from-indigo-400/15 to-blue-500/15',
		label: 'text-textcolor/65',
		value: 'text-indigo-600 dark:text-indigo-300',
	},
};

export const SUMMARY_ACCENT_TONE = SUMMARY_METRIC_TONE.accent;
