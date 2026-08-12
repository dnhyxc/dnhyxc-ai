/**
 * 知识库助手底部：轻量非受控输入 + 与消息区解耦的 footer 挂载。
 */
import { Button, Toast } from '@ui/index';
import { observer } from 'mobx-react';
import {
	type Dispatch,
	forwardRef,
	memo,
	type ReactNode,
	type SetStateAction,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import {
	AssistantFooter,
	AssistantSessionEntryToolbar,
	AssistantShareBar,
	type ScrollFabMode,
} from '@/components/design/Assistant';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import assistantStore from '@/store/assistant';
import knowledgeRagQaStore from '@/store/knowledgeRagQa';
import type { Message } from '@/types/chat';
import {
	KNOWLEDGE_ASSISTANT_MODES,
	type KnowledgeAssistantPanelMode,
} from './constants';
import KnowledgeAssistantEntry, {
	type KnowledgeAssistantEntryHandle,
} from './KnowledgeAssistantEntry';

export type KnowledgeAssistantChatFooterHandle = {
	appendInput: (text: string, mode?: KnowledgeAssistantPanelMode) => void;
	clearInputs: () => void;
	focusInputAtEnd: () => void;
};

type EntryToolbarProps = {
	assistantMode: KnowledgeAssistantPanelMode;
	setAssistantMode: (mode: KnowledgeAssistantPanelMode) => void;
	showEntryToolbar: boolean;
	showAiSessionActions: boolean;
	isAiSessionSwitcherLocked: boolean;
	enableStreamStickToBottom: () => void;
	flushScrollToBottom: (options?: { force?: boolean }) => void;
};

/** 工具条与输入分离：模式/历史切换不随 textarea 按键重渲染 */
const KnowledgeAssistantEntryToolbar = memo(
	function KnowledgeAssistantEntryToolbar({
		assistantMode,
		setAssistantMode,
		showEntryToolbar,
		showAiSessionActions,
		isAiSessionSwitcherLocked,
		enableStreamStickToBottom,
		flushScrollToBottom,
	}: EntryToolbarProps) {
		const { t } = useI18n();
		const [isAiHistoryDrawerOpen, setIsAiHistoryDrawerOpen] = useState(false);

		useEffect(() => {
			if (!isAiHistoryDrawerOpen) return;
			void assistantStore.refreshSessionListForCurrentDocument();
		}, [isAiHistoryDrawerOpen]);

		return (
			<AssistantSessionEntryToolbar
				store="document"
				visible={showEntryToolbar}
				showSessionActions={showAiSessionActions}
				isSessionSwitcherLocked={isAiSessionSwitcherLocked}
				isHistoryDrawerOpen={isAiHistoryDrawerOpen}
				setIsHistoryDrawerOpen={setIsAiHistoryDrawerOpen}
				enableStreamStickToBottom={enableStreamStickToBottom}
				flushScrollToBottom={flushScrollToBottom}
				extraActions={KNOWLEDGE_ASSISTANT_MODES.map((item) => (
					<Button
						key={item.id}
						variant="link"
						size="sm"
						className={cn(
							'px-2.5 border border-theme/10',
							assistantMode === item.id
								? 'text-teal-500 bg-theme/5'
								: 'text-textcolor/80 hover:bg-theme/5',
						)}
						onClick={() => setAssistantMode(item.id)}
					>
						<item.icon />
						{t(item.labelKey)}
					</Button>
				))}
			/>
		);
	},
);

type KnowledgeAssistantChatFooterProps = {
	documentKey: string;
	isLoggedIn: boolean;
	isRagMode: boolean;
	assistantMode: KnowledgeAssistantPanelMode;
	setAssistantMode: (mode: KnowledgeAssistantPanelMode) => void;
	onAssistantModeChange?: (mode: KnowledgeAssistantPanelMode) => void;
	input?: string;
	setInput?: Dispatch<SetStateAction<string>>;
	ragInput?: string;
	setRagInput?: Dispatch<SetStateAction<string>>;
	focusInputAtEndKey?: number;
	conversationColumnActive: boolean;
	scrollFabMode: ScrollFabMode;
	onScrollFabClick: () => void;
	enableStreamStickToBottom: () => void;
	flushScrollToBottom: (options?: { force?: boolean }) => void;
	isSending: boolean;
	isStreaming: boolean;
	onStopGenerating: () => void;
	allowAiShare: boolean;
	shareSelection: {
		isSharing: boolean;
		checkedMessages: Set<string>;
		selectedPairCount: number;
		replaceCheckedMessages: (ids: string[]) => void;
		isAllChecked: (messages?: Message[]) => boolean;
		setAllCheckedMessages: (messages?: Message[]) => void;
		clearAllCheckedMessages: () => void;
	};
	shareFlow: { onCancelShare: () => void };
	setShareModelVisible: Dispatch<SetStateAction<boolean>>;
	shareChatNode: ReactNode;
	aiMessages: readonly Message[];
	showEntryToolbar: boolean;
	showAiSessionActions: boolean;
	isAiSessionSwitcherLocked: boolean;
};

/** 仅订阅 isSending / isStreaming */
const KnowledgeAssistantFooterControls = observer(
	function KnowledgeAssistantFooterControls({
		isRagMode,
		children,
	}: {
		isRagMode: boolean;
		children: (controls: {
			isSending: boolean;
			isStreaming: boolean;
		}) => React.ReactNode;
	}) {
		const isSending = isRagMode
			? knowledgeRagQaStore.isSending
			: assistantStore.isSending;
		const isStreaming = isRagMode
			? knowledgeRagQaStore.isStreaming
			: assistantStore.isStreaming;
		return children({ isSending, isStreaming });
	},
);

const KnowledgeAssistantChatFooterInner = forwardRef<
	KnowledgeAssistantChatFooterHandle,
	KnowledgeAssistantChatFooterProps
>(function KnowledgeAssistantChatFooter(props, ref) {
	const {
		documentKey,
		isLoggedIn,
		isRagMode,
		assistantMode,
		setAssistantMode,
		onAssistantModeChange,
		input: inputProp,
		setInput: setInputProp,
		ragInput: ragInputProp,
		setRagInput: setRagInputProp,
		focusInputAtEndKey: focusInputAtEndKeyProp = 0,
		conversationColumnActive,
		scrollFabMode,
		onScrollFabClick,
		enableStreamStickToBottom,
		flushScrollToBottom,
		isSending,
		isStreaming,
		onStopGenerating,
		allowAiShare,
		shareSelection,
		shareFlow,
		setShareModelVisible,
		shareChatNode,
		aiMessages,
		showEntryToolbar,
		showAiSessionActions,
		isAiSessionSwitcherLocked,
	} = props;

	const { knowledgeStore } = useStore();
	const { t } = useI18n();
	const editorHasBody = knowledgeStore.markdownNonempty;
	const entryRef = useRef<KnowledgeAssistantEntryHandle>(null);
	const aiDraftRef = useRef('');
	const ragDraftRef = useRef('');
	const prevRagModeRef = useRef(isRagMode);
	const [internalFocusInputAtEndKey, setInternalFocusInputAtEndKey] =
		useState(0);
	const focusInputAtEndKey =
		focusInputAtEndKeyProp + internalFocusInputAtEndKey;

	const isControlled = inputProp !== undefined || ragInputProp !== undefined;

	const appendInputBlock = useCallback(
		(text: string, mode: KnowledgeAssistantPanelMode = assistantMode) => {
			const next = text.trim();
			if (!next) return;
			const appendBlock = (prev: string) => {
				const cur = (prev ?? '').trim();
				return cur ? `${cur}\n\n${next}` : next;
			};
			if (mode === 'rag') {
				ragDraftRef.current = appendBlock(ragDraftRef.current);
				if (isRagMode) entryRef.current?.setValue(ragDraftRef.current);
				setRagInputProp?.(ragDraftRef.current);
			} else {
				aiDraftRef.current = appendBlock(aiDraftRef.current);
				if (!isRagMode) entryRef.current?.setValue(aiDraftRef.current);
				setInputProp?.(aiDraftRef.current);
			}
		},
		[assistantMode, isRagMode, setInputProp, setRagInputProp],
	);

	useImperativeHandle(
		ref,
		() => ({
			appendInput: (text, mode) =>
				appendInputBlock(text, mode ?? assistantMode),
			clearInputs: () => {
				aiDraftRef.current = '';
				ragDraftRef.current = '';
				entryRef.current?.clear();
				setInputProp?.('');
				setRagInputProp?.('');
			},
			focusInputAtEnd: () => {
				setInternalFocusInputAtEndKey((n) => n + 1);
				entryRef.current?.focusAtEnd();
			},
		}),
		[appendInputBlock, assistantMode, setInputProp, setRagInputProp],
	);

	// 仅换篇清空；首挂载草稿本为空，勿清（避免冲掉「开栏后写入」的复制选区）
	const prevDocumentKeyRef = useRef<string | null>(null);
	useEffect(() => {
		const prev = prevDocumentKeyRef.current;
		prevDocumentKeyRef.current = documentKey;
		if (prev === null || prev === documentKey) return;
		aiDraftRef.current = '';
		ragDraftRef.current = '';
		entryRef.current?.clear();
		setInputProp?.('');
		setRagInputProp?.('');
	}, [documentKey, setInputProp, setRagInputProp]);

	useLayoutEffect(() => {
		onAssistantModeChange?.(assistantMode);
	}, [assistantMode, onAssistantModeChange]);

	// AI/RAG 切换：草稿存 ref，不触发输入区每键重渲染
	useLayoutEffect(() => {
		if (prevRagModeRef.current === isRagMode) return;
		const entry = entryRef.current;
		if (entry) {
			if (prevRagModeRef.current) {
				ragDraftRef.current = entry.getValue();
			} else {
				aiDraftRef.current = entry.getValue();
			}
			entry.setValue(isRagMode ? ragDraftRef.current : aiDraftRef.current);
		}
		prevRagModeRef.current = isRagMode;
	}, [isRagMode]);

	useEffect(() => {
		if (assistantMode !== 'ai') return;
		if (knowledgeStore.markdownNonempty) return;
		const id = window.setTimeout(() => {
			if (!knowledgeStore.markdownNonempty) {
				// 开栏瞬间 Monaco 重挂载可能短暂空正文；有草稿（含复制选区）则保留
				const cur =
					entryRef.current?.getValue()?.trim() || aiDraftRef.current.trim();
				if (cur) return;
				aiDraftRef.current = '';
				if (!isRagMode) entryRef.current?.clear();
				setInputProp?.('');
			}
		}, 200);
		return () => window.clearTimeout(id);
	}, [
		knowledgeStore.markdownNonempty,
		setInputProp,
		knowledgeStore,
		assistantMode,
		isRagMode,
	]);

	// 外部受控 input（可选）：同步进 textarea
	useLayoutEffect(() => {
		if (!isControlled) return;
		const next = isRagMode ? (ragInputProp ?? '') : (inputProp ?? '');
		entryRef.current?.setValue(next);
		if (isRagMode) ragDraftRef.current = next;
		else aiDraftRef.current = next;
	}, [isControlled, isRagMode, inputProp, ragInputProp]);

	const onSend = useCallback(
		async (text: string) => {
			if (!isLoggedIn) {
				Toast({
					type: 'warning',
					title: t('knowledge.assistant.loginToUse'),
				});
				return;
			}
			if (isRagMode) {
				ragDraftRef.current = '';
				setRagInputProp?.('');
				enableStreamStickToBottom();
				await knowledgeRagQaStore.sendMessage(text);
				return;
			}
			if (!editorHasBody) {
				Toast({
					type: 'warning',
					title: t('knowledge.assistant.enterBodyFirst'),
				});
				return;
			}
			aiDraftRef.current = '';
			setInputProp?.('');
			enableStreamStickToBottom();
			await assistantStore.sendMessage(text);
		},
		[
			isLoggedIn,
			isRagMode,
			editorHasBody,
			enableStreamStickToBottom,
			setInputProp,
			setRagInputProp,
			t,
		],
	);

	const toolbar = (
		<KnowledgeAssistantEntryToolbar
			assistantMode={assistantMode}
			setAssistantMode={setAssistantMode}
			showEntryToolbar={showEntryToolbar}
			showAiSessionActions={showAiSessionActions}
			isAiSessionSwitcherLocked={isAiSessionSwitcherLocked}
			enableStreamStickToBottom={enableStreamStickToBottom}
			flushScrollToBottom={flushScrollToBottom}
		/>
	);

	if (!isLoggedIn) return null;

	return (
		<AssistantFooter
			embedded={conversationColumnActive}
			showScrollFab={conversationColumnActive && scrollFabMode !== 'hidden'}
			scrollFab={{
				mode: scrollFabMode,
				onClick: onScrollFabClick,
				toBottomLabel: t('knowledge.assistant.scrollToBottom'),
				toTopLabel: t('knowledge.assistant.scrollToTop'),
			}}
		>
			{allowAiShare && shareSelection.isSharing ? (
				<AssistantShareBar
					messages={[...aiMessages]}
					checkboxId="knowledge-assistant-share-all"
					selectAllLabelKey="knowledge.assistant.share.selectAll"
					createLinkLabelKey="knowledge.assistant.share.createLink"
					shareSelection={shareSelection}
					shareFlow={shareFlow}
					setShareModelVisible={setShareModelVisible}
				/>
			) : (
				<KnowledgeAssistantEntry
					ref={entryRef}
					focusInputAtEndKey={focusInputAtEndKey}
					className="w-full px-0 pb-4"
					textareaClassName="min-h-9"
					inputWrapClassName="border-theme/5"
					onSend={onSend}
					placeholder={
						isRagMode
							? t('knowledge.assistant.placeholder.rag')
							: editorHasBody
								? t('knowledge.assistant.placeholder.ai')
								: t('knowledge.assistant.placeholder.aiNeedsBody')
					}
					disableTextInput={isRagMode ? false : !editorHasBody}
					loading={isSending}
					stopGenerating={isStreaming ? onStopGenerating : undefined}
					toolbar={toolbar}
				/>
			)}
			{shareChatNode}
		</AssistantFooter>
	);
});

const KnowledgeAssistantChatFooter = memo(KnowledgeAssistantChatFooterInner);

export { KnowledgeAssistantChatFooter, KnowledgeAssistantFooterControls };
