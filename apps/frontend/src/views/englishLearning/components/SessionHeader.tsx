/**
 * 英语学习会话页顶栏：返回 / 主内容 / 右侧操作。
 * 默认 px-2；用 className 覆盖 padding 等（如 pl-4 pr-2）。
 */
import { Button } from '@ui/index';
import { ArrowLeft } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SessionHeaderProps = {
	onBack?: () => void;
	backLabel?: string;
	/** 中间主内容（标题、进度、词表名等） */
	children?: ReactNode;
	/** 右侧操作区；有内容时自动靠右 */
	trailing?: ReactNode;
	className?: string;
	/** 中间区额外 class */
	contentClassName?: string;
	/** 右侧区额外 class */
	trailingClassName?: string;
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'title'>;

export function SessionHeader({
	onBack,
	backLabel,
	children,
	trailing,
	className,
	contentClassName,
	trailingClassName,
	...rest
}: SessionHeaderProps) {
	return (
		<header
			className={cn(
				'border-theme/10 flex h-12 shrink-0 items-center gap-2 border-b px-2',
				className,
			)}
			{...rest}
		>
			{onBack ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					tabIndex={-1}
					className="text-textcolor/80 shrink-0"
					onClick={onBack}
					aria-label={backLabel}
				>
					<ArrowLeft className="size-4" />
				</Button>
			) : null}
			{children != null ? (
				<div
					className={cn(
						'text-textcolor flex min-w-0 items-center gap-2 text-base whitespace-nowrap',
						contentClassName,
					)}
				>
					{children}
				</div>
			) : null}
			{trailing != null ? (
				<div
					className={cn(
						'ml-auto flex shrink-0 items-center gap-1.5',
						trailingClassName,
					)}
				>
					{trailing}
				</div>
			) : null}
		</header>
	);
}
