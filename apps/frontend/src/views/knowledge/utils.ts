import {
	KNOWLEDGE_LOCAL_MD_ID_PREFIX,
	type KnowledgeAssistantPromptKind,
} from './constants';

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
