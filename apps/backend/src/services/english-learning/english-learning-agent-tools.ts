import { DynamicTool } from '@langchain/core/tools';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelEnum } from 'src/enum/config.enum';
import { WebSearchService } from '../web-search/web-search.service';
import { KnowledgeQaService } from '../knowledge-qa/knowledge-qa.service';
import type { WebSearchContextResult } from '../web-search/web-search.types';

export type EnglishLearningToolDeps = {
	webSearchService: WebSearchService;
	knowledgeQaService: KnowledgeQaService;
	userId: number;
};

export type EnglishLearningToolEvent = {
	phase: 'start' | 'end';
	name?: string;
	input?: unknown;
	output?: unknown;
};

@Injectable()
export class EnglishLearningAgentTools {
	constructor(
		private readonly configService: ConfigService,
		private readonly webSearchService: WebSearchService,
		private readonly knowledgeQaService: KnowledgeQaService,
	) {}

	private getDeepseekModel(): { apiKey: string; baseURL: string; modelName: string } {
		const apiKey = this.configService.get<string>(ModelEnum.DEEPSEEK_API_KEY);
		const baseURL =
			this.configService.get<string>(ModelEnum.DEEPSEEK_BASE_URL) ||
			'https://api.deepseek.com';
		const modelName =
			this.configService.get<string>(ModelEnum.DEEPSEEK_MODEL_NAME) ||
			'deepseek-chat';
		if (!apiKey?.trim()) {
			throw new Error('DeepSeek API 密钥未配置（DEEPSEEK_API_KEY）');
		}
		return { apiKey: apiKey.trim(), baseURL, modelName };
	}

	createVocabularySearchTool(opts?: {
		onSearchComplete?: (result: WebSearchContextResult) => void;
	}): DynamicTool {
		return new DynamicTool({
			name: 'search_vocabulary_context',
			description:
				'根据英语学习主题搜索相关词汇、短语搭配、领域术语。' +
				'输入：简洁的英文或中文检索关键词（如"business English vocabulary""商务英语词汇"）。' +
				'输出：相关词汇列表、搭配短语、专业术语及其简要说明。' +
				'适用于：扩展词汇方向、获取主题相关术语、核实词义用法。',
			func: async (input: string) => {
				const query = typeof input === 'string' ? input.trim() : String(input ?? '').trim();
				if (!query) {
					return '（查询为空：请传入检索关键词。）';
				}
				try {
					const r = await this.webSearchService.formatSearchContextForPrompt(query, {
						num: 8,
					});
					opts?.onSearchComplete?.(r);
					if (!r.promptText) {
						return '（未找到相关词汇信息）';
					}
					return `【词汇检索结果】\n${r.promptText}`;
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err ?? '未知错误');
					return `词汇检索失败：${msg}`;
				}
			},
		});
	}

	createClassicQuotesSearchTool(opts?: {
		onSearchComplete?: (result: WebSearchContextResult) => void;
	}): DynamicTool {
		return new DynamicTool({
			name: 'search_classic_quotes_context',
			description:
				'根据英语学习主题搜索相关名言警句、经典台词、谚语、演讲金句。' +
				'输入：主题关键词（如"success quotes""成功名言""movie quotes"）。' +
				'输出：经典英文句子、作者/出处、创作背景。' +
				'适用于：获取可引用的经典语句、了解名言出处、扩展语句学习素材。',
			func: async (input: string) => {
				const query = typeof input === 'string' ? input.trim() : String(input ?? '').trim();
				if (!query) {
					return '（查询为空：请传入检索关键词。）';
				}
				try {
					const r = await this.webSearchService.formatSearchContextForPrompt(query, {
						num: 8,
					});
					opts?.onSearchComplete?.(r);
					if (!r.promptText) {
						return '（未找到相关经典语句信息）';
					}
					return `【经典语句检索结果】\n${r.promptText}`;
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err ?? '未知错误');
					return `经典语句检索失败：${msg}`;
				}
			},
		});
	}

	createKnowledgeBaseTool(userId: number): DynamicTool {
		return new DynamicTool({
			name: 'search_user_knowledge_base',
			description:
				'从当前用户已入库的知识库中检索相关内容（笔记、摘录、学习资料）。' +
				'输入：一句检索查询（中文或英文）。' +
				'输出：相关文档分片，包含标题与内容摘要。' +
				'适用于：结合用户已有学习资料、复习个人笔记、获取自定义学习内容。',
			func: async (input: string) => {
				const query = typeof input === 'string' ? input.trim() : String(input ?? '').trim();
				if (!query) {
					return '（查询为空：请传入检索句或关键词。）';
				}
				try {
					const evidences = await this.knowledgeQaService.retrieveEvidencesWithRerank({
						question: query,
						authorId: userId,
						rerankErrorLogTag: 'EnglishLearningAgent',
					});
					if (evidences.length === 0) {
						return '未在知识库中检索到相关内容。请尝试换关键词，或使用互联网搜索工具。';
					}
					return evidences
						.slice(0, 8)
						.map(
							(e, i) =>
								`[#${i + 1}] 标题：${e.title}\n分片序号：${e.chunkIndex}\n${e.text}`,
						)
						.join('\n\n---\n\n');
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err ?? '未知错误');
					return `知识库检索失败：${msg}`;
				}
			},
		});
	}

	createGenerateVocabularyBatchTool(): DynamicTool {
		const { apiKey, baseURL, modelName } = this.getDeepseekModel();
		return new DynamicTool({
			name: 'generate_vocabulary_batch',
			description:
				'生成一批英语单词/短语学习条目（每次最多20条）。' +
				'输入：JSON字符串 {"topic":"主题","level":"难度","count":数量,"context":"检索上下文","excludeWords":"已出现的词(逗号分隔)"}。' +
				'level可选：basic(基础)/intermediate(进阶)/advanced(提高)。' +
				'输出：JSON字符串 {"items":[{"word":"单词","ipa":"音标","translationZh":"中文释义","example":"例句"}]}。' +
				'必须严格输出JSON格式，不要markdown代码块。',
			func: async (input: string) => {
				try {
					const params = JSON.parse(typeof input === 'string' ? input : String(input));
					const { topic, level = 'intermediate', count = 10, context = '', excludeWords = '' } = params;

					const levelHints: Record<string, string> = {
						basic: '基础：高频词、短句搭配，释义偏简明，例句简短',
						intermediate: '进阶：高中～四级难度，可适当短语动词与一词多义，例句贴近真实场景',
						advanced: '提高：六级及以上或雅思托福常见学术/报刊用词，例句可稍长，释义精准',
					};

					const system = `你是英语教学助手。生成英文单词或实用短语（phrase）的学习条目。
每一条必须包含：
- word：英文单词或短语
- ipa：该条目的英式或美式 IPA 音标，使用 Unicode 音标符号（如 ˈæpl）
- translationZh：简明中文释义
- example：一句地道英文例句

【去重规定】
1）同一批 items 内 word 必须互不相同（小写比较）。
2）不得与已出现过的词重复。

只输出一个 JSON 对象，不要 markdown，不要代码围栏。
格式：{"items":[{"word":"","ipa":"","translationZh":"","example":""}]}`;

					const excludeList = excludeWords ? excludeWords.split(',').map((w: string) => w.trim().toLowerCase()).filter(Boolean) : [];
					const excludeHint = excludeList.length > 0
						? `\n以下词已出现过，禁止输出：${excludeList.join(', ')}`
						: '';

					const user = `主题/需求：${topic}
难度说明：${levelHints[level] || levelHints.intermediate}
请恰好生成 ${Math.min(count, 20)} 条 items。${context ? `\n参考上下文：${context}` : ''}${excludeHint}
数组长度必须等于 ${Math.min(count, 20)}。`;

					const response = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${apiKey}`,
						},
						body: JSON.stringify({
							model: modelName,
							messages: [
								{ role: 'system', content: system },
								{ role: 'user', content: user },
							],
							temperature: 0.35,
							max_tokens: 8192,
							response_format: { type: 'json_object' },
						}),
					});

					if (!response.ok) {
						const errText = await response.text();
						throw new Error(`DeepSeek API 失败：${response.status} ${errText}`);
					}

					const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
					const content = data.choices?.[0]?.message?.content ?? '';
					return content;
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err ?? '未知错误');
					return `生成单词失败：${msg}`;
				}
			},
		});
	}

	createGenerateClassicQuotesBatchTool(): DynamicTool {
		const { apiKey, baseURL, modelName } = this.getDeepseekModel();
		return new DynamicTool({
			name: 'generate_classic_quotes_batch',
			description:
				'生成一批英语经典语句、名言警句、谚语（每次最多10条）。' +
				'输入：JSON字符串 {"topic":"主题","level":"难度","count":数量,"context":"检索上下文","excludeQuotes":"已出现的句子(逗号分隔)"}。' +
				'level可选：basic(基础)/intermediate(进阶)/advanced(提高)。' +
				'输出：JSON字符串 {"items":[{"english":"英文原句","translationZh":"中文翻译","source":"出处","noteZh":"赏析"}]}。' +
				'必须严格输出JSON格式，不要markdown代码块。',
			func: async (input: string) => {
				try {
					const params = JSON.parse(typeof input === 'string' ? input : String(input));
					const { topic, level = 'intermediate', count = 10, context = '', excludeQuotes = '' } = params;

					const levelHints: Record<string, string> = {
						basic: '基础：常见谚语、简单名言，适合初中级学习者',
						intermediate: '进阶：名著节选、演讲金句、影视台词，难度适中',
						advanced: '提高：文学经典、哲学名言、学术引用，语言丰富',
					};

					const system = `你是英语教学助手。生成英文经典语句（名言、名著节选、影视台词、演讲金句、谚语）。
每一条必须包含：
- english：英文原句（保持原汁原味标点）
- translationZh：准确、自然的中文翻译
- source：出处（作者、作品、年份）
- noteZh：一句中文赏析或学习要点

【去重规定】
1）同一批 items 内 english 必须互不相同。
2）不得与已出现过的句子相同或实质雷同。

只输出一个 JSON 对象，不要 markdown，不要代码围栏。
格式：{"items":[{"english":"","translationZh":"","source":"","noteZh":""}]}`;

					const excludeList = excludeQuotes ? excludeQuotes.split(',').map((q: string) => q.trim().toLowerCase()).filter(Boolean) : [];
					const excludeHint = excludeList.length > 0
						? `\n以下句子已出现过，禁止输出相同或雷同的：${excludeList.map((q: string) => q.slice(0, 80)).join(' | ')}`
						: '';

					const user = `主题/需求：${topic}
难度说明：${levelHints[level] || levelHints.intermediate}
请恰好生成 ${Math.min(count, 10)} 条 items。${context ? `\n参考上下文：${context}` : ''}${excludeHint}
数组长度必须等于 ${Math.min(count, 10)}。`;

					const response = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${apiKey}`,
						},
						body: JSON.stringify({
							model: modelName,
							messages: [
								{ role: 'system', content: system },
								{ role: 'user', content: user },
							],
							temperature: 0.35,
							max_tokens: 12288,
							response_format: { type: 'json_object' },
						}),
					});

					if (!response.ok) {
						const errText = await response.text();
						throw new Error(`DeepSeek API 失败：${response.status} ${errText}`);
					}

					const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
					const content = data.choices?.[0]?.message?.content ?? '';
					return content;
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err ?? '未知错误');
					return `生成经典语句失败：${msg}`;
				}
			},
		});
	}

	buildAllTools(userId: number, opts?: {
		onSearchComplete?: (result: WebSearchContextResult) => void;
	}): DynamicTool[] {
		return [
			this.createVocabularySearchTool(opts),
			this.createClassicQuotesSearchTool(opts),
			this.createKnowledgeBaseTool(userId),
			this.createGenerateVocabularyBatchTool(),
			this.createGenerateClassicQuotesBatchTool(),
		];
	}
}
