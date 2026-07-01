import { reaction } from 'mobx';
import { useEffect, useState } from 'react';
import { buildStreamTick } from '@/components/design/Assistant';
import assistantStore from '@/store/assistant';
import knowledgeRagQaStore from '@/store/knowledgeRagQa';

function readAssistantMessageCount(isRagMode: boolean): number {
	return isRagMode
		? knowledgeRagQaStore.messages.length
		: assistantStore.messages.length;
}

function readAssistantStreamTick(isRagMode: boolean): string {
	return buildStreamTick(
		isRagMode ? knowledgeRagQaStore.messages : assistantStore.messages,
	);
}

/** 仅条数变化时更新，避免流式 chunk 替换数组元素导致父级 observer 重渲染 */
export function useAssistantMessageCount(isRagMode: boolean): number {
	const [count, setCount] = useState(0);

	useEffect(() => {
		return reaction(() => readAssistantMessageCount(isRagMode), setCount, {
			fireImmediately: true,
		});
	}, [isRagMode]);

	return count;
}

/** 流式贴底 revision：与 buildStreamTick 一致，经 reaction 隔离父级 render */
export function useAssistantStreamTick(isRagMode: boolean): string {
	const [tick, setTick] = useState('');

	useEffect(() => {
		return reaction(() => readAssistantStreamTick(isRagMode), setTick, {
			fireImmediately: true,
		});
	}, [isRagMode]);

	return tick;
}
