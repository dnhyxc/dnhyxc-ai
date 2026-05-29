import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EnglishLearningPanelHeaderProps = {
	/** 主标题（字符串或带计数等复合内容） */
	title: ReactNode;
	/** 标题容器额外 class（如收藏页标题行内 flex） */
	titleClassName?: string;
	/** 右侧操作区：练习入口、分类 Tab、自定义按钮等 */
	trailing?: ReactNode;
	className?: string;
};

/**
 * 英语学习内嵌面板顶栏：固定高度、左右分布，左侧标题 + 右侧 trailing。
 * 用于收藏、错题集等同构「圆角卡片 + 列表」页面。
 */
export function EnglishLearningPanelHeader({
	title,
	titleClassName,
	trailing,
	className,
}: EnglishLearningPanelHeaderProps) {
	return (
		<header
			className={cn(
				'h-12 flex shrink-0 items-center justify-between gap-4 px-4.5 py-2',
				className,
			)}
		>
			<h2
				className={cn(
					'text-textcolor min-w-0 text-base font-semibold',
					titleClassName,
				)}
			>
				{title}
			</h2>
			{trailing != null ? (
				<div className="flex shrink-0 items-center gap-2">{trailing}</div>
			) : null}
		</header>
	);
}
