import { DynamicTool } from '@langchain/core/tools';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelEnum } from 'src/enum/config.enum';
import { SerperSearchService } from './serper-search.service';
import { TavilySearchService } from './tavily-search.service';
import type {
	WebSearchContextResult,
	WebSearchProvider,
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
		options?: { provider?: WebSearchProvider; num?: number },
	): Promise<WebSearchContextResult> {
		const provider = this.resolveProvider(options?.provider);
		if (provider === 'tavily') {
			return this.tavilySearchService.formatSearchContextForPrompt(query, {
				maxResults: options?.num ?? 10,
			});
		}
		return this.serperSearchService.formatSearchContextForPrompt(query, {
			num: options?.num,
		});
	}

	/**
	 * LangChain Tool：供 Agent / llm.bindTools 使用；执行时走与 Chat 相同的 formatSearchContextForPrompt。
	 */
	createLangChainWebSearchTools(opts?: {
		provider?: WebSearchProvider;
	}): DynamicTool[] {
		const provider = this.resolveProvider(opts?.provider);
		return [
			new DynamicTool({
				name: 'internet_search',
				description:
					'联网搜索公开网页。输入简洁的检索关键词或问题，返回可引用的网页标题、链接与摘要。' +
					` 当前检索后端为：${provider}。`,
				func: async (input: string) => {
					const r = await this.formatSearchContextForPrompt(
						typeof input === 'string' ? input : String(input ?? ''),
						{ provider },
					);
					return r.promptText ?? '（无检索结果）';
				},
			}),
		];
	}
}
