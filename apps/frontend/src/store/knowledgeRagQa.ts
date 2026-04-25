/**
 * 知识库 RAG 问答：全局单会话，不按 documentKey 分桶；与 `assistantStore` 完全隔离。
 */
import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '@/types/chat';
import { streamKnowledgeQaSse } from '@/utils/knowledgeRagQaSse';

export type KnowledgeRagEvidence = {
	knowledgeId: string;
	title: string;
	chunkIndex: number;
	score: number;
	text: string;
};

export interface KnowledgeRagQaStoreApi {
	readonly messages: Message[];
	readonly isSending: boolean;
	readonly isStreaming: boolean;
	readonly loadError: string | null;
	readonly lastRunId: string | null;
	readonly lastEvidences: KnowledgeRagEvidence[];
	sendMessage(question: string): Promise<void>;
	stopGenerating(): void;
	/** 清空 RAG 会话与证据，中止进行中的流（用于「新对话」） */
	resetConversation(): void;
}

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token') || '';
}

export class KnowledgeRagQaStore {
	messages: Message[] = [];
	isSending = false;
	loadError: string | null = null;
	abortStream: (() => void) | null = null;
	lastRunId: string | null = null;
	lastEvidences: KnowledgeRagEvidence[] = [];

	constructor() {
		makeAutoObservable(this);
	}

	get isStreaming(): boolean {
		return this.messages.some((m) => m.isStreaming);
	}

	stopGenerating(): void {
		this.abortStream?.();
		runInAction(() => {
			this.abortStream = null;
			this.isSending = false;
			this.messages = this.messages.map((m) => {
				if (!m.isStreaming) return m;
				return { ...m, isStreaming: false, isStopped: true };
			});
		});
	}

	/** 重置为全新 RAG 会话：中断 SSE、清空消息与检索缓存 */
	resetConversation(): void {
		this.abortStream?.();
		runInAction(() => {
			this.abortStream = null;
			this.isSending = false;
			this.messages = [];
			this.lastEvidences = [];
			this.lastRunId = null;
			this.loadError = null;
		});
	}

	async sendMessage(question: string): Promise<void> {
		const text = (question ?? '').trim();
		if (!text) return;
		if (!readToken()) {
			Toast({ type: 'warning', title: '请先登录后再使用 RAG 助手' });
			return;
		}
		if (this.isSending || this.isStreaming) {
			Toast({ type: 'warning', title: '请等待当前回复结束后再试' });
			return;
		}

		this.abortStream?.();
		runInAction(() => {
			this.abortStream = null;
			this.loadError = null;
			this.isSending = true;
		});

		const userChatId = uuidv4();
		const assistantChatId = uuidv4();

		runInAction(() => {
			this.messages.push({
				chatId: userChatId,
				role: 'user',
				content: text,
				timestamp: new Date(),
			});
			this.messages.push({
				chatId: assistantChatId,
				role: 'assistant',
				content: '',
				timestamp: new Date(),
				isStreaming: true,
				thinkContent: '',
			});
		});

		let accumulated = '';

		const patchAssistant = (delta: string) => {
			if (delta) accumulated += delta;
			runInAction(() => {
				const idx = this.messages.findIndex(
					(m) => m.chatId === assistantChatId,
				);
				if (idx < 0) return;
				const prev = this.messages[idx] as Message;
				this.messages[idx] = {
					...prev,
					content: accumulated,
				};
			});
		};

		try {
			const abort = await streamKnowledgeQaSse({
				body: {
					question: text,
					includeEvidences: true,
				},
				callbacks: {
					onStart: (runId) => {
						runInAction(() => {
							this.lastRunId = runId;
						});
					},
					onRetrieval: (ev) => {
						if (Array.isArray(ev)) {
							runInAction(() => {
								this.lastEvidences = ev as KnowledgeRagEvidence[];
							});
						}
					},
					onDelta: (d) => patchAssistant(d),
					onDone: (ev) => {
						if (Array.isArray(ev)) {
							runInAction(() => {
								this.lastEvidences = ev as KnowledgeRagEvidence[];
							});
						}
						runInAction(() => {
							this.isSending = false;
							const idx = this.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								const prev = this.messages[idx] as Message;
								this.messages[idx] = {
									...prev,
									isStreaming: false,
								};
							}
							this.abortStream = null;
						});
					},
					onError: (msg) => {
						runInAction(() => {
							this.loadError = msg;
							this.isSending = false;
							const idx = this.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								const prev = this.messages[idx] as Message;
								this.messages[idx] = {
									...prev,
									isStreaming: false,
									content: prev.content || msg,
								};
							}
							this.abortStream = null;
						});
					},
					onComplete: (err) => {
						runInAction(() => {
							this.isSending = false;
							const idx = this.messages.findIndex(
								(m) => m.chatId === assistantChatId,
							);
							if (idx >= 0) {
								const prev = this.messages[idx] as Message;
								if (prev.isStreaming) {
									this.messages[idx] = {
										...prev,
										isStreaming: false,
										...(err && !prev.content
											? { content: `生成失败：${err}` }
											: {}),
									};
								}
							}
							this.abortStream = null;
						});
					},
				},
			});
			runInAction(() => {
				this.abortStream = abort;
			});
		} catch {
			runInAction(() => {
				this.isSending = false;
				const idx = this.messages.findIndex(
					(m) => m.chatId === assistantChatId,
				);
				if (idx >= 0) {
					const prev = this.messages[idx] as Message;
					this.messages[idx] = { ...prev, isStreaming: false };
				}
				this.abortStream = null;
			});
		}
	}
}

const _knowledgeRagQaStore = new KnowledgeRagQaStore();
export const knowledgeRagQaStore: KnowledgeRagQaStoreApi = _knowledgeRagQaStore;
export default knowledgeRagQaStore;
