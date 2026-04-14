import Tooltip from '@design/Tooltip';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { Button } from '@ui/index';
import {
	BetweenHorizontalEnd,
	BetweenHorizontalStart,
	BetweenVerticalEnd,
	Columns2,
	Eye,
	FileInput,
	FilePenLine,
	PanelTopClose,
	PanelTopOpen,
	Timer,
} from 'lucide-react';
import {
	type MutableRefObject,
	useCallback,
	useDeferredValue,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { copyToClipboard, pasteFromClipboard } from '@/utils/clipboard';
import Loading from '../Loading';
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
	type MarkdownScrollSyncSnapshot,
	type MonacoEditorInstance,
	normalizeMonacoEol,
	syncEditorScrollFromMarkdownPreview,
	syncPreviewScrollFromMarkdownEditor,
} from './utils';

type MarkdownViewMode = 'edit' | 'preview' | 'split';

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
	getMarkdownFromEditorRef?: MutableRefObject<(() => string) | null>;
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
}) => {
	const editorRef = useRef<MonacoEditorInstance | null>(null);
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
	const [viewMode, setViewMode] = useState<MarkdownViewMode>('edit');
	const [splitScrollFollowMode, setSplitScrollFollowMode] =
		useState<MarkdownSplitScrollFollowMode>('none');
	/** 底部 Markdown 操作条是否展开（受控或未传 props 时内部 state） */
	const [internalMarkdownBottomBarOpen, setInternalMarkdownBottomBarOpen] =
		useState(false);
	const bottomBarControlled =
		markdownBottomBarOpenProp !== undefined &&
		onMarkdownBottomBarOpenChange !== undefined;
	const markdownBottomBarOpen = bottomBarControlled
		? markdownBottomBarOpenProp
		: internalMarkdownBottomBarOpen;
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

	const showOverwriteSaveToggle = Boolean(onOverwriteSaveEnabledChange);
	const showAutoSaveControls = Boolean(
		onAutoSaveEnabledChange && onAutoSaveIntervalSecChange,
	);

	const autoSaveIntervalOptions = useMemo(() => {
		const presets: number[] = [...KNOWLEDGE_AUTO_SAVE_INTERVAL_PRESETS];
		if (!presets.includes(autoSaveIntervalSec)) {
			presets.push(autoSaveIntervalSec);
		}
		return presets.sort((a, b) => a - b);
	}, [autoSaveIntervalSec]);
	const viewModeRef = useRef(viewMode);
	viewModeRef.current = viewMode;
	const splitScrollFollowModeRef = useRef(splitScrollFollowMode);
	// 与 useLayoutEffect / rAF 对齐：避免仅用 useEffect 写 ref 时滞后一帧
	splitScrollFollowModeRef.current = splitScrollFollowMode;
	const scrollFollowActive = splitScrollFollowMode !== 'none';
	/** 预览侧是否监听 scroll 以驱动编辑器（单向左跟右 + 双边） */
	const editorFollowsPreviewActive =
		splitScrollFollowMode === 'editorFollowsPreview' ||
		splitScrollFollowMode === 'bidirectional';
	const previewViewportRef = useRef<HTMLDivElement | null>(null);
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
	const markdownBottomBarId = useId();

	const isMarkdown = language === 'markdown' && enableMarkdownPreview;

	valueFromPropsRef.current = value;

	const monacoModelPath = useMemo(() => {
		const lang = language.replace(/[^a-zA-Z0-9_-]/g, '_');
		const id = String(documentIdentity).replace(/[^a-zA-Z0-9_-]/g, '_');
		return `dnhyxc-editor-${lang}__${id}`;
	}, [language, documentIdentity]);

	/** 有正文时勿传占位文案，否则部分 Monaco 版本在失焦或未编辑时仍叠画「# 输入内容...」 */
	const hasEditorBody = normalizeMonacoEol(value ?? '').trim().length > 0;
	const effectivePlaceholder = hasEditorBody ? '' : placeholder;

	const mergedEditorOptions = useMemo(() => {
		// 关闭 automaticLayout：WebView/Tauri 全屏→窗口化时内部 ResizeObserver 易滞后，改由宿主显式喂宽高
		const base = { ...options, readOnly, automaticLayout: false as const };
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
	}, [readOnly, effectivePlaceholder, language, wordWrap, wordWrapColumn]);

	const glassThemeId = GLASS_THEME_BY_UI[theme];

	const handleMonacoBeforeMount: BeforeMount = useCallback((monaco) => {
		registerMonacoGlassThemes(monaco);
		registerPrettierFormatProviders(monaco);
		registerMarkdownFenceEmbeddedHighlight(monaco);
	}, []);

	/** 仅换 path 时更新，避免 defaultValue 每键变化导致 memo(Editor) 重渲染与 IME 叠字 */
	const lastPathForBootstrapRef = useRef<string | null>(null);
	const editorBootstrapTextRef = useRef(value);
	if (lastPathForBootstrapRef.current !== monacoModelPath) {
		lastPathForBootstrapRef.current = monacoModelPath;
		editorBootstrapTextRef.current = value;
	}

	const deferredPreviewMarkdown = useDeferredValue(value);
	/** 分屏下用即时正文，避免 deferred 滞后导致预览 DOM 与编辑器 scroll 不同步 */
	const splitPaneMarkdown = viewMode === 'split' ? (value ?? '') : '';

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

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
		if (viewMode !== 'split' || !scrollFollowActive || !isMarkdown) {
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
		scrollFollowActive,
		isMarkdown,
		rebuildMarkdownScrollSyncSnapshot,
		alignPreviewScrollToEditor,
	]);

	// 分栏拖拽改变预览宽度时重建锚点并跟手对齐（rAF 合并，避免连续 resize 多次全量测量）
	useEffect(() => {
		if (viewMode !== 'split' || !scrollFollowActive || !isMarkdown) {
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
		viewMode,
		splitScrollFollowMode,
		scrollFollowActive,
		isMarkdown,
		rebuildMarkdownScrollSyncSnapshot,
		flushEditorScrollToPreviewSync,
	]);

	const syncPreviewFromEditor = useCallback(() => {
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

			editor.addCommand(
				monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
				() => {
					const model = editor.getModel();
					if (!model) return;
					if (model.getLanguageId() === 'markdown') {
						if (editor.getOption(monaco.editor.EditorOption.readOnly)) return;
						void (async () => {
							const next = await safeFormatMarkdownValue(model.getValue());
							if (next == null) return;
							editor.pushUndoStop();
							editor.executeEdits('dnhyxc-markdown-safe-format', [
								{ range: model.getFullModelRange(), text: next },
							]);
							editor.pushUndoStop();
						})();
						return;
					}
					editor.trigger('keyboard', 'editor.action.formatDocument', null);
				},
			);

			editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
				editor.trigger('keyboard', 'editor.action.commentLine', null);
			});

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

			// WebView/Tauri 下系统默认复制常失败：用模型选区 + 统一剪贴板 API（含 Tauri 插件）
			editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
				const text = getCopyTextFromSelections();
				if (!text) return;
				void copyToClipboard(text);
			});

			editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {
				if (editor.getOption(monaco.editor.EditorOption.readOnly)) return;
				void (async () => {
					const text = getCopyTextFromSelections();
					if (!text) return;
					await copyToClipboard(text);
					const sels = editor.getSelections();
					if (!sels?.length) return;
					editor.executeEdits(
						'cut',
						sels.map((sel) => ({ range: sel, text: '' })),
					);
				})();
			});

			editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
				if (editor.getOption(monaco.editor.EditorOption.readOnly)) return;
				if (editor.inComposition || imeComposingRef.current) return;
				void (async () => {
					const text = await pasteFromClipboard();
					if (!text) return;
					const sels = editor.getSelections();
					if (!sels?.length) return;
					editor.executeEdits(
						'paste',
						sels.map((sel) => ({ range: sel, text })),
					);
				})();
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
			if (getMarkdownFromEditorRef) {
				getMarkdownFromEditorRef.current = null;
			}
		};
	}, [getMarkdownFromEditorRef]);

	const focusEditor = useCallback(() => {
		editorRef.current?.focus();
	}, []);

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
					{!isMarkdown || viewMode === 'edit' ? (
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
								defaultValue={editorBootstrapTextRef.current}
								beforeMount={handleMonacoBeforeMount}
								theme={glassThemeId}
								onMount={handleEditorMount}
								options={mergedEditorOptions}
								loading={<Loading text="正在加载编辑器..." />}
							/>
						</div>
					) : null}

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

					{isMarkdown && viewMode === 'split' ? (
						<ResizablePanelGroup
							orientation="horizontal"
							className="h-full min-h-0 min-w-0 max-w-full"
						>
							<ResizablePanel
								defaultSize={50}
								minSize={20}
								className="min-h-0 min-w-0"
							>
								<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-theme/10">
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
											defaultValue={editorBootstrapTextRef.current}
											beforeMount={handleMonacoBeforeMount}
											theme={glassThemeId}
											onMount={handleEditorMount}
											options={mergedEditorOptions}
											loading={<Loading text="正在加载编辑器..." />}
										/>
									</div>
								</div>
							</ResizablePanel>
							<ResizableHandle withHandle />
							<ResizablePanel
								defaultSize={50}
								minSize={20}
								className="min-h-0 min-w-0"
							>
								<div className="h-full min-h-0 min-w-0 overflow-hidden contain-[inline-size]">
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
							<Tooltip content="编辑源码">
								<button
									type="button"
									role="tab"
									aria-selected={viewMode === 'edit'}
									className={markdownBarIconBtnClass(viewMode === 'edit')}
									aria-label="编辑源码"
									onClick={() => {
										setViewMode('edit');
										queueMicrotask(focusEditor);
									}}
								>
									<FilePenLine size={18} strokeWidth={1.75} />
								</button>
							</Tooltip>
							<Tooltip content="预览渲染">
								<button
									type="button"
									role="tab"
									aria-selected={viewMode === 'preview'}
									className={markdownBarIconBtnClass(viewMode === 'preview')}
									aria-label="预览渲染"
									onClick={() => setViewMode('preview')}
								>
									<Eye size={18} strokeWidth={1.75} />
								</button>
							</Tooltip>
							<Tooltip content="分屏：左编辑右预览">
								<button
									type="button"
									role="tab"
									aria-selected={viewMode === 'split'}
									className={markdownBarIconBtnClass(viewMode === 'split')}
									aria-label="分屏：左编辑右预览"
									onClick={() => {
										setViewMode('split');
										queueMicrotask(focusEditor);
									}}
								>
									<Columns2 size={18} strokeWidth={1.75} />
								</button>
							</Tooltip>
							{viewMode === 'split' && (
								<>
									<Tooltip content="双边跟随：编辑区与预览区双向同步滚动">
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

									<Tooltip content="右边跟随左边：滚动编辑区时预览区同步滚动">
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
									<Tooltip content="左边跟随右边：滚动预览区时编辑区同步滚动">
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
										content={
											overwriteSaveEnabled
												? '已开启覆盖保存：同名文件将直接覆盖写入'
												: '开启覆盖保存：同名文件不再弹窗确认，直接覆盖写入'
										}
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
											content={
												autoSaveEnabled
													? '已开启自动保存：按所选间隔在有修改时保存'
													: '开启自动保存：按间隔自动保存（无标题/正文或同名冲突未开覆盖时会静默跳过）'
											}
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
