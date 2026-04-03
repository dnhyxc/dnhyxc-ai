import Tooltip from '@design/Tooltip';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Button, ScrollArea } from '@ui/index';
import {
	Columns2,
	Eye,
	FilePenLine,
	PanelTopClose,
	PanelTopOpen,
	ScrollText,
} from 'lucide-react';
import {
	memo,
	type RefObject,
	useCallback,
	useEffect,
	useId,
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
import { options } from './options';
import {
	editorVerticalScrollRatio,
	type MonacoEditorInstance,
	setPreviewVerticalScrollRatio,
} from './utils';

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
				highlightTheme: getChatMarkdownHighlightTheme(theme),
				enableChatCodeFenceToolbar: true,
			}),
		[theme],
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

	const { relayout: relayoutCodeToolbar } = useChatCodeFloatingToolbar(
		localViewportRef,
		{ layoutDeps: [markdown] },
	);

	const syncScrollMetrics = useCallback(() => {
		const el = localViewportRef.current;
		if (!el) return;
		relayoutCodeToolbar();
	}, [relayoutCodeToolbar]);

	useEffect(() => {
		syncScrollMetrics();
		const id = requestAnimationFrame(() => syncScrollMetrics());
		return () => cancelAnimationFrame(id);
	}, [markdown, syncScrollMetrics]);

	return (
		<div
			ref={markdownRef}
			className="h-full min-h-0 min-w-0 max-w-full w-full overflow-hidden contain-[inline-size]"
		>
			<ChatCodeFloatingToolbar />
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
				<div className="box-border min-w-0 max-w-full w-full p-3">
					<div
						className="[&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-none [&_.markdown-body]:wrap-break-word [&_.markdown-body]:overflow-x-auto [&_.markdown-body]:bg-transparent! [&_.markdown-body]:text-textcolor/90! [&_.markdown-body_pre]:max-w-full [&_.markdown-body_pre]:overflow-x-auto [&_.markdown-body_table]:block [&_.markdown-body_table]:max-w-full [&_.markdown-body_table]:overflow-x-auto"
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
	/** 底部 Markdown 操作条是否展开（由顶栏 toolbar 区域按钮切换） */
	const [markdownBottomBarOpen, setMarkdownBottomBarOpen] = useState(false);
	const viewModeRef = useRef(viewMode);
	const splitScrollFollowRef = useRef(splitPreviewScrollFollow);
	const previewViewportRef = useRef<HTMLDivElement | null>(null);
	const markdownBottomBarId = useId();

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
						<div className="h-full min-h-0 min-w-0 max-w-full w-full overflow-hidden contain-[inline-size]">
							<ParserMarkdownPreviewPane markdown={value} />
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
								<div className="h-full min-h-0 min-w-0 overflow-hidden contain-[inline-size]">
									<ParserMarkdownPreviewPane
										markdown={value}
										viewportRef={previewViewportRef}
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
								<Tooltip content="跟随滚动">
									<button
										type="button"
										className={markdownBarIconBtnClass(
											splitPreviewScrollFollow,
										)}
										aria-pressed={splitPreviewScrollFollow}
										aria-label="跟随滚动"
										onClick={() => setSplitPreviewScrollFollow((v) => !v)}
									>
										<ScrollText size={18} strokeWidth={1.75} />
									</button>
								</Tooltip>
							)}
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
};

export default MarkdownEditor;
