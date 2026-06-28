import type { QuickContextMenuEntry } from '@design/ContextMenu';
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

export type EpubReaderContextMenuState = {
	open: boolean;
	x: number;
	y: number;
	hasSelection: boolean;
};

type Props = {
	state: EpubReaderContextMenuState | null;
	items: readonly QuickContextMenuEntry[];
	onOpenChange: (open: boolean) => void;
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
 * 锚定在鼠标位置的 EPUB 右键菜单（iframe 内右键无法使用 QuickContextMenu 的 Trigger 包裹）。
 */
export function EpubReaderContextMenu({ state, items, onOpenChange }: Props) {
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
			<DropdownMenuContent className="min-w-44" align="start" side="right">
				<MenuEntries entries={items} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
