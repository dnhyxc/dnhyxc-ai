import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SIDEBAR_CARD } from '../tokens';

/** 左栏内统一区块卡片容器 */
export function SidebarPanel({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return <div className={cn(SIDEBAR_CARD, className)}>{children}</div>;
}
