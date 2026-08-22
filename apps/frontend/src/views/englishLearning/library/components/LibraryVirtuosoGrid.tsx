/**
 * 资源库虚拟网格：按行 Virtuoso + 行内 CSS Grid，支持不等高卡片。
 */

import { Spinner } from '@ui/index';
import {
	type ReactNode,
	type RefObject,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Virtuoso } from 'react-virtuoso';
import { cn } from '@/lib/utils';
import {
	type LibraryGridColumnMode,
	useLibraryGridColumns,
} from '../hooks/useLibraryGridColumns';

export function LibraryListLoadMoreRow({ label }: { label: string }) {
	return (
		<div className="text-textcolor/50 flex items-center justify-center gap-1.5 py-4 text-xs">
			<Spinner className="size-3.5 text-textcolor/50" aria-hidden />
			{label}
		</div>
	);
}

export type LibraryVirtuosoGridProps<T> = {
	items: T[];
	viewportRef: RefObject<HTMLDivElement | null>;
	columnMode: LibraryGridColumnMode;
	/** 进入时滚动到该条目的行（续读位置） */
	initialScrollItemIndex?: number;
	rowClassName?: string;
	className?: string;
	itemClassName?: string;
	getItemKey: (item: T, dataIndex: number) => string;
	itemContent: (item: T, dataIndex: number) => ReactNode;
	onEndReached: () => void;
	/** Virtuoso 完成首帧绘制后回调（用于隐藏缓存恢复时的空屏） */
	onReady?: () => void;
};

type LibraryGridRow<T> = {
	key: string;
	items: T[];
	startIndex: number;
};

function chunkRows<T>(
	items: T[],
	columns: number,
	getItemKey: (item: T, dataIndex: number) => string,
): LibraryGridRow<T>[] {
	if (columns < 1 || items.length === 0) return [];
	const rows: LibraryGridRow<T>[] = [];
	for (let i = 0; i < items.length; i += columns) {
		const slice = items.slice(i, i + columns);
		const startIndex = i;
		const key = slice
			.map((item, col) => getItemKey(item, startIndex + col))
			.join('|');
		rows.push({ key, items: slice, startIndex });
	}
	return rows;
}

export function LibraryVirtuosoGrid<T>({
	items,
	viewportRef,
	columnMode,
	initialScrollItemIndex = 0,
	rowClassName = 'gap-4',
	className,
	itemClassName,
	getItemKey,
	itemContent,
	onEndReached,
	onReady,
}: LibraryVirtuosoGridProps<T>) {
	const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);
	const columns = useLibraryGridColumns(viewportRef, columnMode);
	const onReadyRef = useRef(onReady);
	onReadyRef.current = onReady;

	useEffect(() => {
		setScrollParent(viewportRef.current);
	}, [viewportRef]);

	const rows = useMemo(
		() => chunkRows(items, columns, getItemKey),
		[items, columns, getItemKey],
	);

	useEffect(() => {
		if (!scrollParent || rows.length === 0) return;
		let cancelled = false;
		const id = requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (!cancelled) onReadyRef.current?.();
			});
		});
		return () => {
			cancelled = true;
			cancelAnimationFrame(id);
		};
	}, [scrollParent, rows.length]);

	const initialTopMostItemIndex = useMemo(() => {
		if (initialScrollItemIndex <= 0 || columns < 1) return undefined;
		return {
			index: Math.floor(initialScrollItemIndex / columns),
			align: 'start' as const,
		};
	}, [initialScrollItemIndex, columns]);

	const rowGridClassName = cn(
		'grid w-full shrink-0',
		rowClassName,
		columnMode === 'classic' && (columns === 2 ? 'grid-cols-2' : 'grid-cols-1'),
	);

	const rowGridStyle =
		columnMode === 'vocab'
			? {
					gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
				}
			: undefined;

	if (!scrollParent || rows.length === 0) {
		return null;
	}

	return (
		<Virtuoso
			className={cn('w-full', className)}
			customScrollParent={scrollParent}
			data={rows}
			initialTopMostItemIndex={initialTopMostItemIndex}
			computeItemKey={(_index, row) => row.key}
			overscan={{ main: 400, reverse: 400 }}
			increaseViewportBy={{ top: 400, bottom: 400 }}
			minOverscanItemCount={{ top: 2, bottom: 2 }}
			atBottomThreshold={200}
			endReached={onEndReached}
			itemContent={(_index, row) => (
				<div>
					<div className={rowGridClassName} style={rowGridStyle}>
						{row.items.map((item, col) => {
							const dataIndex = row.startIndex + col;
							return (
								<div
									key={getItemKey(item, dataIndex)}
									className={cn('min-w-0', itemClassName)}
								>
									{itemContent(item, dataIndex)}
								</div>
							);
						})}
					</div>
					<div className="h-4 shrink-0" aria-hidden />
				</div>
			)}
		/>
	);
}
