import Tooltip from '@design/Tooltip';
import Editor, {
	type BeforeMount,
	DiffEditor,
	type DiffOnMount,
	type OnMount,
	useMonaco,
} from '@monaco-editor/react';
import { Button } from '@ui/index';
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
	PanelTopClose,
	PanelTopOpen,
	Timer,
} from 'lucide-react';
import {
	type RefObject,
	useCallback,
	useDeferredValue,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import type { GroupImperativeHandle, Layout } from 'react-resizable-panels';
import { QuickContextMenu } from '@/components/design/ContextMenu';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
	formatChordForTip,
	useMarkdownBottomBarShortcuts,
} from '@/hooks/useMarkdownBottomBarShortcuts';
import { cn } from '@/lib/utils';
import { copyToClipboard, pasteFromClipboard } from '@/utils/clipboard';
import Loading from '../Loading';
import { registerMonacoEditorCommands } from './commands';
import {
	buildMonacoEditorContextMenuItems,
	injectMonacoEditorContextActions,
	type MonacoEditorContextActions,
} from './contextMenu';
import {
	registerPrettierFormatProviders,
	safeFormatMarkdownValue,
} from './format';
import { GLASS_THEME_BY_UI, registerMonacoGlassThemes } from './glassTheme';
import { registerMarkdownFenceEmbeddedHighlight } from './markdownTokens';
import {
	KNOWLEDGE_AUTO_SAVE_INTERVAL_PRESETS,
	MARKDOWN_EDITOR_WORD_WRAP_COLUMN,
	options,
} from './options';
import ParserMarkdownPreviewPane from './preview';
import {
	buildMarkdownScrollSyncSnapshot,
	formatKnowledgeAutoSaveIntervalLabel,
	isMarkdownDiffEntryEligible,
	type MarkdownDiffBaselineSource,
	type MarkdownScrollSyncSnapshot,
	type MonacoEditorInstance,
	normalizeMonacoEol,
	syncEditorScrollFromMarkdownPreview,
	syncPreviewScrollFromMarkdownEditor,
} from './utils';

/** `split`：左编右预览；`splitDiff`：左编右只读 Diff（与 `split` 互斥） */
type MarkdownViewMode = 'edit' | 'preview' | 'split' | 'splitDiff';

/**
 * 分屏跟滚（一次只开一种）：
 * - previewFollowsEditor：右边预览跟随左边编辑；滚预览不带动编辑区
 * - editorFollowsPreview：左边编辑跟随右边预览；滚编辑区不带动预览
 * - bidirectional：双边跟随（编辑↔预览互相同步，带回声抑制）
 */
type MarkdownSplitScrollFollowMode =
	| 'none'
	| 'previewFollowsEditor'
	| 'editorFollowsPreview'
	| 'bidirectional';

/** 与 Monaco 编辑器 `wordWrap` 一致，仅 `language === 'markdown'` 时写入 options */
export type MarkdownEditorWordWrap =
	| 'off'
	| 'on'
	| 'wordWrapColumn'
	| 'bounded';

interface MarkdownEditorProps {
	value?: string;
	onChange?: (value: string) => void;
	/** 逻辑文档 id（如知识库条目），变化时换 model，避免串文 */
	documentIdentity?: string;
	placeholder?: string;
	className?: string;
	height?: string;
	readOnly?: boolean;
	theme?: 'vs' | 'vs-dark' | 'hc-black';
	language?: string;
	toolbar: React.ReactNode;
	title?: React.ReactNode;
	chatNode?: React.ReactNode;
	/**
	 * Markdown 右侧 AI 助手面板是否展开；与 onMarkdownAssistantOpenChange 同时传入时为受控模式。
	 * 开启后分屏右侧展示 `chatNode`（与预览 / Diff 互斥）；仅在传入 `chatNode` 时底部栏显示开关。
	 */
	markdownAssistantOpen?: boolean;
	onMarkdownAssistantOpenChange?: (open: boolean) => void;
	/** 为 markdown 时是否显示编辑/预览/分屏切换；默认 true */
	enableMarkdownPreview?: boolean;
	/**
	 * Markdown 编辑区折行模式；默认 `bounded`（与 `wordWrapColumn`、视口宽度取较小者折行）。
	 * 若 IME 重影可传 `off`（见 docs/monaco-markdown-ime-ghosting.md）。
	 */
	wordWrap?: MarkdownEditorWordWrap;
	/**
	 * Markdown 折行列参考宽度；默认 `MARKDOWN_EDITOR_WORD_WRAP_COLUMN`（120，见 `options.ts`）。
	 * 在 `wordWrap` 为 `wordWrapColumn` / `bounded` / `on` 时由 Monaco 使用。
	 */
	wordWrapColumn?: number;
	/** 是否显示编辑/预览/分屏切换的 tab 栏；默认 true */
	showTabBar?: boolean;
	/**
	 * Markdown 底部操作栏是否展开；与 onMarkdownBottomBarOpenChange 同时传入时为受控模式。
	 */
	markdownBottomBarOpen?: boolean;
	onMarkdownBottomBarOpenChange?: (open: boolean) => void;
	/** 「操作栏」按钮 Tooltip 中的快捷键说明 */
	markdownBottomBarShortcutHint?: string;
	/**
	 * Markdown 预览是否解析并渲染 ```mermaid 围栏（与 MarkdownParser `enableMermaid` 一致）。
	 * @default true
	 */
	markdownEnableMermaid?: boolean;
	/**
	 * 覆盖保存开关（由外部业务决定含义；知识库场景用于“同名文件直接覆盖保存”）。
	 * 仅在同时传入 onOverwriteSaveEnabledChange 时显示在 Markdown 底部操作栏。
	 */
	overwriteSaveEnabled?: boolean;
	onOverwriteSaveEnabledChange?: (enabled: boolean) => void;
	/**
	 * 定时自动保存：需同时传入 onAutoSaveEnabledChange 与 onAutoSaveIntervalSecChange 才在底部栏显示。
	 * 实际定时逻辑由业务页（如知识库）实现。
	 */
	autoSaveEnabled?: boolean;
	onAutoSaveEnabledChange?: (enabled: boolean) => void;
	autoSaveIntervalSec?: number;
	onAutoSaveIntervalSecChange?: (sec: number) => void;
	/**
	 * 保存前取编辑器当前全文并同步触发 onChange（消除 rAF 合并导致父状态滞后）。
	 * 知识库自动保存依赖此 ref，否则脏检查会一直认为「与快照一致」而跳过。
	 */
	getMarkdownFromEditorRef?: RefObject<(() => string) | null>;
	/**
	 * Monaco 粘性滚动（sticky scroll）开关：
	 * - true：启用粘性条（顶部钉住外层语法块行）
	 * - false：关闭粘性条（减少装饰层，Diff 模式也更干净）
	 *
	 * @default true（与 `options.ts` 当前默认一致）
	 */
	stickyScrollEnabled?: boolean;
	/**
	 * 粘性条是否跟随编辑器横向滚动（scrollWithEditor，随编辑器水平滚动）。
	 *
	 * @default true（与 `options.ts` 当前默认一致）
	 */
	stickyScrollScrollWithEditor?: boolean;
	/**
	 * 分屏对照（Diff）基线来源：
	 * - 知识库/回收站打开：用 `persisted`，并传 `diffBaselineText` 为打开时的正文快照
	 * - 新建草稿：用 `empty`，表示当前正文与空内容对比
	 * - 其它场景：可用 `current`（默认），表示与“点击开启对照瞬间”的正文对比
	 *
	 * @default 'current'
	 */
	diffBaselineSource?: MarkdownDiffBaselineSource;
	/**
	 * 当 `diffBaselineSource === 'persisted'` 时使用的基线正文（建议为打开编辑器时的内容快照）。
	 * 该值用于生成 Diff 左侧（original）。
	 */
	diffBaselineText?: string;
	/**
	 * 外部接入：将“编辑器当前选区文本”写入某个输入框（例如知识库助手输入框）。
	 *
	 * 约束：
	 * - 仅处理**非空选区**（不会降级为“复制整行”），避免误把整行/整段塞进对话框。
	 * - 具体写入方式（覆盖/追加、是否聚焦输入框）由外部决定。
	 */
	onInsertSelectionToAssistant?: (text: string) => void;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
	value = '',
	onChange,
	documentIdentity = 'default',
	placeholder = '# 输入内容...',
	className,
	height = '300px',
	readOnly = false,
	theme = 'vs',
	language = 'markdown',
	toolbar,
	title,
	chatNode,
	markdownAssistantOpen: markdownAssistantOpenProp,
	onMarkdownAssistantOpenChange,
	enableMarkdownPreview = true,
	wordWrap = 'bounded',
	wordWrapColumn = MARKDOWN_EDITOR_WORD_WRAP_COLUMN,
	showTabBar = true,
	markdownBottomBarOpen: markdownBottomBarOpenProp,
	onMarkdownBottomBarOpenChange,
	markdownBottomBarShortcutHint,
	markdownEnableMermaid = true,
	overwriteSaveEnabled = false,
	onOverwriteSaveEnabledChange,
	autoSaveEnabled = false,
	onAutoSaveEnabledChange,
	autoSaveIntervalSec = 60,
	onAutoSaveIntervalSecChange,
	getMarkdownFromEditorRef,
	stickyScrollEnabled = true,
	stickyScrollScrollWithEditor = true,
	diffBaselineSource = 'current',
	diffBaselineText,
	onInsertSelectionToAssistant,
}) => {
	/** 底部 Markdown 操作条是否展开（受控或未传 props 时内部 state） */
	const [internalMarkdownBottomBarOpen, setInternalMarkdownBottomBarOpen] =
		useState(false);
	const [viewMode, setViewMode] = useState<MarkdownViewMode>('edit');
	const [splitScrollFollowMode, setSplitScrollFollowMode] =
		useState<MarkdownSplitScrollFollowMode>('none');
	/** Diff 左侧（original）对照文本：进入 splitDiff 时从当前编辑器快照 */
	const [diffBaselineOriginal, setDiffBaselineOriginal] = useState('');
	/** Diff 会话 id：每次进入 splitDiff +1，用于生成独立模型路径，避免 keepCurrent*Model 复用陈旧文本 */
	const [diffSessionId, setDiffSessionId] = useState(0);
	const [internalMarkdownAssistantOpen, setInternalMarkdownAssistantOpen] =
		useState(false);

	const editorRef = useRef<MonacoEditorInstance | null>(null);
	/** MarkdownEditor 根容器：用于判定快捷键事件是否发生在本组件内（含底部操作栏） */
	const rootRef = useRef<HTMLDivElement | null>(null);
	/** onMount 注入：右键菜单与 Cmd/Ctrl+C/V/X 等同源 */
	const editorContextActionsRef = useRef<MonacoEditorContextActions | null>(
		null,
	);
	/** 包裹 Editor 的宿主，用于测量 client 尺寸并显式 layout（Tauri 全屏恢复后避免沿用旧宽度） */
	const editorHostRef = useRef<HTMLDivElement | null>(null);
	/** onMount 内赋值，供 useLayoutEffect 在 height / 视图切换后触发与挂载时相同的 layout 逻辑 */
	const applyEditorLayoutRef = useRef<(() => void) | null>(null);
	const imeComposingRef = useRef(false);
	const onChangeRef = useRef(onChange);
	const valueFromPropsRef = useRef(value);
	const lastEmittedRef = useRef(normalizeMonacoEol(value));
	const prevDocumentIdentityRef = useRef(documentIdentity);
	/** 用于 value 同步：换篇（documentIdentity 变）时即使编辑器有焦点也允许 setValue */
	const prevIdentityForValueSyncRef = useRef(documentIdentity);
	/** ResizablePanelGroup 的命令式句柄：用于在 edit/split 间切换时恢复布局，避免右侧宽度卡死 */
	const panelGroupRef = useRef<GroupImperativeHandle | null>(null);
	const lastSplitLayoutRef = useRef<Layout>({ editor: 50, right: 50 });
	const activeDiffSessionRef = useRef(0);
	const viewModeRef = useRef(viewMode);
	const previewViewportRef = useRef<HTMLDivElement | null>(null);
	/** 包裹 DiffEditor 的宿主，用于显式 layout（与主编辑器一致） */
	const diffEditorHostRef = useRef<HTMLDivElement | null>(null);
	const applyDiffEditorLayoutRef = useRef<(() => void) | null>(null);
	/** 分屏跟滚布局快照：正文/布局变化时重建；滚动时仅在折线上插值 */
	const markdownScrollSyncSnapshotRef =
		useRef<MarkdownScrollSyncSnapshot | null>(null);
	/** 合并滚动同步到下一帧，避免 onDidScrollChange 高频读布局 */
	const scrollSyncRafRef = useRef(0);
	/** 预览滚动驱动编辑器的 rAF 合并 */
	const previewToEditorRafRef = useRef(0);
	/** 编辑器改预览 scrollTop 后，忽略下一波预览 scroll 回声，防双向打架 */
	const suppressPreviewScrollEchoRef = useRef(false);
	/** 预览改编辑器滚动后，忽略下一波 onDidScrollChange 回声 */
	const suppressEditorScrollEchoRef = useRef(false);
	/** ResizeObserver 回调合并到单帧，减轻分栏拖拽时连续测量 */
	const previewResizeRafRef = useRef(0);
	const splitScrollFollowModeRef = useRef(splitScrollFollowMode);
	/** 仅换 path 时更新，避免 defaultValue 每键变化导致 memo(Editor) 重渲染与 IME 叠字 */
	const lastPathForBootstrapRef = useRef<string | null>(null);
	const editorBootstrapTextRef = useRef(value);
	/**
	 * Diff 退出后延迟 dispose 上一会话的模型：
	 * - 由于 DiffEditor 传了 keepCurrent*Model，会保留原/改两个 TextModel，避免卸载竞态报错
	 * - 但若不手动释放，会导致下一次进入 Diff 复用旧 model（内容残留）或长期累积内存
	 *
	 * 处理方式：
	 * - 进入 splitDiff 时记录 activeDiffSessionRef
	 * - 退出 splitDiff 时 capture 当次 session 的 modelPath，并在双 rAF 后 dispose
	 */
	const prevViewModeRef = useRef<MarkdownViewMode>(viewMode);

	viewModeRef.current = viewMode;
	// 与 useLayoutEffect / rAF 对齐：避免仅用 useEffect 写 ref 时滞后一帧
	splitScrollFollowModeRef.current = splitScrollFollowMode;
	const scrollFollowActive = splitScrollFollowMode !== 'none';
	/** 预览侧是否监听 scroll 以驱动编辑器（单向左跟右 + 双边） */
	const editorFollowsPreviewActive =
		splitScrollFollowMode === 'editorFollowsPreview' ||
		splitScrollFollowMode === 'bidirectional';

	const markdownBottomBarId = useId();

	const bottomBarControlled =
		markdownBottomBarOpenProp !== undefined &&
		onMarkdownBottomBarOpenChange !== undefined;
	const markdownBottomBarOpen = bottomBarControlled
		? markdownBottomBarOpenProp
		: internalMarkdownBottomBarOpen;

	const isMarkdown = language === 'markdown' && enableMarkdownPreview;
	const assistantPanelControlled =
		markdownAssistantOpenProp !== undefined &&
		onMarkdownAssistantOpenChange !== undefined;
	const markdownAssistantOpen = assistantPanelControlled
		? Boolean(markdownAssistantOpenProp)
		: internalMarkdownAssistantOpen;
	/** 右侧栏是否为 AI 助手（非预览）：此时不按「左编右预览」处理分屏选中与跟滚 */
	const assistantRightPaneActive = Boolean(chatNode && markdownAssistantOpen);
	/** 分屏右侧为 Markdown 预览且启用跟滚时，才做左右滚动同步（Diff 模式下右侧无预览 DOM） */
	const splitPreviewScrollSyncEligible =
		viewMode === 'split' &&
		scrollFollowActive &&
		isMarkdown &&
		!assistantRightPaneActive;

	valueFromPropsRef.current = value;

	const showOverwriteSaveToggle = Boolean(onOverwriteSaveEnabledChange);
	const showAutoSaveControls = Boolean(
		onAutoSaveEnabledChange && onAutoSaveIntervalSecChange,
	);

	/** 有正文时勿传占位文案，否则部分 Monaco 版本在失焦或未编辑时仍叠画「# 输入内容...」 */
	const hasEditorBody = normalizeMonacoEol(value ?? '').trim().length > 0;
	const effectivePlaceholder = hasEditorBody ? '' : placeholder;
	const glassThemeId = GLASS_THEME_BY_UI[theme];

	const monaco = useMonaco();

	const toggleMarkdownBottomBar = useCallback(() => {
		if (bottomBarControlled && onMarkdownBottomBarOpenChange) {
			onMarkdownBottomBarOpenChange(!markdownBottomBarOpenProp);
		} else {
			setInternalMarkdownBottomBarOpen((o) => !o);
		}
	}, [
		bottomBarControlled,
		markdownBottomBarOpenProp,
		onMarkdownBottomBarOpenChange,
	]);

	const toggleMarkdownAssistant = useCallback(() => {
		if (!chatNode) return;
		const next = !markdownAssistantOpen;
		// 仅通过机器人开关关闭助手时：回到「编辑源码」，避免仍停留在为助手而设的左编右预览分屏
		if (!next) {
			setViewMode('edit');
		}
		if (assistantPanelControlled && onMarkdownAssistantOpenChange) {
			onMarkdownAssistantOpenChange(next);
		} else {
			setInternalMarkdownAssistantOpen(next);
		}
	}, [
		chatNode,
		markdownAssistantOpen,
		assistantPanelControlled,
		onMarkdownAssistantOpenChange,
	]);

	/** 关闭右侧 AI 助手（编辑/预览/分屏/Diff 切换时调用） */
	const closeMarkdownAssistant = useCallback(() => {
		if (assistantPanelControlled && onMarkdownAssistantOpenChange) {
			onMarkdownAssistantOpenChange(false);
		} else {
			setInternalMarkdownAssistantOpen(false);
		}
	}, [assistantPanelControlled, onMarkdownAssistantOpenChange]);

	const autoSaveIntervalOptions = useMemo(() => {
		const presets: number[] = [...KNOWLEDGE_AUTO_SAVE_INTERVAL_PRESETS];
		if (!presets.includes(autoSaveIntervalSec)) {
			presets.push(autoSaveIntervalSec);
		}
		return presets.sort((a, b) => a - b);
	}, [autoSaveIntervalSec]);

	/** 主编辑器右键菜单（与快捷键逻辑一致，依赖 editorContextActionsRef） */
	const editorContextMenuItems = useMemo(
		() =>
			buildMonacoEditorContextMenuItems({
				readOnly,
				language,
				actionsRef: editorContextActionsRef,
				enableSendSelectionToAssistant:
					typeof onInsertSelectionToAssistant === 'function',
			}),
		[readOnly, language, onInsertSelectionToAssistant],
	);

	const markdownDiffEntryEligible = useMemo(
		() =>
			isMarkdownDiffEntryEligible(value, diffBaselineSource, diffBaselineText),
		[value, diffBaselineSource, diffBaselineText],
	);
	/** 底部栏 Diff：可进入时显示；已进入 splitDiff 时也必须显示（用于退出对照） */
	const markdownDiffBottomBarVisible =
		markdownDiffEntryEligible || viewMode === 'splitDiff';

	const monacoModelPath = useMemo(() => {
		const lang = language.replace(/[^a-zA-Z0-9_-]/g, '_');
		const id = String(documentIdentity).replace(/[^a-zA-Z0-9_-]/g, '_');
		return `dnhyxc-editor-${lang}__${id}`;
	}, [language, documentIdentity]);

	const diffOriginalModelPath = useMemo(() => {
		const id = String(documentIdentity).replace(/[^a-zA-Z0-9_-]/g, '_');
		return `dnhyxc-md-diff-original__${id}__s${diffSessionId}`;
	}, [documentIdentity, diffSessionId]);

	const diffModifiedModelPath = useMemo(() => {
		const id = String(documentIdentity).replace(/[^a-zA-Z0-9_-]/g, '_');
		return `dnhyxc-md-diff-modified__${id}__s${diffSessionId}`;
	}, [documentIdentity, diffSessionId]);

	const mergedEditorOptions = useMemo(() => {
		// 关闭 automaticLayout：WebView/Tauri 全屏→窗口化时内部 ResizeObserver 易滞后，改由宿主显式喂宽高
		const base = {
			...options,
			readOnly,
			automaticLayout: false as const,
			// 由外部参数控制是否开启粘性滚动（覆盖 options.ts 的默认）
			stickyScroll: {
				enabled: stickyScrollEnabled,
				scrollWithEditor: stickyScrollScrollWithEditor,
			},
		};
		if (language === 'markdown') {
			return {
				...base,
				placeholder: effectivePlaceholder,
				// wordWrap = 'bounded' 开启折行，开启折行之后会导致重影
				wordWrap,
				wordWrapColumn,
			};
		}
		return { ...base, placeholder: effectivePlaceholder };
	}, [
		readOnly,
		effectivePlaceholder,
		language,
		wordWrap,
		wordWrapColumn,
		stickyScrollEnabled,
		stickyScrollScrollWithEditor,
	]);

	/** 分屏 Diff：两侧只读，编辑仅在左侧主编辑器 */
	const mergedDiffEditorOptions = useMemo(() => {
		const base = {
			readOnly: true,
			automaticLayout: false as const,
			renderSideBySide: true,
			enableSplitViewResizing: true,
			// 与主编辑器保持一致：由外部参数控制是否启用粘性滚动（sticky scroll）
			stickyScroll: {
				enabled: stickyScrollEnabled,
				scrollWithEditor: stickyScrollScrollWithEditor,
			},
			// Diff 两侧子编辑器也需要同步（避免只对顶层生效）
			originalEditor: {
				stickyScroll: {
					enabled: stickyScrollEnabled,
					scrollWithEditor: stickyScrollScrollWithEditor,
				},
			},
			modifiedEditor: {
				stickyScroll: {
					enabled: stickyScrollEnabled,
					scrollWithEditor: stickyScrollScrollWithEditor,
				},
			},
		};
		if (language === 'markdown') {
			return { ...base, wordWrap, wordWrapColumn };
		}
		return { ...base, wordWrap: 'on' as const };
	}, [
		language,
		wordWrap,
		wordWrapColumn,
		stickyScrollEnabled,
		stickyScrollScrollWithEditor,
	]);

	const handleMonacoBeforeMount: BeforeMount = useCallback((monaco) => {
		registerMonacoGlassThemes(monaco);
		registerPrettierFormatProviders(monaco);
		registerMarkdownFenceEmbeddedHighlight(monaco);
	}, []);

	if (lastPathForBootstrapRef.current !== monacoModelPath) {
		lastPathForBootstrapRef.current = monacoModelPath;
		editorBootstrapTextRef.current = value;
	}

	const deferredPreviewMarkdown = useDeferredValue(value);
	/** 分屏下用即时正文，避免 deferred 滞后导致预览 DOM 与编辑器 scroll 不同步 */
	const splitPaneMarkdown = viewMode === 'split' ? (value ?? '') : '';
	/** Diff 右侧（modified）与主编辑器正文同步 */
	const splitDiffModifiedText =
		viewMode === 'splitDiff' ? normalizeMonacoEol(value ?? '') : '';

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	// 清空正文时：仅在“没有任何可对照基线”时退出 Diff，避免无意义的空对空对照；
	// 若基线不为空（如知识库/回收站：打开时内容 vs 当前清空），应允许保留 Diff 来展示“全量删除”。
	useEffect(() => {
		if (viewMode !== 'splitDiff') return;
		if (normalizeMonacoEol(value ?? '') !== '') return;
		if (diffBaselineOriginal.trim() !== '') return;
		setViewMode('edit');
	}, [viewMode, value, diffBaselineOriginal]);

	// 离开 splitDiff 时清空 baseline，避免残留到其它模式
	useEffect(() => {
		if (viewMode !== 'splitDiff') {
			setDiffBaselineOriginal('');
		}
	}, [viewMode]);

	useEffect(() => {
		const prev = prevViewModeRef.current;
		prevViewModeRef.current = viewMode;

		if (viewMode === 'splitDiff') {
			activeDiffSessionRef.current = diffSessionId;
			return;
		}
		if (prev !== 'splitDiff') return;
		if (!monaco) return;

		const sessionId = activeDiffSessionRef.current;
		const originalPath = diffOriginalModelPath;
		const modifiedPath = diffModifiedModelPath;
		// 双 rAF：等 DiffEditorWidget 完成内部 reset，再 dispose，避免 “disposed before reset” 竞态
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (activeDiffSessionRef.current !== sessionId) return;
				try {
					const o = monaco.editor.getModel(monaco.Uri.parse(originalPath));
					const m = monaco.editor.getModel(monaco.Uri.parse(modifiedPath));
					o?.dispose();
					m?.dispose();
				} catch {
					// 忽略：路径解析或模型不存在时无需处理
				}
			});
		});
	}, [
		viewMode,
		monaco,
		diffSessionId,
		diffOriginalModelPath,
		diffModifiedModelPath,
	]);

	// 换篇时退出分屏对照，避免沿用上一篇快照
	useEffect(() => {
		setViewMode((vm) => (vm === 'splitDiff' ? 'edit' : vm));
	}, [documentIdentity]);

	// 换篇时关闭右侧 AI 助手（受控模式由外部自行同步）
	useEffect(() => {
		if (assistantPanelControlled) return;
		setInternalMarkdownAssistantOpen(false);
	}, [documentIdentity, assistantPanelControlled]);

	// 外部不再传入 chatNode 时，内部开关复位
	useEffect(() => {
		if (chatNode || assistantPanelControlled) return;
		setInternalMarkdownAssistantOpen(false);
	}, [chatNode, assistantPanelControlled]);

	// 开启助手后需有右侧栏位：从纯编辑 / 纯预览 / 分屏 Diff 进入「左编 + 右侧助手」
	useEffect(() => {
		if (!markdownAssistantOpen || !chatNode) return;
		setViewMode((vm) =>
			vm === 'split'
				? vm
				: vm === 'splitDiff' || vm === 'edit' || vm === 'preview'
					? 'split'
					: vm,
		);
	}, [markdownAssistantOpen, chatNode]);

	// viewMode 在 edit ↔ split* 切换时同步 splitLayout，避免右侧面板保持 0 导致无法撑开
	useEffect(() => {
		// 仅对 Markdown 双栏骨架生效：preview 不渲染 panel group
		if (viewMode === 'edit') {
			panelGroupRef.current?.setLayout({ editor: 100, right: 0 });
			return;
		}
		if (viewMode === 'split' || viewMode === 'splitDiff') {
			panelGroupRef.current?.setLayout(lastSplitLayoutRef.current);
		}
	}, [viewMode]);

	useEffect(() => {
		if (prevDocumentIdentityRef.current !== documentIdentity) {
			prevDocumentIdentityRef.current = documentIdentity;
			lastEmittedRef.current = normalizeMonacoEol(
				valueFromPropsRef.current ?? '',
			);
		}
	}, [documentIdentity]);

	// 换篇时重置编辑器滚动与预览锚点缓存，避免 Monaco / 分屏跟滚沿用上一篇位置
	useLayoutEffect(() => {
		markdownScrollSyncSnapshotRef.current = null;
		const vp = previewViewportRef.current;
		if (vp) {
			vp.scrollTop = 0;
			vp.scrollLeft = 0;
		}
		const ed = editorRef.current;
		if (ed?.getModel()) {
			ed.setScrollTop(0);
			ed.setScrollLeft(0);
		}
	}, [documentIdentity]);

	// 容器高度或 Markdown 视图切换后强制按宿主尺寸 layout（与 onMount 内 ResizeObserver 互补）
	useLayoutEffect(() => {
		const run = () => {
			applyEditorLayoutRef.current?.();
			requestAnimationFrame(() => applyEditorLayoutRef.current?.());
		};
		queueMicrotask(run);
	}, [height, viewMode, isMarkdown]);

	/**
	 * 不向 Editor 传受控 value；外部正文与模型不一致时 setValue。
	 * 有焦点时若父组件 value 因 RAF 合并略滞后于编辑器，不可覆盖正在输入的内容；
	 * 但「清空」或「换篇」（documentIdentity 变化）必须写入。
	 */
	useEffect(() => {
		const ed = editorRef.current;
		if (!ed || imeComposingRef.current || ed.inComposition) return;
		const next = normalizeMonacoEol(value ?? '');
		const cur = normalizeMonacoEol(ed.getValue());
		const identityChanged =
			prevIdentityForValueSyncRef.current !== documentIdentity;
		if (cur === next) {
			lastEmittedRef.current = next;
			prevIdentityForValueSyncRef.current = documentIdentity;
			return;
		}
		const clearing = next === '';
		if (ed.hasTextFocus() && !clearing && !identityChanged) return;
		prevIdentityForValueSyncRef.current = documentIdentity;
		lastEmittedRef.current = next;
		ed.setValue(next);
		ed.updateOptions({ placeholder: next.trim() ? '' : placeholder });
	}, [value, placeholder, documentIdentity]);

	const rebuildMarkdownScrollSyncSnapshot = useCallback(() => {
		const vp = previewViewportRef.current;
		const ed = editorRef.current;
		if (!vp || !ed?.getModel()) return;
		markdownScrollSyncSnapshotRef.current = buildMarkdownScrollSyncSnapshot(
			ed,
			vp,
		);
	}, []);

	/** 双 rAF 后清除抑制，跳过程序化滚动触发的对向同步 */
	const scheduleClearSuppressPreviewEcho = useCallback(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				suppressPreviewScrollEchoRef.current = false;
			});
		});
	}, []);

	const scheduleClearSuppressEditorEcho = useCallback(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				suppressEditorScrollEchoRef.current = false;
			});
		});
	}, []);

	/** 按编辑器首可见行写预览 scrollTop（带预览侧回声抑制） */
	const flushEditorScrollToPreviewSync = useCallback(() => {
		if (viewModeRef.current === 'splitDiff') return;
		const editor = editorRef.current;
		const vp = previewViewportRef.current;
		if (!editor || !vp) return;
		suppressPreviewScrollEchoRef.current = true;
		try {
			syncPreviewScrollFromMarkdownEditor(
				editor,
				vp,
				markdownScrollSyncSnapshotRef,
			);
		} finally {
			scheduleClearSuppressPreviewEcho();
		}
	}, [scheduleClearSuppressPreviewEcho]);

	const alignPreviewScrollToEditor = useCallback(() => {
		if (viewModeRef.current !== 'split') return;
		flushEditorScrollToPreviewSync();
	}, [flushEditorScrollToPreviewSync]);

	const syncEditorFromPreview = useCallback(() => {
		if (viewModeRef.current === 'splitDiff') return;
		if (suppressPreviewScrollEchoRef.current) return;
		const mode = splitScrollFollowModeRef.current;
		if (
			viewModeRef.current !== 'split' ||
			(mode !== 'editorFollowsPreview' && mode !== 'bidirectional')
		) {
			return;
		}
		const editor = editorRef.current;
		const vp = previewViewportRef.current;
		if (!editor || !vp) return;
		cancelAnimationFrame(previewToEditorRafRef.current);
		previewToEditorRafRef.current = requestAnimationFrame(() => {
			previewToEditorRafRef.current = 0;
			const ed = editorRef.current;
			const v = previewViewportRef.current;
			if (!ed || !v) return;
			suppressEditorScrollEchoRef.current = true;
			try {
				syncEditorScrollFromMarkdownPreview(
					ed,
					v,
					markdownScrollSyncSnapshotRef,
				);
			} finally {
				scheduleClearSuppressEditorEcho();
			}
		});
	}, [scheduleClearSuppressEditorEcho]);

	/**
	 * 预览 onScroll 用稳定引用，避免 memo(ParserMarkdownPreviewPane) 在
	 * editorFollowsPreview ↔ bidirectional 间因 props 浅比较相同而跳过重渲染，
	 * 导致 handleViewportScroll 闭包陈旧、双边跟随不触发。
	 */
	const syncEditorFromPreviewRef = useRef(syncEditorFromPreview);
	syncEditorFromPreviewRef.current = syncEditorFromPreview;
	const dispatchViewportScrollFollow = useCallback(() => {
		syncEditorFromPreviewRef.current();
	}, []);

	// 预览 HTML / 分屏开关变化后同步测量锚点；hljs 等异步增高后再测一帧
	useLayoutEffect(() => {
		if (!splitPreviewScrollSyncEligible) {
			markdownScrollSyncSnapshotRef.current = null;
			return;
		}
		rebuildMarkdownScrollSyncSnapshot();
		const id = requestAnimationFrame(() => {
			rebuildMarkdownScrollSyncSnapshot();
			if (
				viewModeRef.current !== 'split' ||
				splitScrollFollowModeRef.current === 'none'
			) {
				return;
			}
			// 「预览跟编辑」或双边时把预览滚到与编辑器一致；仅「编辑跟预览」时不改预览
			const m = splitScrollFollowModeRef.current;
			if (m === 'previewFollowsEditor' || m === 'bidirectional') {
				alignPreviewScrollToEditor();
			}
		});
		return () => cancelAnimationFrame(id);
	}, [
		splitPaneMarkdown,
		viewMode,
		splitScrollFollowMode,
		splitPreviewScrollSyncEligible,
		rebuildMarkdownScrollSyncSnapshot,
		alignPreviewScrollToEditor,
	]);

	// 分栏拖拽改变预览宽度时重建锚点并跟手对齐（rAF 合并，避免连续 resize 多次全量测量）
	useEffect(() => {
		if (!splitPreviewScrollSyncEligible) {
			return;
		}
		const vp = previewViewportRef.current;
		if (!vp) return;
		const ro = new ResizeObserver(() => {
			cancelAnimationFrame(previewResizeRafRef.current);
			previewResizeRafRef.current = requestAnimationFrame(() => {
				previewResizeRafRef.current = 0;
				rebuildMarkdownScrollSyncSnapshot();
				requestAnimationFrame(() => {
					if (
						viewModeRef.current !== 'split' ||
						splitScrollFollowModeRef.current === 'none'
					) {
						return;
					}
					const m = splitScrollFollowModeRef.current;
					if (m === 'previewFollowsEditor' || m === 'bidirectional') {
						flushEditorScrollToPreviewSync();
					}
				});
			});
		});
		ro.observe(vp);
		return () => {
			ro.disconnect();
			cancelAnimationFrame(previewResizeRafRef.current);
			previewResizeRafRef.current = 0;
		};
	}, [
		splitPreviewScrollSyncEligible,
		rebuildMarkdownScrollSyncSnapshot,
		flushEditorScrollToPreviewSync,
	]);

	const syncPreviewFromEditor = useCallback(() => {
		if (viewModeRef.current === 'splitDiff') return;
		if (suppressEditorScrollEchoRef.current) return;
		const mode = splitScrollFollowModeRef.current;
		if (
			viewModeRef.current !== 'split' ||
			(mode !== 'previewFollowsEditor' && mode !== 'bidirectional')
		) {
			return;
		}
		const editor = editorRef.current;
		const vp = previewViewportRef.current;
		if (!editor || !vp) return;
		cancelAnimationFrame(scrollSyncRafRef.current);
		scrollSyncRafRef.current = requestAnimationFrame(() => {
			scrollSyncRafRef.current = 0;
			flushEditorScrollToPreviewSync();
		});
	}, [flushEditorScrollToPreviewSync]);

	const handleDiffEditorMount = useCallback<DiffOnMount>((diffEd) => {
		const applyDiffLayoutFromHost = () => {
			// DiffEditor 类型无 getDomNode，尺寸一律由外层宿主测量（与主编辑器一致）
			const host = diffEditorHostRef.current;
			if (!host) {
				diffEd.layout();
				return;
			}
			const w = Math.floor(host.clientWidth);
			const h = Math.floor(host.clientHeight);
			if (w > 0 && h > 0) {
				diffEd.layout({ width: w, height: h });
			} else {
				diffEd.layout();
			}
		};
		applyDiffEditorLayoutRef.current = applyDiffLayoutFromHost;

		let layoutRaf = 0;
		const scheduleDiffLayout = () => {
			cancelAnimationFrame(layoutRaf);
			layoutRaf = requestAnimationFrame(() => {
				layoutRaf = 0;
				applyDiffLayoutFromHost();
				requestAnimationFrame(() => applyDiffLayoutFromHost());
			});
		};

		const layoutHost = diffEditorHostRef.current;
		let layoutObserver: ResizeObserver | null = null;
		if (typeof ResizeObserver !== 'undefined' && layoutHost) {
			layoutObserver = new ResizeObserver(scheduleDiffLayout);
			layoutObserver.observe(layoutHost);
		}
		const onWindowResize = () => scheduleDiffLayout();
		window.addEventListener('resize', onWindowResize);
		const vv = window.visualViewport;
		const onVvResize = () => scheduleDiffLayout();
		vv?.addEventListener('resize', onVvResize);
		const onFullscreenChange = () => scheduleDiffLayout();
		document.addEventListener('fullscreenchange', onFullscreenChange);

		const layoutCleanup: { dispose: () => void } = {
			dispose: () => {
				layoutObserver?.disconnect();
				window.removeEventListener('resize', onWindowResize);
				vv?.removeEventListener('resize', onVvResize);
				document.removeEventListener('fullscreenchange', onFullscreenChange);
				cancelAnimationFrame(layoutRaf);
			},
		};

		diffEd.onDidDispose(() => {
			applyDiffEditorLayoutRef.current = null;
			layoutCleanup.dispose();
		});

		queueMicrotask(() => {
			applyDiffLayoutFromHost();
			requestAnimationFrame(() => applyDiffLayoutFromHost());
		});
	}, []);

	const handleEditorMount = useCallback<OnMount>(
		(editor, monaco) => {
			editorRef.current = editor;

			/** 按宿主 DOM 的 client 尺寸显式 layout，避免 Monaco 在全屏恢复后仍使用过大布局宽度 */
			const applyEditorLayoutFromHost = () => {
				const host =
					editorHostRef.current ??
					(editor.getDomNode()?.parentElement as HTMLElement | null);
				if (!host) {
					editor.layout();
					return;
				}
				const w = Math.floor(host.clientWidth);
				const h = Math.floor(host.clientHeight);
				if (w > 0 && h > 0) {
					editor.layout({ width: w, height: h });
				} else {
					editor.layout();
				}
			};
			applyEditorLayoutRef.current = applyEditorLayoutFromHost;

			let layoutRaf = 0;
			const scheduleEditorLayout = () => {
				cancelAnimationFrame(layoutRaf);
				layoutRaf = requestAnimationFrame(() => {
					layoutRaf = 0;
					applyEditorLayoutFromHost();
					// 再等一帧：部分 WebView 在窗口动画结束后尺寸才稳定
					requestAnimationFrame(() => applyEditorLayoutFromHost());
				});
			};

			const layoutHost =
				editorHostRef.current ??
				(editor.getDomNode()?.parentElement as HTMLElement | null);
			let layoutObserver: ResizeObserver | null = null;
			if (typeof ResizeObserver !== 'undefined' && layoutHost) {
				layoutObserver = new ResizeObserver(scheduleEditorLayout);
				layoutObserver.observe(layoutHost);
			}
			const onWindowResize = () => scheduleEditorLayout();
			window.addEventListener('resize', onWindowResize);
			const vv = window.visualViewport;
			const onVvResize = () => scheduleEditorLayout();
			vv?.addEventListener('resize', onVvResize);
			const onFullscreenChange = () => scheduleEditorLayout();
			document.addEventListener('fullscreenchange', onFullscreenChange);

			/** 从模型选区取待复制文本；空选区时复制当前行（与常见编辑器一致） */
			const getCopyTextFromSelections = (): string => {
				const model = editor.getModel();
				if (!model) return '';
				const sels = editor.getSelections();
				if (!sels?.length) return '';
				const eol = model.getEOL();
				return sels
					.map((sel) => {
						if (
							sel.startLineNumber === sel.endLineNumber &&
							sel.startColumn === sel.endColumn
						) {
							return model.getLineContent(sel.startLineNumber) + eol;
						}
						return model.getValueInRange(sel);
					})
					.join(eol);
			};

			/**
			 * 仅返回“真实选区文本”：
			 * - 多选区：用模型 EOL 拼接（与复制一致）
			 * - 空选区（仅光标）：返回空串（不降级为整行）
			 *
			 * 用于外部输入框（如知识库助手）接入，避免误把整行塞进对话草稿。
			 */
			const getSelectedTextOnlyFromSelections = (): string => {
				const model = editor.getModel();
				if (!model) return '';
				const sels = editor.getSelections();
				if (!sels?.length) return '';
				const eol = model.getEOL();
				return sels
					.map((sel) => {
						const isCursor =
							sel.startLineNumber === sel.endLineNumber &&
							sel.startColumn === sel.endColumn;
						if (isCursor) return '';
						return model.getValueInRange(sel);
					})
					.filter(Boolean)
					.join(eol);
			};

			/**
			 * 剪切时使用的范围：与 VS Code 一致，**空选区（仅光标）**表示「当前逻辑行」。
			 * - 非最后一行：删除 (line,1)～(line+1,1)，去掉该行及行尾换行
			 * - 最后一行且上文还有行：从上一行末尾到本行末尾，一并去掉行间换行
			 * - 仅一行：删本行内容
			 */
			const rangeForCutWhenCursorOnly = (
				sel: NonNullable<
					ReturnType<MonacoEditorInstance['getSelections']>
				>[number],
			) => {
				const model = editor.getModel();
				if (!model) return sel;
				const isCursor =
					sel.startLineNumber === sel.endLineNumber &&
					sel.startColumn === sel.endColumn;
				if (!isCursor) return sel;
				const line = sel.startLineNumber;
				const lineCount = model.getLineCount();
				if (line < lineCount) {
					return new monaco.Range(line, 1, line + 1, 1);
				}
				if (line > 1) {
					return new monaco.Range(
						line - 1,
						model.getLineMaxColumn(line - 1),
						line,
						model.getLineMaxColumn(line),
					);
				}
				return new monaco.Range(1, 1, 1, model.getLineMaxColumn(1));
			};

			injectMonacoEditorContextActions({
				/** Monaco 编辑器实例：用于读取选区/模型、执行复制剪切粘贴、触发内置 action 等 */
				editor,
				/** Monaco 命名空间：用于构造 `Range`、组合快捷键常量、访问 editor option 等 */
				monaco,
				/**
				 * IME（输入法，Input Method Editor）合成态标记：
				 * - 右键菜单的“粘贴”等动作在合成期间应避免执行，防止打断输入法流程
				 */
				imeComposingRef,
				/**
				 * 输出参数：注入后的“编辑器上下文动作”会写入该 ref
				 * - 供右键菜单条目点击时调用（例如 copy/cut/paste/format/sendToAssistant）
				 * - 也供快捷键等其它入口复用同一套实现，保证行为一致
				 */
				actionsRef: editorContextActionsRef,
				/**
				 * Copy 语义：获取“应该复制”的文本
				 * - 有选区：复制选区
				 * - 无选区：复制当前行（与常见编辑器一致）
				 */
				getCopyTextFromSelections,
				/**
				 * Selection 语义：仅返回“真实选区文本”
				 * - 无选区（仅光标）返回空串
				 * - 专用于“发送选区到外部输入框”（避免误把整行作为对话草稿）
				 */
				getSelectedTextOnlyFromSelections,
				/**
				 * 外部接入回调：把选区写入助手输入框（知识库页面负责是否自动展开助手）
				 * - 若不传，则右键菜单不会出现“发送到助手”的动作/或该动作为空实现
				 */
				onInsertSelectionToAssistant,
				/**
				 * Cut 语义：无选区剪切时的删除范围
				 * - 尽量对齐 VS Code：光标处剪切整行（含换行处理）
				 */
				rangeForCutWhenCursorOnly,
				/** 统一剪贴板写入：用于右键菜单的“复制/剪切”动作（适配 WebView/Tauri） */
				copyToClipboard,
				/** 统一剪贴板读取：用于右键菜单的“粘贴”动作（适配 WebView/Tauri） */
				pasteFromClipboard,
				/**
				 * Markdown 安全格式化：
				 * - 右键菜单“格式化”在 markdown 下走 safeFormat，避免围栏反引号等被破坏
				 * - 非 markdown 下仍可回落到 Monaco 内置格式化
				 */
				safeFormatMarkdownValue,
			});

			registerMonacoEditorCommands({
				/** Monaco 编辑器实例：用于注册快捷键、读取选区/模型、执行编辑操作（executeEdits）等 */
				editor,
				/** Monaco 命名空间：提供 KeyMod/KeyCode/Range 等类型与常量，用于组合快捷键与构造范围 */
				monaco,
				/**
				 * IME（输入法，Input Method Editor）合成态标记：
				 * - 合成期间不应执行自定义粘贴等命令，否则会打断输入法候选/上屏流程
				 * - 这里传 ref 以便跨回调读取最新状态，避免闭包过期
				 */
				imeComposingRef,
				/**
				 * 右键菜单动作集合的 ref（由 `injectMonacoEditorContextActions` 注入）：
				 * - 给某些快捷键复用同一套动作实现（例如“发送选区到助手”）
				 * - 用 ref 避免把一堆 handler 作为依赖导致 mount 逻辑抖动
				 */
				editorContextActionsRef,
				/**
				 * 复制文本获取函数（Copy 语义）：
				 * - 有选区：复制选区内容
				 * - 无选区（仅光标）：复制当前行（与常见编辑器一致）
				 * - 用于 Ctrl/⌘+C、Ctrl/⌘+X（先复制再删）
				 */
				getCopyTextFromSelections,
				/**
				 * 剪切时的删除范围计算（Cut 语义）：
				 * - 有选区：删除选区
				 * - 无选区（仅光标）：删除当前逻辑行（尽量对齐 VS Code 行为）
				 * - 返回 `monaco.Range` 供 `executeEdits` 使用
				 */
				rangeForCutWhenCursorOnly,
				/**
				 * 统一剪贴板写入（Clipboard API/tauri 插件封装）：
				 * - WebView/Tauri 场景系统默认复制可能失败，因此强制走此实现
				 */
				copyToClipboard,
				/**
				 * 统一剪贴板读取（Clipboard API/tauri 插件封装）：
				 * - 用于 Ctrl/⌘+V 自定义粘贴，把文本注入当前选区/光标位置
				 */
				pasteFromClipboard,
				/**
				 * Markdown 安全格式化（safe format）：
				 * - 用于 Shift+Alt+F：当语言是 markdown 时走“安全格式化”，避免围栏反引号/缩进等被错误破坏
				 * - 非 markdown 时回落到 Monaco 默认 `editor.action.formatDocument`
				 */
				safeFormatMarkdownValue,
				/**
				 * 仅返回“真实选区文本”（Selection 语义）：
				 * - 无选区（仅光标）时返回空串（不降级为整行）
				 * - 专用于“发送选区到外部输入框”（如知识库助手），避免误把整行塞进对话草稿
				 */
				getSelectedTextOnlyFromSelections,
				/**
				 * 外部接入回调：把选区写入“助手输入框”
				 * - 由知识库页面决定如何拼接/是否自动展开助手面板
				 * - Monaco 侧只负责提供选区文本与触发时机
				 */
				onInsertSelectionToAssistant,
				flushEditorValueToParent: () => {
					/**
					 * 将 Monaco 当前值同步到父级（受控 value/onChange）：
					 * - 用于“发送选区到助手”这类会触发 UI 切换的场景
					 * - 先把最新内容推到父级，避免后续视图切换/重挂载期间出现短暂空串导致“编辑器内容被清空”的观感
					 */
					const v = normalizeMonacoEol(editor.getValue());
					lastEmittedRef.current = v;
					onChangeRef.current?.(v);
				},
			});

			const pushToParent = (raw: string) => {
				const v = normalizeMonacoEol(raw);
				lastEmittedRef.current = v;
				onChangeRef.current?.(v);
			};

			/** 换行等变更与下一键同帧时合并上报 */
			let pushRaf = 0;
			const queuePushFromModel = () => {
				if (imeComposingRef.current || editor.inComposition) return;
				cancelAnimationFrame(pushRaf);
				pushRaf = requestAnimationFrame(() => {
					pushRaf = 0;
					if (imeComposingRef.current || editor.inComposition) return;
					pushToParent(editor.getValue());
				});
			};

			const contentSub = editor.onDidChangeModelContent(() => {
				queuePushFromModel();
			});

			const imeSubs = [
				editor.onDidCompositionStart(() => {
					imeComposingRef.current = true;
					cancelAnimationFrame(pushRaf);
					pushRaf = 0;
				}),
				editor.onDidCompositionEnd(() => {
					imeComposingRef.current = false;
					queueMicrotask(() => {
						pushToParent(editor.getValue());
						requestAnimationFrame(() => {
							applyEditorLayoutFromHost();
							requestAnimationFrame(() => applyEditorLayoutFromHost());
						});
					});
				}),
			];

			const blurSub = editor.onDidBlurEditorText(() => {
				queueMicrotask(() => {
					if (imeComposingRef.current || editor.inComposition) return;
					const v = normalizeMonacoEol(editor.getValue());
					if (v === lastEmittedRef.current) return;
					lastEmittedRef.current = v;
					onChangeRef.current?.(v);
				});
			});

			const root = editor.getDomNode();
			const inputArea = root?.querySelector(
				'textarea.inputarea',
			) as HTMLTextAreaElement | null;
			const disposables: Array<{ dispose: () => void }> = [
				contentSub,
				blurSub,
				...imeSubs,
			];
			if (inputArea) {
				const onNativeCompStart = () => {
					imeComposingRef.current = true;
				};
				const onNativeCompEnd = () => {
					imeComposingRef.current = false;
				};
				inputArea.addEventListener('compositionstart', onNativeCompStart);
				inputArea.addEventListener('compositionend', onNativeCompEnd);
				disposables.push({
					dispose: () => {
						inputArea.removeEventListener(
							'compositionstart',
							onNativeCompStart,
						);
						inputArea.removeEventListener('compositionend', onNativeCompEnd);
					},
				});
			}

			const layoutCleanup: { dispose: () => void } = {
				dispose: () => {
					layoutObserver?.disconnect();
					window.removeEventListener('resize', onWindowResize);
					vv?.removeEventListener('resize', onVvResize);
					document.removeEventListener('fullscreenchange', onFullscreenChange);
					cancelAnimationFrame(layoutRaf);
				},
			};
			disposables.push(layoutCleanup);

			if (getMarkdownFromEditorRef) {
				getMarkdownFromEditorRef.current = () => {
					const v = normalizeMonacoEol(editor.getValue());
					lastEmittedRef.current = v;
					onChangeRef.current?.(v);
					return v;
				};
			}

			editor.onDidDispose(() => {
				editorContextActionsRef.current = null;
				if (getMarkdownFromEditorRef) {
					getMarkdownFromEditorRef.current = null;
				}
				applyEditorLayoutRef.current = null;
				cancelAnimationFrame(pushRaf);
				cancelAnimationFrame(layoutRaf);
				cancelAnimationFrame(scrollSyncRafRef.current);
				scrollSyncRafRef.current = 0;
				cancelAnimationFrame(previewToEditorRafRef.current);
				previewToEditorRafRef.current = 0;
				for (const d of disposables) {
					d.dispose();
				}
			});

			editor.onDidScrollChange((e) => {
				if (!e.scrollTopChanged) return;
				syncPreviewFromEditor();
			});

			const initial = normalizeMonacoEol(valueFromPropsRef.current ?? '');
			if (normalizeMonacoEol(editor.getValue()) !== initial) {
				editor.setValue(initial);
			}
			lastEmittedRef.current = initial;

			// 与 mergedEditorOptions 一致：有正文时清空 placeholder，避免挂载帧仍叠画占位 ghost
			editor.updateOptions({
				placeholder: initial.trim() ? '' : placeholder,
			});

			queueMicrotask(() => {
				applyEditorLayoutFromHost();
				requestAnimationFrame(() => applyEditorLayoutFromHost());
			});

			editor.focus();
		},
		[getMarkdownFromEditorRef, syncPreviewFromEditor, placeholder],
	);

	useEffect(() => {
		return () => {
			editorContextActionsRef.current = null;
			if (getMarkdownFromEditorRef) {
				getMarkdownFromEditorRef.current = null;
			}
		};
	}, [getMarkdownFromEditorRef]);

	const focusEditor = useCallback(() => {
		editorRef.current?.focus();
	}, []);

	/** 与「分屏」互斥：进入 splitDiff；再次点击回到编辑 */
	const toggleMarkdownSplitDiffCompare = useCallback(() => {
		if (viewMode === 'splitDiff') {
			closeMarkdownAssistant();
			setViewMode('edit');
			queueMicrotask(focusEditor);
			return;
		}
		if (!markdownDiffEntryEligible) return;
		closeMarkdownAssistant();
		// 每次进入 Diff 都开一个新的 session：避免 keepCurrent*Model 复用上一轮的 TextModel 导致内容残留
		setDiffSessionId((s) => s + 1);
		/**
		 * baseline 必须与「当前正文」同源，否则 Diff 会出现整体偏移（例如顶部多出空行导致全量变更）。
		 *
		 * 注意：处于 `preview` 视图时主编辑器可能已卸载（unmount），`editorRef.current` 可能残留旧实例引用；
		 * 这时优先用 `valueFromPropsRef`（受控源）作为快照，避免读到被释放/陈旧的模型文本。
		 *
		 * 处于可编辑视图时，为避免父级 onChange rAF 合并导致的 value 滞后，优先读编辑器当前模型。
		 */
		const ed = editorRef.current;
		let raw = '';
		if (diffBaselineSource === 'empty') {
			raw = '';
		} else if (diffBaselineSource === 'persisted') {
			raw = diffBaselineText ?? '';
		} else {
			// current：优先读编辑器当前模型（避免父级 value rAF 合并滞后），否则用受控源兜底（preview 下更可靠）
			raw =
				ed?.getModel?.() != null
					? ed.getValue()
					: (valueFromPropsRef.current ?? '');
		}
		const base = normalizeMonacoEol(raw);
		setDiffBaselineOriginal(base);
		setViewMode('splitDiff');
		queueMicrotask(focusEditor);
	}, [
		viewMode,
		focusEditor,
		markdownDiffEntryEligible,
		diffBaselineSource,
		diffBaselineText,
		closeMarkdownAssistant,
	]);

	/**
	 * Markdown 底部操作栏快捷键（⌘+1…⌘+0）：
	 * - 在「系统设置」中可配置，保存后写入 store（`shortcut_${keyId}`）
	 * - 这里监听 `KNOWLEDGE_SHORTCUTS_CHANGED_EVENT` 实时重载，避免刷新页面才生效
	 * - 仅当事件来源属于当前编辑器 DOM（Monaco 宿主）时处理，避免影响页面其它输入框
	 */
	const { chords: markdownBarChords } = useMarkdownBottomBarShortcuts({
		enabled: isMarkdown,
		rootRef,
		viewModeRef,
		assistantRightPaneActive,
		markdownDiffBottomBarVisible,
		chatNodeEnabled: Boolean(chatNode),
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
			className={cn('relative min-w-0 max-w-full overflow-hidden', className)}
			ref={rootRef}
		>
			<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md bg-theme/5">
				<div
					className={cn(
						'flex h-10 min-w-0 shrink-0 items-center gap-2 border-b border-theme/5',
					)}
				>
					<div className="min-w-0 flex-1">{title}</div>
					<div className="flex min-w-0 shrink-0 items-center justify-end">
						{showTabBar && isMarkdown ? (
							<Tooltip
								side="bottom"
								content={markdownBottomBarShortcutHint ?? 'Meta + Shift + B'}
							>
								<Button
									variant="link"
									aria-label={
										markdownBottomBarOpen
											? '收起 Markdown 底部操作栏'
											: '展开 Markdown 底部操作栏'
									}
									aria-expanded={markdownBottomBarOpen}
									aria-controls={markdownBottomBarId}
									onClick={toggleMarkdownBottomBar}
									className="lucide-stroke-draw-hover"
								>
									<div className="flex items-center gap-1">
										{markdownBottomBarOpen ? (
											<PanelTopOpen className="mt-0.5" />
										) : (
											<PanelTopClose className="mt-0.5" />
										)}
										<span className="mt-0.5">操作栏</span>
									</div>
								</Button>
							</Tooltip>
						) : null}
						{toolbar}
					</div>
				</div>

				<div
					className="box-border min-h-0 min-w-0 max-w-full overflow-hidden"
					style={{ height }}
				>
					{/* 非 Markdown：保持单栏编辑器渲染 */}
					{!isMarkdown ? (
						<QuickContextMenu items={editorContextMenuItems} triggerAsChild>
							<div
								ref={editorHostRef}
								className="box-border h-full min-h-0 min-w-0 max-w-full w-full overflow-hidden contain-[inline-size]"
							>
								<Editor
									// key={monacoModelPath}
									height={height}
									width="100%"
									language={language}
									path={monacoModelPath}
									keepCurrentModel
									defaultValue={editorBootstrapTextRef.current}
									beforeMount={handleMonacoBeforeMount}
									theme={glassThemeId}
									onMount={handleEditorMount}
									options={mergedEditorOptions}
									loading={<Loading text="正在加载编辑器..." />}
								/>
							</div>
						</QuickContextMenu>
					) : null}

					{/* Markdown：preview 仍为纯预览；其余模式统一用“双栏骨架”，避免 edit→split 时 Editor 卸载/重挂载造成闪断 */}
					{isMarkdown && viewMode === 'preview' ? (
						<div className="h-full min-h-0 min-w-0 max-w-full w-full overflow-hidden contain-[inline-size]">
							<ParserMarkdownPreviewPane
								markdown={deferredPreviewMarkdown}
								documentIdentity={documentIdentity}
								showPreviewScrollCornerFab
								enableMermaid={markdownEnableMermaid}
							/>
						</div>
					) : null}

					{isMarkdown && viewMode !== 'preview' ? (
						<ResizablePanelGroup
							orientation="horizontal"
							className="h-full min-h-0 min-w-0 max-w-full"
							groupRef={panelGroupRef}
							onLayoutChanged={(layout) => {
								// 仅在分屏状态下记忆用户拖拽后的布局（edit 状态的 100/0 不需要记）
								if (viewMode === 'split' || viewMode === 'splitDiff') {
									lastSplitLayoutRef.current = layout;
								}
							}}
						>
							<ResizablePanel
								id="editor"
								defaultSize={50}
								minSize={20}
								className="min-h-0 min-w-0"
							>
								<div
									className={cn(
										'flex h-full min-h-0 min-w-0 flex-col overflow-hidden',
										viewMode === 'edit' ? '' : 'border-r border-theme/10',
									)}
								>
									<QuickContextMenu
										items={editorContextMenuItems}
										triggerAsChild
									>
										<div
											ref={editorHostRef}
											className="box-border h-full min-h-0 min-w-0 max-w-full w-full overflow-hidden contain-[inline-size]"
										>
											<Editor
												// key={monacoModelPath}
												height="100%"
												width="100%"
												language={language}
												path={monacoModelPath}
												keepCurrentModel
												defaultValue={editorBootstrapTextRef.current}
												beforeMount={handleMonacoBeforeMount}
												theme={glassThemeId}
												onMount={handleEditorMount}
												options={mergedEditorOptions}
												loading={<Loading text="正在加载编辑器..." />}
											/>
										</div>
									</QuickContextMenu>
								</div>
							</ResizablePanel>
							<ResizableHandle
								withHandle
								className={cn(
									viewMode === 'edit'
										? 'pointer-events-none opacity-0'
										: 'pointer-events-auto opacity-100',
								)}
							/>
							<ResizablePanel
								id="right"
								defaultSize={50}
								minSize={0}
								className={cn(
									'min-h-0 min-w-0',
									viewMode === 'edit'
										? 'pointer-events-none opacity-0'
										: 'pointer-events-auto opacity-100',
								)}
							>
								<div className="h-full min-h-0 min-w-0 overflow-hidden contain-[inline-size]">
									{markdownAssistantOpen && chatNode ? (
										<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
											<div className="min-h-0 flex-1 overflow-auto">
												{chatNode}
											</div>
										</div>
									) : viewMode === 'splitDiff' ? (
										<div
											ref={diffEditorHostRef}
											className="box-border h-full min-h-0 min-w-0 max-w-full w-full overflow-hidden contain-[inline-size]"
										>
											<DiffEditor
												key={`${diffModifiedModelPath}__${diffSessionId}`}
												height="100%"
												width="100%"
												language={language}
												original={diffBaselineOriginal}
												modified={splitDiffModifiedText}
												originalModelPath={diffOriginalModelPath}
												modifiedModelPath={diffModifiedModelPath}
												// 避免 DiffEditorWidget 在异步 reset 模型时，模型已先被 dispose（monaco 0.55.1 可见报错）
												keepCurrentOriginalModel
												keepCurrentModifiedModel
												beforeMount={handleMonacoBeforeMount}
												theme={glassThemeId}
												onMount={handleDiffEditorMount}
												options={mergedDiffEditorOptions}
												loading={<Loading text="正在加载对照编辑器..." />}
											/>
										</div>
									) : (
										<ParserMarkdownPreviewPane
											markdown={splitPaneMarkdown}
											documentIdentity={documentIdentity}
											viewportRef={previewViewportRef}
											onViewportScrollFollow={
												editorFollowsPreviewActive
													? dispatchViewportScrollFollow
													: undefined
											}
											enableMermaid={markdownEnableMermaid}
										/>
									)}
								</div>
							</ResizablePanel>
						</ResizablePanelGroup>
					) : null}
				</div>
			</div>

			{isMarkdown ? (
				<div
					id={markdownBottomBarId}
					role="toolbar"
					aria-label="Markdown 底部操作"
					className={cn(
						'absolute bottom-0 left-1/2 z-30 flex max-w-2xl -translate-x-1/2 justify-center transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0',
						markdownBottomBarOpen
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
								content={`编辑源码（${formatChordForTip(markdownBarChords.markdownBarAction1)}）`}
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
									content={`${viewMode === 'splitDiff' ? '关闭分屏对照：回到单栏编辑' : '分屏对照修改：左编右只读 Diff'}（${formatChordForTip(markdownBarChords.markdownBarAction2)}）`}
								>
									<button
										type="button"
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
								content={`预览渲染（${formatChordForTip(markdownBarChords.markdownBarAction3)}）`}
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
							{chatNode ? (
								<Tooltip
									content={`${markdownAssistantOpen ? '关闭 AI 助手' : '开启 AI 助手'}（${formatChordForTip(markdownBarChords.markdownBarAction4)}）`}
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
								content={`分屏：左编辑右预览（${formatChordForTip(markdownBarChords.markdownBarAction5)}）`}
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
										content={`双边跟随：编辑区与预览区双向同步滚动（${formatChordForTip(markdownBarChords.markdownBarAction6)}）`}
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
										content={`右边跟随左边：滚动编辑区时预览区同步滚动（${formatChordForTip(markdownBarChords.markdownBarAction7)}）`}
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
										content={`左边跟随右边：滚动预览区时编辑区同步滚动（${formatChordForTip(markdownBarChords.markdownBarAction8)}）`}
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
										content={`${overwriteSaveEnabled ? '已开启覆盖保存：同名文件将直接覆盖写入' : '开启覆盖保存：同名文件不再弹窗确认，直接覆盖写入'}（${formatChordForTip(markdownBarChords.markdownBarAction9)}）`}
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
											content={`${autoSaveEnabled ? '已开启自动保存：按所选间隔在有修改时保存' : '开启自动保存：按间隔自动保存（无标题/正文或同名冲突未开覆盖时会静默跳过）'}（${formatChordForTip(markdownBarChords.markdownBarAction0)}）`}
										>
											<button
												type="button"
												className={markdownBarIconBtnClass(autoSaveEnabled)}
												aria-pressed={autoSaveEnabled}
												aria-label={
													autoSaveEnabled ? '关闭自动保存' : '开启自动保存'
												}
												onClick={() =>
													onAutoSaveEnabledChange?.(!autoSaveEnabled)
												}
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
			) : null}
		</div>
	);
};

export default MarkdownEditor;

export { MARKDOWN_EDITOR_WORD_WRAP_COLUMN } from './options';
