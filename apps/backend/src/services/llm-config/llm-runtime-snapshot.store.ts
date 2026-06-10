/** 进程内按 userId 缓存的运行时快照（避免 Nest 多实例时 this.snapshot 不同步） */
export type LlmRuntimeSnapshot = {
	enabled: boolean;
	apiKey: string;
	baseUrl: string;
	modelName: string;
};

const loadedUserIds = new Set<number>();
const activeSnapshotsByUserId = new Map<number, LlmRuntimeSnapshot>();

export function hasLlmRuntimeSnapshot(userId: number): boolean {
	return loadedUserIds.has(userId);
}

/** 未加载过返回 undefined；已加载但无有效配置返回 null */
export function getLlmRuntimeSnapshot(
	userId: number,
): LlmRuntimeSnapshot | null | undefined {
	if (!loadedUserIds.has(userId)) return undefined;
	return activeSnapshotsByUserId.get(userId) ?? null;
}

export function setLlmRuntimeSnapshot(
	userId: number,
	snapshot: LlmRuntimeSnapshot | null,
): void {
	loadedUserIds.add(userId);
	if (snapshot) {
		activeSnapshotsByUserId.set(userId, snapshot);
	} else {
		activeSnapshotsByUserId.delete(userId);
	}
}

export function clearLlmRuntimeSnapshot(userId: number): void {
	loadedUserIds.delete(userId);
	activeSnapshotsByUserId.delete(userId);
}
