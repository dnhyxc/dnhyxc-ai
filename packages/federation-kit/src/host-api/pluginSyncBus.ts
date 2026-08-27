export type PluginSyncBusTransport<T> = {
	/** 多 WebView 全局投递；缺省仅 BroadcastChannel + 本窗 dispatch */
	publishGlobal?: (channel: string, msg: T) => void | Promise<void>;
	subscribeGlobal?: (
		channel: string,
		handler: (msg: T) => void,
	) => (() => void) | void | Promise<(() => void) | undefined>;
};

export type PluginSyncBus<T extends { type: string }> = {
	getWindowId: () => string;
	publish: (msg: T) => void;
	subscribe: (handler: (msg: T) => void) => () => void;
};

function isTypedMessage<T extends { type: string }>(msg: unknown): msg is T {
	return !!msg && typeof msg === 'object' && 'type' in msg;
}

/** BroadcastChannel + 可选全局 transport；消息协议由插件自定（须含 `type`） */
export function createPluginSyncBus<T extends { type: string }>(config: {
	channel: string;
	windowIdKey: string;
	logTag?: string;
	transport?: PluginSyncBusTransport<T>;
}): PluginSyncBus<T> {
	const logTag = config.logTag ?? `pluginSyncBus:${config.channel}`;
	const handlers = new Set<(msg: T) => void>();
	let channel: BroadcastChannel | null = null;
	let globalListenStarted = false;

	const dispatch = (msg: T) => {
		for (const h of handlers) {
			try {
				h(msg);
			} catch (e) {
				console.error(`[${logTag}]`, e);
			}
		}
	};

	const getChannel = (): BroadcastChannel | null => {
		if (typeof BroadcastChannel === 'undefined') return null;
		if (!channel) {
			channel = new BroadcastChannel(config.channel);
			channel.onmessage = (ev: MessageEvent<T>) => {
				if (!isTypedMessage<T>(ev.data)) return;
				dispatch(ev.data);
			};
		}
		return channel;
	};

	const ensureGlobalListen = () => {
		if (globalListenStarted || !config.transport?.subscribeGlobal) return;
		globalListenStarted = true;
		// ponytail: 进程级单例，全局 listen 随页面生命周期
		void config.transport.subscribeGlobal(config.channel, (msg) => {
			if (!isTypedMessage<T>(msg)) return;
			dispatch(msg);
		});
	};

	const getWindowId = (): string => {
		if (typeof sessionStorage === 'undefined') return 'ssr';
		let id = sessionStorage.getItem(config.windowIdKey);
		if (!id) {
			id =
				typeof crypto !== 'undefined' && 'randomUUID' in crypto
					? crypto.randomUUID()
					: `w-${Date.now()}-${Math.random().toString(36).slice(2)}`;
			sessionStorage.setItem(config.windowIdKey, id);
		}
		return id;
	};

	return {
		getWindowId,
		publish(msg: T) {
			ensureGlobalListen();
			getChannel()?.postMessage(msg);
			dispatch(msg);
			void config.transport?.publishGlobal?.(config.channel, msg);
		},
		subscribe(handler: (msg: T) => void) {
			ensureGlobalListen();
			getChannel();
			handlers.add(handler);
			return () => {
				handlers.delete(handler);
			};
		},
	};
}
