import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { epubReaderChromeBorderColorClass } from '../../utils/epub/reader/epubReaderSettings';

export type EbookPanelHeaderProps = {
	title?: ReactNode;
	subtitle?: ReactNode;
	leading?: ReactNode;
	/** 标题与 trailing 之间的区域（如书架分类 Tab） */
	middle?: ReactNode;
	trailing?: ReactNode;
	className?: string;
};

/** 电子书面板顶栏统一高度 */
export const EBOOK_PANEL_BAR_HEIGHT_CLASS = 'h-12';

export function EbookPanelHeader({
	title,
	subtitle,
	leading,
	middle,
	trailing,
	className,
}: EbookPanelHeaderProps) {
	const hasMiddle = middle != null;
	const hasTitleBlock = title != null || leading != null;

	return (
		<header
			className={cn(
				EBOOK_PANEL_BAR_HEIGHT_CLASS,
				'flex shrink-0 items-stretch gap-4.5 border-b px-2',
				epubReaderChromeBorderColorClass,
				className,
			)}
		>
			{hasTitleBlock ? (
				<div
					className={cn(
						'flex items-center gap-1.5',
						hasMiddle ? 'shrink-0' : 'min-w-0 flex-1 overflow-hidden',
					)}
				>
					{leading}
					{title != null ? (
						<div
							className={cn(
								hasMiddle ? 'shrink-0' : 'min-w-0 flex-1 overflow-hidden',
							)}
						>
							{typeof title === 'string' ? (
								<h1 className="text-textcolor flex min-w-0 items-center gap-1.5 overflow-hidden text-base font-semibold whitespace-nowrap">
									{title}
								</h1>
							) : (
								<div className="flex min-w-0 flex-1 items-center overflow-hidden text-base font-semibold">
									{title}
								</div>
							)}
							{subtitle ? (
								<p className="text-textcolor/55 truncate text-xs">{subtitle}</p>
							) : null}
						</div>
					) : null}
				</div>
			) : null}
			{hasMiddle ? (
				<div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
					{middle}
				</div>
			) : null}
			{trailing ? (
				<div className="flex shrink-0 items-center gap-1">{trailing}</div>
			) : null}
		</header>
	);
}
