import { ChatStreamRegistry } from './chat-stream.registry';

describe('ChatStreamRegistry', () => {
	it('旧流 finally 不应误清理同 session 的新流', () => {
		const reg = new ChatStreamRegistry();
		const sessionId = 'sess-1';

		const handleA = reg.register(sessionId);
		reg.cancelActive(sessionId);
		const handleB = reg.register(sessionId);

		let bCompleted = false;
		handleB.cancel$.subscribe({
			complete: () => {
				bCompleted = true;
			},
		});

		reg.release(sessionId, handleA.id);

		expect(handleB.cancel$.closed).toBe(false);
		expect(bCompleted).toBe(false);
		expect(reg.get(sessionId)?.id).toBe(handleB.id);

		reg.release(sessionId, handleB.id);
		expect(reg.get(sessionId)).toBeUndefined();
		expect(handleB.cancel$.isStopped).toBe(true);
	});

	it('stop 后 release 同 id 应为 noop', () => {
		const reg = new ChatStreamRegistry();
		const sessionId = 'sess-2';
		const handle = reg.register(sessionId);
		expect(reg.stop(sessionId)).toBe(true);
		reg.release(sessionId, handle.id);
		expect(reg.get(sessionId)).toBeUndefined();
	});
});
