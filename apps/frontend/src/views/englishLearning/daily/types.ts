export type DailyCardOrigin = 'server' | 'starter';

/** 今日记词词卡来源：词汇库随机（间隔复习见「今日复习」） */
export type DailyMemorizeSource = 'library';

/** 今日记词作答方式：认读四选一 / 听写拼写 / 看中写拼写 */
export type DailyMemorizeMode = 'recognition' | 'dictation' | 'spelling';

export type DailyVocabCard = {
	key: string;
	word: string;
	ipa: string;
	pos: string;
	segmentation: string;
	translationZh: string;
	example: string;
	origin: DailyCardOrigin;
	/** 服务端队列/记词记录带回的收藏 id */
	favoriteId?: string | null;
};

export type DailyCardStep = 'study' | 'quiz' | 'feedback';

export type DailyQuizOption = {
	id: string;
	label: string;
	correct: boolean;
};

/** 本轮记词结算（完成页展示对错统计） */
export type DailySessionSummary = {
	correctCount: number;
	wrongCount: number;
	total: number;
	/** 记词累计已练习总数（含本轮） */
	practicedTotal: number;
	/** 词池总量；有则「已练习数」显示 已练/总量 */
	poolTotal?: number;
	wrongCards: DailyVocabCard[];
	correctCards: DailyVocabCard[];
};

/** 记词会话的一轮（仅「继续练习」追加；重练错题就地改对，不追加） */
export type DailySessionRound = {
	roundIndex: number;
	wrongCards: DailyVocabCard[];
	correctCards: DailyVocabCard[];
	completedAt: string;
};
