import {
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useRef,
	useState,
} from 'react';
import {
	PositionedQuickMenu,
	type PositionedQuickMenuState,
} from './PositionedQuickMenu';
import type { QuickContextMenuEntry } from './types';

export type SelectionContextMenuCtx = {
	/** 右键按下前的选区快照（contextmenu 时原生选区可能已被系统改写） */
	range: Range | null;
};

/** 由使用方根据选中文本返回菜单项；返回 null/空则不弹出自定义菜单 */
export type SelectionContextMenuItemsFn = (
	selectedText: string,
	ctx: SelectionContextMenuCtx,
) => readonly QuickContextMenuEntry[] | null | undefined;

type SelSnap = {
	text: string;
	range: Range | null;
};

function readSelectionIn(root: HTMLElement): SelSnap {
	const sel = window.getSelection();
	if (!sel || sel.isCollapsed || sel.rangeCount < 1) {
		return { text: '', range: null };
	}
	const range = sel.getRangeAt(0);
	const ancestor = range.commonAncestorContainer;
	const inRoot =
		root === ancestor ||
		root.contains(ancestor) ||
		(() => {
			try {
				return range.intersectsNode(root);
			} catch {
				return false;
			}
		})();
	if (!inRoot) return { text: '', range: null };
	const text = sel.toString().trim();
	if (!text) return { text: '', range: null };
	let cloned: Range | null = null;
	try {
		cloned = range.cloneRange();
	} catch {
		cloned = null;
	}
	return { text, range: cloned };
}

type MenuState = PositionedQuickMenuState & {
	items: readonly QuickContextMenuEntry[];
};

/**
 * 选中文本后右键才弹出菜单；`getItems` 未传则无行为（默认关闭）。
 *
 * 可靠性（尤其 macOS）：
 * - pointerdown(button=2) 先快照选区（系统右键常会改写/点词选中）
 * - contextmenu 用捕获阶段，并尽早 preventDefault
 */
export function useSelectionContextMenu(
	getItems?: SelectionContextMenuItemsFn,
): {
	onContextMenuCapture: ((e: ReactMouseEvent<HTMLElement>) => void) | undefined;
	onPointerDownCapture:
		| ((e: ReactPointerEvent<HTMLElement>) => void)
		| undefined;
	menu: ReactNode;
} {
	const [menu, setMenu] = useState<MenuState | null>(null);
	/** 右键按下瞬间的选区；contextmenu 时优先用它 */
	const snapRef = useRef<SelSnap | null>(null);

	const onPointerDownCapture = useCallback(
		(e: ReactPointerEvent<HTMLElement>) => {
			if (!getItems) return;
			if (e.button !== 2) return;
			snapRef.current = readSelectionIn(e.currentTarget);
		},
		[getItems],
	);

	const onContextMenuCapture = useCallback(
		(e: ReactMouseEvent<HTMLElement>) => {
			if (!getItems) return;

			const live = readSelectionIn(e.currentTarget);
			const snap = snapRef.current;
			snapRef.current = null;

			// 优先用右键按下前的快照（用户拖选）；避免系统点词覆盖后误判无选区
			const text = (snap?.text || live.text).trim();
			if (!text) return;

			const range = snap?.text ? snap.range : live.range;
			const items = getItems(text, { range });
			if (!items?.length) return;

			// 已确认要弹自定义菜单：必须拦住系统菜单（须在捕获阶段尽早调用）
			e.preventDefault();
			e.stopPropagation();
			setMenu({ open: true, x: e.clientX, y: e.clientY, items });
		},
		[getItems],
	);

	if (!getItems) {
		return {
			onContextMenuCapture: undefined,
			onPointerDownCapture: undefined,
			menu: null,
		};
	}

	return {
		onContextMenuCapture,
		onPointerDownCapture,
		menu: (
			<PositionedQuickMenu
				state={menu}
				items={menu?.items ?? []}
				onOpenChange={(open) => {
					if (!open) setMenu(null);
					else setMenu((m) => (m ? { ...m, open } : m));
				}}
			/>
		),
	};
}
