/**
 * 助手消息气泡：正文与思考过程使用 md-editor-rt（MdPreview），单条即较重。
 * 性能策略：非流式消息在离开视口时不立即挂载 MdPreview，用 IntersectionObserver + 几何预判，
 * 避免分支切换时数百条编辑器同步初始化卡死主线程（非虚拟列表，DOM 仍保留）。
 */

import { MarkdownParser } from '@dnhyxc-ai/tools';
import { Spinner } from '@ui/index';
import { ChevronDown, ChevronRight } from 'lucide-react';
// memo：父级重渲染时若 props 判定相等则跳过本组件，减少与 PlainTextFallback / MdPreview 的协调成本
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Message } from '@/types/chat';
import { applyOrganicCitationAnchors } from '@/utils/organicCitation';

// 扩大「可见」判定范围，用户快速滚动时先一步挂载 MdPreview，减轻从纯文本切到排版的闪烁感
const LAZY_ROOT_MARGIN = '360px 0px 520px 0px';
// 子组件先于 ScrollArea 挂载时 viewport ref 可能仍为 null，用 rAF 轮询等待，超过帧数则降级为立即富文本，避免永远纯文本
const MAX_VIEWPORT_WAIT_FRAMES = 90;

interface AssistantMessageProps {
	message: Message;
	isShowThinkContent: boolean;
	onToggleThinkContent: () => void;
	onContinue: () => void;
	onContinueAnswering?: (message?: Message) => void;
	isStopped?: boolean;
	/**
	 * 与 ChatBot 里 ScrollArea 转发的 ref 一致（实际指向 Radix Viewport，即可滚动元素）。
	 * 有值：启用「进视口才挂 MdPreview」；无值：保持旧行为，始终富文本（兼容其它调用方）。
	 */
	scrollViewportRef?: React.RefObject<HTMLElement | null>;
}

/**
 * MdPreview 未挂载时的占位：无 Markdown 解析、无代码高亮，仅排版纯文本，成本极低。
 */
// function PlainTextFallback({ text }: { text: string }) {
// 	return (
// 		// text-[15px]：与正文区域视觉接近；whitespace-pre-wrap：保留换行；wrap-break-word：长串不换行溢出
// 		<div className="text-textcolor/90 text-[15px] leading-relaxed whitespace-pre-wrap wrap-break-word">
// 			{/* 空字符串时给不间断空格，避免 div 高度塌成 0 */}
// 			{text.length ? text : '\u00a0'}
// 		</div>
// 	);
// }

/**
 * 同步判断「元素矩形是否与视口（上下各扩 marginY）有交集」，不等待 IntersectionObserver 回调，
 * 分支切换后已在屏内的气泡可同一帧内直接 richReady，减少闪一下纯文本再变 Markdown。
 */
function elementNearViewport(
	el: HTMLElement,
	root: HTMLElement,
	marginY: number,
): boolean {
	const r = el.getBoundingClientRect(); // 气泡相对视口的位置
	const vr = root.getBoundingClientRect(); // 滚动视口相对视口的位置（通常 root 即聊天区 viewport）
	// 纵向扩展 marginY 像素后判断是否重叠：底边仍在扩展示口顶之上、顶边仍在扩展示口底之下
	return r.bottom >= vr.top - marginY && r.top <= vr.bottom + marginY;
}

function ChatAssistantMessageInner({
	message,
	isShowThinkContent,
	onToggleThinkContent,
	onContinue,
	onContinueAnswering,
	isStopped,
	scrollViewportRef,
}: AssistantMessageProps) {
	// 挂在外层 div，作为 IntersectionObserver 的 observe 目标，覆盖整条助手气泡
	const shellRef = useRef<HTMLDivElement>(null);
	const [richReady, setRichReady] = useState(() =>
		Boolean(message.isStreaming),
	);

	const parser = useMemo(() => {
		return new MarkdownParser();
	}, []);
	// ↑ false：正文/思考走 PlainTextFallback；true：挂 MdPreview。初始：流式须立刻 true 跟 token；非流式 false 可走视口懒加载减主线程压力

	// 随 isStreaming：一旦流式则强制 richReady（中途转流式/首屏滞后时避免半段纯文本）
	useEffect(() => {
		if (message.isStreaming) {
			setRichReady(true);
		}
	}, [message.isStreaming]);

	// 非流式 + 未就绪 + 有 viewport ref：注册懒加载；流式或已就绪则短路
	useEffect(() => {
		// 流式阶段由上一 effect 保证 richReady，本 effect 不注册 Observer，避免重复监听
		if (message.isStreaming) {
			return;
		}
		// 已经升级为 MdPreview 后无需再监听；依赖项含 richReady，升级后会 cleanup 并在此 return
		if (richReady) {
			return;
		}
		if (!scrollViewportRef) {
			// 无 root 无法 IO → 退化为始终富文本（与历史行为一致，兼容未传 ref 的调用方）
			setRichReady(true);
			return;
		}

		const el = shellRef.current;
		if (!el) {
			// 首帧 ref 未挂 DOM：略过；依赖变化会再跑 effect，不会永久不监听
			return;
		}

		let cancelled = false; // cleanup 后置 true，避免异步回调里 setState
		let raf = 0; // requestAnimationFrame 句柄，cleanup 时 cancel
		let framesWaited = 0; // 已等待 viewport ref 的帧数
		let io: IntersectionObserver | null = null; // 懒加载观察器，upgrade 后 disconnect

		const upgrade = () => {
			if (cancelled) return;
			setRichReady(true); // 触发重渲染，正文与思考区切换为 MdPreview
			io?.disconnect(); // 释放观察，避免泄漏与重复回调
		};

		const trySetup = () => {
			if (cancelled) return;
			const root = scrollViewportRef.current;
			// Viewport 尚未挂载：下一帧再试，防止无限等待用 MAX_VIEWPORT_WAIT_FRAMES 兜底
			if (!root) {
				framesWaited += 1;
				if (framesWaited > MAX_VIEWPORT_WAIT_FRAMES) {
					upgrade();
					return;
				}
				raf = requestAnimationFrame(trySetup);
				return;
			}

			if (elementNearViewport(el, root, 520)) {
				// 已在扩展示口内（520 与 rootMargin 纵向扩张同量级）：直接 upgrade，少一帧纯文本闪烁
				upgrade();
				return;
			}

			// 默认路径：监听进入视口（含 rootMargin）后再挂载 MdPreview
			io = new IntersectionObserver(
				(entries) => {
					if (cancelled) return;
					if (entries.some((e) => e.isIntersecting)) {
						upgrade();
					}
				},
				{ root, rootMargin: LAZY_ROOT_MARGIN, threshold: 0 },
			);
			io.observe(el);
		};

		trySetup();

		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			io?.disconnect();
		};
		// chatId 变：新气泡重新走懒加载；isStreaming 变：与上一 effect 协同；richReady 变：升级后卸载监听
	}, [message.chatId, message.isStreaming, scrollViewportRef, richReady]);

	// 正文：流式阶段后端仍推送原始 [n]，有 searchOrganic 时在前端做与落库相同的引用转换
	const bodyText = useMemo(() => {
		const raw = message.content || (message?.thinkContent ? '' : '思考中...');
		const org = message.searchOrganic;
		if (!org?.length || raw === '思考中...') {
			return raw;
		}
		return applyOrganicCitationAnchors(raw, org);
	}, [message.content, message.thinkContent, message.searchOrganic]);

	return (
		<div
			ref={shellRef} // IO 观察目标：整条气泡（思考区+正文+操作区），进视口判定与此一致
			className="w-full h-auto"
		>
			{message?.searchOrganic && message.searchOrganic?.length > 0 && (
				<div className="text-sm text-textcolor/50">
					已阅读 {message.searchOrganic?.length} 个网页
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
					// richReady ? (
					// 	<MarkdownPreview
					// 		value={message.thinkContent || '思考中...'}
					// 		theme="dark"
					// 		className="h-auto p-0"
					// 		background="transparent"
					// 		padding="0"
					// 	/>
					// ) : (
					// 	<PlainTextFallback text={message.thinkContent} />
					// )
					<div
						dangerouslySetInnerHTML={{
							__html: parser.render(message.thinkContent),
						}}
					/>
				) : null}
			</div>
			{/* 主回答区：与思考区相同的懒加载策略 */}
			{/* {richReady ? (
				<MarkdownPreview
					value={bodyText}
					theme="dark"
					className="h-auto p-0"
					background="transparent"
					padding="0"
				/>
			) : (
				<PlainTextFallback text={bodyText} />
			)} */}
			<div dangerouslySetInnerHTML={{ __html: parser.render(bodyText) }} />

			{message.isStreaming && (
				<div className="mt-1 flex items-center">
					<Spinner className="w-4 h-4 mr-2 text-textcolor/50" />
					<span className="text-sm text-textcolor/50">正在生成中...</span>
				</div>
			)}
			{isStopped && (
				<div className="flex items-center justify-end">
					<div
						className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300 select-none"
						onClick={onContinue}
					>
						继续生成
					</div>
				</div>
			)}
			{message?.finishReason?.maxTokensReached && (
				<div className="flex items-center justify-end">
					超出最大输出长度，
					<div
						className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300 select-none"
						onClick={() => onContinueAnswering?.(message)}
					>
						点击接着回答
					</div>
				</div>
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
