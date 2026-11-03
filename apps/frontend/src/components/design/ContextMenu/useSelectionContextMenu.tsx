import {
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
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

/** 把快照 Range 写回 window.getSelection，保住蓝底选中样式 */
function restoreRange(range: Range | null, skip?: boolean) {
	if (skip || !range) return;
	const sel = window.getSelection();
	if (!sel) return;
	try {
		if (sel.rangeCount === 1) {
			const cur = sel.getRangeAt(0);
			if (
				cur.startContainer === range.startContainer &&
				cur.startOffset === range.startOffset &&
				cur.endContainer === range.endContainer &&
				cur.endOffset === range.endOffset
			) {
				return;
			}
		}
		sel.removeAllRanges();
		sel.addRange(range);
	} catch {
		/* DOM 变动后 range 可能失效 */
	}
}

type MenuState = PositionedQuickMenuState & {
	items: readonly QuickContextMenuEntry[];
	range: Range | null;
};

/**
 * 选中文本后右键才弹出菜单；`getItems` 未传则无行为（默认关闭）。
 *
 * 可靠性（尤其 macOS）：
 * - pointerdown(button=2) 先快照选区（系统右键常会改写/点词选中）
 * - contextmenu 用捕获阶段，并尽早 preventDefault
 * - 菜单打开后写回 Range，避免 Dropdown 抢焦导致选中样式消失
 * - 左键点选区外/空白（含 user-select:none 区域）主动清选区；浏览器默认常不清
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
	const keepRangeRef = useRef<Range | null>(null);
	/** 左键点空白取消选中时，禁止菜单期 restore 把选区写回 */
	const skipRestoreRef = useRef(false);

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
			skipRestoreRef.current = false;
			keepRangeRef.current = range;
			setMenu({ open: true, x: e.clientX, y: e.clientY, items, range });
			// 同步写回：赶在菜单挂载抢焦前尽量保住高亮
			requestAnimationFrame(() => restoreRange(range, skipRestoreRef.current));
		},
		[getItems],
	);

	// 菜单打开期间若焦点/系统又清掉选区，再写回快照 Range
	useEffect(() => {
		if (!menu?.open || !menu.range) return;
		const range = menu.range;
		keepRangeRef.current = range;
		restoreRange(range, skipRestoreRef.current);
		const onFocusIn = () =>
			queueMicrotask(() => restoreRange(range, skipRestoreRef.current));
		document.addEventListener('focusin', onFocusIn);
		const raf = requestAnimationFrame(() => {
			restoreRange(range, skipRestoreRef.current);
			requestAnimationFrame(() => restoreRange(range, skipRestoreRef.current));
		});
		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener('focusin', onFocusIn);
		};
	}, [menu]);

	// 左键点选区高亮外（空白、按钮、父级 padding）：浏览器对不可选区域常不清选区
	useEffect(() => {
		if (!getItems) return;
		const onPointerDown = (e: PointerEvent) => {
			if (e.button !== 0) return;
			const target = e.target;
			if (
				target instanceof Element &&
				target.closest('[data-slot="dropdown-menu-content"]')
			) {
				return;
			}
			const sel = window.getSelection();
			if (!sel || sel.isCollapsed || sel.rangeCount < 1) return;
			const range = sel.getRangeAt(0);
			// 用几何命中：点在父容器空白上时 intersectsNode(父节点) 仍为 true，不能靠它判断
			const { clientX: x, clientY: y } = e;
			const rects = range.getClientRects();
			for (let i = 0; i < rects.length; i += 1) {
				const r = rects[i]!;
				if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
					return;
				}
			}
			skipRestoreRef.current = true;
			keepRangeRef.current = null;
			sel.removeAllRanges();
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		return () =>
			document.removeEventListener('pointerdown', onPointerDown, true);
	}, [getItems]);

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
					if (!open) {
						keepRangeRef.current = null;
						setMenu(null);
						return;
					}
					setMenu((m) => (m ? { ...m, open } : m));
					queueMicrotask(() =>
						restoreRange(keepRangeRef.current, skipRestoreRef.current),
					);
				}}
			/>
		),
	};
}
