import { Button } from '@ui/button';
import { type ReactNode } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { SIDEBAR_BTN_GAP } from '@/views/englishLearning/sidebar/tokens';
import {
	DAILY_COUNT_PRESET_BTN_CLASS,
	DAILY_COUNT_PRESET_BTN_SELECTED_CLASS,
	DAILY_COUNT_PRESET_BTN_UNSELECTED_CLASS,
} from '../constants';
import { useDailyWordCount } from '../hooks/useDailyWordCount';
import {
	DAILY_WORD_COUNT_OPTIONS,
	type DailyWordCount,
} from '../utils/dailyWordCount';

type DailyWordsPerRoundPickerProps = {
	className?: string;
	/** 标题行右侧操作（如「重置记词」） */
	headerRight?: ReactNode;
};

/** 侧栏 / 入口：每轮词数快捷选择（色相与侧栏「今日记词」按钮一致） */
export function DailyWordsPerRoundPicker({
	className,
	headerRight,
}: DailyWordsPerRoundPickerProps) {
	const { t } = useI18n();
	const [wordCount, setWordCount] = useDailyWordCount();

	return (
		<div className={cn('min-w-0', className)}>
			<div className="flex items-center justify-between gap-2">
				<p className="text-textcolor/45 text-sm font-medium tracking-wide">
					{t('englishLearning.daily.wordsPerRoundTitle')}
				</p>
				{headerRight}
			</div>
			<div
				className={cn(
					'mt-2 mb-3 flex flex-wrap justify-between',
					SIDEBAR_BTN_GAP,
				)}
			>
				{DAILY_WORD_COUNT_OPTIONS.map((count) => {
					const selected = wordCount === count;
					return (
						<Button
							key={count}
							type="button"
							size="sm"
							variant="outline"
							aria-pressed={selected}
							onClick={() => setWordCount(count as DailyWordCount)}
							className={cn(
								DAILY_COUNT_PRESET_BTN_CLASS,
								selected
									? DAILY_COUNT_PRESET_BTN_SELECTED_CLASS
									: DAILY_COUNT_PRESET_BTN_UNSELECTED_CLASS,
							)}
						>
							{count}
						</Button>
					);
				})}
			</div>
		</div>
	);
}
