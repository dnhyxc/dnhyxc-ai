/**
 * 练习听写/拼写：出声后滑动窗口批量预取云端 TTS。
 * 每次 kick 最多拉 ahead 条「尚未预取」的题，合并为一次 HTTP。
 */
import { prefetchCloudTtsBatch } from '@/utils/speech';

export type PracticeTtsPipeOptions = {
	/** 每次 kick 最多新预取条数（单次 batch 目标） */
	ahead?: number;
};

export type PracticeTtsPrefetchPipe = {
	kick: (cursorIndex: number) => void;
	cancel: () => void;
};

/**
 * 从 cursor 之后挑最多 ahead 条「未启动」下标。
 * 已启动的不计入名额（否则切题时窗口只剩 1 条，又变一句一请求）。
 */
export function planPrefetchBatch(args: {
	cursor: number;
	length: number;
	ahead: number;
	already: ReadonlySet<number>;
	skipEmpty?: (index: number) => boolean;
}): number[] {
	const ahead = Math.max(1, args.ahead);
	const want: number[] = [];
	for (
		let i = args.cursor + 1;
		i < args.length && want.length < ahead;
		i += 1
	) {
		if (args.skipEmpty?.(i)) continue;
		if (args.already.has(i)) continue;
		want.push(i);
	}
	return want;
}

/**
 * 创建管道：每次 kick 至多一次 batch HTTP（最多 ahead 句）。
 */
export function createPracticeTtsPrefetchPipe(
	texts: readonly string[],
	options?: PracticeTtsPipeOptions,
): PracticeTtsPrefetchPipe {
	const ahead = Math.max(1, Math.min(8, options?.ahead ?? 5));
	const normalized = texts.map((t) => t.trim());
	let cancelled = false;
	let cursor = 0;
	let pumping = false;
	let pendingKick = false;
	const started = new Set<number>();

	const pump = async () => {
		if (pumping || cancelled) return;
		pumping = true;
		try {
			do {
				pendingKick = false;
				const batch = planPrefetchBatch({
					cursor,
					length: normalized.length,
					ahead,
					already: started,
					skipEmpty: (i) => !normalized[i],
				});
				if (batch.length === 0) break;
				for (const i of batch) started.add(i);
				const payload = batch
					.map((i) => normalized[i])
					.filter((t): t is string => Boolean(t));
				if (payload.length === 0) break;
				try {
					if (!cancelled) {
						await prefetchCloudTtsBatch(payload);
					}
				} catch {
					// 整批失败：播放路径再单条拉
				}
				// kick 在 await 期间又来：用最新 cursor 再补一轮
			} while (pendingKick && !cancelled);
		} finally {
			pumping = false;
		}
	};

	return {
		kick(cursorIndex: number) {
			if (cancelled) return;
			cursor = Math.max(
				0,
				Math.min(cursorIndex, Math.max(0, normalized.length - 1)),
			);
			if (pumping) {
				pendingKick = true;
				return;
			}
			void pump();
		},
		cancel() {
			cancelled = true;
		},
	};
}

/** ponytail: 最小自检 */
export function selfCheckPracticeTtsPrefetchPipe(): void {
	const already = new Set<number>([2]);
	const batch = planPrefetchBatch({
		cursor: 0,
		length: 10,
		ahead: 5,
		already,
		skipEmpty: (i) => i === 1,
	});
	// 跳过空 1、已启动 2 → 取未启动 3,4,5,6,7
	if (batch.join(',') !== '3,4,5,6,7') {
		throw new Error(`planPrefetchBatch unexpected: ${batch.join(',')}`);
	}
	const again = planPrefetchBatch({
		cursor: 1,
		length: 10,
		ahead: 5,
		already: new Set([2, 3, 4, 5, 6, 7]),
		skipEmpty: () => false,
	});
	// 切题后应再取满 5 条新题，而不是只剩 1 条
	if (again.join(',') !== '8,9') {
		// length=10 → 下标 8,9 仅两条
		throw new Error(`planPrefetchBatch slide unexpected: ${again.join(',')}`);
	}
}
