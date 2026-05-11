import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import {
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
	Inject,
	Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ModelEnum } from 'src/enum/config.enum';
import { AgentService } from 'src/services/agent/agent.service';
import { In, Repository } from 'typeorm';
import {
	ENGLISH_CLASSIC_QUOTES_GENERATION_MAX,
	ENGLISH_VOCAB_GENERATION_MAX,
	GenerateClassicQuotesDto,
	GenerateVocabularyDto,
} from './dto/generate-vocabulary.dto';
import {
	type EnglishClassicQuoteItemJson,
	EnglishClassicQuotePackBatch,
} from './english-classic-quote.entity';
import {
	EnglishVocabularyPackBatch,
	type EnglishVocabularyPackItemJson,
} from './english-vocabulary.entity';
import { EnglishLearningAgentOrchestrator } from './english-learning-agent-orchestrator';

export type ClassicQuoteItemDto = {
	english: string;
	translationZh: string;
	source: string;
	noteZh: string;
};

export type ClassicQuoteGenerationProgress = {
	collected: number;
	target: number;
	round: number;
	newItems?: ClassicQuoteItemDto[];
};

export type ClassicQuoteHistoryListItem = {
	streamId: string;
	topic: string;
	level: string | null;
	targetCount: number;
	quoteCount: number;
	createdAt: string;
	updatedAt: string;
};

export type VocabularyItemDto = {
	word: string;
	ipa: string;
	translationZh: string;
	example: string;
};

/** 单词包生成进度（供 SSE 与回调） */
export type VocabularyGenerationProgress = {
	collected: number;
	target: number;
	round: number;
	/** 本轮 LLM 解析后新并入总列表的词条（去重后）；无新增时不传 */
	newItems?: VocabularyItemDto[];
};

/** 英语学习拉取：Agent 检索阶段工具事件（经 SSE 透传前端） */
export type EnglishLearningPackAgentToolEvent = {
	phase: 'start' | 'end';
	name?: string;
	input?: unknown;
	output?: unknown;
};

/** 历史列表单项：按 streamId 聚合一次「拉取单词包」会话 */
export type VocabularyHistoryListItem = {
	streamId: string;
	topic: string;
	level: string | null;
	targetCount: number;
	wordCount: number;
	createdAt: string;
	updatedAt: string;
};

const LEVEL_HINT: Record<
	NonNullable<GenerateVocabularyDto['level']>,
	string
> = {
	basic:
		'基础：高频词、短句搭配，释义偏简明，例句简短（初中生～日常 survival）',
	intermediate:
		'进阶：高中～四级难度，可适当短语动词与一词多义，例句贴近真实场景',
	advanced: '提高：六级及以上或雅思托福常见学术/报刊用词，例句可稍长，释义精准',
};

/**
 * 英语学习辅助：调用 DeepSeek（OpenAI 兼容接口）生成结构化单词表（含 IPA、释义、例句）。
 */
@Injectable()
export class EnglishLearningService {
	private readonly logger = new Logger(EnglishLearningService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly agentService: AgentService,
		@InjectRepository(EnglishVocabularyPackBatch)
		private readonly vocabBatchRepo: Repository<EnglishVocabularyPackBatch>,
		@InjectRepository(EnglishClassicQuotePackBatch)
		private readonly classicBatchRepo: Repository<EnglishClassicQuotePackBatch>,
		@Inject(EnglishLearningAgentOrchestrator)
		@Optional()
		private readonly agentOrchestrator?: EnglishLearningAgentOrchestrator,
	) {}

	/**
	 * DeepSeek JSON 模式；maxTokens 按单轮条数由调用方传入，降低长 JSON 被截断导致缺条。
	 */
	private buildVocabLlm(maxTokens: number): ChatOpenAI {
		const apiKey = this.configService.get<string>(ModelEnum.DEEPSEEK_API_KEY);
		const baseURL =
			this.configService.get<string>(ModelEnum.DEEPSEEK_BASE_URL) ||
			'https://api.deepseek.com';
		const modelName =
			this.configService.get<string>(ModelEnum.DEEPSEEK_MODEL_NAME) ||
			'deepseek-chat';
		if (!apiKey?.trim()) {
			throw new HttpException(
				'DeepSeek 未配置（DEEPSEEK_API_KEY），无法生成单词资料',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
		const capped = Math.min(32768, Math.max(4096, Math.floor(maxTokens)));
		return new ChatOpenAI({
			apiKey,
			modelName,
			streaming: false,
			temperature: 0.35,
			maxTokens: capped,
			configuration: { baseURL },
			modelKwargs: {
				response_format: { type: 'json_object' },
			},
		});
	}

	/** 单词：每轮 batch 越大，预留输出 token 越多（IPA+例句 JSON 偏长） */
	private resolveVocabOutputMaxTokens(batch: number): number {
		return Math.min(32768, Math.max(8192, 900 + batch * 420));
	}

	/** 经典句：单条更长，同样 batch 下需要比单词更高的 maxTokens */
	private resolveClassicOutputMaxTokens(batch: number): number {
		return Math.min(32768, Math.max(12288, 1200 + batch * 1500));
	}

	/**
	 * 连续「净增 0 条」轮数熔断：基础随目标增大；剩余缺口越大额外越宽容，减少「差很远就停」。
	 */
	private resolveStallBreakBase(count: number): number {
		return Math.max(14, Math.min(100, 8 + Math.ceil(count / 12)));
	}

	private resolveStallBreakWithGap(count: number, accumulated: number): number {
		const gap = Math.max(0, count - accumulated);
		const bonus = Math.min(120, Math.ceil(gap / 12));
		return Math.min(200, this.resolveStallBreakBase(count) + bonus);
	}

	private resolveMaxRounds(count: number, itemsPerRound: number): number {
		const base = Math.ceil(count / Math.max(1, itemsPerRound)) + 420;
		return Math.min(2200, base);
	}

	/**
	 * 从 start 处的 `{` 起截取配平的 JSON 对象（字符串内的括号不计入深度）。
	 * 避免原先贪婪正则 `\\{[\\s\\S]*\\}` 吞到文末解释文字或截断边界错误。
	 */
	private sliceBalancedJsonObject(text: string, start: number): string | null {
		if (start < 0 || start >= text.length || text[start] !== '{') {
			return null;
		}
		let depth = 0;
		let inString = false;
		let escaped = false;
		for (let i = start; i < text.length; i++) {
			const ch = text[i];
			if (escaped) {
				escaped = false;
				continue;
			}
			if (inString) {
				if (ch === '\\') {
					escaped = true;
					continue;
				}
				if (ch === '"') {
					inString = false;
					continue;
				}
				continue;
			}
			if (ch === '"') {
				inString = true;
				continue;
			}
			if (ch === '{') depth++;
			else if (ch === '}') {
				depth--;
				if (depth === 0) return text.slice(start, i + 1);
			}
		}
		return null;
	}

	private extractJsonObject(raw: string): unknown {
		const s = raw.trim().replace(/^\uFEFF/, '');
		const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
		const candidate = fence?.[1]?.trim() ?? s;

		const tryParse = (jsonStr: string): unknown => JSON.parse(jsonStr);

		let searchFrom = 0;
		const maxBraceAttempts = 16;
		for (let n = 0; n < maxBraceAttempts; n++) {
			const idx = candidate.indexOf('{', searchFrom);
			if (idx === -1) break;
			const slice = this.sliceBalancedJsonObject(candidate, idx);
			searchFrom = idx + 1;
			if (!slice) continue;
			try {
				return tryParse(slice);
			} catch {
				// 模型偶发在数组/对象末尾多一个逗号
				try {
					const relaxed = slice.replace(/,\s*([\]}])/g, '$1');
					return tryParse(relaxed);
				} catch {}
			}
		}

		this.logger.warn(
			`[EnglishLearning] JSON 解析失败，原文前缀（截断）：${candidate.slice(0, 500)}`,
		);
		throw new HttpException(
			candidate.includes('{')
				? '单词资料 JSON 解析失败'
				: '模型返回无法解析为 JSON',
			HttpStatus.BAD_GATEWAY,
		);
	}

	/** 从解析后的 JSON 对象提取词条；结构不对或无效时返回空数组 */
	private extractVocabularyItemsLoose(data: unknown): VocabularyItemDto[] {
		if (!data || typeof data !== 'object' || !('items' in data)) {
			return [];
		}
		const items = (data as { items?: unknown }).items;
		if (!Array.isArray(items) || items.length === 0) {
			return [];
		}
		const out: VocabularyItemDto[] = [];
		for (const row of items) {
			if (!row || typeof row !== 'object') continue;
			const r = row as Record<string, unknown>;
			const word = typeof r.word === 'string' ? r.word.trim() : '';
			const ipa = typeof r.ipa === 'string' ? r.ipa.trim() : '';
			const translationZh =
				typeof r.translationZh === 'string'
					? r.translationZh.trim()
					: typeof r.translation_zh === 'string'
						? r.translation_zh.trim()
						: typeof r.translation === 'string'
							? r.translation.trim()
							: '';
			const example = typeof r.example === 'string' ? r.example.trim() : '';
			if (!word || !ipa) continue;
			out.push({
				word,
				ipa,
				translationZh: translationZh || '—',
				example: example || '—',
			});
		}
		return out;
	}

	private extractClassicQuoteItemsLoose(data: unknown): ClassicQuoteItemDto[] {
		if (!data || typeof data !== 'object' || !('items' in data)) {
			return [];
		}
		const items = (data as { items?: unknown }).items;
		if (!Array.isArray(items) || items.length === 0) {
			return [];
		}
		const out: ClassicQuoteItemDto[] = [];
		for (const row of items) {
			if (!row || typeof row !== 'object') continue;
			const r = row as Record<string, unknown>;
			const english = typeof r.english === 'string' ? r.english.trim() : '';
			const translationZh =
				typeof r.translationZh === 'string'
					? r.translationZh.trim()
					: typeof r.translation_zh === 'string'
						? r.translation_zh.trim()
						: '';
			const source = typeof r.source === 'string' ? r.source.trim() : '';
			const noteZh =
				typeof r.noteZh === 'string'
					? r.noteZh.trim()
					: typeof r.note_zh === 'string'
						? r.note_zh.trim()
						: '';
			if (!english || !translationZh) continue;
			out.push({
				english,
				translationZh,
				source: source || '—',
				noteZh: noteZh || '—',
			});
		}
		return out;
	}

	/**
	 * 将本轮流式生成的新词条写入数据库（每轮 LLM 一批一行）。
	 */
	async saveVocabularyPackBatch(params: {
		userId: number;
		streamId: string;
		round: number;
		topic: string;
		level: string | null;
		targetCount: number;
		items: VocabularyItemDto[];
	}): Promise<void> {
		if (!params.items.length) return;
		const row = this.vocabBatchRepo.create({
			userId: params.userId,
			streamId: params.streamId,
			round: params.round,
			topic: params.topic.trim().slice(0, 500),
			level: params.level,
			targetCount: params.targetCount,
			items: params.items as EnglishVocabularyPackItemJson[],
		});
		await this.vocabBatchRepo.save(row);
	}

	async saveClassicQuotesPackBatch(params: {
		userId: number;
		streamId: string;
		round: number;
		topic: string;
		level: string | null;
		targetCount: number;
		items: ClassicQuoteItemDto[];
	}): Promise<void> {
		if (!params.items.length) return;
		const row = this.classicBatchRepo.create({
			userId: params.userId,
			streamId: params.streamId,
			round: params.round,
			topic: params.topic.trim().slice(0, 500),
			level: params.level,
			targetCount: params.targetCount,
			items: params.items as EnglishClassicQuoteItemJson[],
		});
		await this.classicBatchRepo.save(row);
	}

	/**
	 * 分页列出当前用户曾拉取过的单词包会话（按最近活动时间倒序）。
	 */
	async listVocabularyHistory(
		userId: number,
		options?: { limit?: number; offset?: number },
	): Promise<VocabularyHistoryListItem[]> {
		const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
		const offset = Math.max(0, options?.offset ?? 0);

		const grouped = await this.vocabBatchRepo
			.createQueryBuilder('b')
			.select('b.streamId', 'streamId')
			.addSelect('MIN(b.createdAt)', 'createdAt')
			.addSelect('MAX(b.createdAt)', 'updatedAt')
			.where('b.userId = :userId', { userId })
			.groupBy('b.streamId')
			.orderBy('MAX(b.createdAt)', 'DESC')
			.offset(offset)
			.limit(limit)
			.getRawMany<{
				streamId: string;
				createdAt: Date;
				updatedAt: Date;
			}>();

		if (!grouped.length) return [];

		const streamIds = grouped.map((g) => g.streamId);
		const batches = await this.vocabBatchRepo.find({
			where: { userId, streamId: In(streamIds) },
			order: { streamId: 'ASC', round: 'ASC' },
		});

		const byStream = new Map<string, typeof batches>();
		for (const row of batches) {
			const arr = byStream.get(row.streamId) ?? [];
			arr.push(row);
			byStream.set(row.streamId, arr);
		}

		return grouped.map((g) => {
			const rows = byStream.get(g.streamId) ?? [];
			const first = rows[0];
			let wordCount = 0;
			for (const r of rows) {
				wordCount += Array.isArray(r.items) ? r.items.length : 0;
			}
			return {
				streamId: g.streamId,
				topic: first?.topic ?? '',
				level: first?.level ?? null,
				targetCount: first?.targetCount ?? 0,
				wordCount,
				createdAt: new Date(g.createdAt).toISOString(),
				updatedAt: new Date(g.updatedAt).toISOString(),
			};
		});
	}

	/**
	 * 按 streamId 还原该次拉取的完整单词列表（按轮次顺序拼接各批 items）。
	 */
	async getVocabularyHistoryDetail(
		userId: number,
		streamId: string,
	): Promise<{
		streamId: string;
		topic: string;
		level: string | null;
		targetCount: number;
		items: VocabularyItemDto[];
		createdAt: string;
	}> {
		const batches = await this.vocabBatchRepo.find({
			where: { userId, streamId },
			order: { round: 'ASC' },
		});
		if (!batches.length) {
			throw new NotFoundException('未找到该单词记录');
		}
		const items: VocabularyItemDto[] = [];
		for (const b of batches) {
			if (!Array.isArray(b.items)) continue;
			for (const it of b.items) {
				items.push({
					word: it.word,
					ipa: it.ipa,
					translationZh: it.translationZh || '—',
					example: it.example || '—',
				});
			}
		}
		const first = batches[0];
		return {
			streamId,
			topic: first.topic,
			level: first.level,
			targetCount: first.targetCount,
			items,
			createdAt: first.createdAt.toISOString(),
		};
	}

	async listClassicQuotesHistory(
		userId: number,
		options?: { limit?: number; offset?: number },
	): Promise<ClassicQuoteHistoryListItem[]> {
		const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
		const offset = Math.max(0, options?.offset ?? 0);

		const grouped = await this.classicBatchRepo
			.createQueryBuilder('b')
			.select('b.streamId', 'streamId')
			.addSelect('MIN(b.createdAt)', 'createdAt')
			.addSelect('MAX(b.createdAt)', 'updatedAt')
			.where('b.userId = :userId', { userId })
			.groupBy('b.streamId')
			.orderBy('MAX(b.createdAt)', 'DESC')
			.offset(offset)
			.limit(limit)
			.getRawMany<{
				streamId: string;
				createdAt: Date;
				updatedAt: Date;
			}>();

		if (!grouped.length) return [];

		const streamIds = grouped.map((g) => g.streamId);
		const batches = await this.classicBatchRepo.find({
			where: { userId, streamId: In(streamIds) },
			order: { streamId: 'ASC', round: 'ASC' },
		});

		const byStream = new Map<string, typeof batches>();
		for (const row of batches) {
			const arr = byStream.get(row.streamId) ?? [];
			arr.push(row);
			byStream.set(row.streamId, arr);
		}

		return grouped.map((g) => {
			const rows = byStream.get(g.streamId) ?? [];
			const first = rows[0];
			let quoteCount = 0;
			for (const r of rows) {
				quoteCount += Array.isArray(r.items) ? r.items.length : 0;
			}
			return {
				streamId: g.streamId,
				topic: first?.topic ?? '',
				level: first?.level ?? null,
				targetCount: first?.targetCount ?? 0,
				quoteCount,
				createdAt: new Date(g.createdAt).toISOString(),
				updatedAt: new Date(g.updatedAt).toISOString(),
			};
		});
	}

	async getClassicQuotesHistoryDetail(
		userId: number,
		streamId: string,
	): Promise<{
		streamId: string;
		topic: string;
		level: string | null;
		targetCount: number;
		items: ClassicQuoteItemDto[];
		createdAt: string;
	}> {
		const batches = await this.classicBatchRepo.find({
			where: { userId, streamId },
			order: { round: 'ASC' },
		});
		if (!batches.length) {
			throw new NotFoundException('未找到该经典语句记录');
		}
		const items: ClassicQuoteItemDto[] = [];
		for (const b of batches) {
			if (!Array.isArray(b.items)) continue;
			for (const it of b.items) {
				items.push({
					english: it.english,
					translationZh: it.translationZh || '—',
					source: it.source || '—',
					noteZh: it.noteZh || '—',
				});
			}
		}
		const first = batches[0];
		return {
			streamId,
			topic: first.topic,
			level: first.level,
			targetCount: first.targetCount,
			items,
			createdAt: first.createdAt.toISOString(),
		};
	}

	private async invokeVocabularyLlm(
		llm: ChatOpenAI,
		system: string,
		user: string,
	): Promise<string> {
		const res = await llm.invoke([
			new SystemMessage(system),
			new HumanMessage(user),
		]);
		return typeof res.content === 'string'
			? res.content
			: Array.isArray(res.content)
				? res.content
						.map((p: unknown) =>
							p &&
							typeof p === 'object' &&
							'text' in p &&
							typeof (p as { text?: string }).text === 'string'
								? (p as { text: string }).text
								: '',
						)
						.join('')
				: '';
	}

	/**
	 * 根据主题与档位生成单词列表（每条含 IPA、中文释义、英文例句）。
	 * 数量较大时分批 JSON 请求并去重合并；默认每轮最多 20 条，重复过多时会自适应减小单轮条数。
	 * @param onProgress 每轮合并后触发（含首轮前 round=0 可由调用方自行先发起点）
	 */
	async runVocabularyGeneration(
		dto: GenerateVocabularyDto,
		onProgress?: (p: VocabularyGenerationProgress) => void | Promise<void>,
		context?: {
			userId?: number;
			onAgentTool?: (
				e: EnglishLearningPackAgentToolEvent,
			) => void | Promise<void>;
		},
	): Promise<VocabularyItemDto[]> {
		const count = Math.min(
			ENGLISH_VOCAB_GENERATION_MAX,
			Math.max(1, dto.count ?? 10),
		);
		const level = dto.level ?? 'intermediate';
		const levelText = LEVEL_HINT[level];
		/** 每轮向模型请求的 items 条数上限（重复过多时会自适应下调） */
		const ITEMS_PER_ROUND = 20;
		const maxRounds = this.resolveMaxRounds(count, ITEMS_PER_ROUND);

		const system = `你是英语教学助手。用户会给出「主题/学习需求」与难度。
用户可能分多轮请求；每一轮都会给出该轮必须生成的确切条数，请严格遵守该轮条数（items 数组长度必须等于该数字）。
你必须生成英文单词或实用短语（phrase）的学习条目。
每一条必须包含：
- word：英文单词或短语（不要用序号前缀）
- ipa：该条目的英式或美式 IPA 音标，使用 Unicode 音标符号（如 ˈæpl），放在字符串中
- translationZh：简明中文释义（可与主题相关）
- example：一句地道英文例句，展示该词用法

【去重硬性规定】
1）同一轮输出的 items 数组内：任意两条的 word 在去首尾空格、英文小写归一化后必须互不相同；禁止仅大小写、标点或多余空格不同的「假不同」。
2）若用户消息中列出「已出现过的英文词条」：本轮输出的每一条 word 均不得与该列表中任一项相同（同样按小写归一化比较）；亦不得与前几轮已生成内容相同。
3）禁止用同一 word 重复填多条 items 凑数。

只输出一个 JSON 对象，不要 markdown，不要代码围栏，不要解释文字。
格式严格为：{"items":[{"word":"","ipa":"","translationZh":"","example":""}]}`;

		const topic = dto.topic.trim();

		/** Agent（工具 + GLM）检索要点，拼入 user 提示；失败则空串，逻辑与无 Agent 时一致 */
		let agentResearchAppendix = '';
		if (context?.userId != null) {
			try {
				const raw = await this.agentService.gatherContextForEnglishPackResearch(
					{
						userId: context.userId,
						topic,
						levelHint: levelText,
						kind: 'vocabulary',
						onToolEvent: context.onAgentTool,
					},
				);
				if (raw.trim()) {
					agentResearchAppendix = `\n【检索与知识库要点（供扩展词汇方向，勿逐字照抄为 word）】\n${raw.trim()}`;
				}
			} catch (e: unknown) {
				this.logger.warn('[EnglishLearning] Agent 检索增强跳过（单词）', e);
			}
		}

		try {
			const accumulated: VocabularyItemDto[] = [];
			const seen = new Set<string>();
			let stall = 0;
			let rounds = 0;
			/** 重复过多时下调每轮请求条数，减轻模型「全重复」与 JSON 压力 */
			let batchCap = ITEMS_PER_ROUND;

			while (accumulated.length < count && rounds < maxRounds) {
				rounds++;
				const need = count - accumulated.length;
				const batch = Math.min(batchCap, need);
				const excludeSnippet =
					accumulated.length === 0
						? ''
						: [...seen]
								.slice(-220)
								.map((w) => w.replace(/`/g, "'"))
								.join(', ');

				const diversityHint =
					stall >= 2 && accumulated.length > 0
						? `\n【多样性】请换子角度：同主题下的不同词性、常见搭配、近义辨析词、学科细分小类、短语动词变体等，严禁与已列词条同形或仅大小写差异。`
						: '';

				const userBase =
					accumulated.length === 0
						? `主题/需求：${topic}
难度说明：${levelText}
请恰好生成 ${batch} 条 items（数组长度必须等于 ${batch}）。
要求：本批 items 内每条 word 必须各不相同（小写比较无重复）；禁止输出已在常见教材附录中机械重复的同一词不同写法凑条数。${agentResearchAppendix}`
						: `主题/需求：${topic}（与前几轮相同，请继续围绕该主题扩展）
难度说明：${levelText}
请再生成恰好 ${batch} 条新的 items（数组长度必须等于 ${batch}）。
以下英文词条已出现过，禁止再次输出（不区分大小写；归一化后须与下列全部不同）：${excludeSnippet}
本批 items 内部也不得出现彼此重复的 word。请输出与上述列表完全不同的词或短语。${diversityHint}${agentResearchAppendix}`;

				const newItemsThisRound: VocabularyItemDto[] = [];
				let added = 0;
				let batchItems: VocabularyItemDto[] = [];
				/** 已有累积时允许多次「全重复则加急换一批」再进入 stall，提高凑满概率 */
				const maxDupPasses = accumulated.length === 0 ? 1 : 5;

				for (let dupPass = 0; dupPass < maxDupPasses; dupPass++) {
					const urgency =
						dupPass === 0
							? ''
							: `\n【紧急】上一轮返回的词条全部与已收集列表重复。请换完全不同的词根、子话题、词族、搭配域与词性，仍必须恰好 ${batch} 条 items，且数组内互不重复。`;
					const user = `${userBase}${urgency}`;

					batchItems = [];
					const parseRetries = 3;
					for (let att = 0; att < parseRetries; att++) {
						const maxTok = this.resolveVocabOutputMaxTokens(batch) + att * 2048;
						const llm = this.buildVocabLlm(maxTok);
						try {
							const text = await this.invokeVocabularyLlm(llm, system, user);
							const parsed = this.extractJsonObject(text);
							batchItems = this.extractVocabularyItemsLoose(parsed);
							break;
						} catch (e: unknown) {
							if (accumulated.length === 0 && att === parseRetries - 1) {
								throw e;
							}
							this.logger.warn(
								`[EnglishLearning] vocabulary JSON 解析重试 ${att + 1}/${parseRetries}`,
								e,
							);
						}
					}

					if (batchItems.length > batch) {
						batchItems = batchItems.slice(0, batch);
					}

					if (batchItems.length === 0 && accumulated.length === 0) {
						throw new HttpException(
							'单词资料为空或无法解析为有效词条',
							HttpStatus.BAD_GATEWAY,
						);
					}

					newItemsThisRound.length = 0;
					added = 0;
					for (const item of batchItems) {
						const key = item.word.toLowerCase();
						if (seen.has(key)) continue;
						seen.add(key);
						accumulated.push(item);
						newItemsThisRound.push(item);
						added++;
						if (accumulated.length >= count) break;
					}
					if (added > 0) break;
					if (batchItems.length === 0) break;
				}

				await Promise.resolve(
					onProgress?.({
						collected: accumulated.length,
						target: count,
						round: rounds,
						...(newItemsThisRound.length > 0
							? { newItems: newItemsThisRound }
							: {}),
					}),
				);

				const stallLimit = this.resolveStallBreakWithGap(
					count,
					accumulated.length,
				);
				if (added === 0) {
					stall++;
					if (batchItems.length > 0) {
						batchCap = Math.max(5, batchCap - 3);
					}
					if (stall >= stallLimit) {
						this.logger.warn(
							`[EnglishLearning] vocabulary pack stalled at ${accumulated.length}/${count} (stallLimit=${stallLimit})`,
						);
						break;
					}
				} else {
					stall = 0;
					batchCap = Math.min(ITEMS_PER_ROUND, batchCap + 1);
				}
			}

			if (accumulated.length === 0) {
				throw new HttpException(
					'未得到有效词条（需含 word 与 ipa）',
					HttpStatus.BAD_GATEWAY,
				);
			}

			return accumulated.slice(0, count);
		} catch (e: unknown) {
			if (e instanceof HttpException) throw e;
			this.logger.warn('[EnglishLearning] generateVocabularyPack failed', e);
			throw new HttpException(
				'生成单词资料失败，请稍后重试',
				HttpStatus.BAD_GATEWAY,
			);
		}
	}

	async generateVocabularyPack(
		dto: GenerateVocabularyDto,
		opts?: { userId?: number },
	): Promise<{ items: VocabularyItemDto[] }> {
		const items = await this.runVocabularyGeneration(dto, undefined, opts);
		return { items };
	}

	/**
	 * 经典语句：名言、台词、地道隽语等；分批生成 JSON，结构与单词包类似。
	 */
	async runClassicQuotesGeneration(
		dto: GenerateClassicQuotesDto,
		onProgress?: (p: ClassicQuoteGenerationProgress) => void | Promise<void>,
		context?: {
			userId?: number;
			onAgentTool?: (
				e: EnglishLearningPackAgentToolEvent,
			) => void | Promise<void>;
		},
	): Promise<ClassicQuoteItemDto[]> {
		const count = Math.min(
			ENGLISH_CLASSIC_QUOTES_GENERATION_MAX,
			Math.max(1, dto.count ?? 10),
		);
		const level = dto.level ?? 'intermediate';
		const levelText = LEVEL_HINT[level];
		const ITEMS_PER_ROUND = 10;
		const maxRounds = this.resolveMaxRounds(count, ITEMS_PER_ROUND);

		const system = `你是英语教学助手。用户会给出「主题/学习需求」与难度。
用户可能分多轮请求；每一轮都会给出该轮必须生成的确切条数，请严格遵守该轮条数（items 数组长度必须等于该数字）。
你必须生成英文经典语句（名言、名著节选、影视台词、演讲金句、谚语等地道表达），用于英语学习与赏析。
每一条必须包含：
- english：英文原句（不要用序号前缀；保持原汁原味标点）
- translationZh：准确、自然的中文翻译
- source：出处（作者、作品、年份或语境；不确定可填 "—"）
- noteZh：一句中文赏析、修辞或学习要点（可简短）

【去重硬性规定】
1）同一轮 items 内：任意两条的 english 在去首尾空格、小写归一化后不得相同；不得仅通过增删冠词、逗号或个别虚词制造「假不同」。
2）若用户消息列出已出现过的英文句子（节选）：本轮每条 english 均不得与该列表任一条相同或实质雷同（同句换少量词仍视为雷同）。
3）禁止用同一句 english 重复填多条 items 凑数。

只输出一个 JSON 对象，不要 markdown，不要代码围栏，不要解释文字。
格式严格为：{"items":[{"english":"","translationZh":"","source":"","noteZh":""}]}`;

		const topic = dto.topic.trim();

		let agentResearchAppendix = '';
		if (context?.userId != null) {
			try {
				const raw = await this.agentService.gatherContextForEnglishPackResearch(
					{
						userId: context.userId,
						topic,
						levelHint: levelText,
						kind: 'classic_quotes',
						onToolEvent: context.onAgentTool,
					},
				);
				if (raw.trim()) {
					agentResearchAppendix = `\n【检索与知识库要点（供扩展名言/原句线索，勿逐字照抄为 english）】\n${raw.trim()}`;
				}
			} catch (e: unknown) {
				this.logger.warn('[EnglishLearning] Agent 检索增强跳过（经典句）', e);
			}
		}

		try {
			const accumulated: ClassicQuoteItemDto[] = [];
			const seen = new Set<string>();
			let stall = 0;
			let rounds = 0;
			let batchCap = ITEMS_PER_ROUND;

			while (accumulated.length < count && rounds < maxRounds) {
				rounds++;
				const need = count - accumulated.length;
				const batch = Math.min(batchCap, need);
				const excludeSnippet =
					accumulated.length === 0
						? ''
						: [...seen]
								.slice(-160)
								.map((s) => s.replace(/`/g, "'").slice(0, 120))
								.join(' | ');

				const diversityHint =
					stall >= 2 && accumulated.length > 0
						? `\n【多样性】请换不同作品/时代/体裁/演讲场合；避免仅改写标点或个别词的同一句式变体。`
						: '';

				const userBase =
					accumulated.length === 0
						? `主题/需求：${topic}
难度说明：${levelText}
请恰好生成 ${batch} 条 items（数组长度必须等于 ${batch}）。
要求：本批每条 english 必须各不相同；禁止同一句改标点或微调几个词当作多条。${agentResearchAppendix}`
						: `主题/需求：${topic}（与前几轮相同，请继续围绕该主题扩展）
难度说明：${levelText}
请再生成恰好 ${batch} 条新的 items（数组长度必须等于 ${batch}）。
以下英文句子（节选）已出现过，禁止再次输出相同或实质雷同的句子（含轻微改写）：${excludeSnippet}
本批 items 内部的 english 也不得彼此重复或雷同。${diversityHint}${agentResearchAppendix}`;

				const newItemsThisRound: ClassicQuoteItemDto[] = [];
				let added = 0;
				let batchItems: ClassicQuoteItemDto[] = [];
				const maxDupPasses = accumulated.length === 0 ? 1 : 5;

				for (let dupPass = 0; dupPass < maxDupPasses; dupPass++) {
					const urgency =
						dupPass === 0
							? ''
							: `\n【紧急】上一轮返回的句子全部与已收集列表重复或实质雷同。请换不同作品、时代、人物、体裁与句式，仍必须恰好 ${batch} 条 items，且数组内互不重复。`;
					const user = `${userBase}${urgency}`;

					batchItems = [];
					const parseRetries = 3;
					for (let att = 0; att < parseRetries; att++) {
						const maxTok =
							this.resolveClassicOutputMaxTokens(batch) + att * 3072;
						const llm = this.buildVocabLlm(maxTok);
						try {
							const text = await this.invokeVocabularyLlm(llm, system, user);
							const parsed = this.extractJsonObject(text);
							batchItems = this.extractClassicQuoteItemsLoose(parsed);
							break;
						} catch (e: unknown) {
							if (accumulated.length === 0 && att === parseRetries - 1) {
								throw e;
							}
							this.logger.warn(
								`[EnglishLearning] classic quotes JSON 解析重试 ${att + 1}/${parseRetries}`,
								e,
							);
						}
					}

					if (batchItems.length > batch) {
						batchItems = batchItems.slice(0, batch);
					}

					if (batchItems.length === 0 && accumulated.length === 0) {
						throw new HttpException(
							'经典语句为空或无法解析为有效条目',
							HttpStatus.BAD_GATEWAY,
						);
					}

					newItemsThisRound.length = 0;
					added = 0;
					for (const item of batchItems) {
						const key = item.english.toLowerCase().trim().slice(0, 400);
						if (!key || seen.has(key)) continue;
						seen.add(key);
						accumulated.push(item);
						newItemsThisRound.push(item);
						added++;
						if (accumulated.length >= count) break;
					}
					if (added > 0) break;
					if (batchItems.length === 0) break;
				}

				await Promise.resolve(
					onProgress?.({
						collected: accumulated.length,
						target: count,
						round: rounds,
						...(newItemsThisRound.length > 0
							? { newItems: newItemsThisRound }
							: {}),
					}),
				);

				const stallLimit = this.resolveStallBreakWithGap(
					count,
					accumulated.length,
				);
				if (added === 0) {
					stall++;
					if (batchItems.length > 0) {
						batchCap = Math.max(4, batchCap - 2);
					}
					if (stall >= stallLimit) {
						this.logger.warn(
							`[EnglishLearning] classic quotes stalled at ${accumulated.length}/${count} (stallLimit=${stallLimit})`,
						);
						break;
					}
				} else {
					stall = 0;
					batchCap = Math.min(ITEMS_PER_ROUND, batchCap + 1);
				}
			}

			if (accumulated.length === 0) {
				throw new HttpException(
					'未得到有效经典语句（需含 english 与 translationZh）',
					HttpStatus.BAD_GATEWAY,
				);
			}

			return accumulated.slice(0, count);
		} catch (e: unknown) {
			if (e instanceof HttpException) throw e;
			this.logger.warn('[EnglishLearning] classic quotes generation failed', e);
			throw new HttpException(
				'生成经典语句失败，请稍后重试',
				HttpStatus.BAD_GATEWAY,
			);
		}
	}

	async generateClassicQuotesPack(
		dto: GenerateClassicQuotesDto,
		opts?: { userId?: number },
	): Promise<{ items: ClassicQuoteItemDto[] }> {
		const items = await this.runClassicQuotesGeneration(dto, undefined, opts);
		return { items };
	}

	/**
	 * 使用 LangChain Agent 编排模式生成单词包
	 * 通过 Agent 自动协调搜索、上下文收集和词汇生成
	 */
	async runVocabularyGenerationWithAgent(
		dto: GenerateVocabularyDto,
		onProgress?: (p: VocabularyGenerationProgress) => void | Promise<void>,
		context?: {
			userId?: number;
			onAgentTool?: (e: EnglishLearningPackAgentToolEvent) => void | Promise<void>;
		},
	): Promise<VocabularyItemDto[]> {
		if (!this.agentOrchestrator || !context?.userId) {
			this.logger.warn('[EnglishLearning] Agent orchestrator 不可用，回退到传统模式');
			return this.runVocabularyGeneration(dto, onProgress, context);
		}

		try {
			const items = await this.agentOrchestrator.runVocabularyAgent({
				topic: dto.topic,
				level: dto.level ?? 'intermediate',
				targetCount: Math.min(
					ENGLISH_VOCAB_GENERATION_MAX,
					Math.max(1, dto.count ?? 10),
				),
				userId: context.userId,
				onProgress: (p) => {
					if (onProgress && p.newItems) {
						void Promise.resolve(
							onProgress({
								collected: p.collected,
								target: p.target,
								round: p.round,
								newItems: p.newItems as VocabularyItemDto[],
							}),
						);
					}
				},
				onToolEvent: context.onAgentTool,
			});
			return items;
		} catch (e: unknown) {
			this.logger.warn('[EnglishLearning] Agent 模式生成失败，回退到传统模式', e);
			return this.runVocabularyGeneration(dto, onProgress, context);
		}
	}

	/**
	 * 使用 LangChain Agent 编排模式生成经典语句包
	 */
	async runClassicQuotesGenerationWithAgent(
		dto: GenerateClassicQuotesDto,
		onProgress?: (p: ClassicQuoteGenerationProgress) => void | Promise<void>,
		context?: {
			userId?: number;
			onAgentTool?: (e: EnglishLearningPackAgentToolEvent) => void | Promise<void>;
		},
	): Promise<ClassicQuoteItemDto[]> {
		if (!this.agentOrchestrator || !context?.userId) {
			this.logger.warn('[EnglishLearning] Agent orchestrator 不可用，回退到传统模式');
			return this.runClassicQuotesGeneration(dto, onProgress, context);
		}

		try {
			const items = await this.agentOrchestrator.runClassicQuotesAgent({
				topic: dto.topic,
				level: dto.level ?? 'intermediate',
				targetCount: Math.min(
					ENGLISH_CLASSIC_QUOTES_GENERATION_MAX,
					Math.max(1, dto.count ?? 10),
				),
				userId: context.userId,
				onProgress: (p) => {
					if (onProgress && p.newItems) {
						void Promise.resolve(
							onProgress({
								collected: p.collected,
								target: p.target,
								round: p.round,
								newItems: p.newItems as ClassicQuoteItemDto[],
							}),
						);
					}
				},
				onToolEvent: context.onAgentTool,
			});
			return items;
		} catch (e: unknown) {
			this.logger.warn('[EnglishLearning] Agent 模式生成失败，回退到传统模式', e);
			return this.runClassicQuotesGeneration(dto, onProgress, context);
		}
	}
}
