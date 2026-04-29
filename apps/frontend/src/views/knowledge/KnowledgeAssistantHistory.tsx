import { Drawer } from '@design/Drawer';
import { Button, Toast } from '@ui/index';
import { Trash2 } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import Loading from '@/components/design/Loading';
import { ScrollArea } from '@/components/ui';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import assistantStore from '@/store/assistant';

export interface KnowledgeAssistantHistoryDrawerSessionRow {
	sessionId: string;
	title?: string | null;
	updatedAt?: string | number | Date | null;
}

export interface KnowledgeAssistantHistoryDrawerProps {
	isAiSessionSwitcherLocked: boolean;
	isAiHistoryDrawerOpen: boolean;
	setIsAiHistoryDrawerOpen: Dispatch<SetStateAction<boolean>>;
	enableStreamStickToBottom: () => void;
	flushScrollToBottom: () => void;

	sessionList: KnowledgeAssistantHistoryDrawerSessionRow[];
	showInitialPlaceholder: boolean;
	showLoadMoreHint: boolean;
	showEmptyHint: boolean;

	setDeleteTargetSessionId: Dispatch<SetStateAction<string | null>>;
	setDeleteConfirmOpen: Dispatch<SetStateAction<boolean>>;
}

const KnowledgeAssistantHistoryDrawer = ({
	isAiSessionSwitcherLocked,
	isAiHistoryDrawerOpen,
	setIsAiHistoryDrawerOpen,
	enableStreamStickToBottom,
	flushScrollToBottom,
	sessionList,
	showInitialPlaceholder,
	showLoadMoreHint,
	showEmptyHint,
	setDeleteTargetSessionId,
	setDeleteConfirmOpen,
}: KnowledgeAssistantHistoryDrawerProps) => {
	return (
		<Drawer
			title="历史对话"
			open={isAiHistoryDrawerOpen}
			onOpenChange={(next) => {
				// 锁定期间禁止打开抽屉（避免在未落库时切换到其它会话）
				if (next && isAiSessionSwitcherLocked) {
					Toast({
						type: 'info',
						title: '正在保存对话，请稍后再查看历史对话',
					});
					return;
				}
				setIsAiHistoryDrawerOpen(next);
			}}
		>
			<div className="flex h-full min-h-0 flex-col">
				{/* 与 KnowledgeList Drawer 对齐：预留同样的左右 padding 区块 */}
				<div className="flex shrink-0 flex-col gap-0.5 pr-4 pl-2.5 pb-0.5" />
				<ScrollArea
					className="flex min-h-0 flex-1 flex-col pr-1.5 box-border"
					onScroll={assistantStore.onHistorySessionViewportScroll}
				>
					<div className="flex min-h-0 w-full flex-1 flex-col gap-2">
						{showInitialPlaceholder ? (
							<div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-sm text-textcolor/60">
								<Loading text="加载中…" />
							</div>
						) : null}
						{sessionList.map((s) => {
							const active = assistantStore.activeSessionId === s.sessionId;
							const isStreaming = assistantStore.isSessionStreaming(
								s.sessionId,
							);
							const title = s.title?.trim()
								? s.title.trim()
								: `对话 ${s.sessionId.slice(0, 8)}`;
							return (
								<div
									key={s.sessionId}
									className={cn(
										'group relative cursor-pointer w-full text-left rounded-md px-2.5 py-2 hover:bg-theme/10 transition-colors',
										active ? 'bg-theme/10' : '',
									)}
									onClick={() => {
										void assistantStore
											.switchSessionForCurrentDocument(s.sessionId)
											.then(() => {
												setIsAiHistoryDrawerOpen(false);
												enableStreamStickToBottom();
												flushScrollToBottom();
												requestAnimationFrame(() => flushScrollToBottom());
											});
									}}
								>
									{isStreaming ? (
										<span className="absolute right-2 top-2 flex items-center justify-center h-7 w-7 rounded-md text-textcolor/60">
											<Spinner className="size-4 text-textcolor/60" />
										</span>
									) : (
										<Button
											variant="link"
											className="cursor-pointer absolute right-2 top-2 hidden group-hover:flex items-center justify-center h-7 w-7 rounded-md text-textcolor/70 hover:text-red-500 hover:bg-red-500/10"
											aria-label="删除对话"
											onClick={(e) => {
												e.stopPropagation();
												setDeleteTargetSessionId(s.sessionId);
												setDeleteConfirmOpen(true);
											}}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									)}
									<div className="text-sm text-textcolor line-clamp-1">
										{title}
									</div>
									<div className="text-xs text-textcolor/50 mt-1">
										{s.updatedAt ? new Date(s.updatedAt).toLocaleString() : ''}
									</div>
								</div>
							);
						})}
						{showLoadMoreHint ? (
							<div className="text-xs text-textcolor/50 py-2 text-center">
								加载更多…
							</div>
						) : null}
						{showEmptyHint ? (
							<div className="text-sm text-textcolor/60 py-8 text-center">
								暂无知识库条目
							</div>
						) : null}
					</div>
				</ScrollArea>
			</div>
		</Drawer>
	);
};

export default KnowledgeAssistantHistoryDrawer;
