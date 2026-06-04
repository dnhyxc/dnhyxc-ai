import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
};

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
}: CreatableComboboxProps) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

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

	return (
		<div ref={rootRef} className={cn('flex w-full min-w-0', className)}>
			<div className="relative min-w-0 flex-1">
				<Input
					id={id}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					disabled={disabled}
					autoComplete="off"
					aria-expanded={open}
					aria-haspopup="listbox"
					className={cn(
						'w-full rounded-r-none border-r-0 shadow-none focus-visible:z-10',
						inputClassName,
					)}
				/>
				{open ? (
					<div
						role="listbox"
						className={cn(
							'absolute top-[calc(100%+4px)] left-0 z-50 w-full overflow-hidden',
							'rounded-md border border-theme/10 bg-theme-background p-2 shadow-md',
						)}
					>
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
									<span className="min-w-0 flex-1 truncate">
										{option.label}
									</span>
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
				) : null}
			</div>
			<Button
				type="button"
				variant="outline"
				size="icon"
				disabled={disabled}
				aria-expanded={open}
				aria-label={presetsAriaLabel}
				className={cn(
					'h-9 w-9 shrink-0 rounded-l-none border-theme/20 bg-transparent shadow-none hover:bg-theme/5',
					open && 'bg-theme/10',
				)}
				onClick={() => setOpen((v) => !v)}
			>
				<ChevronsUpDownIcon className="size-4 opacity-50" aria-hidden />
			</Button>
		</div>
	);
}
