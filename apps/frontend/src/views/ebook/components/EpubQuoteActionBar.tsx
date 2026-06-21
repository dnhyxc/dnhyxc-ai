import {
	ALargeSmall,
	CheckCircle,
	Copy,
	type LucideIcon,
	MessageSquarePlus,
	Search,
	Share2,
	Strikethrough,
} from 'lucide-react';
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { cn } from '@/lib/utils';

export type EpubQuoteActionBarLabels = {
	copy: string;
	/** 复制成功后的按钮文案，默认与 MOKE 助手「已复制」一致 */
	copied?: string;
	underline: string;
	removeUnderline: string;
	writeThought: string;
	share: string;
	askBook: string;
	listen: string;
};

export type EpubQuoteActionBarProps = {
	labels: EpubQuoteActionBarLabels;
	onCopy: () => void;
	onWriteThought: () => void;
	onAskBook: () => void;
	onUnderline?: () => void;
	onRemoveUnderline?: () => void;
	/** 当前选区是否已有用户划线 */
	hasHighlight?: boolean;
	variant?: 'floating' | 'inline' | 'drawer';
	/** 浮动条：任意按钮点击后回调（不含划线相关操作） */
	onAnyAction?: () => void;
	className?: string;
};

type BarVariant = NonNullable<EpubQuoteActionBarProps['variant']>;
type ActionId = Exclude<keyof EpubQuoteActionBarLabels, 'copied'>;
/** 划线 / 删除划线互斥，占同一工具栏槽位 */
type HighlightToggleSlot = 'highlightToggle';
type RenderActionId = ActionId | HighlightToggleSlot;

/** 点击后不收起选区 / PopBar 的操作 */
const PRESERVE_SELECTION_ACTIONS = new Set<ActionId>([
	'underline',
	'removeUnderline',
	'share',
	'listen',
]);

const ACTION_ORDER: Record<BarVariant, ActionId[]> = {
	drawer: [
		'copy',
		'underline',
		'removeUnderline',
		'writeThought',
		'share',
		'askBook',
		'listen',
	],
	inline: [
		'copy',
		'writeThought',
		'askBook',
		'underline',
		'removeUnderline',
		'share',
		'listen',
	],
	floating: [
		'copy',
		'underline',
		'removeUnderline',
		'writeThought',
		'share',
		'askBook',
		'listen',
	],
};

const ACTION_ICONS: Partial<Record<ActionId, LucideIcon>> = {
	copy: Copy,
	underline: ALargeSmall,
	removeUnderline: Strikethrough,
	writeThought: MessageSquarePlus,
	share: Share2,
	askBook: Search,
};

const HANDLER_PROP: Partial<
	Record<
		ActionId,
		| 'onCopy'
		| 'onWriteThought'
		| 'onAskBook'
		| 'onUnderline'
		| 'onRemoveUnderline'
	>
> = {
	copy: 'onCopy',
	underline: 'onUnderline',
	removeUnderline: 'onRemoveUnderline',
	writeThought: 'onWriteThought',
	askBook: 'onAskBook',
};

const CONTAINER_CLASS: Record<BarVariant, string> = {
	drawer: 'flex h-full w-full min-w-0 items-stretch',
	inline:
		'flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-theme/10 bg-theme/5',
	floating: 'flex items-center px-0.5',
};

const ICON_CLASS: Record<BarVariant, string> = {
	drawer: 'stroke-[1.5]',
	inline: 'stroke-[1.75]',
	floating: 'size-4 stroke-[1.75]',
};

const LISTEN_CLASS: Record<BarVariant, string> = {
	drawer: 'text-sm font-semibold leading-none',
	inline: 'text-[11px] font-semibold leading-none',
	floating: 'text-sm font-semibold leading-none',
};

const ITEM_BUTTON_CLASS: Record<BarVariant, string> = {
	drawer:
		'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 transition-colors',
	inline:
		'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-theme/10 border-r py-2 px-0.5 text-xs transition-colors last:border-r-0',
	floating:
		'flex shrink-0 flex-col items-center gap-0.5 rounded-md py-2 transition-colors',
};

const ITEM_ACTIVE_CLASS: Record<BarVariant, string> = {
	drawer: 'text-textcolor/80 hover:text-teal-500 cursor-pointer',
	inline: 'text-textcolor/80 hover:text-teal-500',
	floating: 'cursor-pointer text-textcolor/80 hover:text-teal-500',
};

const ITEM_DISABLED_CLASS: Record<BarVariant, string> = {
	drawer: 'text-textcolor/50 cursor-default',
	inline: 'cursor-default text-textcolor/50',
	floating: 'cursor-default text-textcolor/80',
};

const ICON_WRAP_CLASS: Record<BarVariant, string> = {
	drawer: 'flex size-4 items-center justify-center [&_svg]:size-4',
	inline: 'flex size-4 shrink-0 items-center justify-center [&_svg]:size-4',
	floating: 'flex h-4 w-4 items-center justify-center',
};

const COPY_SUCCESS_MS = 1000;

const LABEL_CLASS: Record<BarVariant, string> = {
	drawer: 'w-full text-center text-xs pt-0.5 leading-tight',
	inline: 'w-full text-center text-xs pt-0.5 leading-tight',
	floating: 'w-full text-center text-xs leading-none pt-1',
};

function QuoteActionItem({
	variant,
	label,
	onClick,
	copied,
	children,
}: {
	variant: BarVariant;
	label: string;
	onClick?: () => void;
	copied?: boolean;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={variant === 'floating' ? { width: 70 } : undefined}
			className={cn(
				ITEM_BUTTON_CLASS[variant],
				onClick ? ITEM_ACTIVE_CLASS[variant] : ITEM_DISABLED_CLASS[variant],
				copied && 'text-teal-500',
			)}
		>
			<span className={ICON_WRAP_CLASS[variant]}>{children}</span>
			<span className={cn(LABEL_CLASS[variant], copied && 'text-teal-500')}>
				{label}
			</span>
		</button>
	);
}

function renderActionIcon(
	id: ActionId,
	variant: BarVariant,
	copySucceeded: boolean,
) {
	if (id === 'copy' && copySucceeded) {
		return (
			<CheckCircle
				className={cn(ICON_CLASS[variant], 'text-teal-500')}
				aria-hidden
			/>
		);
	}
	if (id === 'listen') {
		return <span className={LISTEN_CLASS[variant]}>听</span>;
	}
	const Icon = ACTION_ICONS[id];
	if (!Icon) return null;
	return <Icon className={ICON_CLASS[variant]} aria-hidden />;
}

/** 将 underline / removeUnderline 合并为单一槽位，按 hasHighlight 切换展示 */
function buildRenderActions(
	variant: BarVariant,
	onUnderline?: () => void,
	onRemoveUnderline?: () => void,
): RenderActionId[] {
	const result: RenderActionId[] = [];
	let highlightSlotAdded = false;

	for (const id of ACTION_ORDER[variant]) {
		if (id === 'underline' || id === 'removeUnderline') {
			if (highlightSlotAdded) continue;
			if (!onUnderline && !onRemoveUnderline) continue;
			highlightSlotAdded = true;
			result.push('highlightToggle');
			continue;
		}
		result.push(id);
	}

	return result;
}

function resolveHighlightToggleAction(
	hasHighlight: boolean,
	onUnderline?: () => void,
	onRemoveUnderline?: () => void,
): { id: ActionId; handler?: () => void } | null {
	if (hasHighlight) {
		if (!onRemoveUnderline) return null;
		return { id: 'removeUnderline', handler: onRemoveUnderline };
	}
	if (!onUnderline) return null;
	return { id: 'underline', handler: onUnderline };
}

/** 段落引用下方的操作条（与选区 PopBar 同款操作） */
export function EpubQuoteActionBar({
	labels,
	onCopy,
	onWriteThought,
	onAskBook,
	onUnderline,
	onRemoveUnderline,
	hasHighlight = false,
	variant = 'inline',
	onAnyAction,
	className,
}: EpubQuoteActionBarProps) {
	const [copySucceeded, setCopySucceeded] = useState(false);
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		};
	}, []);

	const handleCopy = useCallback(() => {
		onCopy();
		setCopySucceeded(true);
		if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		copyTimerRef.current = setTimeout(
			() => setCopySucceeded(false),
			COPY_SUCCESS_MS,
		);
	}, [onCopy]);

	const copiedLabel = labels.copied ?? labels.copy;

	const actionHandlers = {
		onCopy: handleCopy,
		onWriteThought,
		onAskBook,
		onUnderline,
		onRemoveUnderline,
	} as const;

	const buildOnClick = (id: ActionId, handler?: () => void) => {
		const action = id === 'copy' ? handleCopy : handler;
		if (
			variant === 'floating' &&
			onAnyAction &&
			!PRESERVE_SELECTION_ACTIONS.has(id)
		) {
			return () => {
				action?.();
				if (id === 'copy') {
					window.setTimeout(() => onAnyAction(), COPY_SUCCESS_MS);
				} else {
					onAnyAction();
				}
			};
		}
		return action;
	};

	const renderActions = buildRenderActions(
		variant,
		onUnderline,
		onRemoveUnderline,
	);
	const highlightToggle = resolveHighlightToggleAction(
		hasHighlight,
		onUnderline,
		onRemoveUnderline,
	);

	return (
		<div
			className={cn(CONTAINER_CLASS[variant], className)}
			role="toolbar"
			aria-label={labels.writeThought}
		>
			{renderActions.map((slot) => {
				if (slot === 'highlightToggle') {
					if (!highlightToggle) return null;
					const { id, handler } = highlightToggle;
					const onClick = buildOnClick(id, handler);
					return (
						<QuoteActionItem
							key="highlightToggle"
							variant={variant}
							label={labels[id]}
							onClick={onClick}
						>
							{renderActionIcon(id, variant, false)}
						</QuoteActionItem>
					);
				}

				const handlerProp = HANDLER_PROP[slot];
				const handler = handlerProp ? actionHandlers[handlerProp] : undefined;
				const onClick = buildOnClick(slot, handler);
				const isCopy = slot === 'copy';
				return (
					<QuoteActionItem
						key={slot}
						variant={variant}
						label={isCopy && copySucceeded ? copiedLabel : labels[slot]}
						onClick={onClick}
						copied={isCopy && copySucceeded}
					>
						{renderActionIcon(slot, variant, isCopy && copySucceeded)}
					</QuoteActionItem>
				);
			})}
		</div>
	);
}
