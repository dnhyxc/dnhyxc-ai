import { http } from '@/utils/fetch';
import {
	SETTINGS_LLM,
	SETTINGS_LLM_DEFAULTS,
	SETTINGS_LLM_VECTOR,
} from './api';

export type LlmSettingsView = {
	enabled: boolean;
	baseUrl: string;
	modelName: string;
	apiKeyConfigured: boolean;
	/** 已保存的完整密钥（设置页回显） */
	apiKey: string;
	apiKeyMask: string | null;
	active: boolean;
	vectorEnabled: boolean;
	vectorBaseUrl: string;
	vectorRerankUrl: string;
	vectorEmbeddingModel: string;
	vectorRerankModel: string;
	vectorCollectionName: string;
	vectorSearchProfiles: Array<{
		collectionName: string;
		embeddingModel: string;
		rerankModel: string;
	}>;
	vectorApiKeyConfigured: boolean;
	vectorApiKey: string;
	vectorApiKeyMask: string | null;
	vectorActive: boolean;
};

export type UpsertLlmSettingsBody = {
	enabled: boolean;
	baseUrl?: string;
	modelName?: string;
	apiKey?: string;
};

export type UpsertLlmVectorSettingsBody = {
	enabled: boolean;
	baseUrl?: string;
	rerankUrl?: string;
	embeddingModel?: string;
	rerankModel?: string;
	collectionName?: string;
	apiKey?: string;
};

export type LlmSettingsDefaultsView = {
	baseUrl: string;
	vector: {
		baseUrl: string;
		rerankUrl: string;
		embeddingModel: string;
		rerankModel: string;
		collectionName: string;
	};
};

export const getLlmSettings = () => http.get<LlmSettingsView>(SETTINGS_LLM);

export const getLlmSettingsDefaults = () =>
	http.get<LlmSettingsDefaultsView>(SETTINGS_LLM_DEFAULTS);

export const updateLlmSettings = (body: UpsertLlmSettingsBody) =>
	http.put<LlmSettingsView>(SETTINGS_LLM, body);

export const clearLlmSettings = () =>
	http.delete<LlmSettingsView>(SETTINGS_LLM);

export const updateLlmVectorSettings = (body: UpsertLlmVectorSettingsBody) =>
	http.put<LlmSettingsView>(SETTINGS_LLM_VECTOR, body);

export const clearLlmVectorSettings = () =>
	http.delete<LlmSettingsView>(SETTINGS_LLM_VECTOR);
