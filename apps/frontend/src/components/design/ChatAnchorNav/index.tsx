import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { ChevronDown, ChevronUp } from 'lucide-react'; // 引入图标
import { useEffect, useMemo, useState } from 'react';
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

	// 过滤出用户消息
	const userMessages = useMemo(() => {
		return messages.filter((msg) => msg.role === 'user');
	}, [messages]);

	// 监听滚动位置
	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const handleScroll = () => {
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
		};

		container.addEventListener('scroll', handleScroll);

		return () => {
			container.removeEventListener('scroll', handleScroll);
		};
	}, [userMessages, scrollContainerRef]);

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
		<div className="group absolute right-[max(calc((100%-48rem)/2-1.8rem),0rem)] top-1/2 -translate-y-1/2 z-20">
			<div className="relative flex flex-col items-center">
				{/* 上翻按钮 */}
				<div className="opacity-0 group-hover:opacity-100 mb-2">
					<Button
						className="w-6 h-6 rounded-full bg-theme/10 hover:bg-theme/20 text-textcolor/60 hover:text-textcolor"
						onClick={handlePrev}
						disabled={isPrevDisabled}
					>
						<ChevronUp className="w-4 h-4" />
					</Button>
				</div>

				{/* 锚点列表 */}
				<div className="flex flex-col items-center">
					{userMessages.map((msg) => {
						return (
							<Tooltip key={msg.chatId} side="left" content={msg.content}>
								<div
									key={msg.chatId}
									className={cn(
										'w-2 h-2 my-1 cursor-pointer rounded-full',
										'hover:scale-145 active:scale-145 transition-all duration-300',
										activeAnchor === msg.chatId
											? 'bg-blue-500 scale-145 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
											: 'bg-theme/90 hover:bg-blue-500',
									)}
									onClick={() => scrollToMessage(msg.chatId)}
								/>
							</Tooltip>
						);
					})}
				</div>

				{/* 下翻按钮 */}
				<div className="opacity-0 group-hover:opacity-100 mt-2">
					<Button
						className="w-6 h-6 rounded-full bg-theme/10 hover:bg-theme/20 text-textcolor/60 hover:text-textcolor"
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
