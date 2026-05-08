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
};

export function buildAgentLangchainMiddleware(
	input: BuildAgentLangchainMiddlewareInput,
): ReadonlyArray<AgentMiddleware> {
	return [
		summarizationMiddleware({
			model: input.summaryLlm,
			trigger: { tokens: 6000, messages: 12 },
			keep: { messages: 28 },
			tokenCounter: input.estimatePromptTokens,
		}),
		toolCallLimitMiddleware({
			runLimit: 12,
			threadLimit: 12,
			exitBehavior: 'continue',
		}),
	];
}
