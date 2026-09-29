/**
 * 练习听写取消域：切题 / 换队列 abort 旧世代请求。
 */

export type PracticeRequestScope = {
	readonly generation: number;
	readonly signal: AbortSignal;
	/** 切题或换队列：abort 旧控制器并换新 */
	bump: () => AbortSignal;
	/** 离开 running：abort；再次 bump 可重开 */
	dispose: () => void;
};

export function createPracticeRequestScope(): PracticeRequestScope {
	let generation = 0;
	let controller = new AbortController();

	return {
		get generation() {
			return generation;
		},
		get signal() {
			return controller.signal;
		},
		bump() {
			if (!controller.signal.aborted) {
				controller.abort();
			}
			controller = new AbortController();
			generation += 1;
			return controller.signal;
		},
		dispose() {
			if (!controller.signal.aborted) {
				controller.abort();
			}
		},
	};
}

/** 是否为用户/世代取消（不 Toast） */
export function isPracticeAbortError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const name = (err as { name?: string }).name;
	if (name === 'AbortError') return true;
	const msg = String((err as { message?: unknown }).message ?? '');
	return /aborted|AbortError/i.test(msg);
}

/** ponytail: 最小自检 */
export function selfCheckPracticeRequestScope(): void {
	const scope = createPracticeRequestScope();
	const s1 = scope.signal;
	const s2 = scope.bump();
	if (!s1.aborted || s2.aborted || scope.generation !== 1) {
		throw new Error('practiceRequestScope bump failed');
	}
	scope.dispose();
	if (!s2.aborted) {
		throw new Error('practiceRequestScope dispose failed');
	}
}
