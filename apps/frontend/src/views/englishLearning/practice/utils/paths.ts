/**
 * 练习页路由与链接构造
 *
 * 功能：定义练习页路径常量 ENGLISH_PRACTICE_PATH，
 * 以及 englishPracticeUrl / buildEnglishPracticeSearchParams，
 * 供收藏页、资源库、词包结果页等入口跳转到 /english-learning/practice 并带上 source 等参数。
 */
import type { BuildEnglishPracticeSearchParamsInput } from '../types';

export const ENGLISH_PRACTICE_PATH = '/english-learning/practice';

export function parsePracticePoolTotal(raw: string | null): number | undefined {
	if (!raw) return undefined;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * 构建英语练习页 query string 参数
 * @param input 包含 source（来源，必填）、mode（模式，可选）、libraryId（词库ID，可选）、streamId（流ID，可选）
 * @returns 用于 URLSearchParams 的字符串，如 source=xxx&mode=yyy
 *
 * - source: 标识入口来源，例如来源于“词包详情”、“收藏夹”等（必需）
 * - mode: 练习模式，可指定单词、听写等（可选）
 * - libraryId: 词库ID，部分入口跳转到特定词库练习时使用（可选）
 * - streamId: 流ID，部分自定义流或资源推荐场景带入（可选）
 */
export function buildEnglishPracticeSearchParams(
	input: BuildEnglishPracticeSearchParamsInput,
): string {
	const params = new URLSearchParams();
	// 必填参数：source
	params.set('source', input.source);

	// 可选参数：mode
	if (input.mode) params.set('mode', input.mode);

	// 可选参数：libraryId，去除首尾空格后再判断
	if (input.libraryId?.trim()) params.set('libraryId', input.libraryId.trim());

	// 可选参数：streamId，去除首尾空格后再判断
	if (input.streamId?.trim()) params.set('streamId', input.streamId.trim());

	if (input.sourceTitle?.trim()) {
		params.set('sourceTitle', input.sourceTitle.trim());
	}

	if (input.poolTotal != null && input.poolTotal > 0) {
		params.set('poolTotal', String(Math.floor(input.poolTotal)));
	}

	if (input.returnStreamId?.trim()) {
		params.set('returnStreamId', input.returnStreamId.trim());
	}

	if (input.returnTo === 'home') {
		params.set('returnTo', 'home');
	}

	// 转成查询字符串返回
	return params.toString();
}

/**
 * 根据输入参数拼接完整的英语练习页跳转链接
 * @param input 与 buildEnglishPracticeSearchParams 相同
 * @returns 例如 /english-learning/practice?source=xxx&mode=yyy
 *
 * 用于页面跳转、锚点或按钮等场景
 */
export function englishPracticeUrl(
	input: BuildEnglishPracticeSearchParamsInput,
): string {
	const q = buildEnglishPracticeSearchParams(input);
	return `${ENGLISH_PRACTICE_PATH}?${q}`;
}
