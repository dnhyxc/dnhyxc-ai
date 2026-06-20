/**
 * 助手输入区工具条（历史 / 新对话 / 删除）：对接 knowledge / ebook / english Store。
 */
import { observer } from 'mobx-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import assistantStore from '@/store/assistant';
import ebookAssistantStore from '@/store/ebookAssistant';
import englishAgentStore from '@/store/englishAgent';
import { AssistantEntryToolbar } from './EntryToolbar';

export type AssistantSessionStoreKind = 'document' | 'ebook' | 'english';

export type AssistantSessionEntryToolbarProps = {
	store: AssistantSessionStoreKind;
	visible: boolean;
	showSessionActions: boolean;
	isSessionSwitcherLocked: boolean;
	isHistoryDrawerOpen: boolean;
	setIsHistoryDrawerOpen: Dispatch<SetStateAction<boolean>>;
	enableStreamStickToBottom: () => void;
	flushScrollToBottom: (options?: { force?: boolean }) => void;
	layout?: 'knowledge' | 'english';
	extraActions?: ReactNode;
	/** english：新对话草稿创建后的业务回调 */
	onNewConversation?: () => void | Promise<void>;
};

export const AssistantSessionEntryToolbar = observer(
	function AssistantSessionEntryToolbar({
		store,
		visible,
		showSessionActions,
		isSessionSwitcherLocked,
		isHistoryDrawerOpen,
		setIsHistoryDrawerOpen,
		enableStreamStickToBottom,
		flushScrollToBottom,
		layout,
		extraActions,
		onNewConversation,
	}: AssistantSessionEntryToolbarProps) {
		const { t } = useI18n();
		const [, setSearchParams] = useSearchParams();

		if (store === 'document') {
			const sessionList = assistantStore.sessionListForActiveDocument;
			return (
				<AssistantEntryToolbar
					visible={visible}
					showSessionActions={showSessionActions}
					isSessionSwitcherLocked={isSessionSwitcherLocked}
					isHistoryDrawerOpen={isHistoryDrawerOpen}
					setIsHistoryDrawerOpen={setIsHistoryDrawerOpen}
					enableStreamStickToBottom={enableStreamStickToBottom}
					flushScrollToBottom={flushScrollToBottom}
					layout={layout ?? 'knowledge'}
					historyAriaLabel={t('knowledge.assistant.history')}
					historyLockedToast={t('knowledge.assistant.sessionSavingViewHistory')}
					newConversationLockedToast={t('knowledge.assistant.sessionSaving')}
					history={{
						sessionList,
						showInitialPlaceholder:
							assistantStore.historySessionLoading && sessionList.length === 0,
						showLoadMoreHint: assistantStore.historySessionLoadingMore,
						showEmptyHint:
							!assistantStore.historySessionLoading &&
							sessionList.length === 0 &&
							!assistantStore.historySessionLoadingMore,
					}}
					onNewConversation={() =>
						void assistantStore.createNewSessionForCurrentDocument()
					}
					onDeleteSession={(sessionId) =>
						assistantStore.deleteSessionForCurrentDocument(sessionId)
					}
					historyActions={{
						activeSessionId: assistantStore.activeSessionId,
						isSessionStreaming: (sessionId) =>
							assistantStore.isSessionStreaming(sessionId),
						onSwitchSession: (sessionId) =>
							assistantStore.switchSessionForCurrentDocument(sessionId),
						onViewportScroll: assistantStore.onHistorySessionViewportScroll,
						closeDrawerBeforeSwitch: false,
					}}
					extraActions={extraActions}
				/>
			);
		}

		if (store === 'ebook') {
			const sessionList = ebookAssistantStore.sessionList;
			return (
				<AssistantEntryToolbar
					visible={visible}
					showSessionActions={showSessionActions}
					isSessionSwitcherLocked={isSessionSwitcherLocked}
					isHistoryDrawerOpen={isHistoryDrawerOpen}
					setIsHistoryDrawerOpen={setIsHistoryDrawerOpen}
					enableStreamStickToBottom={enableStreamStickToBottom}
					flushScrollToBottom={flushScrollToBottom}
					layout={layout ?? 'knowledge'}
					historyAriaLabel={t('knowledge.assistant.history')}
					historyLockedToast={t('knowledge.assistant.sessionSavingViewHistory')}
					newConversationLockedToast={t('knowledge.assistant.sessionSaving')}
					history={{
						sessionList,
						showInitialPlaceholder:
							ebookAssistantStore.historySessionLoading &&
							sessionList.length === 0,
						showLoadMoreHint: ebookAssistantStore.historySessionLoadingMore,
						showEmptyHint:
							!ebookAssistantStore.historySessionLoading &&
							sessionList.length === 0 &&
							!ebookAssistantStore.historySessionLoadingMore,
					}}
					onNewConversation={() => void ebookAssistantStore.createNewSession()}
					onDeleteSession={(sessionId) =>
						ebookAssistantStore.deleteSession(sessionId)
					}
					historyActions={{
						activeSessionId: ebookAssistantStore.activeSessionId,
						isSessionStreaming: (sessionId) =>
							ebookAssistantStore.isSessionStreaming(sessionId),
						onSwitchSession: (sessionId) =>
							ebookAssistantStore.switchSession(sessionId),
						onViewportScroll:
							ebookAssistantStore.onHistorySessionViewportScroll,
						closeDrawerBeforeSwitch: false,
					}}
				/>
			);
		}

		const sessionList = englishAgentStore.sessionList;
		const historyOpenLabel =
			t?.('englishLearning.vocab.historyOpenDrawer') ?? '历史记录';

		return (
			<AssistantEntryToolbar
				visible={visible}
				showSessionActions={showSessionActions}
				isSessionSwitcherLocked={isSessionSwitcherLocked}
				isHistoryDrawerOpen={isHistoryDrawerOpen}
				setIsHistoryDrawerOpen={setIsHistoryDrawerOpen}
				enableStreamStickToBottom={enableStreamStickToBottom}
				flushScrollToBottom={flushScrollToBottom}
				layout={layout ?? 'english'}
				historyAriaLabel={historyOpenLabel}
				historyButtonLabel={historyOpenLabel}
				historyLockedToast={historyOpenLabel}
				newConversationLockedToast={t('knowledge.assistant.sessionSaving')}
				history={{
					sessionList,
					showInitialPlaceholder:
						englishAgentStore.historySessionLoading && sessionList.length === 0,
					showLoadMoreHint: englishAgentStore.historySessionLoadingMore,
					showEmptyHint:
						!englishAgentStore.historySessionLoading &&
						sessionList.length === 0 &&
						!englishAgentStore.historySessionLoadingMore,
				}}
				onNewConversation={() => {
					setIsHistoryDrawerOpen(false);
					englishAgentStore.beginNewConversationDraft();
					void onNewConversation?.();
				}}
				onDeleteSession={(sessionId) =>
					englishAgentStore.deleteSession(sessionId)
				}
				historyActions={{
					activeSessionId: englishAgentStore.activeSessionId,
					isSessionStreaming: (sessionId) =>
						englishAgentStore.isSessionStreaming(sessionId),
					onSwitchSession: (sessionId) =>
						englishAgentStore.switchSession(sessionId).then(() => {
							setSearchParams({ session: sessionId }, { replace: true });
						}),
					onViewportScroll: englishAgentStore.onHistorySessionViewportScroll,
					closeDrawerBeforeSwitch: true,
				}}
			/>
		);
	},
);
