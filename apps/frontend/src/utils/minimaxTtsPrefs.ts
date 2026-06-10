import {
	DEFAULT_MINIMAX_TTS_LANGUAGE_BOOST,
	DEFAULT_MINIMAX_TTS_MODEL,
	DEFAULT_MINIMAX_TTS_VOICE_ID,
	MINIMAX_TTS_AUDIO_FORMATS,
	MINIMAX_TTS_EMOTIONS,
	MINIMAX_TTS_LANGUAGE_BOOST_VALUES,
	MINIMAX_TTS_MODELS,
} from '@/constants/minimaxTts';

const STORAGE_KEY = 'english_learning_minimax_tts_prefs';

export type MinimaxTtsUserPrefs = {
	/** 为 true 时请求体携带下列字段，覆盖服务端 env 默认 */
	enabled: boolean;
	model: string;
	voiceId: string;
	speed: number;
	vol: number;
	pitch: number;
	/** 空字符串表示不传 emotion */
	emotion: string;
	format: string;
	/** MiniMax language_boost；默认 auto */
	languageBoost: string;
	sampleRate: number;
	bitrate: number;
	channel: 1 | 2;
};

export const DEFAULT_MINIMAX_TTS_USER_PREFS: MinimaxTtsUserPrefs = {
	enabled: false,
	model: DEFAULT_MINIMAX_TTS_MODEL,
	voiceId: DEFAULT_MINIMAX_TTS_VOICE_ID,
	speed: 1,
	vol: 5,
	pitch: 0,
	emotion: '',
	format: 'mp3',
	languageBoost: DEFAULT_MINIMAX_TTS_LANGUAGE_BOOST,
	sampleRate: 32_000,
	bitrate: 128_000,
	channel: 1,
};

function clampNumber(
	raw: unknown,
	min: number,
	max: number,
	fallback: number,
): number {
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

function pickString(raw: unknown, fallback: string, maxLen = 128): string {
	if (typeof raw !== 'string') return fallback;
	const trimmed = raw.trim();
	if (!trimmed) return fallback;
	return trimmed.slice(0, maxLen);
}

function normalizePrefs(raw: unknown): MinimaxTtsUserPrefs {
	if (!raw || typeof raw !== 'object') {
		return { ...DEFAULT_MINIMAX_TTS_USER_PREFS };
	}
	const o = raw as Record<string, unknown>;
	const model = pickString(o.model, DEFAULT_MINIMAX_TTS_MODEL, 64);
	const format = pickString(o.format, 'mp3', 16);
	return {
		enabled: Boolean(o.enabled),
		model: (MINIMAX_TTS_MODELS as readonly string[]).includes(model)
			? model
			: DEFAULT_MINIMAX_TTS_MODEL,
		voiceId: pickString(o.voiceId, DEFAULT_MINIMAX_TTS_VOICE_ID, 128),
		speed: clampNumber(o.speed, 0.5, 2, 1),
		vol: clampNumber(o.vol, 0.01, 10, 5),
		pitch: Math.round(clampNumber(o.pitch, -12, 12, 0)),
		emotion: (() => {
			const e = pickString(o.emotion, '', 32);
			if (!e || e === '__none__' || e === 'whisper') return '';
			return (MINIMAX_TTS_EMOTIONS as readonly string[]).includes(e) ? e : '';
		})(),
		format: (MINIMAX_TTS_AUDIO_FORMATS as readonly string[]).includes(format)
			? format
			: 'mp3',
		languageBoost: (() => {
			const raw = pickString(o.languageBoost, '', 32);
			if (!raw) return DEFAULT_MINIMAX_TTS_LANGUAGE_BOOST;
			const normalized =
				raw.toLowerCase() === 'english'
					? 'English'
					: raw.toLowerCase() === 'chinese'
						? 'Chinese'
						: raw;
			return (MINIMAX_TTS_LANGUAGE_BOOST_VALUES as readonly string[]).includes(
				normalized,
			)
				? normalized
				: DEFAULT_MINIMAX_TTS_LANGUAGE_BOOST;
		})(),
		sampleRate: Math.round(clampNumber(o.sampleRate, 8000, 44_100, 32_000)),
		bitrate: Math.round(clampNumber(o.bitrate, 32_000, 256_000, 128_000)),
		channel: clampNumber(o.channel, 1, 2, 1) === 2 ? 2 : 1,
	};
}

export function loadMinimaxTtsUserPrefs(): MinimaxTtsUserPrefs {
	if (typeof window === 'undefined') {
		return { ...DEFAULT_MINIMAX_TTS_USER_PREFS };
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_MINIMAX_TTS_USER_PREFS };
		return normalizePrefs(JSON.parse(raw));
	} catch {
		return { ...DEFAULT_MINIMAX_TTS_USER_PREFS };
	}
}

export function saveMinimaxTtsUserPrefs(prefs: MinimaxTtsUserPrefs): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePrefs(prefs)));
}

/** 供 fetchCloudTtsBlob 合并进 POST body（不含 text） */
export function buildMinimaxTtsRequestExtras(): Record<string, unknown> {
	const prefs = loadMinimaxTtsUserPrefs();
	if (!prefs.enabled) return {};
	const body: Record<string, unknown> = {
		model: prefs.model,
		voiceId: prefs.voiceId,
		speed: prefs.speed,
		vol: prefs.vol,
		pitch: prefs.pitch,
		format: prefs.format,
		sampleRate: prefs.sampleRate,
		bitrate: prefs.bitrate,
		channel: prefs.channel,
	};
	if (prefs.emotion) body.emotion = prefs.emotion;
	if (prefs.languageBoost) body.languageBoost = prefs.languageBoost;
	return body;
}

/** 前端 MP3 缓存 key 后缀：自定义参数变更后不与旧缓存混用 */
export function buildMinimaxTtsCacheKeySuffix(): string {
	const prefs = loadMinimaxTtsUserPrefs();
	if (!prefs.enabled) return '';
	return JSON.stringify(buildMinimaxTtsRequestExtras());
}
