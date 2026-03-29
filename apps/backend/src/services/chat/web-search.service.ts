import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelEnum } from 'src/enum/config.enum';

/** 单条检索结果（供前端展示与注入上下文） */
export interface WebSearchResultItem {
	title: string;
	link: string;
	snippet: string;
}

/** Serper.dev 返回体中的 organic 项（字段名与 API 一致） */
interface SerperOrganicItem {
	title?: string;
	link?: string;
	snippet?: string;
}

interface SerperSearchResponse {
	organic?: SerperOrganicItem[];
}

@Injectable()
export class WebSearchService {
	constructor(private readonly configService: ConfigService) {}

	/**
	 * 使用 Serper（Google 搜索聚合）执行联网检索。
	 * 未配置 SERPER_API_KEY 时抛出，由上层决定是否降级。
	 */
	async search(
		query: string,
		num = 8,
	): Promise<{
		items: WebSearchResultItem[];
		contextText: string;
	}> {
		const trimmed = query?.trim() ?? '';
		if (trimmed.length < 2) {
			return { items: [], contextText: '' };
		}

		const apiKey = this.configService.get<string>(ModelEnum.SERPER_API_KEY);
		if (!apiKey) {
			throw new Error('SERPER_API_KEY 未配置，无法使用联网搜索');
		}

		const q = trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;

		const res = await fetch('https://google.serper.dev/search', {
			method: 'POST',
			headers: {
				'X-API-KEY': apiKey,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ q, num }),
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Serper 请求失败：${res.status} ${text}`);
		}

		const data = (await res.json()) as SerperSearchResponse;
		const organic = data.organic ?? [];

		const items: WebSearchResultItem[] = organic
			.slice(0, num)
			.map((r) => ({
				title: r.title ?? '',
				link: r.link ?? '',
				snippet: r.snippet ?? '',
			}))
			.filter((r) => r.title || r.snippet);

		const contextText =
			items.length === 0
				? '（本次检索未返回有效摘要，请依据自身知识回答。）'
				: items
						.map(
							(r, i) =>
								`[${i + 1}] ${r.title}\n链接：${r.link}\n摘要：${r.snippet}`,
						)
						.join('\n\n');

		return { items, contextText };
	}
}
