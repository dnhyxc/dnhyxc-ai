import { getPluginEnabledPref } from './pluginEnabledPrefs';

type Listener = () => void;

/** 订阅插件启用状态变化的监听器集合 */
const listeners = new Set<Listener>();

export function notifyPluginEnabled() {
	for (const fn of listeners) fn();
}

// 订阅插件启用状态变化
export function subscribePluginEnabled(fn: Listener) {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

/**
 * 是否上架：读当前账号服务端偏好的内存缓存（按 userId 隔离，Web/桌面同步）。
 * 未设置 / 未加载时默认关闭。
 */
export function isPluginEnabled(id: string): boolean {
	return getPluginEnabledPref(id);
}
