import { Injectable, OnModuleDestroy } from '@nestjs/common';

type StreamEntry = {
	userId: number;
	controller: AbortController;
};

/**
 * 英语学习 SSE 会话：按 streamId 登记 AbortController，供「显式取消接口」与连接断开共用。
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
		this.streams.set(streamId, { userId, controller });
	}

	unregister(streamId: string): void {
		this.streams.delete(streamId);
	}

	/**
	 * 用户主动取消：仅当 streamId 对应当前用户登记过时才 abort。
	 * @returns 是否命中并触发了 abort
	 */
	cancelByStreamId(userId: number, streamId: string): boolean {
		const entry = this.streams.get(streamId);
		if (entry == null || entry.userId !== userId) {
			return false;
		}
		entry.controller.abort();
		return true;
	}

	onModuleDestroy(): void {
		for (const { controller } of this.streams.values()) {
			controller.abort();
		}
		this.streams.clear();
	}
}
