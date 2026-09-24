/**
 * 练习页布局壳：顶栏 + 可滚动内容区
 */
import { ScrollArea } from '@ui/index';
import { cn } from '@/lib/utils';
import { Head } from '../../../components/shell';
import type { PracticePageShellProps } from '../../types';

export function PracticePageShell({
	title,
	subtitle,
	onBack,
	backLabel,
	headerRight,
	children,
	contentLayout = 'center',
	flush = false,
}: PracticePageShellProps) {
	const contentFill = contentLayout === 'fill' || flush;
	const contentStart = contentLayout === 'start';
	const showHeader =
		!flush &&
		(onBack != null ||
			headerRight != null ||
			title != null ||
			subtitle != null);
	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					{showHeader ? (
						<Head
							className="px-4"
							onBack={onBack}
							backLabel={backLabel}
							trailing={headerRight}
							trailingClassName="gap-2"
						>
							{typeof (subtitle ?? title) === 'string' ? (
								<span className="min-w-0 truncate">{subtitle ?? title}</span>
							) : (
								(subtitle ?? title)
							)}
						</Head>
					) : null}
					{/* p-4 在 Root：右侧留白给滚动条贴边；fill 时内容仍占满视口 */}
					<ScrollArea
						className={cn('min-h-0 flex-1', !flush && 'p-4')}
						viewportClassName={cn(
							contentFill &&
								'flex h-full min-h-0 flex-col [&>div]:flex! [&>div]:h-full! [&>div]:min-h-full! [&>div]:flex-col',
							contentStart &&
								'h-full [overflow-anchor:none] [&>div]:block! [&>div]:min-h-0! [&>div]:h-auto! [&>div]:w-full! [&>div]:min-w-0!',
						)}
						scrollbarClassName={!flush ? '!top-4 !bottom-4 h-auto' : undefined}
					>
						<div
							className={cn(
								'flex flex-1 flex-col',
								flush && 'min-h-0',
								contentFill && 'h-full min-h-0 justify-start',
								contentStart && 'justify-start',
								!contentFill && !contentStart && 'min-h-full justify-center',
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
