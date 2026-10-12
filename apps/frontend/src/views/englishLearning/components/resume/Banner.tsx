/**
 * 未完成会话：文案在上、操作在下，与左侧「开始」上下结构对齐
 */
import { Button } from '@ui/index';
import { cn } from '@/lib/utils';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../../practice/constants';

export type BannerProps = {
	description: string;
	continueLabel: string;
	discardLabel: string;
	onContinue: () => void;
	onDiscard: () => void;
	className?: string;
};

export function Banner({
	description,
	continueLabel,
	discardLabel,
	onContinue,
	onDiscard,
	className,
}: BannerProps) {
	return (
		<div className={cn('flex min-w-0 flex-1 flex-col gap-3', className)}>
			<p
				className={cn('text-textcolor shrink-0 truncate text-sm font-semibold')}
			>
				{description}
			</p>
			<div className="flex h-10 w-full shrink-0 items-center gap-4">
				<Button
					type="button"
					className={cn(
						'h-10 min-w-0 flex-1 cursor-pointer',
						PRACTICE_PRIMARY_ACTION_BTN_CLASS,
					)}
					onClick={onContinue}
				>
					{continueLabel}
				</Button>
				<Button
					type="button"
					className="bg-destructive text-textcolor hover:bg-destructive/80 h-10 min-w-0 flex-1 cursor-pointer"
					onClick={onDiscard}
				>
					{discardLabel}
				</Button>
			</div>
		</div>
	);
}
