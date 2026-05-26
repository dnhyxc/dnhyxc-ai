import { ChatOpenAI } from '@langchain/openai';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { KnowledgeQaEnum, ModelEnum } from '../enum/config.enum';

/** 硅基流动 OpenAI 兼容 API 默认根路径 */
export const DEFAULT_SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

/** 各模块未配置模型名时的默认值 */
export const DEFAULT_SILICONFLOW_MODEL_NAME = 'Pro/zai-org/GLM-4.7';

/** 凭证解析预设（与业务模块一一对应） */
export type SiliconFlowLlmPreset =
	| 'chat'
	| 'assistant'
	| 'knowledgeQa'
	| 'englishLearning';

/** 关闭 GLM thinking 链（Agent / Assistant 工具调用与流式正文） */
export const GLM_THINKING_DISABLED_KWARGS = {
	thinking: { type: 'disabled' as const },
};

export type SiliconFlowCredentials = {
	apiKey: string;
	baseURL: string;
	modelName: string;
};

type MissingApiKeyHandler = (message: string) => never;

const throwSiliconFlowHttpUnavailable: MissingApiKeyHandler = (message) => {
	throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
};

const throwSiliconFlowError: MissingApiKeyHandler = (message) => {
	throw new Error(message);
};

type ResolveSiliconFlowOptions = {
	apiKeyEnvKeys: readonly string[];
	baseUrlEnvKeys: readonly string[];
	defaultBaseUrl?: string;
	resolveModelName: (config: ConfigService) => string;
	missingApiKeyMessage: string;
	onMissingApiKey?: MissingApiKeyHandler;
};

function trimConfigValue(
	config: ConfigService,
	key: string,
): string | undefined {
	const raw = config.get<string>(key);
	if (raw == null) return undefined;
	const trimmed = String(raw).trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function resolveFirstTrimmed(
	config: ConfigService,
	keys: readonly string[],
): string {
	for (const key of keys) {
		const value = trimConfigValue(config, key);
		if (value) return value;
	}
	return '';
}

function resolveBaseUrl(
	config: ConfigService,
	keys: readonly string[],
	defaultUrl: string,
): string {
	const raw = resolveFirstTrimmed(config, keys) || defaultUrl;
	return raw.replace(/\/$/, '');
}

function resolveModelNameFromEnvKeys(
	config: ConfigService,
	keys: readonly string[],
	defaultName = DEFAULT_SILICONFLOW_MODEL_NAME,
): string {
	for (const key of keys) {
		const value = trimConfigValue(config, key);
		if (value) return value;
	}
	return defaultName;
}

/** 按 env 回退链解析凭证（不含 UI/DB 运行时覆盖） */
export function resolveSiliconFlowCredentials(
	config: ConfigService,
	options: ResolveSiliconFlowOptions,
): SiliconFlowCredentials {
	const apiKey = resolveFirstTrimmed(config, options.apiKeyEnvKeys);
	const baseURL = resolveBaseUrl(
		config,
		options.baseUrlEnvKeys,
		options.defaultBaseUrl ?? DEFAULT_SILICONFLOW_BASE_URL,
	);
	const modelName = options.resolveModelName(config);
	if (!apiKey) {
		(options.onMissingApiKey ?? throwSiliconFlowHttpUnavailable)(
			options.missingApiKeyMessage,
		);
	}
	return { apiKey, baseURL, modelName };
}

export type LlmCredentialResolver = {
	resolveSiliconFlowCredentials(
		config: ConfigService,
		preset: SiliconFlowLlmPreset,
	): SiliconFlowCredentials;
};

/** 知识库助手模型名（token 预算推断，不创建 LLM） */
export function getAssistantSiliconFlowModelName(
	config: ConfigService,
	resolver?: LlmCredentialResolver,
): string {
	if (resolver) {
		return resolver.resolveSiliconFlowCredentials(config, 'assistant')
			.modelName;
	}
	return resolveModelNameFromEnvKeys(config, [
		ModelEnum.SILICONFLOW_MODEL_NAME,
		ModelEnum.DEEPSEEK_MODEL_NAME,
	]);
}

const siliconFlowResolvePresets: Record<
	SiliconFlowLlmPreset,
	(config: ConfigService) => ResolveSiliconFlowOptions
> = {
	chat: () => ({
		apiKeyEnvKeys: [ModelEnum.SILICONFLOW_API_KEY, ModelEnum.DEEPSEEK_API_KEY],
		baseUrlEnvKeys: [
			ModelEnum.SILICONFLOW_BASE_URL,
			ModelEnum.DEEPSEEK_BASE_URL,
		],
		resolveModelName: (c) =>
			resolveModelNameFromEnvKeys(c, [
				ModelEnum.SILICONFLOW_MODEL_NAME,
				ModelEnum.DEEPSEEK_MODEL_NAME,
			]),
		missingApiKeyMessage:
			'硅基流动未配置（SILICONFLOW_API_KEY，或兼容 DEEPSEEK_API_KEY），无法发起对话',
	}),

	assistant: () => ({
		apiKeyEnvKeys: [
			ModelEnum.SILICONFLOW_API_KEY,
			ModelEnum.DEEPSEEK_API_KEY,
			KnowledgeQaEnum.DASHSCOPE_API_KEY,
			ModelEnum.QWEN_API_KEY,
		],
		baseUrlEnvKeys: [
			ModelEnum.SILICONFLOW_BASE_URL,
			ModelEnum.DEEPSEEK_BASE_URL,
		],
		resolveModelName: getAssistantSiliconFlowModelName,
		missingApiKeyMessage:
			'硅基流动未配置（SILICONFLOW_API_KEY，或兼容 DASHSCOPE_API_KEY / QWEN_API_KEY / DEEPSEEK_API_KEY），无法使用知识库助手',
	}),

	knowledgeQa: () => ({
		apiKeyEnvKeys: [
			ModelEnum.SILICONFLOW_API_KEY,
			KnowledgeQaEnum.DASHSCOPE_API_KEY,
			ModelEnum.QWEN_API_KEY,
		],
		baseUrlEnvKeys: [ModelEnum.SILICONFLOW_BASE_URL],
		resolveModelName: (c) =>
			resolveModelNameFromEnvKeys(c, [
				ModelEnum.SILICONFLOW_MODEL_NAME,
				ModelEnum.DEEPSEEK_MODEL_NAME,
				KnowledgeQaEnum.KNOWLEDGE_QA_MODEL,
			]),
		missingApiKeyMessage:
			'硅基流动未配置（SILICONFLOW_API_KEY，或兼容 DASHSCOPE_API_KEY / QWEN_API_KEY），无法进行知识库问答',
		onMissingApiKey: throwSiliconFlowError,
	}),

	englishLearning: () => ({
		apiKeyEnvKeys: [
			ModelEnum.SILICONFLOW_API_KEY,
			ModelEnum.DEEPSEEK_API_KEY,
			KnowledgeQaEnum.DASHSCOPE_API_KEY,
		],
		baseUrlEnvKeys: [
			ModelEnum.SILICONFLOW_BASE_URL,
			ModelEnum.DEEPSEEK_BASE_URL,
		],
		resolveModelName: (c) =>
			resolveModelNameFromEnvKeys(c, [
				ModelEnum.SILICONFLOW_MODEL_NAME,
				ModelEnum.DEEPSEEK_MODEL_NAME,
			]),
		missingApiKeyMessage:
			'硅基流动未配置（SILICONFLOW_API_KEY，或兼容 DEEPSEEK_API_KEY），无法生成学习内容',
	}),
};

export function siliconFlowResolvePresetsForPreset(
	preset: SiliconFlowLlmPreset,
): (config: ConfigService) => ResolveSiliconFlowOptions {
	return siliconFlowResolvePresets[preset];
}

/**
 * 创建硅基流动 ChatOpenAI 的统一入口。
 * - `preset`：选择凭证与模型名的解析策略（各业务 env 回退链不同）。
 * - 其余字段：透传为 ChatOpenAI 构造参数，由各调用方按原逻辑传入。
 */
export type CreateLlmOptions = {
	preset: SiliconFlowLlmPreset;
	/** 覆盖预设解析出的 modelName（如英语学习 summary 专用模型） */
	modelName?: string;
	streaming?: boolean;
	temperature?: number;
	/** 未传 temperature 时使用的默认值 */
	defaultTemperature?: number;
	maxTokens?: number;
	/**
	 * optional：仅当显式传入 maxTokens 时才写入 ChatOpenAI（主站 Chat）
	 * default：未传 maxTokens 时使用 defaultMaxTokens
	 */
	maxTokensPolicy?: 'optional' | 'default';
	defaultMaxTokens?: number;
	abortSignal?: AbortSignal;
	modelKwargs?: Record<string, unknown>;
};

export function createLlm(
	config: ConfigService,
	options: CreateLlmOptions,
	resolver?: LlmCredentialResolver,
): ChatOpenAI {
	const {
		preset,
		modelName: modelNameOverride,
		streaming = true,
		temperature,
		defaultTemperature = 0.3,
		maxTokens,
		maxTokensPolicy = 'default',
		defaultMaxTokens = 4096,
		abortSignal,
		modelKwargs,
	} = options;

	const credentials = resolver
		? resolver.resolveSiliconFlowCredentials(config, preset)
		: resolveSiliconFlowCredentials(
				config,
				siliconFlowResolvePresets[preset](config),
			);
	if (modelNameOverride) {
		credentials.modelName = modelNameOverride;
	}

	const maxTokensField =
		maxTokensPolicy === 'optional'
			? maxTokens !== undefined
				? { maxTokens }
				: {}
			: { maxTokens: maxTokens ?? defaultMaxTokens };

	return new ChatOpenAI({
		apiKey: credentials.apiKey,
		modelName: credentials.modelName,
		streaming,
		temperature: temperature ?? defaultTemperature,
		...maxTokensField,
		configuration: { baseURL: credentials.baseURL },
		...(modelKwargs && { modelKwargs }),
		...(abortSignal && {
			callOptions: { signal: abortSignal },
		}),
	});
}
