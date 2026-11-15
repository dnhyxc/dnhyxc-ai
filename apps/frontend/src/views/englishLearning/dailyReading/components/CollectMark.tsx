import { Button } from '@ui/index';
import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CollectMark({
	pressed,
	disabled,
	label,
	className,
	onClick,
}: {
	pressed: boolean;
	disabled: boolean;
	label: string;
	className?: string;
	onClick: () => void;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			disabled={disabled}
			aria-pressed={pressed}
			aria-label={label}
			className={cn(
				'size-6 shrink-0 rounded-md p-0 shadow-none',
				pressed ? 'text-teal-500' : 'text-textcolor/55 hover:text-teal-400',
				className,
			)}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onClick();
			}}
		>
			<Bookmark
				className={cn('size-4', pressed && 'fill-current')}
				aria-hidden
			/>
		</Button>
	);
}
