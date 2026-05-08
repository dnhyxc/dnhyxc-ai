import { DynamicTool } from '@langchain/core/tools';
import type { KnowledgeQaService } from '../knowledge-qa/knowledge-qa.service';
import type { WebSearchService } from '../web-search/web-search.service';

/**
 * 当前服务器 UTC 时间（LangChain DynamicTool）
 */
export function createAgentDatetimeTool(): DynamicTool {
	return new DynamicTool({
		name: 'get_current_datetime',
		description:
			'返回当前服务器时间的 ISO8601 字符串（UTC），用于回答与时间相关的问题。',
		func: async () => new Date().toISOString(),
	});
}

export type BuildAgentLangChainToolsDeps = {
	webSearchService: WebSearchService;
	knowledgeQaService: KnowledgeQaService;
	/** 与登录用户一致，用于知识库向量过滤 */
	userId: number;
};

/**
 * 组装 Agent 使用的 LangChain 工具列表（顺序：联网检索 → 知识库 RAG → 时间）
 */
export function buildAgentLangChainTools(
	deps: BuildAgentLangChainToolsDeps,
): DynamicTool[] {
	return [
		...deps.webSearchService.createLangChainWebSearchTools(),
		deps.knowledgeQaService.createAgentKnowledgeRagTool(deps.userId),
		createAgentDatetimeTool(),
	];
}
