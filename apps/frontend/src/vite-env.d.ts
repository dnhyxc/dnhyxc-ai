/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
	/** 浏览器独立运行时的版本展示（可选） */
	readonly VITE_APP_VERSION?: string;
}
declare module 'markdown-it-katex';
declare module 'markdown-it';
