import { ScrollArea } from '@ui/index';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { observer } from 'mobx-react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { ChatBotProps } from '@/types/chat';

const ChatBot = observer(function ChatBot(props) {
	const { className } = props;

	const scrollContainerRef = useRef<HTMLDivElement>(null);

	return (
		<div
			className={cn(
				'relative flex flex-col flex-1 w-full select-none',
				className,
			)}
		>
			<ScrollArea
				ref={scrollContainerRef}
				className="flex-1 overflow-hidden w-full backdrop-blur-sm pb-5"
			>
				<div className="max-w-3xl m-auto overflow-y-auto">
					<div className="space-y-6 overflow-hidden">
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="flex flex-col items-center justify-center h-110 text-textcolor"
						>
							<Bot className="w-16 h-16 mb-4" />
							<p className="text-2xl">欢迎来到 dnhyxc-ai 智能聊天</p>
							<p className="text-lg mt-2">有什么我可以帮您的？</p>
						</motion.div>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
});

export default ChatBot as React.FC<ChatBotProps>;
