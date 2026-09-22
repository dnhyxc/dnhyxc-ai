/**
 * 练习页布局壳：顶栏 + 可滚动内容区
 */
import { ScrollArea } from '@ui/index';
import { cn } from '@/lib/utils';
import { SessionHeader } from '../../../components/SessionHeader';
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
						<SessionHeader
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
						</SessionHeader>
					) : null}
					<ScrollArea
						className="min-h-0 flex-1"
						viewportClassName={cn(
							'flex h-full min-h-0 flex-col',
							contentFill &&
								'[&>div]:flex! [&>div]:h-full! [&>div]:min-h-full! [&>div]:flex-col',
						)}
					>
						<div
							className={cn(
								'flex min-h-full flex-1 flex-col',
								flush ? 'min-h-0 p-0' : 'p-4',
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
