/**
 * 英语学习（LangChain Agent + english_learning）
 * 布局：横向 ResizablePanelGroup（与 Monaco 分栏一致）+ 左侧单词区由容器查询自适应。
 */
import { ScrollArea } from '@ui/index';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import englishAgentStore from '@/store/englishAgent';
import EnglishPackStore from '@/store/englishPack';
import { stopAllPlayback } from '@/utils/speech';
import { AgentPanel, type AgentPanelHandle } from './agent';
import { EnglishSidebar, type QuickIntentInputSyncPayload } from './sidebar';

const EnglishLearning = observer(function EnglishLearning() {
	const [searchParams, setSearchParams] = useSearchParams();
	const agentPanelRef = useRef<AgentPanelHandle>(null);

	const sessionQ = searchParams.get('session');

	useEffect(() => {
		if (!sessionQ) return;
		if (englishAgentStore.sessionId === sessionQ) return;
		void englishAgentStore.hydrateSession(sessionQ);
	}, [sessionQ]);

	/** 从 EnglishPack 恢复快捷意图（例如 HMR 或 Agent 被清空但 Pack 仍保留镜像时） */
	useEffect(() => {
		if (
			EnglishPackStore.sidebarIntentPrefix &&
			!englishAgentStore.pendingIntentPrefix
		) {
			englishAgentStore.setIntentPrefix(EnglishPackStore.sidebarIntentPrefix);
		}
	}, []);

	const onNewChat = useCallback(() => {
		stopAllPlayback();
		setSearchParams({}, { replace: true });
	}, [setSearchParams]);

	const onQuickIntentInputSync = useCallback(
		(payload: QuickIntentInputSyncPayload) => {
			agentPanelRef.current?.applyQuickIntent(payload);
		},
		[],
	);

	const onSessionReady = useCallback(
		(sessionId: string) => {
			setSearchParams({ session: sessionId }, { replace: true });
		},
		[setSearchParams],
	);

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				{/* 与知识库页 ScrollArea 一致：外层 p-5 pt-0；内壳与 Monaco 根容器一致 rounded-md bg-theme/5 */}
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md">
					<ResizablePanelGroup
						id="english-learning-split"
						orientation="horizontal"
						className="h-full min-h-0 min-w-0 max-w-full flex-1"
					>
						<ResizablePanel
							id="english-sidebar"
							defaultSize="35%"
							className="min-h-0 min-w-0"
						>
							<aside
								className={cn(
									'flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-theme-background',
								)}
							>
								{/* p-4.5 在 Root：右侧留白给滚动条贴边，不挡卡片；轨道上下与卡片齐平 */}
								<ScrollArea
									className="h-full p-4.5"
									viewportClassName="rounded-md"
									scrollbarClassName="!top-4.5 !bottom-4.5 h-auto"
								>
									<div className="flex w-full min-h-0 min-w-0 flex-1 flex-col">
										<EnglishSidebar
											onQuickIntentInputSync={onQuickIntentInputSync}
										/>
									</div>
								</ScrollArea>
							</aside>
						</ResizablePanel>
						{/* w-0：拖到最左仍可抓；竖线上下与侧栏 p-6 对齐 */}
						<ResizableHandle
							withHandle
							className={cn(
								'w-0 bg-transparent',
								'before:bg-theme/10 before:absolute before:top-6 before:bottom-6 before:left-1/2 before:w-px before:-translate-x-1/2',
							)}
						/>
						<ResizablePanel
							id="english-chat"
							defaultSize="65%"
							className="min-h-0 min-w-0"
						>
							<AgentPanel
								ref={agentPanelRef}
								onNewChat={onNewChat}
								onSessionReady={onSessionReady}
							/>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</div>
	);
});

export default EnglishLearning;
