import { http } from '@/utils/fetch';
import { SETTINGS_LLM, SETTINGS_LLM_DEFAULTS } from './api';

export type LlmSettingsView = {
	enabled: boolean;
	baseUrl: string;
	modelName: string;
	apiKeyConfigured: boolean;
	/** 已保存的完整密钥（设置页回显） */
	apiKey: string;
	apiKeyMask: string | null;
	active: boolean;
};

export type UpsertLlmSettingsBody = {
	enabled: boolean;
	baseUrl?: string;
	modelName?: string;
	apiKey?: string;
};

export const getLlmSettings = () => http.get<LlmSettingsView>(SETTINGS_LLM);

export const getLlmSettingsDefaults = () =>
	http.get<{ baseUrl: string }>(SETTINGS_LLM_DEFAULTS);

export const updateLlmSettings = (body: UpsertLlmSettingsBody) =>
	http.put<LlmSettingsView>(SETTINGS_LLM, body);

export const clearLlmSettings = () =>
	http.delete<LlmSettingsView>(SETTINGS_LLM);
