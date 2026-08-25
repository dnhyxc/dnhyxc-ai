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
			className={cn(
				'flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-theme-background',
				className,
			)}
		>
			<div
				data-tauri-drag-region
				className="box-border shrink-0 pt-6"
				aria-hidden
			/>
			<div className="box-border flex min-h-0 flex-1 flex-col overflow-hidden pb-7">
				<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col pt-0">
					{children}
				</div>
			</div>
		</div>
	);
}
