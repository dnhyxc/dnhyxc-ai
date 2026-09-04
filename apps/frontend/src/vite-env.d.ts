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
	/** 讯飞云端语音设置页凭证默认值 */
	readonly VITE_XFYUN_APP_ID?: string;
	readonly VITE_XFYUN_API_KEY?: string;
	readonly VITE_XFYUN_API_SECRET?: string;
	/** MiniMax 云端语音设置页默认值 */
	readonly VITE_MINIMAX_API_KEY?: string;
	readonly VITE_MINIMAX_MODEL_NAME?: string;
	/** 演示账号预填（仅开发/联调；未配置则不启用） */
	readonly VITE_DEMO_LOGIN_USERNAME?: string;
	readonly VITE_DEMO_LOGIN_PASSWORD?: string;
	/** 浏览器独立运行时的版本展示（可选） */
	readonly VITE_APP_VERSION?: string;
	/** Host 插件契约 semver；与 registry 的 hostApiRange 对齐，缺省 1.0.0 */
	readonly VITE_HOST_API_VERSION?: string;
	/** 插件 registry 完整 URL；留空则走 resolveUploadedFileUrl(/remotes/plugins-registry.json) */
	readonly VITE_PLUGIN_REGISTRY_URL?: string;
}
declare module 'markdown-it-katex';
declare module 'markdown-it';
