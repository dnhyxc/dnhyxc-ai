import { Button } from '@ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@ui/dialog';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title?: string;
	children: React.ReactNode;
	width?: string;
	height?: string;
	header?: React.ReactNode;
	footer?: React.ReactNode;
	description?: string;
	trigger?: React.ReactNode;
	onSubmit?: () => void;
	close?: () => void;
	showFooter?: boolean;
	showClose?: boolean;
	showCloseIcon?: boolean;
}

const Model: React.FC<IProps> = ({
	title,
	trigger,
	header,
	footer,
	width = '325px',
	height = 'auto',
	children,
	description,
	open,
	onOpenChange,
	onSubmit,
	close: _close,
	showFooter,
	showClose = true,
	showCloseIcon = true,
}) => {
	const onOk = () => {
		onSubmit?.();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
			<DialogContent
				showCloseButton={showCloseIcon}
				style={{ maxWidth: width, height }}
			>
				{header ? (
					<DialogHeader>
						{/* 隐藏的标题用于可访问性 */}
						<DialogTitle className="sr-only">{title}</DialogTitle>
						{/* 隐藏的描述用于可访问性 */}
						<DialogDescription className="sr-only">
							{description}
						</DialogDescription>
						{header}
					</DialogHeader>
				) : (
					<DialogHeader>
						{title && <DialogTitle>{title}</DialogTitle>}
						{description ? (
							<DialogDescription>{description}</DialogDescription>
						) : (
							<DialogDescription className="sr-only"></DialogDescription>
						)}
					</DialogHeader>
				)}
				{children}
				{showFooter !== false && footer !== null ? (
					<footer>
						<Button
							type="submit"
							className="cursor-pointer w-20"
							onClick={onOk}
						>
							确定
						</Button>
						{showClose && (
							<DialogClose asChild>
								<Button variant="outline" className="cursor-pointer w-20">
									取消
								</Button>
							</DialogClose>
						)}
					</footer>
				) : footer === null ? null : (
					<DialogFooter />
				)}
			</DialogContent>
		</Dialog>
	);
};

export default Model;
