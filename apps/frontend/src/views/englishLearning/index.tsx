/**
 * 英语学习（LangChain Agent + english_learning）
 * 布局：横向 ResizablePanelGroup（与 Monaco 分栏一致）+ 左侧单词区由容器查询自适应。
 */
import { ScrollArea } from '@ui/index';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import englishAgentStore from '@/store/englishAgent';
import EnglishPackStore from '@/store/englishPack';
import { stripAutoFilledIntentName } from '@/utils';
import { stopAllEnglishPlayback } from '@/utils/englishTts';
import { AgentPanel } from './agent/AgentPanel';
import { ClassicQuotesSection } from './classic/ClassicQuotesSection';
import FavoriteSession from './favorites/FavoriteSession';
import EnglishSource from './shared/EnglishSource';
import {
	EnglishLearningToolbar,
	type QuickIntentInputSyncPayload,
} from './shared/LearningToolbar';
import { VocabularyPackSection } from './vocab/VocabularySection';

const EnglishLearning = observer(function EnglishLearning() {
	const { t } = useI18n();
	const [searchParams, setSearchParams] = useSearchParams();
	const [input, setInput] = useState('');
	/** Agent 输入框（ChatTextArea），快捷意图填入后用于自动聚焦 */
	const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
	/** 当前由快捷意图自动填入输入框的展示名（与 chip 文案一致），用于取消选中时精确移除 */
	const intentInputAutoFillRef = useRef<string | null>(null);

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
		stopAllEnglishPlayback();
		intentInputAutoFillRef.current = null;
		setSearchParams({}, { replace: true });
	}, [setSearchParams]);

	const onQuickIntentInputSync = useCallback(
		(payload: QuickIntentInputSyncPayload) => {
			if (payload.mode === 'select') {
				intentInputAutoFillRef.current = payload.label;
				setInput(payload.label);
				// 等布局提交后再聚焦，避免 ref 未更新或光标未落到文本域
				requestAnimationFrame(() => {
					chatInputRef.current?.focus();
				});
				return;
			}
			const snap = intentInputAutoFillRef.current;
			intentInputAutoFillRef.current = null;
			if (!snap) return;
			setInput((prev) => stripAutoFilledIntentName(prev, snap));
		},
		[],
	);

	const sendMessage = useCallback(async () => {
		const text = input.trim();
		if (!text) return;
		intentInputAutoFillRef.current = null;
		setInput('');
		// 创建会话时的 title：已有会话用服务端标题；新会话用首条消息摘要；最后才用路由默认名
		const sessionTitle = englishAgentStore.sessionTitle?.trim();
		const collapsed = text.replace(/\s+/g, ' ');
		const synopsis =
			collapsed.length > 36 ? `${collapsed.slice(0, 36)}…` : collapsed;
		await englishAgentStore.sendMessage(text, {
			titleFallback:
				sessionTitle || synopsis || t('route.englishLearning.title'),
		});
		if (englishAgentStore.sessionId) {
			setSearchParams(
				{ session: englishAgentStore.sessionId },
				{ replace: true },
			);
		}
	}, [input, setSearchParams, t]);

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5 pt-0">
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
								<ScrollArea className="h-full py-4">
									<div className="flex min-h-0 flex-1 flex-col">
										<EnglishLearningToolbar
											onQuickIntentInputSync={onQuickIntentInputSync}
										/>
										<EnglishSource
											title={t('englishLearning.library.vocab.title')}
											description={t('englishLearning.library.vocab.descShort')}
											type="vocab"
										/>
										<EnglishSource
											title={t('englishLearning.library.classic.title')}
											description={t(
												'englishLearning.library.classic.descShort',
											)}
											type="classic"
										/>
										<FavoriteSession />
										<VocabularyPackSection />
										<ClassicQuotesSection />
									</div>
								</ScrollArea>
							</aside>
						</ResizablePanel>
						<ResizableHandle withHandle className="w-0" />
						<ResizablePanel
							id="english-chat"
							defaultSize="65%"
							className="min-h-0 min-w-0"
						>
							<AgentPanel
								input={input}
								setInput={setInput}
								chatInputRef={chatInputRef}
								sendMessage={sendMessage}
								onNewChat={onNewChat}
							/>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</div>
	);
});

export default EnglishLearning;
