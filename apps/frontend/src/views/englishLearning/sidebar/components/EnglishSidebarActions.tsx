import { Button } from '@ui/index';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ENGLISH_SIDEBAR_BTN_GRADIENT } from '../sidebarAccents';
import {
	SIDEBAR_ACTIONS_ROW,
	SIDEBAR_BTN_PRIMARY_BASE,
	SIDEBAR_BTN_SECONDARY,
} from '../tokens';

export type EnglishSidebarAction = {
	label: ReactNode;
	onClick: () => void;
	disabled?: boolean;
	variant?: 'primary' | 'secondary';
	gradientKey?: keyof typeof ENGLISH_SIDEBAR_BTN_GRADIENT;
	className?: string;
};

type EnglishSidebarActionsProps = {
	actions: EnglishSidebarAction[];
	className?: string;
};

export function EnglishSidebarActions({
	actions,
	className,
}: EnglishSidebarActionsProps) {
	return (
		<div className={cn(SIDEBAR_ACTIONS_ROW, 'mt-3', className)}>
			{actions.map((action, index) => {
				const isSecondary = action.variant === 'secondary';
				return (
					<Button
						key={index}
						type="button"
						size="sm"
						disabled={action.disabled}
						className={cn(
							isSecondary
								? SIDEBAR_BTN_SECONDARY
								: cn(
										SIDEBAR_BTN_PRIMARY_BASE,
										action.gradientKey &&
											ENGLISH_SIDEBAR_BTN_GRADIENT[action.gradientKey],
									),
							action.className,
						)}
						onClick={action.onClick}
					>
						{action.label}
					</Button>
				);
			})}
		</div>
	);
}
