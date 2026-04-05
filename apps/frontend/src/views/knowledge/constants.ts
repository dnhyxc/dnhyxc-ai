/** Tauri 下知识 Markdown 目录（保存 / 删除本地文件与 invoke 一致） */
export const TAURI_KNOWLEDGE_DIR =
	'/Users/dnhyxc/Documents/code/dnhyxc-ai/knowledge';

/** 本地文件夹打开的条目 id 前缀（与云端 UUID 区分，不写库） */
export const KNOWLEDGE_LOCAL_MD_ID_PREFIX = '__local_md__:';

export function isKnowledgeLocalMarkdownId(
	id: string | null | undefined,
): boolean {
	return id != null && id !== '' && id.startsWith(KNOWLEDGE_LOCAL_MD_ID_PREFIX);
}

export const EDITOR_HEIGHT = 'calc(100vh - 172px)';
