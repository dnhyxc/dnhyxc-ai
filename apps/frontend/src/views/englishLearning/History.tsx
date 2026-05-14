/**
 * 英语学习 Agent 历史抽屉：交互对齐 `KnowledgeAssistantHistory`（滚动加载、切换不关 SSE）。
 */

import { Drawer } from '@design/Drawer';
import { Button, Toast } from '@ui/index';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react';
import type { Dispatch, SetStateAction } from 'react';
import { useSearchParams } from 'react-router';
import Loading from '@/components/design/Loading';
import { ScrollArea } from '@/components/ui';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import englishAgentStore from '@/store/englishAgent';

export type EnglishLearningAgentHistorySessionRow = {
	sessionId: string;
	title?: string | null;
	updatedAt?: string | number | Date | null;
};

export interface EnglishLearningAgentHistoryProps {
	isSessionSwitcherLocked: boolean;
	isHistoryDrawerOpen: boolean;
	setIsHistoryDrawerOpen: Dispatch<SetStateAction<boolean>>;
	enableStreamStickToBottom: () => void;
	flushScrollToBottom: () => void;

	sessionList: EnglishLearningAgentHistorySessionRow[];
	showInitialPlaceholder: boolean;
	showLoadMoreHint: boolean;
	showEmptyHint: boolean;

	setDeleteTargetSessionId: Dispatch<SetStateAction<string | null>>;
	setDeleteConfirmOpen: Dispatch<SetStateAction<boolean>>;
}

const History = observer(function EnglishLearningAgentHistory(
	props: EnglishLearningAgentHistoryProps,
) {
	const {
		isSessionSwitcherLocked,
		isHistoryDrawerOpen,
		setIsHistoryDrawerOpen,
		enableStreamStickToBottom,
		flushScrollToBottom,
		sessionList,
		showInitialPlaceholder,
		showLoadMoreHint,
		showEmptyHint,
		setDeleteTargetSessionId,
		setDeleteConfirmOpen,
	} = props;
	const { t } = useI18n();
	const [, setSearchParams] = useSearchParams();
	return (
		<Drawer
			title={t('knowledge.assistant.history')}
			open={isHistoryDrawerOpen}
			onOpenChange={(next) => {
				if (next && isSessionSwitcherLocked) {
					Toast({
						type: 'info',
						title: t('knowledge.assistant.sessionSavingViewHistory'),
					});
					return;
				}
				setIsHistoryDrawerOpen(next);
			}}
		>
			<div className="flex h-full min-h-0 flex-col">
				<div className="flex shrink-0 flex-col gap-0.5 pr-4 pl-2.5 pb-0.5" />
				<ScrollArea
					className="box-border flex min-h-0 flex-1 flex-col pr-1.5"
					onScroll={englishAgentStore.onHistorySessionViewportScroll}
				>
					<div className="flex min-h-0 w-full flex-1 flex-col gap-2">
						{showInitialPlaceholder ? (
							<div className="text-textcolor/60 flex flex-1 flex-col items-center justify-center py-6 text-center text-sm">
								<Loading text={t('common.loading')} />
							</div>
						) : null}
						{sessionList.map((s) => {
							const active = englishAgentStore.activeSessionId === s.sessionId;
							const isStreaming = englishAgentStore.isSessionStreaming(
								s.sessionId,
							);
							const title = s.title?.trim()
								? s.title.trim()
								: t('knowledge.assistant.conversationFallback', {
										id: s.sessionId.slice(0, 8),
									});
							return (
								<div
									key={s.sessionId}
									className={cn(
										'group relative w-full cursor-pointer rounded-md px-2.5 py-2 text-left transition-colors hover:bg-theme/10',
										active ? 'bg-theme/10' : '',
									)}
									onClick={() => {
										// 先关抽屉再切会话与同步 URL，避免 Sheet 仍打开时路由/MobX 大重绘与 Radix 关闭动画抢帧导致抖动
										setIsHistoryDrawerOpen(false);
										void englishAgentStore
											.switchSession(s.sessionId)
											.then(() => {
												setSearchParams(
													{ session: s.sessionId },
													{ replace: true },
												);
												enableStreamStickToBottom();
												flushScrollToBottom();
												requestAnimationFrame(() => flushScrollToBottom());
											});
									}}
								>
									{isStreaming ? (
										<span className="text-textcolor/60 absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-md">
											<Spinner className="text-textcolor/60 size-4" />
										</span>
									) : (
										<Button
											variant="link"
											className="text-textcolor/70 hover:text-red-500 hover:bg-red-500/10 absolute top-2 right-2 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-md group-hover:flex"
											aria-label={t(
												'knowledge.assistant.deleteConversationTitle',
											)}
											onClick={(e) => {
												e.stopPropagation();
												setDeleteTargetSessionId(s.sessionId);
												setDeleteConfirmOpen(true);
											}}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									)}
									<div className="text-textcolor line-clamp-1 text-sm">
										{title}
									</div>
									<div className="text-textcolor/50 mt-1 text-xs">
										{s.updatedAt ? new Date(s.updatedAt).toLocaleString() : ''}
									</div>
								</div>
							);
						})}
						{showLoadMoreHint ? (
							<div className="text-textcolor/50 py-2 text-center text-xs">
								{t('common.loadingMore')}
							</div>
						) : null}
						{showEmptyHint ? (
							<div className="text-textcolor/60 py-8 text-center text-sm">
								{t('knowledge.assistant.historyEmpty')}
							</div>
						) : null}
					</div>
				</ScrollArea>
			</div>
		</Drawer>
	);
});

export default History;
