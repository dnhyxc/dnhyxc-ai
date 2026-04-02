import { MarkdownParser } from '@dnhyxc-ai/tools';
import '@dnhyxc-ai/tools/styles.css';
import Editor, { type OnMount } from '@monaco-editor/react';
import { ScrollArea } from '@ui/index';
import { Columns2, Eye, FilePenLine } from 'lucide-react';
import {
	memo,
	type RefObject,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Label } from '@/components/ui/label';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Switch } from '@/components/ui/switch';
import { CHAT_MARKDOWN_HIGHLIGHT_THEME } from '@/constant';
import { useTheme } from '@/hooks/theme';
import { cn } from '@/lib/utils';
import {
	downloadChatCodeBlock,
	getChatCodeBlockPlainText,
	layoutChatCodeToolbars,
} from '@/utils/chatCodeToolbar';
import ChatCodeToolbarFloating from '../ChatCodeToolBar';
import Loading from '../Loading';
import { registerPrettierFormatProviders } from './format';
import { options } from './options';

type MonacoEditorInstance = Parameters<OnMount>[0];

type MarkdownViewMode = 'edit' | 'preview' | 'split';

interface MarkdownEditorProps {
	value?: string;
	onChange?: (value: string) => void;
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
}

function clamp01(n: number): number {
	return Math.min(1, Math.max(0, n));
}

/** 编辑器垂直滚动位置归一化到 [0,1]（顶到底） */
function editorVerticalScrollRatio(editor: MonacoEditorInstance): number {
	const layout = editor.getLayoutInfo();
	const contentHeight = editor.getContentHeight();
	const maxScroll = Math.max(0, contentHeight - layout.height);
	if (maxScroll <= 0) return 0;
	return clamp01(editor.getScrollTop() / maxScroll);
}

function setPreviewVerticalScrollRatio(
	viewport: HTMLDivElement,
	ratio: number,
): void {
	const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
	viewport.scrollTop = clamp01(ratio) * maxScroll;
}

/**
 * 使用 @dnhyxc-ai/tools 的 MarkdownParser 渲染预览（与文档处理等页一致）
 * 知识库预览不需要聊天代码块吸顶工具栏，故关闭 enableChatCodeFenceToolbar
 */
const ParserMarkdownPreviewPane = memo(function ParserMarkdownPreviewPane({
	markdown,
	viewportRef,
}: {
	markdown: string;
	/** 分屏同步滚动：指向 ScrollArea 的 Viewport（Radix ref 落在 viewport 上） */
	viewportRef?: RefObject<HTMLDivElement | null>;
}) {
	const markdownRef = useRef<HTMLDivElement>(null);
	const localViewportRef = useRef<HTMLDivElement | null>(null);

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
				highlightTheme: CHAT_MARKDOWN_HIGHLIGHT_THEME,
				enableChatCodeFenceToolbar: true,
			}),
		[],
	);

	const html = useMemo(() => parser.render(markdown), [parser, markdown]);

	useEffect(() => {
		const el = markdownRef.current;
		if (!el) return;
		const onClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
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

	const syncScrollMetrics = useCallback(() => {
		const el = localViewportRef.current;
		if (!el) return;
		// 与 ChatBotView / share 页一致：滚动时调用 layout，否则 ChatCodeToolbarFloating 不更新
		layoutChatCodeToolbars(el);
	}, []);

	useEffect(() => {
		syncScrollMetrics();
		const id = requestAnimationFrame(() => syncScrollMetrics());
		return () => cancelAnimationFrame(id);
	}, [markdown, syncScrollMetrics]);

	useEffect(() => {
		const el = localViewportRef.current;
		if (!el) return;
		const ro = new ResizeObserver(() => syncScrollMetrics());
		ro.observe(el);
		return () => ro.disconnect();
	}, [markdown, syncScrollMetrics]);

	// Markdown 渲染后高度变化，补算一次浮动工具栏
	useLayoutEffect(() => {
		const el = localViewportRef.current;
		if (!el) return;
		layoutChatCodeToolbars(el);
		const id = requestAnimationFrame(() => layoutChatCodeToolbars(el));
		return () => cancelAnimationFrame(id);
	}, [markdown]);

	useEffect(() => {
		const onResize = () => layoutChatCodeToolbars(localViewportRef.current);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	return (
		<div
			ref={markdownRef}
			className="h-full min-h-0 min-w-0 max-w-full overflow-hidden"
		>
			<ChatCodeToolbarFloating />
			<ScrollArea
				ref={assignViewportRef}
				scrollbars="both"
				onScroll={syncScrollMetrics}
				className={cn(
					'h-full min-h-0 min-w-0 max-w-full w-full',
					theme === 'black' ? 'bg-[#1e1e1e]' : 'bg-white',
				)}
				// 覆盖 Radix 内层 display:table + minWidth:100%，否则 table 会按内容扩宽并顶破分栏
				viewportClassName="[&>div]:!box-border [&>div]:!block [&>div]:!w-full [&>div]:!min-w-0 [&>div]:!max-w-full"
			>
				<div className="box-border min-w-0 max-w-full p-3">
					<div
						className="[&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-none [&_.markdown-body]:wrap-break-word [&_.markdown-body]:bg-transparent! [&_.markdown-body]:text-textcolor/90! [&_.markdown-body_pre]:max-w-full [&_.markdown-body_pre]:overflow-x-auto"
						dangerouslySetInnerHTML={{ __html: html }}
					/>
				</div>
			</ScrollArea>
		</div>
	);
});

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
	value = '',
	onChange,
	placeholder = '# 输入内容...',
	className,
	height = '300px',
	readOnly = false,
	theme = 'vs',
	language = 'markdown',
	toolbar,
	title,
	enableMarkdownPreview = true,
}) => {
	const editorRef = useRef<MonacoEditorInstance | null>(null);
	const [viewMode, setViewMode] = useState<MarkdownViewMode>('edit');
	const [splitPreviewScrollFollow, setSplitPreviewScrollFollow] =
		useState(false);
	const viewModeRef = useRef(viewMode);
	const splitScrollFollowRef = useRef(splitPreviewScrollFollow);
	const previewViewportRef = useRef<HTMLDivElement | null>(null);
	const splitScrollFollowSwitchId = useId();

	const isMarkdown = language === 'markdown' && enableMarkdownPreview;

	useEffect(() => {
		viewModeRef.current = viewMode;
	}, [viewMode]);

	useEffect(() => {
		splitScrollFollowRef.current = splitPreviewScrollFollow;
	}, [splitPreviewScrollFollow]);

	const alignPreviewScrollToEditor = useCallback(() => {
		if (viewModeRef.current !== 'split') return;
		const editor = editorRef.current;
		const vp = previewViewportRef.current;
		if (!editor || !vp) return;
		setPreviewVerticalScrollRatio(vp, editorVerticalScrollRatio(editor));
	}, []);

	// 进入分屏或打开「跟随滚动」时，按编辑器位置对齐预览（仅当跟开启）
	useEffect(() => {
		if (viewMode !== 'split' || !splitPreviewScrollFollow) return;
		queueMicrotask(() => {
			if (viewModeRef.current !== 'split' || !splitScrollFollowRef.current)
				return;
			alignPreviewScrollToEditor();
		});
	}, [viewMode, splitPreviewScrollFollow, alignPreviewScrollToEditor]);

	const syncPreviewFromEditor = useCallback(() => {
		if (viewModeRef.current !== 'split' || !splitScrollFollowRef.current) {
			return;
		}
		const editor = editorRef.current;
		const vp = previewViewportRef.current;
		if (!editor || !vp) return;
		const ratio = editorVerticalScrollRatio(editor);
		setPreviewVerticalScrollRatio(vp, ratio);
	}, []);

	const handleEditorMount: OnMount = (editor, monaco) => {
		editorRef.current = editor;

		registerPrettierFormatProviders(monaco);

		editor.addCommand(
			monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
			() => {
				editor.trigger('keyboard', 'editor.action.formatDocument', null);
			},
		);

		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
			editor.trigger('keyboard', 'editor.action.commentLine', null);
		});

		editor.onDidChangeModelContent(() => {
			onChange?.(editor.getValue());
		});

		editor.onDidScrollChange(() => {
			syncPreviewFromEditor();
		});

		editor.focus();
	};

	const focusEditor = useCallback(() => {
		editorRef.current?.focus();
	}, []);

	const modeBtnClass = (active: boolean) =>
		cn(
			'cursor-pointer inline-flex items-center justify-center rounded px-2 py-1 text-xs transition-colors',
			active
				? 'bg-theme/25 text-textcolor'
				: 'text-textcolor/60 hover:bg-theme/10 hover:text-textcolor',
		);

	return (
		<div
			className={cn(
				'min-w-0 max-w-full rounded-md overflow-hidden bg-theme/5',
				className,
			)}
		>
			<div
				className={cn(
					'flex h-10 min-w-0 items-center gap-2 border-b border-theme/5',
				)}
			>
				{title}
				{isMarkdown ? (
					<div
						className="flex shrink-0 items-center gap-0.5 rounded-md border border-theme/10 p-0.5"
						role="tablist"
						aria-label="Markdown 视图"
					>
						<button
							type="button"
							role="tab"
							aria-selected={viewMode === 'edit'}
							className={modeBtnClass(viewMode === 'edit')}
							title="编辑源码"
							onClick={() => {
								setViewMode('edit');
								queueMicrotask(focusEditor);
							}}
						>
							<FilePenLine size={14} className="mr-1 opacity-80" />
							编辑
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={viewMode === 'preview'}
							className={modeBtnClass(viewMode === 'preview')}
							title="预览渲染"
							onClick={() => setViewMode('preview')}
						>
							<Eye size={14} className="mr-1 opacity-80" />
							预览
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={viewMode === 'split'}
							className={modeBtnClass(viewMode === 'split')}
							title="分屏：左编辑右预览"
							onClick={() => {
								setViewMode('split');
								queueMicrotask(focusEditor);
							}}
						>
							<Columns2 size={14} className="mr-1 opacity-80" />
							分屏
						</button>
					</div>
				) : null}
				{toolbar ? (
					<div className="flex min-w-0 flex-1 items-center justify-end gap-2">
						{toolbar}
					</div>
				) : null}
			</div>

			<div
				className="min-h-0 min-w-0 max-w-full overflow-hidden"
				style={{ height }}
			>
				{!isMarkdown || viewMode === 'edit' ? (
					<Editor
						height={height}
						language={language}
						value={value}
						onChange={(val) => onChange?.(val || '')}
						theme={theme}
						onMount={handleEditorMount}
						options={{ ...options, readOnly, placeholder }}
						loading={<Loading text="正在加载编辑器..." />}
					/>
				) : null}

				{isMarkdown && viewMode === 'preview' ? (
					<ParserMarkdownPreviewPane markdown={value} />
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
									height="100%"
									language={language}
									value={value}
									onChange={(val) => onChange?.(val || '')}
									theme={theme}
									onMount={handleEditorMount}
									options={{ ...options, readOnly, placeholder }}
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
							<div className="relative h-full min-h-0 min-w-0 overflow-hidden contain-[inline-size]">
								<ParserMarkdownPreviewPane
									markdown={value}
									viewportRef={previewViewportRef}
								/>
								<div className="pointer-events-none absolute -right-1 -bottom-1 z-99 flex items-end justify-end p-2">
									<div className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-theme/15 bg-theme/10 px-2 py-1 shadow-sm backdrop-blur-sm">
										<Switch
											id={splitScrollFollowSwitchId}
											size="sm"
											checked={splitPreviewScrollFollow}
											onCheckedChange={setSplitPreviewScrollFollow}
											aria-label="预览跟随左侧编辑器滚动"
										/>
										<Label
											htmlFor={splitScrollFollowSwitchId}
											className="cursor-pointer text-xs text-textcolor/75"
										>
											跟随滚动
										</Label>
									</div>
								</div>
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				) : null}
			</div>
		</div>
	);
};

export default MarkdownEditor;
