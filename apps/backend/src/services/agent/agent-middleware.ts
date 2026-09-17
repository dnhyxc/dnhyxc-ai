import type { BaseMessage } from '@langchain/core/messages';
import type { ChatOpenAI } from '@langchain/openai';
import {
	type AgentMiddleware,
	summarizationMiddleware,
	toolCallLimitMiddleware,
} from 'langchain';

/**
 * 构建 createAgent 使用的中间件链（与 agent.service 中原配置一致，便于集中维护）
 */
export type BuildAgentLangchainMiddlewareInput = {
	/** 用于 summarization 的非流式副模型 */
	summaryLlm: ChatOpenAI;
	/** 与 AgentMemoryService.estimatePromptTokens 一致 */
	estimatePromptTokens: (messages: BaseMessage[]) => number;
	/**
	 * english_learning：收紧本轮工具次数，避免模型反复 internet_search 烧穿 LangGraph recursionLimit。
	 * 默认与其它 Agent 一致。
	 */
	profile?: 'default' | 'english_learning';
};

export function buildAgentLangchainMiddleware(
	input: BuildAgentLangchainMiddlewareInput,
): ReadonlyArray<AgentMiddleware> {
	const english = input.profile === 'english_learning';
	return [
		summarizationMiddleware({
			model: input.summaryLlm,
			trigger: { tokens: 6000, messages: 12 },
			keep: { messages: 28 },
			tokenCounter: input.estimatePromptTokens,
		}),
		// 英语学习：单独封顶 internet_search（continue + 工具内硬顶）；勿用 end，否则第 4 次搜直接掐死、来不及作答
		...(english
			? [
					toolCallLimitMiddleware({
						toolName: 'internet_search',
						runLimit: 3,
						exitBehavior: 'continue',
					}),
				]
			: []),
		toolCallLimitMiddleware({
			// 仅按本轮（上次 Human 之后）计数；勿设 threadLimit=runLimit，否则达限后 continue 会空转耗尽图步数
			runLimit: english ? 8 : 12,
			exitBehavior: 'continue',
		}),
	];
}

/** Agent.streamEvents 的图步上限（默认 LangGraph 为 25，工具往返易触顶） */
export function agentStreamRecursionLimit(
	profile?: 'default' | 'english_learning',
): number {
	return profile === 'english_learning' ? 45 : 40;
}
