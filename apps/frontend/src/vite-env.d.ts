/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
	/** 大模型设置页 API Key 默认值（未保存过用户配置时回显） */
	readonly VITE_SILICONFLOW_API_KEY?: string;
	readonly VITE_SILICONFLOW_BASE_URL?: string;
	readonly VITE_SILICONFLOW_MODEL_NAME?: string;
	readonly VITE_GLM_API_KEY?: string;
	readonly VITE_GLM_BASE_URL?: string;
	readonly VITE_GLM_MODEL_NAME?: string;
	/** 浏览器独立运行时的版本展示（可选） */
	readonly VITE_APP_VERSION?: string;
}
declare module 'markdown-it-katex';
declare module 'markdown-it';
