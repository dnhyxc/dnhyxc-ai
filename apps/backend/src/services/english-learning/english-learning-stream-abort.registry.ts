import { Injectable, OnModuleDestroy } from '@nestjs/common';

type StreamEntry = {
	userId: number;
	controller: AbortController;
};

/** 整集标注 SSE 在 registry 中的 key（pause keepalive 靠此掐模型） */
export function annotateTaskAbortKey(taskId: string): string {
	return `annotate-task:${taskId.trim()}`;
}

/**
 * 英语学习 SSE 会话：按 streamId / annotate-task:id 登记 AbortController，
 * 供「显式取消 / pause keepalive」与连接断开共用。
 * 单进程内存即可；多副本部署时需改为 Redis Pub/Sub 或集中式任务队列同步取消信号。
 */
@Injectable()
export class EnglishLearningStreamAbortRegistry implements OnModuleDestroy {
	private readonly streams = new Map<string, StreamEntry>();

	register(
		userId: number,
		streamId: string,
		controller: AbortController,
	): void {
		const key = streamId.trim();
		if (!key) return;
		// 同 key 旧流先掐掉，避免双开
		const prev = this.streams.get(key);
		if (prev && prev.controller !== controller) {
			prev.controller.abort();
		}
		this.streams.set(key, { userId, controller });
	}

	unregister(streamId: string): void {
		this.streams.delete(streamId.trim());
	}

	/**
	 * 用户主动取消 / 刷新 keepalive pause：仅当 key 对应当前用户登记过时才 abort。
	 * @returns 是否命中并触发了 abort
	 */
	cancelByStreamId(userId: number, streamId: string): boolean {
		const key = streamId.trim();
		const entry = this.streams.get(key);
		if (entry == null || entry.userId !== userId) {
			return false;
		}
		if (!entry.controller.signal.aborted) {
			entry.controller.abort();
			console.warn(
				`\n========================================================\n[EnglishLearning] ★ 大模型已停止调用 ★ reason=registry_cancel key=${key} userId=${userId}\n========================================================\n`,
			);
		}
		return true;
	}

	onModuleDestroy(): void {
		for (const { controller } of this.streams.values()) {
			controller.abort();
		}
		this.streams.clear();
	}
}
