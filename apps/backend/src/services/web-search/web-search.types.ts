/** 单条网页结果（与 Serper organic / Tavily results 对齐，供提示词与落库） */
export interface WebSearchOrganicItem {
	title: string;
	link: string;
	snippet?: string;
	/** 站点 favicon（favicon，站点图标）URL，主要由 Tavily include_favicon 提供 */
	icon?: string;
	/** 可选发布日期文案（上游若有则透传） */
	date?: string;
	/** 1-based 序号，推送前端 / 抽屉列表用 */
	position?: number;
}

/** 历史命名：与 Serper organic / 落库 searchOrganic 一致，形状同 WebSearchOrganicItem */
export type SerperOrganicItem = WebSearchOrganicItem;

/** 联网检索结果：供写入提示词、落库与 SSE 推送 */
export interface WebSearchContextResult {
	/** 拼入系统提示的文本；null 表示本轮不追加检索块（未配置或未检索） */
	promptText: string | null;
	/** 热点列表；仅在有有效网页结果时非空 */
	organic: WebSearchOrganicItem[] | null;
}

/** 历史命名：同 WebSearchContextResult */
export type SerperSearchContextResult = WebSearchContextResult;

/** 联网检索后端实现（默认 Tavily） */
export type WebSearchProvider = 'tavily' | 'serper';

/**
 * Serper `tbs`（时间范围）与 Tavily `time_range` 的统一预设。
 * - `default`：未显式指定时的兼容行为（Serper 仍带 `qdr:d`，与历史实现一致）。
 * - `none`：不按时间收窄（Serper 不传 `tbs`；Tavily 不传 `time_range`），适合典籍、考试词表等。
 * - 其余：Serper 映射到 Google `qdr:*`；Tavily 统一用 `time_range`（含 `day`）。显式日历区间用 `start_date`/`end_date` 时二者须不同，否则服务端 400。
 */
export type WebSearchRecencyPreset =
	| 'default'
	| 'none'
	| 'day'
	| 'week'
	| 'month'
	| 'year';
