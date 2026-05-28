/**
 * 错题揭示 — 你的答案 + 正确答案
 */
import type { RevealedPanelInnerProps } from '../../types';
import { WordAnswerDetail } from './WordAnswerDetail';

export function RevealedPanelInner({
	yourAnswerPrefix,
	wrongInput,
	item,
	correctAnswerLabel,
	playButton,
}: RevealedPanelInnerProps) {
	return (
		<>
			<p className="text-textcolor/80 mb-3 flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0.5 text-center text-sm">
				<span>{yourAnswerPrefix}</span>
				<span className="text-lg font-medium text-rose-500">{wrongInput}</span>
			</p>
			<WordAnswerDetail
				item={item}
				showDivider={false}
				correctAnswerLabel={correctAnswerLabel}
				wordRowTrailing={playButton}
			/>
		</>
	);
}
