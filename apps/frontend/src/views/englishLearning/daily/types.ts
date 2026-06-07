export type DailyCardOrigin = 'server' | 'starter';

/** 今日记词词卡来源：词汇库随机（间隔复习见「今日复习」） */
export type DailyMemorizeSource = 'library';

export type DailyVocabCard = {
	key: string;
	word: string;
	ipa: string;
	pos: string;
	segmentation: string;
	translationZh: string;
	example: string;
	origin: DailyCardOrigin;
};

export type DailyCardStep = 'study' | 'quiz' | 'feedback';

export type DailyQuizOption = {
	id: string;
	label: string;
	correct: boolean;
};
