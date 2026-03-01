import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/index';

interface IProps {
	children: React.ReactNode;
	content: React.ReactNode | string;
	side?: 'left' | 'top' | 'bottom' | 'right';
	sideOffset?: number;
	delayDuration?: number;
	disabled?: boolean;
	className?: string;
}

const TooltipSide: React.FC<IProps> = ({
	children,
	content,
	side = 'top',
	sideOffset = 4,
	delayDuration,
	disabled = false,
	className,
}) => {
	// 当 content 为空、disabled 为 true 或 children 无效时，直接返回 children
	if (!content || disabled || !children) {
		return <>{children}</>;
	}

	return (
		<Tooltip delayDuration={delayDuration}>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side={side} sideOffset={sideOffset} className={className}>
				{content}
			</TooltipContent>
		</Tooltip>
	);
};

export default TooltipSide;
