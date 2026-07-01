/** 流式 SSE 增量合并为每帧最多一次 MobX 写入，避免每 token 触发整页 observer */
export type StreamingMobxPatchScheduler = {
	schedule: () => void;
	/** 立即刷入并取消待执行的 rAF */
	flush: () => void;
	cancel: () => void;
};

export function createStreamingMobxPatchScheduler(
	flush: () => void,
): StreamingMobxPatchScheduler {
	let rafId = 0;
	let dirty = false;

	const runFlush = () => {
		dirty = false;
		rafId = 0;
		flush();
	};

	return {
		schedule: () => {
			if (dirty) return;
			dirty = true;
			rafId = requestAnimationFrame(runFlush);
		},
		flush: () => {
			if (rafId) cancelAnimationFrame(rafId);
			dirty = false;
			rafId = 0;
			flush();
		},
		cancel: () => {
			if (rafId) cancelAnimationFrame(rafId);
			dirty = false;
			rafId = 0;
		},
	};
}
