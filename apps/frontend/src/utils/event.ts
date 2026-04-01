import { isTauriRuntime } from './runtime';

// 发送全局事件
export const onEmit = async <T>(event: string, payload?: T) => {
	if (isTauriRuntime()) {
		const { emit } = await import('@tauri-apps/api/event');
		await emit(event, payload);
		return;
	}
	window.dispatchEvent(new CustomEvent(event, { detail: payload }));
};

export const onListen = <T>(event: string, handler: (event: T) => void) => {
	if (!isTauriRuntime()) {
		const fn = (e: Event) => {
			handler((e as CustomEvent<T>).detail);
		};
		window.addEventListener(event, fn as EventListener);
		return Promise.resolve(() =>
			window.removeEventListener(event, fn as EventListener),
		);
	}
	return import('@tauri-apps/api/event').then(({ listen }) =>
		listen(event, (ev) => {
			handler(ev.payload as T);
		}),
	);
};
