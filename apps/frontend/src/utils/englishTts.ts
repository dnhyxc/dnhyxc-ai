/**
 * 英语学习朗读：有效会员默认走云端 TTS（单词/语句/练习统一），失败则回退本机 Web Speech；
 * 非会员默认仅本机 Web Speech，不请求 TTS 接口。
 * `preferLocal: true` 时强制本机（如本机音色设置页试听）；默认按会员状态选路。
 * 云端 CosyVoice2 / MiniMax / 讯飞在线 无 seed，同一句会随机漂移；对规范化文本做 MP3 缓存以保证重复播放读音一致。
 * 本机无法直接调用 macOS「翻译/词典」弹窗 API；初始默认 Karen 女声，可用 setPreferredLocalEnglishVoiceKey 切换。
 */
import { Toast } from '@ui/sonner';
import { BASE_URL } from '@/constants';
import { translateSync } from '@/i18n';
import {
	SPEECH_EDGE_TTS,
	SPEECH_EDGE_TTS_STREAM,
	SPEECH_MINIMAX_TTS_STREAM,
	SPEECH_XFYUN_TTS_STREAM,
} from '@/service/api';
import {
	getLoggedInUserId,
	USER_INFO_STORAGE_KEY,
	userScopedStorageKey,
} from '@/store/loggedInUserId';
import { getPlatformFetch } from '@/utils/fetch';
import { isMembershipActiveFromUserInfo } from '@/utils/membershipActive';
import {
	buildEdgeTtsCacheKeySuffix,
	buildEdgeTtsRequestExtras,
	buildMinimaxTtsCacheKeySuffix,
	buildMinimaxTtsRequestExtras,
	buildXfyunTtsCacheKeySuffix,
	buildXfyunTtsRequestExtras,
	ensureMinimaxTtsUserPrefsLoaded,
	loadMinimaxTtsUserPrefs,
} from '@/utils/minimaxTtsPrefs';
import { isTauriRuntime } from '@/utils/runtime';

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

/** beginPlaybackSession/stopAll 里 cancel() 后立刻 speak()，Chrome 会无声并 onerror；云端走 Audio 不受影响 */
async function settleSpeechSynthesisAfterCancel(): Promise<void> {
	if (!isEnglishTtsSupported()) return;
	await pauseMs(50);
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

/** 听书逐句：上一句播放期间预取的云端 MP3（plain 为实际请求的 chunk 文本） */
export type EnglishTtsSentencePrefetch = {
	plain: string;
	ready: CloudTtsReady;
};

export type PlayEnglishPreferredOptions = {
	/** 为 true 时强制本机 Web Speech（如本机音色设置试听）；省略时会员走云端、非会员走本机 */
	preferLocal?: boolean;
	/** 本机朗读时透传给 Web Speech */
	speak?: SpeakEnglishOptions;
	/** 每个 TTS 节奏段开始/结束（句内子句不重复触发句末） */
	onCadenceChunk?: (event: TtsCadenceChunkEvent) => void;
	/** 听书/听当前逐句：由上一轮发起的下一句云端预取（缩短句间等待） */
	prefetchedCloud?: Promise<EnglishTtsSentencePrefetch> | null;
};

type CadencePlaybackHooks = Pick<
	PlayEnglishPreferredOptions,
	'onCadenceChunk' | 'prefetchedCloud'
>;

type CloudTtsPlaybackOptions = CadencePlaybackHooks & {
	rate?: number;
};

/** ponytail: 听书逐句时云端可能连续失败，冷却内只弹一次 Toast */
let lastCloudTtsErrorToastAt = 0;
const CLOUD_TTS_ERROR_TOAST_COOLDOWN_MS = 12_000;

type NoTtsError = Error & { cloudTtsNotified?: boolean };

function throwNoTts(opts?: { cloudTtsNotified?: boolean }): never {
	const err = new Error('NO_TTS') as NoTtsError;
	if (opts?.cloudTtsNotified) err.cloudTtsNotified = true;
	throw err;
}

/** 云端 TTS 失败时统一 Toast（试听/听书/单词朗读等共用） */
function notifyCloudTtsFallback(canFallbackLocal: boolean): void {
	const now = Date.now();
	if (now - lastCloudTtsErrorToastAt < CLOUD_TTS_ERROR_TOAST_COOLDOWN_MS)
		return;
	lastCloudTtsErrorToastAt = now;

	const source = loadMinimaxTtsUserPrefs().playbackSource;
	const titleKey =
		source === 'xfyun'
			? 'englishLearning.tts.cloudXfyunFailed'
			: source === 'edge'
				? 'englishLearning.tts.cloudEdgeFailed'
				: 'englishLearning.tts.cloudMinimaxFailed';

	if (canFallbackLocal) {
		Toast({
			type: 'warning',
			title: translateSync(titleKey),
			message: translateSync('englishLearning.tts.cloudFallbackLocal'),
		});
		return;
	}
	Toast({
		type: 'error',
		title: translateSync(titleKey),
		message: translateSync('englishLearning.tts.unsupported'),
	});
}

/** HTMLAudioElement.playbackRate 常用可听范围；听书 UI 最高 3x */
function clampPlaybackRate(rate?: number): number {
	const r = rate ?? 1;
	return Math.min(3, Math.max(0.5, r));
}

/** 句末终止符（含全角叹号/问号） */
const SENTENCE_TERMINATOR = /[.!?。！？；\uFF01\uFF1F]/u;

/** 句末标点后仍属同一句的闭合符号（不含开引号/开括号，避免吞掉下一句句首） */
const TRAILING_CLOSER_AFTER_SENTENCE_END =
	/[\u2019\u201d\u0022\u0027\u300d\u300f\ufe42\uff02\u00bb\u300b\u3011\uff09)\]]/u;

/** 句首仍属同一句的开引号/开括号/破折号/省略号（与句末 extend 对称） */
const LEADING_OPENER_BEFORE_SENTENCE_START =
	/[\u2018\u201c\u300c\u300e\ufe41\uff02\u00ab\u300a\u3010\uff08([]/u;

function isLeadingEllipsisAt(trimmed: string, index: number): boolean {
	const ch = trimmed[index];
	if (!ch) return false;
	if (ch === '\u2026') return true;
	if (ch === '.' && trimmed.startsWith('......', index)) return true;
	return (
		ch === '.' && trimmed.startsWith('...', index) && trimmed[index + 3] !== '.'
	);
}

function isAttachableBeforeSentenceStart(
	trimmed: string,
	index: number,
): boolean {
	const ch = trimmed[index];
	if (!ch) return false;
	if (LEADING_OPENER_BEFORE_SENTENCE_START.test(ch)) return true;
	if (isLeadingEllipsisAt(trimmed, index)) return true;
	if (ch === '-' && trimmed.startsWith('——', index)) return true;
	if (ch === '-' && trimmed.startsWith('--', index)) return true;
	return false;
}

function consumeLeadingAttachableBeforeSentenceStart(
	trimmed: string,
	index: number,
): number {
	const ch = trimmed[index]!;
	if (ch === '-' && trimmed.startsWith('——', index)) return index + 2;
	if (ch === '-' && trimmed.startsWith('--', index)) return index + 2;
	if (isLeadingEllipsisAt(trimmed, index)) {
		if (ch === '\u2026') {
			let j = index;
			while (j < trimmed.length && trimmed[j] === '\u2026') j += 1;
			return j;
		}
		if (ch === '.' && trimmed.startsWith('......', index)) return index + 6;
		return index + 3;
	}
	if (LEADING_OPENER_BEFORE_SENTENCE_START.test(ch)) return index + 1;
	return index + 1;
}

/** 句首标点前扩 span.start（开引号、……、—— 等归入本句，不单拆一句） */
function computeSentenceSpanStart(
	trimmed: string,
	segmentStart: number,
	contentStart: number,
): number {
	let pos = segmentStart;
	while (pos < contentStart) {
		while (pos < contentStart && /\s/u.test(trimmed[pos]!)) pos += 1;
		if (pos >= contentStart) break;
		if (!isAttachableBeforeSentenceStart(trimmed, pos)) break;
		pos = consumeLeadingAttachableBeforeSentenceStart(trimmed, pos);
	}
	return pos > segmentStart ? segmentStart : contentStart;
}

function isWithinSentenceLeadingAttachables(
	trimmed: string,
	index: number,
	segmentStart: number,
): boolean {
	let pos = segmentStart;
	while (pos <= index && pos < trimmed.length) {
		while (pos < trimmed.length && /\s/u.test(trimmed[pos]!)) pos += 1;
		if (pos > index) return false;
		if (!isAttachableBeforeSentenceStart(trimmed, pos)) return false;
		const next = consumeLeadingAttachableBeforeSentenceStart(trimmed, pos);
		if (index < next) return true;
		pos = next;
	}
	return false;
}

function isAttachableAfterSentenceEnd(trimmed: string, index: number): boolean {
	const ch = trimmed[index];
	if (!ch) return false;
	if (SENTENCE_TERMINATOR.test(ch)) return true;
	if (TRAILING_CLOSER_AFTER_SENTENCE_END.test(ch)) return true;
	// ponytail: 省略号只作句末断点，不在 extend 里吞掉下一句段首的 ……
	if (ch === '.' && trimmed.startsWith('......', index)) return true;
	if (
		ch === '.' &&
		trimmed.startsWith('...', index) &&
		trimmed[index + 3] !== '.'
	) {
		return true;
	}
	return false;
}

function consumeAttachableAfterSentenceEnd(
	trimmed: string,
	index: number,
): number {
	const ch = trimmed[index]!;
	if (SENTENCE_TERMINATOR.test(ch)) {
		let j = index;
		while (j < trimmed.length && SENTENCE_TERMINATOR.test(trimmed[j]!)) j += 1;
		return j;
	}
	if (ch === '.' && trimmed.startsWith('......', index)) return index + 6;
	if (
		ch === '.' &&
		trimmed.startsWith('...', index) &&
		trimmed[index + 3] !== '.'
	) {
		return index + 3;
	}
	if (TRAILING_CLOSER_AFTER_SENTENCE_END.test(ch)) return index + 1;
	return index;
}

/** 句末标点后继续吞掉省略号、重复叹号、闭合引号；允许中间空白（innerText 常压成空格） */
function extendSentenceBoundaryEnd(trimmed: string, end: number): number {
	let j = end;
	while (j < trimmed.length) {
		if (/\s/u.test(trimmed[j]!)) {
			let k = j;
			while (k < trimmed.length && /\s/u.test(trimmed[k]!)) k += 1;
			if (k >= trimmed.length || !isAttachableAfterSentenceEnd(trimmed, k))
				break;
			j = k;
			continue;
		}
		if (!isAttachableAfterSentenceEnd(trimmed, j)) break;
		j = consumeAttachableAfterSentenceEnd(trimmed, j);
	}
	return j;
}

/** 句末边界（trimmed plain 内下标，不含边界字符之后的内容） */
function sentenceBoundaryEnd(
	trimmed: string,
	i: number,
	segmentStart: number,
): number {
	const ch = trimmed[i];
	if (!ch) return -1;
	let end = -1;
	if (SENTENCE_TERMINATOR.test(ch)) end = i + 1;
	else if (ch === '\u2026') {
		if (isWithinSentenceLeadingAttachables(trimmed, i, segmentStart)) {
			return -1;
		}
		let j = i + 1;
		while (j < trimmed.length && trimmed[j] === '\u2026') j += 1;
		end = j;
	} else if (ch === '.' && trimmed.startsWith('......', i)) {
		if (isWithinSentenceLeadingAttachables(trimmed, i, segmentStart)) {
			return -1;
		}
		end = i + 6;
	} else if (
		ch === '.' &&
		trimmed.startsWith('...', i) &&
		trimmed[i + 3] !== '.'
	) {
		if (isWithinSentenceLeadingAttachables(trimmed, i, segmentStart)) {
			return -1;
		}
		end = i + 3;
	}
	if (end < 0) return -1;
	return extendSentenceBoundaryEnd(trimmed, end);
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
		const boundary = sentenceBoundaryEnd(trimmed, i, rawStart);
		if (boundary < 0) continue;

		const slice = trimmed.slice(rawStart, boundary);
		const content = slice.trim();
		if (content) {
			const lead = slice.length - slice.trimStart().length;
			const trail = slice.length - slice.trimEnd().length;
			const start = computeSentenceSpanStart(
				trimmed,
				rawStart,
				rawStart + lead,
			);
			spans.push({ start, end: boundary - trail });
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
			const start = computeSentenceSpanStart(
				trimmed,
				rawStart,
				rawStart + lead,
			);
			spans.push({ start, end: trimmed.length });
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
/** 点击同步解锁 Tauri/WKWebView 云端 Audio（须在 fetch 合成之前调用） */
let cloudAudioUnlock: HTMLAudioElement | null = null;
const SILENT_WAV_DATA_URI =
	'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

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
	const cacheKey = buildCloudTtsCacheKey(plain);
	const hit = cloudTtsAudioCache.get(cacheKey);
	if (!hit) return null;
	cloudTtsAudioCache.delete(cacheKey);
	cloudTtsAudioCache.set(cacheKey, hit);
	return new Blob([hit], { type: 'audio/mpeg' });
}

/** 云端 MP3 LRU key：按用户选路区分 MiniMax / 讯飞参数后缀 */
function buildCloudTtsCacheKey(plain: string): string {
	const prefs = loadMinimaxTtsUserPrefs();
	if (prefs.playbackSource === 'xfyun') {
		return `${plain}\u0000xfyun${buildXfyunTtsCacheKeySuffix()}`;
	}
	if (prefs.playbackSource === 'edge') {
		return `${plain}\u0000edge${buildEdgeTtsCacheKeySuffix()}`;
	}
	return plain + buildMinimaxTtsCacheKeySuffix();
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

function isMemberOnlyPlaybackSource(source: string): boolean {
	return source === 'cloud' || source === 'xfyun';
}

/** 会员可走 MiniMax / 讯飞 / Edge；非会员仅 Edge 云端 */
function canUseCloudPlaybackSource(source: string): boolean {
	if (source === 'local') return false;
	if (isCloudEnglishTtsAllowed()) return true;
	return source === 'edge';
}

/** 会员可走云端；非会员可选 Edge 云端或本机 Web Speech */
export function isEnglishPlaybackAvailable(): boolean {
	const prefs = loadMinimaxTtsUserPrefs();
	if (canUseCloudPlaybackSource(prefs.playbackSource)) return true;
	if (shouldUseCloudEnglishTts()) return true;
	return isEnglishTtsSupported();
}

/** 朗读选路：读 playbackSource；非会员仅 edge 走云端 */
function shouldUseCloudEnglishTts(
	options?: PlayEnglishPreferredOptions,
): boolean {
	if (options?.preferLocal === true) return false;
	const prefs = loadMinimaxTtsUserPrefs();
	const source = prefs.playbackSource;
	if (source === 'local') return false;
	if (options?.preferLocal === false) {
		return canUseCloudPlaybackSource(source);
	}
	if (isMemberOnlyPlaybackSource(source) && !isCloudEnglishTtsAllowed()) {
		return false;
	}
	return canUseCloudPlaybackSource(source);
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
	// 新听书/试听会话开始时会先 stop；重置冷却以便云端报错立即 Toast
	lastCloudTtsErrorToastAt = 0;
	stopPlaybackMediaOnly();
}

/** 听书等场景切换倍速：云端 MP3 即时生效；本机 Web Speech 仅影响下一句 */
export function applyActiveEnglishPlaybackRate(rate: number): void {
	const clamped = clampPlaybackRate(rate);
	if (cloudAudio) cloudAudio.playbackRate = clamped;
}

async function readResponseBodyAsArrayBuffer(
	res: Response,
): Promise<ArrayBuffer> {
	// Tauri HTTP 对 chunked stream 读 body 易挂起；Edge 线上一整段 MP3，直接 arrayBuffer 更稳
	if (isTauriRuntime()) {
		return res.arrayBuffer();
	}
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

/** 与 playCloudTtsCadenceSegments 首段请求对齐的 chunk 文本（便于句间预取命中） */
function firstCloudTtsChunkPlain(plain: string): string {
	const chunks = splitTextForTtsCadence(plain);
	return chunks[0]?.text ?? plain;
}

async function resolveCloudTtsReady(
	chunkPlain: string,
	prefetched?: Promise<EnglishTtsSentencePrefetch> | null,
): Promise<CloudTtsReady> {
	if (prefetched) {
		try {
			const hit = await prefetched;
			if (hit.plain === chunkPlain) return hit.ready;
		} catch {
			// 预取失败则回退现场请求
		}
	}
	return startCloudTts(chunkPlain);
}

/**
 * 听书/听当前：在播当前句时预取下一句云端 MP3；非云端路径返回 null。
 */
export function prefetchCloudEnglishTts(
	rawText: string,
	options?: Pick<PlayEnglishPreferredOptions, 'preferLocal'>,
): Promise<EnglishTtsSentencePrefetch> | null {
	if (!shouldUseCloudEnglishTts(options)) return null;
	const plain = stripMarkdownForTts(rawText);
	if (!plain) return null;
	const chunkPlain = firstCloudTtsChunkPlain(plain);
	return startCloudTts(chunkPlain).then((ready) => ({
		plain: chunkPlain,
		ready,
	}));
}

/** 发起云端 TTS 请求；命中 LRU 则直接返回 Blob */
async function startCloudTts(plain: string): Promise<CloudTtsReady> {
	await ensureMinimaxTtsUserPrefsLoaded();
	const cacheKey = buildCloudTtsCacheKey(plain);
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

	const prefs = loadMinimaxTtsUserPrefs();
	const source = prefs.playbackSource;
	const endpoint =
		source === 'xfyun'
			? SPEECH_XFYUN_TTS_STREAM
			: source === 'edge'
				? isTauriRuntime()
					? SPEECH_EDGE_TTS
					: SPEECH_EDGE_TTS_STREAM
				: SPEECH_MINIMAX_TTS_STREAM;
	const bodyExtras =
		source === 'xfyun'
			? buildXfyunTtsRequestExtras()
			: source === 'edge'
				? buildEdgeTtsRequestExtras()
				: buildMinimaxTtsRequestExtras();
	const res = await platformFetch(BASE_URL + endpoint, {
		method: 'POST',
		headers,
		body: JSON.stringify({ text: plain, ...bodyExtras }),
	});

	// ponytail: 云端失败不中转硅基/MiniMax；由 playEnglishPreferred catch 统一降级本机 Web Speech
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
			const playbackRate = audio.playbackRate > 0 ? audio.playbackRate : 1;
			const durationMs =
				Number.isFinite(audio.duration) && audio.duration > 0
					? ((audio.duration * 1000) / playbackRate) * 1.5 + 5000
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
	rate?: number,
): Promise<void> {
	if (ready.kind === 'cached') {
		await playCloudMp3Blob(ready.blob, generation, rate);
		return;
	}

	// ponytail: 不用 MSE 边下边播——MiniMax MP3 分片常不对齐 MPEG 帧，会无声且 onended 不触发
	const buf = await readResponseBodyAsArrayBuffer(ready.response);
	if (!isPlaybackGenerationActive(generation)) return;
	touchCloudTtsCache(ready.cacheKey, buf);
	await playCloudMp3Blob(
		new Blob([buf], { type: 'audio/mpeg' }),
		generation,
		rate,
	);
}

/**
 * 按句读节奏分段，播当前段时预取下一段；每段收齐 MP3 后 Blob 播放。
 */
async function playCloudTtsCadenceSegments(
	plain: string,
	generation: number,
	opts?: CloudTtsPlaybackOptions,
): Promise<void> {
	// 将文本按节奏规则切分为块（句、短语等），每块单独生成 TTS
	const chunks = splitTextForTtsCadence(plain);

	// 如果无可用块，直接返回
	if (chunks.length === 0) return;

	// 获取播放速率，兜底为 1
	const rate = clampPlaybackRate(opts?.rate);

	// 若文本仅有一个块，且不超过单次云 TTS 最大长度，直接整段播（省去分段机制）
	if (
		chunks.length === 1 &&
		chunks[0].text.length <= MAX_SINGLE_CLOUD_TTS_CHARS
	) {
		// 告知外部“本段开始”
		emitCadenceChunk(opts, plain, chunks, 0, 'start');
		// 请求云端 TTS 资源（可能复用 Prefetch）
		const ready = await resolveCloudTtsReady(
			chunks[0].text,
			opts?.prefetchedCloud,
		);
		// 检查播放世代是否仍有效，用户可能已终止
		if (!isPlaybackGenerationActive(generation)) return;
		// 播放 MP3（Blob）
		await playCloudTtsReady(ready, generation, rate);
		// 再次校验世代，避免用户在播放间 stop
		if (!isPlaybackGenerationActive(generation)) return;
		// 播放结束，通知外部“本段结束”
		emitCadenceChunk(opts, plain, chunks, 0, 'end');
		return;
	}

	// 多段场景：准备首段的 TTS Promise，后续循环中依次推进
	let pendingReady: Promise<CloudTtsReady> | null = resolveCloudTtsReady(
		chunks[0].text,
		opts?.prefetchedCloud,
	);

	// 逐段播放 TTS，支持逐句暂停与准备下一段
	for (let i = 0; i < chunks.length; i += 1) {
		// 中途停止世代播放则直接返回终止流程
		if (!isPlaybackGenerationActive(generation)) return;

		if (i > 0) {
			// 为每一段（首段除外）播放前等待上段定义的停顿时长，单位 ms，速率控制
			const prevPause = chunks[i - 1]?.pauseAfterMs ?? PAUSE_AFTER_CLAUSE_MS;
			await pauseMs(Math.max(0, Math.round(prevPause / rate)));
			// 校验暂停期间世代是否仍然有效
			if (!isPlaybackGenerationActive(generation)) return;
		}

		// 发出“本块开始”事件（供 UI/外部响应）
		emitCadenceChunk(opts, plain, chunks, i, 'start');

		// 等待本段的 TTS（云端 MP3）就绪
		const ready = await pendingReady!;
		// 校验世代合法性，避免用户终止后继续播
		if (!isPlaybackGenerationActive(generation)) return;

		// 并行尝试准备下一个 chunk 的 TTS（浏览器端潜在并行请求），如到最后一段则置 null
		pendingReady =
			i + 1 < chunks.length ? startCloudTts(chunks[i + 1].text) : null;

		// 播放当前段 MP3
		await playCloudTtsReady(ready, generation, rate);
		// 校验播放后世代有效性
		if (!isPlaybackGenerationActive(generation)) return;
		// 段播放完，发出“本块结束”事件
		emitCadenceChunk(opts, plain, chunks, i, 'end');
	}
}

function waitCloudAudioCanPlay(audio: HTMLAudioElement): Promise<void> {
	if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		const onReady = () => {
			cleanup();
			resolve();
		};
		const onError = () => {
			cleanup();
			reject(new Error('AUDIO_LOAD'));
		};
		const cleanup = () => {
			audio.removeEventListener('canplay', onReady);
			audio.removeEventListener('error', onError);
		};
		audio.addEventListener('canplay', onReady, { once: true });
		audio.addEventListener('error', onError, { once: true });
	});
}

async function startCloudAudioPlayback(audio: HTMLAudioElement): Promise<void> {
	await waitCloudAudioCanPlay(audio);
	try {
		await audio.play();
	} catch (err) {
		if (!isTauriRuntime()) throw err;
		audio.load();
		await waitCloudAudioCanPlay(audio);
		await audio.play();
	}
}

function playCloudMp3Blob(
	blob: Blob,
	generation: number,
	rate?: number,
): Promise<void> {
	stopPlaybackMediaOnly();
	if (!isPlaybackGenerationActive(generation)) {
		return Promise.resolve();
	}

	const url = URL.createObjectURL(blob);
	cloudObjectUrl = url;
	const audio = new Audio(url);
	audio.playbackRate = clampPlaybackRate(rate);
	cloudAudio = audio;
	return startCloudAudioPlayback(audio).then(
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

// 本地朗读带 playback generation 支持，句级分段、世代守护、语速处理及 50ms settle 修正
async function speakEnglishTextWithGeneration(
	text: string,
	generation: number,
	options?: SpeakEnglishOptions & CadencePlaybackHooks,
): Promise<void> {
	// 未检测到本机 TTS 支持时直接返回
	if (!isEnglishTtsSupported()) return;

	// 去除文本 markdown 标记，仅保留朗读内容
	const plain = stripMarkdownForTts(text);
	// 文本为空直接返回
	if (!plain) return;
	// 检查播放世代，避免过期 session 播放
	if (!isPlaybackGenerationActive(generation)) return;

	// 等待音色列表加载完毕（部分浏览器首次异步）
	await waitForVoicesReady();
	// settle 期间可能用户已 stop
	if (!isPlaybackGenerationActive(generation)) return;
	// Chrome/Safari fix：cancel 后需显式等待 50ms 后再 speak，避免首段无声
	await settleSpeechSynthesisAfterCancel();
	// again 检查世代，有可能 settle 时用户已停止
	if (!isPlaybackGenerationActive(generation)) return;
	// 刷新本地缓存音色（部分平台缓存命中需刷新无废品）
	resetCachedEnglishVoice();

	// 按语调规则拆分分段，得到拟朗读的 chunk 数组
	const chunks = splitTextForTtsCadence(plain);
	// 多段朗读语速稍慢，单段使用标准语速
	const chunkRate = chunks.length > 1 ? 0.86 : 0.9;
	// 分段顺次朗读
	for (let i = 0; i < chunks.length; i += 1) {
		// 朗读期间，世代快速变动需即刻 return
		if (!isPlaybackGenerationActive(generation)) return;
		const chunk = chunks[i];
		// 首段无需停顿，每段前按设定停顿
		if (i > 0) {
			// 取前一段的分句停顿时间（如无用默认）
			const prevPause = chunks[i - 1]?.pauseAfterMs ?? PAUSE_AFTER_CLAUSE_MS;
			await pauseMs(prevPause);
			// 停顿期间世代提前变化（用户已停止）须退出
			if (!isPlaybackGenerationActive(generation)) return;
		}
		// 分段播放前事件钩子，可外部监听
		emitCadenceChunk(options, plain, chunks, i, 'start');
		// 朗读当前 chunk，单段时用标准语速，多段时降为 chunkRate
		await speakOneUtterance(chunk.text, generation, {
			rate: options?.rate ?? chunkRate,
			pitch: options?.pitch,
			volume: options?.volume,
		});
		// 朗读 chunk 后再校验，部分平台朗读中可被中断
		if (!isPlaybackGenerationActive(generation)) return;
		// 结束事件钩子触发，可用于外界状态更新
		emitCadenceChunk(options, plain, chunks, i, 'end');
	}
}

// 朗读英文文本的入口函数，自动开启新的播放世代，保障操作唯一性
export async function speakEnglishText(
	text: string,
	options?: SpeakEnglishOptions,
): Promise<void> {
	// 启动一个全新的播放 session（每次朗读时都会更新播放世代，避免并发/过期混乱）
	const generation = beginPlaybackSession();
	// 调用内部实现函数，实际朗读文本，带入当前世代参数
	await speakEnglishTextWithGeneration(text, generation, options);
}

// 朗读英文文本优选本地或云端 TTS，自动处理分段语调与回退逻辑
export async function playEnglishPreferred(
	rawText: string,
	options?: PlayEnglishPreferredOptions,
): Promise<void> {
	// 去除 markdown 语法，获得纯文本
	const plain = stripMarkdownForTts(rawText);
	// 空文本直接返回，不进行朗读
	if (!plain) return;

	// 仍在用户点击栈内：解锁 speech + Audio（线上 Edge 合成数秒，Tauri 须在此 prime）
	primeEnglishPlaybackForUserGesture();

	// 启动新的播放世代/session，后续朗读周期内保持唯一性，防止异步混乱
	const generation = beginPlaybackSession();
	// 外部透传的朗读语调/速度/音量选项
	const speakOpts = options?.speak;
	// 根据用户状态、设置判断是否优先使用云端 TTS
	const useCloud = shouldUseCloudEnglishTts(options);
	// 注入给分段 cadence 朗读的回调钩子，如分段事件、提前缓存音频等
	const cadenceHooks: CadencePlaybackHooks = {
		onCadenceChunk: options?.onCadenceChunk,
		prefetchedCloud: options?.prefetchedCloud,
	};

	// 优先分支：本地 TTS
	if (!useCloud) {
		// 播放期间世代（播放 session）已失效直接返回（如已被 stop）
		if (!isPlaybackGenerationActive(generation)) return;
		// 浏览器本地 TTS 功能不可用时，抛出 NO_TTS 异常
		if (!isEnglishTtsSupported()) {
			throwNoTts();
		}
		// 实际调用本地 Web Speech 朗读，按设置参数与钩子
		await speakEnglishTextWithGeneration(rawText, generation, {
			...speakOpts,
			...cadenceHooks,
		});
		return;
	}

	// 云端优先路径，根据用户偏好及能力优先尝试云端；失败兜底本地
	try {
		// 调用云端 TTS 分段朗读，透传 cadence 钩子与用户参数
		await playCloudTtsCadenceSegments(plain, generation, {
			...cadenceHooks,
			rate: speakOpts?.rate,
		});
		return;
	} catch {
		const canFallbackLocal = isEnglishTtsSupported();
		notifyCloudTtsFallback(canFallbackLocal);
		if (!isPlaybackGenerationActive(generation)) return;
		if (!canFallbackLocal) {
			throwNoTts({ cloudTtsNotified: true });
		}
		// 回退本地朗读，参数同前
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
	// 原先只解锁 speechSynthesis；云端 MP3 走 Audio，Tauri 异步 fetch 后 play() 会挂起直至再次点击
	try {
		if (!cloudAudioUnlock) {
			cloudAudioUnlock = new Audio(SILENT_WAV_DATA_URI);
		}
		cloudAudioUnlock.volume = 0.001;
		cloudAudioUnlock.currentTime = 0;
		void cloudAudioUnlock.play().catch(() => {});
	} catch {
		// 部分 WebView 无 Audio
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

// /**
//  * - ponytail: 模块自检——长文须能切成多段，否则云端首播仍等整段合成，
//  * - 任意地方第一次 import '@/utils/englishTts' 时，模块求值到文件末尾就会跑这段 if。
//  * - 例如电子书划句朗读、英语学习页、云 TTS 设置页等，
//  * 只要 import 了这个模块，自检就会执行一次（模块通常只加载一次，不会重复跑）。
//  */
// if (splitTextForTtsCadence('测'.repeat(200)).length < 2) {
// 	throw new Error('[englishTts] 长文分段异常，云端流水线无法缩短首声');
// }

// {
// 	const cases = [
// 		'赞叹一声：\u201c阿弥陀佛！\u201d这个在政治上',
// 		'赞叹一声：\u201c阿弥陀佛！ \u201d这个在政治上',
// 		'太好了！！！\u201d接下来',
// 	];
// 	for (const plain of cases) {
// 		const spans = buildSentenceOffsetSpans(plain);
// 		const trimmed = plain.trim();
// 		const first = trimmed.slice(spans[0]?.start ?? 0, spans[0]?.end ?? 0);
// 		if (spans.length < 2 || !first.includes('！')) {
// 			throw new Error(`[englishTts] 叹号句界异常: ${plain}`);
// 		}
// 		if (!first.endsWith('\u201d')) {
// 			throw new Error(`[englishTts] 闭合引号未纳入前句: ${plain}`);
// 		}
// 		if (!trimmed.slice(spans[1]?.start ?? 0).match(/^这|接下/)) {
// 			throw new Error(`[englishTts] 叹号后句界错位: ${plain}`);
// 		}
// 	}
// 	const ellipsisMid = buildSentenceOffsetSpans('第一句。……第二句。');
// 	const emMid = '第一句。……第二句。'.trim();
// 	const e1 = ellipsisMid[1];
// 	if (
// 		ellipsisMid.length !== 2 ||
// 		emMid.slice(e1?.start ?? 0, e1?.end ?? 0) !== '……第二句'
// 	) {
// 		throw new Error('[englishTts] 句中省略号应并入下一句');
// 	}
// 	const dashStart = buildSentenceOffsetSpans('——他说完就走了。');
// 	const d0 = dashStart[0];
// 	if (
// 		dashStart.length !== 1 ||
// 		'——他说完就走了。'.trim().slice(d0?.start ?? 0, d0?.end ?? 0) !==
// 			'——他说完就走了'
// 	) {
// 		throw new Error('[englishTts] 句首破折号应并入本句');
// 	}
// 	const leading = buildSentenceOffsetSpans('……他走了。');
// 	const leadingText = '……他走了。'.trim();
// 	const l0 = leading[0];
// 	if (
// 		leading.length !== 1 ||
// 		l0?.start !== 0 ||
// 		leadingText.slice(l0.start, l0.end) !== '……他走了'
// 	) {
// 		throw new Error('[englishTts] 段首省略号不应单独成句');
// 	}
// 	const openerNext = buildSentenceOffsetSpans('完。\u201c下一句。\u201d');
// 	const t2 = '完。\u201c下一句。\u201d'.trim();
// 	const s1 = t2.slice(openerNext[1]?.start ?? 0, openerNext[1]?.end ?? 0);
// 	if (openerNext.length !== 2 || !s1.startsWith('\u201c')) {
// 		throw new Error('[englishTts] 句首开引号应归入下一句');
// 	}
// }
