/**
 * 助手消息气泡：正文与思考过程使用 md-editor-rt（MdPreview），单条即较重。
 * 性能策略：非流式消息在离开视口时不立即挂载 MdPreview，用 IntersectionObserver + 几何预判，
 * 避免分支切换时数百条编辑器同步初始化卡死主线程（非虚拟列表，DOM 仍保留）。
 */

import {
	bindMarkdownCodeFenceActions,
	MarkdownParser,
} from '@dnhyxc-ai/markdown-kit';
import { Button, Spinner } from '@ui/index';
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Earth,
	Globe,
	Rotate3d,
	SearchIcon,
} from 'lucide-react';
// memo：父级重渲染时若 props 判定相等则跳过本组件，减少与 PlainTextFallback / MdPreview 的协调成本
import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { createPortal } from 'react-dom';
import { getChatMarkdownHighlightTheme } from '@/constant';
import { useMarkdownHashLinkViewportScroll } from '@/hooks';
import { useTheme } from '@/hooks/theme';
import { cn } from '@/lib/utils';
import { ChatI18nT, Message, SearchOrganicItem } from '@/types/chat';
import { downloadChatCodeBlock } from '@/utils/chatCodeToolbar';
import { openExternalUrl } from '@/utils/open-external';
import {
	applyOrganicCitationAnchors,
	areOrganicPreviewItemsSame,
	findClosestOrganicCitationAnchor,
	injectOrganicCitationAnchorsIntoMarkdownHtml,
	normalizePersistedOrganicAnchorsInMarkdown,
	resolveOrganicCitationPreviewItems,
	sanitizeOrganicSnippetForPreview,
	shortHostnameFromUrl,
	syncOrganicMergedAnchorDom,
} from '@/utils/organicCitation';
// import { patchIncompleteNonMermaidFence } from '@/utils/splitMarkdownFences';
import SearchOrganics from './SearchOrganics';
import { StreamingMarkdownBody } from './StreamingMarkdownBody';

/** 角标矩形快照（仅存数值，避免持有 DOMRect 引用） */
type OrganicAnchorRect = Pick<
	DOMRect,
	'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'
>;

function snapshotOrganicAnchorRect(el: HTMLElement): OrganicAnchorRect {
	const r = el.getBoundingClientRect();
	return {
		left: r.left,
		top: r.top,
		right: r.right,
		bottom: r.bottom,
		width: r.width,
		height: r.height,
	};
}

/** 与弹层 class 中 max-h-[min(280px,70vh)] 一致，用于算可用高度，避免用固定 280 推 top 导致短内容「悬在天上」 */
const ORGANIC_POPOVER_MAX_H = 280;
const ORGANIC_POPOVER_MAX_VH_RATIO = 0.7;

/**
 * 按角标定位：优先在角标下方用 top；空间不够时在上方用 bottom 贴住角标上沿（不用虚构全高去减 top）。
 */
function layoutOrganicPopoverForAnchor(anchorRect: OrganicAnchorRect): {
	left: number;
	top: number | 'auto';
	bottom: number | 'auto';
	maxHeight: number;
} {
	const margin = 10;
	const gap = 8;
	const vh = window.innerHeight;
	const estW = Math.min(352, window.innerWidth - 2 * margin);
	const maxPopH = Math.min(
		ORGANIC_POPOVER_MAX_H,
		Math.round(vh * ORGANIC_POPOVER_MAX_VH_RATIO),
	);

	let left = anchorRect.left;
	if (left + estW > window.innerWidth - margin) {
		left = window.innerWidth - estW - margin;
	}
	if (left < margin) {
		left = margin;
	}

	const spaceBelow = vh - margin - anchorRect.bottom - gap;
	const spaceAbove = anchorRect.top - gap - margin;
	const preferBelow = spaceBelow >= spaceAbove;

	if (preferBelow) {
		const top = anchorRect.bottom + gap;
		const maxHeight = Math.max(80, Math.min(maxPopH, vh - margin - top));
		return { left, top, bottom: 'auto', maxHeight };
	}

	const bottom = vh - anchorRect.top + gap;
	const maxHeight = Math.max(
		80,
		Math.min(maxPopH, anchorRect.top - gap - margin),
	);
	return { left, top: 'auto', bottom, maxHeight };
}

/** 合并胶囊分页：按已保存页码恢复，并夹紧在条数范围内 */
function clampMergedOrganicPreviewIndex(
	saved: number | undefined,
	itemCount: number,
): number {
	if (itemCount < 2) {
		return 0;
	}
	if (saved === undefined) {
		return 0;
	}
	return Math.min(Math.max(0, saved), itemCount - 1);
}

interface AssistantMessageProps {
	message: Message;
	isShowThinkContent?: boolean;
	onToggleThinkContent?: () => void;
	onContinue?: () => void;
	onContinueAnswering?: (message?: Message) => void;
	isStopped?: boolean;
	/** i18n 翻译函数（可选）；不传则沿用组件内默认中文文案 */
	t?: ChatI18nT;
	/**
	 * 与 ChatBot 里 ScrollArea 转发的 ref 一致（实际指向 Radix Viewport，即可滚动元素）。
	 * 有值：启用「进视口才挂 MdPreview」；无值：保持旧行为，始终富文本（兼容其它调用方）。
	 */
	scrollViewportRef?: React.RefObject<HTMLElement | null>;
	className?: string;
}

function ChatAssistantMessageInner({
	message,
	isShowThinkContent,
	onToggleThinkContent,
	onContinue,
	onContinueAnswering,
	isStopped,
	t,
	scrollViewportRef,
	className,
}: AssistantMessageProps) {
	const { theme: appTheme } = useTheme();
	// 挂在外层 div，作为 IntersectionObserver 的 observe 目标，覆盖整条助手气泡
	const shellRef = useRef<HTMLDivElement>(null);
	const bodyMarkdownRef = useRef<HTMLDivElement>(null);
	const previewBubbleRef = useRef<HTMLDivElement>(null);
	/** 与当前预览绑定的角标节点；同 position 多出处时需区分，否则会沿用旧 rect 导致气泡跑偏 */
	const organicPreviewAnchorRef = useRef<HTMLAnchorElement | null>(null);
	/** 合并胶囊 DOM 定位；关闭预览时不再把正文打回第一条 */
	const lastMergedAnchorVisualRef = useRef<{
		el: HTMLAnchorElement;
		items: SearchOrganicItem[];
	} | null>(null);
	/** `data-organic-cite-group` → 用户选的页码（0-based），悬浮框关闭后仍保留 */
	const mergedOrganicPageByGroupRef = useRef<Map<string, number>>(new Map());
	const mergedAnchorDomSyncRef = useRef<{ el: Element | null; index: number }>({
		el: null,
		index: -1,
	});
	const previewLeaveTimerRef = useRef(0);
	const [open, setOpen] = useState(false);
	/** 按角标矩形定位；同一条引用在 pointermove 内不重复 setState，避免气泡跟手抖 */
	const [organicPreview, setOrganicPreview] = useState<{
		items: SearchOrganicItem[];
		index: number;
		anchorRect: OrganicAnchorRect;
	} | null>(null);

	// Mermaid 由 StreamingMarkdownBody 内独立岛渲染；此处关闭避免围栏重复解析
	const chatMdParser = useMemo(
		() =>
			new MarkdownParser({
				enableChatCodeFenceToolbar: true,
				chatCodeFenceToolbarTexts: {
					copy: t?.('common.copy') ?? '复制',
					download: t?.('common.download') ?? '下载',
				},
				enableMermaid: false,
				highlightTheme: getChatMarkdownHighlightTheme(appTheme),
			}),
		[appTheme, t],
	);

	// 正文：先规范化落库里的 <a data-organic-cite>，再将 【n】/[n] 转为占位符；真实 <a> 在 Markdown 渲染后注入（避免 md html:false 转义）
	const bodyText = useMemo(() => {
		const thinkingText = t?.('chat.assistant.thinking') ?? '思考中...';
		let raw = message.content || (message?.thinkContent ? '' : thinkingText);
		const org = message.searchOrganic;
		if (raw === thinkingText) {
			return raw;
		}
		// 未闭合的 ```json / ``` 等会把后续正文吞进 code 块，联网场景常见；先修补再渲染
		// raw = patchIncompleteNonMermaidFence(raw);
		raw = normalizePersistedOrganicAnchorsInMarkdown(raw, org);
		if (!org?.length) {
			return raw;
		}
		return applyOrganicCitationAnchors(raw, org);
	}, [message.content, message.thinkContent, message.searchOrganic, t]);

	const isSearchOrganicEnabled = (message.searchOrganic?.length ?? 0) > 0;

	const injectSearchOrganicAnchorsHtml = useCallback(
		(html: string) =>
			injectOrganicCitationAnchorsIntoMarkdownHtml(
				html,
				message.searchOrganic ?? [],
			),
		[message.searchOrganic],
	);

	// 目录 / 页内 #：与 Monaco 预览共用 Hook（实录见 docs/monaco/markdown-preview-toc-hash-navigation.md §9）
	const getMarkdownHashScrollViewport = useCallback(() => {
		const shell = shellRef.current;
		return (
			scrollViewportRef?.current ??
			(shell?.closest(
				'[data-slot="scroll-area-viewport"]',
			) as HTMLElement | null) ??
			null
		);
	}, [scrollViewportRef]);
	useMarkdownHashLinkViewportScroll(shellRef, getMarkdownHashScrollViewport);

	useEffect(() => {
		const el = shellRef.current;
		if (!el) return;
		const detachCodeFenceActions = bindMarkdownCodeFenceActions(el, {
			onDownload(payload) {
				void downloadChatCodeBlock(payload.block, payload.lang);
			},
		});
		return () => detachCodeFenceActions();
	}, []);

	const clearOrganicPreviewLeaveTimer = useCallback(() => {
		if (previewLeaveTimerRef.current) {
			window.clearTimeout(previewLeaveTimerRef.current);
			previewLeaveTimerRef.current = 0;
		}
	}, []);

	const clearOrganicMergedPreviewRefs = useCallback(() => {
		lastMergedAnchorVisualRef.current = null;
		mergedAnchorDomSyncRef.current = { el: null, index: -1 };
	}, []);

	const closeOrganicPreviewNow = useCallback(() => {
		clearOrganicPreviewLeaveTimer();
		clearOrganicMergedPreviewRefs();
		organicPreviewAnchorRef.current = null;
		setOrganicPreview(null);
	}, [clearOrganicPreviewLeaveTimer, clearOrganicMergedPreviewRefs]);

	const scheduleHideOrganicPreview = () => {
		clearOrganicPreviewLeaveTimer();
		previewLeaveTimerRef.current = window.setTimeout(() => {
			clearOrganicMergedPreviewRefs();
			organicPreviewAnchorRef.current = null;
			setOrganicPreview(null);
		}, 180);
	};

	// 点击预览气泡，在新标签页中打开当前索引对应链接
	const onClickOrganicPreview = useCallback(() => {
		if (!organicPreview?.items.length) return;
		const cur =
			organicPreview.items[
				Math.min(organicPreview.index, organicPreview.items.length - 1)
			];
		if (cur?.link) void openExternalUrl(cur.link);
	}, [organicPreview]);

	// 正文内 Serper 引用：悬停/在链接上移动时跟随指针展示摘要（不量锚点）
	useEffect(() => {
		const root = bodyMarkdownRef.current;
		const organics = message.searchOrganic;
		if (!root || !organics?.length) {
			return;
		}

		const applyIfCitation = (e: PointerEvent) => {
			// 仅当指针落在引用胶囊 <a>（或其子节点）上时展示预览，避免邻近正文因「扩展命中区」误触（与 Chat 预期一致）
			const a = findClosestOrganicCitationAnchor(e.target, root, organics);
			if (!a) return;
			const items = resolveOrganicCitationPreviewItems(a, organics);
			if (!items.length) return;
			clearOrganicPreviewLeaveTimer();
			if (items.length > 1) {
				lastMergedAnchorVisualRef.current = { el: a, items };
			} else {
				lastMergedAnchorVisualRef.current = null;
			}
			setOrganicPreview((prev) => {
				const rect = snapshotOrganicAnchorRect(a);
				if (
					prev &&
					organicPreviewAnchorRef.current === a &&
					areOrganicPreviewItemsSame(prev.items, items)
				) {
					return { ...prev, anchorRect: rect };
				}
				organicPreviewAnchorRef.current = a;
				const group = a.getAttribute('data-organic-cite-group')?.trim();
				const initialIndex =
					group && items.length > 1
						? clampMergedOrganicPreviewIndex(
								mergedOrganicPageByGroupRef.current.get(group),
								items.length,
							)
						: 0;
				return { items, index: initialIndex, anchorRect: rect };
			});
		};

		const onPointerOut = (e: PointerEvent) => {
			const fromAnchor = findClosestOrganicCitationAnchor(
				e.target,
				root,
				organics,
			);
			if (!fromAnchor) return;
			const related = e.relatedTarget as Node | null;
			if (related && fromAnchor.contains(related)) return;
			if (related && previewBubbleRef.current?.contains(related)) return;
			scheduleHideOrganicPreview();
		};

		root.addEventListener('pointerover', applyIfCitation);
		root.addEventListener('pointermove', applyIfCitation);
		root.addEventListener('pointerout', onPointerOut);
		return () => {
			clearOrganicPreviewLeaveTimer();
			clearOrganicMergedPreviewRefs();
			organicPreviewAnchorRef.current = null;
			root.removeEventListener('pointerover', applyIfCitation);
			root.removeEventListener('pointermove', applyIfCitation);
			root.removeEventListener('pointerout', onPointerOut);
		};
	}, [
		message.searchOrganic,
		bodyText,
		clearOrganicPreviewLeaveTimer,
		clearOrganicMergedPreviewRefs,
	]);

	const prevBodyTextRef = useRef(bodyText);

	useEffect(() => {
		if (prevBodyTextRef.current === bodyText) return;
		prevBodyTextRef.current = bodyText;
		mergedOrganicPageByGroupRef.current.clear();
		closeOrganicPreviewNow();
	}, [bodyText, closeOrganicPreviewNow]);

	useEffect(() => {
		if (!message.searchOrganic?.length) {
			mergedOrganicPageByGroupRef.current.clear();
			closeOrganicPreviewNow();
		}
	}, [message.searchOrganic, closeOrganicPreviewNow]);

	/** 合并胶囊：预览分页切换时更新正文内域名 / favicon（layout 阶段执行，避免 paint 后仍被 innerHTML 覆盖） */
	useLayoutEffect(() => {
		if (!organicPreview || organicPreview.items.length < 2) {
			mergedAnchorDomSyncRef.current = { el: null, index: -1 };
			return;
		}
		const el =
			lastMergedAnchorVisualRef.current?.el ?? organicPreviewAnchorRef.current;
		const group = el?.getAttribute('data-organic-cite-group')?.trim();
		if (!el || !group) {
			return;
		}
		const idx = organicPreview.index;
		const prevSync = mergedAnchorDomSyncRef.current;
		if (prevSync.el === el && prevSync.index === idx) {
			return;
		}
		mergedAnchorDomSyncRef.current = { el, index: idx };
		syncOrganicMergedAnchorDom(el, organicPreview.items, idx);
		mergedOrganicPageByGroupRef.current.set(group, idx);
	}, [organicPreview]);

	const popoverPos = useMemo(() => {
		if (!organicPreview) return null;
		return layoutOrganicPopoverForAnchor(organicPreview.anchorRect);
	}, [organicPreview]);

	const previewOrganicBase: SearchOrganicItem | null = organicPreview?.items
		?.length
		? (organicPreview.items[
				Math.min(organicPreview.index, organicPreview.items.length - 1)
			] ?? null)
		: null;

	/** 与当前 message.searchOrganic 按 link 对齐，避免悬停时缓存了无 icon 的旧引用而抽屉已是新数据 */
	const previewOrganicCurrent = useMemo((): SearchOrganicItem | null => {
		if (!previewOrganicBase) {
			return null;
		}
		const list = message.searchOrganic;
		if (!list?.length) {
			return previewOrganicBase;
		}
		const hit = list.find(
			(o) => o.link.trim() === previewOrganicBase.link.trim(),
		);
		if (!hit) {
			return previewOrganicBase;
		}
		return {
			...previewOrganicBase,
			...hit,
			icon: hit.icon?.trim() || previewOrganicBase.icon?.trim(),
		};
	}, [previewOrganicBase, message.searchOrganic]);

	useEffect(() => {
		if (!organicPreview) return;
		const onViewportChange = () => closeOrganicPreviewNow();
		window.addEventListener('scroll', onViewportChange, true);
		window.addEventListener('resize', onViewportChange);
		return () => {
			window.removeEventListener('scroll', onViewportChange, true);
			window.removeEventListener('resize', onViewportChange);
		};
	}, [organicPreview, closeOrganicPreviewNow]);

	useEffect(() => {
		if (!organicPreview) return;
		const onDocPointerDown = (e: PointerEvent) => {
			const t = e.target as Node | null;
			if (!t) return;
			if (previewBubbleRef.current?.contains(t)) return;
			closeOrganicPreviewNow();
		};
		document.addEventListener('pointerdown', onDocPointerDown, true);
		return () =>
			document.removeEventListener('pointerdown', onDocPointerDown, true);
	}, [organicPreview, closeOrganicPreviewNow]);

	useEffect(() => {
		if (!organicPreview) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				closeOrganicPreviewNow();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [organicPreview, closeOrganicPreviewNow]);

	return (
		<div
			ref={shellRef} // IO 观察目标：整条气泡（思考区+正文+操作区），进视口判定与此一致
			className="w-full h-auto"
			data-chat-assistant-shell
		>
			{message?.searchOrganic && message.searchOrganic?.length > 0 && (
				<div
					className="flex items-center text-[13px] text-textcolor/50 mb-3 bg-theme/5 hover:bg-theme/10 w-fit py-2 px-3 rounded-md cursor-pointer select-none"
					onClick={() => setOpen(true)}
				>
					<SearchIcon size={16} className="mr-1 mt-0.5" />
					<div>
						{t?.('chat.assistant.readWebPages', {
							n: message.searchOrganic?.length ?? 0,
						}) ?? `已阅读 ${message.searchOrganic?.length} 个网页`}
					</div>
				</div>
			)}
			<div className="w-full">
				{message?.thinkContent ? (
					<div
						className="mb-2 flex items-center cursor-pointer select-none"
						onClick={onToggleThinkContent}
					>
						{t?.('chat.assistant.thinkProcess') ?? '思考过程'}
						{isShowThinkContent ? (
							<ChevronDown size={20} className="ml-2 mt-0.5" />
						) : (
							<ChevronRight size={20} className="ml-2 mt-0.5" />
						)}
					</div>
				) : null}
				{/* 思考展开且存在 thinkContent：richReady 前纯文本，就绪后 MdPreview */}
				{message.thinkContent && isShowThinkContent ? (
					<StreamingMarkdownBody
						markdown={message.thinkContent}
						parser={chatMdParser}
						preferDark={appTheme === 'black'}
						isStreaming={!!message.isStreaming}
						t={t}
						className={cn(`[&_.markdown-body]:text-textcolor/90!`, className)}
					/>
				) : null}
			</div>
			<StreamingMarkdownBody
				containerRef={bodyMarkdownRef}
				markdown={bodyText}
				parser={chatMdParser}
				preferDark={appTheme === 'black'}
				isStreaming={!!message.isStreaming}
				t={t}
				renderedMarkdownHtmlPostProcess={
					isSearchOrganicEnabled && message.searchOrganic?.length
						? injectSearchOrganicAnchorsHtml
						: undefined
				}
				className={cn(
					`[&_.markdown-body]:text-textcolor/90!`,
					isSearchOrganicEnabled && '__md-search-enabled__',
					className,
				)}
			/>
			{message.isStreaming && (
				<div className="mt-2.5 flex items-center">
					<Spinner className="w-4 h-4 mr-2 text-textcolor/50" />
					<span className="text-sm text-textcolor/50">
						{t?.('chat.assistant.generating') ?? '正在生成中...'}
					</span>
				</div>
			)}
			{message?.searchOrganic &&
				message.searchOrganic?.length > 0 &&
				!message.isStreaming && (
					<div className="flex items-center justify-end text-[13px] text-textcolor/50 my-3 italic">
						{t?.('chat.assistant.aiDisclaimer') ??
							'本回答由 AI 生成，内容仅供参考，请仔细甄别'}
					</div>
				)}
			{((message?.searchOrganic &&
				message.searchOrganic?.length > 0 &&
				!message.isStreaming) ||
				isStopped) && (
				<div className="flex items-center justify-end mt-3">
					{message?.searchOrganic &&
						message.searchOrganic?.length > 0 &&
						!message.isStreaming && (
							<Button
								variant="dynamic"
								className="h-8.5 border border-theme/10 flex items-center bg-theme/5 hover:bg-theme/10 w-fit px-3 py-2 rounded-md cursor-pointer select-none"
								onClick={() => setOpen(true)}
							>
								<Earth size={16} className="text-textcolor mb-0.5" />
								{t?.('chat.assistant.webPagesCount', {
									n: message.searchOrganic?.length ?? 0,
								}) ?? `${message.searchOrganic?.length} 个网页`}
							</Button>
						)}
					{isStopped && (
						<Button
							variant="dynamic"
							className="border border-theme/10 h-8.5 flex items-center ml-3 cursor-pointer text-sm text-teal-400 hover:text-teal-300 select-none bg-theme/5 hover:bg-theme/10 py-1.5 px-3 rounded-md"
							onClick={onContinue}
						>
							<Rotate3d size={16} />
							{t?.('chat.assistant.continueGenerate') ?? '继续生成'}
						</Button>
					)}
				</div>
			)}
			{message?.finishReason?.maxTokensReached && (
				<div className="flex items-center justify-end">
					{t?.('chat.assistant.maxTokensExceededPrefix') ??
						'超出最大输出长度，'}
					<div
						className="cursor-pointer text-sm text-teal-400 hover:text-teal-300 select-none"
						onClick={() => onContinueAnswering?.(message)}
					>
						{t?.('chat.assistant.clickContinueAnswer') ?? '点击接着回答'}
					</div>
				</div>
			)}
			<SearchOrganics
				open={open}
				onOpenChange={() => setOpen(false)}
				organics={message.searchOrganic || []}
				t={t}
			/>
			{organicPreview &&
				popoverPos &&
				previewOrganicCurrent &&
				createPortal(
					<div
						ref={previewBubbleRef}
						role="tooltip"
						className="pointer-events-auto cursor-pointer fixed z-10050 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-theme-white/12 bg-theme-background/97 text-left shadow-xl backdrop-blur-md"
						style={{
							left: popoverPos.left,
							top: popoverPos.top,
							bottom: popoverPos.bottom,
							maxHeight: popoverPos.maxHeight,
						}}
						onPointerDown={(e) => e.stopPropagation()}
						onPointerEnter={clearOrganicPreviewLeaveTimer}
						onPointerLeave={scheduleHideOrganicPreview}
						onClick={onClickOrganicPreview}
					>
						<div className="flex max-h-[min(280px,70vh)] flex-col overflow-y-auto">
							<div className="mt-auto flex shrink-0 items-center gap-2 border-b border-theme-white/10 px-3 py-2.5">
								<div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-theme/20">
									{previewOrganicCurrent.icon ? (
										<img
											key={`${previewOrganicCurrent.link}-${organicPreview.index}-icon`}
											src={previewOrganicCurrent.icon}
											alt=""
											referrerPolicy="no-referrer"
											className="relative z-1 h-full w-full object-cover"
											onError={(ev) => {
												ev.currentTarget.style.visibility = 'hidden';
											}}
										/>
									) : (
										<Globe
											size={14}
											className="pointer-events-none absolute inset-0 m-auto text-textcolor/45"
											aria-hidden
										/>
									)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate text-[13px] text-textcolor/80">
										{previewOrganicCurrent.title}
									</div>
									<div className="truncate text-xs text-textcolor/45">
										{shortHostnameFromUrl(previewOrganicCurrent.link)}
									</div>
								</div>
								{previewOrganicCurrent.date ? (
									<span className="shrink-0 text-xs tabular-nums text-textcolor/45">
										{previewOrganicCurrent.date}
									</span>
								) : null}
							</div>

							<div className="flex flex-col gap-2 px-3 py-3">
								<h3 className="text-[15px] font-semibold leading-snug text-textcolor wrap-break-word">
									{previewOrganicCurrent.title}
								</h3>
								{previewOrganicCurrent.snippet ? (
									<p className="line-clamp-3 wrap-break-word text-[13px] leading-relaxed text-textcolor/65">
										{sanitizeOrganicSnippetForPreview(
											previewOrganicCurrent.snippet,
										)}
									</p>
								) : null}
							</div>
							{organicPreview.items.length > 1 ? (
								<div className="flex shrink-0 items-center justify-between border-t border-theme-white/10 px-3 py-2">
									<span className="text-xs text-textcolor/55 tabular-nums">
										{organicPreview.index + 1}/{organicPreview.items.length}
									</span>
									<div className="flex items-center gap-0.5">
										<button
											type="button"
											className="rounded-md p-1 text-textcolor/70 hover:bg-theme/15 hover:text-textcolor"
											aria-label="上一条来源"
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												setOrganicPreview((prev) => {
													if (!prev || prev.items.length < 2) return prev;
													const n = prev.items.length;
													return {
														...prev,
														index: (prev.index - 1 + n) % n,
													};
												});
											}}
										>
											<ChevronLeft size={16} />
										</button>
										<button
											type="button"
											className="rounded-md p-1 text-textcolor/70 hover:bg-theme/15 hover:text-textcolor"
											aria-label="下一条来源"
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												setOrganicPreview((prev) => {
													if (!prev || prev.items.length < 2) return prev;
													const n = prev.items.length;
													return {
														...prev,
														index: (prev.index + 1) % n,
													};
												});
											}}
										>
											<ChevronRight size={16} />
										</button>
									</div>
								</div>
							) : null}
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
}

/**
 * `memo` 第二参数：返回 **true** 表示前后 props 相等 → **跳过**子组件渲染（省 reconcile / MdPreview 成本）。
 * 当 `message` 为同一引用且被 MobX 等就地 mutate 时，对字段两读会得到同一「当前值」，不能据此跳过，须返回 false 强制更新（例如停止流式后收起「正在生成中…」）。
 */
function areChatAssistantMessageMemoPropsEqual(
	prev: Readonly<AssistantMessageProps>,
	next: Readonly<AssistantMessageProps>,
): boolean {
	// 同一 message 引用：下方 `pm.xxx === nm.xxx` 会读到同一对象上的「当前值」，无法区分前后两次渲染，易误判为未变。
	// 返回 false → 不跳过渲染，避免就地更新（如 isStreaming）后 UI 仍停在旧状态（例：「正在生成中…」不消失）。
	if (prev.message === next.message) {
		return false;
	}
	const pm = prev.message;
	const nm = next.message;
	return (
		pm.chatId === nm.chatId &&
		pm.content === nm.content &&
		(pm.thinkContent ?? '') === (nm.thinkContent ?? '') &&
		pm.searchOrganic === nm.searchOrganic &&
		pm.isStreaming === nm.isStreaming &&
		pm.finishReason === nm.finishReason &&
		prev.isShowThinkContent === next.isShowThinkContent &&
		prev.isStopped === next.isStopped &&
		prev.scrollViewportRef === next.scrollViewportRef &&
		prev.onToggleThinkContent === next.onToggleThinkContent &&
		prev.onContinue === next.onContinue &&
		prev.onContinueAnswering === next.onContinueAnswering
	);
}

const ChatAssistantMessage = memo(
	ChatAssistantMessageInner,
	areChatAssistantMessageMemoPropsEqual,
);

export default ChatAssistantMessage;
