import { http, type RequestConfig } from '@/utils/fetch';
import { SETTINGS_CLOUD_TTS } from './api';

/** 会员朗读选路：本机 / MiniMax 云端 / 讯飞在线 / Edge TTS，四选一互斥 */
export type TtsPlaybackSource = 'local' | 'cloud' | 'xfyun' | 'edge';

export type CloudTtsSettingsView = {
	enabled: boolean;
	playbackSource: TtsPlaybackSource;
	model: string;
	voiceId: string;
	xfyunVoiceId: string;
	edgeVoiceId: string;
	minimaxSpeed: number;
	minimaxVol: number;
	minimaxPitch: number;
	xfyunSpeed: number;
	xfyunVolume: number;
	xfyunPitch: number;
	edgeSpeed: number;
	edgeVol: number;
	edgePitch: number;
	emotion: string;
	format: string;
	languageBoost: string;
	sampleRate: number;
	bitrate: number;
	channel: 1 | 2;
	xfyunAppId: string;
	xfyunApiKey: string;
	xfyunApiSecret: string;
	minimaxApiKey: string;
};

export const getCloudTtsSettings = (config?: RequestConfig) =>
	http.get<CloudTtsSettingsView>(SETTINGS_CLOUD_TTS, config);

export const updateCloudTtsSettings = (
	body: CloudTtsSettingsView,
	config?: RequestConfig,
) => http.put<CloudTtsSettingsView>(SETTINGS_CLOUD_TTS, body, config);

export const clearCloudTtsSettings = (config?: RequestConfig) =>
	http.delete<CloudTtsSettingsView>(SETTINGS_CLOUD_TTS, config);
