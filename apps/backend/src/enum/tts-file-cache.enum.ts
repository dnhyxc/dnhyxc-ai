/** TTS 本地文件缓存（uploads/tts + Redis 路径索引 + ZSET 懒 GC） */
export enum TtsFileCacheEnum {
	TTS_FILE_CACHE_ENABLED = 'TTS_FILE_CACHE_ENABLED',
	/**
	 * tts 文件缓存过期时间（秒）。
	 * 0 = 不限制 TTL；默认 30 天（2_592_000）。
	 */
	TTS_FILE_CACHE_TTL_SEC = 'TTS_FILE_CACHE_TTL_SEC',
	/**
	 * tts 目录缓存预算（MB）。超出则跳过落盘（不删旧文件）。
	 * 0 = 不限制体积；默认 2048。
	 */
	TTS_FILE_CACHE_MAX_MB = 'TTS_FILE_CACHE_MAX_MB',
}
