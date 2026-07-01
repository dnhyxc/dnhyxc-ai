import { reaction } from 'mobx';
import { useEffect, useState } from 'react';
import assistantStore from '@/store/assistant';
import knowledgeRagQaStore from '@/store/knowledgeRagQa';

function readAssistantPaneBusy(): boolean {
	return (
		assistantStore.isStreaming ||
		assistantStore.isSending ||
		knowledgeRagQaStore.isStreaming ||
		knowledgeRagQaStore.isSending
	);
}

/**
 * 助手发送/流式 busy 信号：用 reaction 读 store，避免 observer 在 render 里订阅
 * messages 数组导致流式每 chunk 重渲染整棵 Markdown 树。
 */
export function useAssistantPaneBusy(active: boolean): boolean {
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!active) {
			setBusy(false);
			return;
		}
		return reaction(readAssistantPaneBusy, setBusy, { fireImmediately: true });
	}, [active]);

	return active && busy;
}
