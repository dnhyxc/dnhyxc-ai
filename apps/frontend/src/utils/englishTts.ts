/**
 * 英语学习朗读：
 * 优先级：后端 Minimax TTS（POST /speech-transcription/speech，返回 mp3 二进制）
 *   -> 浏览器原生 Web Speech API（speechSynthesis），
 *   -> 无任何可用方式时静默返回。
 */
import { BASE_URL } from '@/constant';
import { SPEECH_TTS, SPEECH_TTS_STATUS } from '@/service/api';
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
	/** 后端 Minimax 语音合成的音色/模型参数（可选） */
	voiceId?: string;
	model?: string;
	speed?: number;
	vol?: number;
};

let cloudAudio: HTMLAudioElement | null = null;
let cloudObjectUrl: string | null = null;

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token')?.trim() || '';
}

export function stopEnglishTts(): void {
	if (!isEnglishTtsSupported()) return;
	window.speechSynthesis.cancel();
}

export function stopCloudEnglishTts(): void {
	if (cloudAudio) {
		try {
			cloudAudio.pause();
			cloudAudio.src = '';
			cloudAudio.load();
		} catch {
			/* ignore */
		}
		cloudAudio = null;
	}
	if (cloudObjectUrl) {
		URL.revokeObjectURL(cloudObjectUrl);
		cloudObjectUrl = null;
	}
}

export function stopAllEnglishPlayback(): void {
	stopEnglishTts();
	stopCloudEnglishTts();
}

async function fetchCloudTtsBlob(text: string, options?: SpeakEnglishOptions): Promise<Blob> {
	const token = readToken();
	if (!token) {
		throw new Error('NO_TOKEN');
	}
	const platformFetch = await getPlatformFetch();
	const body: Record<string, unknown> = { text };
	if (options?.voiceId) body.voiceId = options.voiceId;
	if (options?.model) body.model = options.model;
	if (typeof options?.speed === 'number') body.speed = options.speed;
	if (typeof options?.vol === 'number') body.vol = options.vol;
	if (typeof options?.pitch === 'number') body.pitch = options.pitch;

	const res = await platformFetch(BASE_URL + SPEECH_TTS, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error(`TTS_HTTP_${res.status}`);
	}
	return res.blob();
}

function playCloudMp3Blob(blob: Blob): Promise<void> {
	stopAllEnglishPlayback();
	const url = URL.createObjectURL(blob);
	cloudObjectUrl = url;
	const audio = new Audio(url);
	cloudAudio = audio;
	return new Promise((resolve, reject) => {
		audio.onended = () => {
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
			reject(new Error('AUDIO_PLAY'));
		};
		void audio.play().catch(reject);
	});
}

function speakEnglishTextInternal(text: string, options?: SpeakEnglishOptions): Promise<void> {
	return new Promise((resolve) => {
		if (!isEnglishTtsSupported()) {
			resolve();
			return;
		}
		const plain = stripMarkdownForTts(text);
		if (!plain) {
			resolve();
			return;
		}

		stopAllEnglishPlayback();

		const runSpeak = () => {
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
		};

		let started = false;
		const safeRun = () => {
			if (started) return;
			started = true;
			runSpeak();
		};

		if (window.speechSynthesis.getVoices().length === 0) {
			const onVoices = () => {
				window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
				safeRun();
			};
			window.speechSynthesis.addEventListener('voiceschanged', onVoices);
			setTimeout(() => {
				window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
				safeRun();
			}, 400);
		} else {
			safeRun();
		}
	});
}

/** 调用浏览器原生 Web Speech API 朗读（不涉及后端） */
export function speakEnglishText(text: string, options?: SpeakEnglishOptions): Promise<void> {
	return speakEnglishTextInternal(text, options);
}

/** 直接调用后端 Minimax TTS，失败时抛出（由调用方决定如何处理） */
export async function speakCloudTts(text: string, options?: SpeakEnglishOptions): Promise<void> {
	const plain = stripMarkdownForTts(text);
	if (!plain) return;
	const blob = await fetchCloudTtsBlob(plain, options);
	await playCloudMp3Blob(blob);
}

/** 主入口：优先云端（Minimax）TTS，失败后降级到浏览器原生，都不可用则静默 */
export async function playEnglishPreferred(rawText: string, options?: SpeakEnglishOptions): Promise<void> {
	const plain = stripMarkdownForTts(rawText);
	if (!plain) return;

	let triedCloud = false;
	try {
		const blob = await fetchCloudTtsBlob(plain, options);
		triedCloud = true;
		await playCloudMp3Blob(blob);
		return;
	} catch {
		// 云端不可用 -> 降级到浏览器原生
	}
	try {
		if (triedCloud) {
			await speakEnglishTextInternal(rawText, options);
		} else {
			// 完全没可用后端，尝试浏览器
			await speakEnglishTextInternal(rawText, options);
		}
	} catch {
		// 浏览器也不可用，静默
	}
}

/** 查询后端是否配置了 Minimax TTS（前端可据此优化 UI） */
export async function isCloudTtsAvailable(): Promise<boolean> {
	try {
		const token = readToken();
		if (!token) return false;
		const platformFetch = await getPlatformFetch();
		const res = await platformFetch(BASE_URL + SPEECH_TTS_STATUS, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
		});
		if (!res.ok) return false;
		const json = (await res.json().catch(() => null)) as { available?: boolean } | null;
		return Boolean(json?.available);
	} catch {
		return false;
	}
}

export function warmupEnglishTtsVoices(): void {
	if (!isEnglishTtsSupported()) return;
	void window.speechSynthesis.getVoices();
	window.speechSynthesis.addEventListener('voiceschanged', () => {
		void window.speechSynthesis.getVoices();
	});
}
