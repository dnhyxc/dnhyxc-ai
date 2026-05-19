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

/** 与后端 GenerateVocabularyDto 一致：`count` 选填，填写时最小为 1 */
export const VOCAB_COUNT_MIN = 1;
/** 与后端 `ENGLISH_VOCAB_GENERATION_MAX` 一致 */
export const VOCAB_COUNT_MAX = 12000;
/**
 * 单词数量、经典语句等数量的常用预设选项。
 * 用于快捷按钮，方便用户一键选择。
 */
export const VOCAB_COUNT_PRESETS = [10, 100, 500, 1000, 3000, 12000] as const;
/** 历史列表分页大小（与知识库列表分页量级一致） */
export const VOCAB_HISTORY_PAGE_SIZE = 20;
/** 单词库列表每页条数 */
export const VOCAB_LIBRARY_LIST_PAGE_SIZE = 20;
/** 单词库内词条每页条数 */
export const VOCAB_LIBRARY_ITEMS_PAGE_SIZE = 50;
/** 拉取结果历史会话内词条每页条数（与后端 PACK_HISTORY_ITEMS_PAGE_MAX 上限对齐） */
export const PACK_ITEMS_PAGE_SIZE = 100;
/** 收藏状态批量查询单次最多词数，与后端 `VocabularyFavoriteStatusDto` 的 `@ArrayMaxSize(500)` 一致 */
export const VOCAB_FAVORITE_STATUS_BATCH_SIZE = 500;
/** 收藏状态 HTTP 分批大小（降低单次 payload，减轻 Tauri 瞬时网络失败） */
export const FAVORITE_STATUS_HTTP_BATCH_SIZE = 50;

/** 英文经典语句生成的最小数量（前端和后端校验均需保持一致） */
export const QUOTE_COUNT_MIN = 1;
/** 英文经典语句生成的最大数量，需与后端 `ENGLISH_CLASSIC_QUOTES_GENERATION_MAX` 保持一致 */
export const QUOTE_COUNT_MAX = 6000;
/**
 * 英文经典语句、单词等数量的常用预设选项。
 * 用于快捷按钮，方便用户一键选择。
 */
export const COUNT_PRESETS = [10, 100, 500, 1000, 3000, 6000] as const;
/**
 * 经典语句/单词历史列表每页拉取的条数，用于分页加载。
 */
export const HISTORY_PAGE_SIZE = 20;
/**
 * 历史列表懒加载的滚动距离阈值（像素）。
 * 当滚动距离不足此值时会尝试加载更多内容。
 */
export const SCROLL_LOAD_THRESHOLD_PX = 72;
