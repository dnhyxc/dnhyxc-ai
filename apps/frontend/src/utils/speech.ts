/**
 * 通用朗读（本机 Web Speech + 云端 MiniMax / 讯飞 / Edge）。
 * 默认：有效会员按设置走云端，失败回退本机；非会员除 Edge 外不走会员云端。
 * `preferLocal: true` 强制本机（如设置页试听）。
 * 云端无 seed，对规范化文本做 MP3 缓存以保证重复播放读音一致。
 * 本机音色偏好 key：`local_tts_voice:{userId}`（不再沿用 english_learning_*）。
 */
import { Toast } from '@ui/sonner';
import { BASE_URL } from '@/constants';
import { translateSync } from '@/i18n';
import {
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

export function isSpeechSupported(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.speechSynthesis !== 'undefined' &&
		typeof window.SpeechSynthesisUtterance !== 'undefined'
	);
}

/**
 * 将输入的 Markdown 文本规整为适合 TTS 的纯文本。
 * 主要作用包括去除代码块、行内代码、粗体/斜体、标题、链接、列表符号、编号等 Markdown 语法，保证 TTS 朗读时只保留纯文本内容。
 */
export function stripMarkdownForTts(raw: string): string {
	// 原始内容为空（null、undefined、纯空白等）直接返回空字符串
	if (!raw?.trim()) return '';
	return (
		raw
			// 移除 Markdown 代码块（``` 包围的多行内容）替换为空格，避免代码被朗读
			.replace(/```[\s\S]*?```/g, ' ')
			// 移除 Markdown 行内代码（`内容`）替换为空格
			.replace(/`[^`\n]+`/g, ' ')
			// 还原粗体（**内容**），去掉星号，仅保留原文
			.replace(/\*\*([^*]+)\*\*/g, '$1')
			// 还原斜体（*内容*），去掉星号，仅保留原文
			.replace(/\*([^*]+)\*/g, '$1')
			// 移除 Markdown 标题前缀（#~######），仅保留文本
			.replace(/^#{1,6}\s+/gm, '')
			// 还原超链接，仅保留链接文本部分 [文本](链接) => 文本
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
			// 移除无序列表项符号（-, *, +），仅保留内容
			.replace(/^[-*+]\s+/gm, '')
			// 移除有序列表项编号（1.、2. ...），仅保留内容
			.replace(/^\d+\.\s+/gm, '')
			// 网文装饰分隔线（*** / --- / ——— 等），勿朗读
			.replace(/[*＊]{3,}/g, ' ')
			.replace(/[-—_=~～]{3,}/g, ' ')
			.replace(/[·•.]{3,}/g, ' ')
			// * * * 间隔星号分隔
			.replace(/(?:^|\s)(?:\*[ \t]*){2,}\*(?=\s|$)/gm, ' ')
			// 合并所有空白字符为一个空格（包含换行、Tab 等），避免朗读卡顿
			.replace(/\s+/g, ' ')
			// 去除首尾的多余空格
			.trim()
	);
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

/** 本机音色偏好 storage key 前缀 → `local_tts_voice:{userId}` */
export const LOCAL_TTS_VOICE_KEY = 'local_tts_voice';

/** 初始默认本机女声关键字（首次进入 / 恢复默认） */
export const DEFAULT_LOCAL_TTS_VOICE_KEY = 'karen';

/** 女声回退关键字列表（设备无 Karen 时按序尝试） */
export const PREFERRED_LOCAL_FEMALE_VOICES = [
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

export type PreferredLocalFemaleVoice =
	(typeof PREFERRED_LOCAL_FEMALE_VOICES)[number];

/** 常见男声关键字（macOS / Windows Web Speech 显示名） */
export const PREFERRED_LOCAL_MALE_VOICES = [
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

const LOCAL_ENGLISH_MALE_VOICE_HINTS = PREFERRED_LOCAL_MALE_VOICES;

export type LocalVoiceGender = 'female' | 'male' | 'unknown';

export type LocalVoiceOption = {
	name: string;
	lang: string;
	voiceURI: string;
	gender: LocalVoiceGender;
};

/** 根据系统音色名推断男声 / 女声 */
export function classifyVoiceGender(name: string): LocalVoiceGender {
	const nameLower = name.toLowerCase();
	if (LOCAL_ENGLISH_MALE_VOICE_HINTS.some((hint) => nameLower.includes(hint))) {
		return 'male';
	}
	if (PREFERRED_LOCAL_FEMALE_VOICES.some((hint) => nameLower.includes(hint))) {
		return 'female';
	}
	return 'unknown';
}

let cachedLocalVoice: SpeechSynthesisVoice | null | undefined;
let cachedVoicePrefUserId = 0;

function normalizeVoiceKey(input: string): string {
	return input.trim().toLowerCase();
}

function localVoiceStorageKey(userId?: number): string {
	return userScopedStorageKey(LOCAL_TTS_VOICE_KEY, userId);
}

function readPreferredVoiceKeyFromStorage(): string | null {
	if (typeof window === 'undefined') return null;
	const userId = getLoggedInUserId();
	if (userId !== cachedVoicePrefUserId) {
		cachedVoicePrefUserId = userId;
		resetCachedLocalVoice();
	}
	if (userId <= 0) return null;
	const scopedKey = localVoiceStorageKey(userId);
	let raw = localStorage.getItem(scopedKey);
	if (!raw) {
		const legacy = localStorage.getItem(LOCAL_TTS_VOICE_KEY);
		if (legacy) {
			localStorage.setItem(scopedKey, legacy);
			localStorage.removeItem(LOCAL_TTS_VOICE_KEY);
			raw = legacy;
		}
	}
	if (!raw?.trim()) return null;
	return normalizeVoiceKey(raw);
}

/** 无用户配置时写入并固定使用 Karen */
function ensureDefaultLocalVoicePreference(): void {
	if (typeof window === 'undefined') return;
	const userId = getLoggedInUserId();
	if (userId <= 0) return;
	if (!readPreferredVoiceKeyFromStorage()) {
		localStorage.setItem(
			localVoiceStorageKey(userId),
			DEFAULT_LOCAL_TTS_VOICE_KEY,
		);
	}
}

/** 实际用于选音的关键字（保证初始即为 karen） */
function resolveVoiceKeyForPlayback(): string {
	ensureDefaultLocalVoicePreference();
	return readPreferredVoiceKeyFromStorage() ?? DEFAULT_LOCAL_TTS_VOICE_KEY;
}

function isLikelyMaleVoice(nameLower: string): boolean {
	return LOCAL_ENGLISH_MALE_VOICE_HINTS.some((hint) =>
		nameLower.includes(hint),
	);
}

function scoreLocalVoice(
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

	if (isLikelyMaleVoice(name)) return -1;

	let score = 0;
	if (voice.localService) score += 40;
	if (lang.startsWith('en-us')) score += 12;
	else if (lang.startsWith('en-gb')) score += 8;

	for (let i = 0; i < PREFERRED_LOCAL_FEMALE_VOICES.length; i += 1) {
		if (name.includes(PREFERRED_LOCAL_FEMALE_VOICES[i])) {
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
	if (!isSpeechSupported()) return;
	await pauseMs(50);
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
	if (!isSpeechSupported()) return null;

	const voices = window.speechSynthesis.getVoices();
	if (!voices.length) {
		// 音色列表尚未就绪，勿缓存 null（否则后续朗读永远无 voice）
		return null;
	}

	if (cachedLocalVoice !== undefined) {
		return cachedLocalVoice;
	}

	const activeKey = resolveVoiceKeyForPlayback();
	let best: SpeechSynthesisVoice | null = null;
	let bestScore = -1;
	for (const v of voices) {
		const score = scoreLocalVoice(v, activeKey);
		if (score > bestScore) {
			bestScore = score;
			best = v;
		}
	}

	if (!best) {
		best = findVoiceByKey(voices, activeKey);
	}

	if (!best) {
		for (const fallback of PREFERRED_LOCAL_FEMALE_VOICES) {
			best = findVoiceByKey(voices, fallback);
			if (best) break;
		}
	}

	cachedLocalVoice = best;
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
	if (!isSpeechSupported()) return null;
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

function resetCachedLocalVoice(): void {
	cachedLocalVoice = undefined;
}

export type SpeakOptions = {
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

/** 云端整段播放：按 audio 进度映射到当前句内 0~1（与句高亮同一套估算） */
export type TtsPlaybackProgress = {
	sentenceIndex: number;
	progress: number;
	currentTime: number;
	duration: number;
};

/** 听书逐句：上一句播放期间预取的云端 MP3（plain 为实际请求的 chunk 文本） */
export type TtsSentencePrefetch = {
	plain: string;
	ready: CloudTtsReady;
};

export type PlayPreferredOptions = {
	/** 为 true 时强制本机 Web Speech（如本机音色设置试听）；省略时会员走云端、非会员走本机 */
	preferLocal?: boolean;
	/** 本机朗读时透传给 Web Speech */
	speak?: SpeakOptions;
	/** 每个 TTS 节奏段开始/结束（句内子句不重复触发句末） */
	onCadenceChunk?: (event: TtsCadenceChunkEvent) => void;
	/**
	 * 云端单段 Audio 播放进度（currentTime/duration → 句内 progress）。
	 * 本机 Web Speech 无可靠字级进度时不回调。
	 */
	onPlaybackProgress?: (event: TtsPlaybackProgress) => void;
	/** 听书/听当前：由上一轮发起的云端预取（缩短等待） */
	prefetchedCloud?: Promise<TtsSentencePrefetch> | null;
	/**
	 * 云端整段一次合成（听书/听当前按段 TTS）。
	 * 为 true 时不按句读拆 HTTP；超厂商字节上限仍回退 cadence。
	 * 句高亮靠播放进度估算触发 onCadenceChunk。
	 */
	cloudSingleUtterance?: boolean;
	/**
	 * 当前段真正开始出声后回调（云端 audio.play / 本机 speak 成功）。
	 * 听书用来错开预取，避免与首包 HTTP 抢带宽。
	 */
	onPlaybackStart?: () => void;
	/**
	 * 当前正要播放的音频仍在等待（合成/下载/canplay）时为 true，出声后为 false。
	 * 语义：仅「尚未出声且在等当前段就绪」；下一段预取、本机分句停顿不应点亮。
	 * 多包云端时，上一包结束后、下一包 HTTP/canplay 完成前会再次 true。
	 */
	onAwaitingPlayback?: (waiting: boolean) => void;
};

type CadencePlaybackHooks = Pick<
	PlayPreferredOptions,
	| 'onCadenceChunk'
	| 'onPlaybackProgress'
	| 'prefetchedCloud'
	| 'onPlaybackStart'
	| 'onAwaitingPlayback'
>;

type CloudTtsPlaybackOptions = CadencePlaybackHooks & {
	rate?: number;
	singleUtterance?: boolean;
};

/** 与 Edge / 讯飞单次上限对齐（字节） */
const CLOUD_SINGLE_UTTERANCE_MAX_BYTES = 8000;

/** ponytail: 听书逐句时云端可能连续失败，冷却内只弹一次 Toast */
let lastCloudTtsErrorToastAt = 0;
const CLOUD_TTS_ERROR_TOAST_COOLDOWN_MS = 12_000;

type NoTtsError = Error & { cloudTtsNotified?: boolean };

function throwNoTts(opts?: { cloudTtsNotified?: boolean }): never {
	const err = new Error('NO_TTS') as NoTtsError;
	if (opts?.cloudTtsNotified) err.cloudTtsNotified = true;
	throw err;
}

function cloudSourceTitleKey(
	source: string,
):
	| 'englishLearning.tts.cloudXfyunFailed'
	| 'englishLearning.tts.cloudEdgeFailed'
	| 'englishLearning.tts.cloudMinimaxFailed' {
	if (source === 'xfyun') return 'englishLearning.tts.cloudXfyunFailed';
	if (source === 'edge') return 'englishLearning.tts.cloudEdgeFailed';
	return 'englishLearning.tts.cloudMinimaxFailed';
}

/** 云端 TTS 失败时统一 Toast（试听/听书/单词朗读等共用） */
function notifyCloudTtsFallback(
	canFallbackLocal: boolean,
	failedSource?: string,
): void {
	const now = Date.now();
	if (now - lastCloudTtsErrorToastAt < CLOUD_TTS_ERROR_TOAST_COOLDOWN_MS)
		return;
	lastCloudTtsErrorToastAt = now;

	const source = failedSource ?? effectiveCloudPlaybackSource();
	const titleKey = cloudSourceTitleKey(source);

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

function notifyCloudFallbackToEdge(failedSource: string): void {
	const now = Date.now();
	if (now - lastCloudTtsErrorToastAt < CLOUD_TTS_ERROR_TOAST_COOLDOWN_MS)
		return;
	lastCloudTtsErrorToastAt = now;
	Toast({
		type: 'warning',
		title: translateSync(cloudSourceTitleKey(failedSource)),
		message: translateSync('englishLearning.tts.cloudFallbackEdge'),
	});
}

/** 当前实际走的云端源（含会话降级） */
function effectiveCloudPlaybackSource(): string {
	if (sessionCloudSourceOverride) return sessionCloudSourceOverride;
	return loadMinimaxTtsUserPrefs().playbackSource;
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
/**
 * 当前期望倍速。loading 期间尚无（或未挂好）audio 时，applyActivePlaybackRate 只写入这里；
 * 出声前 startCloudAudioPlayback 再读，避免起播快照了旧 rate。
 */
let desiredPlaybackRate = 1;
/** stopPlaybackMediaOnly 时打断 waitCloudAudioEnd，避免 onended 被清掉后一直挂到超时 */
let abortCloudAudioWait: (() => void) | null = null;
/** 句高亮 rAF 轮询；stop 时取消，避免卸 src 后仍回调 */
let abortCloudCadenceRaf: (() => void) | null = null;
/** 点击同步解锁 Tauri/WKWebView 云端 Audio（须在 fetch 合成之前调用） */
let cloudAudioUnlock: HTMLAudioElement | null = null;
const SILENT_WAV_DATA_URI =
	'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/** 每次新播放或 stopAll 时递增，用于丢弃过期的异步 TTS 请求/本机朗读 */
let playbackGeneration = 0;

/** 应用内 pause/stop 触发的 audio.pause，忽略以免回环进 Media Session / UI bridge */
let suppressAudioPauseEvent = false;
let detachCloudAudioPauseBridge: (() => void) | null = null;

/** 软暂停：不打断 wait/世代，便于从 currentTime 续播 */
let playbackSoftPaused = false;
let softResumeWaiters: Array<() => void> = [];

type PlaybackMediaHandlers = {
	play: () => void;
	pause: () => void;
};
let englishPlaybackMediaHandlers: PlaybackMediaHandlers | null = null;

function withSuppressedAudioPauseEvent(run: () => void): void {
	suppressAudioPauseEvent = true;
	try {
		run();
	} finally {
		queueMicrotask(() => {
			suppressAudioPauseEvent = false;
		});
	}
}

function clearSoftPauseState(): void {
	playbackSoftPaused = false;
	const waiters = softResumeWaiters;
	softResumeWaiters = [];
	for (const w of waiters) w();
}

function waitWhileSoftPaused(_generation: number): Promise<void> {
	if (!playbackSoftPaused) return Promise.resolve();
	return new Promise((resolve) => {
		softResumeWaiters.push(resolve);
	});
}

/** 退出听书后清掉 macOS 菜单栏 / 控制中心 Now Playing（含进度条） */
function clearPlaybackMediaSession(opts?: {
	/** 默认 true：卸掉 play/pause 等；句间停介质时传 false，避免媒体键短暂失效 */
	clearHandlers?: boolean;
}): void {
	if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
	const ms = navigator.mediaSession;
	try {
		ms.metadata = null;
	} catch {
		// ignore
	}
	try {
		ms.playbackState = 'none';
	} catch {
		// ignore
	}
	try {
		(
			ms as MediaSession & {
				setPositionState: (state?: MediaPositionState | null) => void;
			}
		).setPositionState(null);
	} catch {
		try {
			ms.setPositionState();
		} catch {
			// ignore
		}
	}
	if (opts?.clearHandlers === false) return;
	for (const action of [
		'play',
		'pause',
		'stop',
		'seekto',
		'seekbackward',
		'seekforward',
		'previoustrack',
		'nexttrack',
	] as const) {
		try {
			ms.setActionHandler(action, null);
		} catch {
			// 部分 action 不支持
		}
	}
}

/**
 * 丢掉云端 <audio> 引用：仅 pause/清 src 时，Chromium/macOS 仍可能按旧元素外推进度条（无声）。
 * 句间换轨不要调用；仅听书会话结束时调用。
 */
function releaseCloudAudioEl(): void {
	detachCloudAudioPauseBridge?.();
	detachCloudAudioPauseBridge = null;
	const audio = cloudAudio;
	cloudAudio = null;
	if (cloudObjectUrl) {
		URL.revokeObjectURL(cloudObjectUrl);
		cloudObjectUrl = null;
	}
	if (!audio) return;
	try {
		audio.muted = true;
		audio.volume = 0;
		audio.pause();
		audio.onended = null;
		audio.onerror = null;
		audio.onloadedmetadata = null;
		audio.ontimeupdate = null;
		audio.removeAttribute('src');
		audio.removeAttribute('title');
		audio.srcObject = null;
		audio.load();
	} catch {
		// ignore
	}
}

function silenceCloudAudioUnlock(): void {
	if (!cloudAudioUnlock) return;
	try {
		cloudAudioUnlock.pause();
		cloudAudioUnlock.currentTime = 0;
	} catch {
		// ignore
	}
}

function setPlaybackMediaState(state: MediaSessionPlaybackState): void {
	if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
	if (state === 'none') {
		// 句间换轨也会走这里：只清展示，保留已注册的媒体键
		clearPlaybackMediaSession({
			clearHandlers: !englishPlaybackMediaHandlers,
		});
		return;
	}
	// 听书已退出后，异步 play() 仍可能迟到；禁止再把系统 UI 拉回 playing
	if (!englishPlaybackMediaHandlers) return;
	try {
		navigator.mediaSession.playbackState = state;
	} catch {
		// 部分 WebView 只读
	}
}

/** 听书/听当前/选区朗读：把系统媒体键接到 pause/resume；传 null 卸载 */
export function registerPlaybackMediaHandlers(
	handlers: PlaybackMediaHandlers | null,
): void {
	if (!handlers) {
		englishPlaybackMediaHandlers = null;
		// 先作废异步 play，再拆掉元素，避免无声进度条继续走
		playbackGeneration += 1;
		abortCloudAudioWait?.();
		abortCloudAudioWait = null;
		clearSoftPauseState();
		if (isSpeechSupported()) {
			try {
				window.speechSynthesis.cancel();
			} catch {
				// ignore
			}
		}
		releaseCloudAudioEl();
		silenceCloudAudioUnlock();
		clearPlaybackMediaSession({ clearHandlers: true });
		// macOS Chrome：偶发需下一帧再清一次才收起控制中心
		requestAnimationFrame(() => {
			if (englishPlaybackMediaHandlers) return;
			clearPlaybackMediaSession({ clearHandlers: true });
		});
		return;
	}
	englishPlaybackMediaHandlers = handlers;
	if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
	try {
		navigator.mediaSession.setActionHandler('play', () => handlers.play());
		navigator.mediaSession.setActionHandler('pause', () => handlers.pause());
		navigator.mediaSession.setActionHandler('stop', () => handlers.pause());
	} catch {
		// 旧环境不支持 setActionHandler
	}
}

/**
 * 会话内云端降级：MiniMax/讯飞连续 502 时粘到 Edge，避免每句都先打挂掉的源。
 * 仅 stopAll 时清除（不要在 beginPlaybackSession 清，否则句句重试 MiniMax）。
 */
type CloudPlaybackSource = 'cloud' | 'xfyun' | 'edge';
let sessionCloudSourceOverride: CloudPlaybackSource | null = null;

const CLOUD_TTS_CACHE_MAX = 64;
/** 规范化文本 → MP3 ArrayBuffer（LRU：重复 get 时移到末尾） */
const cloudTtsAudioCache = new Map<string, ArrayBuffer>();
/** 同一 cacheKey 进行中的请求合并，避免听书首包+预取打出重复 stream */
const inflightCloudTts = new Map<string, Promise<CloudTtsReady>>();

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
	const source = effectiveCloudPlaybackSource();
	if (source === 'xfyun') {
		return `${plain}\u0000xfyun${buildXfyunTtsCacheKeySuffix()}`;
	}
	if (source === 'edge') {
		return `${plain}\u0000edge${buildEdgeTtsCacheKeySuffix()}`;
	}
	return plain + buildMinimaxTtsCacheKeySuffix();
}

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token')?.trim() || '';
}

/** 当前登录用户是否为有效会员（读 localStorage userInfo，与资料页 / LLM 判定一致） */
function isCloudTtsAllowed(): boolean {
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
	if (isCloudTtsAllowed()) return true;
	return source === 'edge';
}

/** 会员可走云端；非会员可选 Edge 云端或本机 Web Speech */
export function isPlaybackAvailable(): boolean {
	const prefs = loadMinimaxTtsUserPrefs();
	if (canUseCloudPlaybackSource(prefs.playbackSource)) return true;
	if (shouldUseCloudTts()) return true;
	return isSpeechSupported();
}

/** 朗读选路：读 playbackSource；非会员仅 edge 走云端 */
function shouldUseCloudTts(options?: PlayPreferredOptions): boolean {
	if (options?.preferLocal === true) return false;
	const prefs = loadMinimaxTtsUserPrefs();
	const source = prefs.playbackSource;
	if (source === 'local') return false;
	if (options?.preferLocal === false) {
		return canUseCloudPlaybackSource(source);
	}
	if (isMemberOnlyPlaybackSource(source) && !isCloudTtsAllowed()) {
		return false;
	}
	return canUseCloudPlaybackSource(source);
}

function isPlaybackGenerationActive(generation: number): boolean {
	return generation === playbackGeneration;
}

/** 仅停止当前音频与本机 speech，不递增世代（供会话内切换介质使用） */
function stopPlaybackMediaOnly(): void {
	clearSoftPauseState();
	if (isSpeechSupported()) {
		window.speechSynthesis.cancel();
	}
	abortCloudAudioWait?.();
	abortCloudAudioWait = null;
	abortCloudCadenceRaf?.();
	abortCloudCadenceRaf = null;
	detachCloudAudioPauseBridge?.();
	detachCloudAudioPauseBridge = null;
	if (cloudAudio) {
		// bridge 已卸，不再 suppress：让浏览器原生感知 pause，便于系统收起 Now Playing
		try {
			cloudAudio.pause();
			cloudAudio.onended = null;
			cloudAudio.onerror = null;
			cloudAudio.onloadedmetadata = null;
			cloudAudio.ontimeupdate = null;
			cloudAudio.removeAttribute('src');
			cloudAudio.removeAttribute('title');
			cloudAudio.srcObject = null;
			cloudAudio.load();
		} catch {
			// ignore
		}
		// ponytail: 句间保留元素。会话结束由 register(null) → releaseCloudAudioEl 丢掉引用
	}
	if (cloudObjectUrl) {
		URL.revokeObjectURL(cloudObjectUrl);
		cloudObjectUrl = null;
	}
	setPlaybackMediaState('none');
}

function ensureCloudAudioEl(): HTMLAudioElement {
	if (!cloudAudio) cloudAudio = new Audio();
	return cloudAudio;
}

/** 开始新的播放会话：作废上一轮并清空介质 */
function beginPlaybackSession(): number {
	playbackGeneration += 1;
	stopPlaybackMediaOnly();
	return playbackGeneration;
}

export function stopSpeech(): void {
	if (!isSpeechSupported()) return;
	window.speechSynthesis.cancel();
}

export function stopCloudTts(): void {
	stopPlaybackMediaOnly();
}

export function stopAllPlayback(): void {
	playbackGeneration += 1;
	// 新听书/试听会话开始时会先 stop；重置冷却以便云端报错立即 Toast
	lastCloudTtsErrorToastAt = 0;
	sessionCloudSourceOverride = null;
	stopPlaybackMediaOnly();
	// 仅 pause/清 src 时 Chromium/macOS 仍可能按旧 <audio> 外推 Touch Bar / 控制中心进度条
	releaseCloudAudioEl();
	silenceCloudAudioUnlock();
	clearPlaybackMediaSession({ clearHandlers: !englishPlaybackMediaHandlers });
	requestAnimationFrame(() => {
		clearPlaybackMediaSession({
			clearHandlers: !englishPlaybackMediaHandlers,
		});
	});
}

/**
 * 听书底栏软暂停：只 pause 介质，不递增世代、不 abort wait。
 * 续播走 resumePlaybackSoft，从 currentTime 继续。
 */
export function pausePlaybackSoft(): void {
	playbackSoftPaused = true;
	if (isSpeechSupported()) {
		try {
			window.speechSynthesis.pause();
		} catch {
			// ignore
		}
	}
	if (cloudAudio && !cloudAudio.paused) {
		withSuppressedAudioPauseEvent(() => {
			cloudAudio?.pause();
		});
	}
	setPlaybackMediaState('paused');
}

/** @returns 是否已从暂停的 Audio / speechSynthesis 续上（含合成已就绪待播） */
export function resumePlaybackSoft(): boolean {
	const audio = cloudAudio;
	const hasSrc = Boolean(audio?.currentSrc || audio?.getAttribute('src'));
	const canResumeAudio = !!(audio && hasSrc && !audio.ended);

	playbackSoftPaused = false;
	const waiters = softResumeWaiters;
	softResumeWaiters = [];
	for (const w of waiters) w();

	let resumed = false;
	if (canResumeAudio && audio) {
		if (audio.paused) {
			void audio
				.play()
				.then(() => {
					if (playbackSoftPaused) return;
					setPlaybackMediaState('playing');
				})
				.catch(() => {});
		}
		resumed = true;
	}
	if (isSpeechSupported()) {
		try {
			if (window.speechSynthesis.paused) {
				window.speechSynthesis.resume();
				resumed = true;
			}
		} catch {
			// ignore
		}
	}
	if (resumed) setPlaybackMediaState('playing');
	return resumed;
}

function bindCloudAudioPauseBridge(
	audio: HTMLAudioElement,
	generation: number,
): void {
	detachCloudAudioPauseBridge?.();
	const onPause = () => {
		if (suppressAudioPauseEvent) return;
		if (!isPlaybackGenerationActive(generation)) return;
		if (audio.ended) return;
		if (englishPlaybackMediaHandlers) {
			// 系统控制中心 / 耳机键 pause：同步听书 UI（hook 内软暂停）
			englishPlaybackMediaHandlers.pause();
			return;
		}
		pausePlaybackSoft();
	};
	audio.addEventListener('pause', onPause);
	detachCloudAudioPauseBridge = () => {
		audio.removeEventListener('pause', onPause);
	};
}

/** 听书等场景切换倍速：写入期望值；云端 MP3 已挂载则即时生效；本机 Web Speech 仅影响下一句 */
export function applyActivePlaybackRate(rate: number): void {
	const clamped = clampPlaybackRate(rate);
	desiredPlaybackRate = clamped;
	if (cloudAudio) cloudAudio.playbackRate = clamped;
}

function seedDesiredPlaybackRate(rate?: number): void {
	desiredPlaybackRate = clampPlaybackRate(rate);
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

function cloudPlainWithinSingleLimit(plain: string): boolean {
	return (
		new TextEncoder().encode(plain).length <= CLOUD_SINGLE_UTTERANCE_MAX_BYTES
	);
}

async function resolveCloudTtsReady(
	chunkPlain: string,
	prefetched?: Promise<TtsSentencePrefetch> | null,
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
 * 听书/听当前：预取云端 MP3。
 * `whole: true` 时预取整段文本（与 cloudSingleUtterance 对齐）；否则预取首个 cadence chunk。
 */
export function prefetchCloudTts(
	rawText: string,
	options?: Pick<PlayPreferredOptions, 'preferLocal'> & {
		whole?: boolean;
	},
): Promise<TtsSentencePrefetch> | null {
	if (!shouldUseCloudTts(options)) return null;
	const plain = stripMarkdownForTts(rawText);
	if (!plain) return null;
	const chunkPlain =
		options?.whole && cloudPlainWithinSingleLimit(plain)
			? plain
			: firstCloudTtsChunkPlain(plain);
	return startCloudTts(chunkPlain).then((ready) => ({
		plain: chunkPlain,
		ready,
	}));
}

/** 发起云端 TTS 请求；命中 LRU / 进行中请求则复用，避免同文案并发多条 stream */
async function startCloudTts(plain: string): Promise<CloudTtsReady> {
	await ensureMinimaxTtsUserPrefsLoaded();
	const cacheKey = buildCloudTtsCacheKey(plain);
	const cached = getCloudTtsFromCache(plain);
	if (cached) {
		return { kind: 'cached', blob: cached, cacheKey };
	}

	const inflight = inflightCloudTts.get(cacheKey);
	if (inflight) return inflight;

	const pending = (async (): Promise<CloudTtsReady> => {
		try {
			const token = readToken();
			if (!token) {
				throw new Error('NO_TOKEN');
			}
			const platformFetch = await getPlatformFetch();
			const headers = {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			};

			const source = effectiveCloudPlaybackSource();
			const endpoint =
				source === 'xfyun'
					? SPEECH_XFYUN_TTS_STREAM
					: source === 'edge'
						? SPEECH_EDGE_TTS_STREAM
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

			if (!res.ok) {
				throw new Error(`TTS_HTTP_${res.status}`);
			}

			// 收齐后再共享：Response body 只能读一次，合并请求必须进缓存
			const buf = await readResponseBodyAsArrayBuffer(res);
			if (!buf.byteLength) {
				throw new Error('TTS_EMPTY_AUDIO');
			}
			touchCloudTtsCache(cacheKey, buf);
			return {
				kind: 'cached',
				blob: new Blob([buf], { type: 'audio/mpeg' }),
				cacheKey,
			};
		} finally {
			inflightCloudTts.delete(cacheKey);
		}
	})();

	inflightCloudTts.set(cacheKey, pending);
	return pending;
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
			}
		};

		const finish = (err?: Error) => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timeoutId);
			if (abortCloudAudioWait === abort) abortCloudAudioWait = null;
			releaseUrl();
			if (err && isPlaybackGenerationActive(generation)) {
				reject(err);
				return;
			}
			resolve();
		};

		const abort = () => finish();
		abortCloudAudioWait = abort;

		const armTimeout = () => {
			window.clearTimeout(timeoutId);
			const playbackRate = audio.playbackRate > 0 ? audio.playbackRate : 1;
			const remaining =
				Number.isFinite(audio.duration) &&
				audio.duration > 0 &&
				Number.isFinite(audio.currentTime)
					? Math.max(0, audio.duration - audio.currentTime)
					: NaN;
			const durationMs = Number.isFinite(remaining)
				? ((remaining * 1000) / playbackRate) * 1.5 + 5000
				: 90_000;
			timeoutId = window.setTimeout(
				() => {
					// 软暂停不计超时，按剩余时长重新武装
					if (playbackSoftPaused || (audio.paused && !audio.ended)) {
						armTimeout();
						return;
					}
					withSuppressedAudioPauseEvent(() => {
						audio.pause();
					});
					finish(new Error('AUDIO_TIMEOUT'));
				},
				Math.min(durationMs, 600_000),
			);
		};

		timeoutId = window.setTimeout(() => {
			if (playbackSoftPaused || (audio.paused && !audio.ended)) {
				armTimeout();
				return;
			}
			withSuppressedAudioPauseEvent(() => {
				audio.pause();
			});
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
	onTimeUpdate?: (currentTime: number, duration: number) => void,
	onPlaybackStart?: () => void,
): Promise<void> {
	if (ready.kind === 'cached') {
		await playCloudMp3Blob(
			ready.blob,
			generation,
			rate,
			onTimeUpdate,
			onPlaybackStart,
		);
		return;
	}

	// ponytail: 不用 MSE 边下边播——MiniMax MP3 分片常不对齐 MPEG 帧，会无声且 onended 不触发
	const buf = await readResponseBodyAsArrayBuffer(ready.response);
	if (!isPlaybackGenerationActive(generation)) return;
	if (!buf.byteLength) {
		throw new Error('TTS_EMPTY_AUDIO');
	}
	touchCloudTtsCache(ready.cacheKey, buf);
	await playCloudMp3Blob(
		new Blob([buf], { type: 'audio/mpeg' }),
		generation,
		rate,
		onTimeUpdate,
		onPlaybackStart,
	);
}

/**
 * 按句读节奏分段，播当前段时预取下一段；每段收齐 MP3 后 Blob 播放。
 * `singleUtterance`：整段一次 HTTP，用播放进度驱动句级 onCadenceChunk。
 */
async function playCloudTtsCadenceSegments(
	plain: string,
	generation: number,
	opts?: CloudTtsPlaybackOptions,
): Promise<void> {
	// 在 TTS HTTP 等待前写入期望倍速；等待期间 UI 调速走 applyActivePlaybackRate
	seedDesiredPlaybackRate(opts?.rate);

	let playbackStartNotified = false;
	const notifyPlaybackStart = () => {
		if (playbackStartNotified) return;
		playbackStartNotified = true;
		opts?.onPlaybackStart?.();
	};

	if (opts?.singleUtterance) {
		if (cloudPlainWithinSingleLimit(plain)) {
			await playCloudTtsSingleUtterance(plain, generation, {
				...opts,
				onPlaybackStart: notifyPlaybackStart,
			});
			return;
		}
		// 超长：按句打包成多段「整段合成」，禁止回退到逐句/子句 HTTP
		await playCloudTtsPackedSingleUtterances(plain, generation, {
			...opts,
			onPlaybackStart: notifyPlaybackStart,
		});
		return;
	}

	// 将文本按节奏规则切分为块（句、短语等），每块单独生成 TTS
	const chunks = splitTextForTtsCadence(plain);

	// 如果无可用块，直接返回
	if (chunks.length === 0) return;

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
		// 播放 MP3（Blob）；倍速出声前读 desiredPlaybackRate
		await playCloudTtsReady(
			ready,
			generation,
			undefined,
			undefined,
			notifyPlaybackStart,
		);
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
			await pauseMs(Math.max(0, Math.round(prevPause / desiredPlaybackRate)));
			// 校验暂停期间世代是否仍然有效
			if (!isPlaybackGenerationActive(generation)) return;
			// 下一段 TTS 可能仍在飞：恢复等待态
			opts?.onAwaitingPlayback?.(true);
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
		await playCloudTtsReady(ready, generation, undefined, undefined, () => {
			opts?.onAwaitingPlayback?.(false);
			if (i === 0) notifyPlaybackStart();
		});
		// 校验播放后世代有效性
		if (!isPlaybackGenerationActive(generation)) return;
		// 段播放完，发出“本块结束”事件
		emitCadenceChunk(opts, plain, chunks, i, 'end');
	}
}

/** 整段一次合成；按 currentTime × 朗读耗时权重估算当前句并回调 onCadenceChunk。
 * ponytail: TTS 非匀速 + timeupdate 稀疏，纯比例切句常落后听感；媒体时间略提前。
 * 中英混排时拉丁字母远密于 CJK 音节，按字数比例会令高亮超前——改用权重。 */
const CLOUD_CADENCE_LEAD_SEC = 0.35;

/** 单字相对朗读耗时：CJK≈1 音节；拉丁≈3 字母/音节。 */
function ttsCharSpeechWeight(ch: string): number {
	if (
		/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/.test(
			ch,
		)
	) {
		return 1;
	}
	if (/[A-Za-z]/.test(ch)) return 1 / 3;
	if (/\d/.test(ch)) return 0.5;
	if (/\s/.test(ch)) return 0.15;
	return 0.4;
}

function buildTtsWeightPrefix(plain: string): Float64Array {
	const prefix = new Float64Array(plain.length + 1);
	for (let i = 0; i < plain.length; i += 1) {
		prefix[i + 1] = prefix[i]! + ttsCharSpeechWeight(plain[i]!);
	}
	return prefix;
}

/** ratio∈[0,1] → 字符下标（供 sentenceIndexAtOffset） */
function charOffsetAtSpeechRatio(prefix: Float64Array, ratio: number): number {
	const n = prefix.length - 1;
	if (n <= 0) return 0;
	const total = prefix[n]!;
	const r = Math.min(1, Math.max(0, ratio));
	if (!(total > 0)) return Math.min(n - 1, Math.floor(r * n));
	const aim = r * total;
	let lo = 0;
	let hi = n;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (prefix[mid]! <= aim) lo = mid;
		else hi = mid - 1;
	}
	return Math.min(n - 1, lo);
}

// ponytail: 自检——中英混排 40% 进度不得已越过中文句（纯字数映射会）
// {
// 	const sample = '你好世界。Hello world.';
// 	const en = sample.indexOf('H');
// 	if (charOffsetAtSpeechRatio(buildTtsWeightPrefix(sample), 0.4) >= en) {
// 		throw new Error('[speech] bilingual cadence weight');
// 	}
// }

async function playCloudTtsSingleUtterance(
	plain: string,
	generation: number,
	opts?: CloudTtsPlaybackOptions,
): Promise<void> {
	const sentences = buildSentenceOffsetSpans(plain);
	const weightPrefix = buildTtsWeightPrefix(plain);
	const onCadence = opts?.onCadenceChunk;

	const emitSentence = (
		si: number,
		phase: TtsCadenceChunkEvent['phase'],
	): void => {
		if (!onCadence) return;
		const span = sentences[si];
		if (!span) return;
		onCadence({
			phase,
			index: si,
			text: plain.slice(span.start, span.end),
			sentenceIndex: si,
			isLastInSentence: true,
			plainStart: span.start,
			plainEnd: span.end,
			sentencePlainStart: span.start,
			sentencePlainEnd: span.end,
		});
	};

	let lastSi = -1;
	if (sentences.length > 0) {
		lastSi = 0;
		emitSentence(0, 'start');
	}

	const ready = await resolveCloudTtsReady(plain, opts?.prefetchedCloud);
	if (!isPlaybackGenerationActive(generation)) return;

	await playCloudTtsReady(
		ready,
		generation,
		undefined,
		(currentTime, duration) => {
			if (sentences.length === 0) return;
			if (!(duration > 0) || !Number.isFinite(duration)) return;
			const leadTime = Math.min(duration, currentTime + CLOUD_CADENCE_LEAD_SEC);
			const ratio = Math.min(1, Math.max(0, leadTime / duration));
			const offset = charOffsetAtSpeechRatio(weightPrefix, ratio);
			const si = sentenceIndexAtOffset(sentences, offset);
			if (onCadence && si !== lastSi) {
				if (lastSi >= 0) emitSentence(lastSi, 'end');
				emitSentence(si, 'start');
				lastSi = si;
			}
			const span = sentences[si];
			if (!span || !opts?.onPlaybackProgress) return;
			const spanW = Math.max(
				1e-6,
				weightPrefix[span.end]! - weightPrefix[span.start]!,
			);
			const atW = Math.max(
				0,
				ratio * weightPrefix[plain.length]! - weightPrefix[span.start]!,
			);
			opts.onPlaybackProgress({
				sentenceIndex: si,
				progress: Math.min(1, Math.max(0, atW / spanW)),
				currentTime,
				duration,
			});
		},
		opts?.onPlaybackStart,
	);

	if (!isPlaybackGenerationActive(generation)) return;
	if (lastSi >= 0) emitSentence(lastSi, 'end');
}

/** singleUtterance 超长时：按句切成 ≤上限 的包，每包仍一次 HTTP（句索引相对整段 plain） */
async function playCloudTtsPackedSingleUtterances(
	plain: string,
	generation: number,
	opts?: CloudTtsPlaybackOptions,
): Promise<void> {
	const sentences = buildSentenceOffsetSpans(plain);
	if (sentences.length === 0) return;

	const packs: Array<{ start: number; end: number; text: string }> = [];
	let startSi = 0;
	while (startSi < sentences.length) {
		let endSi = startSi;
		while (endSi < sentences.length) {
			const next = endSi + 1;
			const text = plain.slice(
				sentences[startSi]!.start,
				sentences[next - 1]!.end,
			);
			if (!cloudPlainWithinSingleLimit(text) && next > startSi + 1) break;
			if (!cloudPlainWithinSingleLimit(text) && next === startSi + 1) {
				// 单句仍超限：硬切该句（极端）
				endSi = next;
				break;
			}
			endSi = next;
			if (text.length >= 420 * 2) break;
		}
		if (endSi <= startSi) endSi = startSi + 1;
		const text = plain
			.slice(sentences[startSi]!.start, sentences[endSi - 1]!.end)
			.trim();
		if (text) {
			packs.push({
				start: sentences[startSi]!.start,
				end: sentences[endSi - 1]!.end,
				text,
			});
		}
		startSi = endSi;
	}

	const parentOnCadence = opts?.onCadenceChunk;
	for (let i = 0; i < packs.length; i += 1) {
		if (!isPlaybackGenerationActive(generation)) return;
		// 第二包起再次进入等待：首包出声后 loading 已清，后续 HTTP 需重新点亮
		if (i > 0) opts?.onAwaitingPlayback?.(true);
		const pack = packs[i]!;
		const baseSi = sentenceIndexAtOffset(sentences, pack.start);
		await playCloudTtsSingleUtterance(pack.text, generation, {
			...opts,
			// 仅首包可吃预取
			prefetchedCloud: i === 0 ? opts?.prefetchedCloud : null,
			onPlaybackStart: () => {
				opts?.onAwaitingPlayback?.(false);
				if (i === 0) opts?.onPlaybackStart?.();
			},
			onCadenceChunk: parentOnCadence
				? (event) => {
						parentOnCadence({
							...event,
							sentenceIndex: baseSi + event.sentenceIndex,
						});
					}
				: undefined,
			onPlaybackProgress: opts?.onPlaybackProgress
				? (event) => {
						opts.onPlaybackProgress!({
							...event,
							sentenceIndex: baseSi + event.sentenceIndex,
						});
					}
				: undefined,
		});
	}
}

function waitCloudAudioCanPlay(audio: HTMLAudioElement): Promise<void> {
	// 复用 Audio 换 src 后旧 readyState 可能短暂残留，须确认 currentSrc 已指向新资源
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (ok: boolean) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (ok) resolve();
			else reject(new Error('AUDIO_LOAD'));
		};
		const onReady = () => finish(true);
		const onError = () => finish(false);
		const cleanup = () => {
			audio.removeEventListener('canplay', onReady);
			audio.removeEventListener('error', onError);
		};
		audio.addEventListener('canplay', onReady, { once: true });
		audio.addEventListener('error', onError, { once: true });
		if (
			audio.currentSrc &&
			audio.networkState !== HTMLMediaElement.NETWORK_EMPTY &&
			audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
		) {
			finish(true);
		}
	});
}

async function startCloudAudioPlayback(
	audio: HTMLAudioElement,
	generation: number,
	_rate?: number,
	onPlaybackStart?: () => void,
): Promise<void> {
	await waitCloudAudioCanPlay(audio);
	if (!isPlaybackGenerationActive(generation)) return;
	// 必须在 src 就绪后设 playbackRate：改 src / load 会把倍速打回 1
	// 读 desiredPlaybackRate：loading 期间调速已写入，勿用起播快照
	audio.playbackRate = desiredPlaybackRate;

	const playOnce = async () => {
		// 软暂停中（含合成返回时 UI 已暂停）：等续播再 play，保留已挂好的 src
		await waitWhileSoftPaused(generation);
		if (!isPlaybackGenerationActive(generation)) return false;
		if (playbackSoftPaused) return false;
		await audio.play();
		if (!isPlaybackGenerationActive(generation) || playbackSoftPaused) {
			withSuppressedAudioPauseEvent(() => {
				audio.pause();
			});
			return false;
		}
		setPlaybackMediaState('playing');
		onPlaybackStart?.();
		return true;
	};

	try {
		await playOnce();
	} catch (err) {
		if (!isPlaybackGenerationActive(generation) || playbackSoftPaused) return;
		if (!isTauriRuntime()) throw err;
		audio.load();
		await waitCloudAudioCanPlay(audio);
		if (!isPlaybackGenerationActive(generation)) return;
		audio.playbackRate = desiredPlaybackRate;
		await playOnce();
	}
}

function playCloudMp3Blob(
	blob: Blob,
	generation: number,
	rate?: number,
	onTimeUpdate?: (currentTime: number, duration: number) => void,
	onPlaybackStart?: () => void,
): Promise<void> {
	stopPlaybackMediaOnly();
	if (!isPlaybackGenerationActive(generation)) {
		return Promise.resolve();
	}

	const url = URL.createObjectURL(blob);
	cloudObjectUrl = url;
	const audio = ensureCloudAudioEl();
	audio.muted = false;
	audio.volume = 1;
	audio.src = url;
	abortCloudCadenceRaf?.();
	abortCloudCadenceRaf = null;
	if (onTimeUpdate) {
		let rafId = 0;
		const stopRaf = () => {
			if (rafId) cancelAnimationFrame(rafId);
			rafId = 0;
		};
		const emit = () => {
			if (!isPlaybackGenerationActive(generation)) return;
			onTimeUpdate(audio.currentTime, audio.duration);
		};
		const pump = () => {
			rafId = 0;
			emit();
			if (
				isPlaybackGenerationActive(generation) &&
				!audio.paused &&
				!audio.ended
			) {
				rafId = requestAnimationFrame(pump);
			}
		};
		const onPlaying = () => {
			stopRaf();
			rafId = requestAnimationFrame(pump);
		};
		const onPauseOrEnd = () => {
			stopRaf();
			emit();
		};
		abortCloudCadenceRaf = () => {
			stopRaf();
			audio.removeEventListener('playing', onPlaying);
			audio.removeEventListener('pause', onPauseOrEnd);
			audio.removeEventListener('ended', onPauseOrEnd);
			abortCloudCadenceRaf = null;
		};
		audio.addEventListener('playing', onPlaying);
		audio.addEventListener('pause', onPauseOrEnd);
		audio.addEventListener('ended', onPauseOrEnd);
		// 兜底：部分环境 playing 事件稀疏
		audio.ontimeupdate = () => {
			if (!isPlaybackGenerationActive(generation)) return;
			emit();
		};
	}

	bindCloudAudioPauseBridge(audio, generation);

	// 先挂 onended，再 play：短音频可能在 then 链里注册监听前就结束，导致一直等到超时、UI 假播放
	const ended = waitCloudAudioEnd(audio, url, generation);
	let startNotified = false;
	const notifyStart = () => {
		if (startNotified) return;
		startNotified = true;
		onPlaybackStart?.();
	};
	return startCloudAudioPlayback(audio, generation, rate, notifyStart).then(
		() => ended,
		(err) => {
			abortCloudAudioWait?.();
			abortCloudAudioWait = null;
			if (cloudObjectUrl === url) {
				URL.revokeObjectURL(url);
				cloudObjectUrl = null;
			}
			if (!isPlaybackGenerationActive(generation)) {
				return Promise.resolve();
			}
			throw err;
		},
	);
}

function speakOneUtterance(
	plain: string,
	generation: number,
	options?: SpeakOptions,
): Promise<void> {
	return new Promise((resolve) => {
		if (
			!isPlaybackGenerationActive(generation) ||
			!isSpeechSupported() ||
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
	if (!isSpeechSupported()) return Promise.resolve();
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
async function speakTextWithGeneration(
	text: string,
	generation: number,
	options?: SpeakOptions & CadencePlaybackHooks,
): Promise<void> {
	// 未检测到本机 TTS 支持时直接返回
	if (!isSpeechSupported()) return;

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
	resetCachedLocalVoice();

	// 按语调规则拆分分段，得到拟朗读的 chunk 数组
	const chunks = splitTextForTtsCadence(plain);
	// 多段朗读语速稍慢，单段使用标准语速
	const chunkRate = chunks.length > 1 ? 0.86 : 0.9;
	let playbackStartNotified = false;
	/** 出声前清掉 waiting；onPlaybackStart 只通知一次 */
	const clearAwaitingAndNotifyStart = () => {
		options?.onAwaitingPlayback?.(false);
		if (playbackStartNotified) return;
		playbackStartNotified = true;
		options?.onPlaybackStart?.();
	};
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
			// ponytail: 本机分段只有 pause，无 HTTP；勿 onAwaiting(true)，否则 loading 卡到整段播完
		}
		// 分段播放前事件钩子，可外部监听
		emitCadenceChunk(options, plain, chunks, i, 'start');
		clearAwaitingAndNotifyStart();
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
export async function speakText(
	text: string,
	options?: SpeakOptions,
): Promise<void> {
	// 先 begin 再 prime，避免 cancel 掉解锁静音片导致本机无声
	const generation = beginPlaybackSession();
	primePlaybackForUserGesture();
	await speakTextWithGeneration(text, generation, options);
}

/** 云端失败后改本机：清掉 Audio，并给 speechSynthesis 一点 settle 时间 */
async function prepareLocalSpeechAfterCloud(generation: number): Promise<void> {
	if (!isPlaybackGenerationActive(generation)) return;
	stopPlaybackMediaOnly();
	if (!isSpeechSupported()) return;
	await settleSpeechSynthesisAfterCancel();
	try {
		window.speechSynthesis.resume();
	} catch {
		// ignore
	}
}

// 朗读英文文本优选本地或云端 TTS，自动处理分段语调与回退逻辑
export async function playPreferred(
	rawText: string,
	options?: PlayPreferredOptions,
): Promise<void> {
	// 去除 markdown 语法，获得纯文本
	const plain = stripMarkdownForTts(rawText);
	// 空文本直接返回，不进行朗读
	if (!plain) return;

	const speakOpts = options?.speak;
	const useCloud = shouldUseCloudTts(options);

	// 用户明确选本机时清掉会话内 Edge 粘滞，避免设置已改仍走云端残态
	if (options?.preferLocal === true || !useCloud) {
		sessionCloudSourceOverride = null;
	}

	/**
	 * 必须先 begin（cancel 旧 utterance）再 prime。
	 * 若先 prime 再 begin，cancel 会干掉解锁用的静音片，本机 Web Speech 后续常无声。
	 * 云端走 Audio，受影响较小，但本机试听/降级依赖此顺序。
	 */
	const generation = beginPlaybackSession();
	primePlaybackForUserGesture();

	const cadenceHooks: CadencePlaybackHooks = {
		onCadenceChunk: options?.onCadenceChunk,
		onPlaybackProgress: options?.onPlaybackProgress,
		prefetchedCloud: options?.prefetchedCloud,
		onPlaybackStart: options?.onPlaybackStart,
		onAwaitingPlayback: options?.onAwaitingPlayback,
	};

	// 优先分支：本地 TTS
	if (!useCloud) {
		if (!isPlaybackGenerationActive(generation)) return;
		if (!isSpeechSupported()) {
			throwNoTts();
		}
		await speakTextWithGeneration(rawText, generation, {
			...speakOpts,
			...cadenceHooks,
		});
		return;
	}

	// 云端优先：失败时 MiniMax/讯飞 → Edge → 本机 Web Speech
	const cloudPlayOpts = {
		onCadenceChunk: options?.onCadenceChunk,
		onPlaybackProgress: options?.onPlaybackProgress,
		prefetchedCloud: options?.prefetchedCloud,
		onPlaybackStart: options?.onPlaybackStart,
		onAwaitingPlayback: options?.onAwaitingPlayback,
		rate: speakOpts?.rate,
		singleUtterance: options?.cloudSingleUtterance === true,
	};

	try {
		await playCloudTtsCadenceSegments(plain, generation, cloudPlayOpts);
		return;
	} catch {
		if (!isPlaybackGenerationActive(generation)) return;

		const preferred = loadMinimaxTtsUserPrefs().playbackSource;
		const failedSource = effectiveCloudPlaybackSource();
		// MiniMax / 讯飞挂了：同会话改走 Edge（勿复用已失败源的 prefetch）
		if (
			(preferred === 'cloud' || preferred === 'xfyun') &&
			sessionCloudSourceOverride !== 'edge'
		) {
			try {
				sessionCloudSourceOverride = 'edge';
				notifyCloudFallbackToEdge(failedSource);
				await playCloudTtsCadenceSegments(plain, generation, {
					...cloudPlayOpts,
					prefetchedCloud: null,
				});
				return;
			} catch {
				if (!isPlaybackGenerationActive(generation)) return;
				lastCloudTtsErrorToastAt = 0;
			}
		}

		const canFallbackLocal = isSpeechSupported();
		notifyCloudTtsFallback(canFallbackLocal, failedSource);
		if (!canFallbackLocal) {
			throwNoTts({ cloudTtsNotified: true });
		}
		await prepareLocalSpeechAfterCloud(generation);
		if (!isPlaybackGenerationActive(generation)) return;
		// 须带上 awaiting/start 钩子，否则听书/划词条会一直停在 loading
		await speakTextWithGeneration(rawText, generation, {
			...speakOpts,
			...cadenceHooks,
		});
	}
}

export function warmupSpeechVoices(): void {
	if (!isSpeechSupported()) return;
	ensureDefaultLocalVoicePreference();
	resetCachedLocalVoice();
	void window.speechSynthesis.getVoices();
	window.speechSynthesis.addEventListener('voiceschanged', () => {
		resetCachedLocalVoice();
		void window.speechSynthesis.getVoices();
	});
}

/** 须在用户点击同步调用，降低后续 async TTS / Audio 被 autoplay 策略拦截的概率 */
export function primePlaybackForUserGesture(): void {
	if (typeof window === 'undefined') return;
	warmupSpeechVoices();
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
export function getSelectedLocalVoiceName(): string | null {
	return pickEnglishVoice()?.name ?? null;
}

/** 用户偏好关键字（localStorage）；首次访问会初始化为 {@link DEFAULT_LOCAL_TTS_VOICE_KEY} */
export function getPreferredLocalVoiceKey(): string | null {
	ensureDefaultLocalVoicePreference();
	return readPreferredVoiceKeyFromStorage();
}

/**
 * 设置本机英语女声偏好（如 `karen`、`moira`、`victoria`）。
 * 传入 null 或空字符串则恢复为默认 {@link DEFAULT_LOCAL_TTS_VOICE_KEY}（Karen）。
 */
export function setPreferredLocalVoiceKey(key: string | null): void {
	if (typeof window === 'undefined') return;
	const userId = getLoggedInUserId();
	if (userId <= 0) return;
	resetCachedLocalVoice();
	const storageKey = localVoiceStorageKey(userId);
	if (!key?.trim()) {
		localStorage.setItem(storageKey, DEFAULT_LOCAL_TTS_VOICE_KEY);
		return;
	}
	localStorage.setItem(storageKey, normalizeVoiceKey(key));
}

const GENDER_SORT_ORDER: Record<LocalVoiceGender, number> = {
	female: 0,
	male: 1,
	unknown: 2,
};

/** 列出当前设备可用的英语音色（含男声 / 女声分类） */
export function listLocalVoices(): LocalVoiceOption[] {
	if (!isSpeechSupported()) return [];
	return window.speechSynthesis
		.getVoices()
		.filter((v) => v.lang.toLowerCase().startsWith('en'))
		.map((v) => ({
			name: v.name,
			lang: v.lang,
			voiceURI: v.voiceURI,
			gender: classifyVoiceGender(v.name),
		}))
		.filter((v) => v.gender !== 'unknown')
		.sort((a, b) => {
			const g = GENDER_SORT_ORDER[a.gender] - GENDER_SORT_ORDER[b.gender];
			if (g !== 0) return g;
			return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
		});
}

/** @deprecated 请用 listLocalVoices */
export function listLocalFemaleVoices(): Array<{
	name: string;
	lang: string;
	voiceURI: string;
}> {
	return listLocalVoices()
		.filter((v) => v.gender === 'female')
		.map(({ name, lang, voiceURI }) => ({ name, lang, voiceURI }));
}

/** 从系统音色显示名推断 localStorage 偏好关键字 */
export function inferVoicePreferenceKeyFromName(name: string): string {
	const nameLower = name.toLowerCase();
	for (const key of PREFERRED_LOCAL_FEMALE_VOICES) {
		if (nameLower.includes(key)) return key;
	}
	for (const key of PREFERRED_LOCAL_MALE_VOICES) {
		if (nameLower.includes(key)) return key;
	}
	return nameLower.split(/[\s(]/)[0]?.trim() || nameLower;
}

/** 当前生效的本机英语音色 URI（设置页下拉选中值） */
export function getActiveLocalVoiceUri(): string | null {
	return pickEnglishVoice()?.voiceURI ?? null;
}

/** 设置页：按 Web Speech 的 voiceURI 选择音色 */
export function setPreferredLocalVoiceByUri(voiceURI: string): void {
	if (!voiceURI.trim()) {
		setPreferredLocalVoiceKey(null);
		return;
	}
	if (!isSpeechSupported()) return;
	const voice = window.speechSynthesis
		.getVoices()
		.find((v) => v.voiceURI === voiceURI);
	if (!voice) return;
	setPreferredLocalVoiceKey(inferVoicePreferenceKeyFromName(voice.name));
}

/** 设置页「自动」选项的 Select value */
export const LOCAL_TTS_VOICE_AUTO = '__auto__';

// /**
//  * - ponytail: 模块自检——长文须能切成多段，否则云端首播仍等整段合成，
//  * - 任意地方第一次 import '@/utils/speech' 时，模块求值到文件末尾就会跑这段 if。
//  * - 例如电子书划句朗读、英语学习页、云 TTS 设置页等，
//  * 只要 import 了这个模块，自检就会执行一次（模块通常只加载一次，不会重复跑）。
//  */
// if (splitTextForTtsCadence('测'.repeat(200)).length < 2) {
// 	throw new Error('[speech] 长文分段异常，云端流水线无法缩短首声');
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
// 			throw new Error(`[speech] 叹号句界异常: ${plain}`);
// 		}
// 		if (!first.endsWith('\u201d')) {
// 			throw new Error(`[speech] 闭合引号未纳入前句: ${plain}`);
// 		}
// 		if (!trimmed.slice(spans[1]?.start ?? 0).match(/^这|接下/)) {
// 			throw new Error(`[speech] 叹号后句界错位: ${plain}`);
// 		}
// 	}
// 	const ellipsisMid = buildSentenceOffsetSpans('第一句。……第二句。');
// 	const emMid = '第一句。……第二句。'.trim();
// 	const e1 = ellipsisMid[1];
// 	if (
// 		ellipsisMid.length !== 2 ||
// 		emMid.slice(e1?.start ?? 0, e1?.end ?? 0) !== '……第二句'
// 	) {
// 		throw new Error('[speech] 句中省略号应并入下一句');
// 	}
// 	const dashStart = buildSentenceOffsetSpans('——他说完就走了。');
// 	const d0 = dashStart[0];
// 	if (
// 		dashStart.length !== 1 ||
// 		'——他说完就走了。'.trim().slice(d0?.start ?? 0, d0?.end ?? 0) !==
// 			'——他说完就走了'
// 	) {
// 		throw new Error('[speech] 句首破折号应并入本句');
// 	}
// 	const leading = buildSentenceOffsetSpans('……他走了。');
// 	const leadingText = '……他走了。'.trim();
// 	const l0 = leading[0];
// 	if (
// 		leading.length !== 1 ||
// 		l0?.start !== 0 ||
// 		leadingText.slice(l0.start, l0.end) !== '……他走了'
// 	) {
// 		throw new Error('[speech] 段首省略号不应单独成句');
// 	}
// 	const openerNext = buildSentenceOffsetSpans('完。\u201c下一句。\u201d');
// 	const t2 = '完。\u201c下一句。\u201d'.trim();
// 	const s1 = t2.slice(openerNext[1]?.start ?? 0, openerNext[1]?.end ?? 0);
// 	if (openerNext.length !== 2 || !s1.startsWith('\u201c')) {
// 		throw new Error('[speech] 句首开引号应归入下一句');
// 	}
// }
