/**
 * 拼写判分与题序工具
 *
 * 功能：规范化用户输入（去空格、小写、统一引号）后与标准 word 严格比对；
 * 提供 shufflePracticeItems 供随机出题或错题重练时打乱顺序。
 */
/** 规范化用户拼写输入，用于与标准答案比较 */
export function normalizeSpellingAnswer(raw: string): string {
	return raw.trim().toLowerCase().replace(/[''']/g, "'").replace(/\s+/g, ' ');
}

/**
 * 对用户的拼写输入进行判分
 *
 * 逻辑流程：
 * 1. 首先使用 normalizeSpellingAnswer 对用户输入和标准答案进行规范化处理（去除首尾空格、转小写、统一引号、压缩空格）。
 * 2. 若任一处理结果为空（如输入为空字符串），直接返回 false（判定为错误答案）。
 * 3. 比较规范化后的字符串，完全相同则判为正确，返回 true，否则返回 false。
 *
 * @param userInput 用户输入的拼写
 * @param expectedWord 正确答案单词
 * @returns 是否答对（完全一致为 true，否则 false）
 */
export function gradeSpelling(
	userInput: string,
	expectedWord: string,
): boolean {
	const u = normalizeSpellingAnswer(userInput); // 规范化用户输入
	const e = normalizeSpellingAnswer(expectedWord); // 规范化标准答案
	if (!u || !e) return false; // 输入或标准答案为空时，直接判错
	return u === e; // 严格一致即为正确
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
