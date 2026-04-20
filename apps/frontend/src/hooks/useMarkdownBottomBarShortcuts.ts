import { useEffect, useState } from 'react';
import { isMacLike } from '@/utils';
import {
	chordMatchesStored,
	KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS,
	KNOWLEDGE_SHORTCUTS_CHANGED_EVENT,
	loadKnowledgeShortcutChords,
} from '@/utils/knowledge-shortcuts';

type MarkdownBottomBarChords = {
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
	return mapped.join(mac ? ' + ' : ' + ');
}

export function useMarkdownBottomBarShortcuts(input: {
	enabled: boolean;
	rootRef: React.RefObject<HTMLElement | null>;
	/** split/splitDiff 等模式需要即时值（避免 keydown 闭包滞后） */
	viewModeRef: React.RefObject<'edit' | 'preview' | 'split' | 'splitDiff'>;
	assistantRightPaneActive: boolean;
	markdownDiffBottomBarVisible: boolean;
	bottomBarCustomNodeEnabled: boolean;
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
}) {
	const {
		enabled,
		rootRef,
		viewModeRef,
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
	} = input;

	const [chords, setChords] = useState<MarkdownBottomBarChords>(() => ({
		markdownBarAction1: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction1,
		markdownBarAction2: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction2,
		markdownBarAction3: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction3,
		markdownBarAction4: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction4,
		markdownBarAction5: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction5,
		markdownBarAction6: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction6,
		markdownBarAction7: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction7,
		markdownBarAction8: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction8,
		markdownBarAction9: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction9,
		markdownBarAction0: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction0,
	}));

	useEffect(() => {
		let disposed = false;
		const load = async () => {
			const c = await loadKnowledgeShortcutChords();
			if (disposed) return;
			setChords({
				markdownBarAction1: c.markdownBarAction1,
				markdownBarAction2: c.markdownBarAction2,
				markdownBarAction3: c.markdownBarAction3,
				markdownBarAction4: c.markdownBarAction4,
				markdownBarAction5: c.markdownBarAction5,
				markdownBarAction6: c.markdownBarAction6,
				markdownBarAction7: c.markdownBarAction7,
				markdownBarAction8: c.markdownBarAction8,
				markdownBarAction9: c.markdownBarAction9,
				markdownBarAction0: c.markdownBarAction0,
			});
		};
		void load();
		const onChanged = () => void load();
		window.addEventListener(KNOWLEDGE_SHORTCUTS_CHANGED_EVENT, onChanged);
		return () => {
			disposed = true;
			window.removeEventListener(KNOWLEDGE_SHORTCUTS_CHANGED_EVENT, onChanged);
		};
	}, []);

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

			const hit = (stored: string | undefined) => chordMatchesStored(stored, e);

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
				setViewMode('preview');
				return;
			}

			if (hit(chords.markdownBarAction4)) {
				e.preventDefault();
				e.stopPropagation();
				if (bottomBarCustomNodeEnabled) {
					toggleMarkdownAssistant();
				}
				return;
			}

			if (hit(chords.markdownBarAction5)) {
				e.preventDefault();
				e.stopPropagation();
				closeMarkdownAssistant();
				setViewMode('split');
				queueMicrotask(focusEditor);
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
		};

		window.addEventListener('keydown', onKeydown, true);
		return () => window.removeEventListener('keydown', onKeydown, true);
	}, [
		enabled,
		rootRef,
		chords,
		viewModeRef,
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
	]);

	return { chords };
}
