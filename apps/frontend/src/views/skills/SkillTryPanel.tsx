/**
 * Skill 侧栏：试跑 / 生成（与知识库 AI/RAG 切换同款）。
 */
import Tooltip from '@design/Tooltip';
import { Button, Toast } from '@ui/index';
import { Sparkles, WandSparkles } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import {
	AssistantFooter,
	AssistantMessageRow,
	AssistantSessionEntryToolbar,
	AssistantShareBar,
	AssistantShell,
	type SelectMessageByChatId,
	useAssistantShare,
} from '@/components/design/Assistant';
import ChatEntry from '@/components/design/ChatEntry';
import type { useAssistantSelectionSpeak } from '@/components/design/SelectionSpeak';
import { useI18n } from '@/hooks';
import { useAssistantCopy } from '@/hooks/useAssistantCopy';
import { useAssistantScroll } from '@/hooks/useAssistantScroll';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import skillStore from '@/store/skill';
import skillTryStore, {
	parseSkillDraft,
	type SkillPanelMode,
} from '@/store/skillTry';
import type { Message } from '@/types/chat';

const selectSkillTryMessageByChatId: SelectMessageByChatId = (chatId) =>
	skillTryStore.messages.find((m) => m.chatId === chatId);

const MODE_ITEMS: Array<{
	id: SkillPanelMode;
	labelKey: string;
	icon: typeof Sparkles;
}> = [
	{ id: 'try', labelKey: 'skill.panel.mode.try', icon: Sparkles },
	{ id: 'generate', labelKey: 'skill.panel.mode.generate', icon: WandSparkles },
];

type SkillSelectionSpeak = ReturnType<typeof useAssistantSelectionSpeak>;

const SkillTryPanel = observer(function SkillTryPanel({
	selectionSpeak,
}: {
	/** 由 SkillsPage 持有，避免技能库开合 remount 本面板时打断朗读 */
	selectionSpeak: SkillSelectionSpeak;
}) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { userStore, knowledgeStore } = useStore();
	const [input, setInput] = useState('');
	const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
	const { isCopyedId, onCopy } = useAssistantCopy();
	const isLoggedIn = Boolean(userStore.userInfo?.id);
	const skillId = skillStore.editingId;
	const mode = skillTryStore.mode;
	const isGenerate = mode === 'generate';
	const aiMessages = skillTryStore.messages;
	const activeSessionId = skillTryStore.activeSessionId;
	const canUseToolbar = isLoggedIn && (isGenerate || Boolean(skillId));

	useEffect(() => {
		skillTryStore.bindSkill(skillId);
	}, [skillId]);

	/** 切 Skill / 模式 / 历史会话时停播；跳过挂载（含技能库开合 remount）避免误关播放条 */
	const speakSwitchSkipMount = useRef(true);
	const stopSpeak = selectionSpeak.stop;
	useEffect(() => {
		if (speakSwitchSkipMount.current) {
			speakSwitchSkipMount.current = false;
			return;
		}
		stopSpeak();
	}, [skillId, mode, activeSessionId, stopSpeak]);

	useEffect(() => {
		if (!isLoggedIn) return;
		if (mode === 'try' && !skillId) return;
		void skillTryStore.refreshSessionList(skillId);
	}, [isLoggedIn, skillId, mode]);

	useEffect(() => {
		if (!isHistoryDrawerOpen || !isLoggedIn) return;
		if (mode === 'try' && !skillId) return;
		void skillTryStore.refreshSessionList(skillId);
	}, [isHistoryDrawerOpen, isLoggedIn, skillId, mode]);

	const {
		allowAiShare,
		shareFlow,
		shareSelection,
		onShare,
		setShareModelVisible,
		shareChatNode,
	} = useAssistantShare({
		messages: aiMessages,
		sessionId: skillTryStore.activeSessionId,
		sessionType: 'agent',
		enabled: isLoggedIn && Boolean(skillTryStore.activeSessionId),
	});

	const onSaveToKnowledge = useCallback(
		(message: Message) => {
			const body = (message.content ?? '').trim();
			if (!body) {
				Toast({
					type: 'warning',
					title: t('knowledge.assistant.noBodyToWrite'),
				});
				return;
			}
			const cur = knowledgeStore.markdown.trimEnd();
			const next = cur ? `${cur}\n\n${body}\n` : `${body}\n`;
			knowledgeStore.setMarkdown(next);
			navigate('/knowledge');
		},
		[knowledgeStore, navigate, t],
	);

	const onApplyToEditor = useCallback(
		(message: Message) => {
			const raw = (message.content ?? '').trim();
			if (!raw) {
				Toast({
					type: 'warning',
					title: t('skill.generate.emptyApply'),
				});
				return;
			}
			const { title, content } = parseSkillDraft(raw);
			if (!title.trim() || !content.trim()) {
				Toast({
					type: 'warning',
					title: t('skill.generate.parseFail'),
				});
				return;
			}
			skillStore.setTitle(title);
			skillStore.setContent(content);
			skillTryStore.markEditorApplied(title, content);
			Toast({ type: 'success', title: t('skill.generate.applied') });
		},
		[t],
	);

	const idleFlushKey = useMemo((): string | null => {
		if (aiMessages.length === 0) return null;
		return `${skillTryStore.activeSessionId ?? 'none'}-${aiMessages.length}`;
	}, [aiMessages.length, skillTryStore.activeSessionId]);

	const {
		viewportRef: scrollViewportRef,
		scrollAreaHandlers,
		enableStickToBottom: enableStreamStickToBottom,
		flushScrollToBottom,
		scrollFabMode,
		onScrollFabClick,
	} = useAssistantScroll({
		messages: aiMessages,
		isStreaming: skillTryStore.isStreaming,
		resetKey: `skill-${mode}:${skillId ?? 'none'}:${skillTryStore.activeSessionId ?? 'none'}`,
		idleFlushKey,
	});

	const sendMessage = useCallback(
		async (content?: string) => {
			const text = (content ?? input).trim();
			if (!text) return;
			if (!isGenerate && !skillId) {
				Toast({ type: 'warning', title: '请先保存 Skill 后再试跑' });
				return;
			}
			if (!isLoggedIn) {
				Toast({
					type: 'warning',
					title: t('knowledge.assistant.loginToUse'),
				});
				return;
			}
			setInput('');
			enableStreamStickToBottom();
			await skillTryStore.sendMessage(text, {
				skillId,
				...(isGenerate
					? {
							draftTitle: skillStore.title,
							draftContent: skillStore.content,
						}
					: {}),
			});
		},
		[input, skillId, isLoggedIn, isGenerate, enableStreamStickToBottom, t],
	);

	const stopGenerating = useCallback(() => {
		skillTryStore.stopGenerating();
	}, []);

	const onNewChat = useCallback(() => {
		selectionSpeak.stop();
		skillTryStore.newChat();
		flushScrollToBottom({ force: true });
	}, [flushScrollToBottom, selectionSpeak]);

	const enableStickToBottomStable = useCallback(() => {
		enableStreamStickToBottom();
	}, [enableStreamStickToBottom]);

	const flushScrollToBottomStable = useCallback(
		(options?: { force?: boolean }) => {
			flushScrollToBottom(options);
		},
		[flushScrollToBottom],
	);

	const conversationColumnActive = aiMessages.length > 0;
	const emptyHint = isGenerate
		? t('skill.generate.empty')
		: skillId
			? t('skill.try.empty')
			: t('skill.try.saveFirst');

	return (
		<div className="relative flex h-full min-h-0 w-full pt-4 min-w-0 flex-col overflow-hidden bg-theme-background">
			<AssistantShell
				t={t}
				isLoading={skillTryStore.isHistoryLoading}
				loadingText={t('knowledge.assistant.loadingConversation')}
				hasMessages={aiMessages.length > 0}
				maxWidth="max-w-3xl"
				messageContainerClassName="px-4 pb-0 pt-0"
				emptyState={
					/* 与 Footer(pl-4 pr-4) / Shell 消息区 px-4 对齐；滚动条由 ScrollArea 贴边 */
					<div className="mx-auto flex w-full max-w-3xl flex-1 items-start justify-center px-4 text-sm text-textcolor/70">
						<div className="flex w-full items-start rounded-md border border-theme/10 p-3">
							{isGenerate ? (
								<WandSparkles
									size={18}
									className="mr-2 mt-0.5 shrink-0 text-teal-500"
								/>
							) : (
								<Sparkles
									size={18}
									className="mr-2 mt-0.5 shrink-0 text-teal-500"
								/>
							)}
							<div className="flex-1 leading-relaxed">{emptyHint}</div>
						</div>
					</div>
				}
				viewportRef={scrollViewportRef}
				scrollAreaHandlers={scrollAreaHandlers}
				messageList={aiMessages.map((message, index) => (
					<AssistantMessageRow
						key={message.id ?? message.chatId}
						variant="panel"
						selectMessageByChatId={selectSkillTryMessageByChatId}
						t={t}
						chatId={message.chatId}
						index={index}
						messagesLength={aiMessages.length}
						isCopyedId={isCopyedId}
						onCopy={onCopy}
						isLoading={skillTryStore.isSending}
						onSaveToKnowledge={isGenerate ? onApplyToEditor : onSaveToKnowledge}
						saveKnowledgeTitle={
							isGenerate ? t('skill.generate.applyToEditor') : undefined
						}
						allowAiShare={allowAiShare}
						shareSelection={shareSelection}
						onShare={onShare}
						scrollViewportRef={
							scrollViewportRef as RefObject<HTMLElement | null>
						}
						getSelectionContextMenuItems={
							selectionSpeak.getSelectionContextMenuItems
						}
						onSpeakContent={selectionSpeak.start}
					/>
				))}
				footer={
					<AssistantFooter
						containerClassName="pb-4"
						maxWidth="max-w-3xl"
						showScrollFab={
							conversationColumnActive && scrollFabMode !== 'hidden'
						}
						scrollFab={{
							mode: scrollFabMode,
							onClick: onScrollFabClick,
							toBottomLabel: t('knowledge.assistant.scrollToBottom'),
							toTopLabel: t('knowledge.assistant.scrollToTop'),
							variant: 'panel',
						}}
						floatAbove={selectionSpeak.floatAbove}
					>
						{allowAiShare && shareSelection.isSharing ? (
							<AssistantShareBar
								messages={aiMessages}
								checkboxId="skill-try-share-all"
								shareSelection={shareSelection}
								shareFlow={shareFlow}
								setShareModelVisible={setShareModelVisible}
							/>
						) : (
							<ChatEntry
								t={t}
								input={input}
								setInput={setInput}
								className="w-full p-0"
								maxWidth="max-w-none"
								textareaClassName="min-h-12 rounded-md"
								inputWrapClassName="border-theme/5 bg-theme/5"
								sendMessage={sendMessage}
								placeholder={
									isGenerate
										? t('skill.generate.placeholder')
										: t('skill.try.placeholder')
								}
								disableTextInput={!isGenerate && !skillId}
								loading={skillTryStore.isSending}
								stopGenerating={
									skillTryStore.isStreaming ? stopGenerating : undefined
								}
								entryChildren={
									<AssistantSessionEntryToolbar
										store="skill"
										visible={isLoggedIn}
										showSessionActions={canUseToolbar}
										isSessionSwitcherLocked={false}
										isHistoryDrawerOpen={isHistoryDrawerOpen}
										setIsHistoryDrawerOpen={setIsHistoryDrawerOpen}
										enableStreamStickToBottom={enableStickToBottomStable}
										flushScrollToBottom={flushScrollToBottomStable}
										onNewConversation={onNewChat}
										extraActions={MODE_ITEMS.map((item) => (
											<Tooltip
												key={item.id}
												side="bottom"
												content={t(item.labelKey)}
											>
												<Button
													variant="link"
													className={cn(
														'mb-0.5 h-8.5 w-8.5 mt-0.5 rounded-full border border-theme/10 p-0 [&_svg]:overflow-visible',
														mode === item.id
															? 'text-teal-500 bg-theme/5'
															: 'text-textcolor/80 hover:bg-theme/5 hover:text-teal-500',
													)}
													aria-label={t(item.labelKey)}
													aria-pressed={mode === item.id}
													onClick={() => skillTryStore.setMode(item.id)}
												>
													<item.icon className="h-4 w-4" />
												</Button>
											</Tooltip>
										))}
									/>
								}
							/>
						)}
						{shareChatNode}
					</AssistantFooter>
				}
			/>
		</div>
	);
});

export default SkillTryPanel;
