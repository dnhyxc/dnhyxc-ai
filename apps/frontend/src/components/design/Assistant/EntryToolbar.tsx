import Confirm from '@design/Confirm';
import { Button, Toast } from '@ui/index';
import { CirclePlus, Clock } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { AssistantHistoryDrawer } from './HistoryDrawer';
import type { AssistantEntryToolbarProps } from './types';

function SessionHistoryButton({
	layout,
	disabled,
	ariaLabel,
	buttonLabel,
	onClick,
}: {
	layout: AssistantEntryToolbarProps['layout'];
	disabled: boolean;
	ariaLabel: string;
	buttonLabel?: string;
	onClick: () => void;
}) {
	if (layout === 'english') {
		return (
			<Button
				variant="link"
				className="lucide-stroke-draw-hover text-textcolor/80 flex items-center text-sm hover:bg-theme/10 border border-theme/10 h-8 rounded-md [&_svg]:overflow-visible hover:text-teal-500"
				aria-label={ariaLabel}
				disabled={disabled}
				onClick={onClick}
			>
				<Clock className="h-4 w-4" />
				{buttonLabel}
			</Button>
		);
	}

	return (
		<Button
			variant="link"
			className="mb-0.5 h-8.5 w-8.5 mt-0.5 rounded-full text-textcolor/80 hover:bg-theme/5 hover:text-teal-500 border border-theme/10 p-0 [&_svg]:overflow-visible"
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={onClick}
		>
			<Clock className="h-4 w-4" />
		</Button>
	);
}

function SessionNewConversationButton({
	layout,
	disabled,
	label,
	onClick,
}: {
	layout: AssistantEntryToolbarProps['layout'];
	disabled: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<Button
			size="sm"
			variant="link"
			className={cn(
				'w-fit rounded-md px-3 py-1.5 text-sm text-textcolor/80 transition-colors hover:text-teal-500',
				layout === 'english'
					? 'lucide-stroke-draw-hover hover:bg-theme/10 border border-theme/10'
					: 'border border-theme/10 hover:bg-theme/5',
			)}
			disabled={disabled}
			onClick={onClick}
		>
			<CirclePlus />
			{label}
		</Button>
	);
}

/**
 * 助手输入区工具条：删除确认 + 历史/新对话 + 可扩展 extraActions + 历史抽屉 slot。
 */
export function AssistantEntryToolbar({
	visible = true,
	showSessionActions = true,
	isSessionSwitcherLocked,
	isHistoryDrawerOpen,
	setIsHistoryDrawerOpen,
	enableStreamStickToBottom,
	flushScrollToBottom,
	history,
	onNewConversation,
	onDeleteSession,
	historyActions,
	layout = 'knowledge',
	historyAriaLabel,
	historyLockedToast,
	newConversationLockedToast,
	historyButtonLabel,
	extraActions,
}: AssistantEntryToolbarProps) {
	const { t } = useI18n();
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [deleteTargetSessionId, setDeleteTargetSessionId] = useState<
		string | null
	>(null);

	const deleteTargetTitle = useMemo(() => {
		if (!deleteTargetSessionId) return '';
		const row = history.sessionList.find(
			(s) => s.sessionId === deleteTargetSessionId,
		);
		return row?.title?.trim()
			? row.title.trim()
			: t('knowledge.assistant.conversationFallback', {
					id: deleteTargetSessionId.slice(0, 8),
				});
	}, [deleteTargetSessionId, history.sessionList, t]);

	const onConfirmDelete = useCallback(async () => {
		if (!deleteTargetSessionId) return;
		await onDeleteSession(deleteTargetSessionId);
		setDeleteConfirmOpen(false);
		setDeleteTargetSessionId(null);
	}, [deleteTargetSessionId, onDeleteSession]);

	const openHistory = useCallback(() => {
		if (isSessionSwitcherLocked) {
			Toast({
				type: 'info',
				title:
					historyLockedToast ??
					t('knowledge.assistant.sessionSavingViewHistory'),
			});
			return;
		}
		setIsHistoryDrawerOpen(true);
	}, [historyLockedToast, isSessionSwitcherLocked, setIsHistoryDrawerOpen, t]);

	const startNewConversation = useCallback(() => {
		if (isSessionSwitcherLocked) {
			Toast({
				type: 'info',
				title:
					newConversationLockedToast ?? t('knowledge.assistant.sessionSaving'),
			});
			return;
		}
		void onNewConversation();
	}, [
		isSessionSwitcherLocked,
		newConversationLockedToast,
		onNewConversation,
		t,
	]);

	const historyButton = (
		<SessionHistoryButton
			layout={layout}
			disabled={isSessionSwitcherLocked}
			ariaLabel={historyAriaLabel}
			buttonLabel={historyButtonLabel}
			onClick={openHistory}
		/>
	);

	const newConversationButton = (
		<SessionNewConversationButton
			layout={layout}
			disabled={isSessionSwitcherLocked}
			label={t('knowledge.assistant.newConversation')}
			onClick={startNewConversation}
		/>
	);

	const sessionActions =
		layout === 'english' ? (
			<>
				{newConversationButton}
				{historyButton}
			</>
		) : (
			<>
				{historyButton}
				{newConversationButton}
			</>
		);

	const historyDrawerProps = {
		isSessionSwitcherLocked,
		isHistoryDrawerOpen,
		setIsHistoryDrawerOpen,
		enableStreamStickToBottom,
		flushScrollToBottom,
		setDeleteTargetSessionId,
		setDeleteConfirmOpen,
		lockedToast: historyLockedToast,
		...history,
		...historyActions,
	};

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
			{visible ? (
				<div className="inline-flex items-center gap-2">
					{showSessionActions ? sessionActions : null}
					{extraActions}
				</div>
			) : null}
			<AssistantHistoryDrawer {...historyDrawerProps} />
		</div>
	);
}
