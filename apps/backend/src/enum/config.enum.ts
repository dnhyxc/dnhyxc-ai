export enum ConfigEnum {
	DB_TYPE = 'DB_TYPE',
	DB_HOST = 'DB_HOST',
	DB_PORT = 'DB_PORT',
	DB_DB1_PORT = 'DB_DB1_PORT',
	DB_DB1_NAME = 'DB_DB1_NAME',
	DB_USERNAME = 'DB_USERNAME',
	DB_PASSWORD = 'DB_PASSWORD',
	DB_DATABASE = 'DB_DATABASE',
	DB_SYNC = 'DB_SYNC',
	DB_DB1_SYNC = 'DB_DB1_SYNC',
	SECRET = 'SECRET',
}

export enum LogEnum {
	LOG_LEVEL = 'LOG_LEVEL',
	LOG_ON = 'LOG_ON',
}

export enum RedisEnum {
	REDIS_URL = 'REDIS_URL',
	REDIS_HOST = 'REDIS_HOST',
	REDIS_PORT = 'REDIS_PORT',
	REDIS_PASSWORD = 'REDIS_PASSWORD',
	REDIS_USERNAME = 'REDIS_USERNAME',
}

/** 腾讯云 COS（对象存储） */
export enum CosEnum {
	COS_SECRET_ID = 'COS_SECRET_ID',
	COS_SECRET_KEY = 'COS_SECRET_KEY',
	/** 存储桶名称，格式 BucketName-APPID */
	COS_BUCKET = 'COS_BUCKET',
	/** 地域，如 ap-guangzhou */
	COS_REGION = 'COS_REGION',
	/**
	 * 对象对外访问域名（CDN 或默认桶域名），如 https://xxx.cos.ap-guangzhou.myqcloud.com/
	 * 未配置时由 Bucket + Region 拼接默认域名。
	 */
	COS_PUBLIC_DOMAIN = 'COS_PUBLIC_DOMAIN',
	/** putObject 对象 ACL，默认 public-read（浏览器直读）；私有桶可改为 private 并改用签名 URL */
	COS_OBJECT_ACL = 'COS_OBJECT_ACL',
}

export enum FileEnum {
	FILE_ROOT = 'FILE_ROOT',
	/** 部署根目录（与 dist 同级），如 /usr/local/dnhyxc-ai/server */
	SERVER_ROOT = 'SERVER_ROOT',
	/** uploads 绝对路径，优先级高于 SERVER_ROOT + uploads */
	UPLOAD_ROOT = 'UPLOAD_ROOT',
}

export enum EmailEnum {
	EMAIL_TRANSPORT = 'EMAIL_TRANSPORT',
	EMAIL_FROM = 'EMAIL_FROM',
}

export enum StripeEnum {
	STRIPE_SECRET_KEY = 'STRIPE_SECRET_KEY',
	STRIPE_WEBHOOK_SECRET = 'STRIPE_WEBHOOK_SECRET',
}

export enum ModelEnum {
	QWEN_API_KEY = 'QWEN_API_KEY',
	QWEN_MODEL_NAME = 'QWEN_MODEL_NAME',
	QWEN_BASE_URL = 'QWEN_BASE_URL',
	/** @deprecated 主聊天已改用硅基流动，见 CHAT_SILICONFLOW_MODEL_NAME */
	DEEPSEEK_API_KEY = 'DEEPSEEK_API_KEY',
	/** @deprecated */
	DEEPSEEK_MODEL_NAME = 'DEEPSEEK_MODEL_NAME',
	/** @deprecated */
	DEEPSEEK_BASE_URL = 'DEEPSEEK_BASE_URL',
	/**
	 * 主站 Chat 流式对话：硅基流动 Chat 模型名，默认 Pro/zai-org/GLM-4.7。
	 * API Key / Base URL 沿用 KnowledgeQaEnum.SILICONFLOW_*。
	 */
	SILICONFLOW_MODEL_NAME = 'SILICONFLOW_MODEL_NAME',
	/**
	 * 英语学习词句拉取：硅基流动 Chat 模型名（`/v1/chat/completions`），默认 Pro/zai-org/GLM-4.7。
	 * API Key 与 Base URL 沿用 KnowledgeQaEnum.SILICONFLOW_*（与知识库 embedding 同源）。
	 * @see https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions
	 */
	ZHIPU_API_KEY = 'ZHIPU_API_KEY',
	ZHIPU_MODEL_NAME = 'ZHIPU_MODEL_NAME',
	ZHIPU_BASE_URL = 'ZHIPU_BASE_URL',
	/**
	 * 当前助手所用大模型的「单请求最大输入上下文」token 上限（与智谱文档一致时可不填）。
	 * 未配置时按 ASSISTANT_GLM_MODEL_NAME 推断（如 glm-4.7 默认 200000）。
	 */
	ASSISTANT_MODEL_MAX_INPUT_TOKENS = 'ASSISTANT_MODEL_MAX_INPUT_TOKENS',
	/**
	 * 可选：在不超过模型官方上限的前提下，再收紧「可用于历史+system」的输入预算（降本/限流）。
	 * 不填则完全按模型最大输入 − max_tokens − 结构预留计算。
	 */
	ASSISTANT_MAX_CONTEXT_TOKENS = 'ASSISTANT_MAX_CONTEXT_TOKENS',
	/** Serper.dev 联网搜索（用于 Chat 注入检索上下文） */
	SERPER_API_KEY = 'SERPER_API_KEY',
	SERPER_SEARCH_URL = 'SERPER_SEARCH_URL',
	/** Tavily 联网搜索 API Key（用于 Chat 默认检索源） */
	TAVILY_API_KEY = 'TAVILY_API_KEY',
	/**
	 * 默认联网检索后端：`tavily` | `serper`（不区分大小写）。未配置时默认 tavily。
	 * 单次请求可用 ChatRequestDto.webSearchProvider 覆盖。
	 */
	WEB_SEARCH_DEFAULT_PROVIDER = 'WEB_SEARCH_DEFAULT_PROVIDER',
	/** 硅基流动 API Key（Bearer），用于知识库 embedding + rerank */
	SILICONFLOW_API_KEY = 'SILICONFLOW_API_KEY',
	/** 硅基流动 API 根路径，默认 https://api.siliconflow.cn/v1 */
	SILICONFLOW_BASE_URL = 'SILICONFLOW_BASE_URL',
}

export enum QdrantEnum {
	/** 例如 http://127.0.0.1:6333 */
	QDRANT_URL = 'QDRANT_URL',
	/** collection 名，默认 knowledge_chunks_v1 */
	QDRANT_KNOWLEDGE_COLLECTION = 'QDRANT_KNOWLEDGE_COLLECTION',
}

export enum KnowledgeQaEnum {
	/**
	 * 知识库向量模型名（硅基流动 OpenAI 兼容 `/v1/embeddings`），默认 BAAI/bge-large-zh-v1.5
	 * @see https://docs.siliconflow.cn/cn/api-reference/embeddings/create-embeddings
	 */
	KNOWLEDGE_EMBEDDING_MODEL = 'KNOWLEDGE_EMBEDDING_MODEL',
	/**
	 * 知识库 RAG 问答 Chat 模型名（硅基流动 `/v1/chat/completions`），默认 Pro/zai-org/GLM-4.7。
	 * API Key / Base URL 沿用 SILICONFLOW_*。
	 */
	KNOWLEDGE_QA_MODEL = 'KNOWLEDGE_QA_MODEL',
	/** 检索 topK，默认 10 */
	KNOWLEDGE_QA_TOPK = 'KNOWLEDGE_QA_TOPK',
	/** 硅基流动 API Key（Bearer），用于知识库 embedding + rerank */
	// SILICONFLOW_API_KEY = 'SILICONFLOW_API_KEY',
	/** 硅基流动 API 根路径，默认 https://api.siliconflow.cn/v1 */
	// SILICONFLOW_BASE_URL = 'SILICONFLOW_BASE_URL',
	/**
	 * 公共语音转写模型（`/v1/audio/transcriptions`，见 speech-transcription 模块），默认 FunAudioLLM/SenseVoiceSmall。
	 * 可改为 TeleAI/TeleSpeechASR 对比中文场景效果（以硅基文档为准）。
	 * @see https://docs.siliconflow.cn/cn/api-reference/audio/create-audio-transcriptions
	 */
	SILICONFLOW_TRANSCRIPTION_MODEL = 'SILICONFLOW_TRANSCRIPTION_MODEL',
	/**
	 * 语音转写语言提示（OpenAI 兼容 `language`，ISO 639-1，如 zh、en）；未配置时默认 zh。
	 * 设为 off / none / disabled 时不发送该字段（上游若对 language 报错时可关闭）。
	 */
	SILICONFLOW_TRANSCRIPTION_LANGUAGE = 'SILICONFLOW_TRANSCRIPTION_LANGUAGE',
	/**
	 * 文本转语音模型（`/v1/audio/speech`），默认 FunAudioLLM/CosyVoice2-0.5B。
	 * @see https://docs.siliconflow.cn/cn/api-reference/audio/create-speech
	 */
	SILICONFLOW_TTS_MODEL = 'SILICONFLOW_TTS_MODEL',
	/** 预置音色，如 FunAudioLLM/CosyVoice2-0.5B:claire（女声） */
	SILICONFLOW_TTS_VOICE = 'SILICONFLOW_TTS_VOICE',
	/**
	 * 知识库 rerank 模型名（硅基流动 `/v1/rerank`），默认 BAAI/bge-reranker-v2-m3
	 * @see https://docs.siliconflow.cn/cn/api-reference/rerank/create-rerank
	 */
	KNOWLEDGE_RERANK_MODEL = 'KNOWLEDGE_RERANK_MODEL',
	/** @deprecated 仅作兼容：未配置 SILICONFLOW_API_KEY 时可临时沿用旧键名 */
	DASHSCOPE_API_KEY = 'DASHSCOPE_API_KEY',
	/** @deprecated 硅基流动接入后不再使用 DashScope base URL */
	DASHSCOPE_BASE_URL = 'DASHSCOPE_BASE_URL',
	/** @deprecated 请改用 KNOWLEDGE_RERANK_MODEL */
	DASHSCOPE_RERANK_MODEL_NAME = 'DASHSCOPE_RERANK_MODEL_NAME',
}
