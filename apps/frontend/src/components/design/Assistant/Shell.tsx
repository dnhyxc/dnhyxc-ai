import Loading from '@design/Loading';
import { ScrollArea } from '@/components/ui';
import { ChatCodeFloatingToolbar } from '@/hooks/useChatCodeFloatingToolbar';
import { cn } from '@/lib/utils';
import type { AssistantShellProps } from './types';

/** 智能助手通用壳：加载 / 空态 / 消息滚动区 + 稳定 footer 挂载点 */
export function AssistantShell({
	className,
	t,
	showCodeFloatingToolbar = true,
	isLoading = false,
	loadingText,
	emptyState,
	hasMessages,
	viewportRef,
	scrollAreaHandlers,
	messageList,
	listFooter,
	afterScroll,
	messageContainerClassName,
	scrollAreaClassName,
	footer,
}: AssistantShellProps) {
	return (
		<div
			className={cn(
				'relative flex h-full w-full flex-col overflow-hidden',
				className,
			)}
		>
			{showCodeFloatingToolbar ? <ChatCodeFloatingToolbar t={t} /> : null}
			<div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
				{isLoading ? (
					<div className="text-textcolor/70 flex flex-1 items-center justify-center text-sm">
						<Loading text={loadingText} />
					</div>
				) : !hasMessages ? (
					<div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
						{emptyState ?? null}
					</div>
				) : (
					<>
						<ScrollArea
							ref={viewportRef}
							className={cn(
								'min-h-0 min-w-0 w-full flex-1 mb-0.5',
								scrollAreaClassName,
							)}
							viewportClassName="pb-1 [overflow-anchor:none]"
							{...scrollAreaHandlers}
						>
							<div
								className={cn(
									'relative mx-auto flex min-h-0 w-full min-w-0 max-w-3xl flex-col px-4 pt-4 select-none',
									messageContainerClassName,
								)}
							>
								{messageList}
								{listFooter}
							</div>
						</ScrollArea>
						{afterScroll}
					</>
				)}
			</div>
			{footer ?? null}
		</div>
	);
}
