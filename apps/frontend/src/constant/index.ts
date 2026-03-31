import type { HighlightJsThemeId } from '@dnhyxc-ai/tools';

export const BASE_URL = import.meta.env.PROD
	? import.meta.env.VITE_PROD_API_DOMAIN
	: import.meta.env.VITE_DEV_API_DOMAIN;

export const CHAT_VALIDTYPES = [
	'application/pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'image/png',
	'image/jpeg',
	'image/jpg',
	'image/webp',
	'text/markdown',
];

export const CHAT_IMAGE_VALIDTYPES = [
	'image/png',
	'image/jpeg',
	'image/jpg',
	'image/webp',
];

/** Chat 内 MarkdownParser 通过 CDN 注入的 highlight.js 主题 id（修改时值有完整字面量提示） */
export const CHAT_MARKDOWN_HIGHLIGHT_THEME: HighlightJsThemeId =
	'base16/unikitty-dark';
