import Tooltip from '@design/Tooltip';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { Button, ScrollArea } from '@ui/index';
import {
	ArrowDown,
	ArrowUp,
	BetweenHorizontalEnd,
	BetweenHorizontalStart,
	BetweenVerticalEnd,
	Columns2,
	Eye,
	FilePenLine,
	PanelTopClose,
	PanelTopOpen,
} from 'lucide-react';
import {
	memo,
	type RefObject,
	type UIEvent,
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
import { getChatMarkdownHighlightTheme } from '@/constant';
import { useTheme } from '@/hooks/theme';
import {
	ChatCodeFloatingToolbar,
	useChatCodeFloatingToolbar,
} from '@/hooks/useChatCodeFloatingToolbar';
import { cn } from '@/lib/utils';
import {
	downloadChatCodeBlock,
	getChatCodeBlockPlainText,
} from '@/utils/chatCodeToolbar';
import Loading from '../Loading';
import { registerPrettierFormatProviders } from './format';
import { GLASS_THEME_BY_UI, registerMonacoGlassThemes } from './glassTheme';
import { MARKDOWN_EDITOR_WORD_WRAP_COLUMN, options } from './options';
import {
	buildHeadingScrollCache,
	type HeadingScrollCache,
	type MonacoEditorInstance,
	syncEditorScrollFromPreviewByHeadings,
	syncPreviewScrollFromMarkdownEditorByHeadings,
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

function normalizeMonacoEol(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** 纯预览模式右下角：可滚动时显示置底，触底后切换为置顶 */
type PreviewScrollCornerFabMode = 'hidden' | 'toBottom' | 'toTop';

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
}

/**
 * 使用 @dnhyxc-ai/tools 的 MarkdownParser 渲染预览（与文档处理等页一致）
 * 知识库预览不需要聊天代码块吸顶工具栏，故关闭 enableChatCodeFenceToolbar
 */
const ParserMarkdownPreviewPane = memo(function ParserMarkdownPreviewPane({
	markdown,
	viewportRef,
	documentIdentity,
	onViewportScrollFollow,
	showPreviewScrollCornerFab = false,
}: {
	markdown: string;
	/** 分屏同步滚动：指向 ScrollArea 的 Viewport（Radix ref 落在 viewport 上） */
	viewportRef?: RefObject<HTMLDivElement | null>;
	/** 逻辑文档切换时重置预览滚动，避免沿用上一篇的 scrollTop */
	documentIdentity?: string;
	/** 分屏且开启跟随时：预览滚动时驱动编辑器对齐 */
	onViewportScrollFollow?: () => void;
	/** 纯预览模式：右下角置底 / 触底后置顶浮动按钮 */
	showPreviewScrollCornerFab?: boolean;
}) {
	const markdownRef = useRef<HTMLDivElement>(null);
	const localViewportRef = useRef<HTMLDivElement | null>(null);
	const [previewScrollFabMode, setPreviewScrollFabMode] =
		useState<PreviewScrollCornerFabMode>('hidden');

	const { theme } = useTheme();

	const assignViewportRef = useCallback(
		(node: HTMLDivElement | null) => {
			localViewportRef.current = node;
			if (viewportRef) viewportRef.current = node;
		},
		[viewportRef],
	);

	const parser = useMemo(
		() =>
			new MarkdownParser({
				highlightTheme: getChatMarkdownHighlightTheme(theme),
				enableChatCodeFenceToolbar: true,
				// 分屏跟随滚动：预览标题带源码行号，与编辑器按标题区间对齐
				enableHeadingSourceLineAttr: true,
				// 目录 / `[文字](#slug)` 跳转：标题生成 id，点击在 ScrollArea 内 scrollIntoView
				enableHeadingAnchorIds: true,
			}),
		[theme],
	);

	const html = useMemo(() => parser.render(markdown), [parser, markdown]);

	const refreshPreviewScrollFab = useCallback(() => {
		if (!showPreviewScrollCornerFab) {
			setPreviewScrollFabMode('hidden');
			return;
		}
		const vp = localViewportRef.current;
		if (!vp) return;
		const { scrollTop, scrollHeight, clientHeight } = vp;
		const maxScroll = scrollHeight - clientHeight;
		if (maxScroll <= 4) {
			setPreviewScrollFabMode('hidden');
			return;
		}
		const threshold = 8;
		setPreviewScrollFabMode(
			scrollTop >= maxScroll - threshold ? 'toTop' : 'toBottom',
		);
	}, [showPreviewScrollCornerFab]);

	useLayoutEffect(() => {
		const vp = localViewportRef.current;
		if (vp) {
			vp.scrollTop = 0;
			vp.scrollLeft = 0;
		}
	}, [documentIdentity]);

	// 换篇或开启角标后更新「置底/置顶」状态（勿与上一段合并，避免 refresh 回调变动时误重置滚动）
	useLayoutEffect(() => {
		if (!showPreviewScrollCornerFab) return;
		requestAnimationFrame(() => refreshPreviewScrollFab());
	}, [documentIdentity, showPreviewScrollCornerFab, refreshPreviewScrollFab]);

	useEffect(() => {
		const el = markdownRef.current;
		if (!el) return;
		const onClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!el.contains(target)) return;

			// 页内锚点：预览在 Radix ScrollArea 内，默认 hash 跳转无效，改为在视口内 scrollIntoView
			const link = target.closest<HTMLAnchorElement>('a[href^="#"]');
			if (link) {
				const href = link.getAttribute('href');
				if (href && href.length > 1) {
					const raw = href.slice(1);
					const id = decodeURIComponent(raw.replace(/\+/g, ' '));
					if (id) {
						const root = el.querySelector('.markdown-body') ?? el;
						let dest: Element | null = null;
						try {
							dest = root.querySelector(`#${CSS.escape(id)}`);
						} catch {
							dest = null;
						}
						if (dest instanceof HTMLElement) {
							e.preventDefault();
							dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
							return;
						}
					}
				}
			}

			const btn = target.closest<HTMLButtonElement>('[data-chat-code-action]');
			if (!btn || !el.contains(btn)) return;
			const action = btn.getAttribute('data-chat-code-action');
			const block = btn.closest<HTMLElement>('[data-chat-code-block]');
			if (!block) return;
			if (action === 'copy') {
				void navigator.clipboard.writeText(getChatCodeBlockPlainText(block));
				const prev = btn.textContent;
				btn.textContent = '已复制';
				window.setTimeout(() => {
					btn.textContent = prev;
				}, 1500);
				return;
			}
			if (action === 'download') {
				const lang = btn.getAttribute('data-chat-code-lang') || 'text';
				downloadChatCodeBlock(block, lang);
			}
		};
		el.addEventListener('click', onClick);
		return () => el.removeEventListener('click', onClick);
	}, []);

	const { relayout: relayoutCodeToolbar } = useChatCodeFloatingToolbar(
		localViewportRef,
		{ layoutDeps: [markdown] },
	);

	const syncScrollMetrics = useCallback(() => {
		const el = localViewportRef.current;
		if (!el) return;
		relayoutCodeToolbar();
	}, [relayoutCodeToolbar]);

	const handleViewportScroll = useCallback(
		(_e: UIEvent<HTMLDivElement>) => {
			syncScrollMetrics();
			onViewportScrollFollow?.();
			if (showPreviewScrollCornerFab) refreshPreviewScrollFab();
		},
		[
			syncScrollMetrics,
			onViewportScrollFollow,
			showPreviewScrollCornerFab,
			refreshPreviewScrollFab,
		],
	);

	useEffect(() => {
		syncScrollMetrics();
		const id = requestAnimationFrame(() => syncScrollMetrics());
		return () => cancelAnimationFrame(id);
	}, [markdown, syncScrollMetrics]);

	// 正文变化 / 视口尺寸变化时更新「是否可滚、是否触底」
	useEffect(() => {
		if (!showPreviewScrollCornerFab) {
			setPreviewScrollFabMode('hidden');
			return;
		}
		let ro: ResizeObserver | null = null;
		const tid = window.setTimeout(() => {
			refreshPreviewScrollFab();
			requestAnimationFrame(() => refreshPreviewScrollFab());
			const vp = localViewportRef.current;
			if (vp) {
				ro = new ResizeObserver(() => refreshPreviewScrollFab());
				ro.observe(vp);
			}
		}, 0);
		return () => {
			window.clearTimeout(tid);
			ro?.disconnect();
		};
	}, [markdown, html, showPreviewScrollCornerFab, refreshPreviewScrollFab]);

	const onPreviewScrollCornerFabClick = useCallback(() => {
		const vp = localViewportRef.current;
		if (!vp) return;
		if (previewScrollFabMode === 'toBottom') {
			vp.scrollTo({
				top: vp.scrollHeight - vp.clientHeight,
				behavior: 'smooth',
			});
		} else if (previewScrollFabMode === 'toTop') {
			vp.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}, [previewScrollFabMode]);

	return (
		<div
			ref={markdownRef}
			className="relative h-full min-h-0 min-w-0 max-w-full w-full overflow-hidden contain-[inline-size]"
		>
			<ChatCodeFloatingToolbar />
			<ScrollArea
				ref={assignViewportRef}
				scrollbars="both"
				onScroll={handleViewportScroll}
				className={cn(
					'h-full min-h-0 min-w-0 max-w-full w-full bg-transparent',
				)}
				// 覆盖 Radix 内层 display:table + minWidth:100%，否则 table 会按内容扩宽并顶破分栏
				viewportClassName="[&>div]:!box-border [&>div]:!block [&>div]:!w-full [&>div]:!min-w-0 [&>div]:!max-w-full"
			>
				<div className="box-border min-w-0 max-w-full w-full p-3">
					<div
						className="[&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-none [&_.markdown-body]:wrap-break-word [&_.markdown-body]:overflow-x-auto [&_.markdown-body]:bg-transparent! [&_.markdown-body]:text-textcolor/90! [&_.markdown-body_:is(h1,h2,h3,h4,h5,h6)]:scroll-mt-3 [&_.markdown-body_pre]:max-w-full [&_.markdown-body_pre]:overflow-x-auto [&_.markdown-body_table]:block [&_.markdown-body_table]:max-w-full [&_.markdown-body_table]:overflow-x-auto"
						dangerouslySetInnerHTML={{ __html: html }}
					/>
				</div>
			</ScrollArea>
			{showPreviewScrollCornerFab && previewScrollFabMode !== 'hidden' ? (
				<Tooltip
					content={
						previewScrollFabMode === 'toBottom' ? '滚动到底部' : '滚动到顶部'
					}
				>
					<button
						type="button"
						className={cn(
							// 与 ChatControls 滚动按钮一致，并加轻量 backdrop 滤镜（同 glassChip 的 blur）
							'absolute bottom-2 right-2 z-99 flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-full border border-theme/5 bg-theme/5 text-textcolor/90 backdrop-blur-[2px] hover:bg-theme/15',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40',
						)}
						aria-label={
							previewScrollFabMode === 'toBottom' ? '滚动到底部' : '滚动到顶部'
						}
						onClick={onPreviewScrollCornerFabClick}
					>
						{previewScrollFabMode === 'toBottom' ? (
							<ArrowDown aria-hidden />
						) : (
							<ArrowUp aria-hidden />
						)}
					</button>
				</Tooltip>
			) : null}
		</div>
	);
});

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
}) => {
	const editorRef = useRef<MonacoEditorInstance | null>(null);
	const imeComposingRef = useRef(false);
	const onChangeRef = useRef(onChange);
	const valueFromPropsRef = useRef(value);
	const lastEmittedRef = useRef(normalizeMonacoEol(value));
	const prevDocumentIdentityRef = useRef(documentIdentity);
	const [viewMode, setViewMode] = useState<MarkdownViewMode>('edit');
	const [splitScrollFollowMode, setSplitScrollFollowMode] =
		useState<MarkdownSplitScrollFollowMode>('none');
	/** 底部 Markdown 操作条是否展开（由顶栏 toolbar 区域按钮切换） */
	const [markdownBottomBarOpen, setMarkdownBottomBarOpen] = useState(false);
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
	/** 标题锚点测量缓存：滚动热路径只插值，避免每帧 querySelector + getBoundingClientRect */
	const headingScrollCacheRef = useRef<HeadingScrollCache | null>(null);
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
		const base = { ...options, readOnly };
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
	}, []);

	/** 仅换 path 时更新，避免 defaultValue 每键变化导致 memo(Editor) 重渲染与 IME 叠字 */
	const lastPathForBootstrapRef = useRef<string | null>(null);
	const editorBootstrapTextRef = useRef(value);
	if (lastPathForBootstrapRef.current !== monacoModelPath) {
		lastPathForBootstrapRef.current = monacoModelPath;
		editorBootstrapTextRef.current = value;
	}

	const deferredPreviewMarkdown = useDeferredValue(value);

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
		headingScrollCacheRef.current = null;
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

	/** 不向 Editor 传受控 value；仅在外部正文变化且非 IME、无焦点内落后回写时 setValue */
	useEffect(() => {
		const ed = editorRef.current;
		if (!ed || imeComposingRef.current || ed.inComposition) return;
		const next = normalizeMonacoEol(value ?? '');
		if (next === lastEmittedRef.current) return;
		const cur = normalizeMonacoEol(ed.getValue());
		if (cur === next) {
			lastEmittedRef.current = next;
			return;
		}
		if (ed.hasTextFocus()) return;
		lastEmittedRef.current = next;
		ed.setValue(next);
		ed.updateOptions({ placeholder: next.trim() ? '' : placeholder });
	}, [value, placeholder]);

	const rebuildHeadingPreviewScrollCache = useCallback(() => {
		const vp = previewViewportRef.current;
		const ed = editorRef.current;
		if (!vp || !ed) return;
		const model = ed.getModel();
		if (!model) return;
		headingScrollCacheRef.current = buildHeadingScrollCache(
			vp,
			model.getLineCount(),
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
			syncPreviewScrollFromMarkdownEditorByHeadings(
				editor,
				vp,
				headingScrollCacheRef,
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
				syncEditorScrollFromPreviewByHeadings(ed, v, headingScrollCacheRef);
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
			headingScrollCacheRef.current = null;
			return;
		}
		rebuildHeadingPreviewScrollCache();
		const id = requestAnimationFrame(() => {
			rebuildHeadingPreviewScrollCache();
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
		deferredPreviewMarkdown,
		viewMode,
		splitScrollFollowMode,
		scrollFollowActive,
		isMarkdown,
		rebuildHeadingPreviewScrollCache,
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
				rebuildHeadingPreviewScrollCache();
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
		rebuildHeadingPreviewScrollCache,
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

			editor.addCommand(
				monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
				() => {
					editor.trigger('keyboard', 'editor.action.formatDocument', null);
				},
			);

			editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
				editor.trigger('keyboard', 'editor.action.commentLine', null);
			});

			const pushToParent = (raw: string) => {
				const v = normalizeMonacoEol(raw);
				lastEmittedRef.current = v;
				onChangeRef.current?.(v);
			};

			/** 换行等变更与下一键同帧时合并上报，减少与 automaticLayout 打架 */
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
							editor.layout();
							requestAnimationFrame(() => editor.layout());
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

			editor.onDidDispose(() => {
				cancelAnimationFrame(pushRaf);
				cancelAnimationFrame(scrollSyncRafRef.current);
				scrollSyncRafRef.current = 0;
				cancelAnimationFrame(previewToEditorRafRef.current);
				previewToEditorRafRef.current = 0;
				for (const d of disposables) {
					d.dispose();
				}
			});

			editor.onDidScrollChange(() => {
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

			editor.focus();
		},
		[syncPreviewFromEditor, placeholder],
	);

	const focusEditor = useCallback(() => {
		editorRef.current?.focus();
	}, []);

	/** 底部操作栏内图标按钮（与「跟随滚动」一致） */
	const markdownBarIconBtnClass = (active: boolean) =>
		cn(
			'flex size-7 cursor-pointer items-center justify-center rounded-md p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-theme/40',
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
						{isMarkdown ? (
							<Button
								variant="link"
								aria-label={
									markdownBottomBarOpen
										? '收起 Markdown 底部操作栏'
										: '展开 Markdown 底部操作栏'
								}
								aria-expanded={markdownBottomBarOpen}
								aria-controls={markdownBottomBarId}
								onClick={() => setMarkdownBottomBarOpen((o) => !o)}
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
						) : null}
						{toolbar}
					</div>
				</div>

				<div
					className="box-border min-h-0 min-w-0 max-w-full overflow-hidden"
					style={{ height }}
				>
					{!isMarkdown || viewMode === 'edit' ? (
						<Editor
							// key={monacoModelPath}
							height={height}
							language={language}
							path={monacoModelPath}
							defaultValue={editorBootstrapTextRef.current}
							beforeMount={handleMonacoBeforeMount}
							theme={glassThemeId}
							onMount={handleEditorMount}
							options={mergedEditorOptions}
							loading={<Loading text="正在加载编辑器..." />}
						/>
					) : null}

					{isMarkdown && viewMode === 'preview' ? (
						<div className="h-full min-h-0 min-w-0 max-w-full w-full overflow-hidden contain-[inline-size]">
							<ParserMarkdownPreviewPane
								markdown={deferredPreviewMarkdown}
								documentIdentity={documentIdentity}
								showPreviewScrollCornerFab
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
									<Editor
										// key={monacoModelPath}
										height="100%"
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
							</ResizablePanel>
							<ResizableHandle withHandle />
							<ResizablePanel
								defaultSize={50}
								minSize={20}
								className="min-h-0 min-w-0"
							>
								<div className="h-full min-h-0 min-w-0 overflow-hidden contain-[inline-size]">
									<ParserMarkdownPreviewPane
										markdown={deferredPreviewMarkdown}
										documentIdentity={documentIdentity}
										viewportRef={previewViewportRef}
										onViewportScrollFollow={
											editorFollowsPreviewActive
												? dispatchViewportScrollFollow
												: undefined
										}
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
					</div>
				</div>
			) : null}
		</div>
	);
};

export default MarkdownEditor;
export { MARKDOWN_EDITOR_WORD_WRAP_COLUMN } from './options';
