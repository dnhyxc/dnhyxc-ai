/**
 * 助手接口层（Adapter）。
 *
 * 目的：
 * - 将不同项目的 HTTP Client / 路由 / 鉴权方式隔离在这里
 * - 保持 Store 与 UI 模板可直接复用
 *
 * 说明：
 * - 你可以用 fetch/axios/ky 或你项目已有的 api.ts
 * - 返回类型只要满足 Store 读取字段即可，不必与本仓库完全一致
 */

export type AssistantRole = 'user' | 'assistant';

export interface AssistantMessageRow {
	id: string;
	role: AssistantRole;
	content: string;
	createdAt: string;
}

export async function createAssistantSession(input: {
	/** 可选：绑定到某个“条目/文档”的稳定 id（例如 knowledgeArticleId） */
	knowledgeArticleId?: string;
}): Promise<{ sessionId: string }> {
	throw new Error('TODO: createAssistantSession 未实现');
}

export async function getAssistantSessionByArticle(
	knowledgeArticleId: string,
): Promise<{
	session: { sessionId: string } | null;
	messages: AssistantMessageRow[];
} | null> {
	throw new Error('TODO: getAssistantSessionByArticle 未实现');
}

export async function getAssistantSessionDetail(sessionId: string): Promise<{
	session: { sessionId: string } | null;
	messages: AssistantMessageRow[];
}> {
	throw new Error('TODO: getAssistantSessionDetail 未实现');
}

export async function patchAssistantSessionBinding(
	sessionId: string,
	input: { knowledgeArticleId: string },
): Promise<void> {
	throw new Error('TODO: patchAssistantSessionBinding 未实现');
}

/**
 * 将 ephemeral 阶段的对话迁入并与条目绑定（等价 “import transcript”）。
 * 成功时返回迁入后的 sessionId（一般为新建或复用后的会话）。
 */
export async function importAssistantTranscript(input: {
	knowledgeArticleId: string;
	lines: Array<{ role: AssistantRole; content: string }>;
}): Promise<{ sessionId: string }> {
	throw new Error('TODO: importAssistantTranscript 未实现');
}

/** 停止服务端的流式输出（可选；若后端无该接口，可实现为空函数） */
export async function stopAssistantStream(sessionId: string): Promise<void> {
	void sessionId;
	// 可选实现：不提供也能工作（前端 AbortController 仍可停止接收）
}
