import type { LucideIcon } from 'lucide-react';
import { BookOpen, Sparkle, Sparkles } from 'lucide-react';

/** Tauri 下知识 Markdown 目录（保存 / 删除文件与 invoke 一致） */
export const TAURI_KNOWLEDGE_DIR = '/Users/dnhyxc/Documents/knowledge';
// '/Users/dnhyxc/Documents/code/dnhyxc-ai/knowledge';

/** 本地文件夹打开的条目 id 前缀（与云端 UUID 区分，不写库） */
export const KNOWLEDGE_LOCAL_MD_ID_PREFIX = '__local_md__:';

export const EDITOR_HEIGHT = 'calc(100vh - 172px)';

/** 知识库助手首页快捷卡片类型（与构建发给模型的正文对应） */
export type KnowledgeAssistantPromptKind = 'polish' | 'summarize';

export type KnowledgeAssistantPromptItem = {
	kind: KnowledgeAssistantPromptKind;
	icon: LucideIcon;
	title: string;
	description: string;
};

export type KnowledgeAssistantMode = {
	id: 'ai' | 'rag';
	label: string;
	icon: LucideIcon;
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

export const KNOWLEDGE_ASSISTANT_MODES: KnowledgeAssistantMode[] = [
	{
		id: 'ai',
		label: 'AI 助手',
		icon: Sparkles,
	},
	{
		id: 'rag',
		label: 'RAG 助手',
		icon: BookOpen,
	},
];
