import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ModelEnum } from 'src/enum/config.enum';
import { buildWebSearchReferencePromptAppendix } from './search-context-format';
import type {
	SerperSearchContextResult,
	WebSearchOrganicItem,
	WebSearchRecencyPreset,
} from './web-search.types';

/**
 * 官方 Google 网页搜索端点（POST + JSON body + X-API-KEY）。
 * 勿使用 https://api.serper.dev/search，该路径会 404（Cannot POST /search）。
 */
const SERPER_GOOGLE_SEARCH_URL = 'https://google.serper.dev/search';

/** Serper Google `tbs` 时间过滤参数；`null` 表示请求体中不传该字段 */
function serperTbsFromRecency(
	recency?: WebSearchRecencyPreset,
): string | null | undefined {
	if (recency == null || recency === 'default') {
		return 'qdr:d';
	}
	if (recency === 'none') {
		return null;
	}
	const map: Record<
		Exclude<WebSearchRecencyPreset, 'default' | 'none'>,
		string
	> = {
		day: 'qdr:d',
		week: 'qdr:w',
		month: 'qdr:m',
		year: 'qdr:y',
	};
	return map[recency];
}

@Injectable()
export class SerperSearchService {
	constructor(
		private readonly configService: ConfigService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {}

	isConfigured(): boolean {
		return !!this.configService.get<string>(ModelEnum.SERPER_API_KEY)?.trim();
	}

	/**
	 * 调用 Serper Google Search API，将结果格式化为可供模型阅读的文本，并返回 organic 供落库与 SSE。
	 * @see https://serper.dev/
	 */
	async formatSearchContextForPrompt(
		query: string,
		options?: { num?: number; recency?: WebSearchRecencyPreset },
	): Promise<SerperSearchContextResult> {
		const apiKey = this.configService.get<string>(ModelEnum.SERPER_API_KEY);
		const configuredUrl = this.configService.get<string>(
			ModelEnum.SERPER_SEARCH_URL,
		);
		const searchUrl = configuredUrl || SERPER_GOOGLE_SEARCH_URL;
		if (!apiKey?.trim()) {
			this.logger.warn?.('[Serper] SERPER_API_KEY 未配置，跳过联网搜索');
			return { promptText: null, organic: null };
		}

		const q = query?.trim();
		if (!q) {
			return { promptText: null, organic: null };
		}

		try {
			const tbs = serperTbsFromRecency(options?.recency);
			const body: Record<string, unknown> = {
				q,
				hl: 'zh-cn',
				num: options?.num ?? 10,
			};
			if (tbs != null) {
				body.tbs = tbs;
			}

			const res = await fetch(searchUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-KEY': apiKey.trim(),
				},
				body: JSON.stringify(body),
			});

			if (!res.ok) {
				const text = await res.text();
				this.logger.error?.(
					`[Serper] 请求失败 ${res.status}: ${text?.slice(0, 500)}`,
				);
				return {
					promptText: '\n（联网检索请求失败，请仅凭既有知识回答。）\n',
					organic: null,
				};
			}

			const data = (await res.json()) as { organic?: WebSearchOrganicItem[] };
			const organic = data.organic;
			if (!organic?.length) {
				return {
					promptText:
						'\n（联网检索未返回有效网页结果，请仅凭既有知识回答。）\n',
					organic: null,
				};
			}

			const promptText = buildWebSearchReferencePromptAppendix(
				'Serper（Google 搜索结果 SERP，即搜索引擎结果页）',
				organic,
			);

			return { promptText, organic };
		} catch (err) {
			this.logger.error?.(`[Serper] 调用异常: ${String(err)}`);
			return {
				promptText: '\n（联网检索过程异常，请仅凭既有知识回答。）\n',
				organic: null,
			};
		}
	}
}
