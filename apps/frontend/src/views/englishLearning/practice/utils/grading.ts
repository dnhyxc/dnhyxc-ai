/**
 * 拼写判分与题序工具
 *
 * 单词：规范化 + 忽略句末标点；语句：另忽略全部标点（保留字母、数字与空格）。
 */
/** 规范化用户拼写输入，用于与标准答案比较（单词 / 语句共用基底） */
export function normalizeSpellingAnswer(raw: string): string {
	return raw.trim().toLowerCase().replace(/[''']/g, "'").replace(/\s+/g, ' ');
}

/** 去除句末标点及紧跟其前的多余空格（不影响词内撇号等） */
function stripTrailingPunctuation(s: string): string {
	return s.replace(/[\s.,!?;:'"”“」』）\])}…—–-]+$/u, '').trim();
}

/** 单词判分：小写、统一引号与空格，并忽略句末标点 */
export function normalizeVocabSpellingAnswer(raw: string): string {
	return stripTrailingPunctuation(normalizeSpellingAnswer(raw));
}

/**
 * 语句判分用规范化：小写、统一引号与空格后，移除全部标点再比对。
 */
export function normalizeSentenceSpellingAnswer(raw: string): string {
	return stripTrailingPunctuation(normalizeSpellingAnswer(raw))
		.replace(/[^\p{L}\p{N}\s]/gu, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export type GradeSpellingOptions = {
	/** 经典句整句练习：忽略标点，大小写已在 normalize 中处理 */
	compareAsSentence?: boolean;
};

/**
 * 对用户的拼写输入进行判分
 */
export function gradeSpelling(
	userInput: string,
	expectedWord: string,
	options?: GradeSpellingOptions,
): boolean {
	const normalize = options?.compareAsSentence
		? normalizeSentenceSpellingAnswer
		: normalizeVocabSpellingAnswer;
	const u = normalize(userInput);
	const e = normalize(expectedWord);
	if (!u || !e) return false;
	return u === e;
}

/**
 * 洗牌算法：对单词题序进行随机打乱
 *
 * 实现方式：
 * 采用 Fisher-Yates 洗牌算法实现原地乱序，确保打乱的随机性与均匀分布。
 * 1. 先对输入数组 items 创建一份浅拷贝，避免修改原数组。
 * 2. 从数组末尾向前，随机选取一个位置 j，与当前位置 i 元素交换，直到遍历到第 1 个元素为止。
 * 3. 返回打乱后的新数组。
 *
 * @param items 待打乱的题目数组
 * @returns 随机顺序的新数组
 */
export function shufflePracticeItems<T>(items: T[]): T[] {
	const next = [...items]; // 浅拷贝，避免影响原数组
	for (let i = next.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1)); // 从 0 ~ i 随机任选一位
		[next[i], next[j]] = [next[j], next[i]]; // 交换元素
	}
	return next;
}
