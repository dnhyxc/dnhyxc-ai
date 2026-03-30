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

/** 转义 href 属性中的引号与 &，避免破坏 HTML */
function escapeHrefForDoubleQuotedAttr(url: string): string {
	return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Markdown 链接 destination：含空白、尖括号或圆括号时用尖括号包裹并转义 <>，避免破坏解析 */
function wrapMarkdownLinkDestination(url: string): string {
	const t = url.trim();
	if (!t) {
		return t;
	}
	if (/[\s<>()]/.test(t)) {
		return `<${t.replace(/</g, '%3C').replace(/>/g, '%3E')}>`;
	}
	return t;
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
				const n = i + 1;
				const mdDest = wrapMarkdownLinkDestination(item.link);
				// 每条给出可复制 Markdown 引用示例；落库前由 applyOrganicCitationAnchors 转为带 class 等属性的 <a>
				return `${n}. **${item.title}**\n   URL: ${item.link}\n   摘要: ${snippet}\n   引用示例（正文须使用此 Markdown 链接形式）: [${n}](${mdDest})`;
			});

			const promptText =
				'\n\n---\n**以下为通过 Serper（Google 搜索结果 SERP，即搜索引擎结果页）获取的参考资料**。回答时请结合这些内容；与问题无关的可忽略。\n\n' +
				'**引用格式（须严格遵守）**：\n' +
				'1. 引用第 n 条资料时，**必须**使用 **Markdown 链接** `[n](URL)`，其中 URL 与对应条目的「URL:」行**逐字符一致**（含特殊字符时与「引用示例」相同，可能为尖括号包裹 `<...>`）。\n' +
				'2. **禁止**只写半角方括号序号如 `[n]`（后接句号、空格或句末等），也禁止写脚注式上标；那不是有效 Markdown 链接，引用会失效。\n' +
				'3. 或使用全角序号 **【n】**。\n' +
				'系统会将合规引用转为带 `target="_blank"`、`rel="noopener noreferrer"`、`data-organic-cite`、`style="cursor: pointer;"`、`class="__md-search-organic__"` 的可点击样式。\n\n' +
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
