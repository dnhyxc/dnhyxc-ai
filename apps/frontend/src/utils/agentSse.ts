/**
 * LangChain Agent SSE：对齐 `AgentController.chatSse` 的 `data: JSON` 行协议（含 content / tool / done）。
 */
import { Toast } from '@ui/index';
import { BASE_URL } from '@/constants';
import { notifyUnauthorized } from '@/router/authSession';
import { AGENT_SSE } from '@/service/api';
import type { ElResourceBlock, SearchOrganicItem } from '@/types/chat';
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
			'organic' in o ||
			'domain' in o ||
			('userMessageId' in o && 'assistantMessageId' in o)
		) {
			return o;
		}
	}
	return raw;
}

export interface AgentSseCallbacks {
	onDelta: (text: string) => void;
	/** 工具开始/结束（用于轻量状态条） */
	onTool?: (ev: {
		phase: 'start' | 'end';
		name?: string;
		output?: unknown;
	}) => void;
	onStart?: () => void;
	onComplete?: (error?: string) => void;
	onError?: (err: Error) => void;
	/** 联网检索 organic（与 Chat SSE searchOrganic 对齐，用于正文胶囊） */
	onSearchOrganic?: (organic: SearchOrganicItem[]) => void;
	/** 本轮强制加载的 Skill（id + title） */
	onSkillsApplied?: (skills: Array<{ id: string; title: string }>) => void;
	/** 占位落库后服务端下发的真实消息 ID，用于分享等与库内 id 对齐 */
	onMessageIds?: (ids: {
		userMessageId: string;
		assistantMessageId: string;
	}) => void;
	/** 英语领域写成功：刷新侧栏/收藏等 */
	onDomainMutation?: (domain: string) => void;
	/** 大列表旁路卡片 */
	onElResourceList?: (block: ElResourceBlock) => void;
	/** 用导语替换已流出的长表正文 */
	onContentReplace?: (text: string) => void;
	/** 最后一轮 completion 触顶，清单不靠续写补 */
	onMaxTokens?: () => void;
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
	const {
		onDelta,
		onTool,
		onStart,
		onComplete,
		onError,
		onSearchOrganic,
		onSkillsApplied,
		onMessageIds,
		onDomainMutation,
		onElResourceList,
		onContentReplace,
		onMaxTokens,
	} = callbacks;

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
						if (
							parsed.type === 'skillsApplied' &&
							Array.isArray(parsed.skills)
						) {
							const skills = (
								parsed.skills as Array<{ id?: unknown; title?: unknown }>
							)
								.filter(
									(s) =>
										typeof s?.id === 'string' &&
										typeof s?.title === 'string' &&
										s.id &&
										s.title,
								)
								.map((s) => ({
									id: s.id as string,
									title: s.title as string,
								}));
							if (skills.length) onSkillsApplied?.(skills);
							continue;
						}
						if (
							parsed.type === 'messageIds' &&
							typeof parsed.userMessageId === 'string' &&
							typeof parsed.assistantMessageId === 'string'
						) {
							onMessageIds?.({
								userMessageId: parsed.userMessageId,
								assistantMessageId: parsed.assistantMessageId,
							});
							continue;
						}
						if (
							parsed.type === 'contentReplace' &&
							typeof parsed.content === 'string'
						) {
							onContentReplace?.(parsed.content);
							continue;
						}
						if (parsed.type === 'finish' && parsed.maxTokensReached === true) {
							onMaxTokens?.();
							continue;
						}
						if (
							parsed.type === 'elResourceList' &&
							typeof parsed.artifactId === 'string' &&
							typeof parsed.title === 'string'
						) {
							onElResourceList?.({
								artifactId: parsed.artifactId,
								title: parsed.title,
								source:
									parsed.source === 'library' ||
									parsed.source === 'favorites' ||
									parsed.source === 'mistakes' ||
									parsed.source === 'memo' ||
									parsed.source === 'reading' ||
									parsed.source === 'pack' ||
									parsed.source === 'notes'
										? parsed.source
										: 'other',
								contentKind:
									parsed.contentKind === 'vocab' ||
									parsed.contentKind === 'classic'
										? parsed.contentKind
										: undefined,
								libraryId:
									typeof parsed.libraryId === 'string'
										? parsed.libraryId
										: undefined,
								totalCount:
									typeof parsed.totalCount === 'number' ? parsed.totalCount : 0,
								truncated: parsed.truncated === true,
								items: Array.isArray(parsed.items) ? parsed.items : undefined,
							});
							continue;
						}
						if (
							parsed.type === 'domainMutation' &&
							typeof parsed.domain === 'string' &&
							parsed.domain
						) {
							onDomainMutation?.(parsed.domain);
							continue;
						}
						if (parsed.type === 'tool') {
							const rawTool = parsed.raw as
								| { phase?: string; name?: string; output?: unknown }
								| undefined;
							const phase = rawTool?.phase;
							if (phase === 'start' || phase === 'end') {
								onTool?.({
									phase,
									name:
										typeof rawTool?.name === 'string'
											? rawTool.name
											: undefined,
									output: rawTool?.output,
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
