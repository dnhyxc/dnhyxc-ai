import { DynamicTool } from '@langchain/core/tools';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelEnum } from 'src/enum/config.enum';
import { SerperSearchService } from './serper-search.service';
import { TavilySearchService } from './tavily-search.service';
import type {
	WebSearchContextResult,
	WebSearchProvider,
	WebSearchRecencyPreset,
} from './web-search.types';

@Injectable()
export class WebSearchService {
	constructor(
		private readonly configService: ConfigService,
		private readonly serperSearchService: SerperSearchService,
		private readonly tavilySearchService: TavilySearchService,
	) {}

	/**
	 * 解析实际使用的检索后端：请求体优先，其次环境变量 WEB_SEARCH_DEFAULT_PROVIDER，默认 tavily。
	 */
	resolveProvider(override?: WebSearchProvider): WebSearchProvider {
		if (override === 'tavily' || override === 'serper') {
			return override;
		}
		const env = this.configService
			.get<string>(ModelEnum.WEB_SEARCH_DEFAULT_PROVIDER)
			?.trim()
			.toLowerCase();
		if (env === 'serper') {
			return 'serper';
		}
		return 'tavily';
	}

	isProviderConfigured(provider: WebSearchProvider): boolean {
		if (provider === 'tavily') {
			return this.tavilySearchService.isConfigured();
		}
		return this.serperSearchService.isConfigured();
	}

	/**
	 * 统一入口：与 Serper/Tavily 各自实现返回相同结构，供 Chat 注入与落库。
	 */
	async formatSearchContextForPrompt(
		query: string,
		options?: {
			provider?: WebSearchProvider;
			num?: number;
			recency?: WebSearchRecencyPreset;
			/** Tavily：区间起点 YYYY-MM-DD（须与 tavilyEndDate 不同；相同则内部改用 time_range: day） */
			tavilyStartDate?: string;
			/** Tavily：区间终点 YYYY-MM-DD */
			tavilyEndDate?: string;
		},
	): Promise<WebSearchContextResult> {
		const provider = this.resolveProvider(options?.provider);
		if (provider === 'tavily') {
			return this.tavilySearchService.formatSearchContextForPrompt(query, {
				maxResults: options?.num ?? 10,
				recency: options?.recency,
				startDate: options?.tavilyStartDate,
				endDate: options?.tavilyEndDate,
			});
		}
		return this.serperSearchService.formatSearchContextForPrompt(query, {
			num: options?.num,
			recency: options?.recency,
		});
	}

	/**
	 * LangChain Tool：供 Agent / llm.bindTools 使用；执行时走与 Chat 相同的 formatSearchContextForPrompt。
	 */
	createLangChainWebSearchTools(opts?: {
		provider?: WebSearchProvider;
		/** 每次检索完成后回调（含 organic）；`meta.searchQuery` 为模型传入的检索串 */
		onSearchComplete?: (
			result: WebSearchContextResult,
			meta: { searchQuery: string },
		) => void;
		/** 时间收窄策略；未传时与站内其它调用一致，Serper 默认 `qdr:d` */
		recency?: WebSearchRecencyPreset;
		/** Tavily 专用：显式日历区间（YYYY-MM-DD）；与 recency 并存时由 Tavily 层优先使用区间 */
		tavilyStartDate?: string;
		tavilyEndDate?: string;
	}): DynamicTool[] {
		const provider = this.resolveProvider(opts?.provider);
		const recency = opts?.recency;
		const tavilyStartDate = opts?.tavilyStartDate;
		const tavilyEndDate = opts?.tavilyEndDate;
		return [
			new DynamicTool({
				name: 'internet_search',
				description:
					'联网搜索公开网页。输入简洁的检索关键词或问题，返回可引用的网页标题、链接与摘要。' +
					'【调用约束】仅在确有公开网页信息缺口时调用（事实核验、时效、冷门专名/作品、出处线索等）；禁止为「先搜再说」或走流程而例行调用；若常识与知识库已足够则不要调用。',
				func: async (input: string) => {
					const searchQuery =
						typeof input === 'string' ? input : String(input ?? '');
					const r = await this.formatSearchContextForPrompt(searchQuery, {
						provider,
						recency,
						tavilyStartDate,
						tavilyEndDate,
					});
					opts?.onSearchComplete?.(r, { searchQuery });
					return r.promptText ?? '（无检索结果）';
				},
			}),
		];
	}
}
