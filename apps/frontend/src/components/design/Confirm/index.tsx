import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: ReactNode;
	/** 描述区域额外 className（例如 text-left） */
	descriptionClassName?: string;
	confirmText?: string;
	cancelText?: string;
	/** 确认按钮样式，覆盖保存等危险操作用 destructive */
	confirmVariant?: 'default' | 'destructive';
	/**
	 * 点击确认后是否立即关闭。异步 onConfirm 且需在失败时保持打开时设为 false，由调用方自行 onOpenChange(false)
	 */
	closeOnConfirm?: boolean;
	onConfirm: () => void;
	onCancel?: () => void;
	className?: string;
}

const Confirm = ({
	open,
	onOpenChange,
	title,
	description,
	descriptionClassName,
	confirmText = '确认',
	cancelText = '取消',
	confirmVariant = 'default',
	closeOnConfirm = true,
	onConfirm,
	onCancel,
	className,
}: ConfirmProps) => {
	const handleConfirm = () => {
		onConfirm();
		if (closeOnConfirm) {
			onOpenChange(false);
		}
	};

	const handleCancel = () => {
		onCancel?.();
		onOpenChange(false);
	};

	return (
		<AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<AlertDialogPrimitive.Portal>
				<AlertDialogPrimitive.Overlay
					className={cn(
						'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-theme-background/80',
					)}
				/>
				<AlertDialogPrimitive.Content
					className={cn(
						'bg-theme-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-theme/10 p-6 shadow-lg duration-200 sm:max-w-lg',
						className,
					)}
				>
					<AlertDialogPrimitive.Title className="text-lg font-semibold">
						{title}
					</AlertDialogPrimitive.Title>
					{/* 使用 asChild + div：避免默认 <p> 内嵌 <div> 导致非法 DOM 与水合报错 */}
					<AlertDialogPrimitive.Description asChild>
						<div
							className={cn('text-textcolor text-md', descriptionClassName)}
						>
							{description}
						</div>
					</AlertDialogPrimitive.Description>
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
						<AlertDialogPrimitive.Cancel
							onClick={handleCancel}
							className={cn(buttonVariants({ variant: 'outline' }))}
						>
							{cancelText}
						</AlertDialogPrimitive.Cancel>
						<AlertDialogPrimitive.Action
							onClick={handleConfirm}
							className={cn(buttonVariants({ variant: confirmVariant }))}
						>
							{confirmText}
						</AlertDialogPrimitive.Action>
					</div>
				</AlertDialogPrimitive.Content>
			</AlertDialogPrimitive.Portal>
		</AlertDialogPrimitive.Root>
	);
};

export default Confirm;
