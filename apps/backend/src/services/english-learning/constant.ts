import type { WebSearchRecencyPreset } from '../../services/web-search/web-search.types';

/** 单词包与经典句共用：每轮 JSON 条数上限、已出现列表尾部条数、stall 时 batch 下调（与单词包逻辑一致） */
export const TOPIC_PACK_ITEMS_PER_ROUND = 20;
export const TOPIC_PACK_EXCLUDE_TAIL = 220;
export const TOPIC_PACK_STALL_BATCH_FLOOR = 5;
export const TOPIC_PACK_STALL_BATCH_STEP = 3;

/** 多轮 JSON 生成时保留在 LangChain 消息线程内的最大条数（Human/AI 交替） */
export const PACK_AGENT_THREAD_MAX_MESSAGES = 32;

/**
 * 子模型 user 内「禁止重复」列表的总字符上限：从已收录键集合尾部择优保留；服务端 `seen` 仍为全集，去重语义不变。
 */
export const TOPIC_PACK_EXCLUDE_PROMPT_MAX_CHARS = 12_000;

/** 经典句：每条 english 写入禁止列表的最大节选长度（避免 220×240 级 prompt） */
export const TOPIC_PACK_EXCLUDE_CLASSIC_ITEM_MAX_CHARS = 96;

/** 经典句：禁止列表最多取已收录集合尾部条数（单词仍用 TOPIC_PACK_EXCLUDE_TAIL） */
export const TOPIC_PACK_EXCLUDE_CLASSIC_TAIL_ITEMS = 80;

/** 主 Agent 流式拼接正文的绝对熔断（防止异常超长输出占满内存） */
export const ENGLISH_PACK_MASTER_STREAM_CHAR_FUSE = 200_000;

/**
 * 主 Agent 产出写入下游「检索附录」的后备上限（字符数）。
 * 系统提示要求模型将（若有）工具结果归纳后控制在约 1800 汉字内；附录经 `finalizeMasterResearchAppendix` 截断后再进入子模型 user（按需前置），本值为对主 Agent 流式正文的硬上限保护。
 */
export const ENGLISH_PACK_MASTER_APPENDIX_CHAR_CAP = 24_000;

/** 主 Agent 主题 → 联网 recency 启发规则（顺序敏感：先匹配先返回） */
export const ENGLISH_PACK_WEB_SEARCH_RECENCY_HEURISTIC_RULES: ReadonlyArray<{
	preset: WebSearchRecencyPreset;
	re: RegExp;
}> = [
	{
		preset: 'day',
		re: /今日|今天|本日|昨夜|昨晚|今早|刚才|刚刚|实时|突发|小时前|分钟前|即时|快讯|头条|\btoday\b|\btonight\b|\blast night\b|\bthis morning\b|\bbreaking news\b|\bbreaking\b/i,
	},
	{
		preset: 'week',
		re: /本周|这周|近一周|过去一周|\bpast week\b|\bthis week\b/i,
	},
	{
		preset: 'month',
		re: /本月|这个月|近一月|近一个月|\bthis month\b/i,
	},
	{
		preset: 'year',
		re: /今年|本年|年初至今|year to date|\bthis year\b|20[12][0-9]\s*年|20[12][0-9][年.\-/]/i,
	},
	{
		preset: 'year',
		re: /近几年|近些年|近若干年|最近一年|过去一年|近一年|过去数年|\brecent years\b|\bin the past year\b|\bover the past year\b/i,
	},
	{
		preset: 'month',
		re: /近期|近段时间|近段时期|近来一段|最近几个月|过去几个月|近几个月|近两三个月|近半年|近三十天|近30天|\bover the past (few|several) months\b|\bin recent months\b/i,
	},
	{
		preset: 'week',
		re: /最近|近来|近况|近些天|近些日子|近几日|近几天|这些天|这几天|前些天|前两天|这两天|上一阵|一阵子|前不久|\brecently\b|\brecent\b|\blately\b|\bin recent days\b|\bover the past few\b|\bthe last few (days|weeks)\b/i,
	},
];

export const ENGLISH_PACK_WEB_SEARCH_RECENCY_NEWS_FLAVOR_RE =
	/最新|热点|新闻|资讯|动态|舆情|股价|汇率|财报|融资|发布会|上新|单曲打榜|票房|赛程|赛果|转会/i;

export const ENGLISH_PACK_WEB_SEARCH_RECENCY_NEWS_EN_RE =
	/\b(latest|headlines?|news)\b/i;
