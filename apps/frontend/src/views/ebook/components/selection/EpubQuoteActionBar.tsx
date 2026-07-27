import {
	AudioWaveform,
	Baseline,
	CheckCircle,
	Copy,
	type LucideIcon,
	MessageSquarePlus,
	Search,
	Share2,
	Strikethrough,
} from 'lucide-react';
import {
	type MouseEvent as ReactMouseEvent,
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
	onShare?: () => void;
	onUnderline?: () => void;
	onRemoveUnderline?: () => void;
	/** 朗读当前引用/选区（英语学习 TTS） */
	onListen?: () => void;
	/** 当前选区是否已有用户划线 */
	hasHighlight?: boolean;
	/**
	 * variant 表示操作条的展现形态，有三种形式以适应不同场景：
	 * - 'floating'：悬浮于页面上，通常跟随选区出现，操作区域紧凑，常用于段落引用、选区弹出等场合
	 * - 'inline'：内嵌于内容流中（比如段落下方），在不遮挡内容的同时便于连续操作，适合摘录后展示操作
	 * - 'panel'：右侧想法分栏内引用区底栏，全宽平铺操作按钮
	 */
	variant?: 'floating' | 'inline' | 'panel';
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
	'copy',
	'underline',
	'removeUnderline',
	'share',
	'listen',
	// 写想法/问书在各自 handler 里于聚焦后再清选区，避免 onAnyAction 抢焦
	'writeThought',
	'askBook',
]);

const ACTION_ORDER: Record<BarVariant, ActionId[]> = {
	panel: [
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
	underline: Baseline,
	removeUnderline: Strikethrough,
	writeThought: MessageSquarePlus,
	share: Share2,
	askBook: Search,
	listen: AudioWaveform,
};

const HANDLER_PROP: Partial<
	Record<
		ActionId,
		| 'onCopy'
		| 'onWriteThought'
		| 'onAskBook'
		| 'onShare'
		| 'onUnderline'
		| 'onRemoveUnderline'
		| 'onListen'
	>
> = {
	copy: 'onCopy',
	underline: 'onUnderline',
	removeUnderline: 'onRemoveUnderline',
	writeThought: 'onWriteThought',
	askBook: 'onAskBook',
	share: 'onShare',
	listen: 'onListen',
};

const CONTAINER_CLASS: Record<BarVariant, string> = {
	panel: 'flex h-full w-full min-w-0 items-stretch',
	inline:
		'flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-textcolor/18 bg-textcolor/5',
	floating: 'flex items-center px-0.5',
};

const ICON_CLASS: Record<BarVariant, string> = {
	panel: 'stroke-[1.5]',
	inline: 'stroke-[1.75]',
	floating: 'size-4 stroke-[1.75]',
};

const ITEM_BUTTON_CLASS: Record<BarVariant, string> = {
	panel:
		'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 transition-colors',
	inline:
		'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-r border-textcolor/18 py-2 px-0.5 text-xs transition-colors last:border-r-0',
	floating:
		'flex shrink-0 flex-col items-center gap-0.5 rounded-md py-2 transition-colors',
};

const ITEM_ACTIVE_CLASS: Record<BarVariant, string> = {
	panel: 'text-textcolor/80 hover:text-teal-500 cursor-pointer',
	inline: 'text-textcolor/80 hover:text-teal-500',
	floating: 'cursor-pointer text-textcolor/80 hover:text-teal-500',
};

const ITEM_DISABLED_CLASS: Record<BarVariant, string> = {
	panel: 'text-textcolor/50 cursor-default',
	inline: 'cursor-default text-textcolor/50',
	floating: 'cursor-default text-textcolor/80',
};

const ICON_WRAP_CLASS: Record<BarVariant, string> = {
	panel: 'flex size-4 items-center justify-center [&_svg]:size-4',
	inline: 'flex size-4 shrink-0 items-center justify-center [&_svg]:size-4',
	floating: 'flex h-4 w-4 items-center justify-center',
};

const COPY_SUCCESS_MS = 1000;

const LABEL_CLASS: Record<BarVariant, string> = {
	panel: 'w-full text-center text-xs pt-0.5 leading-tight',
	inline: 'w-full text-center text-xs pt-0.5 leading-tight',
	floating: 'w-full text-center text-xs leading-none pt-1',
};

function QuoteActionItem({
	variant,
	label,
	onClick,
	onMouseDown,
	copied,
	children,
}: {
	variant: BarVariant;
	label: string;
	onClick?: () => void;
	onMouseDown?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
	copied?: boolean;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			onMouseDown={onMouseDown}
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
	onShare,
	onUnderline,
	onRemoveUnderline,
	onListen,
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
		onShare,
		onUnderline,
		onRemoveUnderline,
		onListen,
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
				const primeComposeFocus =
					slot === 'writeThought'
						? (e: ReactMouseEvent<HTMLButtonElement>) => {
								// 避免按钮在 mousedown 抢焦；交焦由 read 页 settle 后统一处理
								e.preventDefault();
							}
						: undefined;
				return (
					<QuoteActionItem
						key={slot}
						variant={variant}
						label={isCopy && copySucceeded ? copiedLabel : labels[slot]}
						onClick={onClick}
						onMouseDown={primeComposeFocus}
						copied={isCopy && copySucceeded}
					>
						{renderActionIcon(slot, variant, isCopy && copySucceeded)}
					</QuoteActionItem>
				);
			})}
		</div>
	);
}
