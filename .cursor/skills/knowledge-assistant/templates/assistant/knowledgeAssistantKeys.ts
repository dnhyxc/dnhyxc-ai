/**
 * 文档侧边助手的 key 规范。
 *
 * 目标：
 * - UI 上允许 `documentKey` 携带 nonce/视图后缀（例如回收站分栏），但 Store 必须能规整为稳定 key
 * - 新建未保存草稿可使用 `draft-new` 作为稳定占位
 */

/** 将 `documentKey` 规整为稳定 key：去掉 `__trash-xxx` 这类视图后缀 */
export function canonicalAssistantDocumentKey(documentKey: string): string {
	const raw = (documentKey ?? '').trim();
	if (!raw) return '';
	const sep = '__trash-';
	const i = raw.indexOf(sep);
	return (i >= 0 ? raw.slice(0, i) : raw).trim();
}

/** 示例：将条目绑定（稳定 id）与 nonce 拼成 UI 层 documentKey */
export function buildAssistantDocumentKey(input: {
	assistantArticleBinding: string; // 例如 knowledgeArticleId / local-file-id / "draft-new"
	viewNonce: number; // 例如回收站打开次数
}): string {
	return `${input.assistantArticleBinding}__trash-${input.viewNonce}`;
}
