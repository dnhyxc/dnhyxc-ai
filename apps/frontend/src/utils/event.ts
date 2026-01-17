import { emit, listen } from '@tauri-apps/api/event';

// 发送全局事件
export const onEmit = async <T>(event: string, payload?: T) => {
	await emit(event, payload);
};

export const onListen = <T>(event: string, handler: (event: T) => void) => {
	const unlisten = listen(event, (event) => {
		handler(event.payload as T);
	});
	return unlisten;
};
