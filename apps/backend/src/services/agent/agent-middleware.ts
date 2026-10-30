import {
	AIMessage,
	type BaseMessage,
	HumanMessage,
	ToolMessage,
} from '@langchain/core/messages';
import type { ChatOpenAI } from '@langchain/openai';
import {
	type AgentMiddleware,
	createMiddleware,
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
	 * english_learning：不按次数封工具。同一句空转才收束，下一句从 0 再计。
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
		...(english
			? [quietRoundMiddleware(), brakeAfterModel()]
			: [
					toolCallLimitMiddleware({
						// 仅按本轮（上次 Human 之后）计数；勿设 threadLimit=runLimit，否则达限后 continue 会空转耗尽图步数
						runLimit: 12,
						exitBehavior: 'continue',
					}),
				]),
	];
}

/** 同一句里的空转保险丝。不是会话配额，下一句用户消息重新从 0 计。 */
const ENGLISH_QUIET_ROUNDS = 24;

/** Agent.streamEvents 的图步上限（默认 LangGraph 为 25，工具往返易触顶） */
export function agentStreamRecursionLimit(
	profile?: 'default' | 'english_learning',
): number {
	if (profile !== 'english_learning') return 40;
	// 一轮含摘要、模型、两道 after_model 和工具。多出的 16 步留给收束后的正文
	return ENGLISH_QUIET_ROUNDS * 5 + 16;
}

/** 这一句的工具来回已满仍要调工具时，不执行，只让模型作答。不 jumpTo end。 */
function quietRoundMiddleware(): AgentMiddleware {
	return createMiddleware({
		name: 'ElQuietRounds',
		afterModel: {
			hook: (state) => {
				const messages = state.messages ?? [];
				let start = 0;
				for (let i = messages.length - 1; i >= 0; i -= 1) {
					if (HumanMessage.isInstance(messages[i])) {
						start = i;
						break;
					}
				}
				let rounds = 0;
				for (let i = start + 1; i < messages.length; i += 1) {
					const row = messages[i];
					if (AIMessage.isInstance(row) && row.tool_calls?.length) rounds += 1;
				}
				const last = messages[messages.length - 1];
				if (!AIMessage.isInstance(last) || !last.tool_calls?.length) return;
				// 这次调用已经算进 rounds。满 24 次仍放行，第 25 次才收束
				if (rounds <= ENGLISH_QUIET_ROUNDS) return;
				const closed = last.tool_calls.map(
					(call) =>
						new ToolMessage({
							content:
								'停止调用工具。用已有结果直接作答。不要向用户提及次数、轮次或上限。',
							tool_call_id: call.id ?? '',
							name: call.name,
							status: 'error',
						}),
				);
				return { messages: closed };
			},
		},
	});
}

const STOP_TOOLS_MARK = '"code":"stop_tools"';
const FILTER_SHOWN_MARK = 'filter_shown';

function messageText(message: BaseMessage): string {
	const content = message.content;
	if (typeof content === 'string') return content;
	try {
		return JSON.stringify(content ?? '');
	} catch {
		return '';
	}
}

/** 同轮第二次提案返回 stop_tools 后，若模型还要调工具，直接结束并留下确认句 */
function brakeAfterModel(): AgentMiddleware {
	return createMiddleware({
		name: 'ElStopToolsBrake',
		afterModel: {
			canJumpTo: ['end'],
			hook: (state) => {
				const messages = state.messages ?? [];
				let aiIndex = -1;
				for (let i = messages.length - 1; i >= 0; i -= 1) {
					if (AIMessage.isInstance(messages[i])) {
						aiIndex = i;
						break;
					}
				}
				if (aiIndex < 0) return;
				const ai = messages[aiIndex];
				if (!AIMessage.isInstance(ai) || !ai.tool_calls?.length) return;
				let stop = false;
				let filterShown = false;
				for (let i = aiIndex - 1; i >= 0; i -= 1) {
					const row = messages[i];
					if (!ToolMessage.isInstance(row)) break;
					const text = messageText(row);
					if (text.includes(STOP_TOOLS_MARK)) stop = true;
					if (text.includes(FILTER_SHOWN_MARK)) filterShown = true;
				}
				if (!stop && !filterShown) return;
				const closed = ai.tool_calls.map(
					(call) =>
						new ToolMessage({
							content: '已停止。请让用户点确认，不要再调用工具。',
							tool_call_id: call.id ?? '',
							name: call.name,
							status: 'error',
						}),
				);
				return {
					jumpTo: 'end' as const,
					messages: [
						...closed,
						new AIMessage(
							filterShown && !stop
								? '筛选卡片已经列出。'
								: '已有待确认提案，请直接点确认。',
						),
					],
				};
			},
		},
	});
}
