import { useEffect } from 'react';
import { publishPointContext } from './session';

/** 页面把当前上下文交给扩展点，离开时清空。序列化后相同则不重复写入。 */
export function usePointContext(
	pointId: string,
	data: Record<string, unknown> | null,
): void {
	const json = data ? JSON.stringify(data) : '';
	useEffect(() => {
		publishPointContext(
			pointId,
			json ? (JSON.parse(json) as Record<string, unknown>) : null,
		);
	}, [pointId, json]);
	useEffect(() => {
		return () => publishPointContext(pointId, null);
	}, [pointId]);
}
