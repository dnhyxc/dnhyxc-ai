/**
 * 助手消息气泡：正文与思考过程使用 md-editor-rt（MdPreview），单条即较重。
 * 性能策略：非流式消息在离开视口时不立即挂载 MdPreview，用 IntersectionObserver + 几何预判，
 * 避免分支切换时数百条编辑器同步初始化卡死主线程（非虚拟列表，DOM 仍保留）。
 */

import { MarkdownParser } from '@dnhyxc-ai/tools';
import { Button, Spinner } from '@ui/index';
import {
	ChevronDown,
	ChevronRight,
	Earth,
	Rotate3d,
	SearchIcon,
} from 'lucide-react';
// memo：父级重渲染时若 props 判定相等则跳过本组件，减少与 PlainTextFallback / MdPreview 的协调成本
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getChatMarkdownHighlightTheme } from '@/constant';
import { useTheme } from '@/hooks/theme';
import { useMermaidInMarkdownRoot } from '@/hooks/useMermaidInMarkdownRoot';
import { cn } from '@/lib/utils';
import { Message, SearchOrganicItem } from '@/types/chat';
import {
	downloadChatCodeBlock,
	getChatCodeBlockPlainText,
} from '@/utils/chatCodeToolbar';
import { openExternalUrl } from '@/utils/open-external';
import {
	applyOrganicCitationAnchors,
	findClosestOrganicCitationAnchor,
	findOrganicCitationAnchorAtPoint,
	resolveSearchOrganicFromCitationAnchor,
} from '@/utils/organicCitation';
import SearchOrganics from './SearchOrganics';

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

interface AssistantMessageProps {
	message: Message;
	isShowThinkContent?: boolean;
	onToggleThinkContent?: () => void;
	onContinue?: () => void;
	onContinueAnswering?: (message?: Message) => void;
	isStopped?: boolean;
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
	// scrollViewportRef,
	className,
}: AssistantMessageProps) {
	const { theme: appTheme } = useTheme();
	// 挂在外层 div，作为 IntersectionObserver 的 observe 目标，覆盖整条助手气泡
	const shellRef = useRef<HTMLDivElement>(null);
	const bodyMarkdownRef = useRef<HTMLDivElement>(null);
	const previewBubbleRef = useRef<HTMLDivElement>(null);
	/** 与当前预览绑定的角标节点；同 position 多出处时需区分，否则会沿用旧 rect 导致气泡跑偏 */
	const organicPreviewAnchorRef = useRef<HTMLAnchorElement | null>(null);
	const previewLeaveTimerRef = useRef(0);
	const [open, setOpen] = useState(false);
	/** 按角标矩形定位；同一条引用在 pointermove 内不重复 setState，避免气泡跟手抖 */
	const [organicPreview, setOrganicPreview] = useState<{
		item: SearchOrganicItem;
		anchorRect: OrganicAnchorRect;
	} | null>(null);

	const parser = useMemo(
		() =>
			new MarkdownParser({
				enableChatCodeFenceToolbar: true,
				highlightTheme: getChatMarkdownHighlightTheme(appTheme),
			}),
		[appTheme],
	);

	// 正文：流式阶段后端仍推送原始 [n]，有 searchOrganic 时在前端做与落库相同的引用转换
	const bodyText = useMemo(() => {
		const raw = message.content || (message?.thinkContent ? '' : '思考中...');
		const org = message.searchOrganic;
		if (!org?.length || raw === '思考中...') {
			return raw;
		}
		return applyOrganicCitationAnchors(raw, org);
	}, [message.content, message.thinkContent, message.searchOrganic]);

	useMermaidInMarkdownRoot(
		shellRef,
		appTheme === 'black',
		`${bodyText}\0${message.thinkContent ?? ''}\0${String(isShowThinkContent)}`,
	);

	useEffect(() => {
		const el = shellRef.current;
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

	const clearOrganicPreviewLeaveTimer = useCallback(() => {
		if (previewLeaveTimerRef.current) {
			window.clearTimeout(previewLeaveTimerRef.current);
			previewLeaveTimerRef.current = 0;
		}
	}, []);

	const closeOrganicPreviewNow = useCallback(() => {
		clearOrganicPreviewLeaveTimer();
		organicPreviewAnchorRef.current = null;
		setOrganicPreview(null);
	}, [clearOrganicPreviewLeaveTimer]);

	const scheduleHideOrganicPreview = () => {
		clearOrganicPreviewLeaveTimer();
		previewLeaveTimerRef.current = window.setTimeout(() => {
			organicPreviewAnchorRef.current = null;
			setOrganicPreview(null);
		}, 180);
	};

	// 点击预览气泡，在新标签页中打开链接
	const onClickOrganicPreview = useCallback(() => {
		if (!organicPreview) return;
		void openExternalUrl(organicPreview.item.link);
	}, [organicPreview]);

	// 正文内 Serper 引用：悬停/在链接上移动时跟随指针展示摘要（不量锚点）
	useEffect(() => {
		const root = bodyMarkdownRef.current;
		const organics = message.searchOrganic;
		if (!root || !organics?.length) {
			return;
		}

		const applyIfCitation = (e: PointerEvent) => {
			let a = findClosestOrganicCitationAnchor(e.target, root, organics);
			if (!a) {
				a = findOrganicCitationAnchorAtPoint(
					root,
					organics,
					e.clientX,
					e.clientY,
				);
			}
			if (!a) return;
			const item = resolveSearchOrganicFromCitationAnchor(a, organics);
			if (!item) return;
			clearOrganicPreviewLeaveTimer();
			setOrganicPreview((prev) => {
				if (
					prev &&
					prev.item.position === item.position &&
					organicPreviewAnchorRef.current === a
				) {
					return prev;
				}
				organicPreviewAnchorRef.current = a;
				return { item, anchorRect: snapshotOrganicAnchorRect(a) };
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
			organicPreviewAnchorRef.current = null;
			root.removeEventListener('pointerover', applyIfCitation);
			root.removeEventListener('pointermove', applyIfCitation);
			root.removeEventListener('pointerout', onPointerOut);
		};
	}, [message.searchOrganic, bodyText, clearOrganicPreviewLeaveTimer]);

	const prevBodyTextRef = useRef(bodyText);

	useEffect(() => {
		if (prevBodyTextRef.current === bodyText) return;
		prevBodyTextRef.current = bodyText;
		closeOrganicPreviewNow();
	}, [bodyText, closeOrganicPreviewNow]);

	useEffect(() => {
		if (!message.searchOrganic?.length) {
			closeOrganicPreviewNow();
		}
	}, [message.searchOrganic, closeOrganicPreviewNow]);

	const popoverPos = useMemo(() => {
		if (!organicPreview) return null;
		return layoutOrganicPopoverForAnchor(organicPreview.anchorRect);
	}, [organicPreview]);

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
					<div>已阅读 {message.searchOrganic?.length} 个网页</div>
				</div>
			)}
			<div className="w-full">
				{message?.thinkContent ? (
					<div
						className="mb-2 flex items-center cursor-pointer select-none"
						onClick={onToggleThinkContent}
					>
						思考过程
						{isShowThinkContent ? (
							<ChevronDown size={20} className="ml-2 mt-0.5" />
						) : (
							<ChevronRight size={20} className="ml-2 mt-0.5" />
						)}
					</div>
				) : null}
				{/* 思考展开且存在 thinkContent：richReady 前纯文本，就绪后 MdPreview */}
				{message.thinkContent && isShowThinkContent ? (
					<div
						dangerouslySetInnerHTML={{
							__html: parser.render(message.thinkContent),
						}}
						className={cn(`[&_.markdown-body]:text-textcolor/90!`, className)}
					/>
				) : null}
			</div>
			<div
				ref={bodyMarkdownRef}
				dangerouslySetInnerHTML={{ __html: parser.render(bodyText) }}
				className={cn(`[&_.markdown-body]:text-textcolor/90!`, className)}
			/>
			{message.isStreaming && (
				<div className="mt-2.5 flex items-center">
					<Spinner className="w-4 h-4 mr-2 text-textcolor/50" />
					<span className="text-sm text-textcolor/50">正在生成中...</span>
				</div>
			)}
			{message?.searchOrganic &&
				message.searchOrganic?.length > 0 &&
				!message.isStreaming && (
					<div className="flex items-center justify-end text-[13px] text-textcolor/50 my-3 italic">
						本回答由 AI 生成，内容仅供参考，请仔细甄别
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
								{message.searchOrganic?.length} 个网页
							</Button>
						)}
					{!isStopped && (
						<Button
							variant="dynamic"
							className="border border-theme/10 h-8.5 flex items-center ml-3 cursor-pointer text-sm text-teal-400 hover:text-teal-300 select-none bg-theme/5 hover:bg-theme/10 py-1.5 px-3 rounded-md"
							onClick={onContinue}
						>
							<Rotate3d size={16} />
							继续生成
						</Button>
					)}
				</div>
			)}
			{message?.finishReason?.maxTokensReached && (
				<div className="flex items-center justify-end">
					超出最大输出长度，
					<div
						className="cursor-pointer text-sm text-teal-400 hover:text-teal-300 select-none"
						onClick={() => onContinueAnswering?.(message)}
					>
						点击接着回答
					</div>
				</div>
			)}
			<SearchOrganics
				open={open}
				onOpenChange={() => setOpen(false)}
				organics={message.searchOrganic || []}
			/>
			{organicPreview &&
				popoverPos &&
				createPortal(
					<div
						ref={previewBubbleRef}
						role="tooltip"
						className="pointer-events-auto cursor-pointer fixed z-10050 w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-theme-white/10 bg-theme-background/95 p-3 text-left shadow-lg backdrop-blur-md"
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
						{/* 与 SearchOrganics 列表项排版、字号一致 */}
						<div className="flex flex-col gap-2">
							<div className="flow-root">
								<div className="float-left flex items-center gap-2">
									<span className="bg-theme/20 text-textcolor rounded-full text-sm w-5.5 h-5.5 p-2 flex items-center justify-center">
										{organicPreview.item.position}
									</span>
									{organicPreview.item.date ? (
										<span className="text-textcolor/50 text-base">
											{organicPreview.item.date}
										</span>
									) : null}
								</div>
								<span className="wrap-break-word ml-3">
									{organicPreview.item.title}
								</span>
							</div>
							{organicPreview.item.snippet ? (
								<div className="text-sm text-textcolor/70">
									{organicPreview.item.snippet}
								</div>
							) : null}
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
}

// 全为 true 则跳过渲染：减列表 reconcile、避免 MdPreview 子树反复卸载/重建
const ChatAssistantMessage = memo(
	ChatAssistantMessageInner,
	(prev, next) =>
		prev.message.chatId === next.message.chatId &&
		prev.message.content === next.message.content && // 正文未变 → 子 Markdown memo 也可跳过
		(prev.message.thinkContent ?? '') === (next.message.thinkContent ?? '') &&
		prev.message.searchOrganic === next.message.searchOrganic &&
		prev.message.isStreaming === next.message.isStreaming && // 懒加载分支 + 底部「正在生成…」
		prev.message.finishReason === next.message.finishReason &&
		prev.isShowThinkContent === next.isShowThinkContent &&
		prev.isStopped === next.isStopped &&
		prev.scrollViewportRef === next.scrollViewportRef && // ref 变须重绑 IntersectionObserver
		prev.onToggleThinkContent === next.onToggleThinkContent && // 回调引用稳定，避免闭包过期
		prev.onContinue === next.onContinue &&
		prev.onContinueAnswering === next.onContinueAnswering,
);

export default ChatAssistantMessage;
