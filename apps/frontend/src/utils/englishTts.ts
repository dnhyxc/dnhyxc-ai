/**
 * 英语学习朗读：有效会员默认走云端 TTS（单词/语句/练习统一），失败则回退本机 Web Speech；
 * 非会员默认仅本机 Web Speech，不请求 TTS 接口。
 * `preferLocal: true` 时强制本机（如本机音色设置页试听）；默认按会员状态选路。
 * 云端 CosyVoice2 无 seed，同一句会随机漂移；对规范化文本做 MP3 缓存以保证重复播放读音一致。
 * 本机无法直接调用 macOS「翻译/词典」弹窗 API；初始默认 Karen 女声，可用 setPreferredLocalEnglishVoiceKey 切换。
 */
import { BASE_URL } from '@/constants';
import { SPEECH_MINIMAX_TTS_STREAM, SPEECH_TTS } from '@/service/api';
import {
	getLoggedInUserId,
	USER_INFO_STORAGE_KEY,
	userScopedStorageKey,
} from '@/store/loggedInUserId';
import { getPlatformFetch } from '@/utils/fetch';
import { isMembershipActiveFromUserInfo } from '@/utils/membershipActive';
import {
	buildMinimaxTtsCacheKeySuffix,
	buildMinimaxTtsRequestExtras,
	ensureMinimaxTtsUserPrefsLoaded,
	loadMinimaxTtsUserPrefs,
} from '@/utils/minimaxTtsPrefs';

type CloudTtsReady =
	| { kind: 'cached'; blob: Blob; cacheKey: string }
	| { kind: 'live'; response: Response; cacheKey: string };

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

// 句末停顿毫秒数（本机分段用）
const PAUSE_AFTER_SENTENCE_MS = 320;
// 子句停顿毫秒数
const PAUSE_AFTER_CLAUSE_MS = 280;
/** 单段 utterance 过长时浏览器本机 TTS 易截断或静默失败 */
const MAX_UTTERANCE_CHARS = 120;
/** 云端单次请求上限；更长走分段流水线（预取下一段，缩短首声） */
const MAX_SINGLE_CLOUD_TTS_CHARS = MAX_UTTERANCE_CHARS;

/** 文本是否以 CJK 为主（用于本机朗读选中文音色） */
function isPredominantlyCjk(text: string): boolean {
	let cjk = 0;
	let letters = 0;
	for (const ch of text) {
		if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch)) cjk += 1;
		else if (/[A-Za-z]/.test(ch)) letters += 1;
	}
	return cjk > 0 && cjk >= letters;
}

function splitLongText(text: string, maxLen: number): string[] {
	if (text.length <= maxLen) return [text];
	const parts: string[] = [];
	let rest = text;
	while (rest.length > maxLen) {
		let cut = maxLen;
		if (/[\u4e00-\u9fff]/.test(rest)) {
			cut = maxLen;
		} else {
			const space = rest.lastIndexOf(' ', maxLen);
			if (space > maxLen / 2) cut = space;
		}
		const piece = rest.slice(0, cut).trim();
		if (piece) parts.push(piece);
		rest = rest.slice(cut).trim();
	}
	if (rest) parts.push(rest);
	return parts.length > 0 ? parts : [text];
}

/**
 * 按句末 / 逗号分层切分（中英标点），段间插入停顿；过长段再硬切避免本机 TTS 失败
 */
function splitTextForTtsCadence(text: string): TtsCadenceChunk[] {
	const trimmed = text.trim();
	if (!trimmed) return [];

	const hasEnSentence = /[.!?]/.test(trimmed);
	const hasCnSentence = /[。！？]/.test(trimmed);
	const hasClause = /[,;，；：:]/.test(trimmed);

	if (
		!hasEnSentence &&
		!hasCnSentence &&
		!hasClause &&
		trimmed.length < MAX_UTTERANCE_CHARS
	) {
		return [{ text: trimmed, pauseAfterMs: 0 }];
	}

	const sentenceSpans = buildSentenceOffsetSpans(trimmed);
	const sentenceParts = sentenceSpans
		.map(({ start, end }) => trimmed.slice(start, end).trim())
		.filter(Boolean);
	const sentenceUnits = sentenceParts.length > 0 ? sentenceParts : [trimmed];

	const chunks: TtsCadenceChunk[] = [];
	for (let si = 0; si < sentenceUnits.length; si += 1) {
		const sent = sentenceUnits[si];
		const clauses = sent
			.split(/(?<=[,;，；：:])\s+/)
			.map((s) => s.trim())
			.filter(Boolean);
		const parts = clauses.length > 0 ? clauses : [sent];
		for (let ci = 0; ci < parts.length; ci += 1) {
			const subChunks = splitLongText(parts[ci], MAX_UTTERANCE_CHARS);
			for (let sub = 0; sub < subChunks.length; sub += 1) {
				const lastClause = ci === parts.length - 1;
				const lastSentence = si === sentenceUnits.length - 1;
				const lastSub = sub === subChunks.length - 1;
				chunks.push({
					text: subChunks[sub],
					pauseAfterMs: !lastSub
						? PAUSE_AFTER_CLAUSE_MS
						: !lastClause
							? PAUSE_AFTER_CLAUSE_MS
							: !lastSentence
								? PAUSE_AFTER_SENTENCE_MS
								: 0,
				});
			}
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
let cachedVoicePrefUserId = 0;

function normalizeVoiceKey(input: string): string {
	return input.trim().toLowerCase();
}

function localVoiceStorageKey(userId?: number): string {
	return userScopedStorageKey(LOCAL_ENGLISH_TTS_VOICE_KEY, userId);
}

function readPreferredVoiceKeyFromStorage(): string | null {
	if (typeof window === 'undefined') return null;
	const userId = getLoggedInUserId();
	if (userId !== cachedVoicePrefUserId) {
		cachedVoicePrefUserId = userId;
		resetCachedEnglishVoice();
	}
	if (userId <= 0) return null;
	const scopedKey = localVoiceStorageKey(userId);
	let raw = localStorage.getItem(scopedKey);
	if (!raw) {
		const legacy = localStorage.getItem(LOCAL_ENGLISH_TTS_VOICE_KEY);
		if (legacy) {
			localStorage.setItem(scopedKey, legacy);
			localStorage.removeItem(LOCAL_ENGLISH_TTS_VOICE_KEY);
			raw = legacy;
		}
	}
	if (!raw?.trim()) return null;
	return normalizeVoiceKey(raw);
}

/** 无用户配置时写入并固定使用 Karen */
function ensureDefaultLocalEnglishVoicePreference(): void {
	if (typeof window === 'undefined') return;
	const userId = getLoggedInUserId();
	if (userId <= 0) return;
	if (!readPreferredVoiceKeyFromStorage()) {
		localStorage.setItem(
			localVoiceStorageKey(userId),
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

	const voices = window.speechSynthesis.getVoices();
	if (!voices.length) {
		// 音色列表尚未就绪，勿缓存 null（否则后续朗读永远无 voice）
		return null;
	}

	if (cachedEnglishVoice !== undefined) {
		return cachedEnglishVoice;
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

function scoreChineseVoice(voice: SpeechSynthesisVoice): number {
	const lang = voice.lang.toLowerCase();
	if (!lang.startsWith('zh')) return -1;
	let score = 0;
	if (voice.localService) score += 40;
	if (lang.includes('cn') || lang.includes('hans')) score += 20;
	if (lang.includes('tw') || lang.includes('hant')) score += 8;
	if (voice.name.toLowerCase().includes('tingting')) score += 15;
	return score;
}

function pickChineseVoice(): SpeechSynthesisVoice | null {
	if (!isEnglishTtsSupported()) return null;
	const voices = window.speechSynthesis.getVoices();
	if (!voices.length) return null;
	let best: SpeechSynthesisVoice | null = null;
	let bestScore = -1;
	for (const v of voices) {
		const score = scoreChineseVoice(v);
		if (score > bestScore) {
			bestScore = score;
			best = v;
		}
	}
	return best;
}

function pickVoiceForChunk(chunkText: string): SpeechSynthesisVoice | null {
	if (isPredominantlyCjk(chunkText)) {
		return pickChineseVoice() ?? pickEnglishVoice();
	}
	return pickEnglishVoice();
}

function resetCachedEnglishVoice(): void {
	cachedEnglishVoice = undefined;
}

export type SpeakEnglishOptions = {
	rate?: number;
	pitch?: number;
	volume?: number;
};

/** TTS 节奏分段播放事件（供电子书逐句高亮等） */
export type TtsCadenceChunkEvent = {
	phase: 'start' | 'end';
	index: number;
	text: string;
	sentenceIndex: number;
	isLastInSentence: boolean;
	/** 当前 chunk 在 stripMarkdownForTts 后 plain 内的 [start, end) */
	plainStart: number;
	plainEnd: number;
	/** 当前句在 plain 内的 [start, end)（与 sentenceIndex 对齐） */
	sentencePlainStart: number;
	sentencePlainEnd: number;
};

export type PlayEnglishPreferredOptions = {
	/** 为 true 时强制本机 Web Speech（如本机音色设置试听）；省略时会员走云端、非会员走本机 */
	preferLocal?: boolean;
	/** 本机朗读时透传给 Web Speech */
	speak?: SpeakEnglishOptions;
	/** 每个 TTS 节奏段开始/结束（句内子句不重复触发句末） */
	onCadenceChunk?: (event: TtsCadenceChunkEvent) => void;
};

type CadencePlaybackHooks = Pick<PlayEnglishPreferredOptions, 'onCadenceChunk'>;

/** 句末边界（trimmed plain 内下标，不含边界字符之后的内容） */
function sentenceBoundaryEnd(trimmed: string, i: number): number {
	const ch = trimmed[i];
	if (!ch) return -1;
	if (/[.!?。！？；]/.test(ch)) return i + 1;
	// Unicode 省略号（… / …… 均在此截断）
	if (ch === '\u2026') {
		let j = i + 1;
		while (j < trimmed.length && trimmed[j] === '\u2026') j += 1;
		return j;
	}
	// ASCII 省略号
	if (ch === '.' && trimmed.startsWith('......', i)) return i + 6;
	if (ch === '.' && trimmed.startsWith('...', i) && trimmed[i + 3] !== '.') {
		return i + 3;
	}
	return -1;
}

/** 与 DOM 锚点 / TTS sentenceIndex 对齐的句界（plain 内 start/end 偏移） */
export function buildSentenceOffsetSpans(
	plain: string,
): Array<{ start: number; end: number }> {
	const trimmed = plain.trim();
	if (!trimmed) return [];

	const spans: Array<{ start: number; end: number }> = [];
	let rawStart = 0;

	for (let i = 0; i < trimmed.length; i += 1) {
		const boundary = sentenceBoundaryEnd(trimmed, i);
		if (boundary < 0) continue;

		const slice = trimmed.slice(rawStart, boundary);
		const content = slice.trim();
		if (content) {
			const lead = slice.length - slice.trimStart().length;
			const trail = slice.length - slice.trimEnd().length;
			spans.push({ start: rawStart + lead, end: boundary - trail });
		}

		rawStart = boundary;
		while (rawStart < trimmed.length && /\s/u.test(trimmed[rawStart]!)) {
			rawStart += 1;
		}
		i = boundary - 1;
	}

	if (rawStart < trimmed.length) {
		const tail = trimmed.slice(rawStart).trim();
		if (tail) {
			const lead =
				trimmed.slice(rawStart).length -
				trimmed.slice(rawStart).trimStart().length;
			spans.push({ start: rawStart + lead, end: trimmed.length });
		}
	}

	return spans.length > 0 ? spans : [{ start: 0, end: trimmed.length }];
}

function sentenceIndexAtOffset(
	spans: Array<{ start: number; end: number }>,
	offset: number,
): number {
	if (spans.length === 0) return 0;
	for (let i = spans.length - 1; i >= 0; i -= 1) {
		const span = spans[i]!;
		if (offset >= span.start) return i;
	}
	return 0;
}

function buildChunkOffsetMeta(plain: string, chunks: TtsCadenceChunk[]) {
	let searchPos = 0;
	return chunks.map((chunk) => {
		const idx = plain.indexOf(chunk.text, searchPos);
		const start = idx >= 0 ? idx : searchPos;
		const end = start + chunk.text.length;
		searchPos = end;
		return { start, end };
	});
}

function emitCadenceChunk(
	hooks: CadencePlaybackHooks | undefined,
	plain: string,
	chunks: TtsCadenceChunk[],
	index: number,
	phase: TtsCadenceChunkEvent['phase'],
): void {
	const onCadenceChunk = hooks?.onCadenceChunk;
	if (!onCadenceChunk) return;

	const chunk = chunks[index];
	if (!chunk) return;

	const sentences = buildSentenceOffsetSpans(plain);
	const offsets = buildChunkOffsetMeta(plain, chunks);
	const { start, end } = offsets[index] ?? { start: 0, end: chunk.text.length };
	const sentenceIndex = sentenceIndexAtOffset(sentences, start);
	const sentSpan = sentences[sentenceIndex] ?? {
		start: 0,
		end: plain.trim().length,
	};
	const nextStart = offsets[index + 1]?.start;
	const isLastInSentence =
		index === chunks.length - 1 ||
		(nextStart !== undefined &&
			sentenceIndexAtOffset(sentences, nextStart) !== sentenceIndex);

	onCadenceChunk({
		phase,
		index,
		text: chunk.text,
		sentenceIndex,
		isLastInSentence,
		plainStart: start,
		plainEnd: end,
		sentencePlainStart: sentSpan.start,
		sentencePlainEnd: sentSpan.end,
	});
}

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
	const cacheKey = plain + buildMinimaxTtsCacheKeySuffix();
	const hit = cloudTtsAudioCache.get(cacheKey);
	if (!hit) return null;
	cloudTtsAudioCache.delete(cacheKey);
	cloudTtsAudioCache.set(cacheKey, hit);
	return new Blob([hit], { type: 'audio/mpeg' });
}

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token')?.trim() || '';
}

/** 当前登录用户是否为有效会员（读 localStorage userInfo，与资料页 / LLM 判定一致） */
function isCloudEnglishTtsAllowed(): boolean {
	if (typeof window === 'undefined') return false;
	const raw = localStorage.getItem(USER_INFO_STORAGE_KEY);
	if (!raw?.trim()) return false;
	try {
		return isMembershipActiveFromUserInfo(
			JSON.parse(raw) as Record<string, unknown>,
		);
	} catch {
		return false;
	}
}

/** 会员可走云端；非会员需本机 Web Speech 可用 */
export function isEnglishPlaybackAvailable(): boolean {
	if (!isCloudEnglishTtsAllowed()) {
		return isEnglishTtsSupported();
	}
	if (!shouldUseCloudEnglishTts()) {
		return isEnglishTtsSupported();
	}
	return true;
}

/** 会员朗读选路：读内存缓存中的 playbackSource；非会员恒 false */
function shouldUseCloudEnglishTts(
	options?: PlayEnglishPreferredOptions,
): boolean {
	if (options?.preferLocal === true) return false;
	if (options?.preferLocal === false) {
		return isCloudEnglishTtsAllowed();
	}
	if (!isCloudEnglishTtsAllowed()) return false;
	const prefs = loadMinimaxTtsUserPrefs();
	return prefs.playbackSource !== 'local';
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

async function readResponseBodyAsArrayBuffer(
	res: Response,
): Promise<ArrayBuffer> {
	const reader = res.body?.getReader();
	if (!reader) {
		return res.arrayBuffer();
	}
	const parts: Uint8Array[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value?.length) parts.push(value);
	}
	return mergeUint8Arrays(parts);
}

function mergeUint8Arrays(parts: Uint8Array[]): ArrayBuffer {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const merged = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		merged.set(part, offset);
		offset += part.length;
	}
	return merged.buffer;
}

/** 发起云端 TTS 请求；命中 LRU 则直接返回 Blob */
async function startCloudTts(plain: string): Promise<CloudTtsReady> {
	await ensureMinimaxTtsUserPrefsLoaded();
	const cacheKey = plain + buildMinimaxTtsCacheKeySuffix();
	const cached = getCloudTtsFromCache(plain);
	if (cached) {
		return { kind: 'cached', blob: cached, cacheKey };
	}

	const token = readToken();
	if (!token) {
		throw new Error('NO_TOKEN');
	}
	const platformFetch = await getPlatformFetch();
	const headers = {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
	};

	let res = await platformFetch(BASE_URL + SPEECH_MINIMAX_TTS_STREAM, {
		method: 'POST',
		headers,
		body: JSON.stringify({ text: plain, ...buildMinimaxTtsRequestExtras() }),
	});

	if (res.status === 503 || res.status === 401 || res.status === 502) {
		res = await platformFetch(BASE_URL + SPEECH_TTS, {
			method: 'POST',
			headers,
			body: JSON.stringify({ text: plain }),
		});
	}

	if (!res.ok) {
		throw new Error(`TTS_HTTP_${res.status}`);
	}

	return { kind: 'live', response: res, cacheKey };
}

function waitCloudAudioEnd(
	audio: HTMLAudioElement,
	objectUrl: string,
	generation: number,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let settled = false;
		let timeoutId = 0;

		const releaseUrl = () => {
			if (cloudObjectUrl === objectUrl) {
				URL.revokeObjectURL(objectUrl);
				cloudObjectUrl = null;
				cloudAudio = null;
			}
		};

		const finish = (err?: Error) => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timeoutId);
			releaseUrl();
			if (err && isPlaybackGenerationActive(generation)) {
				reject(err);
				return;
			}
			resolve();
		};

		const armTimeout = () => {
			window.clearTimeout(timeoutId);
			const durationMs =
				Number.isFinite(audio.duration) && audio.duration > 0
					? audio.duration * 1000 * 1.5 + 5000
					: 90_000;
			timeoutId = window.setTimeout(
				() => {
					audio.pause();
					finish(new Error('AUDIO_TIMEOUT'));
				},
				Math.min(durationMs, 600_000),
			);
		};

		timeoutId = window.setTimeout(() => {
			audio.pause();
			finish(new Error('AUDIO_TIMEOUT'));
		}, 120_000);

		audio.onloadedmetadata = () => armTimeout();
		audio.onended = () => finish();
		audio.onerror = () => {
			if (!isPlaybackGenerationActive(generation)) {
				finish();
				return;
			}
			finish(new Error('AUDIO_PLAY'));
		};
	});
}

async function playCloudTtsReady(
	ready: CloudTtsReady,
	generation: number,
): Promise<void> {
	if (ready.kind === 'cached') {
		await playCloudMp3Blob(ready.blob, generation);
		return;
	}

	// ponytail: 不用 MSE 边下边播——MiniMax MP3 分片常不对齐 MPEG 帧，会无声且 onended 不触发
	const buf = await readResponseBodyAsArrayBuffer(ready.response);
	if (!isPlaybackGenerationActive(generation)) return;
	touchCloudTtsCache(ready.cacheKey, buf);
	await playCloudMp3Blob(new Blob([buf], { type: 'audio/mpeg' }), generation);
}

/**
 * 按句读节奏分段，播当前段时预取下一段；每段收齐 MP3 后 Blob 播放。
 */
async function playCloudTtsCadenceSegments(
	plain: string,
	generation: number,
	hooks?: CadencePlaybackHooks,
): Promise<void> {
	const chunks = splitTextForTtsCadence(plain);
	if (chunks.length === 0) return;

	if (
		chunks.length === 1 &&
		chunks[0].text.length <= MAX_SINGLE_CLOUD_TTS_CHARS
	) {
		emitCadenceChunk(hooks, plain, chunks, 0, 'start');
		const ready = await startCloudTts(chunks[0].text);
		if (!isPlaybackGenerationActive(generation)) return;
		await playCloudTtsReady(ready, generation);
		if (!isPlaybackGenerationActive(generation)) return;
		emitCadenceChunk(hooks, plain, chunks, 0, 'end');
		return;
	}

	let pendingReady: Promise<CloudTtsReady> | null = startCloudTts(
		chunks[0].text,
	);

	for (let i = 0; i < chunks.length; i += 1) {
		if (!isPlaybackGenerationActive(generation)) return;

		if (i > 0) {
			const prevPause = chunks[i - 1]?.pauseAfterMs ?? PAUSE_AFTER_CLAUSE_MS;
			await pauseMs(prevPause);
			if (!isPlaybackGenerationActive(generation)) return;
		}

		emitCadenceChunk(hooks, plain, chunks, i, 'start');

		const ready = await pendingReady!;
		if (!isPlaybackGenerationActive(generation)) return;

		pendingReady =
			i + 1 < chunks.length ? startCloudTts(chunks[i + 1].text) : null;

		await playCloudTtsReady(ready, generation);
		if (!isPlaybackGenerationActive(generation)) return;
		emitCadenceChunk(hooks, plain, chunks, i, 'end');
	}
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
	return audio.play().then(
		() => waitCloudAudioEnd(audio, url, generation),
		(err) => {
			if (!isPlaybackGenerationActive(generation)) {
				if (cloudObjectUrl === url) {
					URL.revokeObjectURL(url);
					cloudObjectUrl = null;
					cloudAudio = null;
				}
				return Promise.resolve();
			}
			if (cloudObjectUrl === url) {
				URL.revokeObjectURL(url);
				cloudObjectUrl = null;
				cloudAudio = null;
			}
			throw err;
		},
	);
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
		const voice = pickVoiceForChunk(plain);
		if (voice) {
			utter.voice = voice;
			utter.lang =
				voice.lang || (isPredominantlyCjk(plain) ? 'zh-CN' : 'en-US');
		} else {
			utter.lang = isPredominantlyCjk(plain) ? 'zh-CN' : 'en-US';
		}

		// 略慢于 1.0，长句更清晰；与系统词典语速接近
		utter.rate = options?.rate ?? 0.9;
		// 音高（pitch）：默认为 1，表示正常音高。（可通过 options.pitch 覆盖）
		utter.pitch = options?.pitch ?? 1;
		// 音量（volume）：默认为 1（可能是自定义规范，原生取值范围是 0~1），可通过 options.volume 覆盖
		utter.volume = options?.volume ?? 1;

		utter.onend = () => resolve();
		utter.onerror = () => resolve();
		window.speechSynthesis.speak(utter);
		// Chrome 等浏览器在长文本分段时可能挂起，轻触 resume 保证后续段能播
		window.speechSynthesis.resume();
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
	options?: SpeakEnglishOptions & CadencePlaybackHooks,
): Promise<void> {
	if (!isEnglishTtsSupported()) return;

	const plain = stripMarkdownForTts(text);
	if (!plain) return;
	if (!isPlaybackGenerationActive(generation)) return;

	await waitForVoicesReady();
	if (!isPlaybackGenerationActive(generation)) return;
	resetCachedEnglishVoice();

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
		emitCadenceChunk(options, plain, chunks, i, 'start');
		await speakOneUtterance(chunk.text, generation, {
			rate: options?.rate ?? chunkRate,
			pitch: options?.pitch,
			volume: options?.volume,
		});
		if (!isPlaybackGenerationActive(generation)) return;
		emitCadenceChunk(options, plain, chunks, i, 'end');
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
	const useCloud = shouldUseCloudEnglishTts(options);
	const cadenceHooks: CadencePlaybackHooks = {
		onCadenceChunk: options?.onCadenceChunk,
	};

	if (!useCloud) {
		if (!isPlaybackGenerationActive(generation)) return;
		if (!isEnglishTtsSupported()) {
			throw new Error('NO_TTS');
		}
		await speakEnglishTextWithGeneration(rawText, generation, {
			...speakOpts,
			...cadenceHooks,
		});
		return;
	}

	try {
		await playCloudTtsCadenceSegments(plain, generation, cadenceHooks);
		return;
	} catch {
		if (!isPlaybackGenerationActive(generation)) return;
		if (!isEnglishTtsSupported()) {
			throw new Error('NO_TTS');
		}
		await speakEnglishTextWithGeneration(rawText, generation, {
			...speakOpts,
			...cadenceHooks,
		});
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

/** 须在用户点击同步调用，降低后续 async TTS / Audio 被 autoplay 策略拦截的概率 */
export function primeEnglishPlaybackForUserGesture(): void {
	if (typeof window === 'undefined') return;
	warmupEnglishTtsVoices();
	try {
		window.speechSynthesis?.resume();
		const unlock = new SpeechSynthesisUtterance('\u200b');
		unlock.volume = 0;
		unlock.rate = 10;
		window.speechSynthesis?.speak(unlock);
	} catch {
		// 部分环境无 speechSynthesis
	}
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
	const userId = getLoggedInUserId();
	if (userId <= 0) return;
	resetCachedEnglishVoice();
	const storageKey = localVoiceStorageKey(userId);
	if (!key?.trim()) {
		localStorage.setItem(storageKey, DEFAULT_LOCAL_ENGLISH_TTS_VOICE_KEY);
		return;
	}
	localStorage.setItem(storageKey, normalizeVoiceKey(key));
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

/**
 * - ponytail: 模块自检——长文须能切成多段，否则云端首播仍等整段合成，
 * - 任意地方第一次 import '@/utils/englishTts' 时，模块求值到文件末尾就会跑这段 if。
 * - 例如电子书划句朗读、英语学习页、云 TTS 设置页等，
 * 只要 import 了这个模块，自检就会执行一次（模块通常只加载一次，不会重复跑）。
 */
if (splitTextForTtsCadence('测'.repeat(200)).length < 2) {
	throw new Error('[englishTts] 长文分段异常，云端流水线无法缩短首声');
}
