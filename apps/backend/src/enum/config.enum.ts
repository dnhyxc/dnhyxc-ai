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

export enum QiniuEnum {
	ACCESS_KEY = 'ACCESS_KEY',
	SECRET_KEY = 'SECRET_KEY',
	BUCKET_NAME = 'BUCKET_NAME',
	DOMAIN = 'DOMAIN',
}

export enum FileEnum {
	FILE_ROOT = 'FILE_ROOT',
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
	DEEPSEEK_API_KEY = 'DEEPSEEK_API_KEY',
	DEEPSEEK_MODEL_NAME = 'DEEPSEEK_MODEL_NAME',
	DEEPSEEK_BASE_URL = 'DEEPSEEK_BASE_URL',
	ZHIPU_API_KEY = 'ZHIPU_API_KEY',
	ZHIPU_MODEL_NAME = 'ZHIPU_MODEL_NAME',
	ZHIPU_BASE_URL = 'ZHIPU_BASE_URL',
	/** 助手模块专用 GLM 模型名，未配置时回退 ZHIPU_MODEL_NAME 或 glm-4.7 */
	ASSISTANT_GLM_MODEL_NAME = 'ASSISTANT_GLM_MODEL_NAME',
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
	/** QA 用的聊天模型名（OpenAI 兼容接口），默认沿用 DEEPSEEK_MODEL_NAME */
	KNOWLEDGE_QA_MODEL = 'KNOWLEDGE_QA_MODEL',
	/** 检索 topK，默认 10 */
	KNOWLEDGE_QA_TOPK = 'KNOWLEDGE_QA_TOPK',
	/** 硅基流动 API Key（Bearer），用于知识库 embedding + rerank */
	SILICONFLOW_API_KEY = 'SILICONFLOW_API_KEY',
	/** 硅基流动 API 根路径，默认 https://api.siliconflow.cn/v1 */
	SILICONFLOW_BASE_URL = 'SILICONFLOW_BASE_URL',
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
