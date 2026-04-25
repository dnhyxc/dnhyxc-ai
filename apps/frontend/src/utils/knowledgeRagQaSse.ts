/**
 * 知识库 RAG 问答 SSE：对齐后端 `KnowledgeQaController` 的 `@Sse()` 行协议（`data: JSON`）。
 */
import { Toast } from '@ui/index';
import { BASE_URL } from '@/constant';
import { notifyUnauthorized } from '@/router/authSession';
import { getPlatformFetch } from '@/utils/fetch';

function readToken(): string {
	if (typeof window === 'undefined') {
		return '';
	}
	return localStorage.getItem('token') || '';
}

/** 后端推送的单条事件（扁平或嵌套在 data 下） */
export type KnowledgeQaSsePayload = {
	type?: string;
	runId?: string;
	content?: string;
	message?: string;
	evidences?: unknown;
};

export interface KnowledgeRagQaSseCallbacks {
	onStart?: (runId: string) => void;
	onRetrieval?: (evidences: unknown) => void;
	onDelta?: (text: string) => void;
	onDone?: (evidences: unknown) => void;
	onError?: (message: string) => void;
	onComplete?: (error?: string) => void;
}

function unwrapPayload(raw: Record<string, unknown>): KnowledgeQaSsePayload {
	const inner = raw.data;
	if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
		return inner as KnowledgeQaSsePayload;
	}
	return raw as KnowledgeQaSsePayload;
}

/**
 * 消费 `POST /knowledge/qa/ask` 的 SSE；返回 `abort()`，仅应由显式 stop 或发起新流前调用。
 */
export async function streamKnowledgeQaSse(options: {
	api?: string;
	body: Record<string, unknown>;
	callbacks: KnowledgeRagQaSseCallbacks;
}): Promise<() => void> {
	const { api = '/knowledge/qa/ask', body, callbacks } = options;
	const { onStart, onRetrieval, onDelta, onDone, onError, onComplete } =
		callbacks;

	const controller = new AbortController();

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
			throw new Error(`HTTP error! status: ${response.statusText}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('无法读取流式响应');
		}

		const decoder = new TextDecoder('utf-8');
		let buffer = '';
		let streamFinished = false;
		const finish = (err?: string) => {
			if (streamFinished) return;
			streamFinished = true;
			onComplete?.(err);
		};

		(async () => {
			try {
				readLoop: while (true) {
					const { done, value } = await reader.read();
					if (done) {
						finish();
						break;
					}

					const chunk = decoder.decode(value, { stream: true });
					buffer += chunk;
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed.startsWith('data:')) continue;
						const dataStr = trimmed.slice(5).trimStart();
						if (!dataStr || dataStr === '[DONE]') continue;

						let raw: Record<string, unknown>;
						try {
							raw = JSON.parse(dataStr) as Record<string, unknown>;
						} catch {
							Toast({ type: 'error', title: 'RAG 流解析失败' });
							continue;
						}

						const parsed = unwrapPayload(raw);
						const t = parsed.type;

						if (t === 'qa.sse.done') {
							finish();
							break readLoop;
						}
						if (t === 'qa.start' && typeof parsed.runId === 'string') {
							onStart?.(parsed.runId);
							continue;
						}
						if (t === 'qa.retrieval') {
							onRetrieval?.(parsed.evidences);
							continue;
						}
						if (t === 'qa.delta' && typeof parsed.content === 'string') {
							onDelta?.(parsed.content);
							continue;
						}
						if (t === 'qa.done') {
							onDone?.(parsed.evidences);
							continue;
						}
						if (t === 'qa.error') {
							const msg =
								typeof parsed.message === 'string'
									? parsed.message
									: 'RAG 请求失败';
							onError?.(msg);
							finish(msg);
							break readLoop;
						}
					}
				}
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') {
					finish();
					return;
				}
				const e =
					err instanceof Error ? err : new Error(String(err ?? '请求中断'));
				onError?.(e.message);
				onComplete?.(e.message);
			}
		})();
	} catch (err: unknown) {
		const e = err instanceof Error ? err : new Error(String(err ?? '请求失败'));
		onError?.(e.message);
		onComplete?.(e.message);
	}

	return () => controller.abort();
}
