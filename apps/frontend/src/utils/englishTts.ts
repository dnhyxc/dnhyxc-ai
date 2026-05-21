/**
 * 英语学习朗读：默认优先云端 TTS，失败则本机 Web Speech；
 * `preferLocal: true` 时优先本机（适合单词），不支持则抛错。
 * 云端 CosyVoice2 无 seed，同一句会随机漂移；对规范化文本做 MP3 缓存以保证重复播放读音一致。
 * 本机无法直接调用 macOS「翻译/词典」弹窗 API；初始默认 Karen 女声，可用 setPreferredLocalEnglishVoiceKey 切换。
 */
import { BASE_URL } from '@/constant';
import { SPEECH_TTS } from '@/service/api';
import { getPlatformFetch } from '@/utils/fetch';

export function isEnglishTtsSupported(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.speechSynthesis !== 'undefined' &&
		typeof window.SpeechSynthesisUtterance !== 'undefined'
	);
}

export function stripMarkdownForTts(raw: string): string {
	if (!raw?.trim()) return '';
	return raw
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`\n]+`/g, ' ')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/^[-*+]\s+/gm, '')
		.replace(/^\d+\.\s+/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** 本机朗读分段：文本 + 段后停顿时长（毫秒），用于句读顿挫 */
type TtsCadenceChunk = { text: string; pauseAfterMs: number };

const PAUSE_AFTER_SENTENCE_MS = 480;
const PAUSE_AFTER_CLAUSE_MS = 300;

/**
 * 按句末 / 逗号分层切分，段间插入不同时长停顿（无法调用系统「翻译」弹窗 API，靠停顿模拟顿挫）
 */
function splitTextForTtsCadence(text: string): TtsCadenceChunk[] {
	const trimmed = text.trim();
	if (!trimmed) return [];
	if (!/[.!?;,]/.test(trimmed) && trimmed.length < 72) {
		return [{ text: trimmed, pauseAfterMs: 0 }];
	}

	const sentences = trimmed
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (sentences.length === 0) {
		return [{ text: trimmed, pauseAfterMs: 0 }];
	}

	const chunks: TtsCadenceChunk[] = [];
	for (let si = 0; si < sentences.length; si += 1) {
		const sent = sentences[si];
		const clauses = sent
			.split(/(?<=[,;:])\s+/)
			.map((s) => s.trim())
			.filter(Boolean);
		const parts = clauses.length > 0 ? clauses : [sent];
		for (let ci = 0; ci < parts.length; ci += 1) {
			const lastClause = ci === parts.length - 1;
			const lastSentence = si === sentences.length - 1;
			chunks.push({
				text: parts[ci],
				pauseAfterMs: !lastClause
					? PAUSE_AFTER_CLAUSE_MS
					: !lastSentence
						? PAUSE_AFTER_SENTENCE_MS
						: 0,
			});
		}
	}
	return chunks.length > 0 ? chunks : [{ text: trimmed, pauseAfterMs: 0 }];
}

/** 本机英语朗读偏好音色（localStorage 存名称关键字，如 karen、moira、victoria） */
export const LOCAL_ENGLISH_TTS_VOICE_KEY = 'english_learning_local_tts_voice';

/** 初始默认本机英语女声（首次进入应用 / 恢复默认时写入并用于选音） */
export const DEFAULT_LOCAL_ENGLISH_TTS_VOICE_KEY = 'karen';

/**
 * 女性音色回退列表（当前设备无 Karen 时按序尝试）。
 */
export const PREFERRED_LOCAL_ENGLISH_FEMALE_VOICES = [
	'karen',
	'moira',
	'victoria',
	'samantha',
	'kate',
	'susan',
	'zira',
	'hazel',
	'tessa',
	'fiona',
	'serena',
	'nicky',
	'ava',
] as const;

export type PreferredLocalEnglishFemaleVoice =
	(typeof PREFERRED_LOCAL_ENGLISH_FEMALE_VOICES)[number];

/** 常见男声关键字（macOS / Windows Web Speech 显示名） */
export const PREFERRED_LOCAL_ENGLISH_MALE_VOICES = [
	'alex',
	'daniel',
	'tom',
	'fred',
	'oliver',
	'jamie',
	'aaron',
	'bruce',
	'david',
	'james',
	'ralph',
	'lee',
	'gordon',
	'richard',
	'mark',
	'nathan',
] as const;

const LOCAL_ENGLISH_MALE_VOICE_HINTS = PREFERRED_LOCAL_ENGLISH_MALE_VOICES;

export type LocalEnglishVoiceGender = 'female' | 'male' | 'unknown';

export type LocalEnglishVoiceOption = {
	name: string;
	lang: string;
	voiceURI: string;
	gender: LocalEnglishVoiceGender;
};

/** 根据系统音色名推断男声 / 女声 */
export function classifyEnglishVoiceGender(
	name: string,
): LocalEnglishVoiceGender {
	const nameLower = name.toLowerCase();
	if (LOCAL_ENGLISH_MALE_VOICE_HINTS.some((hint) => nameLower.includes(hint))) {
		return 'male';
	}
	if (
		PREFERRED_LOCAL_ENGLISH_FEMALE_VOICES.some((hint) =>
			nameLower.includes(hint),
		)
	) {
		return 'female';
	}
	return 'unknown';
}

let cachedEnglishVoice: SpeechSynthesisVoice | null | undefined;

function normalizeVoiceKey(input: string): string {
	return input.trim().toLowerCase();
}

function readPreferredVoiceKeyFromStorage(): string | null {
	if (typeof window === 'undefined') return null;
	const raw = localStorage.getItem(LOCAL_ENGLISH_TTS_VOICE_KEY);
	if (!raw?.trim()) return null;
	return normalizeVoiceKey(raw);
}

/** 无用户配置时写入并固定使用 Karen */
function ensureDefaultLocalEnglishVoicePreference(): void {
	if (typeof window === 'undefined') return;
	if (!readPreferredVoiceKeyFromStorage()) {
		localStorage.setItem(
			LOCAL_ENGLISH_TTS_VOICE_KEY,
			DEFAULT_LOCAL_ENGLISH_TTS_VOICE_KEY,
		);
	}
}

/** 实际用于选音的关键字（保证初始即为 karen） */
function resolveVoiceKeyForPlayback(): string {
	ensureDefaultLocalEnglishVoicePreference();
	return (
		readPreferredVoiceKeyFromStorage() ?? DEFAULT_LOCAL_ENGLISH_TTS_VOICE_KEY
	);
}

function isLikelyMaleEnglishVoice(nameLower: string): boolean {
	return LOCAL_ENGLISH_MALE_VOICE_HINTS.some((hint) =>
		nameLower.includes(hint),
	);
}

function scoreEnglishVoice(
	voice: SpeechSynthesisVoice,
	preferredKey: string | null,
): number {
	const name = voice.name.toLowerCase();
	const lang = voice.lang.toLowerCase();
	if (!lang.startsWith('en')) return -1;

	if (preferredKey) {
		if (
			name.includes(preferredKey) ||
			voice.voiceURI.toLowerCase().includes(preferredKey)
		) {
			return 1000;
		}
		return -1;
	}

	if (isLikelyMaleEnglishVoice(name)) return -1;

	let score = 0;
	if (voice.localService) score += 40;
	if (lang.startsWith('en-us')) score += 12;
	else if (lang.startsWith('en-gb')) score += 8;

	for (let i = 0; i < PREFERRED_LOCAL_ENGLISH_FEMALE_VOICES.length; i += 1) {
		if (name.includes(PREFERRED_LOCAL_ENGLISH_FEMALE_VOICES[i])) {
			score += 120 - i;
			break;
		}
	}

	if (name.includes('premium') || name.includes('enhanced')) score += 25;
	if (name.includes('google')) score -= 15;
	if (name.includes('compact')) score -= 25;

	return score;
}

function findVoiceByKey(
	voices: SpeechSynthesisVoice[],
	key: string,
): SpeechSynthesisVoice | null {
	const normalized = normalizeVoiceKey(key);
	for (const v of voices) {
		const name = v.name.toLowerCase();
		if (
			name.includes(normalized) ||
			v.voiceURI.toLowerCase().includes(normalized)
		) {
			return v;
		}
	}
	return null;
}

function pauseMs(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
	if (!isEnglishTtsSupported()) return null;
	if (cachedEnglishVoice !== undefined) {
		return cachedEnglishVoice;
	}

	const voices = window.speechSynthesis.getVoices();
	if (!voices.length) {
		cachedEnglishVoice = null;
		return null;
	}

	const activeKey = resolveVoiceKeyForPlayback();
	let best: SpeechSynthesisVoice | null = null;
	let bestScore = -1;
	for (const v of voices) {
		const score = scoreEnglishVoice(v, activeKey);
		if (score > bestScore) {
			bestScore = score;
			best = v;
		}
	}

	if (!best) {
		best = findVoiceByKey(voices, activeKey);
	}

	if (!best) {
		for (const fallback of PREFERRED_LOCAL_ENGLISH_FEMALE_VOICES) {
			best = findVoiceByKey(voices, fallback);
			if (best) break;
		}
	}

	cachedEnglishVoice = best;
	return best;
}

function resetCachedEnglishVoice(): void {
	cachedEnglishVoice = undefined;
}

export type SpeakEnglishOptions = {
	rate?: number;
	pitch?: number;
	volume?: number;
};

export type PlayEnglishPreferredOptions = {
	/** 为 true 时优先本机 Web Speech（单词）；默认 false 为优先云端 TTS（句子） */
	preferLocal?: boolean;
	/** 本机朗读时透传给 Web Speech */
	speak?: SpeakEnglishOptions;
};

let cloudAudio: HTMLAudioElement | null = null;
let cloudObjectUrl: string | null = null;

/** 每次新播放或 stopAll 时递增，用于丢弃过期的异步 TTS 请求/本机朗读 */
let playbackGeneration = 0;

const CLOUD_TTS_CACHE_MAX = 64;
/** 规范化文本 → MP3 ArrayBuffer（LRU：重复 get 时移到末尾） */
const cloudTtsAudioCache = new Map<string, ArrayBuffer>();

function touchCloudTtsCache(key: string, audio: ArrayBuffer): void {
	if (cloudTtsAudioCache.has(key)) {
		cloudTtsAudioCache.delete(key);
	}
	cloudTtsAudioCache.set(key, audio);
	while (cloudTtsAudioCache.size > CLOUD_TTS_CACHE_MAX) {
		const oldest = cloudTtsAudioCache.keys().next().value;
		if (oldest === undefined) break;
		cloudTtsAudioCache.delete(oldest);
	}
}

function getCloudTtsFromCache(plain: string): Blob | null {
	const hit = cloudTtsAudioCache.get(plain);
	if (!hit) return null;
	cloudTtsAudioCache.delete(plain);
	cloudTtsAudioCache.set(plain, hit);
	return new Blob([hit], { type: 'audio/mpeg' });
}

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token')?.trim() || '';
}

function isPlaybackGenerationActive(generation: number): boolean {
	return generation === playbackGeneration;
}

/** 仅停止当前音频与本机 speech，不递增世代（供会话内切换介质使用） */
function stopPlaybackMediaOnly(): void {
	if (isEnglishTtsSupported()) {
		window.speechSynthesis.cancel();
	}
	if (cloudAudio) {
		cloudAudio.pause();
		cloudAudio.src = '';
		cloudAudio.load();
		cloudAudio = null;
	}
	if (cloudObjectUrl) {
		URL.revokeObjectURL(cloudObjectUrl);
		cloudObjectUrl = null;
	}
}

/** 开始新的播放会话：作废上一轮并清空介质 */
function beginPlaybackSession(): number {
	playbackGeneration += 1;
	stopPlaybackMediaOnly();
	return playbackGeneration;
}

export function stopEnglishTts(): void {
	if (!isEnglishTtsSupported()) return;
	window.speechSynthesis.cancel();
}

export function stopCloudEnglishTts(): void {
	if (cloudAudio) {
		cloudAudio.pause();
		cloudAudio.src = '';
		cloudAudio.load();
		cloudAudio = null;
	}
	if (cloudObjectUrl) {
		URL.revokeObjectURL(cloudObjectUrl);
		cloudObjectUrl = null;
	}
}

export function stopAllEnglishPlayback(): void {
	playbackGeneration += 1;
	stopPlaybackMediaOnly();
}

async function fetchCloudTtsBlob(plain: string): Promise<Blob> {
	const cached = getCloudTtsFromCache(plain);
	if (cached) {
		return cached;
	}

	const token = readToken();
	if (!token) {
		throw new Error('NO_TOKEN');
	}
	const platformFetch = await getPlatformFetch();
	const res = await platformFetch(BASE_URL + SPEECH_TTS, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ text: plain }),
	});
	if (!res.ok) {
		throw new Error(`TTS_HTTP_${res.status}`);
	}
	const blob = await res.blob();
	const buf = await blob.arrayBuffer();
	touchCloudTtsCache(plain, buf);
	return new Blob([buf], { type: 'audio/mpeg' });
}

function playCloudMp3Blob(blob: Blob, generation: number): Promise<void> {
	stopPlaybackMediaOnly();
	if (!isPlaybackGenerationActive(generation)) {
		return Promise.resolve();
	}

	const url = URL.createObjectURL(blob);
	cloudObjectUrl = url;
	const audio = new Audio(url);
	cloudAudio = audio;
	return new Promise((resolve, reject) => {
		audio.onended = () => {
			if (!isPlaybackGenerationActive(generation)) {
				if (cloudObjectUrl === url) {
					URL.revokeObjectURL(url);
					cloudObjectUrl = null;
					cloudAudio = null;
				}
				resolve();
				return;
			}
			if (cloudObjectUrl === url) {
				URL.revokeObjectURL(url);
				cloudObjectUrl = null;
				cloudAudio = null;
			}
			resolve();
		};
		audio.onerror = () => {
			if (cloudObjectUrl === url) {
				URL.revokeObjectURL(url);
				cloudObjectUrl = null;
				cloudAudio = null;
			}
			if (!isPlaybackGenerationActive(generation)) {
				resolve();
				return;
			}
			reject(new Error('AUDIO_PLAY'));
		};
		void audio.play().catch((err) => {
			if (!isPlaybackGenerationActive(generation)) {
				resolve();
				return;
			}
			reject(err);
		});
	});
}

function speakOneUtterance(
	plain: string,
	generation: number,
	options?: SpeakEnglishOptions,
): Promise<void> {
	return new Promise((resolve) => {
		if (
			!isPlaybackGenerationActive(generation) ||
			!isEnglishTtsSupported() ||
			!plain
		) {
			resolve();
			return;
		}

		const utter = new SpeechSynthesisUtterance(plain);
		utter.lang = 'en-US';

		const voice = pickEnglishVoice();
		if (voice) {
			utter.voice = voice;
			utter.lang = voice.lang || 'en-US';
		}

		// 略慢于 1.0，长句更清晰；与系统词典语速接近
		utter.rate = options?.rate ?? 0.9;
		utter.pitch = options?.pitch ?? 1;
		utter.volume = options?.volume ?? 1;

		utter.onend = () => resolve();
		utter.onerror = () => resolve();
		window.speechSynthesis.speak(utter);
	});
}

function waitForVoicesReady(): Promise<void> {
	if (!isEnglishTtsSupported()) return Promise.resolve();
	if (window.speechSynthesis.getVoices().length > 0) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			window.speechSynthesis.removeEventListener('voiceschanged', finish);
			resolve();
		};
		window.speechSynthesis.addEventListener('voiceschanged', finish);
		window.setTimeout(finish, 400);
	});
}

async function speakEnglishTextWithGeneration(
	text: string,
	generation: number,
	options?: SpeakEnglishOptions,
): Promise<void> {
	if (!isEnglishTtsSupported()) return;

	const plain = stripMarkdownForTts(text);
	if (!plain) return;
	if (!isPlaybackGenerationActive(generation)) return;

	await waitForVoicesReady();
	if (!isPlaybackGenerationActive(generation)) return;

	const chunks = splitTextForTtsCadence(plain);
	const chunkRate = chunks.length > 1 ? 0.86 : 0.9;
	for (let i = 0; i < chunks.length; i += 1) {
		if (!isPlaybackGenerationActive(generation)) return;
		const chunk = chunks[i];
		if (i > 0) {
			const prevPause = chunks[i - 1]?.pauseAfterMs ?? PAUSE_AFTER_CLAUSE_MS;
			await pauseMs(prevPause);
			if (!isPlaybackGenerationActive(generation)) return;
		}
		await speakOneUtterance(chunk.text, generation, {
			...options,
			rate: options?.rate ?? chunkRate,
		});
	}
}

export async function speakEnglishText(
	text: string,
	options?: SpeakEnglishOptions,
): Promise<void> {
	const generation = beginPlaybackSession();
	await speakEnglishTextWithGeneration(text, generation, options);
}

export async function playEnglishPreferred(
	rawText: string,
	options?: PlayEnglishPreferredOptions,
): Promise<void> {
	const plain = stripMarkdownForTts(rawText);
	if (!plain) return;

	const generation = beginPlaybackSession();
	const speakOpts = options?.speak;

	if (options?.preferLocal) {
		if (!isPlaybackGenerationActive(generation)) return;
		if (!isEnglishTtsSupported()) {
			throw new Error('NO_TTS');
		}
		await speakEnglishTextWithGeneration(rawText, generation, speakOpts);
		return;
	}

	try {
		const blob = await fetchCloudTtsBlob(plain);
		if (!isPlaybackGenerationActive(generation)) return;
		await playCloudMp3Blob(blob, generation);
		return;
	} catch {
		if (!isPlaybackGenerationActive(generation)) return;
		if (!isEnglishTtsSupported()) {
			throw new Error('NO_TTS');
		}
		await speakEnglishTextWithGeneration(rawText, generation, speakOpts);
	}
}

export function warmupEnglishTtsVoices(): void {
	if (!isEnglishTtsSupported()) return;
	ensureDefaultLocalEnglishVoicePreference();
	resetCachedEnglishVoice();
	void window.speechSynthesis.getVoices();
	window.speechSynthesis.addEventListener('voiceschanged', () => {
		resetCachedEnglishVoice();
		void window.speechSynthesis.getVoices();
	});
}

/** 当前选中的本机英语音色名 */
export function getSelectedLocalEnglishVoiceName(): string | null {
	return pickEnglishVoice()?.name ?? null;
}

/** 用户偏好关键字（localStorage）；首次访问会初始化为 {@link DEFAULT_LOCAL_ENGLISH_TTS_VOICE_KEY} */
export function getPreferredLocalEnglishVoiceKey(): string | null {
	ensureDefaultLocalEnglishVoicePreference();
	return readPreferredVoiceKeyFromStorage();
}

/**
 * 设置本机英语女声偏好（如 `karen`、`moira`、`victoria`）。
 * 传入 null 或空字符串则恢复为默认 {@link DEFAULT_LOCAL_ENGLISH_TTS_VOICE_KEY}（Karen）。
 */
export function setPreferredLocalEnglishVoiceKey(key: string | null): void {
	if (typeof window === 'undefined') return;
	resetCachedEnglishVoice();
	if (!key?.trim()) {
		localStorage.setItem(
			LOCAL_ENGLISH_TTS_VOICE_KEY,
			DEFAULT_LOCAL_ENGLISH_TTS_VOICE_KEY,
		);
		return;
	}
	localStorage.setItem(LOCAL_ENGLISH_TTS_VOICE_KEY, normalizeVoiceKey(key));
}

const GENDER_SORT_ORDER: Record<LocalEnglishVoiceGender, number> = {
	female: 0,
	male: 1,
	unknown: 2,
};

/** 列出当前设备可用的英语音色（含男声 / 女声分类） */
export function listLocalEnglishVoices(): LocalEnglishVoiceOption[] {
	if (!isEnglishTtsSupported()) return [];
	return window.speechSynthesis
		.getVoices()
		.filter((v) => v.lang.toLowerCase().startsWith('en'))
		.map((v) => ({
			name: v.name,
			lang: v.lang,
			voiceURI: v.voiceURI,
			gender: classifyEnglishVoiceGender(v.name),
		}))
		.filter((v) => v.gender !== 'unknown')
		.sort((a, b) => {
			const g = GENDER_SORT_ORDER[a.gender] - GENDER_SORT_ORDER[b.gender];
			if (g !== 0) return g;
			return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
		});
}

/** @deprecated 请用 listLocalEnglishVoices */
export function listLocalEnglishFemaleVoices(): Array<{
	name: string;
	lang: string;
	voiceURI: string;
}> {
	return listLocalEnglishVoices()
		.filter((v) => v.gender === 'female')
		.map(({ name, lang, voiceURI }) => ({ name, lang, voiceURI }));
}

/** 从系统音色显示名推断 localStorage 偏好关键字 */
export function inferVoicePreferenceKeyFromName(name: string): string {
	const nameLower = name.toLowerCase();
	for (const key of PREFERRED_LOCAL_ENGLISH_FEMALE_VOICES) {
		if (nameLower.includes(key)) return key;
	}
	for (const key of PREFERRED_LOCAL_ENGLISH_MALE_VOICES) {
		if (nameLower.includes(key)) return key;
	}
	return nameLower.split(/[\s(]/)[0]?.trim() || nameLower;
}

/** 当前生效的本机英语音色 URI（设置页下拉选中值） */
export function getActiveLocalEnglishVoiceUri(): string | null {
	return pickEnglishVoice()?.voiceURI ?? null;
}

/** 设置页：按 Web Speech 的 voiceURI 选择音色 */
export function setPreferredLocalEnglishVoiceByUri(voiceURI: string): void {
	if (!voiceURI.trim()) {
		setPreferredLocalEnglishVoiceKey(null);
		return;
	}
	if (!isEnglishTtsSupported()) return;
	const voice = window.speechSynthesis
		.getVoices()
		.find((v) => v.voiceURI === voiceURI);
	if (!voice) return;
	setPreferredLocalEnglishVoiceKey(inferVoicePreferenceKeyFromName(voice.name));
}

/** 设置页「自动」选项的 Select value */
export const LOCAL_ENGLISH_TTS_VOICE_AUTO = '__auto__';
