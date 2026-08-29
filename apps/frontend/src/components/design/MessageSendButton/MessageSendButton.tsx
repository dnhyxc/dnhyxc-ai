import { Button } from '@ui/index';
import { Loader2, Rocket } from 'lucide-react';
import { type ComponentProps, forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** ChatEntry / 助手输入区统一发送钮视觉（浅底 + ring + teal 图标） */
export const MESSAGE_SEND_BUTTON_CLASS =
	'lucide-stroke-draw-hover h-8.5 w-8.5 flex shrink-0 items-center justify-center rounded-full border border-teal-500/10 ring-2 ring-teal-400/35 bg-linear-to-r from-teal-300/10 to-teal-500/10 p-0 text-teal-500 shadow-none hover:bg-teal-500/15 hover:text-teal-500 disabled:opacity-45 [&_svg]:overflow-visible';

export type MessageSendButtonProps = Omit<
	ComponentProps<typeof Button>,
	'children' | 'variant' | 'size'
> & {
	/** true 时展示 loadingIcon（默认 Loader2），仍由 disabled 控制是否可点 */
	loading?: boolean;
	/** 传入时完全自定义图标区（语音 Mic/停录 Square 等） */
	children?: ReactNode;
	icon?: ReactNode;
	loadingIcon?: ReactNode;
	/** 未传 aria-label 时的默认无障碍文案 */
	sendLabel?: string;
};

export const MessageSendButton = forwardRef<
	HTMLButtonElement,
	MessageSendButtonProps
>(function MessageSendButton(
	{
		loading = false,
		children,
		icon,
		loadingIcon,
		sendLabel = '发送',
		className,
		type = 'button',
		'aria-label': ariaLabel,
		...rest
	},
	ref,
) {
	const content =
		children ??
		(loading
			? (loadingIcon ?? <Loader2 className="h-4 w-4 animate-spin" />)
			: (icon ?? <Rocket className="h-4 w-4 -rotate-45" />));

	return (
		<Button
			ref={ref}
			type={type}
			variant="ghost"
			size="icon"
			aria-label={ariaLabel ?? sendLabel}
			className={cn(MESSAGE_SEND_BUTTON_CLASS, className)}
			{...rest}
		>
			{content}
		</Button>
	);
});

export default MessageSendButton;
