import { Drawer } from '@design/Drawer';
import { Button, Input, Toast } from '@ui/index';
import { Check, SquarePen, Trash2, X } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type ChangeEvent,
	type FocusEvent,
	type KeyboardEvent,
	type MouseEvent,
	useEffect,
	useState,
} from 'react';
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
 * 助手会话历史抽屉：列表、切换、删除入口、可选标题编辑、滚动分页占位。
 * Store 与路由逻辑由 `historyActions` 注入，供知识库 / 电子书 / 英语学习 / Skill 共用。
 * observer：订阅 isSessionStreaming → stateBySession.messages，流式结束须即时去掉 loading。
 */
export const AssistantHistoryDrawer = observer(function AssistantHistoryDrawer({
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
	onRenameSession,
	closeDrawerBeforeSwitch = false,
	drawerTitle,
	lockedToast,
}: AssistantHistoryDrawerProps) {
	const { t } = useI18n();
	const title = drawerTitle ?? t('knowledge.assistant.history');
	const lockedMessage =
		lockedToast ?? t('knowledge.assistant.sessionSavingViewHistory');
	const canRename = typeof onRenameSession === 'function';

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState('');
	const [isComposing, setIsComposing] = useState(false);

	useEffect(() => {
		if (!isHistoryDrawerOpen) {
			setEditingId(null);
			setEditTitle('');
		}
	}, [isHistoryDrawerOpen]);

	const handleSelectSession = (sessionId: string) => {
		if (editingId === sessionId) return;
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

	const beginEdit = (sessionId: string, currentTitle: string) => {
		setEditingId(sessionId);
		setEditTitle(currentTitle);
	};

	const cancelEdit = () => {
		setEditingId(null);
		setEditTitle('');
	};

	const submitEdit = async () => {
		if (!editingId || !onRenameSession) return;
		const next = editTitle.trim();
		const prev =
			sessionList.find((s) => s.sessionId === editingId)?.title?.trim() ?? '';
		if (!next) {
			Toast({ type: 'warning', title: t('knowledge.assistant.titleRequired') });
			return;
		}
		if (next === prev) {
			cancelEdit();
			return;
		}
		const ok = await onRenameSession(editingId, next);
		if (ok !== false) cancelEdit();
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
							const isEditing = editingId === s.sessionId;
							return (
								<div
									key={s.sessionId}
									className={cn(
										'group relative flex w-full cursor-pointer items-start rounded-md px-2.5 py-2 text-left transition-colors hover:bg-theme/10',
										active || isEditing ? 'bg-theme/10' : '',
									)}
									onClick={() => handleSelectSession(s.sessionId)}
								>
									{isEditing ? (
										<div
											className="flex min-w-0 flex-1 items-center"
											onClick={(e) => e.stopPropagation()}
										>
											<Input
												className="h-8 rounded-sm border-0 bg-transparent px-0 focus-visible:border-0 focus-visible:ring-0"
												value={editTitle}
												autoFocus
												onChange={(e: ChangeEvent<HTMLInputElement>) =>
													setEditTitle(e.target.value)
												}
												onCompositionStart={() => setIsComposing(true)}
												onCompositionEnd={() => {
													setTimeout(() => setIsComposing(false), 0);
												}}
												onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
													const composing =
														(e.nativeEvent as globalThis.KeyboardEvent)
															.isComposing || isComposing;
													if (composing) return;
													if (e.key === 'Enter') {
														e.preventDefault();
														void submitEdit();
													}
													if (e.key === 'Escape') {
														e.preventDefault();
														cancelEdit();
													}
												}}
												onBlur={(_e: FocusEvent<HTMLInputElement>) => {
													void submitEdit();
												}}
											/>
											<div className="ml-1 flex shrink-0 items-center gap-1">
												<Button
													variant="link"
													className="h-7 w-7 rounded-md p-0 hover:bg-teal-500/15 hover:text-teal-500"
													aria-label={t('common.confirm')}
													onMouseDown={(e: MouseEvent) => e.preventDefault()}
													onClick={(e) => {
														e.stopPropagation();
														void submitEdit();
													}}
												>
													<Check className="h-4 w-4" />
												</Button>
												<Button
													variant="link"
													className="h-7 w-7 rounded-md p-0 hover:bg-orange-500/15 hover:text-orange-500"
													aria-label={t('common.cancel')}
													onMouseDown={(e: MouseEvent) => e.preventDefault()}
													onClick={(e) => {
														e.stopPropagation();
														cancelEdit();
													}}
												>
													<X className="h-4 w-4" />
												</Button>
											</div>
										</div>
									) : (
										<>
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
													'flex h-7 shrink-0 items-center justify-end gap-0.5 self-start overflow-hidden',
													isStreaming
														? 'w-7'
														: canRename
															? 'w-0 group-hover:w-14'
															: 'w-0 group-hover:w-7',
												)}
											>
												{isStreaming ? (
													<Spinner className="text-textcolor/60 size-4 shrink-0" />
												) : (
													<>
														{canRename ? (
															<Button
																variant="link"
																className="text-textcolor/70 hover:text-teal-500 hover:bg-teal-500/10 hidden h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md group-hover:flex"
																aria-label={t(
																	'knowledge.assistant.editConversationTitle',
																)}
																onClick={(e) => {
																	e.stopPropagation();
																	beginEdit(s.sessionId, rowTitle);
																}}
															>
																<SquarePen className="h-4 w-4" />
															</Button>
														) : null}
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
													</>
												)}
											</div>
										</>
									)}
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
});
