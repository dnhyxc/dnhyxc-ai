import { ChatOpenAI } from '@langchain/openai';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { KnowledgeQaEnum, ModelEnum } from '../enum/config.enum';

/** 智谱 GLM OpenAI 兼容 API 默认根路径 */
export const DEFAULT_GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

/** 各模块未配置 GLM_MODEL_NAME 时的默认值 */
export const DEFAULT_GLM_MODEL_NAME = 'glm-4.7-flash';

/** 图片 OCR 默认视觉模型（智谱 GLM-4.6V-Flash） */
export const DEFAULT_OCR_GLM_MODEL_NAME = 'GLM-4.6V-Flash';

/** 硅基流动 OpenAI 兼容 API 默认根路径（有效会员默认凭证） */
export const DEFAULT_SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

/** 硅基流动 embedding / rerank 默认完整请求 URL */
export const DEFAULT_SILICONFLOW_EMBEDDING_URL =
	'https://api.siliconflow.cn/v1/embeddings';
export const DEFAULT_SILICONFLOW_RERANK_URL =
	'https://api.siliconflow.cn/v1/rerank';

/** 各模块未配置 SILICONFLOW_MODEL_NAME 时的默认值（有效会员） */
export const DEFAULT_SILICONFLOW_MODEL_NAME = 'Pro/zai-org/GLM-5.1';

/**
 * @description 硅基流动模型用途预设（与业务一一对应，用于选择配置）
 * - chat: 聊天
 * - assistant: 知识库助手
 * - knowledgeQa: 知识库问答
 * - englishLearning: 英语学习
 * - ocr: 图片 OCR（固定 GLM_* 环境变量 + GLM-4.6V-Flash，不走设置页覆盖）
 */
export type SiliconFlowLlmPreset =
	| 'chat'
	| 'assistant'
	| 'knowledgeQa'
	| 'englishLearning'
	| 'ocr';

/**
 * @description 配置传递到 ChatOpenAI 禁用 thinking 链（agent/assistant 工具链和正文流式调用会关闭）
 */
export const GLM_THINKING_DISABLED_KWARGS = {
	thinking: { type: 'disabled' as const },
};

/**
 * @description 一个大模型凭证的基本信息
 * - apiKey: API Key 凭证
 * - baseURL: 调用 API 的根路径
 * - modelName: 模型名称
 */
export type SiliconFlowCredentials = {
	apiKey: string;
	baseURL: string;
	modelName: string;
};

/** 缺少 ApiKey 时抛错的回调类型 */
type MissingApiKeyHandler = (message: string) => never;

/**
 * @description 缺少会员 ApiKey 时的抛错回调（http 503）
 */
const throwSiliconFlowHttpUnavailable: MissingApiKeyHandler = (message) => {
	throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
};

/**
 * @description 缺少 ApiKey 时直接抛普通 Error
 */
const throwSiliconFlowError: MissingApiKeyHandler = (message) => {
	throw new Error(message);
};

/**
 * @description 用于统一凭证解析的选项结构
 * - apiKeyEnvKeys: 环境变量 key 列表（自上而下优先级）
 * - baseUrlEnvKeys: 同上，baseURL
 * - defaultBaseUrl: 若上述未获取则取默认 baseURL
 * - resolveModelName: 获取模型名的回调
 * - missingApiKeyMessage: 报错信息
 * - onMissingApiKey?: 缺 key 时抛错/兜底回调
 */
type ResolveSiliconFlowOptions = {
	apiKeyEnvKeys: readonly string[];
	baseUrlEnvKeys: readonly string[];
	defaultBaseUrl?: string;
	resolveModelName: (config: ConfigService) => string;
	missingApiKeyMessage: string;
	onMissingApiKey?: MissingApiKeyHandler;
};

/**
 * @description 工具：获取并去除字符串环境配置收尾空格
 */
function trimConfigValue(
	config: ConfigService,
	key: string,
): string | undefined {
	const raw = config.get<string>(key);
	if (raw == null) return undefined;
	const trimmed = String(raw).trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * @description 工具：依次尝试多组环境 key，取第一个有效（去空格后非空）的 value
 */
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

/**
 * @description 根据多组 env key 获取 baseUrl（加默认值），自动去除末尾斜杠
 */
function resolveBaseUrl(
	config: ConfigService,
	keys: readonly string[],
	defaultUrl: string,
): string {
	const raw = resolveFirstTrimmed(config, keys) || defaultUrl;
	return raw.replace(/\/$/, '');
}

/**
 * @description 从 env 依次取第一个有效模型名
 * @param keys: 环境变量 key 列表
 * @param defaultName: 没取到则使用的默认模型名
 */
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

/* 以下常量用于记录各 API/模型相关环境变量 key 列表（后续便于统一处理） */
const GLM_ENV_API_KEY_KEYS = [ModelEnum.GLM_API_KEY] as const;
const GLM_ENV_BASE_URL_KEYS = [ModelEnum.GLM_BASE_URL] as const;
const GLM_ENV_MODEL_NAME_KEYS = [ModelEnum.GLM_MODEL_NAME] as const;
const GLM_OCR_MODEL_NAME_KEYS = [ModelEnum.GLM_OCR_MODEL_NAME] as const;

const SILICONFLOW_ENV_API_KEY_KEYS = [ModelEnum.SILICONFLOW_API_KEY] as const;
const SILICONFLOW_ENV_BASE_URL_KEYS = [ModelEnum.SILICONFLOW_BASE_URL] as const;
const SILICONFLOW_ENV_MODEL_NAME_KEYS = [
	ModelEnum.SILICONFLOW_MODEL_NAME,
] as const;

/** 单次 embeddings 请求 input 数组最大条数（硅基流动文档限制） */
export const KNOWLEDGE_EMBEDDING_BATCH_SIZE = 32;

/** bge-large-zh 单条约 512 tokens，中文按字符保守上限（入库前二次截断） */
export const KNOWLEDGE_BGE_EMBEDDING_MAX_CHARS = 200;

/** bge 模型单次请求条数（略小于硅基文档 32，降低批量失败率） */
export const KNOWLEDGE_BGE_EMBEDDING_BATCH_SIZE = 8;

/** default 档位分片目标字数（须低于 BGE token 上限） */
export const KNOWLEDGE_DEFAULT_CHUNK_TARGET_CHARS = 200;
export const KNOWLEDGE_DEFAULT_CHUNK_OVERLAP_CHARS = 32;

/**
 * @description 知识库向量 API 调用配置
 * - baseURL：完整请求 URL（来自 SILICONFLOW_EMBEDDING_URL / SILICONFLOW_RERANK_URL）
 */
export type KnowledgeVectorApiConfig = {
	apiKey: string;
	baseURL: string;
	model: string;
};

/** 知识库向量：非会员默认 embedding / rerank 模型 */
export const DEFAULT_KNOWLEDGE_EMBEDDING_MODEL = 'BAAI/bge-large-zh-v1.5';
export const DEFAULT_KNOWLEDGE_RERANK_MODEL = 'BAAI/bge-reranker-v2-m3';

/** 有效会员默认 embedding / rerank 模型（硅基流动） */
export const DEFAULT_MEMBER_KNOWLEDGE_EMBEDDING_MODEL =
	'Qwen/Qwen3-Embedding-4B';
export const DEFAULT_MEMBER_KNOWLEDGE_RERANK_MODEL = 'Qwen/Qwen3-Reranker-4B';

/** 知识库向量凭证档位：default=非会员 bge 1024；member=会员 Qwen3 2560 */
export type KnowledgeVectorTier = 'default' | 'member';

/** 知识库向量模式预设：embedding 或 rerank */
type KnowledgeVectorPreset = 'embedding' | 'rerank';

/**
 * @description 获取 GLM 环境模型名（优先 env key）
 */
function resolveGlmModelNameFromEnv(config: ConfigService): string {
	return resolveModelNameFromEnvKeys(config, GLM_ENV_MODEL_NAME_KEYS);
}

/** OCR 视觉模型：优先 GLM_OCR_MODEL_NAME，否则 GLM-4.6V-Flash */
function resolveOcrGlmModelNameFromEnv(config: ConfigService): string {
	return resolveModelNameFromEnvKeys(
		config,
		GLM_OCR_MODEL_NAME_KEYS,
		DEFAULT_OCR_GLM_MODEL_NAME,
	);
}

/**
 * @description 获取 SiliconFlow 环境模型名（优先 env key，否则默认值）
 */
function resolveSiliconFlowModelNameFromEnv(config: ConfigService): string {
	return resolveModelNameFromEnvKeys(
		config,
		SILICONFLOW_ENV_MODEL_NAME_KEYS,
		DEFAULT_SILICONFLOW_MODEL_NAME,
	);
}

/**
 * @description 构建非会员（GLM）凭证解析 preset
 * @param missingApiKeyMessage: 缺 key 时给调用方的错误提示
 * @param onMissingApiKey: 可选自定义缺 key 时的兜底处理函数
 */
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

/**
 * @description 构建会员（硅基流动）凭证解析 preset
 * @param missingApiKeyMessage: 缺 key 时给调用方的错误提示
 * @param onMissingApiKey: 可选自定义缺 key 时的兜底处理函数
 */
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

/**
 * @description 构建 OCR 凭证解析 preset：GLM_API_KEY / GLM_BASE_URL + GLM-4.6V-Flash
 */
function buildGlmOcrEnvPresetOptions(
	missingApiKeyMessage: string,
	onMissingApiKey?: MissingApiKeyHandler,
): ResolveSiliconFlowOptions {
	return {
		apiKeyEnvKeys: GLM_ENV_API_KEY_KEYS,
		baseUrlEnvKeys: GLM_ENV_BASE_URL_KEYS,
		defaultBaseUrl: DEFAULT_GLM_BASE_URL,
		resolveModelName: resolveOcrGlmModelNameFromEnv,
		missingApiKeyMessage,
		onMissingApiKey,
	};
}

/**
 * @description 按 env 回退链解析凭证（不含 UI/DB 运行时覆盖）
 * @param config: 配置服务（获取 env 信息）
 * @param options: 解析凭证的相关参数
 * @returns SiliconFlowCredentials
 */
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
		// 缺 key，调用 onMissingApiKey，默认抛 Http 503
		(options.onMissingApiKey ?? throwSiliconFlowHttpUnavailable)(
			options.missingApiKeyMessage,
		);
	}
	return { apiKey, baseURL, modelName };
}

/**
 * @description LlmCredentialResolver 接口声明
 * - 由 UI 或业务调用方实现，可基于 userId 实现自定义凭证解析（如 DB/用户特权/自定义凭证）
 */
export type LlmCredentialResolver = {
	resolveSiliconFlowCredentials(
		config: ConfigService,
		preset: SiliconFlowLlmPreset,
		userId?: number,
	): Promise<SiliconFlowCredentials>;
};

/**
 * @description 只用于推断知识库助手模型名（无需实例化 LLM，仅 parse token 用）
 * @param config: 配置服务
 * @param resolver: 可选凭证自定义解析器
 * @param userId: 当前用户 ID
 */
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
	// 若无 resolver，则走默认（非会员，env 取 glm）
	return resolveGlmModelNameFromEnv(config);
}

/**
 * @description 非会员环境凭证 preset（每个 preset 指定错误消息和解析链策略）
 */
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
			throwSiliconFlowError, // 知识库问答直接抛 JS Error
		),
	englishLearning: () =>
		buildGlmEnvPresetOptions(
			'未配置 GLM_API_KEY，无法生成学习内容；可在设置页启用「自定义大模型配置」',
		),
	ocr: () =>
		buildGlmOcrEnvPresetOptions(
			'未配置 GLM_API_KEY，无法进行图片 OCR',
			throwSiliconFlowError,
		),
};

/**
 * @description 会员环境凭证 preset（同上，仅切为 siliconflow api/env key 和错误消息）
 */
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
	ocr: () =>
		buildGlmOcrEnvPresetOptions(
			'未配置 GLM_API_KEY，无法进行图片 OCR',
			throwSiliconFlowError,
		),
};

/**
 * @description 获取非会员 preset 的凭证解析构造函数
 */
export function siliconFlowResolvePresetsForPreset(
	preset: SiliconFlowLlmPreset,
): (config: ConfigService) => ResolveSiliconFlowOptions {
	return siliconFlowResolvePresets[preset];
}

/**
 * @description 获取会员 preset 的凭证解析构造函数
 */
export function memberSiliconFlowResolvePresetsForPreset(
	preset: SiliconFlowLlmPreset,
): (config: ConfigService) => ResolveSiliconFlowOptions {
	return memberSiliconFlowResolvePresets[preset];
}

/**
 * @description 知识库向量调度方案预设（按会员档位）
 * - default: BAAI/bge-large-zh-v1.5 + bge-reranker（1024 维库）
 * - member: Qwen3-Embedding-4B + Qwen3-Reranker-4B（2560 维库）
 */
const KNOWLEDGE_VECTOR_MODEL_PRESETS: Record<
	KnowledgeVectorTier,
	Record<KnowledgeVectorPreset, { modelKey: string; defaultModel: string }>
> = {
	default: {
		embedding: {
			modelKey: KnowledgeQaEnum.KNOWLEDGE_EMBEDDING_MODEL,
			defaultModel: DEFAULT_KNOWLEDGE_EMBEDDING_MODEL,
		},
		rerank: {
			modelKey: KnowledgeQaEnum.KNOWLEDGE_RERANK_MODEL,
			defaultModel: DEFAULT_KNOWLEDGE_RERANK_MODEL,
		},
	},
	member: {
		embedding: {
			modelKey: KnowledgeQaEnum.KNOWLEDGE_EMBEDDING_MODEL_MEMBER,
			defaultModel: DEFAULT_MEMBER_KNOWLEDGE_EMBEDDING_MODEL,
		},
		rerank: {
			modelKey: KnowledgeQaEnum.KNOWLEDGE_RERANK_MODEL_MEMBER,
			defaultModel: DEFAULT_MEMBER_KNOWLEDGE_RERANK_MODEL,
		},
	},
};

const KNOWLEDGE_VECTOR_URL_PRESETS: Record<
	KnowledgeVectorPreset,
	{ urlEnvKeys: readonly string[]; defaultUrl: string }
> = {
	embedding: {
		urlEnvKeys: [ModelEnum.SILICONFLOW_EMBEDDING_URL],
		defaultUrl: DEFAULT_SILICONFLOW_EMBEDDING_URL,
	},
	rerank: {
		urlEnvKeys: [ModelEnum.SILICONFLOW_RERANK_URL],
		defaultUrl: DEFAULT_SILICONFLOW_RERANK_URL,
	},
};

/**
 * @description 解析知识库向量 API 调用详细配置
 */
function resolveKnowledgeVectorApiConfig(
	config: ConfigService,
	preset: KnowledgeVectorPreset,
	tier: KnowledgeVectorTier = 'default',
): KnowledgeVectorApiConfig {
	const apiKey = resolveFirstTrimmed(config, [
		ModelEnum.SILICONFLOW_API_KEY,
		ModelEnum.QWEN_API_KEY,
	]);
	if (!apiKey) {
		throw new Error(
			'缺少 SILICONFLOW_API_KEY（或兼容项 DASHSCOPE_API_KEY / QWEN_API_KEY），无法进行知识库向量检索',
		);
	}
	const { modelKey, defaultModel } =
		KNOWLEDGE_VECTOR_MODEL_PRESETS[tier][preset];
	const { urlEnvKeys, defaultUrl } = KNOWLEDGE_VECTOR_URL_PRESETS[preset];
	const model = resolveFirstTrimmed(config, [modelKey]) || defaultModel;
	const baseURL = resolveFirstTrimmed(config, urlEnvKeys) || defaultUrl;
	if (!baseURL) {
		throw new Error(
			`缺少 ${urlEnvKeys[0]}（知识库 ${preset} 完整请求 URL），无法进行知识库向量检索`,
		);
	}
	return { apiKey, baseURL, model };
}

/** 解析知识库 embedding API 配置（tier：default | member） */
export function resolveKnowledgeEmbeddingApiConfig(
	config: ConfigService,
	tier: KnowledgeVectorTier = 'default',
): KnowledgeVectorApiConfig {
	return resolveKnowledgeVectorApiConfig(config, 'embedding', tier);
}

/** 解析知识库 rerank API 配置（tier：default | member） */
export function resolveKnowledgeRerankApiConfig(
	config: ConfigService,
	tier: KnowledgeVectorTier = 'default',
): KnowledgeVectorApiConfig {
	return resolveKnowledgeVectorApiConfig(config, 'rerank', tier);
}

/**
 * @description 创建 ChatOpenAI 的统一入口。
 * - 非会员默认 GLM_*；有效会员默认 SILICONFLOW_*；设置页自定义配置经 resolver 覆盖（优先级最高）。
 * - `userId`：各调用方传入当前登录用户 ID，供 resolver 判定会员并选择默认 env 凭证。
 *
 * options 详解：
 * - preset: 业务使用场景（chat/assistant/knowledgeQa/englishLearning）
 * - userId: 当前登录用户 id，会员判断用
 * - modelName: 手动覆盖选择出来的模型名
 * - streaming: 是否流式输出
 * - temperature: 采样多样性温度（未传用 defaultTemperature）
 * - maxTokens: 最大 token 预算
 * - maxTokensPolicy: maxTokens 字段写入策略
 * - modelKwargs: 传递给模型的额外参数
 * - abortSignal: 取消信号
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

/**
 * @description 统一创建 ChatOpenAI 实例
 * - 按优先级选择凭证（支持外部 resolver），按传参组装模型配置
 */
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

	// 第一优先：使用自定义凭证（resolver eg. UI DB），否则用 env preset
	const credentials = resolver
		? await resolver.resolveSiliconFlowCredentials(config, preset, userId)
		: resolveSiliconFlowCredentials(
				config,
				siliconFlowResolvePresets[preset](config),
			);

	// 如外部传入了 modelName 覆盖，则优先生效
	if (modelNameOverride) {
		credentials.modelName = modelNameOverride;
	}

	// maxTokens 字段处理策略
	const maxTokensField =
		maxTokensPolicy === 'optional'
			? maxTokens !== undefined
				? { maxTokens }
				: {}
			: { maxTokens: maxTokens ?? defaultMaxTokens };

	// 日志输出当前 LLM 配置（不记录完整 apiKey）
	console.log(
		{
			apiKeyConfigured: Boolean(credentials.apiKey?.trim()),
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

	// 创建 ChatOpenAI 实例，参数保持与日志一致，外部传参优先
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
