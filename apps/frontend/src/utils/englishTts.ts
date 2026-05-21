/**
 * 英语学习朗读：默认优先云端 TTS，失败则本机 Web Speech；
 * `preferLocal: true` 时优先本机（适合单词），不支持则抛错。
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

/** 按标点切分，便于本机朗读时在句间插入短暂停顿 */
function splitTextForTtsPauses(text: string): string[] {
	const trimmed = text.trim();
	if (!trimmed) return [];
	if (!/[.!?;,]/.test(trimmed) && trimmed.length < 72) {
		return [trimmed];
	}
	const parts = trimmed
		.split(/(?<=[.!?])\s+|(?<=[;,])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
	return parts.length > 0 ? parts : [trimmed];
}

function pauseMs(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
	if (!isEnglishTtsSupported()) return null;
	const voices = window.speechSynthesis.getVoices();
	if (!voices.length) return null;
	const prefer = (lang: string) =>
		voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
	return (
		prefer('en-US') ??
		prefer('en-GB') ??
		voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
		null
	);
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

async function fetchCloudTtsBlob(text: string): Promise<Blob> {
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
		body: JSON.stringify({ text }),
	});
	if (!res.ok) {
		throw new Error(`TTS_HTTP_${res.status}`);
	}
	return res.blob();
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

		utter.rate = options?.rate ?? 0.92;
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

	const chunks = splitTextForTtsPauses(plain);
	const chunkRate = chunks.length > 1 ? 0.88 : 0.92;
	for (let i = 0; i < chunks.length; i += 1) {
		if (!isPlaybackGenerationActive(generation)) return;
		if (i > 0) {
			await pauseMs(320);
			if (!isPlaybackGenerationActive(generation)) return;
		}
		await speakOneUtterance(chunks[i], generation, {
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
	void window.speechSynthesis.getVoices();
	window.speechSynthesis.addEventListener('voiceschanged', () => {
		void window.speechSynthesis.getVoices();
	});
}
