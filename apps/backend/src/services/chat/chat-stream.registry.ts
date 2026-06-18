import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type ChatStreamHandle = {
	/** 注册世代号：旧流 finally 清理时须匹配，避免误伤同 session 的新流 */
	id: number;
	cancel$: Subject<void>;
	abortController: AbortController;
};

/**
 * 跨请求共享的 SSE 流取消句柄（单例）。
 * 不可把 RxJS Subject 写入 Redis——无法序列化且易造成堆泄漏。
 */
@Injectable()
export class ChatStreamRegistry {
	private readonly streams = new Map<string, ChatStreamHandle>();
	private nextHandleId = 0;

	register(sessionId: string): ChatStreamHandle {
		this.release(sessionId);
		const handle: ChatStreamHandle = {
			id: ++this.nextHandleId,
			cancel$: new Subject<void>(),
			abortController: new AbortController(),
		};
		this.streams.set(sessionId, handle);
		return handle;
	}

	get(sessionId: string): ChatStreamHandle | undefined {
		return this.streams.get(sessionId);
	}

	stop(sessionId: string): boolean {
		const handle = this.streams.get(sessionId);
		if (!handle) return false;
		handle.abortController.abort('用户手动停止');
		if (!handle.cancel$.closed) {
			handle.cancel$.next();
			handle.cancel$.complete();
		}
		this.streams.delete(sessionId);
		return true;
	}

	release(sessionId: string, handleId?: number): void {
		const handle = this.streams.get(sessionId);
		if (!handle) return;
		if (handleId != null && handle.id !== handleId) return;
		if (!handle.cancel$.closed) {
			handle.cancel$.complete();
		}
		this.streams.delete(sessionId);
	}

	cancelActive(sessionId: string): void {
		this.stop(sessionId);
	}
}
