import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ElResumeModuleKey } from '@/views/englishLearning/utils/elResumeModule';
import { SIDEBAR_CARD } from '../tokens';
import {
	type EnglishSidebarAction,
	EnglishSidebarActions,
} from './EnglishSidebarActions';
import { EnglishSidebarHeader } from './EnglishSidebarHeader';

export type { EnglishSidebarAction };

export type EnglishSidebarCardProps = {
	className?: string;
	/** 标题上方（如 Confirm） */
	prepend?: ReactNode;
	resumeModuleKey?: ElResumeModuleKey;
	icon: LucideIcon;
	iconGradient: string;
	title: string;
	description?: ReactNode;
	headerClassName?: string;
	children?: ReactNode;
	actions?: EnglishSidebarAction[];
	actionsClassName?: string;
};

/** 英语学习侧栏统一卡片：容器 + 标题区 + 可选内容 + 可选底栏按钮 */
export function EnglishSidebarCard({
	className,
	prepend,
	resumeModuleKey,
	icon,
	iconGradient,
	title,
	description,
	headerClassName,
	children,
	actions,
	actionsClassName,
}: EnglishSidebarCardProps) {
	return (
		<div className={cn(SIDEBAR_CARD, className)}>
			{prepend}
			<EnglishSidebarHeader
				icon={icon}
				iconGradient={iconGradient}
				title={title}
				resumeModuleKey={resumeModuleKey}
				description={description}
				className={headerClassName}
			/>
			{children}
			{actions && actions.length > 0 ? (
				<EnglishSidebarActions actions={actions} className={actionsClassName} />
			) : null}
		</div>
	);
}
