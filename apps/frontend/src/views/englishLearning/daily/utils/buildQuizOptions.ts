import type { DailyQuizOption, DailyVocabCard } from '../types';

/**
 * 打乱数组顺序的函数（Fisher-Yates 洗牌算法实现）
 * @template T 数组元素类型
 * @param {T[]} arr - 需要被打乱的原数组，不会修改原数组本身
 * @returns {T[]} - 被打乱顺序后的新数组
 *
 * 实现说明：
 * 1. 复制输入数组，确保不会更改原数组；
 * 2. 从后往前遍历新数组，对于第 i 个元素，
 *    随机选取一个小于等于 i 的下标 j；
 * 3. 交换 out[i] 与 out[j] 的值；
 * 4. 最终返回新的乱序数组。
 */
function shuffle<T>(arr: T[]): T[] {
	const out = [...arr]; // 复制一份数组，避免污染原数据
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1)); // 随机选取区间 [0, i] 内的下标
		// 交换当前元素与随机下标元素
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out; // 返回打乱后的新数组
}

/**
 * 构建每日词汇测验的多项选择题选项
 * 1. 从备选词汇池中为目标词卡选择误导选项（排除自身、去除空义项、去重）。
 * 2. 若池中干扰项不足，则补充一些通用中文词汇，避免与答案重复。
 * 3. 汇总正确答案和三个干扰项（共4个），再洗牌输出。
 *
 * @param {DailyVocabCard} card - 当前题目词卡
 * @param {DailyVocabCard[]} pool - 题库池（包含其他词卡，可作为干扰项来源）
 * @returns {DailyQuizOption[]} - 洗牌后的选项列表，结构含正确/干扰标记
 */
export function buildQuizOptions(
	card: DailyVocabCard,
	pool: DailyVocabCard[],
): DailyQuizOption[] {
	// 1. 从 pool 中筛选非自身的卡片，且中文释义非空，收集其中文释义作为初步干扰项
	const distractors = pool
		.filter((w) => w.key !== card.key && w.translationZh.trim())
		.map((w) => w.translationZh.trim());

	// 2. 去重、去除可能与当前卡片释义重复的项
	const unique = [...new Set(distractors)].filter(
		(t) => t !== card.translationZh.trim(),
	);

	// 3. 默认的补充干扰义项（当池子不够用时兜底填充），避免过难或重复
	const fallback = ['学习', '城市', '电脑', '天气', '音乐', '旅行', '家庭'];

	// 4. 打乱 unique 后取前 3 个作备选
	const picked = shuffle(unique).slice(0, 3);

	// 5. 若不足 3 个，从 fallback 中打乱后依次取用，跳过与答案或已选重复的
	for (const label of shuffle(fallback)) {
		if (picked.length >= 3) break;
		if (label === card.translationZh.trim() || picked.includes(label)) continue;
		picked.push(label);
	}

	// 6. 组装选项，第一个为正确答案，其余为干扰项，id区分；再整体 shuffle
	const options: DailyQuizOption[] = [
		{ id: 'correct', label: card.translationZh.trim(), correct: true },
		...picked.map((label, i) => ({
			id: `d${i}`,
			label,
			correct: false,
		})),
	];
	// 7. 最终洗牌，避免正确答案位置固定
	return shuffle(options);
}
