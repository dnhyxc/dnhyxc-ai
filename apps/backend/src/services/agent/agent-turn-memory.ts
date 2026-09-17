import type { BaseMessage } from '@langchain/core/messages';
import type { SerperOrganicItem } from '../web-search/web-search.types';

/** 本轮强制应用的 Skill 快照（落库 / SSE） */
export type AppliedSkillRef = { id: string; title: string };

/** updateAssistantContent 可选落库字段；各 Memory 实现只读自己需要的键 */
export type UpdateAssistantContentOpts = {
	/** undefined：不改列；null：清空；数组：落库（agent / english / skill_try） */
	searchOrganic?: SerperOrganicItem[] | null;
	/** undefined：不改列；null：清空；数组：落库（assistant_* / skill_try_*） */
	appliedSkills?: AppliedSkillRef[] | null;
};

/**
 * Agent 流式一轮的业务记忆端口：读写与 LangChain 历史必须同源。
 * 缺省实现写 `agent_*`；知识库 Skill 用 `assistant_*`（见 Agent业务消息分表方案）。
 */
export interface AgentTurnMemory {
	/** userId：摘要压缩走 createLlm，需对齐前端大模型设置 */
	compactSessionIfNeeded(
		businessSessionId: string,
		userId: number,
	): Promise<void>;

	insertUserAndAssistantPlaceholder(
		businessSessionId: string,
		turnId: string,
		userContent: string,
	): Promise<{ userMessageId: string; assistantMessageId: string }>;

	buildLangChainMessagesFromDb(
		businessSessionId: string,
	): Promise<BaseMessage[]>;

	updateAssistantContent(
		businessSessionId: string,
		assistantMessageId: string,
		content: string,
		opts?: UpdateAssistantContentOpts,
	): Promise<void>;

	deleteTurnPair(businessSessionId: string, turnId: string): Promise<void>;
}
