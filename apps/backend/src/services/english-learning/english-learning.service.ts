import { createHash } from 'node:crypto';
import {
	AIMessage,
	type AIMessageChunk,
	type BaseMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import {
	BadRequestException,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createAgent, toolCallLimitMiddleware } from 'langchain';
import { DataSource, In, Repository } from 'typeorm';
import { buildAgentLangChainTools } from '../../services/agent/agent-tools';
import { KnowledgeEmbeddingService } from '../../services/knowledge-embedding/knowledge-embedding.service';
import { KnowledgeQaService } from '../../services/knowledge-qa/knowledge-qa.service';
import { WebSearchService } from '../../services/web-search/web-search.service';
import type {
	WebSearchOrganicItem,
	WebSearchRecencyPreset,
} from '../../services/web-search/web-search.types';
import { createLlm } from '../../utils/create-llm';
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
	PACK_GENERATION_DB_EXCLUDE_MAX_KEYS,
	PACK_GENERATION_FAVORITE_EXCLUDE_LIMIT,
	PACK_GENERATION_MASTER_EXISTING_HINT_MAX_CHARS,
	PACK_GENERATION_MASTER_HINT_SAMPLE_ITEMS,
	PACK_GENERATION_TOPIC_HISTORY_BATCH_ROWS,
	PACK_GENERATION_TOPIC_MATCH_LIBRARIES,
	PACK_HISTORY_ITEMS_PAGE_MAX,
	PACK_SSE_DATABASE_EMIT_CHUNK_SIZE,
	PACK_TOPIC_LIBRARY_ITEMS_PAGE_SIZE,
	PACK_TOPIC_VECTOR_MATCH_MAX_LABELS,
	PACK_TOPIC_VECTOR_SIMILARITY_MIN,
	TOPIC_PACK_EXCLUDE_CLASSIC_ITEM_MAX_CHARS,
	TOPIC_PACK_EXCLUDE_CLASSIC_TAIL_ITEMS,
	TOPIC_PACK_EXCLUDE_PROMPT_MAX_CHARS,
	TOPIC_PACK_EXCLUDE_TAIL,
	TOPIC_PACK_ITEMS_PER_ROUND,
	TOPIC_PACK_STALL_BATCH_FLOOR,
	TOPIC_PACK_STALL_BATCH_STEP,
} from './constant';
import {
	ENGLISH_CLASSIC_QUOTES_GENERATION_MAX,
	ENGLISH_VOCAB_GENERATION_MAX,
	GenerateClassicQuotesDto,
	GenerateVocabularyDto,
	resolveClassicQuotesPackTargetCount,
	resolveVocabularyPackTargetCount,
} from './dto/generate-vocabulary.dto';
import { SaveClassicQuotesLibraryDto } from './dto/save-classic-quotes-library.dto';
import { SaveVocabularyLibraryDto } from './dto/save-vocabulary-library.dto';
import type { VocabularyFavoriteBodyDto } from './dto/vocabulary-favorite.dto';
import {
	buildClassicQuoteFavoritesDocxBuffer,
	buildVocabularyFavoritesDocxBuffer,
} from './english-favorites-docx.builder';
import {
	type EnglishClassicQuoteItemJson,
	EnglishClassicQuotePackBatch,
} from './entity/english-classic-quote.entity';
import { EnglishClassicQuoteFavorite } from './entity/english-classic-quote-favorite.entity';
import { EnglishClassicQuotesLibrary } from './entity/english-classic-quotes-library.entity';
import { EnglishClassicQuotesLibraryItem } from './entity/english-classic-quotes-library-item.entity';
import { EnglishClassicQuotesPackItem } from './entity/english-classic-quotes-pack-item.entity';
import { EnglishClassicQuotesPackSession } from './entity/english-classic-quotes-pack-session.entity';
import {
	EnglishPackWebSearchRecord,
	type EnglishPackWebSearchRoundJson,
} from './entity/english-pack-web-search.entity';
import {
	EnglishVocabularyPackBatch,
	type EnglishVocabularyPackItemJson,
} from './entity/english-vocabulary.entity';
import { EnglishVocabularyFavorite } from './entity/english-vocabulary-favorite.entity';
import { EnglishVocabularyLibrary } from './entity/english-vocabulary-library.entity';
import { EnglishVocabularyLibraryItem } from './entity/english-vocabulary-library-item.entity';
import { EnglishVocabularyPackItem } from './entity/english-vocabulary-pack-item.entity';
import { EnglishVocabularyPackSession } from './entity/english-vocabulary-pack-session.entity';
import {
	AGENT_SYSTEM_PROMPT,
	CLASSIC_QUOTES_SUBMODEL_SYSTEM_STATIC,
	ENGLISH_PACK_LEARNER_CONTEXT_HINT,
	VOCABULARY_PACK_SUBMODEL_SYSTEM_STATIC,
} from './prompt';
/** 同主题匹配索引：一次生成内复用，避免重复调 embedding */
export type PackTopicMatchIndex = {
	isRelated: (sourceLabel: string) => boolean;
};

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
	/** 命中库内同主题资料，未调用大模型 */
	fromDatabase?: boolean;
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
	/** 词性英文缩写，如 n、v、adj（旧数据或解析失败时可为空串） */
	pos: string;
	/** 音节划分，如 ap·ple（旧数据或解析失败时可为空串） */
	segmentation: string;
	translationZh: string;
	example: string;
};

/** 单词库（包）列表项 */
export type VocabularyLibraryListItem = {
	id: string;
	title: string;
	wordCount: number;
	createdAt: string;
};

/** 单词库内单条词条（分页列表） */
export type VocabularyLibraryItemDto = VocabularyItemDto & {
	id: string;
	sortOrder: number;
};

/** 经典语句库（包）列表项 */
export type ClassicQuotesLibraryListItem = {
	id: string;
	title: string;
	quoteCount: number;
	createdAt: string;
};

/** 经典语句库内单条（分页列表） */
export type ClassicQuotesLibraryItemDto = ClassicQuoteItemDto & {
	id: string;
	sortOrder: number;
};

/** 单词包生成进度（供 SSE 与回调） */
export type VocabularyGenerationProgress = {
	collected: number;
	target: number;
	round: number;
	/** 本轮 LLM 解析后新并入总列表的词条（去重后）；无新增时不传 */
	newItems?: VocabularyItemDto[];
	/** 命中库内同主题资料，未调用大模型 */
	fromDatabase?: boolean;
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
 * 英语学习辅助：主从结构 — 主 Agent（硅基流动 + 工具）负责检索；子模型仅 JSON 模式输出词条/句子，不绑工具。
 */
@Injectable()
export class EnglishLearningService {
	private readonly logger = new Logger(EnglishLearningService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly configService: ConfigService,
		private readonly webSearchService: WebSearchService,
		private readonly knowledgeQaService: KnowledgeQaService,
		private readonly knowledgeEmbedding: KnowledgeEmbeddingService,
		@InjectRepository(EnglishVocabularyPackSession)
		private readonly vocabPackSessionRepo: Repository<EnglishVocabularyPackSession>,
		@InjectRepository(EnglishVocabularyPackItem)
		private readonly vocabPackItemRepo: Repository<EnglishVocabularyPackItem>,
		@InjectRepository(EnglishClassicQuotesPackSession)
		private readonly classicPackSessionRepo: Repository<EnglishClassicQuotesPackSession>,
		@InjectRepository(EnglishClassicQuotesPackItem)
		private readonly classicPackItemRepo: Repository<EnglishClassicQuotesPackItem>,
		@InjectRepository(EnglishPackWebSearchRecord)
		private readonly packWebSearchRepo: Repository<EnglishPackWebSearchRecord>,
		@InjectRepository(EnglishVocabularyFavorite)
		private readonly vocabFavoriteRepo: Repository<EnglishVocabularyFavorite>,
		@InjectRepository(EnglishClassicQuoteFavorite)
		private readonly classicQuoteFavoriteRepo: Repository<EnglishClassicQuoteFavorite>,
		@InjectRepository(EnglishVocabularyLibrary)
		private readonly vocabLibraryRepo: Repository<EnglishVocabularyLibrary>,
		@InjectRepository(EnglishVocabularyLibraryItem)
		private readonly vocabLibraryItemRepo: Repository<EnglishVocabularyLibraryItem>,
		@InjectRepository(EnglishClassicQuotesLibrary)
		private readonly classicQuotesLibraryRepo: Repository<EnglishClassicQuotesLibrary>,
		@InjectRepository(EnglishClassicQuotesLibraryItem)
		private readonly classicQuotesLibraryItemRepo: Repository<EnglishClassicQuotesLibraryItem>,
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
	 * 主题是否具时效性（今日/近期/新闻/显式日期等）。
	 * 与主 Agent 联网 recency 判断一致：此类不走库内直出/预填，统一走 Agent + 子模型。
	 */
	private isPackTopicTimeSensitive(topic: string): boolean {
		return this.resolveWebSearchTime(topic).recency !== 'none';
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

	/** 从 LLM JSON 行对象解析词性缩写（兼容多种键名） */
	private parseVocabularyPosFromJsonRow(r: Record<string, unknown>): string {
		const raw =
			(typeof r.pos === 'string' && r.pos) ||
			(typeof r.posAbbr === 'string' && r.posAbbr) ||
			(typeof r.pos_abbr === 'string' && r.pos_abbr) ||
			(typeof r.partOfSpeech === 'string' && r.partOfSpeech) ||
			(typeof r.part_of_speech === 'string' && r.part_of_speech) ||
			(typeof r.speech === 'string' && r.speech) ||
			'';
		return raw.trim().slice(0, 32);
	}

	/** 从 JSON 行对象解析音节划分（兼容 segmentation / syllables 等键名） */
	private parseVocabularySegmentationFromJsonRow(
		r: Record<string, unknown>,
	): string {
		const raw =
			(typeof r.segmentation === 'string' && r.segmentation) ||
			(typeof r.syllables === 'string' && r.syllables) ||
			(typeof r.syllable === 'string' && r.syllable) ||
			'';
		return raw.trim().slice(0, 500);
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

	/** 与 runVocabularyGeneration 内 seen 一致 */
	private normalizePackVocabKey(word: string): string {
		return word.trim().toLowerCase();
	}

	/** 与 runClassicQuotesGeneration 内 seen 一致 */
	private normalizePackClassicEnglishKey(english: string): string {
		return english.toLowerCase().trim().slice(0, 400);
	}

	/** 为候选标签建立主题相关索引：完全相等快速命中，其余走 KnowledgeEmbedding 向量比对 */
	private async buildPackTopicMatchIndex(
		topic: string,
		labels: Iterable<string>,
	): Promise<PackTopicMatchIndex> {
		const topicTrim = topic.trim();
		const topicKey = topicTrim.toLowerCase();
		const relatedKeys = new Set<string>();
		const candidates: { key: string; text: string }[] = [];
		const seenKeys = new Set<string>();

		for (const raw of labels) {
			const text = typeof raw === 'string' ? raw.trim() : '';
			if (!text) continue;
			const key = text.toLowerCase();
			if (seenKeys.has(key)) continue;
			seenKeys.add(key);
			if (topicKey && key === topicKey) {
				relatedKeys.add(key);
				continue;
			}
			candidates.push({ key, text });
		}

		if (topicTrim && candidates.length > 0) {
			const capped = candidates.slice(0, PACK_TOPIC_VECTOR_MATCH_MAX_LABELS);
			try {
				const matched =
					await this.knowledgeEmbedding.findCandidateIndicesSimilarToQuery({
						query: topicTrim,
						candidates: capped.map((x) => x.text),
						minCosineSimilarity: PACK_TOPIC_VECTOR_SIMILARITY_MIN,
					});
				for (const idx of matched) {
					const item = capped[idx];
					if (item) relatedKeys.add(item.key);
				}
			} catch (e: unknown) {
				this.logger.warn(
					'[EnglishLearning] 主题向量匹配失败，同主题库/历史批次将不参与匹配',
					e,
				);
			}
		}

		return {
			isRelated: (sourceLabel: string) => {
				const k = sourceLabel.trim().toLowerCase();
				return k.length > 0 && relatedKeys.has(k);
			},
		};
	}

	/** 合并历史批次 topic 与库标题，按 trim 后小写去重（保留首次出现的原文） */
	/** 大批量库内数据分多帧 progress/chunk 推送，避免单次 SSE 过大 */
	private async emitPackNewItemsInChunks<T>(params: {
		onProgress?: (p: {
			collected: number;
			target: number;
			round: number;
			newItems?: T[];
			fromDatabase?: boolean;
		}) => void | Promise<void>;
		items: T[];
		target: number;
		fromDatabase?: boolean;
		startRound?: number;
		chunkSize?: number;
	}): Promise<void> {
		const { onProgress, items, target, fromDatabase, startRound = 1 } = params;
		if (!onProgress || items.length === 0) return;
		const chunkSize = params.chunkSize ?? PACK_SSE_DATABASE_EMIT_CHUNK_SIZE;
		if (items.length <= chunkSize) {
			await Promise.resolve(
				onProgress({
					collected: items.length,
					target,
					round: startRound,
					newItems: items,
					fromDatabase,
				}),
			);
			return;
		}
		let collected = 0;
		let round = startRound;
		for (let i = 0; i < items.length; i += chunkSize) {
			const slice = items.slice(i, i + chunkSize);
			collected += slice.length;
			await Promise.resolve(
				onProgress({
					collected,
					target,
					round,
					newItems: slice,
					fromDatabase,
				}),
			);
			round += 1;
		}
	}

	/**
	 * 收集去重后的 topic/title 标签（如单词批次主题、库标题等）。
	 *
	 * 说明：
	 * - 支持任意数量的标签集合传入（每个集合为 Iterable），参数 groups 数组展开。
	 * - 每个集合可以是字符串、null 或 undefined 的混合类型。
	 * - 对所有集合中出现的标签，统一进行 trim 去首尾空白、toLowerCase 小写，使用小写字符串做唯一性标记（防止大小写或空白差异重复）。
	 * - 仅保留首次出现的原文（即首个未遇到其小写等价物的 text），顺序与原始输入顺序一致。
	 * - 返回去重后的标签数组，适合作为主题索引、显示等用途。
	 *
	 * @param groups 各种可迭代的标签集合（如批次主题、库标题）
	 * @returns 去重后的原始标签数组（保持首出现顺序）
	 */
	private collectUniquePackTopicLabels(
		...groups: Iterable<string | null | undefined>[]
	): string[] {
		const seen = new Set<string>(); // 存放所有已遇到的小写标签，用于判重
		const out: string[] = []; // 存放已收集的唯一原始标签，顺序与输入一致
		for (const group of groups) {
			for (const raw of group) {
				// 若 raw 是字符串则去除前后空白，否则视为空
				const text = typeof raw === 'string' ? raw.trim() : '';
				if (!text) continue; // 跳过空字符串和 null/undefined
				const key = text.toLowerCase(); // 小写化用于判重
				if (seen.has(key)) continue; // 已收集过则跳过
				seen.add(key);
				out.push(text); // 保留原始内容（含大小写/空白）
			}
		}
		return out;
	}

	/**
	 * 为指定用户根据其历史批次和资料库中的主题/标题收集标签，生成 topic 匹配索引
	 * @param userId 用户ID
	 * @param topic 当前请求主题
	 * @param kind 类型（'vocabulary' 单词包|'classic_quotes' 经典句）
	 * @returns 主题匹配索引
	 */
	private async createPackTopicMatchIndexForUser(
		userId: number, // 当前用户ID
		topic: string, // 目标主题
		kind: 'vocabulary' | 'classic_quotes', // 资料包类型
	): Promise<PackTopicMatchIndex> {
		let labels: string[]; // 存放去重后的主题/标题标签
		if (kind === 'vocabulary') {
			const [sessions, libraries] = await Promise.all([
				this.vocabPackSessionRepo.find({
					where: { userId },
					order: { updatedAt: 'DESC' },
					take: PACK_GENERATION_TOPIC_HISTORY_BATCH_ROWS,
				}),
				this.vocabLibraryRepo.find({
					where: { userId },
					order: { createdAt: 'DESC' },
					take: 40,
				}),
			]);
			labels = this.collectUniquePackTopicLabels(
				sessions.map((s) => s.topic),
				libraries.map((lib) => lib.title),
			);
		} else {
			const [sessions, libraries] = await Promise.all([
				this.classicPackSessionRepo.find({
					where: { userId },
					order: { updatedAt: 'DESC' },
					take: PACK_GENERATION_TOPIC_HISTORY_BATCH_ROWS,
				}),
				this.classicQuotesLibraryRepo.find({
					where: { userId },
					order: { createdAt: 'DESC' },
					take: 40,
				}),
			]);
			labels = this.collectUniquePackTopicLabels(
				sessions.map((s) => s.topic),
				libraries.map((lib) => lib.title),
			);
		}
		// 调用工具函数生成主题匹配索引，便于后续匹配/去重
		return this.buildPackTopicMatchIndex(topic, labels);
	}

	/**
	 * 向 keys 集合中添加新的去重 key（如单词或句子），用于后续生成时排除重复项。
	 *
	 * @param keys 当前已收集的 key 集合（Set），会原地添加新 key
	 * @param rawKeys 原始 key 的可迭代对象（如字符串数组或 Set），每个元素会被去首尾空格
	 * @param maxKeys 限制 keys 总数量，超出后停止添加
	 */
	private addPackExcludeKeys(
		keys: Set<string>,
		rawKeys: Iterable<string>,
		maxKeys: number,
	): void {
		if (keys.size >= maxKeys) return; // 已达上限则不处理
		for (const raw of rawKeys) {
			const k = raw.trim(); // 去除首尾空白
			if (!k) continue; // 忽略空字符串
			keys.add(k); // 添加去重 key
			if (keys.size >= maxKeys) break; // 达到最大数后立即终止
		}
	}

	/**
	 * 生成前从 DB 加载去重键（同主题历史 + 标题相关导入库 + 收藏），并入子模型 seen。
	 * 全集进内存 Set；写入 prompt 时仍由 buildSeenKeysExcludePromptForModel 按字符上限节选。
	 */
	/**
	 * 加载当前主题与用户相关、用作去重的 key 集合（如单词或经典句），
	 * 包含：同主题历史生成批次、相关资料库、收藏等，合并最大 maxKeys 项。
	 * @param params.userId 用户ID
	 * @param params.topic 主题内容
	 * @param params.kind 包类型（"vocabulary" | "classic_quotes"）
	 * @param params.topicMatch 主题索引，若不传则自动创建
	 * @returns Set<string> 全部去重 key 的集合
	 */
	private async loadExistingPackKeysForGeneration(params: {
		userId: number; // 用户 ID
		topic: string; // 目标主题
		kind: 'vocabulary' | 'classic_quotes'; // 包类型：单词 or 经典句
		topicMatch?: PackTopicMatchIndex; // （可选）主题匹配索引
	}): Promise<Set<string>> {
		const { userId, topic, kind, topicMatch: topicMatchIn } = params; // 解构参数
		const keys = new Set<string>(); // 存放最终所有去重 key 的集合
		const maxKeys = PACK_GENERATION_DB_EXCLUDE_MAX_KEYS; // 最大去重 key 数
		const topicMatch =
			topicMatchIn ?? // 使用外部传入的主题匹配对象（如果有）
			(await this.createPackTopicMatchIndexForUser(userId, topic, kind)); // 否则基于用户和主题新生成一个匹配索引

		// 词包类型
		if (kind === 'vocabulary') {
			const sessions = await this.vocabPackSessionRepo.find({
				where: { userId },
				order: { updatedAt: 'DESC' },
				take: PACK_GENERATION_TOPIC_HISTORY_BATCH_ROWS,
			});
			for (const s of sessions) {
				if (!topicMatch.isRelated(s.topic)) continue;
				if (keys.size >= maxKeys) break;
				const rows = await this.vocabPackItemRepo.find({
					where: { userId, streamId: s.streamId },
					select: ['word'],
					order: { sortOrder: 'DESC' },
					take: maxKeys - keys.size,
				});
				this.addPackExcludeKeys(
					keys,
					rows.map((r) => this.normalizePackVocabKey(r.word)),
					maxKeys,
				);
			}

			// 2. 查找资料库并筛选主题相关的库
			const libraries = await this.vocabLibraryRepo.find({
				where: { userId },
				order: { createdAt: 'DESC' },
				take: 40, // 限制最多查 40 个库
			});
			// 过滤与主题相关的库，限制每次处理的库数量
			const libIds = libraries
				.filter((lib) => topicMatch.isRelated(lib.title)) // 仅主题相关
				.slice(0, PACK_GENERATION_TOPIC_MATCH_LIBRARIES) // 最多 N 个库
				.map((lib) => lib.id); // 取出各库的ID
			// 读取相关库中的单词项
			if (libIds.length > 0 && keys.size < maxKeys) {
				const rows = await this.vocabLibraryItemRepo.find({
					where: { userId, libraryId: In(libIds) }, // 属于目标库
					select: ['word'], // 仅取 word 字段
					take: maxKeys - keys.size, // 剩余可加 key 数
				});
				this.addPackExcludeKeys(
					keys,
					rows.map((r) => this.normalizePackVocabKey(r.word)), // 标准化 key
					maxKeys,
				);
			}

			// 3. 加入用户收藏夹中的单词（如还未超限）
			if (keys.size < maxKeys) {
				const favs = await this.vocabFavoriteRepo.find({
					where: { userId }, // 当前用户
					select: ['wordKey'], // 只要 key
					order: { createdAt: 'DESC' }, // 新到旧
					take: PACK_GENERATION_FAVORITE_EXCLUDE_LIMIT, // 限数量
				});
				this.addPackExcludeKeys(
					keys,
					favs.map((f) => f.wordKey), // 收藏本身已标准化，无需再 normalize
					maxKeys,
				);
			}
		} else {
			const sessions = await this.classicPackSessionRepo.find({
				where: { userId },
				order: { updatedAt: 'DESC' },
				take: PACK_GENERATION_TOPIC_HISTORY_BATCH_ROWS,
			});
			for (const s of sessions) {
				if (!topicMatch.isRelated(s.topic)) continue;
				if (keys.size >= maxKeys) break;
				const rows = await this.classicPackItemRepo.find({
					where: { userId, streamId: s.streamId },
					select: ['english'],
					order: { sortOrder: 'DESC' },
					take: maxKeys - keys.size,
				});
				this.addPackExcludeKeys(
					keys,
					rows.map((r) => this.normalizePackClassicEnglishKey(r.english)),
					maxKeys,
				);
			}

			// 2. 资料库相关（经典句库）
			const libraries = await this.classicQuotesLibraryRepo.find({
				where: { userId },
				order: { createdAt: 'DESC' },
				take: 40, // 最多查40个库
			});
			const libIds = libraries
				.filter((lib) => topicMatch.isRelated(lib.title)) // 主题相关
				.slice(0, PACK_GENERATION_TOPIC_MATCH_LIBRARIES) // 限最大数
				.map((lib) => lib.id); // 取出ID
			if (libIds.length > 0 && keys.size < maxKeys) {
				const rows = await this.classicQuotesLibraryItemRepo.find({
					where: { userId, libraryId: In(libIds) }, // 目标库
					select: ['english'], // 仅查英文字段
					take: maxKeys - keys.size,
				});
				this.addPackExcludeKeys(
					keys,
					rows.map((r) => this.normalizePackClassicEnglishKey(r.english)), // 标准化 key
					maxKeys,
				);
			}

			// 3. 用户收藏夹中的经典句
			if (keys.size < maxKeys) {
				const favs = await this.classicQuoteFavoriteRepo.find({
					where: { userId }, // 用户
					select: ['english'], // 只要英文内容
					order: { createdAt: 'DESC' }, // 新到旧
					take: PACK_GENERATION_FAVORITE_EXCLUDE_LIMIT, // 限数量
				});
				this.addPackExcludeKeys(
					keys,
					favs.map((f) => this.normalizePackClassicEnglishKey(f.english)), // 标准化
					maxKeys,
				);
			}
		}

		return keys; // 返回所有去重 key
	}

	private tryPushVocabItemDeduped(
		out: VocabularyItemDto[],
		seen: Set<string>,
		item: VocabularyItemDto,
		limit: number,
	): void {
		if (out.length >= limit) return;
		const key = this.normalizePackVocabKey(item.word);
		if (!key || seen.has(key)) return;
		seen.add(key);
		out.push(item);
	}

	/**
	 * 分页读取指定用户的单词库条目，并进行去重、筛选，直至 items 满足 limit 或库内无更多条目。
	 * 该方法用于合成单词包时优先利用用户自己的词库资源，减少大模型资源消耗。
	 *
	 * @param userId 用户 ID
	 * @param libraryId 单词库 ID
	 * @param items 累积结果的输出数组（外部传入，自动累加）
	 * @param seen 已收录的单词 key（用于去重）
	 * @param limit 需要补足的目标数量
	 */
	private async loadVocabItemsFromLibraryPaginated(
		userId: number,
		libraryId: string,
		items: VocabularyItemDto[],
		seen: Set<string>,
		limit: number,
	): Promise<void> {
		let skip = 0; // 用于分页查询的偏移量
		while (items.length < limit) {
			// 分页查询单词库条目，按 sortOrder 升序排序
			const rows = await this.vocabLibraryItemRepo.find({
				where: { userId, libraryId },
				order: { sortOrder: 'ASC' },
				take: PACK_TOPIC_LIBRARY_ITEMS_PAGE_SIZE, // 每页条数
				skip, // 跳过已处理条目
			});
			if (rows.length === 0) break; // 库内已无更多条目，提前退出

			// 遍历当前页查询出的单词库条目，将符合去重条件的单词加入结果集
			for (const row of rows) {
				this.tryPushVocabItemDeduped(
					items, // 累加输出的目标数组
					seen, // 去重依据的已见单词集合
					{
						word: row.word,
						ipa: row.ipa ?? '',
						pos: row.pos ?? '',
						segmentation: row.segmentation ?? '',
						translationZh: row.translationZh,
						example: row.example ?? '—',
					},
					limit, // 目标数量
				);
				if (items.length >= limit) return; // 达到上限立即返回
			}
			skip += rows.length; // 增加偏移量，准备下一页
			if (rows.length < PACK_TOPIC_LIBRARY_ITEMS_PAGE_SIZE) break; // 本页不足一页剩余，说明已读完
		}
	}

	/** 同主题：导入库 + 历史批次中的完整词条（用于命中则直接返回，不走大模型） */
	private async loadTopicRelatedVocabularyItemsFromDb(
		userId: number,
		topic: string,
		limit: number,
		topicMatch?: PackTopicMatchIndex,
	): Promise<VocabularyItemDto[]> {
		const items: VocabularyItemDto[] = [];
		const seen = new Set<string>();
		const match =
			topicMatch ??
			(await this.createPackTopicMatchIndexForUser(
				userId,
				topic,
				'vocabulary',
			));

		const libraries = await this.vocabLibraryRepo.find({
			where: { userId },
			order: { createdAt: 'DESC' },
			take: 40,
		});
		const libIds = libraries
			.filter((lib) => match.isRelated(lib.title))
			.slice(0, PACK_GENERATION_TOPIC_MATCH_LIBRARIES)
			.map((lib) => lib.id);

		for (const libraryId of libIds) {
			if (items.length >= limit) break;
			await this.loadVocabItemsFromLibraryPaginated(
				userId,
				libraryId,
				items,
				seen,
				limit,
			);
		}

		const sessions = await this.vocabPackSessionRepo.find({
			where: { userId },
			order: { updatedAt: 'DESC' },
			take: PACK_GENERATION_TOPIC_HISTORY_BATCH_ROWS,
		});
		for (const s of sessions) {
			if (items.length >= limit) break;
			if (!match.isRelated(s.topic)) continue;
			await this.loadVocabItemsFromPackSessionPaginated(
				userId,
				s.streamId,
				items,
				seen,
				limit,
			);
		}

		return items;
	}

	/** 从单次拉取会话分页读取词条，直至凑满 limit */
	private async loadVocabItemsFromPackSessionPaginated(
		userId: number,
		streamId: string,
		items: VocabularyItemDto[],
		seen: Set<string>,
		limit: number,
	): Promise<void> {
		let skip = 0;
		while (items.length < limit) {
			const rows = await this.vocabPackItemRepo.find({
				where: { userId, streamId },
				order: { sortOrder: 'ASC' },
				take: PACK_TOPIC_LIBRARY_ITEMS_PAGE_SIZE,
				skip,
			});
			if (rows.length === 0) break;
			for (const row of rows) {
				this.tryPushVocabItemDeduped(
					items,
					seen,
					this.mapVocabPackItemRow(row),
					limit,
				);
				if (items.length >= limit) return;
			}
			skip += rows.length;
			if (rows.length < PACK_TOPIC_LIBRARY_ITEMS_PAGE_SIZE) break;
		}
	}

	private mapVocabPackItemRow(
		row: EnglishVocabularyPackItem,
	): VocabularyItemDto {
		return {
			word: row.word,
			ipa: row.ipa,
			pos: typeof row.pos === 'string' ? row.pos.trim() : '',
			segmentation:
				typeof row.segmentation === 'string' ? row.segmentation.trim() : '',
			translationZh: row.translationZh,
			example: row.example,
		};
	}

	private tryPushClassicItemDeduped(
		out: ClassicQuoteItemDto[],
		seen: Set<string>,
		item: ClassicQuoteItemDto,
		limit: number,
	): void {
		if (out.length >= limit) return;
		const key = this.normalizePackClassicEnglishKey(item.english);
		if (!key || seen.has(key)) return;
		seen.add(key);
		out.push(item);
	}

	/** 从单个经典语句库分页读取，直至凑满 limit 或库内无更多行 */
	private async loadClassicItemsFromLibraryPaginated(
		userId: number,
		libraryId: string,
		items: ClassicQuoteItemDto[],
		seen: Set<string>,
		limit: number,
	): Promise<void> {
		let skip = 0;
		while (items.length < limit) {
			const rows = await this.classicQuotesLibraryItemRepo.find({
				where: { userId, libraryId },
				order: { sortOrder: 'ASC' },
				take: PACK_TOPIC_LIBRARY_ITEMS_PAGE_SIZE,
				skip,
			});
			if (rows.length === 0) break;
			for (const row of rows) {
				this.tryPushClassicItemDeduped(
					items,
					seen,
					{
						english: row.english,
						translationZh: row.translationZh,
						source: row.source ?? '—',
						noteZh: row.noteZh ?? '—',
					},
					limit,
				);
				if (items.length >= limit) return;
			}
			skip += rows.length;
			if (rows.length < PACK_TOPIC_LIBRARY_ITEMS_PAGE_SIZE) break;
		}
	}

	private async loadTopicRelatedClassicQuotesFromDb(
		userId: number,
		topic: string,
		limit: number,
		topicMatch?: PackTopicMatchIndex,
	): Promise<ClassicQuoteItemDto[]> {
		const items: ClassicQuoteItemDto[] = [];
		const seen = new Set<string>();
		const match =
			topicMatch ??
			(await this.createPackTopicMatchIndexForUser(
				userId,
				topic,
				'classic_quotes',
			));

		const libraries = await this.classicQuotesLibraryRepo.find({
			where: { userId },
			order: { createdAt: 'DESC' },
			take: 40,
		});
		const libIds = libraries
			.filter((lib) => match.isRelated(lib.title))
			.slice(0, PACK_GENERATION_TOPIC_MATCH_LIBRARIES)
			.map((lib) => lib.id);

		for (const libraryId of libIds) {
			if (items.length >= limit) break;
			await this.loadClassicItemsFromLibraryPaginated(
				userId,
				libraryId,
				items,
				seen,
				limit,
			);
		}

		const sessions = await this.classicPackSessionRepo.find({
			where: { userId },
			order: { updatedAt: 'DESC' },
			take: PACK_GENERATION_TOPIC_HISTORY_BATCH_ROWS,
		});
		for (const s of sessions) {
			if (items.length >= limit) break;
			if (!match.isRelated(s.topic)) continue;
			await this.loadClassicItemsFromPackSessionPaginated(
				userId,
				s.streamId,
				items,
				seen,
				limit,
			);
		}

		return items;
	}

	private async loadClassicItemsFromPackSessionPaginated(
		userId: number,
		streamId: string,
		items: ClassicQuoteItemDto[],
		seen: Set<string>,
		limit: number,
	): Promise<void> {
		let skip = 0;
		while (items.length < limit) {
			const rows = await this.classicPackItemRepo.find({
				where: { userId, streamId },
				order: { sortOrder: 'ASC' },
				take: PACK_TOPIC_LIBRARY_ITEMS_PAGE_SIZE,
				skip,
			});
			if (rows.length === 0) break;
			for (const row of rows) {
				this.tryPushClassicItemDeduped(
					items,
					seen,
					this.mapClassicPackItemRow(row),
					limit,
				);
				if (items.length >= limit) return;
			}
			skip += rows.length;
			if (rows.length < PACK_TOPIC_LIBRARY_ITEMS_PAGE_SIZE) break;
		}
	}

	private mapClassicPackItemRow(
		row: EnglishClassicQuotesPackItem,
	): ClassicQuoteItemDto {
		return {
			english: row.english,
			translationZh: row.translationZh,
			source: row.source || '—',
			noteZh: row.noteZh || '—',
		};
	}

	/** 主 Agent 用短摘要（不重复查库）；无键时返回空串 */
	private buildExistingPackHintForMaster(
		kind: 'vocabulary' | 'classic_quotes',
		keys: Set<string>,
	): string {
		if (keys.size === 0) return '';
		const sample = [...keys].slice(-PACK_GENERATION_MASTER_HINT_SAMPLE_ITEMS);
		const joined = sample.join('；');
		const head =
			kind === 'vocabulary'
				? `【用户已有词条（同主题相关资料）】约 ${keys.size} 个词形已收录，下游禁止重复同形（不区分大小写）。节选：`
				: `【用户已有句子（同主题相关资料）】约 ${keys.size} 句已收录，下游禁止重复相同或实质雷同英文。节选：`;
		let text = `${head}${joined}`;
		if (text.length > PACK_GENERATION_MASTER_EXISTING_HINT_MAX_CHARS) {
			text = `${text.slice(0, PACK_GENERATION_MASTER_EXISTING_HINT_MAX_CHARS)}…`;
		}
		return text;
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
		/** 用户已有同主题资料短摘要（由 loadExistingPackKeysForGeneration 生成，勿过长） */
		existingPackHint?: string;
		/** 与 SSE / 显式 cancel 共用，与 120s 超时合并为任一触发即中止 */
		clientSignal?: AbortSignal;
		onToolEvent?: (
			e: EnglishLearningPackAgentToolEvent,
		) => void | Promise<void>;
	}): Promise<string> {
		const { userId, topic, kind, existingPackHint, onToolEvent, clientSignal } =
			params;

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
			const mainLlm = createLlm(this.configService, {
				preset: 'englishLearning',
				maxTokens: 8192,
				temperature: 0.35,
				defaultTemperature: 0.35,
				maxTokensPolicy: 'default',
				defaultMaxTokens: 8192,
				abortSignal: combinedSignal,
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
			const existingHintBlock = existingPackHint?.trim()
				? `\n${existingPackHint.trim()}\n`
				: '';

			const userHumanText = `任务类型：${kindLabel}
主题/需求：${topic.trim()}
学习语境：${ENGLISH_PACK_LEARNER_CONTEXT_HINT}
${existingHintBlock}
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
			const pos = this.parseVocabularyPosFromJsonRow(r);
			const segmentation = this.parseVocabularySegmentationFromJsonRow(r);
			out.push({
				word,
				ipa,
				pos,
				segmentation,
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
	 * 将本轮新词条写入当前 stream 的 batch 表（LLM 每轮一批；库内预填/直出按 chunk 分批，便于历史列表与详情还原）。
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
		const topic = params.topic.trim().slice(0, 500);
		await this.dataSource.transaction(async (manager) => {
			const sessionRepo = manager.getRepository(EnglishVocabularyPackSession);
			const itemRepo = manager.getRepository(EnglishVocabularyPackItem);
			const batchRepo = manager.getRepository(EnglishVocabularyPackBatch);

			let session = await sessionRepo.findOne({
				where: { streamId: params.streamId, userId: params.userId },
			});
			if (!session) {
				session = sessionRepo.create({
					streamId: params.streamId,
					userId: params.userId,
					topic,
					targetCount: params.targetCount,
					itemCount: 0,
				});
			} else {
				session.topic = topic;
				session.targetCount = params.targetCount;
			}

			const maxRaw = await itemRepo
				.createQueryBuilder('i')
				.select('MAX(i.sortOrder)', 'maxSort')
				.where('i.streamId = :streamId', { streamId: params.streamId })
				.andWhere('i.userId = :userId', { userId: params.userId })
				.getRawOne<{ maxSort: string | number | null }>();
			let sortOrder = maxRaw?.maxSort != null ? Number(maxRaw.maxSort) + 1 : 0;
			if (!Number.isFinite(sortOrder)) sortOrder = 0;

			const batchRow = batchRepo.create({
				userId: params.userId,
				streamId: params.streamId,
				round: params.round,
				topic,
				level: null,
				targetCount: params.targetCount,
				itemCount: params.items.length,
			});
			const savedBatch = await batchRepo.save(batchRow);

			const itemRows: EnglishVocabularyPackItem[] = [];
			for (const it of params.items) {
				const word = it.word.trim().slice(0, 500);
				const ipa = it.ipa.trim().slice(0, 2000);
				if (!word || !ipa) continue;
				itemRows.push(
					itemRepo.create({
						userId: params.userId,
						streamId: params.streamId,
						round: params.round,
						sortOrder,
						batchId: savedBatch.id,
						word,
						ipa,
						pos: typeof it.pos === 'string' ? it.pos.trim().slice(0, 64) : '',
						segmentation:
							typeof it.segmentation === 'string'
								? it.segmentation.trim().slice(0, 500)
								: '',
						translationZh: String(it.translationZh ?? '—')
							.trim()
							.slice(0, 8000),
						example: String(it.example ?? '—')
							.trim()
							.slice(0, 8000),
					}),
				);
				sortOrder += 1;
			}
			if (itemRows.length) {
				await itemRepo.save(itemRows);
				session.itemCount += itemRows.length;
			}
			await sessionRepo.save(session);
		});
	}

	/** 从 JSON 根节点提取数组或 `{ items: [] }`（与导入页约定一致） */
	private extractVocabularyImportItemArray(data: unknown): unknown[] | null {
		if (Array.isArray(data)) return data;
		if (
			data &&
			typeof data === 'object' &&
			Array.isArray((data as { items?: unknown }).items)
		) {
			return (data as { items: unknown[] }).items;
		}
		return null;
	}

	/**
	 * 将导入 JSON 解析为单词库条目（与前端 parseVocabularyImport 规则对齐）。
	 */
	private parseVocabularyPackRootToLibraryItems(
		root: unknown,
	): EnglishVocabularyPackItemJson[] {
		const arr = this.extractVocabularyImportItemArray(root);
		if (!arr) {
			throw new BadRequestException('JSON 需为数组或包含 items 数组的对象');
		}
		const itemsJson: EnglishVocabularyPackItemJson[] = [];
		for (const row of arr) {
			if (!row || typeof row !== 'object') continue;
			const o = row as Record<string, unknown>;
			const word = typeof o.word === 'string' ? o.word.trim() : '';
			const ipa = typeof o.ipa === 'string' ? o.ipa.trim() : '';
			if (!word || !ipa) continue;
			const pos = typeof o.pos === 'string' ? o.pos.trim().slice(0, 64) : '';
			const segmentation = this.parseVocabularySegmentationFromJsonRow(o);
			const translationZh =
				typeof o.translationZh === 'string'
					? o.translationZh
					: typeof o.translation_zh === 'string'
						? o.translation_zh
						: '—';
			const example = typeof o.example === 'string' ? o.example : '—';
			itemsJson.push({
				word: word.slice(0, 500),
				ipa: ipa.slice(0, 2000),
				pos: pos || undefined,
				segmentation: segmentation || undefined,
				translationZh: String(translationZh).trim().slice(0, 8000),
				example: String(example).trim().slice(0, 8000),
			});
		}
		if (!itemsJson.length) {
			throw new BadRequestException(
				'未解析到有效单词（每项需含非空 word 与 ipa）',
			);
		}
		if (itemsJson.length > ENGLISH_VOCAB_GENERATION_MAX) {
			throw new BadRequestException(
				`单次最多保存 ${ENGLISH_VOCAB_GENERATION_MAX} 条单词`,
			);
		}
		return itemsJson;
	}

	private mapLibraryItemRow(
		row: EnglishVocabularyLibraryItem,
	): VocabularyLibraryItemDto {
		return {
			id: row.id,
			sortOrder: row.sortOrder,
			word: row.word,
			ipa: row.ipa,
			pos: row.pos ?? '',
			segmentation: row.segmentation ?? '',
			translationZh: row.translationZh,
			example: row.example,
		};
	}

	private async assertVocabularyLibraryOwned(
		userId: number,
		libraryId: string,
	): Promise<EnglishVocabularyLibrary> {
		const lib = await this.vocabLibraryRepo.findOne({
			where: { id: libraryId, userId },
		});
		if (!lib) {
			throw new NotFoundException('单词库不存在或无权访问');
		}
		return lib;
	}

	/**
	 * 事务写入：先落库元数据，再批量插入词条行（支持后续分页查询）。
	 */
	private async persistVocabularyLibrary(
		userId: number,
		title: string,
		itemsJson: EnglishVocabularyPackItemJson[],
	): Promise<{ id: string; wordCount: number }> {
		const t = title.trim().slice(0, 200);
		if (!t) {
			throw new BadRequestException('标题不能为空');
		}
		const wordCount = itemsJson.length;

		return this.dataSource.transaction(async (manager) => {
			const libRepo = manager.getRepository(EnglishVocabularyLibrary);
			const itemRepo = manager.getRepository(EnglishVocabularyLibraryItem);

			const lib = await libRepo.save(
				libRepo.create({
					userId,
					title: t,
					wordCount,
				}),
			);

			const itemRows = itemsJson.map((item, index) =>
				itemRepo.create({
					libraryId: lib.id,
					userId,
					sortOrder: index,
					word: item.word,
					ipa: item.ipa,
					pos: item.pos ?? '',
					segmentation: item.segmentation ?? '',
					translationZh: item.translationZh,
					example: item.example,
				}),
			);

			// 大批量时分块插入，避免单条 SQL 过长
			const chunkSize = 500;
			for (let i = 0; i < itemRows.length; i += chunkSize) {
				await itemRepo.save(itemRows.slice(i, i + chunkSize));
			}

			return { id: lib.id, wordCount: lib.wordCount };
		});
	}

	/**
	 * 删除单词库及其全部词条（库表删除后子表由 FK ON DELETE CASCADE 级联清理）。
	 */
	async deleteVocabularyLibrary(
		userId: number,
		libraryId: string,
	): Promise<{ deleted: boolean }> {
		const lib = await this.assertVocabularyLibraryOwned(userId, libraryId);
		await this.vocabLibraryRepo.remove(lib);
		return { deleted: true };
	}

	/** 分页列出当前用户的单词库（包） */
	async listVocabularyLibraries(
		userId: number,
		options?: { limit?: number; offset?: number },
	): Promise<VocabularyLibraryListItem[]> {
		const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
		const offset = Math.max(0, options?.offset ?? 0);
		const rows = await this.vocabLibraryRepo.find({
			where: { userId },
			order: { createdAt: 'DESC' },
			take: limit,
			skip: offset,
		});
		return rows.map((r) => ({
			id: r.id,
			title: r.title,
			wordCount: r.wordCount,
			createdAt: r.createdAt.toISOString(),
		}));
	}

	/** 分页列出某单词库内的词条（按 sort_order 升序） */
	async listVocabularyLibraryItems(
		userId: number,
		libraryId: string,
		options?: { limit?: number; offset?: number },
	): Promise<{
		library: VocabularyLibraryListItem;
		items: VocabularyLibraryItemDto[];
	}> {
		const lib = await this.assertVocabularyLibraryOwned(userId, libraryId);
		const limit = Math.min(200, Math.max(1, options?.limit ?? 50));
		const offset = Math.max(0, options?.offset ?? 0);

		const rows = await this.vocabLibraryItemRepo.find({
			where: { libraryId, userId },
			order: { sortOrder: 'ASC' },
			take: limit,
			skip: offset,
		});

		return {
			library: {
				id: lib.id,
				title: lib.title,
				wordCount: lib.wordCount,
				createdAt: lib.createdAt.toISOString(),
			},
			items: rows.map((r) => this.mapLibraryItemRow(r)),
		};
	}

	/**
	 * 将导入页校验后的单词包写入「单词库」表（每包一行，与 SSE 流式批次表分离）。
	 */
	async saveImportedVocabularyLibrary(
		userId: number,
		dto: SaveVocabularyLibraryDto,
	): Promise<{ id: string; wordCount: number }> {
		const itemsJson: EnglishVocabularyPackItemJson[] = [];
		for (const row of dto.items) {
			const word = row.word.trim();
			const ipa = row.ipa.trim();
			if (!word || !ipa) continue;
			const pos =
				typeof row.pos === 'string' ? row.pos.trim().slice(0, 64) : '';
			const segmentation =
				typeof row.segmentation === 'string'
					? row.segmentation.trim().slice(0, 500)
					: '';
			const translationZh = String(row.translationZh ?? '—')
				.trim()
				.slice(0, 8000);
			const example = String(row.example ?? '—')
				.trim()
				.slice(0, 8000);
			itemsJson.push({
				word: word.slice(0, 500),
				ipa: ipa.slice(0, 2000),
				pos: pos || undefined,
				segmentation: segmentation || undefined,
				translationZh,
				example,
			});
		}
		if (!itemsJson.length) {
			throw new BadRequestException(
				'没有有效的单词条目（word 与 ipa 不能为空）',
			);
		}
		if (itemsJson.length > ENGLISH_VOCAB_GENERATION_MAX) {
			throw new BadRequestException(
				`单次最多保存 ${ENGLISH_VOCAB_GENERATION_MAX} 条单词`,
			);
		}
		return this.persistVocabularyLibrary(userId, dto.title, itemsJson);
	}

	/**
	 * 将已解析的 JSON 根对象写入单词库（供 multipart 上传文件后服务端解析调用）。
	 */
	async saveImportedVocabularyLibraryFromPackJson(
		userId: number,
		title: string,
		root: unknown,
	): Promise<{ id: string; wordCount: number }> {
		const itemsJson = this.parseVocabularyPackRootToLibraryItems(root);
		return this.persistVocabularyLibrary(userId, title, itemsJson);
	}

	/**
	 * 将导入 JSON 解析为经典语句库条目（与前端 parseClassicImport 规则对齐）。
	 */
	private parseClassicPackRootToLibraryItems(
		root: unknown,
	): EnglishClassicQuoteItemJson[] {
		const arr = this.extractVocabularyImportItemArray(root);
		if (!arr) {
			throw new BadRequestException('JSON 需为数组或包含 items 数组的对象');
		}
		const itemsJson: EnglishClassicQuoteItemJson[] = [];
		for (const row of arr) {
			if (!row || typeof row !== 'object') continue;
			const o = row as Record<string, unknown>;
			const english = typeof o.english === 'string' ? o.english.trim() : '';
			const translationZh =
				typeof o.translationZh === 'string'
					? o.translationZh.trim()
					: typeof o.translation_zh === 'string'
						? o.translation_zh.trim()
						: '';
			if (!english || !translationZh) continue;
			const source =
				typeof o.source === 'string' ? o.source.trim().slice(0, 2000) : '—';
			const noteZh =
				typeof o.noteZh === 'string'
					? o.noteZh.trim().slice(0, 8000)
					: typeof o.note_zh === 'string'
						? o.note_zh.trim().slice(0, 8000)
						: '—';
			itemsJson.push({ english, translationZh, source, noteZh });
		}
		if (!itemsJson.length) {
			throw new BadRequestException(
				'未解析到有效经典语句（每项需含非空 english 与 translationZh）',
			);
		}
		if (itemsJson.length > ENGLISH_CLASSIC_QUOTES_GENERATION_MAX) {
			throw new BadRequestException(
				`单次最多保存 ${ENGLISH_CLASSIC_QUOTES_GENERATION_MAX} 条经典语句`,
			);
		}
		return itemsJson;
	}

	private mapClassicLibraryItemRow(
		row: EnglishClassicQuotesLibraryItem,
	): ClassicQuotesLibraryItemDto {
		return {
			id: row.id,
			sortOrder: row.sortOrder,
			english: row.english,
			translationZh: row.translationZh,
			source: row.source ?? '',
			noteZh: row.noteZh,
		};
	}

	private async assertClassicQuotesLibraryOwned(
		userId: number,
		libraryId: string,
	): Promise<EnglishClassicQuotesLibrary> {
		const lib = await this.classicQuotesLibraryRepo.findOne({
			where: { id: libraryId, userId },
		});
		if (!lib) {
			throw new NotFoundException('经典语句库不存在或无权访问');
		}
		return lib;
	}

	private async persistClassicQuotesLibrary(
		userId: number,
		title: string,
		itemsJson: EnglishClassicQuoteItemJson[],
	): Promise<{ id: string; quoteCount: number }> {
		const t = title.trim().slice(0, 200);
		if (!t) {
			throw new BadRequestException('标题不能为空');
		}
		const quoteCount = itemsJson.length;

		return this.dataSource.transaction(async (manager) => {
			const libRepo = manager.getRepository(EnglishClassicQuotesLibrary);
			const itemRepo = manager.getRepository(EnglishClassicQuotesLibraryItem);

			const lib = await libRepo.save(
				libRepo.create({
					userId,
					title: t,
					quoteCount,
				}),
			);

			const itemRows = itemsJson.map((item, index) =>
				itemRepo.create({
					libraryId: lib.id,
					userId,
					sortOrder: index,
					english: item.english,
					translationZh: item.translationZh,
					source: item.source ?? '',
					noteZh: item.noteZh,
				}),
			);

			const chunkSize = 500;
			for (let i = 0; i < itemRows.length; i += chunkSize) {
				await itemRepo.save(itemRows.slice(i, i + chunkSize));
			}

			return { id: lib.id, quoteCount: lib.quoteCount };
		});
	}

	async deleteClassicQuotesLibrary(
		userId: number,
		libraryId: string,
	): Promise<{ deleted: boolean }> {
		const lib = await this.assertClassicQuotesLibraryOwned(userId, libraryId);
		await this.classicQuotesLibraryRepo.remove(lib);
		return { deleted: true };
	}

	async listClassicQuotesLibraries(
		userId: number,
		options?: { limit?: number; offset?: number },
	): Promise<ClassicQuotesLibraryListItem[]> {
		const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
		const offset = Math.max(0, options?.offset ?? 0);
		const rows = await this.classicQuotesLibraryRepo.find({
			where: { userId },
			order: { createdAt: 'DESC' },
			take: limit,
			skip: offset,
		});
		return rows.map((r) => ({
			id: r.id,
			title: r.title,
			quoteCount: r.quoteCount,
			createdAt: r.createdAt.toISOString(),
		}));
	}

	async listClassicQuotesLibraryItems(
		userId: number,
		libraryId: string,
		options?: { limit?: number; offset?: number },
	): Promise<{
		library: ClassicQuotesLibraryListItem;
		items: ClassicQuotesLibraryItemDto[];
	}> {
		const lib = await this.assertClassicQuotesLibraryOwned(userId, libraryId);
		const limit = Math.min(200, Math.max(1, options?.limit ?? 50));
		const offset = Math.max(0, options?.offset ?? 0);

		const rows = await this.classicQuotesLibraryItemRepo.find({
			where: { libraryId, userId },
			order: { sortOrder: 'ASC' },
			take: limit,
			skip: offset,
		});

		return {
			library: {
				id: lib.id,
				title: lib.title,
				quoteCount: lib.quoteCount,
				createdAt: lib.createdAt.toISOString(),
			},
			items: rows.map((r) => this.mapClassicLibraryItemRow(r)),
		};
	}

	async saveImportedClassicQuotesLibrary(
		userId: number,
		dto: SaveClassicQuotesLibraryDto,
	): Promise<{ id: string; quoteCount: number }> {
		const itemsJson: EnglishClassicQuoteItemJson[] = [];
		for (const row of dto.items) {
			const english = row.english.trim();
			const translationZh = String(row.translationZh ?? '').trim();
			if (!english || !translationZh) continue;
			itemsJson.push({
				english: english.slice(0, 8000),
				translationZh: translationZh.slice(0, 8000),
				source: String(row.source ?? '—')
					.trim()
					.slice(0, 2000),
				noteZh: String(row.noteZh ?? '—')
					.trim()
					.slice(0, 8000),
			});
		}
		if (!itemsJson.length) {
			throw new BadRequestException(
				'没有有效的经典语句（english 与 translationZh 不能为空）',
			);
		}
		if (itemsJson.length > ENGLISH_CLASSIC_QUOTES_GENERATION_MAX) {
			throw new BadRequestException(
				`单次最多保存 ${ENGLISH_CLASSIC_QUOTES_GENERATION_MAX} 条经典语句`,
			);
		}
		return this.persistClassicQuotesLibrary(userId, dto.title, itemsJson);
	}

	async saveImportedClassicQuotesLibraryFromPackJson(
		userId: number,
		title: string,
		root: unknown,
	): Promise<{ id: string; quoteCount: number }> {
		const itemsJson = this.parseClassicPackRootToLibraryItems(root);
		return this.persistClassicQuotesLibrary(userId, title, itemsJson);
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
	 * 将本轮新经典句写入当前 stream 的 batch 表（LLM 每轮一批；库内预填/直出按 chunk 分批）。
	 * - 用于流式会话持久化，历史列表 wordCount/quoteCount 与各批 items 之和一致
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
		if (!params.items.length) return;
		const topic = params.topic.trim().slice(0, 500);
		await this.dataSource.transaction(async (manager) => {
			const sessionRepo = manager.getRepository(
				EnglishClassicQuotesPackSession,
			);
			const itemRepo = manager.getRepository(EnglishClassicQuotesPackItem);
			const batchRepo = manager.getRepository(EnglishClassicQuotePackBatch);

			let session = await sessionRepo.findOne({
				where: { streamId: params.streamId, userId: params.userId },
			});
			if (!session) {
				session = sessionRepo.create({
					streamId: params.streamId,
					userId: params.userId,
					topic,
					targetCount: params.targetCount,
					itemCount: 0,
				});
			} else {
				session.topic = topic;
				session.targetCount = params.targetCount;
			}

			const maxRaw = await itemRepo
				.createQueryBuilder('i')
				.select('MAX(i.sortOrder)', 'maxSort')
				.where('i.streamId = :streamId', { streamId: params.streamId })
				.andWhere('i.userId = :userId', { userId: params.userId })
				.getRawOne<{ maxSort: string | number | null }>();
			let sortOrder = maxRaw?.maxSort != null ? Number(maxRaw.maxSort) + 1 : 0;
			if (!Number.isFinite(sortOrder)) sortOrder = 0;

			const batchRow = batchRepo.create({
				userId: params.userId,
				streamId: params.streamId,
				round: params.round,
				topic,
				level: null,
				targetCount: params.targetCount,
				itemCount: params.items.length,
			});
			const savedBatch = await batchRepo.save(batchRow);

			const itemRows: EnglishClassicQuotesPackItem[] = [];
			for (const it of params.items) {
				const english = it.english.trim();
				const translationZh = it.translationZh.trim();
				if (!english || !translationZh) continue;
				itemRows.push(
					itemRepo.create({
						userId: params.userId,
						streamId: params.streamId,
						round: params.round,
						sortOrder,
						batchId: savedBatch.id,
						english: english.slice(0, 8000),
						translationZh: translationZh.slice(0, 8000),
						source: String(it.source ?? '—')
							.trim()
							.slice(0, 2000),
						noteZh: String(it.noteZh ?? '—')
							.trim()
							.slice(0, 8000),
					}),
				);
				sortOrder += 1;
			}
			if (itemRows.length) {
				await itemRepo.save(itemRows);
				session.itemCount += itemRows.length;
			}
			await sessionRepo.save(session);
		});
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
		const capped = Math.min(
			32768,
			Math.max(4096, Math.floor(params.maxTokens)),
		);
		const llm = createLlm(this.configService, {
			preset: 'englishLearning',
			streaming: false,
			temperature: 0.35,
			defaultTemperature: 0.35,
			maxTokens: capped,
			maxTokensPolicy: 'default',
			abortSignal: params.signal,
			// 设定 LLM 输出格式为 JSON（json_object）：避免自然语言混杂/生成结构可信度更高
			modelKwargs: {
				response_format: { type: 'json_object' },
			},
		});
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

		let accumulated: VocabularyItemDto[] = [];
		const seen = new Set<string>();

		const timeSensitive =
			context?.userId != null && this.isPackTopicTimeSensitive(topic);

		if (context?.userId != null && !timeSensitive) {
			let topicMatch: PackTopicMatchIndex | undefined;
			try {
				topicMatch = await this.createPackTopicMatchIndexForUser(
					context.userId,
					topic,
					'vocabulary',
				);
			} catch (e: unknown) {
				this.logger.warn(
					'[EnglishLearning] 构建单词包主题匹配索引失败，将按条回退',
					e,
				);
			}
			try {
				const dbItems = await this.loadTopicRelatedVocabularyItemsFromDb(
					context.userId,
					topic,
					count,
					topicMatch,
				);
				if (dbItems.length >= count) {
					const result = dbItems.slice(0, count);
					await this.emitPackNewItemsInChunks({
						onProgress,
						items: result,
						target: count,
						fromDatabase: true,
						startRound: 1,
					});
					this.logger.log(
						`[EnglishLearning] 单词包库内同主题资料已满 ${result.length}/${count} 条，跳过大模型（topic=${topic.slice(0, 48)}）`,
					);
					return result;
				}
				if (dbItems.length > 0) {
					accumulated = dbItems;
					for (const item of accumulated) {
						const k = this.normalizePackVocabKey(item.word);
						if (k) seen.add(k);
					}
					await this.emitPackNewItemsInChunks({
						onProgress,
						items: accumulated,
						target: count,
						fromDatabase: true,
						startRound: 0,
					});
					this.logger.log(
						`[EnglishLearning] 单词包库内预填 ${accumulated.length}/${count} 条，大模型补足剩余（topic=${topic.slice(0, 48)}）`,
					);
				}
			} catch (e: unknown) {
				this.logger.warn(
					'[EnglishLearning] 查询库内同主题单词失败，改走大模型生成',
					e,
				);
			}
			try {
				const dbKeys = await this.loadExistingPackKeysForGeneration({
					userId: context.userId,
					topic,
					kind: 'vocabulary',
					topicMatch,
				});
				for (const k of dbKeys) seen.add(k);
				if (dbKeys.size > 0) {
					this.logger.log(
						`[EnglishLearning] 单词生成并入 DB 去重键 ${dbKeys.size} 个（topic=${topic.slice(0, 48)}）`,
					);
				}
			} catch (e: unknown) {
				this.logger.warn(
					'[EnglishLearning] 加载已有单词去重键失败，继续生成',
					e,
				);
			}
		} else if (timeSensitive) {
			this.logger.log(
				`[EnglishLearning] 单词包主题为时效性，跳过全部库内查询，直走主 Agent（topic=${topic.slice(0, 48)}）`,
			);
		}

		const existingPackHint =
			context?.userId != null && !timeSensitive
				? this.buildExistingPackHintForMaster('vocabulary', seen)
				: '';

		/** 主 Agent 检索要点（整场一次）；非空时仅在「线程中尚未含附录」的首条 Human 前置附录。每轮子模型 system 会动态追加「本轮生成要求」。 */
		let agentResearchAppendix = '';
		if (context?.userId != null) {
			try {
				const raw = await this.runEnglishPackMasterResearchPhase({
					userId: context.userId,
					topic,
					kind: 'vocabulary',
					existingPackHint,
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

		try {
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
					seen.size === 0
						? ''
						: this.buildSeenKeysExcludePromptForModel(seenKeys, {
								maxTailItems: TOPIC_PACK_EXCLUDE_TAIL,
								maxTotalChars: TOPIC_PACK_EXCLUDE_PROMPT_MAX_CHARS,
							});

				const diversityHint =
					stall >= 2 && accumulated.length > 0
						? `\n【多样性】请换子角度：同主题下的不同词性、常见搭配、近义辨析词、学科细分小类、短语动词变体等，严禁与已列词条同形或仅大小写差异。`
						: '';

				const excludeBlock = excludeSnippet
					? `\n以下英文词条已出现过，禁止再次输出（不区分大小写；归一化后须与下列全部不同）：${excludeSnippet}\n本批 items 内部也不得出现彼此重复的 word。`
					: '';

				const prefillNote =
					accumulated.length > 0 && rounds === 1
						? `\n【说明】用户资源库中已有 ${accumulated.length} 条同主题词条，请勿重复；本批仅需补足至总数 ${count} 条。`
						: '';

				/** 每轮拼入 system，避免写入 packAgentThread 的 Human 重复携带长节选 */
				const roundRequirement =
					accumulated.length === 0
						? `请恰好生成 ${batch} 条 items（数组长度必须等于 ${batch}）。${excludeBlock}请输出与已有资料完全不同的词或短语。${diversityHint}`
						: `请再生成恰好 ${batch} 条新的 items（数组长度必须等于 ${batch}）。${excludeBlock}${prefillNote}请输出与上述列表完全不同的词或短语。${diversityHint}`;

				const newItemsThisRound: VocabularyItemDto[] = [];
				let added = 0;
				let batchItems: VocabularyItemDto[] = [];
				const maxDupPasses = seen.size === 0 ? 1 : 5;

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
						const key = this.normalizePackVocabKey(item.word);
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

		let accumulated: ClassicQuoteItemDto[] = [];
		const seen = new Set<string>();

		const timeSensitive =
			context?.userId != null && this.isPackTopicTimeSensitive(topic);

		if (context?.userId != null && !timeSensitive) {
			let topicMatch: PackTopicMatchIndex | undefined;
			try {
				topicMatch = await this.createPackTopicMatchIndexForUser(
					context.userId,
					topic,
					'classic_quotes',
				);
			} catch (e: unknown) {
				this.logger.warn(
					'[EnglishLearning] 构建经典句主题匹配索引失败，将按条回退',
					e,
				);
			}
			try {
				const dbItems = await this.loadTopicRelatedClassicQuotesFromDb(
					context.userId,
					topic,
					count,
					topicMatch,
				);
				if (dbItems.length >= count) {
					const result = dbItems.slice(0, count);
					await this.emitPackNewItemsInChunks({
						onProgress,
						items: result,
						target: count,
						fromDatabase: true,
						startRound: 1,
					});
					this.logger.log(
						`[EnglishLearning] 经典句库内同主题资料已满 ${result.length}/${count} 条，跳过大模型（topic=${topic.slice(0, 48)}）`,
					);
					return result;
				}
				if (dbItems.length > 0) {
					accumulated = dbItems;
					for (const item of accumulated) {
						const k = this.normalizePackClassicEnglishKey(item.english);
						if (k) seen.add(k);
					}
					await this.emitPackNewItemsInChunks({
						onProgress,
						items: accumulated,
						target: count,
						fromDatabase: true,
						startRound: 0,
					});
					this.logger.log(
						`[EnglishLearning] 经典句库内预填 ${accumulated.length}/${count} 条，大模型补足剩余（topic=${topic.slice(0, 48)}）`,
					);
				}
			} catch (e: unknown) {
				this.logger.warn(
					'[EnglishLearning] 查询库内同主题语句失败，改走大模型生成',
					e,
				);
			}
			try {
				const dbKeys = await this.loadExistingPackKeysForGeneration({
					userId: context.userId,
					topic,
					kind: 'classic_quotes',
					topicMatch,
				});
				for (const k of dbKeys) seen.add(k);
				if (dbKeys.size > 0) {
					this.logger.log(
						`[EnglishLearning] 经典句生成并入 DB 去重键 ${dbKeys.size} 个（topic=${topic.slice(0, 48)}）`,
					);
				}
			} catch (e: unknown) {
				this.logger.warn(
					'[EnglishLearning] 加载已有经典句去重键失败，继续生成',
					e,
				);
			}
		} else if (timeSensitive) {
			this.logger.log(
				`[EnglishLearning] 经典句主题为时效性，跳过全部库内查询，直走主 Agent（topic=${topic.slice(0, 48)}）`,
			);
		}

		const existingPackHint =
			context?.userId != null && !timeSensitive
				? this.buildExistingPackHintForMaster('classic_quotes', seen)
				: '';

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
					existingPackHint,
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

		try {
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
					seen.size === 0
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

				const excludeBlock = excludeSnippet
					? `\n以下英文句子（节选）已出现过，禁止再次输出相同或实质雷同的句子（含轻微改写；不区分大小写；归一化后须与下列全部不同）：${excludeSnippet}\n本批 items 内部的 english 也不得彼此重复或雷同。`
					: '';

				const prefillNote =
					accumulated.length > 0 && rounds === 1
						? `\n【说明】用户资源库中已有 ${accumulated.length} 条同主题语句，请勿重复；本批仅需补足至总数 ${count} 条。`
						: '';

				/** 每轮拼入 system，避免写入 packAgentThread 的 Human 重复携带长节选（与单词生成一致） */
				const roundRequirement =
					accumulated.length === 0
						? `请恰好生成 ${batch} 条 items（数组长度必须等于 ${batch}）。${excludeBlock}请输出与已有资料完全不同的句子。${diversityHint}`
						: `请再生成恰好 ${batch} 条新的 items（数组长度必须等于 ${batch}）。${excludeBlock}${prefillNote}请输出与上述列表完全不同的句子。${diversityHint}`;

				const newItemsThisRound: ClassicQuoteItemDto[] = [];
				let added = 0;
				let batchItems: ClassicQuoteItemDto[] = [];
				const maxDupPasses = seen.size === 0 ? 1 : 5;

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
						const key = this.normalizePackClassicEnglishKey(item.english);
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

		const sessions = await this.vocabPackSessionRepo.find({
			where: { userId },
			order: { updatedAt: 'DESC' },
			take: limit,
			skip: offset,
		});
		if (!sessions.length) return [];

		const streamIds = sessions.map((s) => s.streamId);
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

		return sessions.map((s) => ({
			streamId: s.streamId,
			topic: s.topic,
			targetCount: s.targetCount,
			wordCount: s.itemCount,
			createdAt: s.createdAt.toISOString(),
			updatedAt: s.updatedAt.toISOString(),
			webSearchRoundCount: wsCountByStream.get(s.streamId) ?? 0,
		}));
	}

	/**
	 * 拉取会话元数据（不含词条明细；明细请调 listVocabularyPackItems 分页接口）。
	 */
	async getVocabularyHistoryDetail(
		userId: number,
		streamId: string,
	): Promise<{
		streamId: string;
		topic: string;
		targetCount: number;
		itemCount: number;
		createdAt: string;
		webSearchRounds: EnglishPackWebSearchRoundJson[];
	}> {
		const session = await this.vocabPackSessionRepo.findOne({
			where: { userId, streamId },
		});
		if (!session) {
			return {
				streamId,
				topic: '',
				targetCount: 0,
				itemCount: 0,
				createdAt: new Date(0).toISOString(),
				webSearchRounds: [],
			};
		}
		const ws = await this.packWebSearchRepo.findOne({
			where: { userId, streamId, packKind: 'vocabulary' },
		});
		return {
			streamId,
			topic: session.topic,
			targetCount: session.targetCount,
			itemCount: session.itemCount,
			createdAt: session.createdAt.toISOString(),
			webSearchRounds: Array.isArray(ws?.searchRounds) ? ws.searchRounds : [],
		};
	}

	/** 按 streamId + sortOrder 分页读取单词明细 */
	async listVocabularyPackItems(
		userId: number,
		streamId: string,
		options?: { limit?: number; offset?: number },
	): Promise<{
		streamId: string;
		itemCount: number;
		items: VocabularyItemDto[];
	}> {
		const session = await this.vocabPackSessionRepo.findOne({
			where: { userId, streamId },
		});
		if (!session) {
			return { streamId, itemCount: 0, items: [] };
		}
		const limit = Math.min(
			PACK_HISTORY_ITEMS_PAGE_MAX,
			Math.max(1, options?.limit ?? 100),
		);
		const offset = Math.max(0, options?.offset ?? 0);
		const rows = await this.vocabPackItemRepo.find({
			where: { userId, streamId },
			order: { sortOrder: 'ASC' },
			take: limit,
			skip: offset,
		});
		return {
			streamId,
			itemCount: session.itemCount,
			items: rows.map((r) => this.mapVocabPackItemRow(r)),
		};
	}

	/**
	 * 删除单词包拉取会话：明细、轮次审计、联网记录与会话元数据一并删除。
	 */
	async deleteVocabularyPackHistory(
		userId: number,
		streamId: string,
	): Promise<{ deleted: boolean }> {
		const session = await this.vocabPackSessionRepo.findOne({
			where: { userId, streamId },
		});
		if (!session) {
			throw new NotFoundException('拉取记录不存在或无权访问');
		}
		await this.dataSource.transaction(async (manager) => {
			await manager.delete(EnglishVocabularyPackItem, { userId, streamId });
			await manager.delete(EnglishVocabularyPackBatch, { userId, streamId });
			await manager.delete(EnglishPackWebSearchRecord, {
				userId,
				streamId,
				packKind: 'vocabulary',
			});
			await manager.delete(EnglishVocabularyPackSession, { streamId, userId });
		});
		return { deleted: true };
	}

	async listClassicQuotesHistory(
		userId: number,
		options?: { limit?: number; offset?: number },
	): Promise<ClassicQuoteHistoryListItem[]> {
		const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
		const offset = Math.max(0, options?.offset ?? 0);

		const sessions = await this.classicPackSessionRepo.find({
			where: { userId },
			order: { updatedAt: 'DESC' },
			take: limit,
			skip: offset,
		});
		if (!sessions.length) return [];

		const streamIds = sessions.map((s) => s.streamId);
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

		return sessions.map((s) => ({
			streamId: s.streamId,
			topic: s.topic,
			targetCount: s.targetCount,
			quoteCount: s.itemCount,
			createdAt: s.createdAt.toISOString(),
			updatedAt: s.updatedAt.toISOString(),
			webSearchRoundCount: wsCountByStream.get(s.streamId) ?? 0,
		}));
	}

	async getClassicQuotesHistoryDetail(
		userId: number,
		streamId: string,
	): Promise<{
		streamId: string;
		topic: string;
		targetCount: number;
		itemCount: number;
		createdAt: string;
		webSearchRounds: EnglishPackWebSearchRoundJson[];
	}> {
		const session = await this.classicPackSessionRepo.findOne({
			where: { userId, streamId },
		});
		if (!session) {
			return {
				streamId,
				topic: '',
				targetCount: 0,
				itemCount: 0,
				createdAt: new Date(0).toISOString(),
				webSearchRounds: [],
			};
		}
		const ws = await this.packWebSearchRepo.findOne({
			where: { userId, streamId, packKind: 'classic_quotes' },
		});
		return {
			streamId,
			topic: session.topic,
			targetCount: session.targetCount,
			itemCount: session.itemCount,
			createdAt: session.createdAt.toISOString(),
			webSearchRounds: Array.isArray(ws?.searchRounds) ? ws.searchRounds : [],
		};
	}

	async listClassicQuotesPackItems(
		userId: number,
		streamId: string,
		options?: { limit?: number; offset?: number },
	): Promise<{
		streamId: string;
		itemCount: number;
		items: ClassicQuoteItemDto[];
	}> {
		const session = await this.classicPackSessionRepo.findOne({
			where: { userId, streamId },
		});
		if (!session) {
			return { streamId, itemCount: 0, items: [] };
		}
		const limit = Math.min(
			PACK_HISTORY_ITEMS_PAGE_MAX,
			Math.max(1, options?.limit ?? 100),
		);
		const offset = Math.max(0, options?.offset ?? 0);
		const rows = await this.classicPackItemRepo.find({
			where: { userId, streamId },
			order: { sortOrder: 'ASC' },
			take: limit,
			skip: offset,
		});
		return {
			streamId,
			itemCount: session.itemCount,
			items: rows.map((r) => this.mapClassicPackItemRow(r)),
		};
	}

	/** 删除经典句拉取会话及全部明细 */
	async deleteClassicQuotesPackHistory(
		userId: number,
		streamId: string,
	): Promise<{ deleted: boolean }> {
		const session = await this.classicPackSessionRepo.findOne({
			where: { userId, streamId },
		});
		if (!session) {
			throw new NotFoundException('拉取记录不存在或无权访问');
		}
		await this.dataSource.transaction(async (manager) => {
			await manager.delete(EnglishClassicQuotesPackItem, { userId, streamId });
			await manager.delete(EnglishClassicQuotePackBatch, { userId, streamId });
			await manager.delete(EnglishPackWebSearchRecord, {
				userId,
				streamId,
				packKind: 'classic_quotes',
			});
			await manager.delete(EnglishClassicQuotesPackSession, {
				streamId,
				userId,
			});
		});
		return { deleted: true };
	}

	/** 与前端 `normalizeEnglishVocabWordKey` 对齐：trim + 小写 */
	normalizeVocabularyFavoriteWordKey(word: string): string {
		return word.trim().toLowerCase();
	}

	/**
	 * 收藏单词：同一用户同一规范化词形仅保留一行；已存在则返回 created=false，不报错。
	 */
	async addVocabularyFavorite(
		userId: number,
		item: VocabularyFavoriteBodyDto,
	): Promise<{ created: boolean; id: string | null }> {
		const wordKey = this.normalizeVocabularyFavoriteWordKey(item.word);
		if (!wordKey) {
			throw new BadRequestException('单词不能为空');
		}
		const existed = await this.vocabFavoriteRepo.findOne({
			where: { userId, wordKey },
		});
		if (existed) {
			return { created: false, id: existed.id };
		}
		const row = this.vocabFavoriteRepo.create({
			userId,
			wordKey,
			word: item.word.trim(),
			ipa: typeof item.ipa === 'string' ? item.ipa : '',
			pos: typeof item.pos === 'string' ? item.pos.trim().slice(0, 32) : '',
			segmentation:
				typeof item.segmentation === 'string'
					? item.segmentation.trim().slice(0, 500)
					: '',
			translationZh: item.translationZh ?? '',
			example: item.example ?? '',
		});
		const saved = await this.vocabFavoriteRepo.save(row);
		return { created: true, id: saved.id };
	}

	async removeVocabularyFavorite(
		userId: number,
		id: string,
	): Promise<{ removed: boolean }> {
		const r = await this.vocabFavoriteRepo.delete({ userId, id });
		return { removed: (r.affected ?? 0) > 0 };
	}

	/** 批量取消单词收藏（按收藏记录 id，一条 SQL） */
	async removeVocabularyFavoritesBatch(
		userId: number,
		ids: string[],
	): Promise<{ removedCount: number }> {
		const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
		if (unique.length === 0) {
			return { removedCount: 0 };
		}
		const r = await this.vocabFavoriteRepo.delete({
			userId,
			id: In(unique),
		});
		return { removedCount: r.affected ?? 0 };
	}

	/** 批量查询：入参词面中已收藏项的 wordKey + id */
	async listVocabularyFavoriteRefsForWords(
		userId: number,
		words: string[],
	): Promise<Array<{ wordKey: string; id: string }>> {
		const keys = [
			...new Set(
				words
					.map((w) => this.normalizeVocabularyFavoriteWordKey(w))
					.filter((k) => k.length > 0),
			),
		];
		if (keys.length === 0) {
			return [];
		}
		const rows = await this.vocabFavoriteRepo.find({
			where: { userId, wordKey: In(keys) },
			select: ['id', 'wordKey'],
		});
		return rows.map((r) => ({ wordKey: r.wordKey, id: r.id }));
	}

	/**
	 * 经典句收藏去重键：trim + 小写后 SHA256(hex)，与前端 `classicQuoteFavoriteContentKey` 一致。
	 */
	classicQuoteFavoriteContentKey(english: string): string {
		const n = english.trim().toLowerCase();
		if (!n) {
			return '';
		}
		return createHash('sha256').update(n, 'utf8').digest('hex');
	}

	async addClassicQuoteFavorite(
		userId: number,
		item: ClassicQuoteItemDto,
	): Promise<{ created: boolean; id: string | null }> {
		const contentKey = this.classicQuoteFavoriteContentKey(item.english);
		if (!contentKey) {
			throw new BadRequestException('英文原句不能为空');
		}
		const existed = await this.classicQuoteFavoriteRepo.findOne({
			where: { userId, contentKey },
		});
		if (existed) {
			return { created: false, id: existed.id };
		}
		const row = this.classicQuoteFavoriteRepo.create({
			userId,
			contentKey,
			english: item.english.trim(),
			translationZh: item.translationZh ?? '',
			source: typeof item.source === 'string' ? item.source : '',
			noteZh: item.noteZh ?? '',
		});
		const saved = await this.classicQuoteFavoriteRepo.save(row);
		return { created: true, id: saved.id };
	}

	async removeClassicQuoteFavorite(
		userId: number,
		id: string,
	): Promise<{ removed: boolean }> {
		const r = await this.classicQuoteFavoriteRepo.delete({ userId, id });
		return { removed: (r.affected ?? 0) > 0 };
	}

	/** 批量取消经典句收藏（按收藏记录 id） */
	async removeClassicQuoteFavoritesBatch(
		userId: number,
		ids: string[],
	): Promise<{ removedCount: number }> {
		const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
		if (unique.length === 0) {
			return { removedCount: 0 };
		}
		const r = await this.classicQuoteFavoriteRepo.delete({
			userId,
			id: In(unique),
		});
		return { removedCount: r.affected ?? 0 };
	}

	/** 批量查询：入参原句中已收藏项的 contentKey + id */
	async listClassicQuoteFavoriteRefsForEnglishes(
		userId: number,
		englishes: string[],
	): Promise<Array<{ contentKey: string; id: string }>> {
		const keys = [
			...new Set(
				englishes
					.map((e) => this.classicQuoteFavoriteContentKey(e))
					.filter((k) => k.length > 0),
			),
		];
		if (keys.length === 0) {
			return [];
		}
		const rows = await this.classicQuoteFavoriteRepo.find({
			where: { userId, contentKey: In(keys) },
			select: ['id', 'contentKey'],
		});
		return rows.map((r) => ({ contentKey: r.contentKey, id: r.id }));
	}

	/** 分页列出当前用户收藏的单词（按收藏时间倒序，含总数） */
	async listVocabularyFavoritesPage(
		userId: number,
		opts: { limit: number; offset: number },
	): Promise<{
		items: Array<{
			id: string;
			word: string;
			ipa: string;
			pos: string;
			segmentation: string;
			translationZh: string;
			example: string;
			createdAt: string;
		}>;
		totalCount: number;
	}> {
		const [totalCount, rows] = await Promise.all([
			this.vocabFavoriteRepo.count({ where: { userId } }),
			this.vocabFavoriteRepo.find({
				where: { userId },
				order: { createdAt: 'DESC' },
				take: opts.limit,
				skip: opts.offset,
			}),
		]);
		return {
			totalCount,
			items: rows.map((r) => ({
				id: r.id,
				word: r.word,
				ipa: r.ipa ?? '',
				pos: r.pos ?? '',
				segmentation: r.segmentation ?? '',
				translationZh: r.translationZh ?? '',
				example: r.example ?? '',
				createdAt: r.createdAt.toISOString(),
			})),
		};
	}

	/** 分页列出当前用户收藏的经典句（按收藏时间倒序，含总数） */
	async listClassicQuoteFavoritesPage(
		userId: number,
		opts: { limit: number; offset: number },
	): Promise<{
		items: Array<{
			id: string;
			english: string;
			translationZh: string;
			source: string;
			noteZh: string;
			createdAt: string;
		}>;
		totalCount: number;
	}> {
		const [totalCount, rows] = await Promise.all([
			this.classicQuoteFavoriteRepo.count({ where: { userId } }),
			this.classicQuoteFavoriteRepo.find({
				where: { userId },
				order: { createdAt: 'DESC' },
				take: opts.limit,
				skip: opts.offset,
			}),
		]);
		return {
			totalCount,
			items: rows.map((r) => ({
				id: r.id,
				english: r.english,
				translationZh: r.translationZh ?? '',
				source: r.source ?? '',
				noteZh: r.noteZh ?? '',
				createdAt: r.createdAt.toISOString(),
			})),
		};
	}

	/** 导出收藏为 DOCX 时单次最多行数，避免超大文档占用内存 */
	private static readonly FAVORITES_DOCX_EXPORT_MAX = 3000;

	/** 当前用户单词收藏导出为 Word（最多 FAVORITES_DOCX_EXPORT_MAX 条，按收藏时间倒序） */
	async exportVocabularyFavoritesDocxBuffer(userId: number): Promise<Buffer> {
		const rows = await this.vocabFavoriteRepo.find({
			where: { userId },
			order: { createdAt: 'DESC' },
			take: EnglishLearningService.FAVORITES_DOCX_EXPORT_MAX,
		});
		const list = rows.map((r) => ({
			word: r.word,
			ipa: r.ipa ?? '',
			pos: r.pos ?? '',
			segmentation: r.segmentation ?? '',
			translationZh: r.translationZh ?? '',
			example: r.example ?? '',
		}));
		return buildVocabularyFavoritesDocxBuffer(list);
	}

	/** 当前用户经典句收藏导出为 Word（最多 FAVORITES_DOCX_EXPORT_MAX 条，按收藏时间倒序） */
	async exportClassicQuoteFavoritesDocxBuffer(userId: number): Promise<Buffer> {
		const rows = await this.classicQuoteFavoriteRepo.find({
			where: { userId },
			order: { createdAt: 'DESC' },
			take: EnglishLearningService.FAVORITES_DOCX_EXPORT_MAX,
		});
		const list = rows.map((r) => ({
			english: r.english,
			translationZh: r.translationZh ?? '',
			source: r.source ?? '',
			noteZh: r.noteZh ?? '',
		}));
		return buildClassicQuoteFavoritesDocxBuffer(list);
	}
}
