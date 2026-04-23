/**
 * 助手 SSE（Server-Sent Events，服务端事件）客户端。
 *
 * 约定协议（示例）：
 * - Content-Type: text/event-stream
 * - 每行：`data: { ...json }\n`
 * - payload：
 *   - `{ type: "content", content: "..." }`  -> 正文增量
 *   - `{ type: "thinking", raw?: "...", content?: "..." }` -> 思考增量（可选）
 *   - `{ done: true }` -> 完成
 *   - `{ error: "..." }` -> 错误并结束
 */

export interface AssistantSseCallbacks {
	onDelta: (text: string) => void;
	onThinking?: (text: string) => void;
	onStart?: () => void;
	onComplete?: (error?: string) => void;
	onError?: (err: Error) => void;
}

export async function streamAssistantSse(options: {
	url: string;
	token?: string;
	body: Record<string, unknown>;
	callbacks: AssistantSseCallbacks;
}): Promise<() => void> {
	const { url, token, body, callbacks } = options;
	const { onDelta, onThinking, onStart, onComplete, onError } = callbacks;

	const controller = new AbortController();
	let finished = false;
	const finish = (err?: string) => {
		if (finished) return;
		finished = true;
		onComplete?.(err);
	};

	(async () => {
		try {
			onStart?.();
			const res = await fetch(url, {
				method: 'POST',
				headers: {
					...(token ? { Authorization: `Bearer ${token}` } : {}),
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			});
			if (!res.ok) {
				throw new Error(`HTTP 错误：${res.status} ${res.statusText}`);
			}
			const reader = res.body?.getReader();
			if (!reader) throw new Error('无法读取流式响应');

			const decoder = new TextDecoder('utf-8');
			let buffer = '';

			readLoop: while (true) {
				const { done, value } = await reader.read();
				if (done) {
					finish();
					break;
				}
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed.startsWith('data:')) continue;
					const jsonStr = trimmed.slice(5).trimStart();
					if (!jsonStr) continue;
					let payload: any;
					try {
						payload = JSON.parse(jsonStr);
					} catch {
						continue;
					}
					if (typeof payload?.error === 'string' && payload.error) {
						finish(payload.error);
						break readLoop;
					}
					if (payload?.done === true) {
						finish();
						break readLoop;
					}
					if (payload?.type === 'thinking') {
						const t =
							typeof payload.raw === 'string'
								? payload.raw
								: typeof payload.content === 'string'
									? payload.content
									: '';
						if (t) onThinking?.(t);
						continue;
					}
					if (
						payload?.type === 'content' &&
						typeof payload.content === 'string'
					) {
						onDelta(payload.content);
					}
				}
			}
		} catch (err: any) {
			if (err?.name === 'AbortError') {
				finish();
				return;
			}
			const e =
				err instanceof Error ? err : new Error(String(err ?? '请求失败'));
			onError?.(e);
		}
	})();

	return () => controller.abort();
}
