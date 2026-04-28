/**
 * 知识库助手输入区上方工具条：多会话（历史抽屉 / 新对话）与 AI、RAG 模式切换。
 * 逻辑与样式从 `KnowledgeAssistant` 原样迁出，便于维护。
 */

import { Drawer } from '@design/Drawer';
import { Button, Toast } from '@ui/index';
import { CirclePlus, Clock } from 'lucide-react';
import { observer } from 'mobx-react';
import type { Dispatch, SetStateAction } from 'react';
import { ScrollArea } from '@/components/ui';
import { cn } from '@/lib/utils';
import assistantStore from '@/store/assistant';
import {
	KNOWLEDGE_ASSISTANT_MODES,
	type KnowledgeAssistantMode,
} from './constants';

export interface KnowledgeAssistantEntryToolbarProps {
	showAiSessionSwitcher: boolean;
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
		showAiSessionSwitcher,
		isAiSessionSwitcherLocked,
		isAiHistoryDrawerOpen,
		setIsAiHistoryDrawerOpen,
		enableStreamStickToBottom,
		flushScrollToBottom,
		assistantMode,
		setAssistantMode,
	}: KnowledgeAssistantEntryToolbarProps) {
		return (
			<div className="flex w-full items-center gap-2 pb-1">
				{showAiSessionSwitcher ? (
					<div className="flex w-full items-center gap-2">
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
							width="sm:max-w-md"
						>
							<ScrollArea className="h-full overflow-y-auto pr-2 box-border">
								<div className="flex flex-col gap-1 pr-2">
									{assistantStore.sessionListForActiveDocument.length === 0 ? (
										<div className="text-sm text-textcolor/60 py-6 text-center">
											暂无历史对话
										</div>
									) : (
										assistantStore.sessionListForActiveDocument.map((s) => {
											const active =
												assistantStore.activeSessionId === s.sessionId;
											const title = s.title?.trim()
												? s.title.trim()
												: `对话 ${s.sessionId.slice(0, 8)}`;
											return (
												<button
													key={s.sessionId}
													type="button"
													className={cn(
														'w-full text-left rounded-md px-2.5 py-2 border border-transparent hover:bg-theme/10 transition-colors',
														active ? 'bg-theme/10 border-theme/10' : '',
													)}
													onClick={() => {
														void assistantStore
															.switchSessionForCurrentDocument(s.sessionId)
															.then(() => {
																setIsAiHistoryDrawerOpen(false);
																enableStreamStickToBottom();
																flushScrollToBottom();
																requestAnimationFrame(() =>
																	flushScrollToBottom(),
																);
															});
													}}
												>
													<div className="text-sm text-textcolor line-clamp-1">
														{title}
													</div>
													<div className="text-xs text-textcolor/50 mt-1">
														{s.updatedAt
															? new Date(s.updatedAt).toLocaleString()
															: ''}
													</div>
												</button>
											);
										})
									)}
								</div>
							</ScrollArea>
						</Drawer>
					</div>
				) : null}
				<div className="flex w-full items-center gap-2">
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
			</div>
		);
	},
);
