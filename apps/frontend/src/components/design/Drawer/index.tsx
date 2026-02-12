import { X } from 'lucide-react';
import * as React from 'react';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export interface DrawerProps {
	/** 控制 Drawer 是否打开 */
	open?: boolean;
	/** Open 状态改变时的回调 */
	onOpenChange?: (open: boolean) => void;
	/** 默认是否打开 (非受控模式) */
	defaultOpen?: boolean;
	/** 触发 Drawer 打开的元素 */
	trigger?: React.ReactNode;
	/** Drawer 的标题 */
	title?: React.ReactNode;
	/** Drawer 的描述 */
	description?: React.ReactNode;
	/** Drawer 的位置，默认为 'right' */
	side?: 'top' | 'right' | 'bottom' | 'left';
	/** Drawer 内容区域的额外类名 */
	className?: string;
	/** Drawer Body 区域的额外类名 */
	bodyClassName?: string;
	/** Drawer 主要内容 */
	children?: React.ReactNode;
	/** Drawer 底部内容 */
	footer?: React.ReactNode;
	/** 是否隐藏关闭按钮 (通过 CSS 实现) */
	hideClose?: boolean;
	/** 宽度 (仅在 side 为 left/right 时生效)，例如 "w-[400px]" or "sm:max-w-[600px]" */
	width?: string;
}

/**
 * 通用 Drawer 组件 (基于 Sheet 封装)
 * 提供了统一的 Header, Body (可滚动), Footer 布局
 */
export function Drawer({
	open,
	onOpenChange,
	defaultOpen,
	trigger,
	title,
	description,
	side = 'right',
	className,
	bodyClassName,
	children,
	footer,
	hideClose,
	width,
}: DrawerProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
			{trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
			<SheetContent
				side={side}
				className={cn(
					'flex flex-col gap-0 outline-none', // gap-0 to manually control spacing via padding
					width,
					className,
				)}
				aria-describedby={undefined}
			>
				{/* 确保至少有一个 DialogTitle，用于无障碍访问 */}
				<div className="sr-only">
					<SheetTitle>
						{typeof title === 'string' ? title : 'Drawer'}
					</SheetTitle>
					<SheetDescription>
						{typeof description === 'string' ? description : 'Drawer Content'}
					</SheetDescription>
				</div>

				{(title || description) && (
					<SheetHeader className="px-4 py-4 border-b border-theme/10 shrink-0">
						{title && (
							<SheetTitle>
								<div className="flex justify-between items-center">
									<div className="title">{title}</div>
									{hideClose ? null : (
										<div className="-mr-1">
											<X
												size={20}
												className="text-textcolor/80 hover:text-textcolor cursor-pointer"
												onClick={() => onOpenChange?.(false)}
											/>
										</div>
									)}
								</div>
							</SheetTitle>
						)}
						{description && <SheetDescription>{description}</SheetDescription>}
					</SheetHeader>
				)}

				<div
					className={cn('flex-1 overflow-hidden px-4 pr-0 py-4', bodyClassName)}
				>
					{children}
				</div>

				{footer && (
					<SheetFooter className="px-4 py-4 border-t shrink-0 bg-background">
						{footer}
					</SheetFooter>
				)}
			</SheetContent>
		</Sheet>
	);
}
