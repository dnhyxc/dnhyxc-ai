/**
 * 拼写题 — 中文释义；展开提示时在固定高度内展示音标（无滚动）
 */
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import type { SpellingPromptBodyProps } from '../../types';

export function SpellingPromptBody({
	promptLabel,
	translationZh,
	pos,
	hintOpen,
	hintContent,
}: SpellingPromptBodyProps) {
	const ipaText = hintContent.ipa?.trim();
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
						'text-textcolor shrink-0 font-semibold leading-snug text-2xl py-2',
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
			</div>
		</div>
	);
}
