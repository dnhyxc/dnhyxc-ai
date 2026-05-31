/**
 * 完整揭示 — 与软揭示（第二阶段）同布局：网格字段 + 底栏听音
 */
import type { ReactNode } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import { SegmentationLine } from '../../../components/SegmentationLine';
import type {
	PracticeClassicItem,
	PracticeItem,
	RevealedPanelInnerProps,
} from '../../types';
import { isPracticeClassicItem } from '../../utils/item';
import {
	FIELD_GRID,
	FieldCells,
	PRACTICE_PANEL_SHELL,
	PracticeRevealedListenFooter,
} from '../session/PracticeFieldGrid';

/**
 * 统计完整揭示详情字段的数量
 *
 * @param item 练习条目，分为经典和普通两类
 * @returns 需展示的详情字段总数，用于判断网格紧凑性等布局决策
 */
function countRevealedDetailFields(item: PracticeItem): number {
	// 经典题型：基础字段 + 有则加：释义、来源、备注
	if (isPracticeClassicItem(item)) {
		let n = 1; // 基础字段（如英文单词本身）
		// 有中文释义则加1
		if (item.translationZh?.trim()) n += 1;
		// 有来源则加1
		if (item.source?.trim()) n += 1;
		// 有备注则加1
		if (item.noteZh?.trim()) n += 1;
		return n;
	}
	// 普通词汇：基础字段 + 有则加：音标、音节、释义、例句
	let n = 1; // 基础字段（如英文单词本身）
	// 有音标则加1
	if (item.ipa?.trim()) n += 1;
	// 有音节分割则加1
	if (item.segmentation?.trim()) n += 1;
	// 有中文释义则加1
	if (item.translationZh?.trim()) n += 1;
	// 有例句则加1
	if (item.example?.trim()) n += 1;
	return n;
}

/**
 * 构建“普通词汇”揭示阶段的详细信息行
 *
 * @param item 包含单词的 PracticeItem（需有 word 字段）
 * @param correctAnswerLabel “正确答案”字段标签
 * @param t 国际化 t 函数（用于翻译 label 文本）
 * @param compact 是否采用紧凑型排版（内容较多时为 true）
 * @returns 返回一组 ReactNode，每一个对应一行 FieldCells
 */
function buildWordRows(
	item: Extract<PracticeItem, { word: string }>,
	correctAnswerLabel: string,
	t: ReturnType<typeof useI18n>['t'],
	compact: boolean,
): ReactNode[] {
	// 文字样式类（紧凑与否影响字号）
	const body = cn(
		'leading-snug [font-family:var(--font-family)]',
		compact ? 'text-sm' : 'text-base',
	);

	// 词性，可能为空字符串
	const pos = item.pos?.trim();

	// 收集所有要展示的信息行
	const rows: ReactNode[] = [];

	// 1. 正确答案与词性（词性可选）
	rows.push(
		<FieldCells key="correct" label={correctAnswerLabel}>
			{/* 横向排布：单词本身 + 词性 */}
			<span className="inline-flex flex-wrap items-baseline gap-x-2">
				{/* 单词本身 */}
				<span
					className={cn(
						'text-lg font-semibold leading-snug sm:text-xl',
						'[font-family:var(--font-family)]',
					)}
				>
					{item.word}
				</span>
				{/* 词性（如有） */}
				{pos ? (
					<span className="text-textcolor/50 text-sm font-normal leading-snug">
						{pos}
					</span>
				) : null}
			</span>
		</FieldCells>,
	);

	// 2. 音标（可选）
	if (item.ipa?.trim()) {
		rows.push(
			<FieldCells key="ipa" label={t('englishLearning.practice.hintLabelIpa')}>
				<span
					className={cn(
						'font-mono text-teal-600/85 dark:text-teal-400/85',
						body,
					)}
				>
					{/* 展示音标，外部函数自动加斜线包裹 */}
					{displayIpaWrapped(item.ipa)}
				</span>
			</FieldCells>,
		);
	}

	// 3. 音节分割（可选）
	if (item.segmentation?.trim()) {
		rows.push(
			<FieldCells
				key="seg"
				label={t('englishLearning.practice.hintLabelSegmentation')}
			>
				{/* 分割线组件专门渲染音节结构 */}
				<SegmentationLine segmentation={item.segmentation} />
			</FieldCells>,
		);
	}

	// 4. 中文释义（可选）
	if (item.translationZh?.trim()) {
		rows.push(
			<FieldCells
				key="zh"
				label={t('englishLearning.practice.hintLabelTranslation')}
			>
				<span className={cn('font-medium', body, compact && 'line-clamp-3')}>
					{item.translationZh}
				</span>
			</FieldCells>,
		);
	}

	// 5. 例句（可选）
	if (item.example?.trim()) {
		rows.push(
			<FieldCells
				key="ex"
				label={t('englishLearning.practice.hintLabelExample')}
			>
				<span
					className={cn(
						'text-textcolor/70 italic',
						body,
						compact && 'line-clamp-3',
					)}
				>
					{item.example}
				</span>
			</FieldCells>,
		);
	}

	// 返回所有需要展示的详情字段
	return rows;
}

/**
 * 构建“经典题型”在揭示阶段下的详细信息行
 * 包括：正确答案、中文释义、出处、注释等
 * @param item 题目信息（经典题型）
 * @param correctAnswerLabel 正确答案标签文字
 * @param t 国际化函数
 * @param compact 是否采用紧凑排版（详细项较多时）
 * @returns ReactNode 数组，每行为一个 FieldCells
 */
function buildClassicRows(
	item: PracticeClassicItem,
	correctAnswerLabel: string,
	t: ReturnType<typeof useI18n>['t'],
	compact: boolean,
): ReactNode[] {
	// 基础内容样式，根据 compact 决定字号
	const body = cn(
		'leading-snug [font-family:var(--font-family)]',
		compact ? 'text-sm' : 'text-base',
	);

	const rows: ReactNode[] = [];

	// 正确答案行（英文原文）
	rows.push(
		<FieldCells key="correct" label={correctAnswerLabel}>
			<span
				className={cn(
					'text-lg font-semibold leading-snug sm:text-xl',
					'[font-family:var(--font-family)]',
					compact && 'line-clamp-4', // 行数超过4时截断
				)}
			>
				{item.english}
			</span>
		</FieldCells>,
	);

	// 中文释义（可选）
	if (item.translationZh?.trim()) {
		rows.push(
			<FieldCells
				key="zh"
				label={t('englishLearning.practice.hintLabelTranslation')}
			>
				<span className={cn('font-medium', body, compact && 'line-clamp-3')}>
					{item.translationZh}
				</span>
			</FieldCells>,
		);
	}

	// 来源出处（可选）
	if (item.source?.trim()) {
		rows.push(
			<FieldCells
				key="source"
				label={t('englishLearning.practice.hintLabelSource')}
			>
				<span
					className={cn('text-textcolor/75', body, compact && 'line-clamp-3')}
				>
					{item.source}
				</span>
			</FieldCells>,
		);
	}

	// 中文注释（可选）
	if (item.noteZh?.trim()) {
		rows.push(
			<FieldCells
				key="note"
				label={t('englishLearning.practice.hintLabelNote')}
			>
				<span
					className={cn(
						'text-textcolor/70 italic',
						body,
						compact && 'line-clamp-3',
					)}
				>
					{item.noteZh}
				</span>
			</FieldCells>,
		);
	}

	// 返回所有待渲染的详细信息行
	return rows;
}

/**
 * 揭示阶段主面板组件
 * 显示用户的错误答案及单词/短语的详细信息（解释/例句/笔记等）
 */
export function RevealedPanelInner({
	answerLabel, // 标签文字：你的答案
	wrongInput, // 用户输入的错误答案
	item, // 当前作答的题目数据
	correctAnswerLabel, // 标签文字：正确答案
	playing, // 是否正在播放发音
	playLabel, // 播放按钮的文案（如“再听一遍”等）
	onPlay, // 播放音频的回调
}: RevealedPanelInnerProps) {
	const { t } = useI18n();

	// 计算要展示详细信息的数量（如释义/例句/笔记等）
	const detailCount = countRevealedDetailFields(item);
	// 总行数 = 错误答案 + 详细信息
	const totalRows = 1 + detailCount;
	// 详细项 >= 4 行时采用紧凑显示
	const compact = totalRows >= 4;

	// 根据题型（classic/word）分别生成详细信息行
	const detailRows = isPracticeClassicItem(item)
		? buildClassicRows(item, correctAnswerLabel, t, compact)
		: buildWordRows(item, correctAnswerLabel, t, compact);

	return (
		<div className={PRACTICE_PANEL_SHELL}>
			{/* 主容器，设置 padding 并使内容撑满高度 */}
			<div className="p-1 flex h-full min-h-0 flex-1 flex-col overflow-hidden pb-5">
				<div
					className={cn(
						FIELD_GRID,
						'h-full min-h-0 flex-1 gap-y-2',
						totalRows <= 2 ? 'content-center' : 'content-between', // 少行居中，多行“首尾对齐”
					)}
					role="status"
					aria-live="polite"
				>
					{/* 展示“你的答案”及用户输入 */}
					<FieldCells
						label={answerLabel}
						valueClassName="text-rose-500 font-semibold"
					>
						<span className={cn(compact && 'line-clamp-3')}>{wrongInput}</span>
					</FieldCells>
					{/* 展示正确答案、释义、例句、注释等 */}
					{detailRows}
				</div>
			</div>

			{/* 底部区域：播放音频按钮等功能区 */}
			<PracticeRevealedListenFooter
				playing={playing}
				playLabel={playLabel}
				onPlay={onPlay}
			/>
		</div>
	);
}
