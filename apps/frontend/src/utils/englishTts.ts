/**
 * 英语学习朗读：优先硅基云端 TTS（POST /speech-transcription/speech），失败则 Web Speech。
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

export function speakEnglishText(
	text: string,
	options?: SpeakEnglishOptions,
): Promise<void> {
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
			// 创建一个用于英文语音合成的 SpeechSynthesisUtterance 实例，文本为 plain
			const utter = new SpeechSynthesisUtterance(plain);
			// 默认语言设置为美式英语
			utter.lang = 'en-US';

			// 尝试选择合适的英文语音
			const voice = pickEnglishVoice();
			if (voice) {
				// 如果找到语音，则指定使用该 voice，并使用其语言设定
				utter.voice = voice;
				utter.lang = voice.lang || 'en-US'; // 优先用 voice 提供的语言
			}

			// 设置语音合成的速率，默认为 0.92（比正常稍慢，适合学习）
			utter.rate = options?.rate ?? 0.82;
			// 设置语音的音调，高度，默认为 1
			utter.pitch = options?.pitch ?? 1;
			// 设置音量，默认为最大 1
			utter.volume = options?.volume ?? 1;

			// 合成播放结束回调，无论成功失败都 resolve，保证流程继续
			utter.onend = () => resolve();

			// 播放出错时同样 resolve，不 reject（保证调用方流程简化）
			utter.onerror = () => resolve();

			// 使用 speechSynthesis API 播放此语音
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

export async function playEnglishPreferred(rawText: string): Promise<void> {
	const plain = stripMarkdownForTts(rawText);
	if (!plain) return;

	try {
		if (!isEnglishTtsSupported()) {
			throw new Error('NO_TTS');
		}
		await speakEnglishText(rawText);
		return;
	} catch {
		const blob = await fetchCloudTtsBlob(plain);
		await playCloudMp3Blob(blob);
	}
}

export function warmupEnglishTtsVoices(): void {
	if (!isEnglishTtsSupported()) return;
	void window.speechSynthesis.getVoices();
	window.speechSynthesis.addEventListener('voiceschanged', () => {
		void window.speechSynthesis.getVoices();
	});
}
