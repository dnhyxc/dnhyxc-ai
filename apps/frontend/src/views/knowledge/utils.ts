import type { Message } from '@/types/chat';
import {
	KNOWLEDGE_LOCAL_MD_ID_PREFIX,
	type KnowledgeAssistantPromptKind,
} from './constants';

/** 与「生成目录」快捷卡 `userMessageShort` 一致，用于匹配待写入编辑器的助手轮次 */
export const KNOWLEDGE_ASSISTANT_OUTLINE_USER_SHORT = '生成目录';

/** 文首目录标题行（中英常见写法） */
const TOC_HEADING_LINE_RE =
	/^#{1,6}\s*(目录|Table\s+of\s+Contents|TOC|Contents)\s*$/i;

/** 单条 Markdown 锚点目录项 */
const TOC_LIST_ITEM_RE = /^[-*+]\s+\[[^\]]+\]\([^)]+\)\s*$/;

/** 判断是否为本地文件夹打开的 Markdown 条目 id（带前缀、不写库） */
export function isKnowledgeLocalMarkdownId(
	id: string | null | undefined,
): boolean {
	return id != null && id !== '' && id.startsWith(KNOWLEDGE_LOCAL_MD_ID_PREFIX);
}

/**
 * 与知识页 `assistantArticleBinding` 一致：回收站预览优先，否则为当前编辑 id 或 `draft-new`。
 * 用于拼 `KnowledgeAssistant` 的 `documentKey` 前缀，避免与 `index.tsx` useMemo 分叉。
 */
export function knowledgeAssistantArticleBinding(input: {
	knowledgeTrashPreviewId: string | null | undefined;
	knowledgeEditingKnowledgeId: string | null | undefined;
}): string {
	if (
		input.knowledgeTrashPreviewId != null &&
		input.knowledgeTrashPreviewId !== ''
	) {
		return `__knowledge_trash__:${input.knowledgeTrashPreviewId}`;
	}
	return input.knowledgeEditingKnowledgeId ?? 'draft-new';
}

/**
 * 右侧助手 `documentKey` 及清空草稿时 `syncActiveDocumentKey` 必须与之一致：`{binding}__trash-{nonce}`。
 */
export function knowledgeAssistantDocumentKey(
	assistantArticleBinding: string,
	trashOpenNonce: number,
): string {
	return `${assistantArticleBinding}__trash-${trashOpenNonce}`;
}

/**
 * 快捷卡片：`userMessageShort` 为气泡与落库正文；`extraUserContentForModel` 仅由后端拼进发给模型的 user 上下文，不入库。
 */
export function buildKnowledgeAssistantDocumentMessage(
	kind: KnowledgeAssistantPromptKind,
	documentMarkdown: string,
): { userMessageShort: string; extraUserContentForModel: string } {
	const doc = documentMarkdown.replace(/\s+$/, '');
	const docFence = `--- 文档 ---\n${doc}\n--- 文档结束 ---`;

	switch (kind) {
		case 'polish':
			return {
				userMessageShort: '润色文档',
				extraUserContentForModel: `请根据以下「当前知识库文档」全文进行润色与优化：在保留原意、专有名词与代码块语义的前提下，改进行文与结构；可直接给出润色后的全文，或先简要说明改动要点再给出全文（二选一即可）。

${docFence}`,
			};
		case 'summarize':
			return {
				userMessageShort: '总结文档',
				extraUserContentForModel: `请根据以下「当前知识库文档」全文输出一份简洁的中文总结：覆盖主要信息层次与要点，必要时使用小节标题或条目列表；不必重复粘贴全文。

${docFence}`,
			};
		case 'outline':
			return {
				userMessageShort: KNOWLEDGE_ASSISTANT_OUTLINE_USER_SHORT,
				extraUserContentForModel: `请根据以下「当前知识库文档」全文，生成一份可直接粘贴在文首的 Markdown **目录**：按文档现有标题层级（# / ## / ### 等）列出条目，优先使用带锚点的 Markdown 链接格式便于跳转；若原文缺少清晰标题，可先简要建议应补充的标题再给出目录。输出目录块即可，不必重复粘贴全文。

${docFence}`,
			};
		case 'expand':
			return {
				userMessageShort: '扩写文档',
				extraUserContentForModel: `请根据以下「当前知识库文档」全文进行扩写：在保留主旨、术语与代码块语义的前提下，补充必要背景、例证与衔接句，使论述更完整可读；可直接给出扩写后的全文，或先列出扩写要点再给出全文（二选一即可）。

${docFence}`,
			};
	}
}

/** 判断文档开头是否已有目录块（标题或连续锚点列表） */
export function documentHasLeadingToc(markdown: string): boolean {
	const trimmed = markdown.trimStart();
	if (!trimmed) return false;
	const firstBlock = trimmed.split(/\n{2,}/)[0] ?? '';
	const lines = firstBlock.split(/\r?\n/);
	const firstMeaningful = lines.map((l) => l.trim()).find((l) => l.length > 0);
	if (firstMeaningful && TOC_HEADING_LINE_RE.test(firstMeaningful)) {
		return true;
	}
	const listLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);
	if (
		listLines.length >= 2 &&
		listLines.every((l) => TOC_LIST_ITEM_RE.test(l))
	) {
		return true;
	}
	return false;
}

/** 从助手回复中提取可粘贴的目录 Markdown 块 */
export function extractTocBlockFromAssistantReply(
	content: string,
): string | null {
	let text = content.trim();
	if (!text) return null;

	const wholeFence = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/);
	if (wholeFence) {
		text = wholeFence[1].trim();
	}

	const lines = text.split(/\r?\n/);
	let startIdx = -1;
	for (let i = 0; i < lines.length; i++) {
		if (TOC_HEADING_LINE_RE.test(lines[i].trim())) {
			startIdx = i;
			break;
		}
	}
	if (startIdx < 0) {
		for (let i = 0; i < lines.length; i++) {
			if (TOC_LIST_ITEM_RE.test(lines[i].trim())) {
				startIdx = i;
				break;
			}
		}
	}
	if (startIdx < 0) return null;

	const out: string[] = [];
	for (let i = startIdx; i < lines.length; i++) {
		const line = lines[i];
		const t = line.trim();
		if (out.length > 0 && !t) {
			const rest = lines.slice(i + 1);
			if (rest.every((l) => !l.trim())) break;
			const next = rest.find((l) => l.trim());
			if (
				next &&
				!TOC_HEADING_LINE_RE.test(next.trim()) &&
				!TOC_LIST_ITEM_RE.test(next.trim()) &&
				!/^#{1,6}\s/.test(next.trim())
			) {
				break;
			}
		}
		if (
			out.length > 0 &&
			t &&
			!TOC_HEADING_LINE_RE.test(t) &&
			!TOC_LIST_ITEM_RE.test(t) &&
			!/^#{1,6}\s/.test(t) &&
			!/^\d+\.\s/.test(t)
		) {
			break;
		}
		out.push(line);
	}
	const block = out.join('\n').trim();
	return block.length > 0 ? block : null;
}

/** 将目录块插入文档顶部（与正文之间空一行） */
export function prependTocToDocument(
	markdown: string,
	tocBlock: string,
): string {
	const toc = tocBlock.trim();
	const body = markdown.trimStart();
	if (!body) return `${toc}\n\n`;
	return `${toc}\n\n${body}`;
}

/** 最近一轮「生成目录」且已结束的助手回复 */
export function findCompletedOutlineAssistantReply(
	messages: Message[],
): Message | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const user = messages[i];
		if (user.role !== 'user') continue;
		if (user.content?.trim() !== KNOWLEDGE_ASSISTANT_OUTLINE_USER_SHORT) {
			continue;
		}
		const assistant = messages[i + 1];
		if (
			assistant?.role === 'assistant' &&
			!assistant.isStreaming &&
			!assistant.isStopped &&
			(assistant.content ?? '').trim()
		) {
			return assistant;
		}
		return null;
	}
	return null;
}
