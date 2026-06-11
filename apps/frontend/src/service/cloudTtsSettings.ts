import { http, type RequestConfig } from '@/utils/fetch';
import { SETTINGS_CLOUD_TTS } from './api';

export type CloudTtsSettingsView = {
	enabled: boolean;
	playbackSource: 'local' | 'cloud';
	model: string;
	voiceId: string;
	speed: number;
	vol: number;
	pitch: number;
	emotion: string;
	format: string;
	languageBoost: string;
	sampleRate: number;
	bitrate: number;
	channel: 1 | 2;
};

export const getCloudTtsSettings = (config?: RequestConfig) =>
	http.get<CloudTtsSettingsView>(SETTINGS_CLOUD_TTS, config);

export const updateCloudTtsSettings = (
	body: CloudTtsSettingsView,
	config?: RequestConfig,
) => http.put<CloudTtsSettingsView>(SETTINGS_CLOUD_TTS, body, config);

export const clearCloudTtsSettings = (config?: RequestConfig) =>
	http.delete<CloudTtsSettingsView>(SETTINGS_CLOUD_TTS, config);
