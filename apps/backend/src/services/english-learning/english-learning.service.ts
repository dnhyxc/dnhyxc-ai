import {
	AIMessage,
	type AIMessageChunk,
	type BaseMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import {
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createAgent, toolCallLimitMiddleware } from 'langchain';
import { In, Repository } from 'typeorm';
import { KnowledgeQaEnum, ModelEnum } from '../../enum/config.enum';
import { buildAgentLangChainTools } from '../../services/agent/agent-tools';
import { KnowledgeQaService } from '../../services/knowledge-qa/knowledge-qa.service';
import { WebSearchService } from '../../services/web-search/web-search.service';
import type {
	WebSearchOrganicItem,
	WebSearchRecencyPreset,
} from '../../services/web-search/web-search.types';
import {
	englishPackAgentIsUserAbort,
	extractEnglishPackAgentChunkText,
	isJsonStringClosingQuoteAt,
	repairJsonUnescapedInteriorQuotes,
} from '../../utils/english-pack';
import {
	ENGLISH_PACK_MASTER_APPENDIX_CHAR_CAP,
	ENGLISH_PACK_MASTER_STREAM_CHAR_FUSE,
	ENGLISH_PACK_WEB_SEARCH_RECENCY_HEURISTIC_RULES,
	ENGLISH_PACK_WEB_SEARCH_RECENCY_NEWS_EN_RE,
	ENGLISH_PACK_WEB_SEARCH_RECENCY_NEWS_FLAVOR_RE,
	PACK_AGENT_THREAD_MAX_MESSAGES,
	TOPIC_PACK_EXCLUDE_CLASSIC_ITEM_MAX_CHARS,
	TOPIC_PACK_EXCLUDE_CLASSIC_TAIL_ITEMS,
	TOPIC_PACK_EXCLUDE_PROMPT_MAX_CHARS,
	TOPIC_PACK_EXCLUDE_TAIL,
	TOPIC_PACK_ITEMS_PER_ROUND,
	TOPIC_PACK_STALL_BATCH_FLOOR,
	TOPIC_PACK_STALL_BATCH_STEP,
} from './constant';
import {
	GenerateClassicQuotesDto,
	GenerateVocabularyDto,
	resolveClassicQuotesPackTargetCount,
	resolveVocabularyPackTargetCount,
} from './dto/generate-vocabulary.dto';
import {
	type EnglishClassicQuoteItemJson,
	EnglishClassicQuotePackBatch,
} from './english-classic-quote.entity';
import {
	EnglishPackWebSearchRecord,
	type EnglishPackWebSearchRoundJson,
} from './english-pack-web-search.entity';
import {
	EnglishVocabularyPackBatch,
	type EnglishVocabularyPackItemJson,
} from './english-vocabulary.entity';
import {
	AGENT_SYSTEM_PROMPT,
	CLASSIC_QUOTES_SUBMODEL_SYSTEM_STATIC,
	ENGLISH_PACK_LEARNER_CONTEXT_HINT,
	VOCABULARY_PACK_SUBMODEL_SYSTEM_STATIC,
} from './prompt';

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
	targetCount: number;
	quoteCount: number;
	createdAt: string;
	updatedAt: string;
	/** 本会话已落库的联网检索轮数（0 表示无主检索网页记录） */
	webSearchRoundCount: number;
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
	/** `organic`：主检索 `internet_search` 完成后的网页列表，供前端胶囊/抽屉展示 */
	phase: 'start' | 'end' | 'organic';
	name?: string;
	input?: unknown;
	output?: unknown;
	searchOrganic?: WebSearchOrganicItem[] | null;
	/** `organic` 阶段：模型传入的检索关键词原文（用于落库与 SSE 摘要） */
	searchQuery?: string | null;
};

/** 历史列表单项：按 streamId 聚合一次「拉取单词包」会话 */
export type VocabularyHistoryListItem = {
	streamId: string;
	topic: string;
	targetCount: number;
	wordCount: number;
	createdAt: string;
	updatedAt: string;
	/** 本会话已落库的联网检索轮数（0 表示无主检索网页记录） */
	webSearchRoundCount: number;
};

/**
 * 单词包子模型 system 固定段（不含用户主题与学习语境常量）。
 * 每轮另在末尾追加「【本轮生成要求】」；主题与语境在首次拼接时写入「【当前学习任务】」块。
 */
// const VOCABULARY_PACK_SUBMODEL_SYSTEM_STATIC = `你是英语教学助手。主题与学习语境见文末「【当前学习任务】」（整场不变）；可能分多轮请求。每一轮的条数、已出现词条节选、多样性说明均以当次 system 末尾「【本轮生成要求】」为准；请严格遵守 items 数组长度，并遵守去重规定。
// 你必须生成英文单词或实用短语（phrase）的学习条目。
// 每一条必须包含：
// - word：英文单词或短语（不要用序号前缀）
// - ipa：该条目的英式或美式 IPA 音标，使用 Unicode 音标符号（如 ˈæpl），放在字符串中
// - translationZh：简明中文释义（可与主题相关）
// - example：一句地道英文例句，展示该词用法

// 【多轮与线程】
// 每轮任务与条数在 system「本轮生成要求」中；user 可无正文（无检索附录时），有检索要点时 Human 仅携带附录。历史约束还来自对话中各条 AI「【上轮已产出】」快照里的 words。去重须同时遵守本 system 末尾「本轮生成要求」、上述快照，以及「节选未列出但已收录的词条同样禁止」。对话须保持 human/ai 交替；不得忽略任一快照中的 words。

// 【去重硬性规定】
// 1）同一轮输出的 items 数组内：任意两条的 word 在去首尾空格、英文小写归一化后必须互不相同；禁止仅大小写、标点或多余空格不同的「假不同」；禁止输出已在常见教材附录中机械重复的同一词不同写法凑条数。
// 2）若「本轮生成要求」中列出「已出现过的英文词条」节选：每条 word 均不得与该列表任一项相同（小写归一化比较），亦不得与前几轮已生成内容相同。
// 3）禁止用同一 word 重复填多条 items 凑数。
// 4）各轮之间：不得输出与此前任一条 AI「【上轮已产出】」快照中的 words 实质相同的一批词（含仅调换顺序、删改少数词或个别同义替换后的「假新」）。

// 【JSON 语法】所有字符串字段内禁止出现未转义的英文半角双引号 "；术语或引号请用中文直角引号「」或半角单引号 '；违者会导致解析失败。

// 只输出一个 JSON 对象，不要 markdown，不要代码围栏，不要解释文字。
// 格式严格为：{"items":[{"word":"","ipa":"","translationZh":"","example":""}]}

// 【当前学习任务】
// 主题/需求：`;

/**
 * 经典句子模型 system 固定段（不含用户主题与学习语境常量）。
 * 每轮另在末尾追加「【本轮生成要求】」；主题与语境在首次拼接时写入「【当前学习任务】」块。
 */
// const CLASSIC_QUOTES_SUBMODEL_SYSTEM_STATIC = `你是英语教学助手。主题与学习语境见文末「【当前学习任务】」（整场不变）；可能分多轮请求。每一轮的条数、已出现句子节选、多样性说明均以当次 system 末尾「【本轮生成要求】」为准；请严格遵守 items 数组长度，并遵守去重规定。
// 你必须生成英文经典语句（名言、名著节选、影视台词、演讲金句、谚语等地道表达），用于英语学习与赏析。
// 每一条必须包含：
// - english：英文原句（不要用序号前缀；保持原汁原味标点）
// - translationZh：准确、自然的中文翻译
// - source：出处（作者、作品、年份或语境；不确定可填 "—"）
// - noteZh：一句中文赏析、修辞或学习要点（可简短）

// 【多轮与线程】
// 每轮任务与条数在 system「本轮生成要求」中；user 可无正文（无检索附录时），有检索要点时 Human 仅携带附录。历史约束还来自对话中各条 AI「【上轮已产出】」快照里的 english_prefixes（节选）。去重须同时遵守本 system 末尾「本轮生成要求」、上述快照，以及「节选未列出但已收录的句子同样禁止实质雷同」。对话须保持 human/ai 交替。

// 【去重硬性规定】
// 1）同一轮 items 内：任意两条的 english 在去首尾空格、小写归一化后不得相同；不得仅通过增删冠词、逗号或个别虚词制造「假不同」；禁止同一句改标点或微调几个词当作多条；禁止同一出处下机械堆叠、句式实质雷同的多条。
// 2）若「本轮生成要求」中列出已出现句子的节选：每条 english 均不得与该列表任一条相同或实质雷同（同句换少量词仍视为雷同），亦不得与前几轮已生成内容相同。
// 3）禁止用同一句 english 重复填多条 items 凑数。
// 4）各轮之间：不得与此前任一条 AI 快照中的 english_prefixes 所指代的原句实质雷同地再输出一批（含仅轻微改写、删改片段或换标点而主干仍一致）。

// 【JSON 语法】所有字符串字段（尤其 noteZh、translationZh）内禁止出现未转义的英文半角双引号 "；强调术语请用「」或单引号 '，不要用 " 包裹中文词；违者会导致解析失败。

// 只输出一个 JSON 对象，不要 markdown，不要代码围栏，不要解释文字。
// 格式严格为：{"items":[{"english":"","translationZh":"","source":"","noteZh":""}]}

// 【当前学习任务】
// 主题/需求：`;

/**
 * 单词包 / 经典句主检索 Human 与子模型「学习任务」共用：不再由用户选档位时的固定学习语境（中文，供 prompt 使用）。
 */
// const ENGLISH_PACK_LEARNER_CONTEXT_HINT =
// 	'面向一般英语学习者：词汇与例句篇幅适中、用地道常见表达，贴近生活与应用场景；经典句兼顾可读性与出处可查证性。';

/** 单词包与经典句共用：每轮 JSON 条数上限、已出现列表尾部条数、stall 时 batch 下调（与单词包逻辑一致） */
// const TOPIC_PACK_ITEMS_PER_ROUND = 20;
// const TOPIC_PACK_EXCLUDE_TAIL = 220;
// const TOPIC_PACK_STALL_BATCH_FLOOR = 5;
// const TOPIC_PACK_STALL_BATCH_STEP = 3;

/** 多轮 JSON 生成时保留在 LangChain 消息线程内的最大条数（Human/AI 交替） */
// const PACK_AGENT_THREAD_MAX_MESSAGES = 32;

/**
 * 子模型 user 内「禁止重复」列表的总字符上限：从已收录键集合尾部择优保留；服务端 `seen` 仍为全集，去重语义不变。
 */
// const TOPIC_PACK_EXCLUDE_PROMPT_MAX_CHARS = 12_000;

/** 经典句：每条 english 写入禁止列表的最大节选长度（避免 220×240 级 prompt） */
// const TOPIC_PACK_EXCLUDE_CLASSIC_ITEM_MAX_CHARS = 96;

/** 经典句：禁止列表最多取已收录集合尾部条数（单词仍用 TOPIC_PACK_EXCLUDE_TAIL） */
// const TOPIC_PACK_EXCLUDE_CLASSIC_TAIL_ITEMS = 80;

/** 主 Agent 流式拼接正文的绝对熔断（防止异常超长输出占满内存） */
// const ENGLISH_PACK_MASTER_STREAM_CHAR_FUSE = 200_000;

/**
 * 主 Agent 产出写入下游「检索附录」的后备上限（字符数）。
 * 系统提示要求模型先归纳工具结果并控制在约 1800 汉字内；附录经 `finalizeMasterResearchAppendix` 截断后再进入子模型 user（按需前置），本值为对主 Agent 流式正文的硬上限保护。
 */
// const ENGLISH_PACK_MASTER_APPENDIX_CHAR_CAP = 24_000;

/** 主 Agent 主题 → 联网 recency 启发规则（顺序敏感：先匹配先返回） */
// const ENGLISH_PACK_WEB_SEARCH_RECENCY_HEURISTIC_RULES: ReadonlyArray<{
// 	preset: WebSearchRecencyPreset;
// 	re: RegExp;
// }> = [
// 		{
// 			preset: 'day',
// 			re: /今日|今天|本日|昨夜|昨晚|今早|刚才|刚刚|实时|突发|小时前|分钟前|即时|快讯|头条|\btoday\b|\btonight\b|\blast night\b|\bthis morning\b|\bbreaking news\b|\bbreaking\b/i,
// 		},
// 		{
// 			preset: 'week',
// 			re: /本周|这周|近一周|过去一周|\bpast week\b|\bthis week\b/i,
// 		},
// 		{
// 			preset: 'month',
// 			re: /本月|这个月|近一月|近一个月|\bthis month\b/i,
// 		},
// 		{
// 			preset: 'year',
// 			re: /今年|本年|年初至今|year to date|\bthis year\b|20[12][0-9]\s*年|20[12][0-9][年\.\-\/]/i,
// 		},
// 		{
// 			preset: 'year',
// 			re: /近几年|近些年|近若干年|最近一年|过去一年|近一年|过去数年|\brecent years\b|\bin the past year\b|\bover the past year\b/i,
// 		},
// 		{
// 			preset: 'month',
// 			re: /近期|近段时间|近段时期|近来一段|最近几个月|过去几个月|近几个月|近两三个月|近半年|近三十天|近30天|\bover the past (few|several) months\b|\bin recent months\b/i,
// 		},
// 		{
// 			preset: 'week',
// 			re: /最近|近来|近况|近些天|近些日子|近几日|近几天|这些天|这几天|前些天|前两天|这两天|上一阵|一阵子|前不久|\brecently\b|\brecent\b|\blately\b|\bin recent days\b|\bover the past few\b|\bthe last few (days|weeks)\b/i,
// 		},
// 	];

// const ENGLISH_PACK_WEB_SEARCH_RECENCY_NEWS_FLAVOR_RE =
// 	/最新|热点|新闻|资讯|动态|舆情|股价|汇率|财报|融资|发布会|上新|单曲打榜|票房|赛程|赛果|转会/i;

// const ENGLISH_PACK_WEB_SEARCH_RECENCY_NEWS_EN_RE =
// 	/\b(latest|headlines?|news)\b/i;

/**
 * 英语学习辅助：主从结构 — 主 Agent（硅基流动 + 工具）负责检索；子模型仅 JSON 模式输出词条/句子，不绑工具。
 */
@Injectable()
export class EnglishLearningService {
	private readonly logger = new Logger(EnglishLearningService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly webSearchService: WebSearchService,
		private readonly knowledgeQaService: KnowledgeQaService,
		@InjectRepository(EnglishVocabularyPackBatch)
		private readonly vocabBatchRepo: Repository<EnglishVocabularyPackBatch>,
		@InjectRepository(EnglishClassicQuotePackBatch)
		private readonly classicBatchRepo: Repository<EnglishClassicQuotePackBatch>,
		@InjectRepository(EnglishPackWebSearchRecord)
		private readonly packWebSearchRepo: Repository<EnglishPackWebSearchRecord>,
	) {}

	/** 中止类异常：用户断开 SSE / 显式 cancel / LangChain 链取消 */
	private isAbortLike(e: unknown): boolean {
		if (e == null) return false;
		if (typeof e === 'object') {
			const o = e as { name?: string; code?: string };
			if (o.name === 'AbortError') return true;
			if (o.code === 'ABORT_ERR') return true;
		}
		return false;
	}

	/** 主 Agent 最终要点：trim + 仅在超过后备上限时截断并告警（正常应由模型自行压缩） */
	private finalizeMasterResearchAppendix(raw: string): string {
		const t = raw.trim();
		if (!t) return '';
		if (t.length <= ENGLISH_PACK_MASTER_APPENDIX_CHAR_CAP) return t;
		this.logger.warn(
			`[EnglishLearning] 主 Agent 要点长度 ${t.length} 超过后备上限 ${ENGLISH_PACK_MASTER_APPENDIX_CHAR_CAP}，已截断（期望模型按系统提示归纳至约 1800 汉字内）`,
		);
		return t.slice(0, ENGLISH_PACK_MASTER_APPENDIX_CHAR_CAP);
	}

	/**
	 * 截断多轮 Human/AI 线程，保证以 Human 开头，供 JSON 子模型多轮上下文使用。
	 */
	private trimPackAgentThread(msgs: BaseMessage[], max: number): BaseMessage[] {
		if (msgs.length <= max) {
			let out = msgs;
			while (out.length && out[0]!.type !== 'human') {
				out = out.slice(1);
			}
			return out;
		}
		let out = msgs.slice(-max);
		while (out.length && out[0]!.type !== 'human') {
			out = out.slice(1);
		}
		return out;
	}

	/**
	 * 检查多轮对话线程（thread）中是否存在“检索与知识库要点”附录内容。
	 * 用途：用于判断是否需要在后续 user 消息中前置附录，避免重复插入，大幅降低上下文 token 占用。
	 * 思路：
	 *   - marker 为检索附录开头的固定文本片段
	 *   - 遍历线程，每个消息只处理 "human" 类型（即由用户发出的消息）
	 *   - 消息内容可能为 string 或 RichContent (<string | { text?: string }>[])，需兼容处理
	 *     - 如果内容为字符串，直接使用
	 *     - 如果为数组（如 OpenAI Message rich-content），则将所有片段拼接为字符串
	 *     - 其中对象片段需判定含 "text" 并为字符串
	 *   - 判断拼接后的字符串是否包含 marker，有则返回 true，否则继续
	 *   - 全部遍历后未发现 marker，则返回 false
	 * @param thread 多轮上下文消息数组，类型为 BaseMessage[]
	 * @returns 是否已出现过“检索与知识库要点”附录
	 */
	private packAgentThreadHasResearchAppendix(thread: BaseMessage[]): boolean {
		const marker = '【检索与知识库要点'; // 检索附录标题前缀
		for (const m of thread) {
			// 只检查 human 消息，跳过 AI/system/其他类型
			if (m.type !== 'human') continue;
			const c = m.content;
			// 处理消息内容，兼容 string 与富内容数组
			const s =
				typeof c === 'string'
					? c
					: Array.isArray(c)
						? c
								.map((p: unknown) => {
									if (typeof p === 'string') return p;
									if (
										p &&
										typeof p === 'object' &&
										'text' in p &&
										typeof (p as { text?: string }).text === 'string'
									) {
										return (p as { text: string }).text;
									}
									return '';
								})
								.join('')
						: '';
			// 检查是否包含 marker
			if (s.includes(marker)) return true;
		}
		// 全部 human 消息均不含附录 marker
		return false;
	}

	/**
	 * 子模型 user：有检索附录且当前线程中尚未出现过时，前置附录（仅计一次上下文，后续靠线程记忆）。
	 * system 保持固定 JSON 任务指令，便于上游 prompt caching 命中稳定前缀。
	 */
	private buildSubModelUserWithOptionalResearchAppendix(
		agentResearchAppendix: string,
		user: string,
		thread: BaseMessage[],
	): string {
		if (!agentResearchAppendix.trim()) return user;
		if (this.packAgentThreadHasResearchAppendix(thread)) return user;
		return `${agentResearchAppendix}\n\n${user}`;
	}

	/** 公历年月日 → UTC 的 `YYYY-MM-DD`；非法日历返回 null */
	private toUtcIsoDate(y: number, m: number, d: number): string | null {
		if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1) return null;
		const maxD = new Date(Date.UTC(y, m, 0)).getUTCDate();
		if (d > maxD) return null;
		const mm = m < 10 ? `0${m}` : String(m);
		const dd = d < 10 ? `0${d}` : String(d);
		return `${y}-${mm}-${dd}`;
	}

	/**
	 * Serper `qdr`：按含首尾的自然日数映射到最接近的 recency。
	 * Tavily 若另有 start/end 以 Tavily 为准，此处仍给 Serper 一个合理 tbs。
	 */
	private recencyFromUtcSpan(
		start: string,
		end: string,
	): WebSearchRecencyPreset {
		let s = start.trim();
		let e = end.trim();
		if (s > e) {
			const x = s;
			s = e;
			e = x;
		}
		const t0 = Date.parse(`${s}T00:00:00.000Z`);
		const t1 = Date.parse(`${e}T00:00:00.000Z`);
		if (Number.isNaN(t0) || Number.isNaN(t1)) return 'none';
		const days = Math.floor((t1 - t0) / 86_400_000) + 1;
		if (days <= 1) return 'day';
		if (days <= 7) return 'week';
		if (days <= 31) return 'month';
		if (days <= 366) return 'year';
		return 'none';
	}

	/**
	 * 从主题解析显式公历（中文 / ISO），供 Tavily `start_date`/`end_date`。
	 * 支持：区间、单日、整月（YYYY年M月）、缺省年的 M月D日（补当前 UTC 年）。
	 */
	private tryParseTopicUtcRange(
		topic: string,
	): { start: string; end: string } | null {
		const t = topic.trim();
		if (!t) return null;

		const refY = new Date().getUTCFullYear();

		const norm = (y: number, m: number, d: number) =>
			this.toUtcIsoDate(y, m, d);

		// 1) 中文：YYYY年M月D日 ～ YYYY年M月D日（起止可跨任意长度）
		let m = t.match(
			/(\d{4})年(\d{1,2})月(\d{1,2})日?\s*(?:到|至|-|~|～)\s*(\d{4})年(\d{1,2})月(\d{1,2})日?/,
		);
		if (m) {
			const a = norm(+m[1], +m[2], +m[3]);
			const b = norm(+m[4], +m[5], +m[6]);
			if (a && b) return { start: a, end: b };
		}

		// 2) ISO / 斜杠：YYYY-M-D ～ YYYY-M-D
		m = t.match(
			/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b\s*(?:到|至|-|~|～)\s*\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/,
		);
		if (m) {
			const a = norm(+m[1], +m[2], +m[3]);
			const b = norm(+m[4], +m[5], +m[6]);
			if (a && b) return { start: a, end: b };
		}

		// 3) 同年缩写：YYYY年M月D日 ～ M月D日
		m = t.match(
			/(\d{4})年(\d{1,2})月(\d{1,2})日?\s*(?:到|至|-|~|～)\s*(\d{1,2})月(\d{1,2})日?/,
		);
		if (m) {
			const y0 = +m[1];
			const a = norm(y0, +m[2], +m[3]);
			const b = norm(y0, +m[4], +m[5]);
			if (a && b) return { start: a, end: b };
		}

		// 4) 单日：YYYY年M月D日
		m = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
		if (m) {
			const one = norm(+m[1], +m[2], +m[3]);
			if (one) return { start: one, end: one };
		}

		// 5) 单日：YYYY-MM-DD（或 / .）
		m = t.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
		if (m) {
			const one = norm(+m[1], +m[2], +m[3]);
			if (one) return { start: one, end: one };
		}

		// 6) 整月：YYYY年M月（后面不是「若干日」的完整某日，避免与单日冲突）
		const monthRe = /(\d{4})年(\d{1,2})月/g;
		let mm = monthRe.exec(t);
		while (mm !== null) {
			const y = +mm[1];
			const mo = +mm[2];
			const tail = t.slice(mm.index + mm[0].length);
			if (/^\s*\d{1,2}\s*日/.test(tail)) {
				mm = monthRe.exec(t);
				continue;
			}
			const start = norm(y, mo, 1);
			const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
			const end = norm(y, mo, last);
			if (start && end) return { start, end };
			mm = monthRe.exec(t);
		}

		// 7) 缺省年：M月D日（取当前 UTC 年；若 2/29 非法则退回 null）
		m = t.match(/(?:^|[^\d])(\d{1,2})月(\d{1,2})日(?:[^\d]|$)/);
		if (m) {
			const one = norm(refY, +m[1], +m[2]);
			if (one) return { start: one, end: one };
		}

		return null;
	}

	/** 典籍 / 考试 / 辞典向：不做联网时间收窄 */
	private isLexiconExamTopic(topic: string): boolean {
		return /莎士比亚|莎翁|Sonnets?|十四行|傲慢与偏见|圣经|荷马|古希腊|罗马|唐诗|宋词|文言|古文|名言|格言|谚语|俚语|GRE|托福|雅思|IELTS|TOEFL|四六级|CET-|专四|专八|考研英语|PETS|托业|BEC|教材|课文|词根|词缀|WordNet|牛津|朗文|柯林斯|韦氏/i.test(
			topic.trim(),
		);
	}

	/**
	 * 主检索联网时间策略：显式日期优先，否则关键词启发。
	 * Tavily 合法起止走 `start_date`/`end_date`（见 `applyTavilyTimeFiltersToBody`）。
	 */
	private resolveWebSearchTime(topic: string): {
		recency: WebSearchRecencyPreset;
		tavilyStartDate?: string;
		tavilyEndDate?: string;
	} {
		const t = topic.trim();
		if (!t) {
			return { recency: 'none' };
		}
		if (this.isLexiconExamTopic(t)) {
			return { recency: 'none' };
		}

		const explicit = this.tryParseTopicUtcRange(t);
		if (explicit) {
			return {
				recency: this.recencyFromUtcSpan(explicit.start, explicit.end),
				tavilyStartDate: explicit.start,
				tavilyEndDate: explicit.end,
			};
		}

		return { recency: this.heuristicRecencyFromTopic(t) };
	}

	/**
	 * 关键词启发 recency（不含空主题、典籍排除、显式日期——后者由 `resolveWebSearchTime` 先行处理）。
	 * 顺序与 `ENGLISH_PACK_WEB_SEARCH_RECENCY_HEURISTIC_RULES` 及末尾「新闻/动态」分支一致，勿随意重排。
	 */
	private heuristicRecencyFromTopic(topic: string): WebSearchRecencyPreset {
		const t = topic.trim();
		for (const {
			preset,
			re,
		} of ENGLISH_PACK_WEB_SEARCH_RECENCY_HEURISTIC_RULES) {
			if (re.test(t)) return preset;
		}
		if (
			ENGLISH_PACK_WEB_SEARCH_RECENCY_NEWS_FLAVOR_RE.test(t) ||
			ENGLISH_PACK_WEB_SEARCH_RECENCY_NEWS_EN_RE.test(t)
		) {
			return 'week';
		}
		return 'none';
	}

	/**
	 * 将已收录键（单词小写 / 句子 key）拼成逗号列表供子模型阅读，受总字符上限约束；优先保留**最近**收录的一批。
	 * 说明：与 `seen` 全量去重无关，仅压缩「提示给模型的明文」以省 token。
	 */
	private buildSeenKeysExcludePromptForModel(
		keys: readonly string[],
		opts: {
			maxTailItems: number;
			maxTotalChars: number;
			perItemMaxChars?: number;
		},
	): string {
		if (keys.length === 0) return '';
		const slice = keys.slice(-opts.maxTailItems);
		const formatted = slice.map((k) => {
			let s = k.replace(/`/g, "'");
			if (opts.perItemMaxChars != null && s.length > opts.perItemMaxChars) {
				s = `${s.slice(0, opts.perItemMaxChars)}…`;
			}
			return s;
		});
		const kept: string[] = [];
		let len = 0;
		for (let i = formatted.length - 1; i >= 0; i--) {
			const piece = formatted[i]!;
			const sep = kept.length ? ', ' : '';
			if (len + sep.length + piece.length > opts.maxTotalChars) break;
			kept.unshift(piece);
			len += sep.length + piece.length;
		}
		const joined = kept.join(', ');
		const truncatedInSlice = kept.length < slice.length;
		const truncatedTail = slice.length < keys.length;
		if (!joined) return '';
		if (truncatedInSlice || truncatedTail) {
			return `【已收录节选】下列为近期已收录条目的节选（因长度已裁剪）；禁止与此前任意已收录条目重复（含未列出项）。\n${joined}`;
		}
		return joined;
	}

	/**
	 * 多轮线程中 AI 条目不存完整 JSON，仅存紧凑快照，降低 priorThread token；服务端合并与去重仍以本轮解析结果为准。
	 */
	private buildPackAgentThreadAssistantSnapshot(
		kind: 'vocabulary' | 'classic_quotes',
		items: VocabularyItemDto[] | ClassicQuoteItemDto[],
	): string {
		if (kind === 'vocabulary') {
			const words = (items as VocabularyItemDto[]).map((x) => x.word);
			return `【上轮已产出（勿重复；下一条回复仍须仅为 JSON 对象）】\n${JSON.stringify({ words })}`;
		}
		const prefixes = (items as ClassicQuoteItemDto[]).map((x) =>
			x.english.trim().replace(/\s+/g, ' ').slice(0, 120),
		);
		return `【上轮已产出 english 节选（勿重复；下一条回复仍须仅为 JSON 对象）】\n${JSON.stringify({ english_prefixes: prefixes })}`;
	}

	/**
	 * 硅基流动凭证（与知识库 embedding 一致：优先 SILICONFLOW_API_KEY，兼容旧键名）。
	 */
	private resolveEnglishPackSiliconFlowConfig(): {
		apiKey: string;
		baseURL: string;
		modelName: string;
	} {
		const apiKey = (
			this.configService.get<string>(KnowledgeQaEnum.SILICONFLOW_API_KEY) ||
			this.configService.get<string>(KnowledgeQaEnum.DASHSCOPE_API_KEY) ||
			this.configService.get<string>(ModelEnum.QWEN_API_KEY) ||
			''
		).trim();
		const baseURL = (
			this.configService.get<string>(KnowledgeQaEnum.SILICONFLOW_BASE_URL) ||
			'https://api.siliconflow.cn/v1'
		).replace(/\/$/, '');
		const modelName =
			this.configService
				.get<string>(ModelEnum.ENGLISH_LEARNING_SILICONFLOW_MODEL_NAME)
				?.trim() || 'Pro/zai-org/GLM-4.7';
		if (!apiKey) {
			throw new HttpException(
				'硅基流动未配置（SILICONFLOW_API_KEY，或兼容 DASHSCOPE_API_KEY / QWEN_API_KEY），无法生成学习内容',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
		return { apiKey, baseURL, modelName };
	}

	/**
	 * 词句包主 Agent：硅基流动 OpenAI 兼容端点；流式主模型不设 response_format，便于工具调用；summary 供摘要中间件使用。
	 */
	private buildSiliconFlowPackAgentModels(options: {
		maxTokens?: number;
		temperature?: number;
		signal?: AbortSignal;
	}): { main: ChatOpenAI; summary: ChatOpenAI } {
		const { apiKey, baseURL, modelName } =
			this.resolveEnglishPackSiliconFlowConfig();
		const main = new ChatOpenAI({
			apiKey,
			modelName,
			streaming: true,
			temperature: options.temperature ?? 0.35,
			maxTokens: options.maxTokens ?? 8192,
			configuration: { baseURL },
			...(options.signal && {
				callOptions: { signal: options.signal },
			}),
		});
		const summaryModelName =
			this.configService
				.get<string>('ENGLISH_PACK_AGENT_SUMMARY_MODEL_NAME')
				?.trim() || modelName;
		const summary = new ChatOpenAI({
			apiKey,
			modelName: summaryModelName,
			streaming: false,
			temperature: 0.2,
			maxTokens: 2048,
			configuration: { baseURL },
		});
		return { main, summary };
	}

	/**
	 * 主 Agent（大脑）：仅检索与要点整理，可调工具；不负责输出 JSON。整场单词/经典句开始时调用一次。
	 * 此方法负责协调主 Agent 的大模型调用与工具流程，产出“简明要点”作为后续知识生成的核心输入。
	 * 参数说明:
	 * - userId: 当前用户的唯一标识
	 * - topic: 用户指定的主题，例如某类单词、名言等
	 * - kind: 区分调用场景（单词包/经典句）
	 * - onToolEvent: 可选，外部在工具调用时的回调，用于追踪工具过程和输入输出
	 */
	private async runEnglishPackMasterResearchPhase(params: {
		userId: number;
		topic: string;
		kind: 'vocabulary' | 'classic_quotes';
		/** 与 SSE / 显式 cancel 共用，与 120s 超时合并为任一触发即中止 */
		clientSignal?: AbortSignal;
		onToolEvent?: (
			e: EnglishLearningPackAgentToolEvent,
		) => void | Promise<void>;
	}): Promise<string> {
		const { userId, topic, kind, onToolEvent, clientSignal } = params;

		const timeoutAc = new AbortController();
		const timeoutMs = 120_000;
		const timer = setTimeout(() => timeoutAc.abort(), timeoutMs);
		const combinedSignal =
			clientSignal != null
				? AbortSignal.any([timeoutAc.signal, clientSignal])
				: timeoutAc.signal;

		let accumulated = ''; // 累加大模型流式返回的片段

		try {
			// 主检索为单次会话，消息量通常达不到摘要中间件触发阈值；不设 summarization，避免误用 AgentMemory 的 token 估算与副模型调用
			const { main: mainLlm } = this.buildSiliconFlowPackAgentModels({
				maxTokens: 8192,
				temperature: 0.35,
				signal: combinedSignal,
			});

			// 根据主题推断联网检索时间策略（显式公历 → Tavily 区间；Serper 用粗粒度 tbs）
			const webSearchTime = this.resolveWebSearchTime(topic);
			// 动态构建支持的工具，包括 Web 检索及知识 QA 工具
			const tools = buildAgentLangChainTools(
				{
					webSearchService: this.webSearchService,
					knowledgeQaService: this.knowledgeQaService,
					userId,
					webSearchRecency: webSearchTime.recency,
					webSearchTavilyStartDate: webSearchTime.tavilyStartDate,
					webSearchTavilyEndDate: webSearchTime.tavilyEndDate,
					// includeCurrentDateTool:
					// 	this.inferEnglishPackUserNeedsCurrentDateTool(topic),
				},
				{
					onInternetSearchComplete: async (r, meta) => {
						const list = r.organic;
						if (!onToolEvent || !Array.isArray(list) || list.length === 0) {
							return;
						}
						const q = meta?.searchQuery?.trim();
						await Promise.resolve(
							onToolEvent({
								phase: 'organic',
								name: 'internet_search',
								searchOrganic: list,
								searchQuery: q || undefined,
							}),
						);
					},
				},
			);

			// 构建 LangChain Agent，传入主模型、工具、系统 Prompt 及中间件
			const agent = createAgent({
				model: mainLlm,
				tools,
				systemPrompt: AGENT_SYSTEM_PROMPT,
				// 仅保留工具次数上限（与 chat Agent 中间件一致），无会话摘要折叠
				middleware: [
					toolCallLimitMiddleware({
						runLimit: 12,
						threadLimit: 12,
						exitBehavior: 'continue',
					}),
				],
			});

			// 根据当前处理类型，选择语境标签
			const kindLabel =
				kind === 'vocabulary' ? '单词/短语主题包' : '英文名言/金句主题包';

			// 组织发送给 LLM 的 Human prompt：与系统提示一致，强调「按需用工具」，避免模型为走流程而必调联网
			const userHumanText = `任务类型：${kindLabel}
主题/需求：${topic.trim()}
学习语境：${ENGLISH_PACK_LEARNER_CONTEXT_HINT}

请先判断是否真的需要调用工具（互联网搜索 / 知识库检索 / 当前日期）。若主题以课内词汇、搭配扩展、词根词缀等为主、且无必须核验的公开事实或出处缺口，可直接整理要点，**不必**为完成任务而例行联网。确有必要时再按需调用工具并消化结果，然后输出一段简明要点（中文为主，可夹关键英文术语），供下游子模型扩展词条或句子方向使用；不要输出 JSON，不要输出 markdown 代码块。`;

			// 启动流式 Agent，会不断地以事件流方式返回推理阶段的各类事件（模型输出增量、工具调用等）
			const eventStream = agent.streamEvents(
				{ messages: [new HumanMessage(userHumanText)] },
				{
					version: 'v2',
					signal: combinedSignal,
					recursionLimit: 80, // 限制工具递归调用层数防止死循环
				},
			);

			// 异步遍历事件流，处理模型输出和工具事件
			for await (const ev of eventStream) {
				if (ev.event === 'on_chat_model_stream') {
					// 模型产生新文本内容（流式），需要提取并追加
					const chunk = ev.data?.chunk as AIMessageChunk | undefined;
					const text = extractEnglishPackAgentChunkText(chunk);
					if (text) {
						accumulated += text;
						// 超出最大融合字符数自动熔断，防止输出过长
						if (accumulated.length > ENGLISH_PACK_MASTER_STREAM_CHAR_FUSE) {
							timeoutAc.abort();
							break;
						}
					}
				} else if (ev.event === 'on_tool_start' && onToolEvent) {
					// 工具即将调用，如果定义了外部回调，则调用之
					await Promise.resolve(
						onToolEvent({
							phase: 'start',
							name: typeof ev.name === 'string' ? ev.name : undefined,
							input: ev.data?.input,
						}),
					);
				} else if (ev.event === 'on_tool_end' && onToolEvent) {
					// 工具调用结束，外部回调可获知调用结果
					await Promise.resolve(
						onToolEvent({
							phase: 'end',
							name: typeof ev.name === 'string' ? ev.name : undefined,
							input: ev.data?.input,
							output: ev.data?.output,
						}),
					);
				}
			}
			// 整体流程成功或正常终结，进行格式化生成“附录”段内容
			return this.finalizeMasterResearchAppendix(accumulated);
		} catch (e: unknown) {
			// 流式链路在正常收尾或主动 abort（超长截断）时常以 AbortError 结束，不应误判为失败
			if (englishPackAgentIsUserAbort(e)) {
				return this.finalizeMasterResearchAppendix(accumulated);
			}
			this.logger.warn('[EnglishLearning] 主 Agent 检索阶段执行失败', e);
			throw e; // 否则其他异常继续外抛
		} finally {
			clearTimeout(timer); // 无论异常与否，均需清理定时器
		}
	}

	/**
	 * 硅基流动 JSON 模式（无登录或 Agent 不可用时的回退）；maxTokens 由调用方传入。
	 */
	private buildSiliconFlowJsonLlm(
		maxTokens: number,
		signal?: AbortSignal,
	): ChatOpenAI {
		const { apiKey, baseURL, modelName } =
			this.resolveEnglishPackSiliconFlowConfig();
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
			...(signal && {
				callOptions: { signal },
			}),
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
					// 若仅为字段内误用引号，不结束字符串，避免 `}` 深度错位
					if (isJsonStringClosingQuoteAt(text, i)) {
						inString = false;
					}
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

	/**
	 * 尝试从原始字符串中解析出 JSON 对象，自动兼容常见格式异常并尽量修复错误。
	 *
	 * 1. 支持三重引号 ```json ... ``` 包裹的内容自动提取 JSON 段；
	 * 2. 去除 BOM 字符及首尾空白；
	 * 3. 尝试宽松解析 JSON（如去除末尾多余逗号），失败时进一步修正未转义的字段内双引号；
	 * 4. 自动在文本中查找首个配平的 JSON 对象（从每一个 { 起点尝试，最多16次），提升鲁棒性。
	 * 5. 解析失败时抛出 502 错误，便于前端获知。
	 *
	 * @param raw 待解析原始字符串
	 * @returns 解析出的对象；若失败直接抛出异常
	 */
	private extractJsonObject(raw: string): unknown {
		// 先去除首尾空白与 BOM
		const s = raw.trim().replace(/^\uFEFF/, '');
		// 检查内容是否被 Markdown 代码块包裹，如 ```json ... ```，优先取其中内容
		const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
		const candidate = fence?.[1]?.trim() ?? s;

		/**
		 * 试图宽松解析 JSON 对象。
		 * - 普通 parse 失败时自动去除逗号导致的结尾冗余
		 */
		const tryParseLoose = (jsonStr: string): unknown => {
			try {
				return JSON.parse(jsonStr);
			} catch {
				// 宽松模式：去除 ,} ,] 类型逗号，尝试修正低级格式错误
				const relaxed = jsonStr.replace(/,\s*([\]}])/g, '$1');
				return JSON.parse(relaxed);
			}
		};

		/**
		 * 再次加强修复：若宽松解析失败，则修正常见的未转义英文字段内双引号
		 */
		const tryParseWithRepair = (slice: string): unknown => {
			try {
				return tryParseLoose(slice);
			} catch {
				// 修正未转义的字段内容内部英文引号
				const repaired = repairJsonUnescapedInteriorQuotes(slice);
				return tryParseLoose(repaired);
			}
		};

		let searchFrom = 0;
		const maxBraceAttempts = 16; // 最多尝试 16 次 { 起点，防止输入内容过大导致无限遍历

		// 循环尝试查找每个 { 的起点，得到配平的 JSON 对象字符串后尝试解析
		for (let n = 0; n < maxBraceAttempts; n++) {
			const idx = candidate.indexOf('{', searchFrom);
			if (idx === -1) break; // 没有 {，直接终止
			const slice = this.sliceBalancedJsonObject(candidate, idx);
			searchFrom = idx + 1;
			if (!slice) continue; // 没有配平成功，尝试下一个
			try {
				return tryParseWithRepair(slice);
			} catch {
				// 当前段失败，继续下一个 { 起点
			}
		}

		// 上述所有尝试均失败时，记录警告日志并抛出 502 异常
		this.logger.warn(
			`[EnglishLearning] JSON 解析失败，原文前缀（截断）：${candidate.slice(0, 500)}`,
		);
		throw new HttpException(
			candidate.includes('{')
				? '学习内容 JSON 解析失败（字段内请勿使用未转义的英文双引号）'
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

	/**
	 * 从解析后的 JSON 数据对象中提取经典句条目（宽松模式）。
	 * 结构示例：
	 * {
	 *   items: [
	 *     {
	 *       english: 'To be, or not to be, that is the question.',
	 *       translationZh: '生存还是毁灭，这是个问题。',
	 *       source: 'Shakespeare',
	 *       noteZh: '《哈姆雷特》经典台词'
	 *     },
	 *     ...
	 *   ]
	 * }
	 * @param data 任意类型，预期为包含 "items" 数组的对象，数组元素为经典句条目
	 * @returns ClassicQuoteItemDto[] 结构化后的经典句条目数组。不满足条件时返回空数组。
	 */
	private extractClassicQuoteItemsLoose(data: unknown): ClassicQuoteItemDto[] {
		// 检查 data 是否为对象且包含 'items' 字段，否则直接返回空数组
		if (!data || typeof data !== 'object' || !('items' in data)) {
			return [];
		}
		// 尝试提取 items 字段，需为非空数组，否则返回空数组
		const items = (data as { items?: unknown }).items;
		if (!Array.isArray(items) || items.length === 0) {
			return [];
		}
		const out: ClassicQuoteItemDto[] = [];
		// 遍历 items 数组，对每个元素提取所需字段
		for (const row of items) {
			// 跳过空值及非对象元素，确保类型安全
			if (!row || typeof row !== 'object') continue;
			const r = row as Record<string, unknown>;

			// 提取英文原句，要求必须为 string 类型，去除首尾空白字符
			const english = typeof r.english === 'string' ? r.english.trim() : '';

			// 兼容键名为 translationZh 或 translation_zh，要求必须为 string 类型
			const translationZh =
				typeof r.translationZh === 'string'
					? r.translationZh.trim()
					: typeof r.translation_zh === 'string'
						? r.translation_zh.trim()
						: '';

			// 提取出处(source)，可选，默认为 '—'
			const source = typeof r.source === 'string' ? r.source.trim() : '';

			// 兼容备注(noteZh 或 note_zh)，string 类型，默认为 '—'
			const noteZh =
				typeof r.noteZh === 'string'
					? r.noteZh.trim()
					: typeof r.note_zh === 'string'
						? r.note_zh.trim()
						: '';

			// 若英文原句或中文释义不能为空，否则跳过该条
			if (!english || !translationZh) continue;

			// 组装成 ClassicQuoteItemDto 并加入返回结果
			out.push({
				english,
				translationZh,
				source: source || '—', // 若无有效出处则填补 '—'
				noteZh: noteZh || '—', // 若无有效备注则填补 '—'
			});
		}
		// 返回所有有效提取的条目
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
		targetCount: number;
		items: VocabularyItemDto[];
	}): Promise<void> {
		if (!params.items.length) return;
		const row = this.vocabBatchRepo.create({
			userId: params.userId,
			streamId: params.streamId,
			round: params.round,
			topic: params.topic.trim().slice(0, 500),
			level: null,
			targetCount: params.targetCount,
			items: params.items as EnglishVocabularyPackItemJson[],
		});
		await this.vocabBatchRepo.save(row);
	}

	/**
	 * 追加一轮主检索联网结果（同 stream 多次调用则合并到 `search_rounds` 数组）。
	 */
	async appendPackWebSearchRound(params: {
		userId: number;
		streamId: string;
		packKind: 'vocabulary' | 'classic_quotes';
		query?: string | null;
		organic: WebSearchOrganicItem[];
	}): Promise<void> {
		if (!params.organic.length) return;
		try {
			const existing = await this.packWebSearchRepo.findOne({
				where: {
					userId: params.userId,
					streamId: params.streamId,
					packKind: params.packKind,
				},
			});
			const round: EnglishPackWebSearchRoundJson = {
				query: params.query?.trim() ? params.query.trim().slice(0, 500) : null,
				organic: params.organic,
			};
			if (!existing) {
				await this.packWebSearchRepo.save(
					this.packWebSearchRepo.create({
						userId: params.userId,
						streamId: params.streamId,
						packKind: params.packKind,
						searchRounds: [round],
					}),
				);
				return;
			}
			const prev = Array.isArray(existing.searchRounds)
				? existing.searchRounds
				: [];
			existing.searchRounds = [...prev, round];
			await this.packWebSearchRepo.save(existing);
		} catch (e) {
			this.logger.warn('[EnglishLearning] 联网检索结果落库失败', e);
		}
	}

	/**
	 * 将本轮流式生成的新“经典句”条目批量写入数据库。
	 * - 每轮大模型生成后执行一次，将该轮批量内容作为一条 batch 记录保存
	 * - 主要用于流式词包/句包会话持久化，方便后续查询和历史回溯
	 *
	 * @param params 包含以下字段：
	 *   - userId: number               当前用户的 ID（生成者）
	 *   - streamId: string             当前词包/句包会话的唯一标识
	 *   - round: number                当前批次在会话中的轮次编号（从 0/1 开始递增）
	 *   - topic: string                用户选择或系统分配的主题（需做去空格和长度限制）
	 *   - targetCount: number          本轮目标输出的条目数（用于后续校验）
	 *   - items: ClassicQuoteItemDto[] 本轮大模型输出的经典句子数组（已校验、去重）
	 */
	async saveClassicQuotesPackBatch(params: {
		userId: number;
		streamId: string;
		round: number;
		topic: string;
		targetCount: number;
		items: ClassicQuoteItemDto[];
	}): Promise<void> {
		// 若本轮无有效句目，则无需写入
		if (!params.items.length) return;
		// 构建数据库批量记录（items 需强转为数据库定义的 JSON 类型）
		const row = this.classicBatchRepo.create({
			userId: params.userId,
			streamId: params.streamId,
			round: params.round,
			topic: params.topic.trim().slice(0, 500), // 主题防止过长，最大 500 字符
			level: null,
			targetCount: params.targetCount,
			items: params.items as EnglishClassicQuoteItemJson[],
		});
		// 批量保存到 classicBatchRepo 表进行持久化
		await this.classicBatchRepo.save(row);
	}

	/**
	 * 子模型：硅基流动 JSON 模式（response_format），无工具；priorThread 供已登录用户多轮 Human/AI 记忆。
	 * user 经 trim 为空时：若 priorThread 截断后末条已是 human，则不追加 Human（避免空 user 叠在上一轮 human 后）；
	 * 否则追加单空格 Human，以满足末条非 human 时常见 Chat API 的对话轮次约定。
	 */
	private async invokeEnglishPackSubModelJson(params: {
		system: string;
		user: string;
		maxTokens: number;
		priorThread?: BaseMessage[];
		/** 与 SSE / 显式 cancel 联动，中止子模型 HTTP 请求 */
		signal?: AbortSignal;
	}): Promise<string> {
		if (params.signal?.aborted) {
			const err = new Error('Aborted');
			err.name = 'AbortError';
			throw err;
		}
		const llm = this.buildSiliconFlowJsonLlm(params.maxTokens, params.signal);
		const msgs: BaseMessage[] = [new SystemMessage(params.system)];
		if (params.priorThread?.length) {
			msgs.push(
				...this.trimPackAgentThread(
					params.priorThread,
					PACK_AGENT_THREAD_MAX_MESSAGES,
				),
			);
		}
		const lastMsg = msgs[msgs.length - 1]!;
		const userTrimmed = params.user.trim();
		const lastIsHuman = lastMsg.type === 'human';
		if (userTrimmed.length > 0) {
			msgs.push(new HumanMessage(params.user));
		} else if (lastIsHuman) {
			// 无 user：末条已是 human，不再推第二条 Human
		} else {
			msgs.push(new HumanMessage(' '));
		}
		if (params.signal?.aborted) {
			const err = new Error('Aborted');
			err.name = 'AbortError';
			throw err;
		}
		const res = await llm.invoke(msgs, { signal: params.signal });
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
	 * 根据主题生成单词列表（每条含 IPA、中文释义、英文例句）。
	 * 数量较大时分批 JSON 请求并去重合并；默认每轮最多 20 条，重复过多时会自适应减小单轮条数。
	 * @param onProgress 每轮合并后触发（含首轮前 round=0 可由调用方自行先发起点）
	 */
	async runVocabularyGeneration(
		dto: GenerateVocabularyDto,
		onProgress?: (p: VocabularyGenerationProgress) => void | Promise<void>,
		context?: {
			userId?: number;
			/** 与 SSE、显式 cancel、连接断开联动 */
			signal?: AbortSignal;
			onAgentTool?: (
				e: EnglishLearningPackAgentToolEvent,
			) => void | Promise<void>;
		},
	): Promise<VocabularyItemDto[]> {
		const topic = dto.topic.trim();
		const count = resolveVocabularyPackTargetCount(dto.count);
		const maxRounds = this.resolveMaxRounds(count, TOPIC_PACK_ITEMS_PER_ROUND);

		const vocabularySystemStatic = `${VOCABULARY_PACK_SUBMODEL_SYSTEM_STATIC}${topic}
学习语境：${ENGLISH_PACK_LEARNER_CONTEXT_HINT}`;

		/** 主 Agent 检索要点（整场一次）；非空时仅在「线程中尚未含附录」的首条 Human 前置附录。每轮子模型 system 会动态追加「本轮生成要求」。 */
		let agentResearchAppendix = '';
		if (context?.userId != null) {
			try {
				const raw = await this.runEnglishPackMasterResearchPhase({
					userId: context.userId,
					topic,
					kind: 'vocabulary',
					clientSignal: context?.signal,
					onToolEvent: context?.onAgentTool,
				});
				if (raw.trim()) {
					agentResearchAppendix = `\n【检索与知识库要点（供扩展词汇方向，勿逐字照抄为 word）】\n${raw.trim()}`;
				}
			} catch (e: unknown) {
				this.logger.warn(
					'[EnglishLearning] 主 Agent 检索跳过（单词），继续纯子模型生成',
					e,
				);
			}
		}

		let accumulated: VocabularyItemDto[] = [];
		try {
			accumulated = [];
			const seen = new Set<string>();
			/** 已登录时多轮 JSON 子模型的 LangChain 消息线程 */
			const packAgentThread: BaseMessage[] = [];
			let stall = 0;
			let rounds = 0;
			/** 重复过多时下调每轮请求条数，减轻模型「全重复」与 JSON 压力 */
			let batchCap = TOPIC_PACK_ITEMS_PER_ROUND;

			while (accumulated.length < count && rounds < maxRounds) {
				if (context?.signal?.aborted) {
					break;
				}
				rounds++;
				const need = count - accumulated.length;
				const batch = Math.min(batchCap, need);
				const seenKeys = [...seen];
				const excludeSnippet =
					accumulated.length === 0
						? ''
						: this.buildSeenKeysExcludePromptForModel(seenKeys, {
								maxTailItems: TOPIC_PACK_EXCLUDE_TAIL,
								maxTotalChars: TOPIC_PACK_EXCLUDE_PROMPT_MAX_CHARS,
							});

				const diversityHint =
					stall >= 2 && accumulated.length > 0
						? `\n【多样性】请换子角度：同主题下的不同词性、常见搭配、近义辨析词、学科细分小类、短语动词变体等，严禁与已列词条同形或仅大小写差异。`
						: '';

				/** 每轮拼入 system，避免写入 packAgentThread 的 Human 重复携带长节选 */
				const roundRequirement =
					accumulated.length === 0
						? `请恰好生成 ${batch} 条 items（数组长度必须等于 ${batch}）。`
						: `请再生成恰好 ${batch} 条新的 items（数组长度必须等于 ${batch}）。
以下英文词条已出现过，禁止再次输出（不区分大小写；归一化后须与下列全部不同）：${excludeSnippet}
本批 items 内部也不得出现彼此重复的 word。请输出与上述列表完全不同的词或短语。${diversityHint}`;

				const newItemsThisRound: VocabularyItemDto[] = [];
				let added = 0;
				let batchItems: VocabularyItemDto[] = [];
				const maxDupPasses = accumulated.length === 0 ? 1 : 5;

				const userForModel = this.buildSubModelUserWithOptionalResearchAppendix(
					agentResearchAppendix,
					'',
					packAgentThread,
				);

				for (let dupPass = 0; dupPass < maxDupPasses; dupPass++) {
					const urgency =
						dupPass === 0
							? ''
							: `\n【紧急】上一轮返回的词条全部与已收集列表重复。请换完全不同的词根、子话题、词族、搭配域与词性，仍必须恰好 ${batch} 条 items，且数组内互不重复。`;
					const systemThisRound = `${vocabularySystemStatic}\n\n【本轮生成要求】\n${roundRequirement}${urgency}`;

					batchItems = [];
					const parseRetries = 3;
					for (let att = 0; att < parseRetries; att++) {
						if (context?.signal?.aborted) {
							const err = new Error('Aborted');
							err.name = 'AbortError';
							throw err;
						}
						const maxTok = this.resolveVocabOutputMaxTokens(batch) + att * 2048;
						try {
							const text = await this.invokeEnglishPackSubModelJson({
								system: systemThisRound,
								user: userForModel,
								maxTokens: maxTok,
								priorThread:
									context?.userId != null ? packAgentThread : undefined,
								signal: context?.signal,
							});
							const parsed = this.extractJsonObject(text);
							batchItems = this.extractVocabularyItemsLoose(parsed);
							if (context?.userId != null && text.trim()) {
								const threadAi =
									batchItems.length > 0
										? this.buildPackAgentThreadAssistantSnapshot(
												'vocabulary',
												batchItems,
											)
										: text.trim().slice(0, 4000);
								if (userForModel.trim().length > 0) {
									packAgentThread.push(
										new HumanMessage(userForModel),
										new AIMessage(threadAi),
									);
								} else {
									packAgentThread.push(
										new HumanMessage(' '),
										new AIMessage(threadAi),
									);
								}
								const trimmed = this.trimPackAgentThread(
									packAgentThread,
									PACK_AGENT_THREAD_MAX_MESSAGES,
								);
								packAgentThread.splice(0, packAgentThread.length, ...trimmed);
							}
							break;
						} catch (e: unknown) {
							if (context?.signal?.aborted || this.isAbortLike(e)) {
								throw e;
							}
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
						batchCap = Math.max(
							TOPIC_PACK_STALL_BATCH_FLOOR,
							batchCap - TOPIC_PACK_STALL_BATCH_STEP,
						);
					}
					if (stall >= stallLimit) {
						this.logger.warn(
							`[EnglishLearning] vocabulary pack stalled at ${accumulated.length}/${count} (stallLimit=${stallLimit})`,
						);
						break;
					}
				} else {
					stall = 0;
					batchCap = Math.min(TOPIC_PACK_ITEMS_PER_ROUND, batchCap + 1);
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
			if (this.isAbortLike(e) || context?.signal?.aborted) {
				if (accumulated.length === 0) {
					throw new HttpException(
						'生成已中止，尚未得到有效词条',
						HttpStatus.BAD_GATEWAY,
					);
				}
				this.logger.warn(
					`[EnglishLearning] 单词包生成已中止，返回已收集 ${accumulated.length} 条`,
				);
				return accumulated.slice(0, count);
			}
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
	 * 生成一批经典英文语句（如名言、台词、谚语等），并保证内容多样、去重且 JSON 结构规范。
	 * 支持多轮生成及对话上下文，兼容 Agent 预检索辅助。
	 *
	 * @param dto 生成参数，包含主题(topic)、目标条数(count)等
	 * @param onProgress (可选) 生成进展回调
	 * @param context (可选) 上下文（含 userId、工具事件回调等）
	 * @returns ClassicQuoteItemDto[] 生成的经典句条目数组
	 */
	async runClassicQuotesGeneration(
		dto: GenerateClassicQuotesDto,
		onProgress?: (p: ClassicQuoteGenerationProgress) => void | Promise<void>,
		context?: {
			userId?: number;
			/** 与 SSE、显式 cancel、连接断开联动 */
			signal?: AbortSignal;
			onAgentTool?: (
				e: EnglishLearningPackAgentToolEvent,
			) => void | Promise<void>;
		},
	): Promise<ClassicQuoteItemDto[]> {
		const topic = dto.topic.trim();
		const count = resolveClassicQuotesPackTargetCount(dto.count);
		const maxRounds = this.resolveMaxRounds(count, TOPIC_PACK_ITEMS_PER_ROUND);

		const classicQuotesSystemStatic = `${CLASSIC_QUOTES_SUBMODEL_SYSTEM_STATIC}${topic}
学习语境：${ENGLISH_PACK_LEARNER_CONTEXT_HINT}`;

		/**
		 * 主 Agent 检索要点（整场一次）；非空时仅在「线程中尚未含附录」的首条 Human 前置附录。每轮子模型 system 会动态追加「本轮生成要求」。
		 */
		let agentResearchAppendix = '';
		if (context?.userId != null) {
			try {
				const raw = await this.runEnglishPackMasterResearchPhase({
					userId: context.userId,
					topic,
					kind: 'classic_quotes',
					clientSignal: context?.signal,
					onToolEvent: context?.onAgentTool,
				});
				if (raw.trim()) {
					// 检索内容非空则写入附录，将拼接于 prompt，供 LLM 拓展参考
					agentResearchAppendix = `\n【检索与知识库要点（供扩展名言/原句线索，勿逐字照抄为 english）】\n${raw.trim()}`;
				}
			} catch (e: unknown) {
				// 检索异常容错：记录告警日志，继续执行生成主流程
				this.logger.warn(
					'[EnglishLearning] 主 Agent 检索跳过（经典句），继续纯子模型生成',
					e,
				);
			}
		}

		let accumulated: ClassicQuoteItemDto[] = [];
		try {
			accumulated = [];
			// 已收集过的句子（归一化为小写去空格的形式）
			const seen = new Set<string>();
			/**
			 * 多轮消息线程，仅在有 userId 时累计，便于子模型对话流上下文记忆。
			 * packAgentThread 每轮添加一次 user/ai 交换，并裁剪长度。
			 */
			const packAgentThread: BaseMessage[] = [];
			let stall = 0; // 停滞轮次计数，防死循环
			let rounds = 0; // 当前轮数
			let batchCap = TOPIC_PACK_ITEMS_PER_ROUND; // 本轮最大尝试条数

			// 主生成循环，每轮尝试若干条，并处理去重、stall判定及退出条件
			while (accumulated.length < count && rounds < maxRounds) {
				if (context?.signal?.aborted) {
					break;
				}
				rounds++;
				const need = count - accumulated.length; // 剩余待采集条数
				const batch = Math.min(batchCap, need); // 本轮请求条数（不超 batchCap）
				// 生成“排除片段”列表，传递给LLM避免重复（仅取近N条）
				const seenKeys = [...seen];
				const excludeSnippet =
					accumulated.length === 0
						? ''
						: this.buildSeenKeysExcludePromptForModel(seenKeys, {
								maxTailItems: TOPIC_PACK_EXCLUDE_CLASSIC_TAIL_ITEMS,
								maxTotalChars: TOPIC_PACK_EXCLUDE_PROMPT_MAX_CHARS,
								perItemMaxChars: TOPIC_PACK_EXCLUDE_CLASSIC_ITEM_MAX_CHARS,
							});

				const diversityHint =
					stall >= 2 && accumulated.length > 0
						? `\n【多样性】请换不同作品/时代/体裁/演讲场合；避免仅改写标点或个别词的同一句式变体。`
						: '';

				/** 每轮拼入 system，避免写入 packAgentThread 的 Human 重复携带长节选（与单词生成一致） */
				const roundRequirement =
					accumulated.length === 0
						? `请恰好生成 ${batch} 条 items（数组长度必须等于 ${batch}）。`
						: `请再生成恰好 ${batch} 条新的 items（数组长度必须等于 ${batch}）。
以下英文句子（节选）已出现过，禁止再次输出相同或实质雷同的句子（含轻微改写；不区分大小写；归一化后须与下列全部不同）：${excludeSnippet}
本批 items 内部的 english 也不得彼此重复或雷同。请输出与上述列表完全不同的句子。${diversityHint}`;

				const newItemsThisRound: ClassicQuoteItemDto[] = [];
				let added = 0;
				let batchItems: ClassicQuoteItemDto[] = [];
				const maxDupPasses = accumulated.length === 0 ? 1 : 5;

				const userForModel = this.buildSubModelUserWithOptionalResearchAppendix(
					agentResearchAppendix,
					'',
					packAgentThread,
				);

				for (let dupPass = 0; dupPass < maxDupPasses; dupPass++) {
					const urgency =
						dupPass === 0
							? ''
							: `\n【紧急】上一轮返回的句子全部与已收集列表重复或实质雷同。请换不同作品、时代、人物、体裁与句式，仍必须恰好 ${batch} 条 items，且数组内互不重复。`;
					const systemThisRound = `${classicQuotesSystemStatic}\n\n【本轮生成要求】\n${roundRequirement}${urgency}`;

					batchItems = [];
					const parseRetries = 3;
					for (let att = 0; att < parseRetries; att++) {
						if (context?.signal?.aborted) {
							const err = new Error('Aborted');
							err.name = 'AbortError';
							throw err;
						}
						const maxTok =
							this.resolveClassicOutputMaxTokens(batch) + att * 3072;
						try {
							const text = await this.invokeEnglishPackSubModelJson({
								system: systemThisRound,
								user: userForModel,
								maxTokens: maxTok,
								priorThread:
									context?.userId != null ? packAgentThread : undefined,
								signal: context?.signal,
							});
							const parsed = this.extractJsonObject(text);
							batchItems = this.extractClassicQuoteItemsLoose(parsed);
							if (context?.userId != null && text.trim()) {
								const threadAi =
									batchItems.length > 0
										? this.buildPackAgentThreadAssistantSnapshot(
												'classic_quotes',
												batchItems,
											)
										: text.trim().slice(0, 4000);
								if (userForModel.trim().length > 0) {
									packAgentThread.push(
										new HumanMessage(userForModel),
										new AIMessage(threadAi),
									);
								} else {
									packAgentThread.push(
										new HumanMessage(' '),
										new AIMessage(threadAi),
									);
								}
								const trimmed = this.trimPackAgentThread(
									packAgentThread,
									PACK_AGENT_THREAD_MAX_MESSAGES,
								);
								packAgentThread.splice(0, packAgentThread.length, ...trimmed);
							}
							break;
						} catch (e: unknown) {
							if (context?.signal?.aborted || this.isAbortLike(e)) {
								throw e;
							}
							// 首轮最后一次解析失败，直接抛异常
							if (accumulated.length === 0 && att === parseRetries - 1) {
								throw e;
							}
							// 其他情况下只记录警告日志，并继续重试
							this.logger.warn(
								`[EnglishLearning] classic quotes JSON 解析重试 ${att + 1}/${parseRetries}`,
								e,
							);
						}
					}

					// 若超出应采条数，仅保留前 batch 条
					if (batchItems.length > batch) {
						batchItems = batchItems.slice(0, batch);
					}

					// 首轮未生成内容或解析彻底失败，直接报错终止输出
					if (batchItems.length === 0 && accumulated.length === 0) {
						throw new HttpException(
							'经典语句为空或无法解析为有效条目',
							HttpStatus.BAD_GATEWAY,
						);
					}

					// 清空本轮新增列表（复用对象节省分配），初始化累加计数
					newItemsThisRound.length = 0;
					added = 0;
					// 对本批次条目做归一化去重、判空
					for (const item of batchItems) {
						const key = item.english.toLowerCase().trim().slice(0, 400); // 归一化key
						if (!key || seen.has(key)) continue; // 忽略空串或前面已出现过的句子
						seen.add(key); // 记入去重集合
						accumulated.push(item); // 加入总集
						newItemsThisRound.push(item); // 收录本轮新增
						added++;
						if (accumulated.length >= count) break; // 达标立即退出，防止多生成
					}
					if (added > 0) break; // 本轮若有新增，则不用继续 dupPass
					if (batchItems.length === 0) break; // 若LLM逐轮输出为空则提前终止
				}

				// 每轮回调一下进度信息（支持异步/同步回调）
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

				// 按累计条数/目标条数和“本轮”实际新增量，计算允许最大停滞轮数
				const stallLimit = this.resolveStallBreakWithGap(
					count,
					accumulated.length,
				);
				if (added === 0) {
					// 无新增，stall计数递增
					stall++;
					// 若LLM有输出，但全是重复，则调低下批请求量
					if (batchItems.length > 0) {
						batchCap = Math.max(
							TOPIC_PACK_STALL_BATCH_FLOOR,
							batchCap - TOPIC_PACK_STALL_BATCH_STEP,
						);
					}
					// 超过stall阈值，终止主循环（防死锁/死循环）
					if (stall >= stallLimit) {
						this.logger.warn(
							`[EnglishLearning] classic quotes stalled at ${accumulated.length}/${count} (stallLimit=${stallLimit})`,
						);
						break;
					}
				} else {
					// 有新增，stall归零且下一批略增容
					stall = 0;
					batchCap = Math.min(TOPIC_PACK_ITEMS_PER_ROUND, batchCap + 1);
				}
			}

			// 若最后一无所获，直接报错
			if (accumulated.length === 0) {
				throw new HttpException(
					'未得到有效经典语句（需含 english 与 translationZh）',
					HttpStatus.BAD_GATEWAY,
				);
			}

			// 返回目标条数条目（若早停则不足 count，无则前面已抛异常）
			return accumulated.slice(0, count);
		} catch (e: unknown) {
			// 主逻辑异常捕获，若已是 HttpException 直接上抛，否则包裹成统一 HttpException
			if (e instanceof HttpException) throw e;
			if (this.isAbortLike(e) || context?.signal?.aborted) {
				if (accumulated.length === 0) {
					throw new HttpException(
						'生成已中止，尚未得到有效经典语句',
						HttpStatus.BAD_GATEWAY,
					);
				}
				this.logger.warn(
					`[EnglishLearning] 经典句生成已中止，返回已收集 ${accumulated.length} 条`,
				);
				return accumulated.slice(0, count);
			}
			this.logger.warn('[EnglishLearning] classic quotes generation failed', e);
			throw new HttpException(
				'生成经典语句失败，请稍后重试',
				HttpStatus.BAD_GATEWAY,
			);
		}
	}

	/**
	 * 生成一组经典英语句型（“经典句包”）。
	 *
	 * - 调用 runClassicQuotesGeneration 方法，根据传入的 dto（主题、目标个数等）生成句子集合。
	 * - 可指定 opts.userId，便于在个性化上下文/多轮会话时长期追踪。
	 * - 返回格式为 { items }，其中 items 为 ClassicQuoteItemDto[]，即经典句条目的数组。
	 * - 典型用例包含 AI 大模型题材能力评测、素材采集、写作学习等。
	 *
	 * @param dto 配置生成参数，例如 topic、targetCount（条数）等
	 * @param opts 可选项，包括 userId
	 * @returns items: ClassicQuoteItemDto[] 经典句结果数组
	 */
	async generateClassicQuotesPack(
		dto: GenerateClassicQuotesDto,
		opts?: { userId?: number },
	): Promise<{ items: ClassicQuoteItemDto[] }> {
		// 调用核心生成逻辑，返回本次生成的经典句数组
		const items = await this.runClassicQuotesGeneration(dto, undefined, opts);
		// 外部统一格式封装返回
		return { items };
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
		const wsRows = await this.packWebSearchRepo.find({
			where: { userId, streamId: In(streamIds), packKind: 'vocabulary' },
		});
		const wsCountByStream = new Map<string, number>();
		for (const w of wsRows) {
			wsCountByStream.set(
				w.streamId,
				Array.isArray(w.searchRounds) ? w.searchRounds.length : 0,
			);
		}

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
				targetCount: first?.targetCount ?? 0,
				wordCount,
				createdAt: new Date(g.createdAt).toISOString(),
				updatedAt: new Date(g.updatedAt).toISOString(),
				webSearchRoundCount: wsCountByStream.get(g.streamId) ?? 0,
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
		targetCount: number;
		items: VocabularyItemDto[];
		createdAt: string;
		/** 与本次拉取关联的主检索联网记录（按轮次顺序） */
		webSearchRounds: EnglishPackWebSearchRoundJson[];
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
		const ws = await this.packWebSearchRepo.findOne({
			where: { userId, streamId, packKind: 'vocabulary' },
		});
		return {
			streamId,
			topic: first.topic,
			targetCount: first.targetCount,
			items,
			createdAt: first.createdAt.toISOString(),
			webSearchRounds: Array.isArray(ws?.searchRounds) ? ws.searchRounds : [],
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
		const wsRows = await this.packWebSearchRepo.find({
			where: { userId, streamId: In(streamIds), packKind: 'classic_quotes' },
		});
		const wsCountByStream = new Map<string, number>();
		for (const w of wsRows) {
			wsCountByStream.set(
				w.streamId,
				Array.isArray(w.searchRounds) ? w.searchRounds.length : 0,
			);
		}

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
				targetCount: first?.targetCount ?? 0,
				quoteCount,
				createdAt: new Date(g.createdAt).toISOString(),
				updatedAt: new Date(g.updatedAt).toISOString(),
				webSearchRoundCount: wsCountByStream.get(g.streamId) ?? 0,
			};
		});
	}

	async getClassicQuotesHistoryDetail(
		userId: number,
		streamId: string,
	): Promise<{
		streamId: string;
		topic: string;
		targetCount: number;
		items: ClassicQuoteItemDto[];
		createdAt: string;
		webSearchRounds: EnglishPackWebSearchRoundJson[];
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
		const ws = await this.packWebSearchRepo.findOne({
			where: { userId, streamId, packKind: 'classic_quotes' },
		});
		return {
			streamId,
			topic: first.topic,
			targetCount: first.targetCount,
			items,
			createdAt: first.createdAt.toISOString(),
			webSearchRounds: Array.isArray(ws?.searchRounds) ? ws.searchRounds : [],
		};
	}
}
