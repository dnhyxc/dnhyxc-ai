import { Button } from '@ui/index';
import { cn } from '@/lib/utils';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../../constants';

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
				className={cn(
					'h-10 w-full transition-none',
					PRACTICE_PRIMARY_ACTION_BTN_CLASS,
				)}
				onClick={onRetry}
			>
				{tryAgainLabel}
			</Button>
			{canGoPrevious ? (
				<Button
					type="button"
					className={cn(
						'h-10 w-full transition-none',
						PRACTICE_PRIMARY_ACTION_BTN_CLASS,
					)}
					onClick={onPrevious}
				>
					{previousLabel}
				</Button>
			) : null}
			<Button
				type="button"
				className={cn(
					'h-10 w-full transition-none',
					PRACTICE_PRIMARY_ACTION_BTN_CLASS,
				)}
				onClick={onNext}
			>
				{nextLabel}
			</Button>
		</div>
	);
}
