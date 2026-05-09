/**
 * LangChain Agent SSE：对齐 `AgentController.chatSse` 的 `data: JSON` 行协议（含 content / tool / done）。
 */
import { Toast } from '@ui/index';
import { BASE_URL } from '@/constant';
import { notifyUnauthorized } from '@/router/authSession';
import { AGENT_SSE } from '@/service/api';
import type { SearchOrganicItem } from '@/types/chat';
import { ASSISTANT_SSE_USER_ABORT_MARKER } from '@/utils/assistantSse';
import { getPlatformFetch } from '@/utils/fetch';

export { ASSISTANT_SSE_USER_ABORT_MARKER as AGENT_SSE_USER_ABORT_MARKER };

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token') || '';
}

/** 解包 NestJS `MessageEvent`，兼容 `{ data: { ... } }` 与扁平对象 */
function unwrapAgentPayload(
	raw: Record<string, unknown>,
): Record<string, unknown> {
	const inner = raw.data;
	if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
		const o = inner as Record<string, unknown>;
		if (
			'type' in o ||
			'done' in o ||
			'content' in o ||
			'error' in o ||
			'raw' in o ||
			'organic' in o
		) {
			return o;
		}
	}
	return raw;
}

export interface AgentSseCallbacks {
	onDelta: (text: string) => void;
	/** 工具开始/结束（用于轻量状态条） */
	onTool?: (ev: { phase: 'start' | 'end'; name?: string }) => void;
	onStart?: () => void;
	onComplete?: (error?: string) => void;
	onError?: (err: Error) => void;
	/** 联网检索 organic（与 Chat SSE searchOrganic 对齐，用于正文胶囊） */
	onSearchOrganic?: (organic: SearchOrganicItem[]) => void;
}

/**
 * 消费 `POST /agent/sse`；返回 `abort()`。
 */
export async function streamAgentSse(options: {
	api?: string;
	body: Record<string, unknown>;
	callbacks: AgentSseCallbacks;
}): Promise<() => void> {
	const { api = AGENT_SSE, body, callbacks } = options;
	const { onDelta, onTool, onStart, onComplete, onError, onSearchOrganic } =
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

						let raw: Record<string, unknown>;
						try {
							raw = JSON.parse(dataStr) as Record<string, unknown>;
						} catch {
							Toast({ type: 'error', title: 'Agent 流解析失败' });
							continue;
						}

						const parsed = unwrapAgentPayload(raw);

						if (typeof parsed.error === 'string' && parsed.error) {
							finish(parsed.error);
							break readLoop;
						}
						if (parsed.done === true) {
							finish();
							break readLoop;
						}
						if (
							parsed.type === 'content' &&
							typeof parsed.content === 'string' &&
							parsed.content
						) {
							onDelta(parsed.content);
							continue;
						}
						if (
							parsed.type === 'searchOrganic' &&
							Array.isArray(parsed.organic)
						) {
							onSearchOrganic?.(parsed.organic as SearchOrganicItem[]);
							continue;
						}
						if (parsed.type === 'tool') {
							const rawTool = parsed.raw as
								| { phase?: string; name?: string }
								| undefined;
							const phase = rawTool?.phase;
							if (phase === 'start' || phase === 'end') {
								onTool?.({
									phase,
									name:
										typeof rawTool?.name === 'string'
											? rawTool.name
											: undefined,
								});
							}
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
