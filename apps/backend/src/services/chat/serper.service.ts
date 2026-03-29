import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ModelEnum } from 'src/enum/config.enum';

/** Serper 单条网页结果（与 API 返回字段对齐） */
export interface SerperOrganicItem {
	title: string;
	link: string;
	snippet?: string;
}

/** 联网检索结果：供写入提示词、落库与 SSE 推送 */
export interface SerperSearchContextResult {
	/** 拼入系统提示的文本；null 表示本轮不追加检索块（未配置或未检索） */
	promptText: string | null;
	/** Serper organic 热点列表；仅在有有效网页结果时非空 */
	organic: SerperOrganicItem[] | null;
}

/**
 * 官方 Google 网页搜索端点（POST + JSON body + X-API-KEY）。
 * 勿使用 https://api.serper.dev/search，该路径会 404（Cannot POST /search）。
 */
const SERPER_GOOGLE_SEARCH_URL = 'https://google.serper.dev/search';

@Injectable()
export class SerperService {
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
		options?: { num?: number },
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
			const res = await fetch(searchUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-KEY': apiKey.trim(),
				},
				body: JSON.stringify({
					q,
					num: options?.num ?? 8,
				}),
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

			const data = (await res.json()) as { organic?: SerperOrganicItem[] };
			const organic = data.organic;
			if (!organic?.length) {
				return {
					promptText:
						'\n（联网检索未返回有效网页结果，请仅凭既有知识回答。）\n',
					organic: null,
				};
			}

			const blocks = organic.map((item, i) => {
				const snippet = item.snippet ?? '';
				return `${i + 1}. **${item.title}**\n   链接: ${item.link}\n   摘要: ${snippet}`;
			});

			const promptText =
				'\n\n---\n**以下为通过 Serper（Google 搜索结果 SERP）获取的参考资料**，回答时请结合这些内容，必要时标注来源链接或序号；若与用户问题无关可忽略。\n\n' +
				blocks.join('\n\n') +
				'\n---\n';

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
