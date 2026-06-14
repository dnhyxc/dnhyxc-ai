import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EbookPanelHeaderProps = {
	title: ReactNode;
	subtitle?: ReactNode;
	leading?: ReactNode;
	trailing?: ReactNode;
	className?: string;
};

export function EbookPanelHeader({
	title,
	subtitle,
	leading,
	trailing,
	className,
}: EbookPanelHeaderProps) {
	return (
		<header
			className={cn(
				'flex h-12 shrink-0 items-center justify-between gap-3 border-b border-theme/10 px-2',
				className,
			)}
		>
			<div className="flex min-w-0 flex-1 items-center gap-1.5">
				{leading}
				<div className="min-w-0">
					<h1 className="text-textcolor truncate text-base font-semibold">
						{title}
					</h1>
					{subtitle ? (
						<p className="text-textcolor/55 truncate text-xs">{subtitle}</p>
					) : null}
				</div>
			</div>
			{trailing ? (
				<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
					{trailing}
				</div>
			) : null}
		</header>
	);
}
