import type { HighlightJsThemeId } from '@dnhyxc-ai/markdown-kit';

import type { ThemeName } from '@/hooks/theme';

export const BASE_URL = import.meta.env.PROD
	? import.meta.env.VITE_PROD_API_DOMAIN
	: import.meta.env.VITE_DEV_API_DOMAIN;

/** 个人主页「语音转文字」开关（plugin-store / 浏览器 settings JSON） */
export const PROFILE_VOICE_CONVERSION_ENABLED_KEY =
	'profile_voice_conversion_enabled';

/** 个人主页修改语音开关后广播，ChatEntry 等同壳内入口无需刷新即可同步 */
export const PROFILE_VOICE_CONVERSION_CHANGED_EVENT =
	'dnhyxc-settings-profile-voice-conversion';

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

/**
 * Chat / 文档等 MarkdownParser 的 highlight.js 主题：黑色配色用暗色高亮，其余用亮色高亮。
 */
export function getChatMarkdownHighlightTheme(
	themeName: ThemeName,
): HighlightJsThemeId {
	return themeName === 'black' ? 'atom-one-dark' : 'atom-one-light';
}
