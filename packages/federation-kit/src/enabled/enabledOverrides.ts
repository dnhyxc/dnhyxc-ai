type Listener = () => void;

const ENABLED_KEY = '__dnhyxc_ai_federation_enabled__';

type EnabledBag = {
	getPref: (id: string) => boolean;
	/** 偏好是否已拉取；缺省 true（同步 localStorage store） */
	isReady: () => boolean;
	listeners: Set<Listener>;
};

type GlobalBag = typeof globalThis & {
	[ENABLED_KEY]?: EnabledBag;
};

function store(): EnabledBag {
	const g = globalThis as GlobalBag;
	if (!g[ENABLED_KEY]) {
		g[ENABLED_KEY] = {
			getPref: () => false,
			// 未 configure 前视为未就绪，避免刷新把 false 闪成「已下架」
			isReady: () => false,
			listeners: new Set(),
		};
	}
	return g[ENABLED_KEY]!;
}

/** 由 createPluginRuntime / Host adapter 注入偏好读取 */
export function configureEnabledGetter(get: (id: string) => boolean) {
	store().getPref = get;
}

/** 异步偏好：未 ready 前勿把 false 当成「已下架」 */
export function configureEnabledReady(get: () => boolean) {
	store().isReady = get;
}

export function isEnabledPrefsReady(): boolean {
	return store().isReady();
}

export function notifyPluginEnabled() {
	for (const fn of store().listeners) fn();
}

export function subscribePluginEnabled(fn: Listener) {
	store().listeners.add(fn);
	return () => {
		store().listeners.delete(fn);
	};
}

export function isPluginEnabled(id: string): boolean {
	return store().getPref(id);
}
