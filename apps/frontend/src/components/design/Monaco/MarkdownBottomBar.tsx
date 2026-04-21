import Tooltip from '@design/Tooltip';
import {
	BetweenHorizontalEnd,
	BetweenHorizontalStart,
	BetweenVerticalEnd,
	Bot,
	Columns2,
	Eye,
	FileClock,
	FileInput,
	FilePen,
	GitCompare,
	GripVertical,
	LocateFixed,
} from 'lucide-react';
import {
	memo,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	formatChordForTip,
	useMarkdownBottomBarShortcuts,
} from '@/hooks/useMarkdownBottomBarShortcuts';
import { cn } from '@/lib/utils';
import { KNOWLEDGE_AUTO_SAVE_INTERVAL_PRESETS } from './options';
import {
	formatKnowledgeAutoSaveIntervalLabel,
	snapMarkdownBottomBarOffset,
} from './utils';

type MarkdownViewMode = 'edit' | 'preview' | 'split' | 'splitDiff';
type MarkdownSplitScrollFollowMode =
	| 'none'
	| 'bidirectional'
	| 'previewFollowsEditor'
	| 'editorFollowsPreview';

interface MarkdownBottomBarProps {
	id: string;
	open: boolean;
	shortcuts: {
		enabled: boolean;
		rootRef: RefObject<HTMLElement | null>;
		viewModeRef: RefObject<MarkdownViewMode>;
	};
	state: {
		viewMode: MarkdownViewMode;
		assistantRightPaneActive: boolean;
		markdownAssistantOpen: boolean;
		splitScrollFollowMode: MarkdownSplitScrollFollowMode;
		overwriteSaveEnabled: boolean;
		autoSaveEnabled: boolean;
		autoSaveIntervalSec: number;
		markdownDiffBottomBarVisible: boolean;
	};
	options: {
		bottomBarAssistantNodeEnabled: boolean;
	};
	actions: {
		setViewMode: (mode: MarkdownViewMode) => void;
		setSplitScrollFollowMode: (
			updater: (
				prev: MarkdownSplitScrollFollowMode,
			) => MarkdownSplitScrollFollowMode,
		) => void;
		toggleMarkdownAssistant: () => void;
		closeMarkdownAssistant: () => void;
		toggleMarkdownSplitDiffCompare: () => void;
		focusEditor: () => void;
		onOverwriteSaveEnabledChange?: (next: boolean) => void;
		onAutoSaveEnabledChange?: (next: boolean) => void;
		onAutoSaveIntervalSecChange?: (next: number) => void;
	};
	customBottomBarNode?:
		| React.ReactNode
		| null
		| ((ctx: MarkdownBottomBarCustomNodeContext) => React.ReactNode);
}

export type MarkdownBottomBarChords = {
	markdownBarAction1: string;
	markdownBarAction2: string;
	markdownBarAction3: string;
	markdownBarAction4: string;
	markdownBarAction5: string;
	markdownBarAction6: string;
	markdownBarAction7: string;
	markdownBarAction8: string;
	markdownBarAction9: string;
	markdownBarAction0: string;
	markdownBarResetPosition: string;
};

export type MarkdownBottomBarCustomNodeContext = {
	state: MarkdownBottomBarProps['state'];
	actions: MarkdownBottomBarProps['actions'] & {
		/** 与「复位操作栏初始位置」按钮一致 */
		resetMarkdownBottomBarPosition: () => void;
	};
	options: MarkdownBottomBarProps['options'];
	chords: MarkdownBottomBarChords;
};

export const MarkdownBottomBar = memo(function MarkdownBottomBar(
	props: MarkdownBottomBarProps,
) {
	const { id, open, shortcuts, state, options, actions, customBottomBarNode } =
		props;
	const {
		viewMode,
		assistantRightPaneActive,
		markdownAssistantOpen,
		splitScrollFollowMode,
		overwriteSaveEnabled,
		autoSaveEnabled,
		autoSaveIntervalSec,
		markdownDiffBottomBarVisible,
	} = state;
	const { bottomBarAssistantNodeEnabled } = options;
	const {
		setViewMode,
		setSplitScrollFollowMode,
		toggleMarkdownAssistant,
		closeMarkdownAssistant,
		toggleMarkdownSplitDiffCompare,
		focusEditor,
		onOverwriteSaveEnabledChange,
		onAutoSaveEnabledChange,
		onAutoSaveIntervalSecChange,
	} = actions;

	const showOverwriteSaveToggle = Boolean(onOverwriteSaveEnabledChange);
	const showAutoSaveControls = Boolean(
		onAutoSaveEnabledChange && onAutoSaveIntervalSecChange,
	);
	const autoSaveIntervalOptions = useMemo(() => {
		const presets: number[] = [...KNOWLEDGE_AUTO_SAVE_INTERVAL_PRESETS];
		if (!presets.includes(autoSaveIntervalSec))
			presets.push(autoSaveIntervalSec);
		return presets.sort((a, b) => a - b);
	}, [autoSaveIntervalSec]);

	const { rootRef } = shortcuts;
	const dragLayerRef = useRef<HTMLDivElement | null>(null);
	const dragOffsetRef = useRef({ x: 0, y: 0 });
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
	const dragGestureRef = useRef<
		| {
				active: true;
				sx: number;
				sy: number;
				ox: number;
				oy: number;
				barRect0: DOMRect;
				rootEl: HTMLElement;
		  }
		| { active: false }
	>({ active: false });
	/** 收起时结束 pointer 监听（避免 open=false 后仍在 onMove 里写回 dragOffset） */
	const dragPointerCleanupRef = useRef<null | (() => void)>(null);
	const openRef = useRef(open);
	openRef.current = open;

	useEffect(() => {
		dragOffsetRef.current = dragOffset;
	}, [dragOffset]);

	/** 淡隐时结束拖动：避免 open=false 后 onMove 仍更新偏移 */
	useLayoutEffect(() => {
		if (!open) {
			dragPointerCleanupRef.current?.();
			dragPointerCleanupRef.current = null;
			dragGestureRef.current = { active: false };
		}
	}, [open]);

	/**
	 * 仅在 root 尺寸变化时夹紧偏移；不在挂载/展开瞬间同步 runSnap，
	 * 避免与「仅 CSS 居中、无额外 translate」的初始帧不一致。
	 */
	useLayoutEffect(() => {
		if (!open) return;
		const rootEl = rootRef.current;
		const barEl = dragLayerRef.current;
		if (!rootEl || !barEl) return;
		const runSnap = () => {
			setDragOffset((prev) => snapMarkdownBottomBarOffset(rootEl, barEl, prev));
		};
		const ro = new ResizeObserver(() => {
			runSnap();
		});
		ro.observe(rootEl);
		return () => ro.disconnect();
	}, [open, rootRef]);

	const onDragHandlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLButtonElement>) => {
			if (!open || e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();
			const rootEl = rootRef.current;
			const barEl = dragLayerRef.current;
			if (!rootEl || !barEl) return;
			const barRect0 = barEl.getBoundingClientRect();
			dragGestureRef.current = {
				active: true,
				sx: e.clientX,
				sy: e.clientY,
				ox: dragOffsetRef.current.x,
				oy: dragOffsetRef.current.y,
				barRect0,
				rootEl,
			};
			const onMove = (ev: PointerEvent) => {
				if (!openRef.current) return;
				const g = dragGestureRef.current;
				if (!g.active) return;
				const rootRect = g.rootEl.getBoundingClientRect();
				const ddx = ev.clientX - g.sx;
				const ddy = ev.clientY - g.sy;
				const minDx = rootRect.left - g.barRect0.left;
				const maxDx = rootRect.right - g.barRect0.right;
				const minDy = rootRect.top - g.barRect0.top;
				const maxDy = rootRect.bottom - g.barRect0.bottom;
				const cdx = Math.min(maxDx, Math.max(minDx, ddx));
				const cdy = Math.min(maxDy, Math.max(minDy, ddy));
				setDragOffset({ x: g.ox + cdx, y: g.oy + cdy });
			};
			const end = () => {
				dragGestureRef.current = { active: false };
				dragPointerCleanupRef.current = null;
				window.removeEventListener('pointermove', onMove, true);
				window.removeEventListener('pointerup', end, true);
				window.removeEventListener('pointercancel', end, true);
			};
			dragPointerCleanupRef.current = end;
			window.addEventListener('pointermove', onMove, { capture: true });
			window.addEventListener('pointerup', end, { capture: true });
			window.addEventListener('pointercancel', end, { capture: true });
		},
		[open, rootRef],
	);

	/**
	 * 复位操作栏几何位置：
	 * 1) 将拖动层 translate 归零，与「从未拖动」时一致（外层仍是 bottom + 居中 + 距底 10px）。
	 * 2) 下一帧再跑水平 snap：与 ResizeObserver 共用 snapMarkdownBottomBarOffset，避免极窄 root 下整栏仍溢出左右。
	 */
	const resetBarPosition = useCallback(() => {
		setDragOffset({ x: 0, y: 0 });
		requestAnimationFrame(() => {
			const rootEl = rootRef.current;
			const barEl = dragLayerRef.current;
			if (!rootEl || !barEl) return;
			setDragOffset((prev) => snapMarkdownBottomBarOffset(rootEl, barEl, prev));
		});
	}, []);

	const { chords } = useMarkdownBottomBarShortcuts({
		enabled: shortcuts.enabled,
		rootRef: shortcuts.rootRef,
		viewModeRef: shortcuts.viewModeRef,
		assistantRightPaneActive,
		markdownDiffBottomBarVisible,
		bottomBarAssistantNodeEnabled,
		showOverwriteSaveToggle,
		overwriteSaveEnabled,
		showAutoSaveControls,
		autoSaveEnabled,
		focusEditor,
		closeMarkdownAssistant,
		toggleMarkdownSplitDiffCompare,
		toggleMarkdownAssistant,
		setViewMode,
		setSplitScrollFollowMode,
		onOverwriteSaveEnabledChange,
		onAutoSaveEnabledChange,
		resetMarkdownBottomBarPosition: resetBarPosition,
	});

	const customNodeCtx = useMemo<MarkdownBottomBarCustomNodeContext>(
		() => ({
			state,
			actions: { ...actions, resetMarkdownBottomBarPosition: resetBarPosition },
			options,
			chords,
		}),
		[state, actions, options, chords, resetBarPosition],
	);

	const resolvedCustomBottomBarNode =
		typeof customBottomBarNode === 'function'
			? customBottomBarNode(customNodeCtx)
			: customBottomBarNode;

	/** 底部操作栏内图标按钮（与「跟随滚动」一致） */
	const markdownBarIconBtnClass = (active: boolean) =>
		cn(
			'lucide-stroke-draw-hover flex size-7 cursor-pointer items-center justify-center rounded-md p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-theme/40',
			active
				? 'bg-theme/25 text-textcolor'
				: 'text-textcolor/80 hover:bg-theme/10 hover:text-textcolor',
		);

	return (
		<div
			id={id}
			role="toolbar"
			aria-label="Markdown 底部操作"
			aria-hidden={!open}
			className={cn(
				// 距底 10px 与水平居中始终不变；显隐仅靠透明度，拖动后的位置保持不变
				'absolute bottom-0 left-1/2 z-30 flex max-w-2xl -translate-x-1/2 -translate-y-[10px] justify-center transition-opacity duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0',
				open
					? 'opacity-100 pointer-events-auto'
					: 'opacity-0 pointer-events-none',
			)}
		>
			{/* drag transform 单独一层：便于用 getBoundingClientRect 与 root 对齐做边界夹紧 */}
			<div
				ref={dragLayerRef}
				className="flex min-w-0 w-full justify-center"
				// 无拖动偏移时不写 transform，与改动前「仅外层 translate 居中」的合成行为一致
				style={
					dragOffset.x === 0 && dragOffset.y === 0
						? undefined
						: { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }
				}
			>
				<div className="flex h-10 w-full min-w-0 px-1.5 items-center justify-between rounded-md border border-theme/5 bg-theme/5 shadow-[0_-6px_20px_-8px_color-mix(in_oklch,var(--theme-background)_60%,black)] backdrop-blur-[2px]">
					<div
						className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						role="tablist"
						aria-label="Markdown 视图"
					>
						<Tooltip content="拖动调整操作栏位置（不超出编辑器区域）">
							<button
								type="button"
								className={cn(
									'lucide-stroke-draw-hover flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md p-1 text-textcolor/45 outline-none transition-colors active:cursor-grabbing hover:bg-theme/10 hover:text-textcolor focus-visible:ring-2 focus-visible:ring-theme/40',
								)}
								aria-label="拖动底部操作栏位置"
								onPointerDown={onDragHandlePointerDown}
							>
								<GripVertical size={16} strokeWidth={1.75} aria-hidden />
							</button>
						</Tooltip>

						<Tooltip
							content={`编辑源码（${formatChordForTip(chords.markdownBarAction1)}）`}
						>
							<button
								type="button"
								role="tab"
								aria-selected={viewMode === 'edit'}
								className={markdownBarIconBtnClass(viewMode === 'edit')}
								aria-label="编辑源码"
								onClick={() => {
									closeMarkdownAssistant();
									setViewMode('edit');
									queueMicrotask(focusEditor);
								}}
							>
								<FilePen size={18} strokeWidth={1.75} />
							</button>
						</Tooltip>

						{markdownDiffBottomBarVisible ? (
							<Tooltip
								content={`${viewMode === 'splitDiff' ? '关闭分屏对照：回到单栏编辑' : '分屏对照修改：左编右只读 Diff'}（${formatChordForTip(chords.markdownBarAction2)}）`}
							>
								<button
									type="button"
									disabled={!markdownDiffBottomBarVisible}
									className={markdownBarIconBtnClass(
										viewMode === 'splitDiff' && !assistantRightPaneActive,
									)}
									aria-pressed={
										viewMode === 'splitDiff' && !assistantRightPaneActive
									}
									aria-label="开关分屏 Markdown 修改对照（Diff）"
									onClick={toggleMarkdownSplitDiffCompare}
								>
									<GitCompare size={18} strokeWidth={1.75} aria-hidden />
								</button>
							</Tooltip>
						) : null}

						<Tooltip
							content={`预览渲染（${formatChordForTip(chords.markdownBarAction3)}）`}
						>
							<button
								type="button"
								role="tab"
								aria-selected={viewMode === 'preview'}
								className={markdownBarIconBtnClass(viewMode === 'preview')}
								aria-label="预览渲染"
								onClick={() => {
									closeMarkdownAssistant();
									if (viewMode === 'preview') {
										setViewMode('edit');
										queueMicrotask(focusEditor);
									} else {
										setViewMode('preview');
									}
								}}
							>
								<Eye size={18} strokeWidth={1.75} />
							</button>
						</Tooltip>

						{bottomBarAssistantNodeEnabled ? (
							<Tooltip
								content={`${markdownAssistantOpen ? '关闭 AI 助手' : '开启 AI 助手'}（${formatChordForTip(chords.markdownBarAction4)}）`}
							>
								<button
									type="button"
									className={markdownBarIconBtnClass(markdownAssistantOpen)}
									aria-pressed={markdownAssistantOpen}
									aria-label="开关 Markdown 右侧 AI 助手"
									onClick={toggleMarkdownAssistant}
								>
									<Bot size={18} strokeWidth={1.75} aria-hidden />
								</button>
							</Tooltip>
						) : null}

						<Tooltip
							content={`分屏：左编辑右预览（${formatChordForTip(chords.markdownBarAction5)}）`}
						>
							<button
								type="button"
								role="tab"
								aria-selected={
									viewMode === 'split' && !assistantRightPaneActive
								}
								className={markdownBarIconBtnClass(
									viewMode === 'split' && !assistantRightPaneActive,
								)}
								aria-label="分屏：左编辑右预览"
								onClick={() => {
									// 需在关闭助手前判断：否则同一次点击内 assistant 仍为 true，会误判为「非纯分屏」
									const exitPureSplit =
										viewMode === 'split' && !assistantRightPaneActive;
									closeMarkdownAssistant();
									if (exitPureSplit) {
										setViewMode('edit');
										queueMicrotask(focusEditor);
									} else {
										setViewMode('split');
										queueMicrotask(focusEditor);
									}
								}}
							>
								<Columns2 size={18} strokeWidth={1.75} />
							</button>
						</Tooltip>

						{viewMode === 'split' && !assistantRightPaneActive && (
							<>
								<Tooltip
									content={`双边跟随：编辑区与预览区双向同步滚动（${formatChordForTip(chords.markdownBarAction6)}）`}
								>
									<button
										type="button"
										className={markdownBarIconBtnClass(
											splitScrollFollowMode === 'bidirectional',
										)}
										aria-pressed={splitScrollFollowMode === 'bidirectional'}
										aria-label="双边跟随：编辑与预览互相同步滚动"
										onClick={() =>
											setSplitScrollFollowMode((m) =>
												m === 'bidirectional' ? 'none' : 'bidirectional',
											)
										}
									>
										<BetweenVerticalEnd
											size={18}
											strokeWidth={1.75}
											aria-hidden
										/>
									</button>
								</Tooltip>

								<Tooltip
									content={`右边跟随左边：滚动编辑区时预览区同步滚动（${formatChordForTip(chords.markdownBarAction7)}）`}
								>
									<button
										type="button"
										className={markdownBarIconBtnClass(
											splitScrollFollowMode === 'previewFollowsEditor',
										)}
										aria-pressed={
											splitScrollFollowMode === 'previewFollowsEditor'
										}
										aria-label="右边跟随左边：预览跟随编辑滚动"
										onClick={() =>
											setSplitScrollFollowMode((m) =>
												m === 'previewFollowsEditor'
													? 'none'
													: 'previewFollowsEditor',
											)
										}
									>
										<BetweenHorizontalEnd
											size={18}
											strokeWidth={1.75}
											aria-hidden
										/>
									</button>
								</Tooltip>

								<Tooltip
									content={`左边跟随右边：滚动预览区时编辑区同步滚动（${formatChordForTip(chords.markdownBarAction8)}）`}
								>
									<button
										type="button"
										className={markdownBarIconBtnClass(
											splitScrollFollowMode === 'editorFollowsPreview',
										)}
										aria-pressed={
											splitScrollFollowMode === 'editorFollowsPreview'
										}
										aria-label="左边跟随右边：编辑区跟随预览滚动"
										onClick={() =>
											setSplitScrollFollowMode((m) =>
												m === 'editorFollowsPreview'
													? 'none'
													: 'editorFollowsPreview',
											)
										}
									>
										<BetweenHorizontalStart
											size={18}
											strokeWidth={1.75}
											aria-hidden
										/>
									</button>
								</Tooltip>
							</>
						)}
					</div>

					<div className="flex shrink-0 items-center gap-1.5 pl-2">
						{showOverwriteSaveToggle ? (
							<Tooltip
								content={`${overwriteSaveEnabled ? '已开启覆盖保存：同名文件将直接覆盖写入' : '开启覆盖保存：同名文件不再弹窗确认，直接覆盖写入'}（${formatChordForTip(chords.markdownBarAction9)}）`}
							>
								<button
									type="button"
									className={markdownBarIconBtnClass(overwriteSaveEnabled)}
									aria-pressed={overwriteSaveEnabled}
									aria-label={
										overwriteSaveEnabled ? '关闭覆盖保存' : '开启覆盖保存'
									}
									onClick={() =>
										onOverwriteSaveEnabledChange?.(!overwriteSaveEnabled)
									}
								>
									<FileInput size={18} strokeWidth={1.75} aria-hidden />
								</button>
							</Tooltip>
						) : null}

						{showAutoSaveControls ? (
							<>
								<Tooltip
									content={`${autoSaveEnabled ? '已开启自动保存：按所选间隔在有修改时保存' : '开启自动保存：按间隔自动保存（无标题/正文或同名冲突未开覆盖时会静默跳过）'}（${formatChordForTip(chords.markdownBarAction0)}）`}
								>
									<button
										type="button"
										className={markdownBarIconBtnClass(autoSaveEnabled)}
										aria-pressed={autoSaveEnabled}
										aria-label={
											autoSaveEnabled ? '关闭自动保存' : '开启自动保存'
										}
										onClick={() => onAutoSaveEnabledChange?.(!autoSaveEnabled)}
									>
										<FileClock size={18} strokeWidth={1.75} aria-hidden />
									</button>
								</Tooltip>

								<label
									className="sr-only"
									htmlFor="markdown-auto-save-interval"
								>
									自动保存间隔
								</label>
								<select
									id="markdown-auto-save-interval"
									className={cn(
										'h-7 max-w-26 shrink-0 rounded-md border border-theme/15 bg-transparent px-1 text-xs text-textcolor outline-none focus-visible:ring-2 focus-visible:ring-theme/40 disabled:cursor-not-allowed disabled:opacity-45',
									)}
									disabled={!autoSaveEnabled}
									value={String(autoSaveIntervalSec)}
									aria-label="自动保存间隔"
									onChange={(e) =>
										onAutoSaveIntervalSecChange?.(Number(e.target.value))
									}
								>
									{autoSaveIntervalOptions.map((sec) => (
										<option key={sec} value={String(sec)}>
											{formatKnowledgeAutoSaveIntervalLabel(sec)}
										</option>
									))}
								</select>
							</>
						) : null}

						{/* 最右侧：与覆盖保存/自动保存并列；无业务回调时也会渲染，保证始终可复位 */}
						<Tooltip
							content={`复位操作栏初始位置（${formatChordForTip(chords.markdownBarResetPosition)}）`}
						>
							<button
								type="button"
								className={cn(
									markdownBarIconBtnClass(false),
									// 已在默认位置时禁用，避免无意义点击；样式与其它 disabled 控件对齐
									'disabled:cursor-not-allowed disabled:opacity-60',
								)}
								disabled={dragOffset.x === 0 && dragOffset.y === 0}
								aria-label="复位操作栏位置"
								onClick={resetBarPosition}
							>
								<LocateFixed size={18} strokeWidth={1.75} aria-hidden />
							</button>
						</Tooltip>
						{resolvedCustomBottomBarNode ?? null}
					</div>
				</div>
			</div>
		</div>
	);
});
