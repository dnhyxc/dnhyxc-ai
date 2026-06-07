import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { PracticeSegmented } from '../../practice/components/shell';
import { ENGLISH_SIDEBAR_TEXT_LINK_GRADIENT } from '../../sidebar/sidebarAccents';
import { useDailyWordCount } from '../hooks/useDailyWordCount';
import {
	DAILY_WORD_COUNT_OPTIONS,
	type DailyWordCount,
} from '../utils/dailyWordCount';

const WORD_COUNT_SEGMENTED_OPTIONS = DAILY_WORD_COUNT_OPTIONS.map((count) => ({
	value: String(count),
	label: String(count),
}));

type DailyWordsPerRoundPopoverProps = {
	className?: string;
};

/** 侧栏：每轮词数设置（Popover + 分段选择） */
export function DailyWordsPerRoundPopover({
	className,
}: DailyWordsPerRoundPopoverProps) {
	const { t } = useI18n();
	const [wordCount, setWordCount] = useDailyWordCount();

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						'shrink-0 cursor-pointer text-xs leading-snug',
						ENGLISH_SIDEBAR_TEXT_LINK_GRADIENT.daily,
						className,
					)}
				>
					{t('englishLearning.daily.wordsPerRoundTrigger')}
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-[min(100vw-2rem,17.5rem)] p-3">
				<p className="text-textcolor text-xs font-medium">
					{t('englishLearning.daily.wordsPerRoundTitle')}
				</p>
				<p className="text-textcolor/45 mt-1 text-[11px] leading-snug">
					{t('englishLearning.daily.wordsPerRoundDesc')}
				</p>
				<div className="mt-3 [&_button]:px-2 [&_button]:text-xs">
					<PracticeSegmented
						value={String(wordCount)}
						options={WORD_COUNT_SEGMENTED_OPTIONS}
						onChange={(value) => setWordCount(Number(value) as DailyWordCount)}
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}
