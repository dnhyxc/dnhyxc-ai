import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/index';

interface IProps {
	children: React.ReactNode;
	content: React.ReactNode | string;
	side?: 'left' | 'top' | 'bottom' | 'right';
	sideOffset?: number;
	delayDuration?: number;
	disabled?: boolean;
	className?: string;
	/** 传给 Radix Root：指针移入浮层不保持展开（列表行内小按钮建议开启） */
	disableHoverableContent?: boolean;
	/** 是否显示主题色外阴影；默认关闭 */
	shadow?: boolean;
}

const TooltipSide: React.FC<IProps> = ({
	children,
	content,
	side = 'top',
	sideOffset = 4,
	delayDuration,
	disabled = false,
	className,
	disableHoverableContent,
	shadow = false,
}) => {
	// 当 content 为空、disabled 为 true 或 children 无效时，直接返回 children
	if (!content || disabled || !children) {
		return <>{children}</>;
	}

	return (
		<Tooltip
			delayDuration={delayDuration}
			disableHoverableContent={disableHoverableContent}
		>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent
				side={side}
				sideOffset={sideOffset}
				shadow={shadow}
				className={className}
			>
				{content}
			</TooltipContent>
		</Tooltip>
	);
};

export default TooltipSide;
