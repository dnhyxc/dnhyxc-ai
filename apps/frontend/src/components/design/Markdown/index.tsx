import { MermaidFenceIsland } from '@design/MermaidFenceIsland';
import { MermaidFenceToolbarActions } from '@design/MermaidFenceToolbar';
import Tooltip from '@design/Tooltip';
import {
	bindMarkdownCodeFenceActions,
	MARKDOWN_MERMAID_TAILWIND_CURSOR_ZOOM_IN_CLASS,
	type MarkdownMermaidSplitPart,
	MarkdownParser,
} from '@dnhyxc-ai/tools';
import { useMermaidInMarkdownRoot } from '@dnhyxc-ai/tools/react';
import { ScrollArea } from '@ui/index';
import { ChevronDown, ChevronUp, Component } from 'lucide-react';
import {
	memo,
	type RefObject,
	type UIEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { getChatMarkdownHighlightTheme } from '@/constant';
import {
	useMarkdownHashLinkViewportScroll,
	useMermaidDiagramClickPreview,
	useMermaidImagePreview,
	useTheme,
} from '@/hooks';
import {
	ChatCodeFloatingToolbar,
	useChatCodeFloatingToolbar,
} from '@/hooks/useChatCodeFloatingToolbar';
import { cn } from '@/lib/utils';
import { downloadChatCodeBlock } from '@/utils/chatCodeToolbar';
import {
	hashText,
	mermaidStreamingFallbackHtml,
	splitForMermaidIslandsWithOpenTail,
} from '@/utils/splitMarkdownFences';

/**
 * 分段 `render` 时标题 `data-md-heading-line` 为片段内 1-based；
 * 加上 `lineBase0`（整篇 normalized 源里该段首行的 0-based 行下标）得到与 Monaco 一致的全文 1-based 行号。
 */
function shiftMarkdownPreviewHeadingLineAttrs(
	html: string,
	lineBase0: number,
): string {
	if (!lineBase0) return html;
	return html.replace(
		/data-md-heading-line="(\d+)"/g,
		(_, d) => `data-md-heading-line="${lineBase0 + Number.parseInt(d, 10)}"`,
	);
}

/** 纯预览模式右下角：可滚动时显示置底，触底后切换为置顶 */
type PreviewScrollCornerFabMode = 'hidden' | 'toBottom' | 'toTop';

type MarkdownPreviewT = (
	key: string,
	params?: Record<string, unknown>,
) => string;

interface ParserMarkdownPreviewPaneProps {
	markdown: string;
	/** i18n 翻译函数（可选）；不传则沿用组件内默认中文文案 */
	t?: MarkdownPreviewT;
	/**
	 * 分屏同步滚动：指向 ScrollArea 的 Viewport（Radix ref 落在 viewport 上）。
	 * 与 `withScrollArea={false}` 联用时：不再套内层 ScrollArea，由宿主提供唯一滚动层，
	 * 使 `MermaidFenceToolbar` 的 `closest([data-slot="scroll-area-viewport"])` 与代码吸顶条与宿主 viewport 一致。
	 */
	viewportRef?: RefObject<HTMLDivElement | null>;
	/** 逻辑文档切换时重置预览滚动，避免沿用上一篇的 scrollTop */
	documentIdentity?: string;
	/** 分屏且开启跟随时：预览滚动时驱动编辑器对齐 */
	onViewportScrollFollow?: () => void;
	/** 纯预览模式：右下角置底 / 触底后置顶浮动按钮 */
	showPreviewScrollCornerFab?: boolean;
	/** 是否启用 Mermaid 围栏解析与前端渲染 */
	enableMermaid?: boolean;
	/** 是否启用自动滚动 */
	withScrollArea?: boolean;
}

/**
 * 使用 @dnhyxc-ai/tools 的 MarkdownParser 渲染预览（与文档处理等页一致）。
 * 知识库等场景仍启用围栏代码块内联工具栏；Mermaid 岛与 `StreamingMarkdownBody` 一致带顶栏与 sticky 吸顶（`MermaidFenceToolbar`）。
 */
const ParserMarkdownPreviewPane = memo(function ParserMarkdownPreviewPane({
	markdown,
	t,
	viewportRef,
	documentIdentity,
	onViewportScrollFollow,
	showPreviewScrollCornerFab = false,
	enableMermaid = true,
	withScrollArea = true,
}: ParserMarkdownPreviewPaneProps) {
	const markdownRef = useRef<HTMLDivElement>(null);
	/** 与 `dangerouslySetInnerHTML` 同层，保证 Mermaid 在内容写入后再扫描节点 */
	const previewHtmlRootRef = useRef<HTMLDivElement>(null);
	const localViewportRef = useRef<HTMLDivElement | null>(null);
	/** 分享页等：父级 ScrollArea 为唯一滚动层，避免嵌套双 viewport 导致 Mermaid 顶栏/吸顶条失效 */
	const embedInParentScroll = !withScrollArea && Boolean(viewportRef);
	const effectiveScrollViewportRef: RefObject<HTMLDivElement | null> =
		embedInParentScroll && viewportRef ? viewportRef : localViewportRef;
	const [previewScrollFabMode, setPreviewScrollFabMode] =
		useState<PreviewScrollCornerFabMode>('hidden');

	const { theme } = useTheme();

	const refreshPreviewScrollFab = useCallback(() => {
		if (!showPreviewScrollCornerFab) {
			setPreviewScrollFabMode('hidden');
			return;
		}
		const vp = effectiveScrollViewportRef.current;
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
	}, [showPreviewScrollCornerFab, effectiveScrollViewportRef]);

	useLayoutEffect(() => {
		const vp = effectiveScrollViewportRef.current;
		if (vp) {
			vp.scrollTop = 0;
			vp.scrollLeft = 0;
		}
	}, [documentIdentity, effectiveScrollViewportRef]);

	// 换篇或开启角标后更新「置底/置顶」状态（勿与上一段合并，避免 refresh 回调变动时误重置滚动）
	useLayoutEffect(() => {
		if (!showPreviewScrollCornerFab) return;
		requestAnimationFrame(() => refreshPreviewScrollFab());
	}, [documentIdentity, showPreviewScrollCornerFab, refreshPreviewScrollFab]);

	// 目录 / 页内 #：与聊天共用 `useMarkdownHashLinkViewportScroll`（实录见 docs/monaco/markdown-preview-toc-hash-navigation.md §9）
	const getMarkdownHashScrollViewport = useCallback(
		() => effectiveScrollViewportRef.current,
		[effectiveScrollViewportRef],
	);
	useMarkdownHashLinkViewportScroll(markdownRef, getMarkdownHashScrollViewport);

	useEffect(() => {
		const el = markdownRef.current;
		if (!el) return;
		const detachCodeFenceActions = bindMarkdownCodeFenceActions(el, {
			onDownload(payload) {
				void downloadChatCodeBlock(payload.block, payload.lang);
			},
		});
		return () => detachCodeFenceActions();
	}, []);

	const assignViewportRef = useCallback(
		(node: HTMLDivElement | null) => {
			localViewportRef.current = node;
			if (viewportRef) viewportRef.current = node;
		},
		[viewportRef],
	);

	// 单例 parser：是否输出 Mermaid 占位 DOM 由 render() 的参数控制（避免 new 两次）
	const parser = useMemo(
		() =>
			new MarkdownParser({
				highlightTheme: getChatMarkdownHighlightTheme(theme),
				enableChatCodeFenceToolbar: true,
				enableHeadingSourceLineAttr: true,
			}),
		[theme],
	);

	const { parts: fenceParts, openMermaidId } = useMemo(
		() =>
			// 使用 splitForMermaidIslandsWithOpenTail 拆分 markdown，将 mermaid 围栏（包括尾部未闭合的 mermaid 代码块）单独提取成岛（parts）。
			// 这样能够支持 Monaco 预览时的流式 mermaid 渲染，即使 mermaid 块未闭合依然能够单独处理与展示。
			splitForMermaidIslandsWithOpenTail({
				markdown,
				parser,
				enableOpenTail: enableMermaid, // 仅启用时检测尾部未闭合的 mermaid 围栏
				openMermaidIdPrefix: 'pv-mmd-open-line-', // 生成未闭合 mermaid 块的唯一 key 前缀
			}),
		[markdown, parser, enableMermaid],
	);

	const hasMermaidIslandLayout = Boolean(
		enableMermaid && fenceParts.some((p) => p.type === 'mermaid'),
	);

	const html = useMemo(() => {
		if (hasMermaidIslandLayout) return '';
		return parser.render(markdown, { enableMermaid });
	}, [hasMermaidIslandLayout, parser, markdown, enableMermaid]);

	/** 含 Mermaid 岛时不在整段 HTML 上跑 run（岛内自渲染），否则与聊天流一致扫描 .mermaid */
	const mermaidRootScanParser = useMemo(
		() => ({
			enableMermaid: enableMermaid && !hasMermaidIslandLayout,
		}),
		[enableMermaid, hasMermaidIslandLayout],
	);

	useMermaidInMarkdownRoot({
		rootRef: previewHtmlRootRef,
		preferDark: theme === 'black',
		trigger: hasMermaidIslandLayout ? markdown : html,
		parser: mermaidRootScanParser,
	});

	const { openMermaidPreview, mermaidImagePreviewModal } =
		useMermaidImagePreview();

	const renderMermaidPreviewPart = useCallback(
		(
			part: Extract<MarkdownMermaidSplitPart, { type: 'mermaid' }>,
			i: number,
		) => {
			const blockId = part.complete
				? `mmd-${hashText(part.text)}`
				: (openMermaidId ?? `mmd-open-${i}`);

			return (
				<MermaidFenceToolbarActions
					key={`pv-mm-wrap-${blockId}`}
					blockId={blockId}
					mermaidCode={part.text}
					openMermaidPreview={openMermaidPreview}
					defaultViewMode="diagram"
					resetKey={documentIdentity}
					t={t}
				>
					{(mode) =>
						mode === 'code' ? (
							<div
								dangerouslySetInnerHTML={{
									__html: mermaidStreamingFallbackHtml(part.text),
								}}
							/>
						) : (
							<MermaidFenceIsland
								code={part.text}
								preferDark={theme === 'black'}
								isStreaming={!part.complete}
								openMermaidPreview={openMermaidPreview}
								className="monaco-preview-mode-mermaid"
							/>
						)
					}
				</MermaidFenceToolbarActions>
			);
		},
		[documentIdentity, openMermaidId, openMermaidPreview, theme],
	);

	useMermaidDiagramClickPreview(
		previewHtmlRootRef,
		openMermaidPreview,
		enableMermaid,
		hasMermaidIslandLayout ? markdown : html,
	);

	const { relayout: relayoutCodeToolbar } = useChatCodeFloatingToolbar(
		effectiveScrollViewportRef,
		{ layoutDeps: [markdown] },
	);

	const syncScrollMetrics = useCallback(() => {
		const el = effectiveScrollViewportRef.current;
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
			const vp = effectiveScrollViewportRef.current;
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
		const vp = effectiveScrollViewportRef.current;
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

	/**
	 * 渲染 Markdown 预览的根节点：
	 * - ref={previewHtmlRootRef}：用于 Mermaid 等场景下内容生成后的 DOM 操作（如图表扫描/渲染），保证与 dangerouslySetInnerHTML 同层。
	 * - className：结合 Tailwind 工具类，对 markdown-body 子节点做适配，确保内容换行、表格/代码块横向滚动等表现，且采用透明底色与主字体色。
	 *   特别：
	 *   - [&_.markdown-body] 前缀：仅限定 markdown-body 内部元素，不干扰其它样式。
	 *   - enableMermaid && MARKDOWN_MERMAID_TAILWIND_CURSOR_ZOOM_IN_CLASS：支持 mermaid 图时鼠标变为缩放指针。
	 *
	 * 渲染内容逻辑：
	 * - hasMermaidIslandLayout 为 true 时，说明存在 mermaid 岛屿布局（即 markdown 被 fenceParts 拆分，有代码/mermaid块需分别处理）：
	 *   - 遍历 fenceParts（经过 splitForMermaidIslandsWithOpenTail 拆分的 markdown 段落），每个 part 可能是普通 markdown 或 mermaid 类型。
	 *   - 对 type === 'markdown' 的片段单独渲染，注意此时禁用 enableMermaid，防止解析 mermaid 代码块为 html。
	 *   - 渲染时调用 shiftMarkdownPreviewHeadingLineAttrs 给每个段落的 heading 标题行数加上正确的行号偏移（确保跳转或定位时与全文一致）。
	 *   - 其它类型（如 mermaid 块）则用 renderMermaidPreviewPart 单独渲染（含占位、toolbar 等）。
	 * - 否则（没有 mermaid 岛），直接整段渲染 markdown 生成的 html。
	 */
	const previewHtmlRoot = (
		<div
			ref={previewHtmlRootRef}
			className={cn(
				// markdown-body 相关的布局和样式优化，保证各种内容表现正常
				'[&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-none [&_.markdown-body]:wrap-break-word [&_.markdown-body]:overflow-x-auto [&_.markdown-body]:bg-transparent! [&_.markdown-body]:text-textcolor/90! [&_.markdown-body_:is(h1,h2,h3,h4,h5,h6)]:scroll-mt-3 [&_.markdown-body_pre]:max-w-full [&_.markdown-body_pre]:overflow-x-auto [&_.markdown-body_table]:block [&_.markdown-body_table]:max-w-full [&_.markdown-body_table]:overflow-x-auto',
				// 如果启用 Mermaid，则加相应的鼠标样式
				enableMermaid && MARKDOWN_MERMAID_TAILWIND_CURSOR_ZOOM_IN_CLASS,
			)}
		>
			{hasMermaidIslandLayout ? (
				// 如果存在 Mermaid 岛布局，则遍历分离出来的各个块分别渲染
				fenceParts.map((part, i) => {
					if (part.type === 'markdown') {
						// 处理普通 markdown 块，禁用 mermaid，避免二次渲染
						const rawHtml = parser.render(part.text, {
							enableMermaid: false,
						});
						return (
							<div
								key={`pv-${i}`}
								dangerouslySetInnerHTML={{
									// 对当前段落的 heading data-md-heading-line 属性进行校正（+part.lineBase0 偏移）
									__html: shiftMarkdownPreviewHeadingLineAttrs(
										rawHtml,
										part.lineBase0,
									),
								}}
							/>
						);
					}
					// 其它类型（如 mermaid 岛）交由专用渲染
					return renderMermaidPreviewPart(part, i);
				})
			) : (
				// 若没有 mermaid 岛，直接整体渲染 markdown 解析出来的 html
				<div dangerouslySetInnerHTML={{ __html: html }} />
			)}
		</div>
	);

	return (
		<div
			ref={markdownRef}
			className={cn(
				'relative h-full min-h-0 min-w-0 max-w-full w-full contain-[inline-size] select-text',
				embedInParentScroll ? 'overflow-visible' : 'overflow-hidden',
			)}
		>
			{withScrollArea ? <ChatCodeFloatingToolbar /> : null}
			{markdown ? (
				embedInParentScroll ? (
					<div className="box-border min-w-0 max-w-full w-full p-3">
						{previewHtmlRoot}
					</div>
				) : (
					<ScrollArea
						ref={assignViewportRef}
						scrollbars="both"
						onScroll={handleViewportScroll}
						className={cn(
							'h-full min-h-0 min-w-0 max-w-full w-full bg-transparent',
						)}
						// 覆盖 Radix 内层 display:table + minWidth:100%，否则 table 会按内容扩宽并顶破分栏
						viewportClassName={cn(
							'[&>div]:!box-border [&>div]:!block [&>div]:!w-full [&>div]:!min-w-0 [&>div]:!max-w-full',
							withScrollArea && 'overscroll-y-contain',
						)}
					>
						<div className="box-border min-w-0 max-w-full w-full p-3">
							{previewHtmlRoot}
						</div>
					</ScrollArea>
				)
			) : (
				<div className="flex items-center justify-center flex-col gap-5 h-full box-border min-w-0 max-w-full w-full p-3 rounded-md">
					<Component className="w-16 h-16 text-textcolor/70 animate-bounce" />
					<div className="text-sm text-textcolor/80">
						{t?.('markdown.preview.empty') ?? '预览内容为空'}
					</div>
				</div>
			)}
			{showPreviewScrollCornerFab && previewScrollFabMode !== 'hidden' ? (
				<Tooltip
					content={
						previewScrollFabMode === 'toBottom'
							? (t?.('markdown.preview.scroll.toBottom') ?? '滚动到底部')
							: (t?.('markdown.preview.scroll.toTop') ?? '滚动到顶部')
					}
				>
					<button
						type="button"
						className={cn(
							// 与 ChatControls 滚动按钮一致，并加轻量 backdrop 滤镜（同 glassChip 的 blur）
							'absolute bottom-2.5 right-2.5 z-10 flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-full border border-theme/5 bg-theme/5 text-textcolor/70 backdrop-blur-[2px] hover:bg-theme/15',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40',
						)}
						aria-label={
							previewScrollFabMode === 'toBottom'
								? (t?.('markdown.preview.scroll.toBottom') ?? '滚动到底部')
								: (t?.('markdown.preview.scroll.toTop') ?? '滚动到顶部')
						}
						onClick={onPreviewScrollCornerFabClick}
					>
						{previewScrollFabMode === 'toBottom' ? (
							<ChevronDown aria-hidden />
						) : (
							<ChevronUp aria-hidden />
						)}
					</button>
				</Tooltip>
			) : null}
			{mermaidImagePreviewModal}
		</div>
	);
});

export default ParserMarkdownPreviewPane;
