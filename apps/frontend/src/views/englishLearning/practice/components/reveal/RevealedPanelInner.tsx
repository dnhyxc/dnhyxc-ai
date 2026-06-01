/**
 * 完整揭示（第二次答错后）— 你的答案 + 正确答案详情 + 底栏播放
 */
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { RevealedPanelInnerProps } from '../../types';
import { isPracticeClassicItem } from '../../utils/item';
import {
	isPracticePanelCompact,
	PracticeScrollableFieldStack,
} from '../session/PanelLayout';
import {
	FieldCells,
	PRACTICE_PANEL_SHELL,
	PracticeRevealedListenFooter,
} from '../session/PracticeFieldGrid';
import {
	buildClassicRevealedDetailRows,
	buildVocabRevealedDetailRows,
} from './RevealedDetailRows';

/**
 * 完整揭示 — 你的答案 + 正确答案详情 + 底栏播放
 */
export function RevealedPanelInner({
	answerLabel,
	wrongInput,
	item,
	correctAnswerLabel,
	playing,
	playLabel,
	onPlay,
}: RevealedPanelInnerProps) {
	const { t } = useI18n();

	const buildDetailRows = (compact: boolean) =>
		isPracticeClassicItem(item)
			? buildClassicRevealedDetailRows(item, correctAnswerLabel, t, compact)
			: buildVocabRevealedDetailRows(item, correctAnswerLabel, t, compact);

	const draftRows = buildDetailRows(false);
	const compact = isPracticePanelCompact(draftRows.length);
	const detailRows = compact ? buildDetailRows(true) : draftRows;

	return (
		<div className={PRACTICE_PANEL_SHELL}>
			<PracticeScrollableFieldStack>
				<FieldCells
					label={answerLabel}
					valueClassName="text-rose-500 font-semibold"
				>
					<span className={cn(compact && 'line-clamp-3')}>{wrongInput}</span>
				</FieldCells>
				{detailRows}
			</PracticeScrollableFieldStack>

			<PracticeRevealedListenFooter
				playing={playing}
				playLabel={playLabel}
				onPlay={onPlay}
			/>
		</div>
	);
}
