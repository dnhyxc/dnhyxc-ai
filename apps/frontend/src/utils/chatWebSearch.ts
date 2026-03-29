import type { WebSearchSourceItem } from '@/types/chat';

/** 智谱流式 web_search 数据块结构因版本可能不同，尽量宽松解析为统一来源列表 */

export function normalizeZhipuWebSearchPayload(
	data: unknown,
): WebSearchSourceItem[] {
	if (!data || typeof data !== 'object') return [];
	const o = data as Record<string, unknown>;
	const list = (o.search_result ??
		o.items ??
		o.organic ??
		o.results) as unknown;
	if (!Array.isArray(list)) return [];
	const out: WebSearchSourceItem[] = [];
	for (const item of list) {
		if (!item || typeof item !== 'object') continue;
		const r = item as Record<string, unknown>;
		const title = String(r.title ?? r.name ?? '');
		const link = String(r.link ?? r.url ?? '');
		const snippet = String(r.content ?? r.snippet ?? r.summary ?? '');
		if (title || link || snippet) {
			out.push({ title, link, snippet });
		}
	}
	return out;
}
