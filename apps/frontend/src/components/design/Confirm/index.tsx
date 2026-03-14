import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel?: () => void;
	className?: string;
}

const Confirm = ({
	open,
	onOpenChange,
	title,
	description,
	confirmText = '确认',
	cancelText = '取消',
	onConfirm,
	onCancel,
	className,
}: ConfirmProps) => {
	const handleConfirm = () => {
		onConfirm();
		onOpenChange(false);
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
					<AlertDialogPrimitive.Description className="text-textcolor text-md">
						{description}
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
							className={cn(buttonVariants())}
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
