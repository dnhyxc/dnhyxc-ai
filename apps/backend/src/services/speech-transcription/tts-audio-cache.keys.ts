import { createHash } from 'node:crypto';

export type TtsCacheProvider = 'minimax' | 'xfyun' | 'edge' | 'siliconflow';

/** fingerprint 用：trim + 空白塌缩 + NFC；不改厂商入参原文 */
export function normalizeTtsText(text: string): string {
	return text.normalize('NFC').trim().replace(/\s+/g, ' ');
}

function sha256Hex(input: string): string {
	return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** L2 键：tts:v1:{provider}:{paramHash}:{textHash}；text 不进 paramHash */
export function buildTtsRedisKey(input: {
	provider: TtsCacheProvider;
	paramParts: string[];
	normalizedText: string;
}): string {
	const paramHash = sha256Hex(input.paramParts.join('\u0001'));
	const textHash = sha256Hex(input.normalizedText);
	return `tts:v1:${input.provider}:${paramHash}:${textHash}`;
}

/** Edge WordBoundary 旁路键（与音频同 fingerprint） */
export function buildTtsEdgeMetaKey(audioKey: string): string {
	return audioKey.replace(/^tts:v1:edge:/, 'tts:v1:edge:meta:');
}

export function userIdPart(userId?: number): string {
	return userId != null && userId > 0 ? String(userId) : '0';
}
