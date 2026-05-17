/**
 * 英语学习 Agent 输入区工具条：历史抽屉 + 新对话（逻辑对齐 `KnowledgeAssistantEntryToolbar`，无 RAG 切换）。
 */
import Confirm from '@design/Confirm';
import { Button, Toast } from '@ui/index';
import { CirclePlus, Clock } from 'lucide-react';
import { observer } from 'mobx-react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import englishAgentStore from '@/store/englishAgent';
import History from './History';

export interface EntryToolbarProps {
	showSessionActions: boolean;
	isSessionSwitcherLocked: boolean;
	isHistoryDrawerOpen: boolean;
	setIsHistoryDrawerOpen: Dispatch<SetStateAction<boolean>>;
	enableStreamStickToBottom: () => void;
	flushScrollToBottom: () => void;
	onNewConversation: () => void | Promise<void>;
}

export const EntryToolbar = observer(function EntryToolbar({
	showSessionActions,
	isSessionSwitcherLocked,
	isHistoryDrawerOpen,
	setIsHistoryDrawerOpen,
	enableStreamStickToBottom,
	flushScrollToBottom,
	onNewConversation,
}: EntryToolbarProps) {
	const { t } = useI18n();
	const sessionList = englishAgentStore.sessionList;
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [deleteTargetSessionId, setDeleteTargetSessionId] = useState<
		string | null
	>(null);
	const showInitialPlaceholder =
		englishAgentStore.historySessionLoading && sessionList.length === 0;
	const showLoadMoreHint = englishAgentStore.historySessionLoadingMore;
	const showEmptyHint =
		!englishAgentStore.historySessionLoading &&
		sessionList.length === 0 &&
		!englishAgentStore.historySessionLoadingMore;

	const deleteTargetTitle = useMemo(() => {
		if (!deleteTargetSessionId) return '';
		const row = sessionList.find((s) => s.sessionId === deleteTargetSessionId);
		return row?.title?.trim()
			? row.title.trim()
			: t('knowledge.assistant.conversationFallback', {
					id: deleteTargetSessionId.slice(0, 8),
				});
	}, [deleteTargetSessionId, sessionList, t]);

	const onConfirmDelete = useCallback(async () => {
		if (!deleteTargetSessionId) return;
		await englishAgentStore.deleteSession(deleteTargetSessionId);
		setDeleteConfirmOpen(false);
		setDeleteTargetSessionId(null);
	}, [deleteTargetSessionId]);

	return (
		<div className="inline-flex max-w-0 items-center pb-1">
			<Confirm
				open={deleteConfirmOpen}
				onOpenChange={(v) => {
					setDeleteConfirmOpen(v);
					if (!v) setDeleteTargetSessionId(null);
				}}
				title={t('knowledge.assistant.deleteConversationTitle')}
				description={
					<div className="text-left">
						{t('knowledge.assistant.deleteConversationDesc')}
						{deleteTargetTitle ? (
							<div className="mt-2 text-base font-medium wrap-anywhere">
								{t('knowledge.assistant.conversationNameLabel', {
									name: deleteTargetTitle,
								})}
							</div>
						) : null}
					</div>
				}
				descriptionClassName="text-left"
				confirmText={t('common.delete')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={onConfirmDelete}
				onCancel={() => {
					setDeleteConfirmOpen(false);
					setDeleteTargetSessionId(null);
				}}
			/>
			{showSessionActions ? (
				<div className="inline-flex items-center gap-2">
					<Button
						size="sm"
						variant="link"
						className="lucide-stroke-draw-hover text-textcolor/80 hover:bg-theme/10 hover:text-teal-500 w-fit rounded-md border border-theme/10 px-3 py-1.5 text-sm transition-colors"
						disabled={isSessionSwitcherLocked}
						onClick={() => {
							if (isSessionSwitcherLocked) {
								Toast({
									type: 'info',
									title: t('knowledge.assistant.sessionSaving'),
								});
								return;
							}
							setIsHistoryDrawerOpen(false);
							englishAgentStore.beginNewConversationDraft();
							void onNewConversation();
						}}
					>
						<CirclePlus />
						{t('knowledge.assistant.newConversation')}
					</Button>
					<Button
						variant="link"
						className="lucide-stroke-draw-hover text-textcolor/80 flex items-center text-sm hover:bg-theme/10 border border-theme/10 h-8 rounded-md [&_svg]:overflow-visible hover:text-teal-500"
						aria-label={t('englishLearning.vocab.historyOpenDrawer')}
						disabled={isSessionSwitcherLocked}
						onClick={() => {
							if (isSessionSwitcherLocked) {
								Toast({
									type: 'info',
									title:
										t?.('englishLearning.vocab.historyOpenDrawer') ??
										'历史记录',
								});
								return;
							}
							setIsHistoryDrawerOpen(true);
						}}
					>
						<Clock className="h-4 w-4" />
						{t?.('englishLearning.vocab.historyOpenDrawer') ?? '历史记录'}
					</Button>
				</div>
			) : null}
			<History
				isSessionSwitcherLocked={isSessionSwitcherLocked}
				isHistoryDrawerOpen={isHistoryDrawerOpen}
				setIsHistoryDrawerOpen={setIsHistoryDrawerOpen}
				enableStreamStickToBottom={enableStreamStickToBottom}
				flushScrollToBottom={flushScrollToBottom}
				sessionList={sessionList}
				showInitialPlaceholder={showInitialPlaceholder}
				showLoadMoreHint={showLoadMoreHint}
				showEmptyHint={showEmptyHint}
				setDeleteTargetSessionId={setDeleteTargetSessionId}
				setDeleteConfirmOpen={setDeleteConfirmOpen}
			/>
		</div>
	);
});
