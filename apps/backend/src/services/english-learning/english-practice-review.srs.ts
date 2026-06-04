/** 练习复习 SM-2 轻量调度 */

/**
 * 解析 easeFactor，SM-2 算法中的熟练度因子。默认返回 2.5（初始值）。
 * @param raw - 原始字符串（可能为空或非法）
 * @returns 合法时返回 >=1.3 的浮点数，否则返回默认的 2.5
 */
export function parseEaseFactor(raw: string | undefined): number {
	const n = Number.parseFloat(raw ?? '');
	// 要求熟练度不得低于 1.3，不合法时强制返回 2.5
	return Number.isFinite(n) && n >= 1.3 ? n : 2.5;
}

/**
 * 基于传入的日期增加指定天数，返回新日期对象
 * @param base - 基础时间点（Date 对象）
 * @param days - 增加的天数（可为负数）
 * @returns 新的 Date 对象
 */
function addCalendarDays(base: Date, days: number): Date {
	const out = new Date(base);
	out.setDate(out.getDate() + days);
	return out;
}

/**
 * 构造新错误项（由于刚答错）时的 SRS 复习初始状态
 * @returns 包含下次复习时间/间隔/熟练度等初始状态
 */
export function defaultReviewStateForNewMistake(): {
	nextReviewAt: Date; // 下次复习时间（初始即现在）
	intervalDays: number; // 间隔：0 天
	repetitions: number; // 复习次数：0
	easeFactor: number; // 熟练度因子：2.5（初始值）
} {
	return {
		nextReviewAt: new Date(),
		intervalDays: 0,
		repetitions: 0,
		easeFactor: 2.5,
	};
}

/**
 * 应用 SM-2 算法更新复习项状态
 * @param input
 *   - repetitions: 当前的复习次数
 *   - intervalDays: 上次的间隔天数
 *   - easeFactor: 当前熟练度因子
 *   - correct: 本次作答是否正确
 * @returns
 *   - repetitions: 新的累计复习次数
 *   - intervalDays: 新的间隔天数
 *   - easeFactor: 新的熟练度因子
 *   - nextReviewAt: 下次复习日期
 *   - lastResult: 当前结果（'correct'或'wrong'）
 */
export function applyReviewSrs(input: {
	repetitions: number;
	intervalDays: number;
	easeFactor: number;
	correct: boolean;
}): {
	repetitions: number;
	intervalDays: number;
	easeFactor: number;
	nextReviewAt: Date;
	lastResult: 'correct' | 'wrong';
} {
	const now = new Date();

	if (!input.correct) {
		// 回答错误，复习计数/间隔归零；熟练度下调（最小 1.3）；明天再复习
		return {
			repetitions: 0,
			intervalDays: 0,
			easeFactor: Math.max(1.3, input.easeFactor - 0.2),
			nextReviewAt: addCalendarDays(now, 1),
			lastResult: 'wrong',
		};
	}

	// 回答正确，复习次数+1
	const repetitions = input.repetitions + 1;
	let intervalDays = input.intervalDays;

	// 根据复习次数(第1次、2次、更多次)选用不同间隔
	if (repetitions === 1) {
		intervalDays = 1; // 首次复习，下次为明天
	} else if (repetitions === 2) {
		intervalDays = 3; // 第二次复习，下次 3 天后
	} else {
		// 第三次及以后：用 SM-2 规则，上一间隔 * 熟练度因子
		intervalDays = Math.max(1, Math.round(intervalDays * input.easeFactor));
	}

	// 熟练度上调，但不超过 2.5
	const easeFactor = Math.min(2.5, input.easeFactor + 0.1);

	return {
		repetitions,
		intervalDays,
		easeFactor,
		nextReviewAt: addCalendarDays(now, intervalDays),
		lastResult: 'correct',
	};
}
