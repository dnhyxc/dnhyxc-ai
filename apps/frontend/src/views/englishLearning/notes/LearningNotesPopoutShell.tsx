import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
	children: ReactNode;
	className?: string;
};

/** 独立窗口壳：与主窗 layout 一致的 py-7/pr-7 + 内容区 p-5.5，顶栏可拖动 */
export function LearningNotesPopoutShell({ children, className }: Props) {
	return (
		<div
			data-tauri-drag-region
			className={cn(
				'flex h-dvh p-7 pt-7.5 min-h-0 w-full flex-col overflow-hidden bg-theme-background',
				className,
			)}
		>
			<div className="box-border flex min-h-0 bg-theme-secondary rounded-md flex-1 flex-col overflow-hidden p-2">
				<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col pt-0">
					{children}
				</div>
			</div>
		</div>
	);
}
