/**
 * Host 跨窗 sync 总线工厂：BC + Tauri 全局 emit（桌面多 WebView）。
 * 各插件声明 channel / windowIdKey / 消息类型即可复用。
 */
import {
	createPluginSyncBus,
	type PluginSyncBus,
} from '@dnhyxc-ai/federation-kit';
import { onEmit, onListen } from '@/utils/event';
import { isTauriRuntime } from '@/utils/runtime';

export type HostPluginSyncBusConfig = {
	/** BroadcastChannel 名，建议 `dnhyxc-<plugin>-sync-v1` */
	channel: string;
	/** sessionStorage 窗口 ID 键 */
	windowIdKey: string;
	/** Tauri 全局事件名；缺省与 channel 相同 */
	tauriEvent?: string;
	logTag?: string;
};

/** 创建插件跨窗 sync 总线（Web BC + Tauri emit 双通道） */
export function createHostPluginSyncBus<T extends { type: string }>(
	config: HostPluginSyncBusConfig,
): PluginSyncBus<T> {
	const tauriEvent = config.tauriEvent ?? config.channel;
	return createPluginSyncBus<T>({
		channel: config.channel,
		windowIdKey: config.windowIdKey,
		logTag: config.logTag,
		transport: {
			publishGlobal: (_channel, msg) => {
				if (!isTauriRuntime()) return;
				void onEmit(tauriEvent, msg);
			},
			subscribeGlobal: (_channel, handler) => {
				if (!isTauriRuntime()) return;
				return onListen<T>(tauriEvent, (msg) => {
					if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
					handler(msg);
				});
			},
		},
	});
}
