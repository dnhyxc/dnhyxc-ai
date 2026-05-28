/**
 * 练习页布局壳：顶栏 + 可滚动内容区
 */
import { Button, ScrollArea } from '@ui/index';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PracticePageShellProps } from '../../types';

export function PracticePageShell({
	title,
	subtitle,
	onBack,
	backLabel,
	headerRight,
	children,
	contentLayout = 'center',
}: PracticePageShellProps) {
	const contentFill = contentLayout === 'fill';
	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-theme/10 px-2">
						<div className="flex min-w-0 flex-1 items-center gap-1.5">
							{onBack ? (
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="shrink-0 text-textcolor/80"
									onClick={onBack}
									aria-label={backLabel}
								>
									<ArrowLeft className="size-4" />
								</Button>
							) : null}
							<div className="min-w-0 text-textcolor truncate text-base font-semibold">
								{subtitle || title}
							</div>
						</div>
						{headerRight ? (
							<div className="flex shrink-0 items-center gap-2">
								{headerRight}
							</div>
						) : null}
					</header>
					<ScrollArea
						className="min-h-0 flex-1"
						viewportClassName={cn(
							'flex h-full min-h-0 flex-col',
							contentFill && '[&>div]:min-h-full!',
						)}
					>
						<div
							className={cn(
								'flex min-h-full flex-1 flex-col px-4.5 py-4',
								contentFill ? 'min-h-0 justify-start' : 'justify-center',
							)}
						>
							{children}
						</div>
					</ScrollArea>
				</div>
			</div>
		</div>
	);
}
