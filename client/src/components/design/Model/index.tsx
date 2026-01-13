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
	onOpenChange: () => void;
	title: string;
	children: React.ReactNode;
	width?: string;
	header?: React.ReactNode;
	footer?: React.ReactNode;
	description?: string;
	trigger?: React.ReactNode;
	onSubmit?: () => void;
}

const Model: React.FC<IProps> = ({
	title,
	trigger,
	header,
	footer,
	width = '325px',
	children,
	description,
	open,
	onOpenChange,
	onSubmit,
}) => {
	const onOk = () => {
		onSubmit?.();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
			<DialogContent style={{ maxWidth: width }}>
				{header ? (
					<DialogHeader>{header}</DialogHeader>
				) : (
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						{description ? (
							<DialogDescription>{description}</DialogDescription>
						) : null}
					</DialogHeader>
				)}
				{children}
				{footer ? (
					<DialogFooter>{footer}</DialogFooter>
				) : footer === null ? null : (
					<DialogFooter>
						<Button
							type="submit"
							className="cursor-pointer w-20"
							onClick={onOk}
						>
							确定
						</Button>
						<DialogClose asChild>
							<Button variant="outline" className="cursor-pointer w-20">
								取消
							</Button>
						</DialogClose>
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default Model;
