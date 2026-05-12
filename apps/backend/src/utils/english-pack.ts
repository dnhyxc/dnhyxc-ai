import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { AIMessageChunk, BaseMessage } from '@langchain/core/messages';

/**
 * 从主 Agent 流式 chunk 中拼接可读文本（兼容 string 与富内容数组）。
 */
export function extractEnglishPackAgentChunkText(
	chunk: AIMessageChunk | undefined,
): string {
	if (!chunk) return '';
	const { content } = chunk;
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.map((part: unknown) => {
			if (typeof part === 'string') return part;
			if (
				part &&
				typeof part === 'object' &&
				'text' in part &&
				typeof (part as { text?: string }).text === 'string'
			) {
				return (part as { text: string }).text;
			}
			return '';
		})
		.join('');
}

/** 判定是否为调用方主动中止（Abort / ABORT_ERR），用于主 Agent 流式收尾不打 error 日志。 */
export function englishPackAgentIsUserAbort(err: unknown): boolean {
	let cur: unknown = err;
	for (let i = 0; i < 8 && cur != null && typeof cur === 'object'; i++) {
		const o = cur as { name?: string; code?: unknown; cause?: unknown };
		if (o.name === 'AbortError') return true;
		if (o.code === 'ABORT_ERR' || o.code === 20) return true;
		cur = o.cause;
	}
	return false;
}

/**
 * 当前位置的 `"` 是否为 JSON 合法「字符串结束」：其后仅空白 + `,` `}` `]` `:` 或文末。
 * 用于区分 noteZh 等字段内误用的英文引号（如 意为"匹敌"）与真正的字段结束。
 */
export function isJsonStringClosingQuoteAt(
	s: string,
	quoteIdx: number,
): boolean {
	let j = quoteIdx + 1;
	while (j < s.length && /\s/.test(s[j])) j++;
	const next = s[j];
	return (
		next === undefined ||
		next === ',' ||
		next === '}' ||
		next === ']' ||
		next === ':'
	);
}

/**
 * 将字符串值内部的裸 `"` 转为 `\"`，使 JSON.parse 可通过（与 isJsonStringClosingQuoteAt 语义一致）。
 */
export function repairJsonUnescapedInteriorQuotes(slice: string): string {
	let out = '';
	let i = 0;
	let inString = false;
	let escaped = false;
	while (i < slice.length) {
		const ch = slice[i];
		if (!inString) {
			if (ch === '"') {
				inString = true;
				out += '"';
			} else {
				out += ch;
			}
			i++;
			continue;
		}
		if (escaped) {
			out += ch;
			escaped = false;
			i++;
			continue;
		}
		if (ch === '\\') {
			out += ch;
			escaped = true;
			i++;
			continue;
		}
		if (ch === '"') {
			if (isJsonStringClosingQuoteAt(slice, i)) {
				inString = false;
				out += '"';
			} else {
				out += '\\"';
			}
			i++;
			continue;
		}
		out += ch;
		i++;
	}
	return out;
}

/**
 * 将子模型 `llm.invoke` 前的完整消息列表（顺序与入参一致）追加写入独立日志文件。
 * 目录：`{process.cwd()}/logs/english-learning/submodel-system.log`
 * @param logWarn 写入失败时的告警回调（例如传入 Nest Logger.warn）
 */
export function appendEnglishPackSubModelMessagesLog(
	messages: BaseMessage[],
	logWarn?: (message: string, error: unknown) => void,
): void {
	const stamp = new Date().toISOString();
	const parts: string[] = [`\n======== ${stamp} ========\n`];
	for (let i = 0; i < messages.length; i++) {
		const m = messages[i]!;
		const role = m.type;
		const c = m.content;
		const body =
			typeof c === 'string'
				? c
				: Array.isArray(c)
					? c
							.map((p: unknown) => {
								if (typeof p === 'string') return p;
								if (
									p &&
									typeof p === 'object' &&
									'text' in p &&
									typeof (p as { text?: string }).text === 'string'
								) {
									return (p as { text: string }).text;
								}
								try {
									return JSON.stringify(p);
								} catch {
									return String(p);
								}
							})
							.join('')
					: (() => {
							try {
								return JSON.stringify(c);
							} catch {
								return String(c);
							}
						})();
		parts.push(`[${i + 1}] ${role}\n${body}\n`);
	}
	parts.push(`---\n`);
	const block = parts.join('\n');
	void (async () => {
		try {
			const dir = join(process.cwd(), 'logs', 'english-learning');
			await mkdir(dir, { recursive: true });
			await appendFile(join(dir, 'submodel-system.log'), block, 'utf8');
		} catch (err: unknown) {
			logWarn?.('[EnglishLearning] 写入子模型 invoke 消息日志失败', err);
		}
	})();
}
