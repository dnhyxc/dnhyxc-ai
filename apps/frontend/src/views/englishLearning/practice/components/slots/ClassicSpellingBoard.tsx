/**
 * 经典句看中写 / 听写拼写 — 题干 + 词槽（播放 / 词 / 英 在 Session header）
 */
import { cn } from '@/lib/utils';
import type { SentenceWordToken } from '../../utils/segmentSentence';
import type { SentenceWordMeta } from '../../utils/wordMeta';
import { SentenceWordSlots } from './SentenceWordSlots';

export type ClassicSpellingBoardProps = {
	translationZh: string;
	/** 听写答题提示等非「中文题干」时用次要样式 */
	headlineMuted?: boolean;
	tokens: readonly SentenceWordToken[];
	values: readonly string[];
	activeIndex: number;
	showPos: boolean;
	showIpa: boolean;
	phase: 'prompt' | 'soft_wrong' | 'revealed' | 'correct_reveal';
	disabled?: boolean;
	metaByIndex?: readonly (SentenceWordMeta | null | undefined)[];
	metaLoading?: boolean;
	metaError?: boolean;
	/** 语句槽内释义限宽；单词练习不限 */
	compactMeaning?: boolean;
	onChange: (index: number, value: string) => void;
	onActiveChange: (index: number) => void;
	onAdvance?: (fromIndex: number, nextValues: string[]) => void;
	onSubmitAll?: () => void;
};

export function ClassicSpellingBoard({
	translationZh,
	headlineMuted = false,
	tokens,
	values,
	activeIndex,
	showPos,
	showIpa,
	phase,
	disabled = false,
	metaByIndex,
	metaLoading = false,
	metaError = false,
	compactMeaning = true,
	onChange,
	onActiveChange,
	onAdvance,
	onSubmitAll,
}: ClassicSpellingBoardProps) {
	const reveal = phase === 'revealed' || phase === 'correct_reveal';
	const locked =
		phase === 'soft_wrong' ||
		phase === 'revealed' ||
		phase === 'correct_reveal';
	const canToggleMeta = !metaLoading && !metaError;
	/** 全对中间态：无论开关是否打开，都展示词性/音标/释义 */
	const forceMeta = phase === 'correct_reveal' || phase === 'revealed';
	const showPosUi = canToggleMeta && (showPos || forceMeta);
	const showIpaUi = canToggleMeta && (showIpa || forceMeta);

	return (
		<div className="flex h-full min-h-0 w-full flex-col overflow-hidden text-center">
			<div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-6 overflow-y-auto py-3">
				<p
					className={cn(
						'w-full shrink-0 px-1 leading-snug wrap-break-word',
						headlineMuted
							? 'text-textcolor/55 max-w-xs text-[11px] font-medium'
							: 'text-textcolor text-xl font-semibold sm:text-2xl',
					)}
				>
					{translationZh}
				</p>
				<SentenceWordSlots
					tokens={tokens}
					values={reveal ? tokens.map((t) => t.raw) : values}
					activeIndex={activeIndex}
					locked={locked && !reveal}
					showPos={showPosUi}
					showIpa={showIpaUi}
					reveal={reveal}
					disabled={disabled || locked}
					metaByIndex={metaByIndex}
					compactMeaning={compactMeaning}
					onChange={onChange}
					onActiveChange={onActiveChange}
					onAdvance={onAdvance}
					onSubmitAll={onSubmitAll}
				/>
			</div>
		</div>
	);
}
