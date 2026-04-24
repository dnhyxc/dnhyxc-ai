/**
 * 文档侧边助手 UI 模板（React + Tailwind CSS）。
 *
 * 适配点：
 * - 你可以把 Button/ScrollArea/Toast/Input 组件替换为项目内组件库（例如 shadcn/ui、antd 等）
 * - 你可以把消息渲染替换为你项目的 Markdown 渲染器（例如 md-editor-rt、react-markdown 等）
 */

import { observer } from 'mobx-react';
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { assistantStore, UiMessage } from './assistantStore';
import { cn } from './cn';

export type KnowledgeAssistantPromptKind = 'polish' | 'summarize';
export type PromptItem = {
	kind: KnowledgeAssistantPromptKind;
	title: string;
	description: string;
};

const DEFAULT_PROMPTS: PromptItem[] = [
	{ kind: 'polish', title: '润色', description: '润色当前文档表达与结构' },
	{ kind: 'summarize', title: '总结', description: '提炼当前文档要点与结论' },
];

export interface AssistantUiAdapter {
	Toast: (input: {
		type: 'success' | 'warning' | 'error';
		title: string;
	}) => void;
	ScrollArea: React.ForwardRefExoticComponent<
		React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>
	>;
	Button: React.ComponentType<
		React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }
	>;
	MessageRenderer: React.ComponentType<{
		message: UiMessage;
		className?: string;
	}>;
	ChatEntry: React.ComponentType<{
		input: string;
		setInput: (v: string) => void;
		onSend: (v?: string) => void | Promise<void>;
		placeholder?: string;
		disabled?: boolean;
		loading?: boolean;
		onStop?: (() => void) | undefined;
		className?: string;
	}>;
}

export interface KnowledgeAssistantProps {
	documentKey: string;
	/** 当前文档正文（用于快捷卡片把全文发给模型） */
	documentMarkdown: string;
	/** 是否已登录（控制入口与提示） */
	isLoggedIn: boolean;
	/** 是否允许持久化：未保存草稿时建议为 false（走 ephemeral） */
	persistenceAllowed: boolean;
	/** 适配器 */
	ui: AssistantUiAdapter;
	/** 快捷卡片（可选） */
	prompts?: PromptItem[];
	/**
	 * 快捷卡片：构造「气泡短句 + 给模型的附加上下文」。
	 * 若不传使用默认实现（polish/summarize）。
	 */
	buildPromptMessage?: (
		kind: KnowledgeAssistantPromptKind,
		documentMarkdown: string,
	) => { userMessageShort: string; extraUserContentForModel: string };
	/** 将助手内容追加回文档（可选） */
	onAppendToDocument?: (text: string) => void;
}

function defaultBuildPromptMessage(
	kind: KnowledgeAssistantPromptKind,
	documentMarkdown: string,
): { userMessageShort: string; extraUserContentForModel: string } {
	const doc = documentMarkdown.replace(/\s+$/, '');
	if (kind === 'polish') {
		return {
			userMessageShort: '润色文档内容',
			extraUserContentForModel: `请根据以下「当前文档」全文进行润色与优化（保留原意、专有名词与代码块语义）。可直接给出润色后的全文，或先简述改动要点再给出全文（二选一即可）。\n\n--- 文档 ---\n${doc}\n--- 文档结束 ---`,
		};
	}
	return {
		userMessageShort: '总结文档内容',
		extraUserContentForModel: `请根据以下「当前文档」全文输出一份简洁的中文总结：覆盖主要信息层次与要点，必要时使用小节标题或条目列表；不必重复粘贴全文。\n\n--- 文档 ---\n${doc}\n--- 文档结束 ---`,
	};
}

export const KnowledgeAssistant = observer(function KnowledgeAssistant(
	props: KnowledgeAssistantProps,
) {
	const {
		documentKey,
		documentMarkdown,
		isLoggedIn,
		persistenceAllowed,
		ui,
		prompts = DEFAULT_PROMPTS,
		buildPromptMessage = defaultBuildPromptMessage,
		onAppendToDocument,
	} = props;

	const { Toast, ScrollArea, Button, MessageRenderer, ChatEntry } = ui;

	const [input, setInput] = useState('');
	const [copiedId, setCopiedId] = useState('');
	const copyTimerRef = useRef<number | null>(null);

	const scrollViewportRef = useRef<HTMLDivElement | null>(null);
	const [scrollFabMode, setScrollFabMode] = useState<
		'hidden' | 'toBottom' | 'toTop'
	>('hidden');

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
		};
	}, []);

	useEffect(() => {
		assistantStore.setPersistenceAllowed(persistenceAllowed);
	}, [persistenceAllowed]);

	useEffect(() => {
		if (!documentKey) return;
		void assistantStore.activateForDocument(documentKey);
	}, [documentKey]);

	const editorHasBody = Boolean((documentMarkdown ?? '').trim());

	const refreshFab = useCallback(() => {
		const vp = scrollViewportRef.current;
		if (!vp) return;
		const maxScroll = vp.scrollHeight - vp.clientHeight;
		if (maxScroll <= 4) {
			setScrollFabMode('hidden');
			return;
		}
		const threshold = 8;
		setScrollFabMode(
			vp.scrollTop >= maxScroll - threshold ? 'toTop' : 'toBottom',
		);
	}, []);

	const onScroll = useCallback(() => refreshFab(), [refreshFab]);

	useEffect(() => {
		const vp = scrollViewportRef.current;
		if (!vp) return;
		refreshFab();
		const ro = new ResizeObserver(() => refreshFab());
		ro.observe(vp);
		return () => ro.disconnect();
	}, [refreshFab, assistantStore.messages.length]);

	const onScrollFabClick = useCallback(() => {
		const vp = scrollViewportRef.current;
		if (!vp) return;
		if (scrollFabMode === 'toBottom') {
			vp.scrollTo({
				top: vp.scrollHeight - vp.clientHeight,
				behavior: 'smooth',
			});
		} else if (scrollFabMode === 'toTop') {
			vp.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}, [scrollFabMode]);

	const onCopy = useCallback((text: string, chatId: string) => {
		void navigator.clipboard.writeText(text);
		setCopiedId(chatId);
		if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
		copyTimerRef.current = window.setTimeout(() => setCopiedId(''), 500);
	}, []);

	const onSaveToDocument = useCallback(
		(message: UiMessage) => {
			const body = (message.content ?? '').trim();
			if (!body) {
				Toast({ type: 'warning', title: '没有可写入的正文' });
				return;
			}
			onAppendToDocument?.(body);
			Toast({ type: 'success', title: '已追加到当前文档' });
		},
		[Toast, onAppendToDocument],
	);

	const sendMessage = useCallback(
		async (content?: string) => {
			const text = (content ?? input).trim();
			if (!text) return;
			if (!isLoggedIn) {
				Toast({ type: 'warning', title: '请先登录后再使用助手' });
				return;
			}
			if (!editorHasBody) return;
			setInput('');
			await assistantStore.sendMessage(text);
			requestAnimationFrame(() => {
				const vp = scrollViewportRef.current;
				if (vp) vp.scrollTo({ top: vp.scrollHeight, behavior: 'smooth' });
			});
		},
		[input, isLoggedIn, editorHasBody, Toast],
	);

	const sendPromptCard = useCallback(
		async (kind: KnowledgeAssistantPromptKind) => {
			if (!isLoggedIn) {
				Toast({ type: 'warning', title: '请先登录后再使用助手' });
				return;
			}
			const md = (documentMarkdown ?? '').trim();
			if (!md) {
				Toast({ type: 'warning', title: '请先输入正文后再使用快捷卡片' });
				return;
			}
			if (
				assistantStore.isSending ||
				assistantStore.isHistoryLoading ||
				assistantStore.isStreaming
			) {
				Toast({ type: 'warning', title: '请等待当前回复结束后再试' });
				return;
			}
			const { userMessageShort, extraUserContentForModel } = buildPromptMessage(
				kind,
				md,
			);
			await assistantStore.sendMessage(userMessageShort, {
				extraUserContentForModel,
			});
		},
		[isLoggedIn, documentMarkdown, Toast, buildPromptMessage],
	);

	const stop = useCallback(() => void assistantStore.stopGenerating(), []);

	const messages = assistantStore.messages;
	const showEmpty = !assistantStore.isHistoryLoading && messages.length === 0;

	return (
		<div className="relative flex h-full w-full flex-col overflow-hidden">
			{assistantStore.isHistoryLoading ? (
				<div className="flex flex-1 items-center justify-center text-sm text-textcolor/70">
					正在加载对话…
				</div>
			) : showEmpty ? (
				<div className="flex flex-1 items-start justify-center pt-4 px-4 text-sm text-textcolor/70">
					{editorHasBody ? (
						<div className="w-full flex flex-col gap-2">
							<div className="w-full flex gap-3">
								{prompts.map((p) => (
									<button
										key={p.kind}
										type="button"
										className={cn(
											'flex-1 flex items-start gap-2 border border-theme/10 bg-theme/5 text-textcolor hover:bg-theme/15 py-2 pl-2 pr-2.5 rounded-md cursor-pointer text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-theme/40',
											(assistantStore.isSending ||
												assistantStore.isHistoryLoading ||
												assistantStore.isStreaming) &&
												'pointer-events-none opacity-50',
										)}
										onClick={() => void sendPromptCard(p.kind)}
									>
										<div className="mt-0.5 h-5 w-5 shrink-0 rounded bg-teal-500/15" />
										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<span className="text-base font-medium">{p.title}</span>
											<span className="text-sm text-textcolor/80">
												{p.description}
											</span>
										</div>
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="w-full flex justify-between bg-theme/5 p-2 rounded-md border border-theme/10">
							<div className="mr-2 mt-0.5 h-4.5 w-4.5 rounded bg-teal-500/20" />
							<div className="flex-1">
								Hi，我是你的文档助手。我会结合当前文档内容，帮你润色、总结、答疑与查漏补缺。
							</div>
						</div>
					)}
				</div>
			) : (
				<ScrollArea
					ref={scrollViewportRef}
					className="min-h-0 flex-1"
					onScroll={onScroll}
				>
					<div className="pt-4 max-w-3xl mx-auto relative flex w-full min-w-0 flex-col select-none pr-4 pl-3.5">
						{messages.map((m, idx) => (
							<div
								key={m.chatId}
								className={cn(
									'relative flex min-w-0 max-w-full flex-1 flex-col gap-1 pb-10 w-full group last:pb-8.5',
									m.role === 'user' ? 'items-end' : '',
								)}
							>
								<div
									className={cn(
										'relative flex min-w-0 max-w-full rounded-md p-3 select-auto text-textcolor mb-5',
										m.role === 'user'
											? 'w-fit max-w-full self-end bg-teal-600/5 border border-teal-500/15 text-end pt-2 pb-2.5 px-3'
											: 'flex-1 bg-theme/5 border border-theme/10',
									)}
								>
									<MessageRenderer
										message={m}
										className="text-left min-w-0 max-w-full [&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-full [&_.markdown-body]:overflow-x-auto"
									/>

									<div
										className={cn(
											'absolute -bottom-9',
											m.role === 'user' ? 'right-0' : 'left-0',
										)}
									>
										<div className="flex items-center gap-2 text-xs text-textcolor/60">
											<button
												type="button"
												className="hover:text-textcolor"
												onClick={() => onCopy(m.content, m.chatId)}
											>
												{copiedId === m.chatId ? '已复制' : '复制'}
											</button>
											{m.role === 'assistant' && onAppendToDocument ? (
												<button
													type="button"
													className="hover:text-textcolor"
													onClick={() => onSaveToDocument(m)}
												>
													写入文档
												</button>
											) : null}
											<span className="opacity-40">#{idx + 1}</span>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				</ScrollArea>
			)}

			{isLoggedIn ? (
				<div className="relative w-full flex items-center justify-center pr-4 pl-3.5">
					{messages.length > 0 && scrollFabMode !== 'hidden' ? (
						<button
							type="button"
							className={cn(
								'absolute bottom-full mb-5 right-4.5 z-10 flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-full border border-theme/5 bg-theme/5 text-textcolor/70 backdrop-blur-[2px] hover:bg-theme/15',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40',
							)}
							aria-label={
								scrollFabMode === 'toBottom' ? '滚动到底部' : '滚动到顶部'
							}
							onClick={onScrollFabClick}
						>
							{scrollFabMode === 'toBottom' ? '↓' : '↑'}
						</button>
					) : null}

					<ChatEntry
						input={input}
						setInput={setInput}
						onSend={sendMessage}
						placeholder={
							editorHasBody ? '请输入你的问题' : '请先输入正文后再向我提问'
						}
						disabled={!editorHasBody}
						loading={
							assistantStore.isSending || assistantStore.isHistoryLoading
						}
						onStop={assistantStore.isStreaming ? stop : undefined}
						className="w-full pl-0.5 pr-0.5 pb-4.5 border-theme/10"
					/>
				</div>
			) : null}
		</div>
	);
});

/**
 * 你可以用项目内的 classnames 工具替换（例如 clsx + tailwind-merge）。
 * 这里提供一个最小版本的类型占位（见 `cn.ts`）。
 */
