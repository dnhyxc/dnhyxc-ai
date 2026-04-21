import Tooltip from '@design/Tooltip';
import {
	BetweenHorizontalEnd,
	BetweenHorizontalStart,
	BetweenVerticalEnd,
	Bot,
	Columns2,
	Eye,
	FileInput,
	FilePenLine,
	GitCompare,
	Timer,
} from 'lucide-react';
import { memo, type RefObject, useMemo } from 'react';
import {
	formatChordForTip,
	useMarkdownBottomBarShortcuts,
} from '@/hooks/useMarkdownBottomBarShortcuts';
import { cn } from '@/lib/utils';
import { KNOWLEDGE_AUTO_SAVE_INTERVAL_PRESETS } from './options';
import { formatKnowledgeAutoSaveIntervalLabel } from './utils';

type MarkdownViewMode = 'edit' | 'preview' | 'split' | 'splitDiff';
type MarkdownSplitScrollFollowMode =
	| 'none'
	| 'bidirectional'
	| 'previewFollowsEditor'
	| 'editorFollowsPreview';

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
};

export const MarkdownBottomBar = memo(function MarkdownBottomBar(props: {
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
		bottomBarCustomNodeEnabled: boolean;
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
}) {
	const { id, open, shortcuts, state, options, actions } = props;
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
	const { bottomBarCustomNodeEnabled } = options;
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

	const { chords } = useMarkdownBottomBarShortcuts({
		enabled: shortcuts.enabled,
		rootRef: shortcuts.rootRef,
		viewModeRef: shortcuts.viewModeRef,
		assistantRightPaneActive,
		markdownDiffBottomBarVisible,
		bottomBarCustomNodeEnabled,
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
	});

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
			className={cn(
				'absolute bottom-0 left-1/2 z-30 flex max-w-2xl -translate-x-1/2 justify-center transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0',
				open
					? '-translate-y-2 pointer-events-auto'
					: 'translate-y-15 pointer-events-none',
			)}
		>
			<div className="flex h-10 w-full min-w-0 px-1.5 items-center justify-between rounded-md border border-theme/5 bg-theme/5 shadow-[0_-6px_20px_-8px_color-mix(in_oklch,var(--theme-background)_60%,black)] backdrop-blur-[2px]">
				<div
					className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					role="tablist"
					aria-label="Markdown 视图"
				>
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
							<FilePenLine size={18} strokeWidth={1.75} />
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
								setViewMode('preview');
							}}
						>
							<Eye size={18} strokeWidth={1.75} />
						</button>
					</Tooltip>

					{bottomBarCustomNodeEnabled ? (
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
							aria-selected={viewMode === 'split' && !assistantRightPaneActive}
							className={markdownBarIconBtnClass(
								viewMode === 'split' && !assistantRightPaneActive,
							)}
							aria-label="分屏：左编辑右预览"
							onClick={() => {
								closeMarkdownAssistant();
								setViewMode('split');
								queueMicrotask(focusEditor);
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

				{showOverwriteSaveToggle || showAutoSaveControls ? (
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
										<Timer size={18} strokeWidth={1.75} aria-hidden />
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
					</div>
				) : null}
			</div>
		</div>
	);
});
