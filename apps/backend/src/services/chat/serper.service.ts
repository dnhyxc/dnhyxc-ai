import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ModelEnum } from 'src/enum/config.enum';
import { buildWebSearchReferencePromptAppendix } from '../web-search/search-context-format';
import type {
	WebSearchContextResult,
	WebSearchOrganicItem,
} from '../web-search/web-search.types';

/** Serper 单条网页结果（与 API 返回字段对齐，与 WebSearchOrganicItem 同构） */
export type SerperOrganicItem = WebSearchOrganicItem;

/** 联网检索结果：供写入提示词、落库与 SSE 推送 */
export type SerperSearchContextResult = WebSearchContextResult;

/**
 * 官方 Google 网页搜索端点（POST + JSON body + X-API-KEY）。
 * 勿使用 https://api.serper.dev/search，该路径会 404（Cannot POST /search）。
 */
const SERPER_GOOGLE_SEARCH_URL = 'https://google.serper.dev/search';

/** 转义 href 属性中的引号与 &，避免破坏 HTML */
function escapeHrefForDoubleQuotedAttr(url: string): string {
	return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** 与 organic 条目的 URL 比对（trim + 尽力 decodeURIComponent 归一化） */
function urlsMatchForOrganic(dest: string, organicLink: string): boolean {
	const norm = (u: string) => {
		let s = u.trim();
		try {
			s = decodeURIComponent(s);
		} catch {
			// 非法百分号序列时保持原样
		}
		return s;
	};
	return norm(dest) === norm(organicLink);
}

/**
 * 将模型常用的【n】、以及非 Markdown 链接形式的 [n] 转为指向 organic[n-1].link 的 <a>。
 * 与提示词配合使用：即使模型不输出 HTML，前端与落库仍可得可点击引用。
 */
export function applyOrganicCitationAnchors(
	text: string,
	organic: Pick<SerperOrganicItem, 'link'>[],
): string {
	if (!text || !organic?.length) {
		return text;
	}
	const max = organic.length;
	const toAnchor = (idx: number): string | null => {
		if (idx < 1 || idx > max) {
			return null;
		}
		const link = organic[idx - 1]?.link?.trim();
		if (!link) {
			return null;
		}
		return `<a href="${escapeHrefForDoubleQuotedAttr(link)}" data-organic-cite="${idx}" target="_blank" rel="noopener noreferrer" style="cursor: pointer;" class="__md-search-organic__">${idx}</a>`;
	};

	// 模型按提示输出 Markdown [n](url) 时，转为与【n】相同属性的 <a>（href 以 organic 为准，防篡改）
	let out = text.replace(
		/\[(\d+)\]\(\s*(?:<([^>\n]+)>|([^)\n]+))\s*\)/g,
		(full, raw: string, angled?: string, plain?: string) => {
			const i = Number.parseInt(raw, 10);
			if (Number.isNaN(i)) {
				return full;
			}
			const destRaw = (angled ?? plain ?? '').trim();
			if (!destRaw) {
				return full;
			}
			const expected = organic[i - 1]?.link?.trim();
			if (!expected || !urlsMatchForOrganic(destRaw, expected)) {
				return full;
			}
			return toAnchor(i) ?? full;
		},
	);

	out = out.replace(/【(\d+)】/g, (full, raw: string) => {
		const i = Number.parseInt(raw, 10);
		if (Number.isNaN(i)) {
			return full;
		}
		return toAnchor(i) ?? full;
	});
	// 排除 Markdown 链接 [text](url) 中的 [数字]
	out = out.replace(/\[(\d+)\](?!\()/g, (full, raw: string) => {
		const i = Number.parseInt(raw, 10);
		if (Number.isNaN(i)) {
			return full;
		}
		return toAnchor(i) ?? full;
	});
	return out;
}

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
					hl: 'zh-cn',
					tbs: 'qdr:d',
					num: options?.num ?? 10,
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
