import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** 左栏内统一区块容器 */
export function SidebarPanel({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn('rounded-none px-4 pb-3', className)}>{children}</div>
	);
}
