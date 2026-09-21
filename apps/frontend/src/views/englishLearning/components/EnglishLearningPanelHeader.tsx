import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EnglishLearningPanelHeaderProps = {
	/** 主标题（字符串或带计数等复合内容） */
	title: ReactNode;
	/** 标题容器额外 class（如收藏页标题行内 flex） */
	titleClassName?: string;
	/** 标题右侧、trailing 左侧：全选 / 移除 / 练习等操作 */
	actions?: ReactNode;
	/** 最右侧：分类 Tab 等 */
	trailing?: ReactNode;
	className?: string;
};

/**
 * 英语学习内嵌面板顶栏：左侧标题，右侧 actions + trailing。
 */
export function EnglishLearningPanelHeader({
	title,
	titleClassName,
	actions,
	trailing,
	className,
}: EnglishLearningPanelHeaderProps) {
	return (
		<header
			className={cn(
				'flex h-12 shrink-0 items-center gap-3 border-b border-theme/8 px-4',
				className,
			)}
		>
			<h2
				className={cn(
					'text-textcolor min-w-0 flex-1 overflow-hidden text-base font-semibold',
					titleClassName,
				)}
			>
				{title}
			</h2>
			{actions != null ? (
				<div className="flex shrink-0 items-center">{actions}</div>
			) : null}
			{trailing != null ? (
				<div className="flex shrink-0 items-center gap-2">{trailing}</div>
			) : null}
		</header>
	);
}
