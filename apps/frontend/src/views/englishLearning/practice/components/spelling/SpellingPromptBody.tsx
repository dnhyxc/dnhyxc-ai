/**
 * 拼写题 — 中文释义提示
 */
import type { SpellingPromptBodyProps } from '../../types';

export function SpellingPromptBody({
	promptLabel,
	translationZh,
	pos,
}: SpellingPromptBodyProps) {
	return (
		<div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
			<p className="text-textcolor/50 mb-2 text-xs font-medium">
				{promptLabel}
			</p>
			<p className="text-textcolor text-[clamp(1.25rem,4vw,1.75rem)] font-semibold leading-snug">
				{translationZh}
			</p>
			{pos?.trim() ? (
				<p className="text-textcolor/50 mt-2.5">{pos.trim()}</p>
			) : null}
		</div>
	);
}
