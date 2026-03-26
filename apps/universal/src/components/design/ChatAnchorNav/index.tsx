import Tooltip from '@design/Tooltip';
import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { ChevronDown, ChevronUp } from 'lucide-react'; // 引入图标
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Message } from '@/types/chat';

interface ChatAnchorNavProps {
	messages: Message[];
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const ChatAnchorNav = ({
	messages,
	scrollContainerRef,
}: ChatAnchorNavProps) => {
	const [activeAnchor, setActiveAnchor] = useState<string>('');

	// 用于节流的 rAF ID
	const rafIdRef = useRef<number | null>(null);
	// 锚点列表容器的 ref，用于滚动锚点列表
	const anchorListRef = useRef<HTMLDivElement | null>(null);
	// 锚点元素的 ref map，用于获取每个锚点的 DOM 元素
	const anchorItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	// 过滤出用户消息
	const userMessages = useMemo(() => {
		return messages.filter((msg) => msg.role === 'user');
	}, [messages]);

	// 计算当前锚点的核心逻辑
	const calculateActiveAnchor = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const containerRect = container.getBoundingClientRect();
		const containerCenter = containerRect.top + containerRect.height / 3;

		const userMessageElements = userMessages
			.map((msg) => ({
				id: msg.chatId,
				element: document.getElementById(`message-${msg.chatId}`),
			}))
			.filter((item) => item.element !== null);

		if (userMessageElements.length === 0) return;

		let currentAnchor = userMessageElements[0]?.id || '';

		for (let i = 0; i < userMessageElements.length; i++) {
			const { element, id } = userMessageElements[i];
			if (!element) continue;
			const rect = element.getBoundingClientRect();
			if (rect.top <= containerCenter) {
				currentAnchor = id;
			}
			if (rect.top > containerRect.bottom) {
				break;
			}
		}
		setActiveAnchor(currentAnchor);
	}, [userMessages, scrollContainerRef]);

	// 监听滚动位置 - 使用 requestAnimationFrame 节流
	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		// 使用 rAF 节流的滚动处理函数
		const handleScroll = () => {
			// 如果已经有待处理的 rAF，则跳过
			if (rafIdRef.current !== null) return;

			// 使用 requestAnimationFrame 进行节流
			// 这会自动与浏览器刷新率同步（约 60fps，即 16ms 一次）
			rafIdRef.current = requestAnimationFrame(() => {
				calculateActiveAnchor();
				rafIdRef.current = null;
			});
		};

		container.addEventListener('scroll', handleScroll, { passive: true });

		// 初始化时计算一次
		calculateActiveAnchor();

		return () => {
			// 清理事件监听
			container.removeEventListener('scroll', handleScroll);
			// 取消待处理的 rAF
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		};
	}, [calculateActiveAnchor, scrollContainerRef]);

	// 当 activeAnchor 变化时，滚动锚点列表使活动锚点可见
	useEffect(() => {
		if (!activeAnchor || !anchorListRef.current) return;

		const activeElement = anchorItemRefs.current.get(activeAnchor);
		if (!activeElement) return;

		// 获取 ScrollArea 的实际滚动容器（viewport）
		// ScrollArea 组件内部有一个 [data-radix-scroll-area-viewport] 元素
		const scrollAreaContainer = anchorListRef.current.closest(
			'[data-radix-scroll-area-viewport]',
		) as HTMLDivElement | null;
		const listContainer = scrollAreaContainer || anchorListRef.current;

		if (!listContainer) return;

		const listRect = listContainer.getBoundingClientRect();
		const elementRect = activeElement.getBoundingClientRect();

		// 检查元素是否在可视区域内
		const isAboveViewport = elementRect.top < listRect.top;
		const isBelowViewport = elementRect.bottom > listRect.bottom;

		if (isAboveViewport || isBelowViewport) {
			// 计算滚动位置，使活动锚点居中
			const elementOffsetTop = activeElement.offsetTop;
			const containerHeight = listRect.height;
			const elementHeight = elementRect.height;

			// 计算使元素居中的滚动位置
			const targetScrollTop =
				elementOffsetTop - containerHeight / 2 + elementHeight / 2;

			listContainer.scrollTo({
				top: Math.max(0, targetScrollTop),
				behavior: 'smooth',
			});
		}
	}, [activeAnchor]);

	// 滚动到指定消息
	const scrollToMessage = (chatId: string) => {
		const element = document.getElementById(`message-${chatId}`);
		if (element && scrollContainerRef.current) {
			const containerRect = scrollContainerRef.current.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			const scrollTop = scrollContainerRef.current.scrollTop;
			const offset = elementRect.top - containerRect.top + scrollTop - 20;

			scrollContainerRef.current.scrollTo({
				top: offset,
				behavior: 'smooth',
			});

			setActiveAnchor(chatId);
		}
	};

	// 切换到上一个锚点
	const handlePrev = () => {
		const currentIndex = userMessages.findIndex(
			(msg) => msg.chatId === activeAnchor,
		);
		if (currentIndex > 0) {
			const prevMsg = userMessages[currentIndex - 1];
			scrollToMessage(prevMsg.chatId);
		}
	};

	// 切换到下一个锚点
	const handleNext = () => {
		const currentIndex = userMessages.findIndex(
			(msg) => msg.chatId === activeAnchor,
		);
		// 如果当前未找到或不是最后一个，则跳转下一个
		if (currentIndex < userMessages.length - 1) {
			const nextMsg = userMessages[currentIndex + 1];
			scrollToMessage(nextMsg.chatId);
		}
	};

	if (userMessages.length < 2) return null;

	// 计算当前索引，用于判断是否禁用按钮
	const currentIndex = userMessages.findIndex(
		(msg) => msg.chatId === activeAnchor,
	);
	const isPrevDisabled = currentIndex <= 0;
	const isNextDisabled =
		currentIndex === -1 || currentIndex >= userMessages.length - 1;

	return (
		<div className="group absolute right-[max(calc((100%-48rem)/2-2.2rem),0rem)] top-1/2 -translate-y-1/2 z-20">
			<div className="relative flex flex-col items-center">
				{/* 上翻按钮 */}
				<div className="opacity-0 group-hover:opacity-100 mb-2">
					<Button
						className="w-6 h-6 rounded-full bg-black/10 hover:bg-black/20 text-black/60 hover:text-black"
						onClick={handlePrev}
						disabled={isPrevDisabled}
					>
						<ChevronUp className="w-4 h-4" />
					</Button>
				</div>

				{/* 锚点列表 */}
				<div className="flex-1 flex max-h-80 overflow-hidden">
					<ScrollArea className="flex-1 overflow-hidden w-full">
						<div
							ref={anchorListRef}
							className="flex flex-col items-center px-3 overflow-y-auto"
						>
							{userMessages.map((msg) => {
								return (
									<Tooltip key={msg.chatId} side="left" content={msg.content}>
										<div
											ref={(el) => {
												if (el) {
													anchorItemRefs.current.set(msg.chatId, el);
												} else {
													anchorItemRefs.current.delete(msg.chatId);
												}
											}}
											className={cn(
												'w-2 h-2 my-[5px] cursor-pointer rounded-full',
												'hover:scale-145 active:scale-145 transition-all duration-300',
												activeAnchor === msg.chatId
													? 'bg-blue-500 scale-145 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
													: 'bg-black/20 hover:bg-blue-500',
											)}
											onClick={() => scrollToMessage(msg.chatId)}
										/>
									</Tooltip>
								);
							})}
						</div>
					</ScrollArea>
				</div>
				{/* 下翻按钮 */}
				<div className="opacity-0 group-hover:opacity-100 mt-2">
					<Button
						className="w-6 h-6 rounded-full bg-black/10 hover:bg-black/20 text-black/60 hover:text-black"
						onClick={handleNext}
						disabled={isNextDisabled}
					>
						<ChevronDown className="w-4 h-4" />
					</Button>
				</div>
			</div>
		</div>
	);
};

export default ChatAnchorNav;
