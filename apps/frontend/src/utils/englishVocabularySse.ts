/**
 * 英语学习单词包：消费 `POST /english-learning/vocabulary-pack/stream` 的 SSE（data: JSON）。
 */
import { Toast } from '@ui/index';
import { BASE_URL } from '@/constant';
import { notifyUnauthorized } from '@/router/authSession';
import type { EnglishVocabularyItem } from '@/service';
import { ENGLISH_LEARNING_VOCABULARY_PACK_STREAM } from '@/service/api';
import { getPlatformFetch } from '@/utils/fetch';

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token') || '';
}

function unwrapVocabPayload(
	raw: Record<string, unknown>,
): Record<string, unknown> {
	const inner = raw.data;
	if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
		const o = inner as Record<string, unknown>;
		if (typeof o.type === 'string' && o.type.startsWith('vocab.')) {
			return o;
		}
	}
	return raw;
}

function parseItems(raw: unknown): EnglishVocabularyItem[] {
	if (!Array.isArray(raw)) return [];
	const out: EnglishVocabularyItem[] = [];
	for (const x of raw) {
		if (!x || typeof x !== 'object') continue;
		const o = x as Record<string, unknown>;
		if (typeof o.word !== 'string' || typeof o.ipa !== 'string') continue;
		out.push({
			word: o.word,
			ipa: o.ipa,
			translationZh:
				typeof o.translationZh === 'string' ? o.translationZh : '—',
			example: typeof o.example === 'string' ? o.example : '—',
		});
	}
	return out;
}

export type EnglishVocabStreamProgress = {
	collected: number;
	target: number;
	round: number;
};

export type EnglishVocabStreamChunk = {
	/** 与后端 SSE 一致，用于关联 DB 批次 */
	streamId?: string;
	round: number;
	collected: number;
	target: number;
	items: EnglishVocabularyItem[];
};

/** Agent 检索阶段工具事件（与后端 `vocab.agent_tool` 对齐） */
export type EnglishVocabAgentToolEvent = {
	phase: 'start' | 'end';
	name: string;
	/** 工具入参摘要（如检索关键词） */
	query?: string;
};

export type EnglishVocabStreamCallbacks = {
	onProgress?: (p: EnglishVocabStreamProgress) => void;
	/** Agent 调用联网 / 知识库等工具时回调，用于前端展示 */
	onAgentTool?: (e: EnglishVocabAgentToolEvent) => void;
	/** 每轮 LLM 合并后的新词条（与后端入库批次一致），用于实时追加 UI */
	onChunk?: (chunk: EnglishVocabStreamChunk) => void;
	/** 正常结束：携带词条与请求条数（用于部分成功提示） */
	onDone?: (payload: {
		items: EnglishVocabularyItem[];
		requested: number;
		streamId?: string;
	}) => void;
	onError?: (message: string) => void;
	/** 用户点击取消触发的中断（非静默替换上一轮请求） */
	onUserAbort?: () => void;
	/** 流结束但未收到 complete（网络异常等） */
	onIncomplete?: () => void;
};

/**
 * 发起单词包 SSE；返回 `abort(fromUser?)`：`fromUser===true` 时视为用户取消，触发 onUserAbort。
 */
export async function streamEnglishVocabularyPack(options: {
	api?: string;
	body: {
		topic: string;
		count: number;
		level?: 'basic' | 'intermediate' | 'advanced';
	};
	callbacks: EnglishVocabStreamCallbacks;
}): Promise<(fromUser?: boolean) => void> {
	const {
		api = ENGLISH_LEARNING_VOCABULARY_PACK_STREAM,
		body,
		callbacks,
	} = options;
	const {
		onProgress,
		onAgentTool,
		onChunk,
		onDone,
		onError,
		onUserAbort,
		onIncomplete,
	} = callbacks;

	const controller = new AbortController();
	let userAbortRequested = false;
	let receivedComplete = false;
	let endedWithError = false;

	try {
		const platformFetch = await getPlatformFetch();
		const response = await platformFetch(BASE_URL + api, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${readToken()}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});

		if (!response.ok) {
			if (response.status === 401) {
				notifyUnauthorized();
				throw new Error('请先登录后再试');
			}
			throw new Error(`HTTP ${response.status}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('无法读取流式响应');
		}

		const decoder = new TextDecoder('utf-8');
		let buffer = '';

		const processLine = (line: string): boolean => {
			const trimmed = line.trim();
			if (!trimmed.startsWith('data:')) return false;
			const dataStr = trimmed.slice(5).trimStart();
			if (!dataStr) return false;

			let raw: Record<string, unknown>;
			try {
				raw = JSON.parse(dataStr) as Record<string, unknown>;
			} catch {
				Toast({ type: 'error', title: '单词包流解析失败' });
				return false;
			}

			const parsed = unwrapVocabPayload(raw);
			const type = parsed.type;

			console.log(type, 'type');

			if (type === 'vocab.progress') {
				const collected = Number(parsed.collected);
				const target = Number(parsed.target);
				const round = Number(parsed.round);
				if (
					Number.isFinite(collected) &&
					Number.isFinite(target) &&
					Number.isFinite(round)
				) {
					onProgress?.({ collected, target, round });
				}
				return false;
			}

			if (type === 'vocab.agent_tool') {
				const phase = parsed.phase === 'end' ? 'end' : 'start';
				const name = typeof parsed.name === 'string' ? parsed.name : '';
				const query =
					typeof parsed.query === 'string' ? parsed.query : undefined;
				onAgentTool?.({ phase, name, query });
				return false;
			}

			if (type === 'vocab.chunk') {
				const collected = Number(parsed.collected);
				const target = Number(parsed.target);
				const round = Number(parsed.round);
				const items = parseItems(parsed.items);
				const streamId =
					typeof parsed.streamId === 'string' ? parsed.streamId : undefined;
				if (
					items.length > 0 &&
					Number.isFinite(collected) &&
					Number.isFinite(target) &&
					Number.isFinite(round)
				) {
					onChunk?.({
						streamId,
						round,
						collected,
						target,
						items,
					});
				}
				return false;
			}

			if (type === 'vocab.complete') {
				receivedComplete = true;
				const items = parseItems(parsed.items);
				const requested = Number(parsed.requested);
				const streamId =
					typeof parsed.streamId === 'string' ? parsed.streamId : undefined;
				onDone?.({
					items,
					requested: Number.isFinite(requested) ? requested : items.length,
					streamId,
				});
				return true;
			}

			if (type === 'vocab.error') {
				endedWithError = true;
				const message =
					typeof parsed.message === 'string'
						? parsed.message
						: '生成单词资料失败';
				onError?.(message);
				return true;
			}
			return false;
		};

		void (async () => {
			try {
				readLoop: while (true) {
					const { done, value } = await reader.read();
					if (value) {
						const chunk = decoder.decode(value, { stream: true });
						buffer += chunk;
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						for (const line of lines) {
							if (processLine(line)) break readLoop;
						}
					}

					if (done) {
						const tail = buffer.trim();
						if (tail) {
							for (const line of tail.split('\n')) {
								if (processLine(line)) break;
							}
						}
						buffer = '';
						break;
					}
				}

				if (!receivedComplete && !userAbortRequested && !endedWithError) {
					onIncomplete?.();
				}
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') {
					if (userAbortRequested) {
						onUserAbort?.();
					}
					// 静默替换上一轮请求时也会 Abort，不当作错误
					return;
				}
				const message =
					err instanceof Error ? err.message : String(err ?? '请求中断');
				onError?.(message);
			}
		})();
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : String(err ?? '请求失败');
		onError?.(message);
	}

	return (fromUser?: boolean) => {
		if (fromUser === true) {
			userAbortRequested = true;
		}
		controller.abort();
	};
}
