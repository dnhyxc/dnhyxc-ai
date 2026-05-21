/**
 * 英语学习朗读：优先硅基云端 TTS（POST /speech-transcription/speech），失败则 Web Speech（分句停顿）。
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
	stopEnglishTts();
	stopCloudEnglishTts();
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

function speakOneUtterance(
	plain: string,
	options?: SpeakEnglishOptions,
): Promise<void> {
	return new Promise((resolve) => {
		if (!isEnglishTtsSupported() || !plain) {
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

export async function speakEnglishText(
	text: string,
	options?: SpeakEnglishOptions,
): Promise<void> {
	if (!isEnglishTtsSupported()) return;

	const plain = stripMarkdownForTts(text);
	if (!plain) return;

	stopAllEnglishPlayback();
	await waitForVoicesReady();

	const chunks = splitTextForTtsPauses(plain);
	const chunkRate = chunks.length > 1 ? 0.88 : 0.92;
	for (let i = 0; i < chunks.length; i += 1) {
		if (i > 0) {
			await pauseMs(320);
		}
		await speakOneUtterance(chunks[i], {
			...options,
			rate: options?.rate ?? chunkRate,
		});
	}
}

export async function playEnglishPreferred(rawText: string): Promise<void> {
	const plain = stripMarkdownForTts(rawText);
	if (!plain) return;

	try {
		const blob = await fetchCloudTtsBlob(plain);
		await playCloudMp3Blob(blob);
		return;
	} catch {
		if (!isEnglishTtsSupported()) {
			throw new Error('NO_TTS');
		}
		await speakEnglishText(rawText);
	}
}

export function warmupEnglishTtsVoices(): void {
	if (!isEnglishTtsSupported()) return;
	void window.speechSynthesis.getVoices();
	window.speechSynthesis.addEventListener('voiceschanged', () => {
		void window.speechSynthesis.getVoices();
	});
}
