import { DEFAULT_EDGE_TTS_VOICE, isEdgeTtsVoiceId } from '@/constants/edgeTts';
import {
	DEFAULT_MINIMAX_TTS_LANGUAGE_BOOST,
	DEFAULT_MINIMAX_TTS_MODEL,
	DEFAULT_MINIMAX_TTS_VOICE_ID,
	fillMinimaxCloudCredentialsFromEnv,
	getDefaultMinimaxCloudCredentials,
	MINIMAX_TTS_AUDIO_FORMATS,
	MINIMAX_TTS_EMOTIONS,
	MINIMAX_TTS_LANGUAGE_BOOST_VALUES,
} from '@/constants/minimaxTts';
import {
	DEFAULT_XFYUN_TTS_VCN,
	fillXfyunCredentialsFromEnv,
	isXfyunTtsVcn,
	XFYUN_TTS_PARAM_DEFAULT,
	xfyunPitchFromPitch,
	xfyunSpeedFromMinimaxSpeed,
	xfyunVolumeFromVol,
} from '@/constants/xfyunTts';
import {
	type CloudTtsSettingsView,
	clearCloudTtsSettings,
	getCloudTtsSettings,
	type TtsPlaybackSource,
	updateCloudTtsSettings,
} from '@/service/cloudTtsSettings';
import {
	getLoggedInUserId,
	userScopedStorageKey,
} from '@/store/loggedInUserId';

/** 旧版 localStorage 键（仅用于一次性迁移到服务端） */
const LEGACY_STORAGE_KEY = 'english_learning_minimax_tts_prefs';

export type MinimaxTtsUserPrefs = CloudTtsSettingsView;

const defaultMinimaxCloud = getDefaultMinimaxCloudCredentials();

export const DEFAULT_MINIMAX_TTS_USER_PREFS: MinimaxTtsUserPrefs = {
	enabled: false,
	playbackSource: 'local',
	model: defaultMinimaxCloud.model,
	voiceId: DEFAULT_MINIMAX_TTS_VOICE_ID,
	xfyunVoiceId: DEFAULT_XFYUN_TTS_VCN,
	edgeVoiceId: DEFAULT_EDGE_TTS_VOICE,
	minimaxSpeed: 1,
	minimaxVol: 5,
	minimaxPitch: 0,
	xfyunSpeed: XFYUN_TTS_PARAM_DEFAULT,
	xfyunVolume: XFYUN_TTS_PARAM_DEFAULT,
	xfyunPitch: XFYUN_TTS_PARAM_DEFAULT,
	edgeSpeed: 1,
	edgeVol: 5,
	edgePitch: 0,
	emotion: '',
	format: 'mp3',
	languageBoost: DEFAULT_MINIMAX_TTS_LANGUAGE_BOOST,
	sampleRate: 32_000,
	bitrate: 128_000,
	channel: 1,
	xfyunAppId: '',
	xfyunApiKey: '',
	xfyunApiSecret: '',
	minimaxApiKey: '',
};

let cachedUserId = 0;
let cachedPrefs: MinimaxTtsUserPrefs = { ...DEFAULT_MINIMAX_TTS_USER_PREFS };
let loadPromise: Promise<MinimaxTtsUserPrefs> | null = null;

function normalizePlaybackSource(raw: unknown): TtsPlaybackSource {
	if (raw === 'local') return 'local';
	if (raw === 'xfyun') return 'xfyun';
	if (raw === 'edge') return 'edge';
	return 'cloud';
}

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

function pickOptionalCredential(raw: unknown, maxLen: number): string {
	if (typeof raw !== 'string') return '';
	return raw.trim().slice(0, maxLen);
}

/** 旧版 voiceId 与讯飞 vcn 混存时拆分到独立字段 */
function splitLegacyVoiceStorage(
	prefs: MinimaxTtsUserPrefs,
	rawXfyunVoiceId: unknown,
	rawEdgeVoiceId: unknown,
): MinimaxTtsUserPrefs {
	let voiceId = prefs.voiceId;
	let xfyunVoiceId = pickString(rawXfyunVoiceId, DEFAULT_XFYUN_TTS_VCN, 128);
	if (isXfyunTtsVcn(voiceId) && typeof rawXfyunVoiceId !== 'string') {
		xfyunVoiceId = voiceId;
		voiceId = DEFAULT_MINIMAX_TTS_VOICE_ID;
	}
	if (!isXfyunTtsVcn(xfyunVoiceId)) {
		xfyunVoiceId = DEFAULT_XFYUN_TTS_VCN;
	}
	let edgeVoiceId = pickString(rawEdgeVoiceId, DEFAULT_EDGE_TTS_VOICE, 128);
	if (!isEdgeTtsVoiceId(edgeVoiceId)) {
		edgeVoiceId = DEFAULT_EDGE_TTS_VOICE;
	}
	return { ...prefs, voiceId, xfyunVoiceId, edgeVoiceId };
}

/** 旧版共用 speed/vol/pitch 拆到各模式独立字段（仅缺新字段时生效） */
function splitLegacyProsodyFields(
	prefs: MinimaxTtsUserPrefs,
	raw: Record<string, unknown>,
): MinimaxTtsUserPrefs {
	const hasNewProsody =
		'minimaxSpeed' in raw || 'xfyunSpeed' in raw || 'edgeSpeed' in raw;
	if (hasNewProsody) return prefs;

	const legacySpeed = clampNumber(raw.speed, 0.5, 2, 1);
	const legacyVol = clampNumber(raw.vol, 0.01, 10, 5);
	const legacyPitch = Math.round(clampNumber(raw.pitch, -12, 12, 0));
	return {
		...prefs,
		minimaxSpeed: legacySpeed,
		minimaxVol: legacyVol,
		minimaxPitch: legacyPitch,
		xfyunSpeed: xfyunSpeedFromMinimaxSpeed(legacySpeed),
		xfyunVolume: xfyunVolumeFromVol(legacyVol),
		xfyunPitch: xfyunPitchFromPitch(legacyPitch),
		edgeSpeed: legacySpeed,
		edgeVol: legacyVol,
		edgePitch: legacyPitch,
	};
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
	const base: MinimaxTtsUserPrefs = {
		enabled: Boolean(o.enabled),
		playbackSource: normalizePlaybackSource(o.playbackSource),
		// 设置页模型为自由输入；白名单见 MINIMAX_TTS_MODELS，后端 DTO 校验
		model,
		voiceId: pickString(o.voiceId, DEFAULT_MINIMAX_TTS_VOICE_ID, 128),
		xfyunVoiceId: pickString(o.xfyunVoiceId, DEFAULT_XFYUN_TTS_VCN, 128),
		edgeVoiceId: pickString(o.edgeVoiceId, DEFAULT_EDGE_TTS_VOICE, 128),
		minimaxSpeed: clampNumber(o.minimaxSpeed ?? o.speed, 0.5, 2, 1),
		minimaxVol: clampNumber(o.minimaxVol ?? o.vol, 0.01, 10, 5),
		minimaxPitch: Math.round(
			clampNumber(o.minimaxPitch ?? o.pitch, -12, 12, 0),
		),
		xfyunSpeed: clampNumber(o.xfyunSpeed, 0, 100, XFYUN_TTS_PARAM_DEFAULT),
		xfyunVolume: clampNumber(o.xfyunVolume, 0, 100, XFYUN_TTS_PARAM_DEFAULT),
		xfyunPitch: Math.round(
			clampNumber(o.xfyunPitch, 0, 100, XFYUN_TTS_PARAM_DEFAULT),
		),
		edgeSpeed: clampNumber(o.edgeSpeed, 0.5, 2, 1),
		edgeVol: clampNumber(o.edgeVol, 0.01, 10, 5),
		edgePitch: Math.round(clampNumber(o.edgePitch, -12, 12, 0)),
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
		xfyunAppId: pickOptionalCredential(o.xfyunAppId, 64),
		xfyunApiKey: pickOptionalCredential(o.xfyunApiKey, 128),
		xfyunApiSecret: pickOptionalCredential(o.xfyunApiSecret, 128),
		minimaxApiKey: pickOptionalCredential(o.minimaxApiKey, 256),
	};
	const withVoices = splitLegacyVoiceStorage(
		base,
		o.xfyunVoiceId,
		o.edgeVoiceId,
	);
	return splitLegacyProsodyFields(withVoices, o);
}

/** 非会员仅允许 local / edge；会员源若过期则回退 local */
export function clampPlaybackSourceForMembership(
	prefs: MinimaxTtsUserPrefs,
	isMemberActive: boolean,
): MinimaxTtsUserPrefs {
	if (isMemberActive) return prefs;
	if (prefs.playbackSource === 'cloud' || prefs.playbackSource === 'xfyun') {
		return { ...prefs, playbackSource: 'local' };
	}
	return prefs;
}

/** 服务端空字段回填 VITE_* 默认值（讯飞 + MiniMax） */
export function withDefaultCloudTtsPrefs(
	prefs: MinimaxTtsUserPrefs,
): MinimaxTtsUserPrefs {
	return fillMinimaxCloudCredentialsFromEnv(fillXfyunCredentialsFromEnv(prefs));
}

/** @deprecated 使用 withDefaultCloudTtsPrefs */
export function withDefaultXfyunCredentials(
	prefs: MinimaxTtsUserPrefs,
): MinimaxTtsUserPrefs {
	return withDefaultCloudTtsPrefs(prefs);
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
	// 设置页改参后立即写入内存，试听/听书 cache key 与请求参数同步
	setCache(id, body);
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
		speed: prefs.minimaxSpeed,
		vol: prefs.minimaxVol,
		pitch: prefs.minimaxPitch,
		format: prefs.format,
		sampleRate: prefs.sampleRate,
		bitrate: prefs.bitrate,
		channel: prefs.channel,
	};
	if (prefs.emotion) body.emotion = prefs.emotion;
	if (prefs.languageBoost) body.languageBoost = prefs.languageBoost;
	return body;
}

/** 讯飞在线合成 POST body（不含 text） */
export function buildXfyunTtsRequestExtras(): Record<string, unknown> {
	const prefs = loadMinimaxTtsUserPrefs();
	const vcn = isXfyunTtsVcn(prefs.xfyunVoiceId)
		? prefs.xfyunVoiceId
		: DEFAULT_XFYUN_TTS_VCN;
	return {
		vcn,
		speed: Math.round(prefs.xfyunSpeed),
		volume: Math.round(prefs.xfyunVolume),
		pitch: prefs.xfyunPitch,
	};
}

/** 前端 MP3 缓存 key 后缀：讯飞凭证 / vcn / 语速等变更后不与旧缓存混用 */
export function buildXfyunTtsCacheKeySuffix(): string {
	const prefs = loadMinimaxTtsUserPrefs();
	const userId = getLoggedInUserId();
	const userPart = userId > 0 ? String(userId) : '0';
	const creds = `${prefs.xfyunAppId.trim()}\u0002${prefs.xfyunApiKey.trim()}\u0002${prefs.xfyunApiSecret.trim()}`;
	return `${userPart}\u0001${creds}\u0001${JSON.stringify(buildXfyunTtsRequestExtras())}`;
}

/** 前端 MP3 缓存 key 后缀：自定义参数 / 凭证变更后不与旧缓存混用 */
export function buildMinimaxTtsCacheKeySuffix(): string {
	const prefs = loadMinimaxTtsUserPrefs();
	if (!prefs.enabled) return '';
	const userId = getLoggedInUserId();
	const userPart = userId > 0 ? String(userId) : '0';
	const creds = prefs.minimaxApiKey.trim();
	return `${userPart}\u0001${creds}\u0001${JSON.stringify(buildMinimaxTtsRequestExtras())}`;
}

/** Edge TTS POST body（不含 text） */
export function buildEdgeTtsRequestExtras(): Record<string, unknown> {
	const prefs = loadMinimaxTtsUserPrefs();
	const voice = isEdgeTtsVoiceId(prefs.edgeVoiceId)
		? prefs.edgeVoiceId
		: DEFAULT_EDGE_TTS_VOICE;
	return {
		voice,
		speed: prefs.edgeSpeed,
		vol: prefs.edgeVol,
		pitch: prefs.edgePitch,
	};
}

/** 前端 MP3 缓存 key 后缀：Edge 发音人 / 语速等变更后不与旧缓存混用 */
export function buildEdgeTtsCacheKeySuffix(): string {
	const userId = getLoggedInUserId();
	const userPart = userId > 0 ? String(userId) : '0';
	return `${userPart}\u0001${JSON.stringify(buildEdgeTtsRequestExtras())}`;
}
