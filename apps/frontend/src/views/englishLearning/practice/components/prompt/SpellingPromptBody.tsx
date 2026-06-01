/**
 * 拼写题 — 中文释义；展开提示时在固定高度内展示音标（无滚动）
 */
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import type { SpellingPromptBodyProps } from '../../types';
import { DictationEqualizer, DictationPlayButton } from './DictationPrompt';

export function SpellingPromptBody({
	promptLabel,
	translationZh,
	pos,
	hintOpen,
	hintContent,
	playing,
	playLabel,
	onPlay,
}: SpellingPromptBodyProps) {
	const ipaText = hintContent.ipa?.trim();
	const sourceText = hintContent.source?.trim();
	const noteText = hintContent.noteZh?.trim();
	const posText = pos?.trim();

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden px-4 text-center">
			<div
				className={cn(
					'flex min-h-0 flex-1 flex-col items-center justify-center gap-0',
					hintOpen ? 'py-2' : 'py-4',
				)}
			>
				<p className="text-textcolor/50 mb-1.5 shrink-0 text-xs font-medium">
					{promptLabel}
				</p>
				<p
					className={cn(
						'text-textcolor shrink-0 font-semibold leading-snug py-2',
						hintOpen ? 'text-lg' : 'text-xl',
					)}
				>
					{translationZh}
				</p>
				{posText ? (
					<p
						className={cn(
							'text-textcolor/50 shrink-0',
							hintOpen ? 'mt-1 text-sm' : 'mt-2.5',
						)}
					>
						{posText}
					</p>
				) : null}
				{hintOpen && ipaText ? (
					<p
						className="mt-2.5 shrink-0 font-mono text-xs leading-snug text-teal-600/90 line-clamp-2 dark:text-teal-400/90"
						aria-live="polite"
					>
						{displayIpaWrapped(ipaText)}
					</p>
				) : null}
				{hintOpen && !ipaText && sourceText ? (
					<p
						className="text-textcolor/65 mt-2.5 shrink-0 line-clamp-2 text-xs leading-snug"
						aria-live="polite"
					>
						{sourceText}
					</p>
				) : null}
				{hintOpen && !ipaText && noteText ? (
					<p
						className="text-textcolor/60 mt-1.5 shrink-0 line-clamp-3 text-xs leading-relaxed italic"
						aria-live="polite"
					>
						{noteText}
					</p>
				) : null}
				{hintOpen ? (
					<div className="mt-3 flex shrink-0 flex-col items-center gap-2">
						<DictationPlayButton
							playing={playing}
							playLabel={playLabel}
							onPlay={onPlay}
							size="strip"
						/>
						<div className="min-h-5 w-full max-w-44">
							<DictationEqualizer playing={playing} className="h-5 w-full" />
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
