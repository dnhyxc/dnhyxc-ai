/** 复习进度更新后通知首页侧栏刷新待复习数量 */
export const ENGLISH_REVIEW_SUMMARY_REFRESH =
	'english-learning-review-summary-refresh';

export function dispatchEnglishReviewSummaryRefresh(): void {
	window.dispatchEvent(new CustomEvent(ENGLISH_REVIEW_SUMMARY_REFRESH));
}
