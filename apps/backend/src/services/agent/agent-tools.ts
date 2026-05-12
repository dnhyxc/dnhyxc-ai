import { DynamicTool } from '@langchain/core/tools';
import type { KnowledgeQaService } from '../knowledge-qa/knowledge-qa.service';
import type { WebSearchService } from '../web-search/web-search.service';
import type { WebSearchContextResult } from '../web-search/web-search.types';

/**
 * 当前服务器 UTC 日期（LangChain DynamicTool，格式 YYYY-MM-DD）
 */
export function createAgentDateTool(): DynamicTool {
	return new DynamicTool({
		name: 'get_current_date',
		description:
			'返回当前服务器日期，格式为 YYYY-MM-DD（按 UTC），用于回答与「今天」「当前日期」等涉及时间相关的问题。',
		func: async () => new Date().toISOString().slice(0, 10),
	});
}

export type BuildAgentLangChainToolsDeps = {
	webSearchService: WebSearchService;
	knowledgeQaService: KnowledgeQaService;
	/** 与登录用户一致，用于知识库向量过滤 */
	userId: number;
};

export type BuildAgentLangChainToolsOpts = {
	/** internet_search 完成后回调，用于 SSE 推送 searchOrganic */
	onInternetSearchComplete?: (result: WebSearchContextResult) => void;
};

/**
 * 组装 Agent 使用的 LangChain 工具列表（顺序：联网检索 → 知识库 RAG → 当前日期）
 */
export function buildAgentLangChainTools(
	deps: BuildAgentLangChainToolsDeps,
	opts?: BuildAgentLangChainToolsOpts,
): DynamicTool[] {
	return [
		createAgentDateTool(),
		...deps.webSearchService.createLangChainWebSearchTools({
			onSearchComplete: opts?.onInternetSearchComplete,
		}),
		deps.knowledgeQaService.createAgentKnowledgeRagTool(deps.userId),
	];
}
