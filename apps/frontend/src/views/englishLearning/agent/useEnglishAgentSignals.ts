import { reaction } from 'mobx';
import { useEffect, useState } from 'react';
import { buildStreamTick } from '@/components/design/Assistant';
import englishAgentStore from '@/store/englishAgent';

/** 仅条数变化；流式改 content 不触发 */
export function useEnglishAgentMessageCount(): number {
	const [count, setCount] = useState(0);
	useEffect(() => {
		return reaction(() => englishAgentStore.messages.length, setCount, {
			fireImmediately: true,
		});
	}, []);
	return count;
}

/**
 * 流式贴底 revision：与消息 content 同频（store 已 rAF 合并），同步 setTick 避免贴底晚于撑高。
 */
export function useEnglishAgentStreamTick(): string {
	const [tick, setTick] = useState('');
	useEffect(() => {
		return reaction(
			() => buildStreamTick(englishAgentStore.messages),
			setTick,
			{
				fireImmediately: true,
			},
		);
	}, []);
	return tick;
}

function useEnglishAgentFlag<T>(read: () => T): T {
	const [value, setValue] = useState(read);
	useEffect(() => {
		return reaction(read, setValue, { fireImmediately: true });
	}, [read]);
	return value;
}

const readIsSending = () => englishAgentStore.isSending;
const readIsStreaming = () => englishAgentStore.isStreaming;
const readIsHydrating = () => englishAgentStore.isHydrating;
const readSessionId = () => englishAgentStore.sessionId;
const readToolStatus = () => englishAgentStore.toolStatus;

export function useEnglishAgentIsSending(): boolean {
	return useEnglishAgentFlag(readIsSending);
}

export function useEnglishAgentIsStreaming(): boolean {
	return useEnglishAgentFlag(readIsStreaming);
}

export function useEnglishAgentIsHydrating(): boolean {
	return useEnglishAgentFlag(readIsHydrating);
}

export function useEnglishAgentSessionId(): string | null {
	return useEnglishAgentFlag(readSessionId);
}

export function useEnglishAgentToolStatus(): string | null {
	return useEnglishAgentFlag(readToolStatus);
}
