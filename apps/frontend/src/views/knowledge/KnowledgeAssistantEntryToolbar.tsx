/**
 * 知识库助手输入区上方工具条：多会话（历史抽屉 / 新对话）与 AI、RAG 模式切换。
 * 逻辑与样式从 `KnowledgeAssistant` 原样迁出，便于维护。
 */

import Confirm from '@design/Confirm';
import { Button, Toast } from '@ui/index';
import { CirclePlus, Clock } from 'lucide-react';
import { observer } from 'mobx-react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import assistantStore from '@/store/assistant';
import {
	KNOWLEDGE_ASSISTANT_MODES,
	type KnowledgeAssistantMode,
} from './constants';
import KnowledgeAssistantHistory from './KnowledgeAssistantHistory';

export interface KnowledgeAssistantEntryToolbarProps {
	showEntryToolbar: boolean;
	showAiSessionActions: boolean;
	isAiSessionSwitcherLocked: boolean;
	isAiHistoryDrawerOpen: boolean;
	setIsAiHistoryDrawerOpen: Dispatch<SetStateAction<boolean>>;
	enableStreamStickToBottom: () => void;
	flushScrollToBottom: () => void;
	assistantMode: KnowledgeAssistantMode['id'];
	setAssistantMode: (m: KnowledgeAssistantMode['id']) => void;
}

export const KnowledgeAssistantEntryToolbar = observer(
	function KnowledgeAssistantEntryToolbar({
		showEntryToolbar,
		showAiSessionActions,
		isAiSessionSwitcherLocked,
		isAiHistoryDrawerOpen,
		setIsAiHistoryDrawerOpen,
		enableStreamStickToBottom,
		flushScrollToBottom,
		assistantMode,
		setAssistantMode,
	}: KnowledgeAssistantEntryToolbarProps) {
		const sessionList = assistantStore.sessionListForActiveDocument;
		const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
		const [deleteTargetSessionId, setDeleteTargetSessionId] = useState<
			string | null
		>(null);
		const showInitialPlaceholder =
			assistantStore.historySessionLoading && sessionList.length === 0;
		const showLoadMoreHint = assistantStore.historySessionLoadingMore;
		const showEmptyHint =
			!assistantStore.historySessionLoading &&
			sessionList.length === 0 &&
			!assistantStore.historySessionLoadingMore;

		const deleteTargetTitle = useMemo(() => {
			if (!deleteTargetSessionId) return '';
			const row = sessionList.find(
				(s) => s.sessionId === deleteTargetSessionId,
			);
			return row?.title?.trim()
				? row.title.trim()
				: `对话 ${deleteTargetSessionId.slice(0, 8)}`;
		}, [deleteTargetSessionId, sessionList]);

		const onConfirmDelete = useCallback(async () => {
			if (!deleteTargetSessionId) return;
			await assistantStore.deleteSessionForCurrentDocument(
				deleteTargetSessionId,
			);
			setDeleteConfirmOpen(false);
			setDeleteTargetSessionId(null);
		}, [deleteTargetSessionId]);

		return (
			<div className="inline-flex items-center pb-1 max-w-0">
				<Confirm
					open={deleteConfirmOpen}
					onOpenChange={(v) => {
						setDeleteConfirmOpen(v);
						if (!v) setDeleteTargetSessionId(null);
					}}
					title="删除对话？"
					description={
						<div className="text-left">
							确定要删除该历史对话吗？此操作无法撤销。
							{deleteTargetTitle ? (
								<div className="mt-2 font-medium text-base wrap-anywhere">
									对话名称：「{deleteTargetTitle}」
								</div>
							) : null}
						</div>
					}
					descriptionClassName="text-left"
					confirmText="删除"
					confirmVariant="destructive"
					closeOnConfirm={false}
					onConfirm={onConfirmDelete}
					onCancel={() => {
						setDeleteConfirmOpen(false);
						setDeleteTargetSessionId(null);
					}}
				/>
				{showEntryToolbar ? (
					<div className="inline-flex items-center gap-2">
						{showAiSessionActions ? (
							<>
								<Button
									variant="link"
									className="mb-0.5 h-8.5 w-8.5 mt-0.5 rounded-full text-textcolor/80 hover:bg-theme/10 hover:text-teal-500 border border-theme/10 p-0 [&_svg]:overflow-visible"
									aria-label="历史对话"
									disabled={isAiSessionSwitcherLocked}
									onClick={() => {
										if (isAiSessionSwitcherLocked) {
											Toast({
												type: 'info',
												title: '正在保存对话，请稍后再查看历史对话',
											});
											return;
										}
										setIsAiHistoryDrawerOpen(true);
									}}
								>
									<Clock className="h-4 w-4" />
								</Button>
								<Button
									size="sm"
									variant="link"
									className="w-fit rounded-md border border-theme/10 px-3 py-1.5 text-sm text-textcolor/80 transition-colors hover:bg-theme/10 hover:text-teal-500"
									disabled={isAiSessionSwitcherLocked}
									onClick={() => {
										if (isAiSessionSwitcherLocked) {
											Toast({
												type: 'info',
												title: '正在保存对话，请稍后再新建对话',
											});
											return;
										}
										void assistantStore.createNewSessionForCurrentDocument();
									}}
								>
									<CirclePlus />
									新对话
								</Button>
							</>
						) : null}
						{KNOWLEDGE_ASSISTANT_MODES.map((item) => (
							<Button
								key={item.id}
								variant="link"
								size="sm"
								className={cn(
									'px-2.5 border border-theme/15',
									assistantMode === item.id
										? 'bg-theme/10 text-teal-500'
										: 'text-textcolor/80 hover:bg-theme/10',
								)}
								onClick={() => setAssistantMode(item.id)}
							>
								<item.icon />
								{item.label}
							</Button>
						))}
					</div>
				) : null}
				<KnowledgeAssistantHistory
					isAiSessionSwitcherLocked={isAiSessionSwitcherLocked}
					isAiHistoryDrawerOpen={isAiHistoryDrawerOpen}
					setIsAiHistoryDrawerOpen={setIsAiHistoryDrawerOpen}
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
	},
);
