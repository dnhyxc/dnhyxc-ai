import { createHash } from 'node:crypto';

export type TtsFileProvider = 'minimax' | 'xfyun' | 'edge' | 'siliconflow';

/** 缓存占用字节计数（走全局 CACHE_MANAGER，与验证码同 Redis） */
export const TTS_FILE_BYTES_KEY = 'tts:file:v1:bytes';

/** persistDisk 未传 cacheFolder 时的保留目录名 */
export const TTS_CACHE_FOLDER_FALLBACK = '未归类';

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
 * 目录名消毒（信任边界）：单层合法段。
 * 稳定 scope 如 `vocab_<uuid>` / 保留中文名如 `收藏`。
 */
export function sanitizeTtsCacheFolder(
	raw: string,
	fallback = TTS_CACHE_FOLDER_FALLBACK,
): string {
	const s = raw
		.normalize('NFC')
		.trim()
		.replace(/[\\/:*?"<>|\0]/g, '_')
		.replace(/^\.+/, '_')
		.slice(0, 120);
	return s && s !== '.' && s !== '..' ? s : fallback;
}

/**
 * redisKey → CACHE_MANAGER 路径索引；文件名用 12 位短缀。
 * folder = 稳定 scope（如 vocab_<id>），勿用可变库标题。
 */
export function buildTtsFileIds(input: {
	provider: TtsFileProvider;
	paramParts: string[];
	normalizedText: string;
	/** 已消毒的单层目录名；persist 场景应始终传入 */
	folder?: string;
}): { redisKey: string; relativePath: string; filename: string } {
	const paramHash = sha256Hex(input.paramParts.join('\u0001'));
	const textHash = sha256Hex(input.normalizedText);
	const filename = `${input.provider}_${paramHash.slice(0, 12)}_${textHash.slice(0, 12)}.mp3`;
	const folder = input.folder?.trim();
	const relativePath = folder ? `tts/${folder}/${filename}` : `tts/${filename}`;
	const redisKey = folder
		? `tts:file:v1:${folder}:${input.provider}:${paramHash}:${textHash}`
		: `tts:file:v1:${input.provider}:${paramHash}:${textHash}`;
	return { redisKey, relativePath, filename };
}
