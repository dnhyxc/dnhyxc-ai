/** 进程内共享的运行时快照（避免 Nest 多实例时 this.snapshot 不同步） */
export type LlmRuntimeSnapshot = {
	enabled: boolean;
	apiKey: string;
	baseUrl: string;
	modelName: string;
};

let activeSnapshot: LlmRuntimeSnapshot | null = null;

export function setLlmRuntimeSnapshot(
	snapshot: LlmRuntimeSnapshot | null,
): void {
	activeSnapshot = snapshot;
}

export function getLlmRuntimeSnapshot(): LlmRuntimeSnapshot | null {
	return activeSnapshot;
}
