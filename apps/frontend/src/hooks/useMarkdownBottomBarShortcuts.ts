import { isMacLike } from '@design/Monaco/utils';
import { useEffect, useState } from 'react';

// 注意：本 hook 不直接依赖任何“项目级快捷键存储实现”，
// 具体数据源与匹配逻辑由调用方通过 shortcutSource 注入（见 ShortcutSource）。

type MarkdownBottomBarChords = {
	toggleMarkdownBottomBar: string;
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

export type ShortcutSource = {
	/** 默认 chords（用于首次渲染兜底）。 */
	defaultChords: MarkdownBottomBarChords;
	/** 异步加载 chords（可返回部分字段覆盖默认值）。 */
	loadChords: () => Promise<
		Partial<MarkdownBottomBarChords> | null | undefined
	>;
	/** 订阅 chords 变更（例如设置保存后派发事件）；返回取消订阅函数。 */
	subscribeChordsChanged: (onChange: () => void) => () => void;
	/** chord 命中判定：由外部实现（不同项目可自定义解析/匹配规则）。 */
	chordMatchesStored: (stored: string | undefined, e: KeyboardEvent) => boolean;
};

const EMPTY_MARKDOWN_BOTTOM_BAR_SHORTCUT_SOURCE: ShortcutSource = {
	// 未注入时保持 hook “可用但不注册任何底部栏快捷键”：
	// - 仍可点击 UI 按钮使用底部栏功能
	// - 避免组件内部硬编码依赖某个项目的快捷键存储实现
	defaultChords: {
		toggleMarkdownBottomBar: '',
		markdownBarAction1: '',
		markdownBarAction2: '',
		markdownBarAction3: '',
		markdownBarAction4: '',
		markdownBarAction5: '',
		markdownBarAction6: '',
		markdownBarAction7: '',
		markdownBarAction8: '',
		markdownBarAction9: '',
		markdownBarAction0: '',
		markdownBarResetPosition: '',
	},
	loadChords: async () => null,
	subscribeChordsChanged: () => () => {},
	chordMatchesStored: () => false,
};

/**
 * 将存储串（例如 `Meta + Shift + 1`）格式化为 Tooltip 更易读的显示文本。
 *
 * 说明：
 * - Meta 在 macOS 上显示为 ⌘，非 macOS 显示为 Ctrl（更符合用户心智）
 * - Shift/Alt 在 macOS 上显示为 ⇧/⌥
 * - 仅用于展示，不参与匹配逻辑（匹配仍由 `chordMatchesStored` 处理）
 */
export function formatChordForTip(raw: string | undefined | null): string {
	const s = String(raw ?? '').trim();
	if (!s) return '';
	const mac = isMacLike();
	const parts = s
		.split('+')
		.map((p) => p.trim())
		.filter(Boolean);
	const mapped = parts.map((p) => {
		const low = p.toLowerCase();
		if (['meta', 'command', 'cmd', 'super'].includes(low))
			return mac ? '⌘' : 'Ctrl';
		if (['control', 'ctrl'].includes(low)) return 'Ctrl';
		if (low === 'shift') return mac ? '⇧' : 'Shift';
		if (low === 'alt') return mac ? '⌥' : 'Alt';
		// 主键：数字/字母用大写；其它保持原样（例如 Enter）
		if (p.length === 1) return p.toUpperCase();
		return p;
	});
	return `（${mapped.join(mac ? ' + ' : ' + ')}）`;
}

export function useMarkdownBottomBarShortcuts(input: {
	shortcutSource?: ShortcutSource;
	enabled: boolean;
	rootRef: React.RefObject<HTMLElement | null>;
	/** split/splitDiff 等模式需要即时值（避免 keydown 闭包滞后） */
	viewModeRef: React.RefObject<'edit' | 'preview' | 'split' | 'splitDiff'>;
	assistantRightPaneActive: boolean;
	markdownDiffBottomBarVisible: boolean;
	bottomBarAssistantNodeEnabled: boolean;
	showOverwriteSaveToggle: boolean;
	overwriteSaveEnabled: boolean;
	showAutoSaveControls: boolean;
	autoSaveEnabled: boolean;

	focusEditor: () => void;
	closeMarkdownAssistant: () => void;
	toggleMarkdownSplitDiffCompare: () => void;
	toggleMarkdownAssistant: () => void;
	setViewMode: (mode: 'edit' | 'preview' | 'split' | 'splitDiff') => void;
	setSplitScrollFollowMode: (
		updater: (
			prev:
				| 'none'
				| 'bidirectional'
				| 'previewFollowsEditor'
				| 'editorFollowsPreview',
		) =>
			| 'none'
			| 'bidirectional'
			| 'previewFollowsEditor'
			| 'editorFollowsPreview',
	) => void;
	onOverwriteSaveEnabledChange?: (next: boolean) => void;
	onAutoSaveEnabledChange?: (next: boolean) => void;
	/** 与底部栏「复位操作栏初始位置」按钮一致 */
	resetMarkdownBottomBarPosition: () => void;
	/** 切换底部操作栏开合（与顶部「操作栏」按钮一致） */
	toggleMarkdownBottomBar: () => void;
	/** 是否启用「切换操作栏」快捷键分支（默认由上层决定） */
	enableToggleMarkdownBottomBarShortcut: boolean;
}) {
	const {
		shortcutSource: shortcutSourceProp,
		enabled,
		rootRef,
		viewModeRef,
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
		resetMarkdownBottomBarPosition,
		toggleMarkdownBottomBar,
		enableToggleMarkdownBottomBarShortcut,
	} = input;

	const shortcutSource =
		shortcutSourceProp ?? EMPTY_MARKDOWN_BOTTOM_BAR_SHORTCUT_SOURCE;

	const [chords, setChords] = useState<MarkdownBottomBarChords>(
		() => shortcutSource.defaultChords,
	);

	useEffect(() => {
		let disposed = false;
		const load = async () => {
			const c = await shortcutSource.loadChords();
			if (disposed) return;
			if (!c) return;
			setChords((prev) => ({ ...prev, ...c }));
		};
		void load();
		const unsubscribe = shortcutSource.subscribeChordsChanged(() => {
			void load();
		});
		return () => {
			disposed = true;
			unsubscribe?.();
		};
	}, [shortcutSource]);

	useEffect(() => {
		if (!enabled) return;
		const onKeydown = (e: KeyboardEvent) => {
			/**
			 * 触发范围策略：
			 * - 期望：⌘+数字在“刚进入页面、尚未点击编辑器/操作栏”时也能工作
			 * - 约束：不要影响其它输入框（例如搜索框/表单输入）
			 *
			 * 因此这里不强制要求事件必须发生在 rootRef 内；
			 * 只要当前事件目标不是“其它可编辑输入区域”，就允许处理。
			 */
			const target = e.target as HTMLElement | null;
			const dom = rootRef.current;
			if (!dom) return;
			const tag = (target?.tagName ?? '').toUpperCase();
			const isEditable =
				tag === 'INPUT' ||
				tag === 'TEXTAREA' ||
				Boolean(target?.isContentEditable);
			if (isEditable && !dom.contains(target)) return;

			const hit = (stored: string | undefined) =>
				shortcutSource.chordMatchesStored(stored, e);

			if (
				enableToggleMarkdownBottomBarShortcut &&
				hit(chords.toggleMarkdownBottomBar)
			) {
				e.preventDefault();
				e.stopPropagation();
				toggleMarkdownBottomBar();
				return;
			}

			if (hit(chords.markdownBarAction1)) {
				e.preventDefault();
				e.stopPropagation();
				closeMarkdownAssistant();
				setViewMode('edit');
				queueMicrotask(focusEditor);
				return;
			}

			if (hit(chords.markdownBarAction2)) {
				e.preventDefault();
				e.stopPropagation();
				if (markdownDiffBottomBarVisible) {
					toggleMarkdownSplitDiffCompare();
				}
				return;
			}

			if (hit(chords.markdownBarAction3)) {
				e.preventDefault();
				e.stopPropagation();
				closeMarkdownAssistant();
				if (viewModeRef.current === 'preview') {
					setViewMode('edit');
					queueMicrotask(focusEditor);
				} else {
					setViewMode('preview');
				}
				return;
			}

			if (hit(chords.markdownBarAction4)) {
				e.preventDefault();
				e.stopPropagation();
				if (bottomBarAssistantNodeEnabled) {
					toggleMarkdownAssistant();
				}
				return;
			}

			if (hit(chords.markdownBarAction5)) {
				e.preventDefault();
				e.stopPropagation();
				// 与底部栏点击一致：在关闭助手前读取，避免闭包内 assistant 状态滞后
				const exitPureSplit =
					viewModeRef.current === 'split' && !assistantRightPaneActive;
				closeMarkdownAssistant();
				if (exitPureSplit) {
					setViewMode('edit');
					queueMicrotask(focusEditor);
				} else {
					setViewMode('split');
					queueMicrotask(focusEditor);
				}
				return;
			}

			// 6/7/8：仅 split 且右侧为预览时（非助手占用）才可用（与 UI 一致）
			const canUseFollow =
				viewModeRef.current === 'split' && !assistantRightPaneActive;
			if (hit(chords.markdownBarAction6)) {
				e.preventDefault();
				e.stopPropagation();
				if (!canUseFollow) return;
				setSplitScrollFollowMode((m) =>
					m === 'bidirectional' ? 'none' : 'bidirectional',
				);
				return;
			}
			if (hit(chords.markdownBarAction7)) {
				e.preventDefault();
				e.stopPropagation();
				if (!canUseFollow) return;
				setSplitScrollFollowMode((m) =>
					m === 'previewFollowsEditor' ? 'none' : 'previewFollowsEditor',
				);
				return;
			}
			if (hit(chords.markdownBarAction8)) {
				e.preventDefault();
				e.stopPropagation();
				if (!canUseFollow) return;
				setSplitScrollFollowMode((m) =>
					m === 'editorFollowsPreview' ? 'none' : 'editorFollowsPreview',
				);
				return;
			}

			if (hit(chords.markdownBarAction9)) {
				e.preventDefault();
				e.stopPropagation();
				if (!showOverwriteSaveToggle) return;
				onOverwriteSaveEnabledChange?.(!overwriteSaveEnabled);
				return;
			}

			if (hit(chords.markdownBarAction0)) {
				e.preventDefault();
				e.stopPropagation();
				if (!showAutoSaveControls) return;
				onAutoSaveEnabledChange?.(!autoSaveEnabled);
				return;
			}

			if (hit(chords.markdownBarResetPosition)) {
				e.preventDefault();
				e.stopPropagation();
				resetMarkdownBottomBarPosition();
				return;
			}
		};

		window.addEventListener('keydown', onKeydown, true);
		return () => window.removeEventListener('keydown', onKeydown, true);
	}, [
		shortcutSource,
		enabled,
		rootRef,
		chords,
		enableToggleMarkdownBottomBarShortcut,
		toggleMarkdownBottomBar,
		viewModeRef,
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
		resetMarkdownBottomBarPosition,
	]);

	return { chords };
}
