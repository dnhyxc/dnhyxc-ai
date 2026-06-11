import {
	DEFAULT_MINIMAX_TTS_LANGUAGE_BOOST,
	DEFAULT_MINIMAX_TTS_MODEL,
	DEFAULT_MINIMAX_TTS_VOICE_ID,
	MINIMAX_TTS_AUDIO_FORMATS,
	MINIMAX_TTS_EMOTIONS,
	MINIMAX_TTS_LANGUAGE_BOOST_VALUES,
	MINIMAX_TTS_MODELS,
} from '@/constants/minimaxTts';
import {
	type CloudTtsSettingsView,
	clearCloudTtsSettings,
	getCloudTtsSettings,
	updateCloudTtsSettings,
} from '@/service/cloudTtsSettings';
import {
	getLoggedInUserId,
	userScopedStorageKey,
} from '@/store/loggedInUserId';

/** 旧版 localStorage 键（仅用于一次性迁移到服务端） */
const LEGACY_STORAGE_KEY = 'english_learning_minimax_tts_prefs';

export type MinimaxTtsUserPrefs = CloudTtsSettingsView;

export const DEFAULT_MINIMAX_TTS_USER_PREFS: MinimaxTtsUserPrefs = {
	enabled: false,
	playbackSource: 'cloud',
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

let cachedUserId = 0;
let cachedPrefs: MinimaxTtsUserPrefs = { ...DEFAULT_MINIMAX_TTS_USER_PREFS };
let loadPromise: Promise<MinimaxTtsUserPrefs> | null = null;

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

export function normalizeMinimaxTtsUserPrefs(
	raw: unknown,
): MinimaxTtsUserPrefs {
	if (!raw || typeof raw !== 'object') {
		return { ...DEFAULT_MINIMAX_TTS_USER_PREFS };
	}
	const o = raw as Record<string, unknown>;
	const model = pickString(o.model, DEFAULT_MINIMAX_TTS_MODEL, 64);
	const format = pickString(o.format, 'mp3', 16);
	return {
		enabled: Boolean(o.enabled),
		playbackSource: o.playbackSource === 'local' ? 'local' : 'cloud',
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
			const rawBoost = pickString(o.languageBoost, '', 32);
			if (!rawBoost) return DEFAULT_MINIMAX_TTS_LANGUAGE_BOOST;
			const normalized =
				rawBoost.toLowerCase() === 'english'
					? 'English'
					: rawBoost.toLowerCase() === 'chinese'
						? 'Chinese'
						: rawBoost;
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

function setCache(
	userId: number,
	prefs: MinimaxTtsUserPrefs,
): MinimaxTtsUserPrefs {
	const normalized = normalizeMinimaxTtsUserPrefs(prefs);
	cachedUserId = userId;
	cachedPrefs = normalized;
	return normalized;
}

export function clearMinimaxTtsUserPrefsCache(): void {
	cachedUserId = 0;
	cachedPrefs = { ...DEFAULT_MINIMAX_TTS_USER_PREFS };
	loadPromise = null;
}

function readLegacyLocalPrefs(userId: number): MinimaxTtsUserPrefs | null {
	if (typeof window === 'undefined' || userId <= 0) return null;
	try {
		const scopedKey = userScopedStorageKey(LEGACY_STORAGE_KEY, userId);
		const raw =
			localStorage.getItem(scopedKey) ??
			localStorage.getItem(LEGACY_STORAGE_KEY);
		if (!raw) return null;
		return normalizeMinimaxTtsUserPrefs(JSON.parse(raw));
	} catch {
		return null;
	}
}

function removeLegacyLocalPrefs(userId: number): void {
	if (typeof window === 'undefined' || userId <= 0) return;
	localStorage.removeItem(userScopedStorageKey(LEGACY_STORAGE_KEY, userId));
	localStorage.removeItem(LEGACY_STORAGE_KEY);
}

async function migrateLegacyLocalPrefsIfAny(
	userId: number,
): Promise<MinimaxTtsUserPrefs | null> {
	const legacy = readLegacyLocalPrefs(userId);
	if (!legacy) return null;
	const res = await updateCloudTtsSettings(legacy, { silent: true });
	removeLegacyLocalPrefs(userId);
	return normalizeMinimaxTtsUserPrefs(res.data);
}

/** 同步读取内存缓存；未加载时返回默认值 */
export function loadMinimaxTtsUserPrefs(userId?: number): MinimaxTtsUserPrefs {
	const id = userId ?? getLoggedInUserId();
	if (id > 0 && cachedUserId === id) {
		return { ...cachedPrefs };
	}
	return { ...DEFAULT_MINIMAX_TTS_USER_PREFS };
}

/** 从服务端拉取并写入内存缓存（含 localStorage 一次性迁移） */
export async function ensureMinimaxTtsUserPrefsLoaded(
	userId?: number,
): Promise<MinimaxTtsUserPrefs> {
	const id = userId ?? getLoggedInUserId();
	if (id <= 0) {
		return { ...DEFAULT_MINIMAX_TTS_USER_PREFS };
	}
	if (cachedUserId === id && !loadPromise) {
		return { ...cachedPrefs };
	}
	if (loadPromise) {
		return loadPromise;
	}

	loadPromise = (async () => {
		try {
			const migrated = await migrateLegacyLocalPrefsIfAny(id);
			if (migrated) {
				return setCache(id, migrated);
			}
			const res = await getCloudTtsSettings({ silent: true });
			return setCache(id, normalizeMinimaxTtsUserPrefs(res.data));
		} catch {
			const legacy = readLegacyLocalPrefs(id);
			if (legacy) {
				return setCache(id, legacy);
			}
			return setCache(id, DEFAULT_MINIMAX_TTS_USER_PREFS);
		} finally {
			loadPromise = null;
		}
	})();

	return loadPromise;
}

/** 登录后预拉取，不阻塞 UI */
export function prefetchMinimaxTtsUserPrefs(userId?: number): void {
	void ensureMinimaxTtsUserPrefsLoaded(userId);
}

/** 设置页保存到服务端并更新内存缓存 */
export async function saveMinimaxTtsUserPrefs(
	prefs: MinimaxTtsUserPrefs,
	userId?: number,
): Promise<MinimaxTtsUserPrefs> {
	const id = userId ?? getLoggedInUserId();
	if (id <= 0) {
		return normalizeMinimaxTtsUserPrefs(prefs);
	}
	const body = normalizeMinimaxTtsUserPrefs(prefs);
	const res = await updateCloudTtsSettings(body);
	removeLegacyLocalPrefs(id);
	return setCache(id, normalizeMinimaxTtsUserPrefs(res.data));
}

/** 恢复默认并删除服务端记录 */
export async function resetMinimaxTtsUserPrefs(
	userId?: number,
): Promise<MinimaxTtsUserPrefs> {
	const id = userId ?? getLoggedInUserId();
	if (id <= 0) {
		return { ...DEFAULT_MINIMAX_TTS_USER_PREFS };
	}
	try {
		const res = await clearCloudTtsSettings();
		removeLegacyLocalPrefs(id);
		return setCache(id, normalizeMinimaxTtsUserPrefs(res.data));
	} catch {
		return setCache(id, DEFAULT_MINIMAX_TTS_USER_PREFS);
	}
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
	const userId = getLoggedInUserId();
	const userPart = userId > 0 ? String(userId) : '0';
	return `${userPart}\u0001${JSON.stringify(buildMinimaxTtsRequestExtras())}`;
}
