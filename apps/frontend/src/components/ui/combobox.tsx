import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { ScrollArea } from '@ui/scroll-area';
import { CheckIcon, Menu } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type ComboboxOption = {
	value: string;
	label: string;
};

export type CreatableComboboxProps = {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	options: readonly ComboboxOption[];
	placeholder?: string;
	/** 右侧展开预设列表按钮的无障碍标签 */
	presetsAriaLabel?: string;
	disabled?: boolean;
	className?: string;
	inputClassName?: string;
	/** 输入框展示文案；不传则与 value 相同（value 仍为实际存储值） */
	displayValue?: string;
	/** 选项较多时 ScrollArea 固定高度（Tailwind）；选项少时不生效，高度随内容收缩 */
	optionsScrollHeightClassName?: string;
};

/** 超过该数量时使用固定高度 + ScrollArea 滚动 */
const SCROLLABLE_OPTIONS_THRESHOLD = 6;

const DEFAULT_OPTIONS_SCROLL_HEIGHT = 'h-60 max-h-[calc(100dvh-10rem)]';

/**
 * 可输入 Combobox：Input 直接编辑 + 输入框正下方同宽预设列表（相对定位，避免 Popover 在 ScrollArea 内错位）
 */
export function CreatableCombobox({
	id,
	value,
	onChange,
	options,
	placeholder,
	presetsAriaLabel = 'Open presets',
	disabled = false,
	className,
	inputClassName,
	displayValue,
	optionsScrollHeightClassName = DEFAULT_OPTIONS_SCROLL_HEIGHT,
}: CreatableComboboxProps) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	/** 设置页外层 ScrollArea 会抢滚轮；Radix viewport 需手动推进 scrollTop */
	const handleOptionsWheel = useCallback(
		(event: React.WheelEvent<HTMLDivElement>) => {
			event.stopPropagation();
			event.currentTarget.scrollTop += event.deltaY;
		},
		[],
	);

	const handleOptionsWheelCapture = useCallback(
		(event: React.WheelEvent<HTMLDivElement>) => {
			event.stopPropagation();
		},
		[],
	);

	useEffect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (rootRef.current?.contains(target)) return;
			setOpen(false);
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false);
		};

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open]);

	const optionsList = (
		<div className="p-2">
			{options.map((option) => {
				const selected = value === option.value;
				return (
					<button
						key={option.value}
						type="button"
						role="option"
						aria-selected={selected}
						className={cn(
							'mb-2 flex w-full min-w-0 cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none last:mb-0',
							'hover:bg-theme/10 focus-visible:bg-theme/10',
							selected && 'bg-theme/10',
						)}
						onClick={() => {
							onChange(option.value);
							setOpen(false);
						}}
					>
						<span className="min-w-0 flex-1 truncate">{option.label}</span>
						<CheckIcon
							className={cn(
								'ml-auto size-4 shrink-0',
								selected ? 'opacity-100' : 'opacity-0',
							)}
							aria-hidden
						/>
					</button>
				);
			})}
		</div>
	);

	const scrollableOptions = options.length > SCROLLABLE_OPTIONS_THRESHOLD;

	return (
		<div
			ref={rootRef}
			className={cn(
				'flex w-full min-w-0 rounded-md border border-theme/20 bg-transparent focus-within:border-theme/40',
				disabled && 'opacity-50',
				className,
			)}
		>
			<div className="relative min-w-0 flex-1">
				<Input
					id={id}
					value={displayValue ?? value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					disabled={disabled}
					autoComplete="off"
					aria-expanded={open}
					aria-haspopup="listbox"
					className={cn(
						inputClassName,
						'h-9 w-full rounded-none border-0 shadow-none focus-visible:border-transparent focus-visible:ring-0',
					)}
				/>
				{open ? (
					<div
						role="listbox"
						className={cn(
							'absolute top-[calc(100%+4px)] left-0 z-50 w-full',
							'rounded-md border border-theme/10 bg-theme-background shadow-md',
						)}
					>
						{scrollableOptions ? (
							<ScrollArea
								className={cn('w-full', optionsScrollHeightClassName)}
								viewportClassName="h-full [&>div]:min-h-0!"
								onWheel={handleOptionsWheel}
								onWheelCapture={handleOptionsWheelCapture}
							>
								{optionsList}
							</ScrollArea>
						) : (
							optionsList
						)}
					</div>
				) : null}
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				disabled={disabled}
				aria-expanded={open}
				aria-label={presetsAriaLabel}
				className={cn(
					'h-9 w-9 shrink-0 rounded-l-none rounded-r-md border-0 border-l border-theme/20 bg-transparent shadow-none hover:bg-theme/5',
					open && 'bg-theme/10',
				)}
				onClick={() => setOpen((v) => !v)}
			>
				<Menu className="size-4 opacity-50" aria-hidden />
			</Button>
		</div>
	);
}
