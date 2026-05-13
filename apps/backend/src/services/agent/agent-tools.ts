import { DynamicTool } from '@langchain/core/tools';
import type { KnowledgeQaService } from '../knowledge-qa/knowledge-qa.service';
import type { WebSearchService } from '../web-search/web-search.service';
import type {
	WebSearchContextResult,
	WebSearchRecencyPreset,
} from '../web-search/web-search.types';

/**
 * 当前服务器 UTC 日期（LangChain DynamicTool，格式 YYYY-MM-DD）。
 * 说明：description 约束模型「仅在确需当日日历时调用」，避免每轮无谓 tool 轮询。
 */
export function createAgentDateTool(): DynamicTool {
	return new DynamicTool({
		name: 'get_current_date',
		description:
			'返回当前 UTC 日历日，格式 YYYY-MM-DD。' +
			'【必须调用】仅当用户问题不拿到「今天」的具体日期就无法正确回答时调用（例如：问今天几号、星期几、当前日期；或推理必须把「从今天起」与具体日程对齐）。' +
			'【禁止调用】一般常识问答；禁止为「先查日期再检索」而例行调用。',
		func: async () => new Date().toISOString().slice(0, 10),
	});
}

export type BuildAgentLangChainToolsDeps = {
	webSearchService: WebSearchService;
	knowledgeQaService: KnowledgeQaService;
	/** 与登录用户一致，用于知识库向量过滤 */
	userId: number;
	/**
	 * 英语学习等场景：按用户主题预先决定联网检索是否带时间条（Serper `tbs` / Tavily `time_range`）。
	 * 未传时沿用各调用方默认（与 Chat 一致：Serper 为近一日）。
	 */
	webSearchRecency?: WebSearchRecencyPreset;
	/** Tavily：主题解析出的公历起止（YYYY-MM-DD）；与 webSearchRecency 并存时 Tavily 优先用区间 */
	webSearchTavilyStartDate?: string;
	webSearchTavilyEndDate?: string;
	/**
	 * 是否注册「当前日期」工具。默认 true（聊天等）；英语学习主检索等可按主题推断传 `includeCurrentDateTool: infer…(topic)`，无需求则不注册。
	 */
	includeCurrentDateTool?: boolean;
};

export type BuildAgentLangChainToolsOpts = {
	/** internet_search 完成后回调，用于 SSE 推送 searchOrganic */
	onInternetSearchComplete?: (result: WebSearchContextResult) => void;
};

/**
 * 组装 Agent 使用的 LangChain 工具列表（顺序：联网检索 → 知识库 RAG →「当前日期」置后且可选）。
 * 说明：日期工具放末尾并收紧 description，降低模型「起手先查日期」的概率；不需要日期的场景可传 `includeCurrentDateTool: false` 或由调用方按用户主题推断。
 */
export function buildAgentLangChainTools(
	deps: BuildAgentLangChainToolsDeps,
	opts?: BuildAgentLangChainToolsOpts,
): DynamicTool[] {
	const tools: DynamicTool[] = [
		...deps.webSearchService.createLangChainWebSearchTools({
			onSearchComplete: opts?.onInternetSearchComplete,
			recency: deps.webSearchRecency,
			tavilyStartDate: deps.webSearchTavilyStartDate,
			tavilyEndDate: deps.webSearchTavilyEndDate,
		}),
		deps.knowledgeQaService.createAgentKnowledgeRagTool(deps.userId),
		createAgentDateTool(),
	];
	return tools;
}
