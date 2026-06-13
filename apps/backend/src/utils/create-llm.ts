import { ChatOpenAI } from '@langchain/openai';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ModelEnum } from '../enum/config.enum';

/** 智谱 GLM OpenAI 兼容 API 默认根路径 */
export const DEFAULT_GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

/** 各模块未配置 GLM_MODEL_NAME 时的默认值 */
export const DEFAULT_GLM_MODEL_NAME = 'glm-4.7-flash';

/** 硅基流动 OpenAI 兼容 API 默认根路径（有效会员默认凭证） */
export const DEFAULT_SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

/** 各模块未配置 SILICONFLOW_MODEL_NAME 时的默认值（有效会员） */
export const DEFAULT_SILICONFLOW_MODEL_NAME = 'Pro/zai-org/GLM-5.1';

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
	defaultName = DEFAULT_GLM_MODEL_NAME,
): string {
	for (const key of keys) {
		const value = trimConfigValue(config, key);
		if (value) return value;
	}
	return defaultName;
}

const GLM_ENV_API_KEY_KEYS = [ModelEnum.GLM_API_KEY] as const;
const GLM_ENV_BASE_URL_KEYS = [ModelEnum.GLM_BASE_URL] as const;
const GLM_ENV_MODEL_NAME_KEYS = [ModelEnum.GLM_MODEL_NAME] as const;

const SILICONFLOW_ENV_API_KEY_KEYS = [ModelEnum.SILICONFLOW_API_KEY] as const;
const SILICONFLOW_ENV_BASE_URL_KEYS = [ModelEnum.SILICONFLOW_BASE_URL] as const;
const SILICONFLOW_ENV_MODEL_NAME_KEYS = [
	ModelEnum.SILICONFLOW_MODEL_NAME,
] as const;

function resolveGlmModelNameFromEnv(config: ConfigService): string {
	return resolveModelNameFromEnvKeys(config, GLM_ENV_MODEL_NAME_KEYS);
}

function resolveSiliconFlowModelNameFromEnv(config: ConfigService): string {
	return resolveModelNameFromEnvKeys(
		config,
		SILICONFLOW_ENV_MODEL_NAME_KEYS,
		DEFAULT_SILICONFLOW_MODEL_NAME,
	);
}

function buildGlmEnvPresetOptions(
	missingApiKeyMessage: string,
	onMissingApiKey?: MissingApiKeyHandler,
): ResolveSiliconFlowOptions {
	return {
		apiKeyEnvKeys: GLM_ENV_API_KEY_KEYS,
		baseUrlEnvKeys: GLM_ENV_BASE_URL_KEYS,
		defaultBaseUrl: DEFAULT_GLM_BASE_URL,
		resolveModelName: resolveGlmModelNameFromEnv,
		missingApiKeyMessage,
		onMissingApiKey,
	};
}

function buildSiliconFlowEnvPresetOptions(
	missingApiKeyMessage: string,
	onMissingApiKey?: MissingApiKeyHandler,
): ResolveSiliconFlowOptions {
	return {
		apiKeyEnvKeys: SILICONFLOW_ENV_API_KEY_KEYS,
		baseUrlEnvKeys: SILICONFLOW_ENV_BASE_URL_KEYS,
		defaultBaseUrl: DEFAULT_SILICONFLOW_BASE_URL,
		resolveModelName: resolveSiliconFlowModelNameFromEnv,
		missingApiKeyMessage,
		onMissingApiKey,
	};
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
		options.defaultBaseUrl ?? DEFAULT_GLM_BASE_URL,
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
		userId?: number,
	): Promise<SiliconFlowCredentials>;
};

/** 知识库助手模型名（token 预算推断，不创建 LLM） */
export async function getAssistantSiliconFlowModelName(
	config: ConfigService,
	resolver?: LlmCredentialResolver,
	userId?: number,
): Promise<string> {
	if (resolver) {
		const credentials = await resolver.resolveSiliconFlowCredentials(
			config,
			'assistant',
			userId,
		);
		return credentials.modelName;
	}
	return resolveGlmModelNameFromEnv(config);
}

const siliconFlowResolvePresets: Record<
	SiliconFlowLlmPreset,
	(config: ConfigService) => ResolveSiliconFlowOptions
> = {
	chat: () =>
		buildGlmEnvPresetOptions(
			'未配置 GLM_API_KEY，无法发起对话；可在设置页启用「自定义大模型配置」使用其它模型',
		),

	assistant: () =>
		buildGlmEnvPresetOptions(
			'未配置 GLM_API_KEY，无法使用知识库助手；可在设置页启用「自定义大模型配置」',
		),

	knowledgeQa: () =>
		buildGlmEnvPresetOptions(
			'未配置 GLM_API_KEY，无法进行知识库问答；可在设置页启用「自定义大模型配置」',
			throwSiliconFlowError,
		),

	englishLearning: () =>
		buildGlmEnvPresetOptions(
			'未配置 GLM_API_KEY，无法生成学习内容；可在设置页启用「自定义大模型配置」',
		),
};

const memberSiliconFlowResolvePresets: Record<
	SiliconFlowLlmPreset,
	(config: ConfigService) => ResolveSiliconFlowOptions
> = {
	chat: () =>
		buildSiliconFlowEnvPresetOptions(
			'未配置 SILICONFLOW_API_KEY，无法发起对话；可在设置页启用「自定义大模型配置」使用其它模型',
		),

	assistant: () =>
		buildSiliconFlowEnvPresetOptions(
			'未配置 SILICONFLOW_API_KEY，无法使用知识库助手；可在设置页启用「自定义大模型配置」',
		),

	knowledgeQa: () =>
		buildSiliconFlowEnvPresetOptions(
			'未配置 SILICONFLOW_API_KEY，无法进行知识库问答；可在设置页启用「自定义大模型配置」',
			throwSiliconFlowError,
		),

	englishLearning: () =>
		buildSiliconFlowEnvPresetOptions(
			'未配置 SILICONFLOW_API_KEY，无法生成学习内容；可在设置页启用「自定义大模型配置」',
		),
};

export function siliconFlowResolvePresetsForPreset(
	preset: SiliconFlowLlmPreset,
): (config: ConfigService) => ResolveSiliconFlowOptions {
	return siliconFlowResolvePresets[preset];
}

export function memberSiliconFlowResolvePresetsForPreset(
	preset: SiliconFlowLlmPreset,
): (config: ConfigService) => ResolveSiliconFlowOptions {
	return memberSiliconFlowResolvePresets[preset];
}

/**
 * 创建 ChatOpenAI 的统一入口。
 * - 非会员默认 GLM_*；有效会员默认 SILICONFLOW_*；设置页自定义配置经 resolver 覆盖（优先级最高）。
 * - `userId`：各调用方传入当前登录用户 ID，供 resolver 判定会员并选择默认 env 凭证。
 */
export type CreateLlmOptions = {
	preset: SiliconFlowLlmPreset;
	/** 当前登录用户 ID，用于会员默认 SILICONFLOW 凭证 */
	userId?: number;
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

export async function createLlm(
	config: ConfigService,
	options: CreateLlmOptions,
	resolver?: LlmCredentialResolver,
): Promise<ChatOpenAI> {
	const {
		preset,
		userId,
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
		? await resolver.resolveSiliconFlowCredentials(config, preset, userId)
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

	console.log(
		{
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
		},
		'createLlm',
	);

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
