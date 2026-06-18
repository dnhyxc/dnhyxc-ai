import type { Cache } from '@nestjs/cache-manager';
import { parseFile } from './file-parser';

/** 超过此长度的解析结果不写入 Redis，避免缓存撑爆堆 */
const MAX_CACHEABLE_ATTACHMENT_CHARS = 200_000;
const ATTACHMENT_PARSE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ATTACHMENT_PARSE_CACHE_PREFIX = 'attach-text:v1:';

/** 单轮对话最多解析的非图片附件数 */
export const MAX_ATTACHMENTS_PARSE_PER_TURN = 8;

export function dedupeAttachmentsByPath<T extends { path: string }>(
	items: T[],
): T[] {
	const seen = new Set<string>();
	const out: T[] = [];
	for (const item of items) {
		const key = item.path?.trim();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(item);
	}
	return out;
}

/**
 * 聊天附件解析：带 Redis 缓存，同一路径只解析一次。
 * 缓存未命中时才读文件并走 pdf-parse / xlsx 等重操作。
 */
export async function parseAttachmentForChat(
	path: string,
	cache?: Cache,
): Promise<string> {
	const trimmed = path.trim();
	if (!trimmed) return '';

	const cacheKey = `${ATTACHMENT_PARSE_CACHE_PREFIX}${trimmed}`;
	if (cache) {
		const hit = await cache.get<string>(cacheKey);
		if (typeof hit === 'string') return hit;
	}

	const text = await parseFile(trimmed);
	if (cache && text.length <= MAX_CACHEABLE_ATTACHMENT_CHARS) {
		await cache.set(cacheKey, text, ATTACHMENT_PARSE_CACHE_TTL_MS);
	}
	return text;
}
