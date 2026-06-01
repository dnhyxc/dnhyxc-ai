import { Button } from '@ui/index';
import { cn } from '@/lib/utils';

type SessionWrongActionsProps = {
	visible: boolean;
	canGoPrevious: boolean;
	tryAgainLabel: string;
	previousLabel: string;
	nextLabel: string;
	onRetry: () => void;
	onPrevious: () => void;
	onNext: () => void;
};

export function SessionWrongActions({
	visible,
	canGoPrevious,
	tryAgainLabel,
	previousLabel,
	nextLabel,
	onRetry,
	onPrevious,
	onNext,
}: SessionWrongActionsProps) {
	return (
		<div
			className={cn(
				'grid gap-2 pt-4 transition-none',
				canGoPrevious ? 'grid-cols-3' : 'grid-cols-2',
				!visible && 'hidden',
			)}
		>
			<Button
				type="button"
				className="h-10 w-full transition-none"
				onClick={onRetry}
			>
				{tryAgainLabel}
			</Button>
			{canGoPrevious ? (
				<Button
					type="button"
					className="h-10 w-full transition-none"
					onClick={onPrevious}
				>
					{previousLabel}
				</Button>
			) : null}
			<Button
				type="button"
				className="h-10 w-full transition-none"
				onClick={onNext}
			>
				{nextLabel}
			</Button>
		</div>
	);
}
