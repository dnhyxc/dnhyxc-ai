import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ModelEnum } from 'src/enum/config.enum';
import { buildWebSearchReferencePromptAppendix } from './search-context-format';
import type {
	WebSearchContextResult,
	WebSearchOrganicItem,
	WebSearchRecencyPreset,
} from './web-search.types';

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

/** Tavily REST 要求 YYYY-MM-DD；与 @tavily/core 的 startDate/endDate 字符串格式一致 */
const TAVILY_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isTavilyIsoDateString(s: string): boolean {
	return TAVILY_ISO_DATE.test(s.trim());
}

/**
 * 将预设映射为 Tavily `time_range`。
 * 说明：`day` 必须用 `time_range: 'day'`——API 要求 `start_date` 与 `end_date` 不能为同一天（否则会 400）。
 * @see https://docs.tavily.com/documentation/api-reference/endpoint/search
 */
function tavilyTimeRangeFromRecency(
	recency?: WebSearchRecencyPreset,
): 'day' | 'week' | 'month' | 'year' | undefined {
	if (recency == null || recency === 'default' || recency === 'none') {
		return undefined;
	}
	const map: Record<
		Exclude<WebSearchRecencyPreset, 'default' | 'none'>,
		'day' | 'week' | 'month' | 'year'
	> = {
		day: 'day',
		week: 'week',
		month: 'month',
		year: 'year',
	};
	return map[recency];
}

/**
 * 写入 Tavily 请求体的时间条件：
 * - 显式 `start_date`/`end_date`：仅当起止不同且为合法 YYYY-MM-DD；若相同则退化为 `time_range: 'day'`（避免 400）。
 * - 否则按 `recency` 写 `time_range`（含 `day`）。
 * REST 为 snake_case；SDK 为 camelCase。
 */
function applyTavilyTimeFiltersToBody(
	body: Record<string, unknown>,
	opts: {
		recency?: WebSearchRecencyPreset;
		startDate?: string;
		endDate?: string;
	},
): void {
	const start = opts.startDate?.trim();
	const end = opts.endDate?.trim();
	if (
		start &&
		end &&
		isTavilyIsoDateString(start) &&
		isTavilyIsoDateString(end)
	) {
		// 说明：Tavily 返回 400「start_date and end_date cannot be the same」
		if (start === end) {
			body.time_range = 'day';
			return;
		}
		body.start_date = start;
		body.end_date = end;
		return;
	}
	const timeRange = tavilyTimeRangeFromRecency(opts.recency);
	if (timeRange != null) {
		body.time_range = timeRange;
	}
}

/** Tavily API 单条 result（仅解析用到的字段） */
interface TavilyResultItem {
	title?: string;
	url?: string;
	content?: string;
	favicon?: string;
}

interface TavilySearchResponse {
	results?: TavilyResultItem[];
	answer?: string;
}

@Injectable()
export class TavilySearchService {
	constructor(
		private readonly configService: ConfigService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {}

	isConfigured(): boolean {
		return !!this.configService.get<string>(ModelEnum.TAVILY_API_KEY)?.trim();
	}

	/**
	 * 调用 Tavily Search API，将结果格式化为与 Serper 路径一致的 prompt + organic。
	 * @see https://docs.tavily.com/
	 */
	async formatSearchContextForPrompt(
		query: string,
		options?: {
			maxResults?: number;
			searchDepth?: 'basic' | 'advanced';
			includeAnswer?: boolean | 'basic' | 'advanced';
			recency?: WebSearchRecencyPreset;
			/**
			 * 与 `@tavily/core` 的 `startDate`/`endDate` 对应（REST：`start_date`/`end_date`）。
			 * 须为 `YYYY-MM-DD`；**起止不能为同一天**（否则 Tavily 400）；若相同则本实现改为使用 `time_range: 'day'`。
			 * 若与 `recency` 同时存在，本字段优先。
			 */
			startDate?: string;
			endDate?: string;
		},
	): Promise<WebSearchContextResult> {
		const apiKey = this.configService.get<string>(ModelEnum.TAVILY_API_KEY);
		if (!apiKey?.trim()) {
			this.logger.warn?.('[Tavily] TAVILY_API_KEY 未配置，跳过联网搜索');
			return { promptText: null, organic: null };
		}

		const q = query?.trim();
		if (!q) {
			return { promptText: null, organic: null };
		}

		const maxResults = options?.maxResults ?? 10;
		const searchDepth = options?.searchDepth ?? 'advanced';
		const includeAnswer = options?.includeAnswer ?? 'advanced';

		try {
			const body: Record<string, unknown> = {
				api_key: apiKey.trim(),
				query: q,
				include_answer: includeAnswer,
				search_depth: searchDepth,
				max_results: maxResults,
				include_favicon: true,
				include_usage: true,
			};
			applyTavilyTimeFiltersToBody(body, {
				recency: options?.recency,
				startDate: options?.startDate,
				endDate: options?.endDate,
			});

			const res = await fetch(TAVILY_SEARCH_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			if (!res.ok) {
				const text = await res.text();
				this.logger.error?.(
					`[Tavily] 请求失败 ${res.status}: ${text?.slice(0, 500)}`,
				);
				return {
					promptText: '\n（联网检索请求失败，请仅凭既有知识回答。）\n',
					organic: null,
				};
			}

			const data = (await res.json()) as TavilySearchResponse;
			const raw = data.results ?? [];
			const organic: WebSearchOrganicItem[] = raw
				.map((r) => ({
					title: (r.title ?? '').trim() || '无标题',
					link: (r.url ?? '').trim(),
					snippet: r.content?.trim(),
					icon: r.favicon?.trim() || undefined,
				}))
				.filter((r) => r.link.length > 0);

			if (!organic.length) {
				return {
					promptText:
						'\n（联网检索未返回有效网页结果，请仅凭既有知识回答。）\n',
					organic: null,
				};
			}

			const answerBlock =
				typeof data.answer === 'string' && data.answer.trim()
					? `**检索摘要（由 Tavily 生成，仅供参考）**：\n${data.answer.trim()}`
					: null;

			const promptText = buildWebSearchReferencePromptAppendix(
				'Tavily 聚合检索',
				organic,
				answerBlock,
			);

			return { promptText, organic };
		} catch (err) {
			this.logger.error?.(`[Tavily] 调用异常: ${String(err)}`);
			return {
				promptText: '\n（联网检索过程异常，请仅凭既有知识回答。）\n',
				organic: null,
			};
		}
	}
}
