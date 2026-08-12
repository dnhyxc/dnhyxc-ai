import { useMemo } from 'react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { QuickContextMenuEntry } from './types';

export type PositionedQuickMenuState = {
	open: boolean;
	x: number;
	y: number;
};

type Props = {
	state: PositionedQuickMenuState | null;
	items: readonly QuickContextMenuEntry[];
	onOpenChange: (open: boolean) => void;
	contentClassName?: string;
};

function MenuEntries({
	entries,
}: {
	entries: readonly QuickContextMenuEntry[];
}) {
	return entries.map((entry, index) => {
		if (entry.type === 'separator') {
			return <DropdownMenuSeparator key={entry.id ?? `sep-${index}`} />;
		}
		if (entry.type === 'sub') {
			return (
				<DropdownMenuSub key={entry.id}>
					<DropdownMenuSubTrigger disabled={entry.disabled} inset={entry.inset}>
						{entry.label}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<MenuEntries entries={entry.items} />
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			);
		}
		return (
			<DropdownMenuItem
				key={entry.id}
				disabled={entry.disabled}
				inset={entry.inset}
				variant={entry.variant}
				onSelect={entry.onSelect}
			>
				{entry.label}
				{entry.shortcut != null && entry.shortcut !== '' ? (
					<DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>
				) : null}
			</DropdownMenuItem>
		);
	});
}

/**
 * 锚定在鼠标坐标的声明式菜单（iframe / 选区右键等无法用 Trigger 包裹时用）。
 */
export function PositionedQuickMenu({
	state,
	items,
	onOpenChange,
	contentClassName = 'min-w-44',
}: Props) {
	const anchorStyle = useMemo(
		() =>
			state
				? ({
						position: 'fixed',
						left: state.x,
						top: state.y,
						width: 1,
						height: 1,
						pointerEvents: 'none',
					} as const)
				: undefined,
		[state],
	);

	if (!state) return null;

	return (
		<DropdownMenu open={state.open} onOpenChange={onOpenChange} modal>
			<DropdownMenuTrigger asChild>
				<span aria-hidden style={anchorStyle} />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className={contentClassName}
				align="start"
				side="right"
			>
				<MenuEntries entries={items} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
