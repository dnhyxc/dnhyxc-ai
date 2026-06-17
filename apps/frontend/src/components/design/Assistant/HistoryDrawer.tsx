import { Drawer } from '@design/Drawer';
import { Button, Toast } from '@ui/index';
import { Trash2 } from 'lucide-react';
import Loading from '@/components/design/Loading';
import { ScrollArea } from '@/components/ui';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type {
	AssistantEntryToolbarHistoryInject,
	AssistantHistoryDrawerActions,
} from './types';

export type AssistantHistoryDrawerProps = AssistantEntryToolbarHistoryInject &
	AssistantHistoryDrawerActions & {
		drawerTitle?: string;
		lockedToast?: string;
	};

/**
 * 助手会话历史抽屉：列表、切换、删除入口、滚动分页占位。
 * Store 与路由逻辑由 `historyActions` 注入，供知识库 / 电子书 / 英语学习共用。
 */
export function AssistantHistoryDrawer({
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
	activeSessionId,
	isSessionStreaming,
	onSwitchSession,
	onViewportScroll,
	closeDrawerBeforeSwitch = false,
	drawerTitle,
	lockedToast,
}: AssistantHistoryDrawerProps) {
	const { t } = useI18n();
	const title = drawerTitle ?? t('knowledge.assistant.history');
	const lockedMessage =
		lockedToast ?? t('knowledge.assistant.sessionSavingViewHistory');

	const handleSelectSession = (sessionId: string) => {
		const runSwitch = () => {
			void Promise.resolve(onSwitchSession(sessionId)).then(() => {
				enableStreamStickToBottom();
				flushScrollToBottom();
				requestAnimationFrame(() => flushScrollToBottom());
			});
		};

		if (closeDrawerBeforeSwitch) {
			setIsHistoryDrawerOpen(false);
			runSwitch();
		} else {
			runSwitch();
			setIsHistoryDrawerOpen(false);
		}
	};

	return (
		<Drawer
			title={title}
			open={isHistoryDrawerOpen}
			onOpenChange={(next) => {
				if (next && isSessionSwitcherLocked) {
					Toast({ type: 'info', title: lockedMessage });
					return;
				}
				setIsHistoryDrawerOpen(next);
			}}
		>
			<div className="flex h-full min-h-0 flex-col">
				<div className="flex shrink-0 flex-col gap-0.5 pr-4 pl-2.5 pb-0.5" />
				<ScrollArea
					className="box-border flex min-h-0 flex-1 flex-col pr-1.5"
					onScroll={onViewportScroll}
				>
					<div className="flex min-h-0 w-full flex-1 flex-col gap-2">
						{showInitialPlaceholder ? (
							<div className="text-textcolor/60 flex flex-1 flex-col items-center justify-center py-6 text-center text-sm">
								<Loading text={t('common.loading')} />
							</div>
						) : null}
						{sessionList.map((s) => {
							const active = activeSessionId === s.sessionId;
							const isStreaming = isSessionStreaming(s.sessionId);
							const rowTitle = s.title?.trim()
								? s.title.trim()
								: t('knowledge.assistant.conversationFallback', {
										id: s.sessionId.slice(0, 8),
									});
							return (
								<div
									key={s.sessionId}
									className={cn(
										'group flex w-full cursor-pointer items-start rounded-md px-2.5 py-2 text-left transition-colors hover:bg-theme/10',
										active ? 'bg-theme/10' : '',
									)}
									onClick={() => handleSelectSession(s.sessionId)}
								>
									<div className="min-w-0 flex-1">
										<div className="text-textcolor line-clamp-1 text-sm">
											{rowTitle}
										</div>
										<div className="text-textcolor/50 mt-1 text-xs">
											{s.updatedAt
												? new Date(s.updatedAt).toLocaleString()
												: ''}
										</div>
									</div>
									<div
										className={cn(
											'flex h-7 shrink-0 items-center justify-center self-start overflow-hidden',
											isStreaming ? 'w-7' : 'w-0 group-hover:w-7',
										)}
									>
										{isStreaming ? (
											<Spinner className="text-textcolor/60 size-4 shrink-0" />
										) : (
											<Button
												variant="link"
												className="text-textcolor/70 hover:text-rose-500 hover:bg-rose-500/10 hidden h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md group-hover:flex"
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
									</div>
								</div>
							);
						})}
						{showLoadMoreHint ? (
							<div className="col-span-full text-textcolor/50 flex items-center justify-center gap-1.5 py-2 text-xs">
								<Spinner className="size-3.5 text-textcolor/50" aria-hidden />
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
}
