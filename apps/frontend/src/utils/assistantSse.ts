/**
 * 知识库助手 SSE 客户端：协议说明见 `docs/knowledge/knowledge-assistant-complete.md` §7。
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

export interface AssistantSseCallbacks {
	onDelta: (text: string) => void;
	onThinking?: (text: string) => void;
	/** ephemeral 模式下发的 stop 句柄（streamId） */
	onMeta?: (meta: { streamId?: string }) => void;
	onStart?: () => void;
	onComplete?: (error?: string) => void;
	onError?: (err: Error) => void;
}

/**
 * 用户主动 `abort()` 时传给 `onComplete` 的哨兵值（非后端错误文案）。
 * 业务侧应跳过「成功后拉会话对齐」等逻辑，避免服务端尚未落库时覆盖本地已生成片段。
 */
export const ASSISTANT_SSE_USER_ABORT_MARKER =
	'__FRONT_ASSISTANT_SSE_USER_ABORT__';

/**
 * 知识库右侧助手：消费后端 `/assistant/sse` 的 NestJS Sse 行协议（data: JSON）。
 * 与主聊天 `streamFetch` 的智谱包格式不同，故单独解析。
 */
export async function streamAssistantSse(options: {
	api?: string;
	body: Record<string, unknown>;
	callbacks: AssistantSseCallbacks;
}): Promise<() => void> {
	const { api = '/assistant/sse', body, callbacks } = options;
	const { onDelta, onThinking, onMeta, onStart, onComplete, onError } =
		callbacks;

	const controller = new AbortController();

	try {
		onStart?.();
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
						if (!dataStr) continue;
						let parsed: Record<string, unknown>;
						try {
							parsed = JSON.parse(dataStr) as Record<string, unknown>;
						} catch {
							Toast({
								type: 'error',
								title: '助手流解析失败',
							});
							continue;
						}

						if (typeof parsed.error === 'string' && parsed.error) {
							finish(parsed.error);
							break readLoop;
						}
						if (parsed.done === true) {
							finish();
							break readLoop;
						}
						if (parsed.type === 'thinking') {
							const raw = parsed.raw;
							const t =
								typeof raw === 'string'
									? raw
									: typeof parsed.content === 'string'
										? parsed.content
										: '';
							if (t) onThinking?.(t);
							continue;
						}
						if (parsed.type === 'meta') {
							// 约定：meta 里可包含 streamId（ephemeral stop 句柄）
							const raw = parsed.raw;
							if (raw && typeof raw === 'object') {
								const o = raw as { streamId?: unknown };
								const streamId =
									typeof o.streamId === 'string' ? o.streamId : undefined;
								onMeta?.({ streamId });
							}
							continue;
						}
						if (parsed.type === 'usage') {
							continue;
						}
						if (
							parsed.type === 'content' &&
							typeof parsed.content === 'string'
						) {
							onDelta(parsed.content);
						}
					}
				}
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') {
					finish(ASSISTANT_SSE_USER_ABORT_MARKER);
					return;
				}
				const e =
					err instanceof Error ? err : new Error(String(err ?? '请求中断'));
				onError?.(e);
			}
		})();
	} catch (err: unknown) {
		const e = err instanceof Error ? err : new Error(String(err ?? '请求失败'));
		onError?.(e);
	}

	return () => controller.abort();
}
