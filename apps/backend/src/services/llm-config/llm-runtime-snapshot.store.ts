import type { VectorSearchProfile } from './llm-vector-profile';

export type { VectorSearchProfile };

/** 进程内按 userId 缓存的对话 LLM 运行时快照 */
export type LlmRuntimeSnapshot = {
	enabled: boolean;
	apiKey: string;
	baseUrl: string;
	modelName: string;
};

/** 进程内按 userId 缓存的知识库向量运行时快照 */
export type VectorRuntimeSnapshot = {
	enabled: boolean;
	apiKey: string;
	/** embedding 完整请求 URL */
	baseUrl: string;
	/** rerank 完整请求 URL */
	rerankBaseUrl: string;
	embeddingModel: string;
	rerankModel: string;
	collectionName: string;
	/** 曾保存过的多向量库检索档位（按 collection 累积） */
	searchProfiles: VectorSearchProfile[];
};

const loadedChatUserIds = new Set<number>();
const activeChatSnapshotsByUserId = new Map<number, LlmRuntimeSnapshot>();

const loadedVectorUserIds = new Set<number>();
const activeVectorSnapshotsByUserId = new Map<number, VectorRuntimeSnapshot>();

export function hasLlmRuntimeSnapshot(userId: number): boolean {
	return loadedChatUserIds.has(userId);
}

/** 未加载过返回 undefined；已加载但无有效配置返回 null */
export function getLlmRuntimeSnapshot(
	userId: number,
): LlmRuntimeSnapshot | null | undefined {
	if (!loadedChatUserIds.has(userId)) return undefined;
	return activeChatSnapshotsByUserId.get(userId) ?? null;
}

export function setLlmRuntimeSnapshot(
	userId: number,
	snapshot: LlmRuntimeSnapshot | null,
): void {
	loadedChatUserIds.add(userId);
	if (snapshot) {
		activeChatSnapshotsByUserId.set(userId, snapshot);
	} else {
		activeChatSnapshotsByUserId.delete(userId);
	}
}

export function clearLlmRuntimeSnapshot(userId: number): void {
	loadedChatUserIds.delete(userId);
	activeChatSnapshotsByUserId.delete(userId);
}

export function hasVectorRuntimeSnapshot(userId: number): boolean {
	return loadedVectorUserIds.has(userId);
}

export function getVectorRuntimeSnapshot(
	userId: number,
): VectorRuntimeSnapshot | null | undefined {
	if (!loadedVectorUserIds.has(userId)) return undefined;
	return activeVectorSnapshotsByUserId.get(userId) ?? null;
}

export function setVectorRuntimeSnapshot(
	userId: number,
	snapshot: VectorRuntimeSnapshot | null,
): void {
	loadedVectorUserIds.add(userId);
	if (snapshot) {
		activeVectorSnapshotsByUserId.set(userId, snapshot);
	} else {
		activeVectorSnapshotsByUserId.delete(userId);
	}
}

export function clearVectorRuntimeSnapshot(userId: number): void {
	loadedVectorUserIds.delete(userId);
	activeVectorSnapshotsByUserId.delete(userId);
}
