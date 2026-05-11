import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { createAgent } from 'langchain';
import { ModelEnum } from 'src/enum/config.enum';
import { EnglishLearningAgentTools, type EnglishLearningToolEvent } from './english-learning-agent-tools';
import type { VocabularyItemDto, ClassicQuoteItemDto } from './english-learning.service';

const VOCABULARY_AGENT_SYSTEM_PROMPT = `你是一个智能英语词汇学习助手。你会通过工具调用来完成任务：
1）首先使用 search_vocabulary_context 搜索与主题相关的词汇、短语、术语
2）使用 search_user_knowledge_base 检索用户知识库中的相关笔记
3）使用 generate_vocabulary_batch 工具生成单词条目

任务目标：
- 根据用户指定的主题和难度，生成结构化的英语单词/短语学习列表
- 每条包含：word（单词/短语）、ipa（音标）、translationZh（中文释义）、example（例句）
- 确保词汇多样性：涵盖不同词性、搭配、近义词等
- 严格遵守去重规则，不输出重复词条

工作流程：
1. 接收任务后，先搜索相关上下文（词汇方向、术语）
2. 根据上下文生成第一批词汇（使用 generate_vocabulary_batch，count=15-20）
3. 检查是否有重复，若重复率高则调整方向重新生成
4. 继续生成直到达到目标数量
5. 最终汇总所有词汇并按主题相关性排序

重要约束：
- 每个 generate_vocabulary_batch 调用生成 10-20 条
- 已生成的词不能再次出现
- 优先选择地道、实用的词汇和短语
- 例句要展示真实语境用法`;

const CLASSIC_QUOTES_AGENT_SYSTEM_PROMPT = `你是一个智能英语经典语句学习助手。你会通过工具调用来完成任务：
1）首先使用 search_classic_quotes_context 搜索与主题相关的名言警句、经典台词
2）使用 search_user_knowledge_base 检索用户知识库中的相关摘录
3）使用 generate_classic_quotes_batch 工具生成经典语句条目

任务目标：
- 根据用户指定的主题和难度，生成结构化的英语经典语句学习列表
- 每条包含：english（原句）、translationZh（中文翻译）、source（出处）、noteZh（赏析）
- 确保语句多样性：涵盖不同体裁、时代、作者等
- 严格遵守去重规则，不输出相同或实质雷同的句子

工作流程：
1. 接收任务后，先搜索相关上下文（名言出处、经典台词）
2. 根据上下文生成第一批语句（使用 generate_classic_quotes_batch，count=8-10）
3. 检查是否有重复或雷同，若有则调整方向重新生成
4. 继续生成直到达到目标数量
5. 最终汇总所有语句

重要约束：
- 每个 generate_classic_quotes_batch 调用生成 8-10 条
- 已生成的句子不能再次出现
- 优先选择有代表性、有深度的经典表达
- 出处信息要准确或标注"待查证"`;

const VOCABULARY_USER_TEMPLATE = `请帮我生成英语单词/短语学习列表。

【主题/需求】
{topic}

【难度级别】
{level}

【目标数量】
{targetCount} 个词条

【要求】
1. 涵盖不同词性（名词、动词、形容词、副词等）
2. 包含常见短语搭配
3. 例句要地道、实用
4. 不输出已生成的词（我会提供已出现列表）

请开始搜索相关上下文并生成词汇。`;

const CLASSIC_QUOTES_USER_TEMPLATE = `请帮我生成英语经典语句学习列表。

【主题/需求】
{topic}

【难度级别】
{level}

【目标数量】
{targetCount} 条经典语句

【要求】
1. 涵盖不同体裁（名言、谚语、影视台词、演讲等）
2. 出处信息尽量准确
3. 赏析要简洁、有学习价值
4. 不输出已生成的句子（我会提供已出现列表）

请开始搜索相关上下文并生成经典语句。`;

const LEVEL_HINT: Record<string, string> = {
	basic: '基础：高频词、短句搭配，释义偏简明，例句简短（初中生～日常 survival）',
	intermediate: '进阶：高中～四级难度，可适当短语动词与一词多义，例句贴近真实场景',
	advanced: '提高：六级及以上或雅思托福常见学术/报刊用词，例句可稍长，释义精准',
};

export type EnglishLearningAgentProgress = {
	phase: 'research' | 'generation' | 'done';
	collected: number;
	target: number;
	round: number;
	newItems?: (VocabularyItemDto | ClassicQuoteItemDto)[];
	message?: string;
};

@Injectable()
export class EnglishLearningAgentOrchestrator {
	private readonly logger: LoggerService;

	constructor(
		private readonly configService: ConfigService,
		private readonly englishLearningAgentTools: EnglishLearningAgentTools,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		logger: LoggerService,
	) {
		this.logger = logger;
	}

	private getGlmModel(): { apiKey: string; baseURL: string; modelName: string } {
		const apiKey = this.configService.get<string>(ModelEnum.ZHIPU_API_KEY);
		const baseURL =
			this.configService.get<string>(ModelEnum.ZHIPU_BASE_URL) ||
			'https://open.bigmodel.cn/api/paas/v4';
		const modelName =
			this.configService.get<string>(ModelEnum.ASSISTANT_GLM_MODEL_NAME) ||
			this.configService.get<string>(ModelEnum.ZHIPU_MODEL_NAME) ||
			'glm-4.7';
		if (!apiKey?.trim()) {
			throw new Error('智谱 API 密钥未配置（ZHIPU_API_KEY）');
		}
		return { apiKey: apiKey.trim(), baseURL, modelName };
	}

	private buildAgentModel(maxTokens = 8192, temperature = 0.3): ChatOpenAI {
		const { apiKey, baseURL, modelName } = this.getGlmModel();
		return new ChatOpenAI({
			apiKey,
			modelName,
			streaming: true,
			temperature,
			maxTokens,
			configuration: { baseURL },
			modelKwargs: { thinking: { type: 'disabled' as const } },
		});
	}

	private extractJsonObject(raw: string): unknown {
		const s = raw.trim().replace(/^\uFEFF/, '');
		const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
		const candidate = fence?.[1]?.trim() ?? s;
		const tryParse = (jsonStr: string): unknown => JSON.parse(jsonStr);
		let searchFrom = 0;
		for (let n = 0; n < 16; n++) {
			const idx = candidate.indexOf('{', searchFrom);
			if (idx === -1) break;
			const slice = this.sliceBalancedJson(candidate, idx);
			searchFrom = idx + 1;
			if (!slice) continue;
			try {
				return tryParse(slice);
			} catch {
				try {
					const relaxed = slice.replace(/,\s*([\]}])/g, '$1');
					return tryParse(relaxed);
				} catch {}
			}
		}
		throw new Error('JSON 解析失败');
	}

	private sliceBalancedJson(text: string, start: number): string | null {
		if (start < 0 || start >= text.length || text[start] !== '{') return null;
		let depth = 0;
		let inString = false;
		let escaped = false;
		for (let i = start; i < text.length; i++) {
			const ch = text[i];
			if (escaped) { escaped = false; continue; }
			if (inString) {
				if (ch === '\\') { escaped = true; continue; }
				if (ch === '"') { inString = false; continue; }
				continue;
			}
			if (ch === '"') { inString = true; continue; }
			if (ch === '{') depth++;
			else if (ch === '}') {
				depth--;
				if (depth === 0) return text.slice(start, i + 1);
			}
		}
		return null;
	}

	private extractVocabularyItems(data: unknown): VocabularyItemDto[] {
		if (!data || typeof data !== 'object' || !('items' in data)) return [];
		const items = (data as { items?: unknown }).items;
		if (!Array.isArray(items) || items.length === 0) return [];
		const out: VocabularyItemDto[] = [];
		for (const row of items) {
			if (!row || typeof row !== 'object') continue;
			const r = row as Record<string, unknown>;
			const word = typeof r.word === 'string' ? r.word.trim() : '';
			const ipa = typeof r.ipa === 'string' ? r.ipa.trim() : '';
			const translationZh =
				typeof r.translationZh === 'string' ? r.translationZh.trim()
				: typeof r.translation_zh === 'string' ? r.translation_zh.trim()
				: typeof r.translation === 'string' ? r.translation.trim() : '';
			const example = typeof r.example === 'string' ? r.example.trim() : '';
			if (!word || !ipa) continue;
			out.push({ word, ipa, translationZh: translationZh || '—', example: example || '—' });
		}
		return out;
	}

	private extractClassicQuoteItems(data: unknown): ClassicQuoteItemDto[] {
		if (!data || typeof data !== 'object' || !('items' in data)) return [];
		const items = (data as { items?: unknown }).items;
		if (!Array.isArray(items) || items.length === 0) return [];
		const out: ClassicQuoteItemDto[] = [];
		for (const row of items) {
			if (!row || typeof row !== 'object') continue;
			const r = row as Record<string, unknown>;
			const english = typeof r.english === 'string' ? r.english.trim() : '';
			const translationZh =
				typeof r.translationZh === 'string' ? r.translationZh.trim()
				: typeof r.translation_zh === 'string' ? r.translation_zh.trim() : '';
			const source = typeof r.source === 'string' ? r.source.trim() : '';
			const noteZh =
				typeof r.noteZh === 'string' ? r.noteZh.trim()
				: typeof r.note_zh === 'string' ? r.note_zh.trim() : '';
			if (!english || !translationZh) continue;
			out.push({ english, translationZh, source: source || '—', noteZh: noteZh || '—' });
		}
		return out;
	}

	async runVocabularyAgent(params: {
		topic: string;
		level: string;
		targetCount: number;
		userId: number;
		onProgress?: (p: EnglishLearningAgentProgress) => void | Promise<void>;
		onToolEvent?: (e: EnglishLearningToolEvent) => void | Promise<void>;
	}): Promise<VocabularyItemDto[]> {
		const { topic, level, targetCount, userId, onProgress, onToolEvent } = params;
		const levelText = LEVEL_HINT[level] || LEVEL_HINT.intermediate;
		const accumulated: VocabularyItemDto[] = [];
		const seen = new Set<string>();
		let rounds = 0;
		const maxRounds = Math.min(200, Math.ceil(targetCount / 10) + 50);
		let stall = 0;

		try {
			await Promise.resolve(
				onProgress?.({
					phase: 'research',
					collected: 0,
					target: targetCount,
					round: 0,
					message: '开始搜索相关词汇上下文...',
				}),
			);

			const abortController = new AbortController();
			const timeout = setTimeout(() => abortController.abort(), 180_000);
			const tools = this.englishLearningAgentTools.buildAllTools(userId, {
				onSearchComplete: () => {},
			});
			const model = this.buildAgentModel(8192, 0.3);
			const agent = createAgent({ model, tools, systemPrompt: VOCABULARY_AGENT_SYSTEM_PROMPT });

			const userMessage = VOCABULARY_USER_TEMPLATE
				.replace('{topic}', topic)
				.replace('{level}', levelText)
				.replace('{targetCount}', String(targetCount));

			const eventStream = agent.streamEvents(
				{ messages: [new HumanMessage(userMessage)] },
				{ version: 'v2', signal: abortController.signal },
			);

			for await (const ev of eventStream) {
				if (ev.event === 'on_tool_start' && onToolEvent) {
					await Promise.resolve(
						onToolEvent({
							phase: 'start',
							name: typeof ev.name === 'string' ? ev.name : undefined,
							input: ev.data?.input,
						}),
					);
				} else if (ev.event === 'on_tool_end' && onToolEvent) {
					const output = ev.data?.output;
					if (output && typeof output === 'string') {
						try {
							const parsed = this.extractJsonObject(output);
							if (Array.isArray((parsed as { items?: unknown })?.items)) {
								const items = this.extractVocabularyItems(parsed);
								const newItems: VocabularyItemDto[] = [];
								for (const item of items) {
									const key = item.word.toLowerCase();
									if (seen.has(key)) continue;
									seen.add(key);
									accumulated.push(item);
									newItems.push(item);
									if (accumulated.length >= targetCount) break;
								}
								if (newItems.length > 0) {
									stall = 0;
									await Promise.resolve(
										onProgress?.({
											phase: 'generation',
											collected: accumulated.length,
											target: targetCount,
											round: rounds,
											newItems,
										}),
									);
								}
							}
						} catch {}
					}
					await Promise.resolve(
						onToolEvent({
							phase: 'end',
							name: typeof ev.name === 'string' ? ev.name : undefined,
							output,
						}),
					);
				}
				rounds++;
				if (rounds >= maxRounds || accumulated.length >= targetCount) {
					abortController.abort();
					break;
				}
			}
			clearTimeout(timeout);

			await Promise.resolve(
				onProgress?.({
					phase: 'done',
					collected: accumulated.length,
					target: targetCount,
					round: rounds,
					message: `完成：已生成 ${accumulated.length}/${targetCount} 个词条`,
				}),
			);

			return accumulated.slice(0, targetCount);
		} catch (e: unknown) {
			this.logger.warn('[EnglishLearningAgentOrchestrator] runVocabularyAgent failed', e);
			if (accumulated.length > 0) {
				return accumulated.slice(0, targetCount);
			}
			throw e;
		}
	}

	async runClassicQuotesAgent(params: {
		topic: string;
		level: string;
		targetCount: number;
		userId: number;
		onProgress?: (p: EnglishLearningAgentProgress) => void | Promise<void>;
		onToolEvent?: (e: EnglishLearningToolEvent) => void | Promise<void>;
	}): Promise<ClassicQuoteItemDto[]> {
		const { topic, level, targetCount, userId, onProgress, onToolEvent } = params;
		const levelText = LEVEL_HINT[level] || LEVEL_HINT.intermediate;
		const accumulated: ClassicQuoteItemDto[] = [];
		const seen = new Set<string>();
		let rounds = 0;
		const maxRounds = Math.min(200, Math.ceil(targetCount / 8) + 50);
		let stall = 0;

		try {
			await Promise.resolve(
				onProgress?.({
					phase: 'research',
					collected: 0,
					target: targetCount,
					round: 0,
					message: '开始搜索相关经典语句上下文...',
				}),
			);

			const abortController = new AbortController();
			const timeout = setTimeout(() => abortController.abort(), 180_000);
			const tools = this.englishLearningAgentTools.buildAllTools(userId, {
				onSearchComplete: () => {},
			});
			const model = this.buildAgentModel(12288, 0.35);
			const agent = createAgent({ model, tools, systemPrompt: CLASSIC_QUOTES_AGENT_SYSTEM_PROMPT });

			const userMessage = CLASSIC_QUOTES_USER_TEMPLATE
				.replace('{topic}', topic)
				.replace('{level}', levelText)
				.replace('{targetCount}', String(targetCount));

			const eventStream = agent.streamEvents(
				{ messages: [new HumanMessage(userMessage)] },
				{ version: 'v2', signal: abortController.signal },
			);

			for await (const ev of eventStream) {
				if (ev.event === 'on_tool_start' && onToolEvent) {
					await Promise.resolve(
						onToolEvent({
							phase: 'start',
							name: typeof ev.name === 'string' ? ev.name : undefined,
							input: ev.data?.input,
						}),
					);
				} else if (ev.event === 'on_tool_end' && onToolEvent) {
					const output = ev.data?.output;
					if (output && typeof output === 'string') {
						try {
							const parsed = this.extractJsonObject(output);
							if (Array.isArray((parsed as { items?: unknown })?.items)) {
								const items = this.extractClassicQuoteItems(parsed);
								const newItems: ClassicQuoteItemDto[] = [];
								for (const item of items) {
									const key = item.english.toLowerCase().trim().slice(0, 200);
									if (!key || seen.has(key)) continue;
									seen.add(key);
									accumulated.push(item);
									newItems.push(item);
									if (accumulated.length >= targetCount) break;
								}
								if (newItems.length > 0) {
									stall = 0;
									await Promise.resolve(
										onProgress?.({
											phase: 'generation',
											collected: accumulated.length,
											target: targetCount,
											round: rounds,
											newItems,
										}),
									);
								}
							}
						} catch {}
					}
					await Promise.resolve(
						onToolEvent({
							phase: 'end',
							name: typeof ev.name === 'string' ? ev.name : undefined,
							output,
						}),
					);
				}
				rounds++;
				if (rounds >= maxRounds || accumulated.length >= targetCount) {
					abortController.abort();
					break;
				}
			}
			clearTimeout(timeout);

			await Promise.resolve(
				onProgress?.({
					phase: 'done',
					collected: accumulated.length,
					target: targetCount,
					round: rounds,
					message: `完成：已生成 ${accumulated.length}/${targetCount} 条经典语句`,
				}),
			);

			return accumulated.slice(0, targetCount);
		} catch (e: unknown) {
			this.logger.warn('[EnglishLearningAgentOrchestrator] runClassicQuotesAgent failed', e);
			if (accumulated.length > 0) {
				return accumulated.slice(0, targetCount);
			}
			throw e;
		}
	}
}
