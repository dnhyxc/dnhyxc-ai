import { createHash } from 'node:crypto';

export type TtsFileProvider = 'minimax' | 'xfyun' | 'edge' | 'siliconflow';

/** 缓存占用字节计数（走全局 CACHE_MANAGER，与验证码同 Redis） */
export const TTS_FILE_BYTES_KEY = 'tts:file:v1:bytes';

export function normalizeTtsText(text: string): string {
	return text.normalize('NFC').trim().replace(/\s+/g, ' ');
}

function sha256Hex(input: string): string {
	return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function userIdPart(userId?: number): string {
	return userId != null && userId > 0 ? String(userId) : '0';
}

/**
 * redisKey → CACHE_MANAGER 路径索引；文件名用 12 位短缀。
 * 与验证码等同用全局 Cache Redis，不另开连接。
 */
export function buildTtsFileIds(input: {
	provider: TtsFileProvider;
	paramParts: string[];
	normalizedText: string;
}): { redisKey: string; relativePath: string; filename: string } {
	const paramHash = sha256Hex(input.paramParts.join('\u0001'));
	const textHash = sha256Hex(input.normalizedText);
	const filename = `${input.provider}_${paramHash.slice(0, 12)}_${textHash.slice(0, 12)}.mp3`;
	return {
		redisKey: `tts:file:v1:${input.provider}:${paramHash}:${textHash}`,
		relativePath: `tts/${filename}`,
		filename,
	};
}
