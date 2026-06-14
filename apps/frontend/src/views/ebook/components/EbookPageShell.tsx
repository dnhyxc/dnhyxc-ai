import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EbookPageShellProps = {
	header?: ReactNode;
	footer?: ReactNode;
	children: ReactNode;
	/** 内容区额外 class */
	contentClassName?: string;
	/** 是否在内容区施加默认内边距 */
	contentPadding?: boolean;
};

/**
 * 电子书页面布局壳：与英语学习收藏/练习页一致的圆角面板 + 顶栏/底栏。
 */
export function EbookPageShell({
	header,
	footer,
	children,
	contentClassName,
	contentPadding = true,
}: EbookPageShellProps) {
	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					{header}
					<div
						className={cn(
							'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
							contentPadding && 'px-4.5 py-4',
							contentClassName,
						)}
					>
						{children}
					</div>
					{footer}
				</div>
			</div>
		</div>
	);
}
