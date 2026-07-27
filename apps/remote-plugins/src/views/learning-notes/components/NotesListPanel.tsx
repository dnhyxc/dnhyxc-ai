import Loading from '@design/Loading';
import { Btn } from '@design/RichEditor';
import {
	ChevronDown,
	ChevronUp,
	LocateFixed,
	SquarePen,
	Trash2,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import useStore from '@/store';

const SCROLL_EDGE_PX = 16;

/** 笔记列表滚动：同一按钮循环 底 → 顶 → 当前（无选中时底 → 顶） */
type NoteScrollMode = 'bottom' | 'top' | 'current';

/**
 * 列表独立 observer：滚动 / loadMore / scrollEdge 只重渲左侧，
 * 避免牵动右侧 TipTap/大 HTML 预览（长文时滚动卡顿主因）。
 */
export const NotesListPanel = observer(function NotesListPanel({
	locale,
}: {
	locale: string;
}) {
	const { learningNotesStore: store } = useStore();
	const { t } = useI18n();
	const scrollViewportRef = useRef<HTMLDivElement>(null);
	const activeItemRef = useRef<HTMLDivElement>(null);
	const scrollRafRef = useRef(0);
	const [scrollMode, setScrollMode] = useState<NoteScrollMode>('bottom');
	const [scrollEdge, setScrollEdge] = useState<'top' | 'bottom' | null>(null);

	const syncScrollEdge = useCallback(() => {
		const el = scrollViewportRef.current;
		if (!el) return;
		const { scrollTop, scrollHeight, clientHeight } = el;
		let edge: 'top' | 'bottom' | null = null;
		if (scrollTop <= SCROLL_EDGE_PX) edge = 'top';
		else if (scrollTop + clientHeight >= scrollHeight - SCROLL_EDGE_PX)
			edge = 'bottom';
		setScrollEdge((prev) => (prev === edge ? prev : edge));
		if (scrollTop + clientHeight >= scrollHeight - SCROLL_EDGE_PX * 3) {
			void store.loadMore();
		}
	}, [store]);

	const onViewportScroll = useCallback(() => {
		if (scrollRafRef.current) return;
		scrollRafRef.current = requestAnimationFrame(() => {
			scrollRafRef.current = 0;
			syncScrollEdge();
		});
	}, [syncScrollEdge]);

	useEffect(() => {
		setScrollMode('bottom');
		syncScrollEdge();
		return () => {
			if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
		};
	}, [syncScrollEdge]);

	useEffect(() => {
		if (!store.hasActive && scrollMode === 'current') {
			setScrollMode('bottom');
		}
	}, [store.hasActive, scrollMode]);

	const onScrollFabClick = useCallback(() => {
		const vp = scrollViewportRef.current;
		if (!vp) return;

		const { scrollTop, scrollHeight, clientHeight } = vp;
		const atTop = scrollTop <= SCROLL_EDGE_PX;
		const atBottom = scrollTop + clientHeight >= scrollHeight - SCROLL_EDGE_PX;
		let mode = scrollMode;
		if (mode === 'bottom' && atBottom) mode = 'top';
		else if (mode === 'top' && atTop) mode = 'bottom';

		if (mode === 'bottom') {
			vp.scrollTo({ top: vp.scrollHeight, behavior: 'auto' });
		} else if (mode === 'top') {
			vp.scrollTo({ top: 0, behavior: 'auto' });
		} else {
			activeItemRef.current?.scrollIntoView({
				block: 'center',
				behavior: 'auto',
			});
		}

		if (mode === 'bottom') setScrollMode('top');
		else if (mode === 'top')
			setScrollMode(store.hasActive ? 'current' : 'bottom');
		else setScrollMode('bottom');
	}, [scrollMode, store.hasActive]);

	const displayMode: NoteScrollMode =
		scrollMode === 'bottom' && scrollEdge === 'bottom'
			? 'top'
			: scrollMode === 'top' && scrollEdge === 'top'
				? 'bottom'
				: scrollMode;

	const scrollTitle =
		displayMode === 'bottom'
			? t('learningNotes.scrollBottom')
			: displayMode === 'top'
				? t('learningNotes.scrollTop')
				: t('learningNotes.scrollCurrent');

	const activeId = store.preview?.id ?? store.editingId;

	return (
		<aside className="border-r mb-3 border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden contain-[layout_paint]">
			<div className="flex h-10 shrink-0 items-center justify-between border-b border-theme/10 pl-3 pr-1.5 font-medium tracking-wide">
				<div className="text-textcolor/85">
					{t('learningNotes.listTitle')}
					<span className="ml-3 text-xs text-textcolor/60">
						{t('common.loadedCount', {
							loaded: store.list.length,
							total: store.total,
						})}
					</span>
				</div>
				<Btn title={scrollTitle} onClick={onScrollFabClick}>
					{displayMode === 'bottom' ? (
						<ChevronDown size={18} />
					) : displayMode === 'top' ? (
						<ChevronUp size={18} />
					) : (
						<LocateFixed size={15} />
					)}
				</Btn>
			</div>
			{/* ScrollArea 与想法列表/编辑器滚动条一致；逻辑仍 rAF 节流，不重渲右侧 */}
			<ScrollArea
				ref={scrollViewportRef}
				className="min-h-0 flex-1 p-3"
				onScroll={onViewportScroll}
			>
				{store.loading ? (
					<div className="flex min-h-full flex-1 flex-col items-center justify-center py-6 text-center text-sm text-textcolor/60">
						<Loading />
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{store.list.length === 0 ? (
							<p className="text-textcolor/45 px-1 py-6 text-center text-xs">
								{t('learningNotes.empty')}
							</p>
						) : null}
						{store.list.map((n) => {
							const active = activeId === n.id;
							return (
								<div
									key={n.id}
									ref={active ? activeItemRef : undefined}
									className={cn(
										'hover:bg-theme/10 bg-theme/5 group relative w-full rounded-md px-3 py-2.5 text-left contain-[layout_paint]',
										active && 'bg-theme/15',
									)}
								>
									<button
										type="button"
										className="w-full cursor-pointer text-left"
										onClick={() => void store.openPreview(n.id)}
									>
										<div className="text-textcolor truncate text-base font-semibold pr-0 group-hover:pr-14">
											{n.title}
										</div>
										<div className="text-textcolor/45 mt-1.5 text-xs">
											{new Date(n.at).toLocaleString(locale)}
										</div>
									</button>
									<div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
										<button
											type="button"
											title={t('learningNotes.edit')}
											className="w-7 h-7 text-textcolor/80 hover:text-teal-500 hover:bg-teal-500/10 flex cursor-pointer items-center justify-center rounded-md p-1"
											onClick={(e) => {
												e.stopPropagation();
												void store.openEditById(n.id);
											}}
										>
											<SquarePen size={15} />
										</button>
										<button
											type="button"
											title={t('learningNotes.delete')}
											className="w-7 h-7 text-textcolor/80 hover:text-destructive hover:bg-destructive/10 flex cursor-pointer items-center justify-center rounded-md p-1"
											onClick={(e) => {
												e.stopPropagation();
												store.requestDelete(n.id);
											}}
										>
											<Trash2 size={15} />
										</button>
									</div>
								</div>
							);
						})}
						{store.loadingMore ? (
							<p className="text-textcolor/45 py-2 text-center text-xs">
								{t('common.loading')}
							</p>
						) : null}
						{!store.loading &&
						!store.loadingMore &&
						store.list.length > 0 &&
						!store.hasMore ? (
							<p className="text-textcolor/35 py-2 text-center text-xs">
								{t('common.noMore')}
							</p>
						) : null}
					</div>
				)}
			</ScrollArea>
		</aside>
	);
});
