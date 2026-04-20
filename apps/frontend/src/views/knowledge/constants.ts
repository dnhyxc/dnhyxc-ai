import type { LucideIcon } from 'lucide-react';
import { Sparkle, Sparkles } from 'lucide-react';

/** Tauri 下知识 Markdown 目录（保存 / 删除本地文件与 invoke 一致） */
export const TAURI_KNOWLEDGE_DIR = '/Users/dnhyxc/Documents/knowledge';
// '/Users/dnhyxc/Documents/code/dnhyxc-ai/knowledge';

/** 本地文件夹打开的条目 id 前缀（与云端 UUID 区分，不写库） */
export const KNOWLEDGE_LOCAL_MD_ID_PREFIX = '__local_md__:';

export function isKnowledgeLocalMarkdownId(
	id: string | null | undefined,
): boolean {
	return id != null && id !== '' && id.startsWith(KNOWLEDGE_LOCAL_MD_ID_PREFIX);
}

export const EDITOR_HEIGHT = 'calc(100vh - 172px)';

/** 知识库助手首页快捷卡片类型（与构建发给模型的正文对应） */
export type KnowledgeAssistantPromptKind = 'polish' | 'summarize';

export type KnowledgeAssistantPromptItem = {
	kind: KnowledgeAssistantPromptKind;
	icon: LucideIcon;
	title: string;
	description: string;
};

export const KNOWLEDGE_ASSISTANT_PROMPTS: KnowledgeAssistantPromptItem[] = [
	{
		kind: 'polish',
		icon: Sparkle,
		title: '润色文档内容',
		description: '精修字句，提升质感',
	},
	{
		kind: 'summarize',
		icon: Sparkles,
		title: '总结文档内容',
		description: '提炼要点，掌握核心',
	},
];

/**
 * 快捷卡片：`userMessageShort` 为气泡与落库正文；`extraUserContentForModel` 仅由后端拼进发给模型的 user 上下文，不入库。
 */
export function buildKnowledgeAssistantDocumentMessage(
	kind: KnowledgeAssistantPromptKind,
	documentMarkdown: string,
): { userMessageShort: string; extraUserContentForModel: string } {
	const doc = documentMarkdown.replace(/\s+$/, '');
	if (kind === 'polish') {
		return {
			userMessageShort: '润色文档内容',
			extraUserContentForModel: `请根据以下「当前知识库文档」全文进行润色与优化：在保留原意、专有名词与代码块语义的前提下，改进行文与结构；可直接给出润色后的全文，或先简要说明改动要点再给出全文（二选一即可）。

--- 文档 ---
${doc}
--- 文档结束 ---`,
		};
	}
	return {
		userMessageShort: '总结文档内容',
		extraUserContentForModel: `请根据以下「当前知识库文档」全文输出一份简洁的中文总结：覆盖主要信息层次与要点，必要时使用小节标题或条目列表；不必重复粘贴全文。

--- 文档 ---
${doc}
--- 文档结束 ---`,
	};
}
