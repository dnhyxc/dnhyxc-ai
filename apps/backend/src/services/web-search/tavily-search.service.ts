import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ModelEnum } from 'src/enum/config.enum';
import { buildWebSearchReferencePromptAppendix } from './search-context-format';
import type {
	WebSearchContextResult,
	WebSearchOrganicItem,
} from './web-search.types';

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

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
			const res = await fetch(TAVILY_SEARCH_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					api_key: apiKey.trim(),
					query: q,
					include_answer: includeAnswer,
					search_depth: searchDepth,
					max_results: maxResults,
					include_favicon: true,
					include_usage: true,
				}),
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
