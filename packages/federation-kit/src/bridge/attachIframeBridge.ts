import type { HostBridgeProps, HostLocale } from '../types';

export const DEFAULT_MF_IFRAME_CHANNEL = 'dnhyxc-mf-iframe';

type RpcMsg = {
	channel: string;
	type: 'rpc';
	id: string;
	method: string;
	args: unknown[];
};

type ReadyMsg = {
	channel: string;
	type: 'ready';
	pluginId: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
	return !!v && typeof v === 'object';
}

async function dispatchRpc(
	bridge: HostBridgeProps,
	method: string,
	args: unknown[],
	extra?: Record<
		string,
		(bridge: HostBridgeProps, args: unknown[]) => unknown | Promise<unknown>
	>,
): Promise<unknown> {
	if (extra?.[method]) {
		return extra[method](bridge, args);
	}
	const { api } = bridge;

	switch (method) {
		case 'http.get':
			if (!api.http) throw new Error('HTTP_DENIED');
			return api.http.get(String(args[0] ?? ''));
		case 'http.post':
			if (!api.http) throw new Error('HTTP_DENIED');
			return api.http.post(String(args[0] ?? ''), args[1]);
		case 'http.put':
			if (!api.http) throw new Error('HTTP_DENIED');
			return api.http.put(String(args[0] ?? ''), args[1]);
		case 'http.delete':
			if (!api.http) throw new Error('HTTP_DENIED');
			return api.http.delete(String(args[0] ?? ''));
		case 'ui.showToast':
			if (!api.ui) throw new Error('UI_DENIED');
			api.ui.showToast(
				args[0] as {
					message: string;
					type?: 'success' | 'error' | 'info';
				},
			);
			return null;
		case 'ui.downloadBlob': {
			if (!api.ui?.downloadBlob) throw new Error('UI_DENIED');
			const opt = args[0] as {
				fileName?: string;
				data?: ArrayBuffer | Uint8Array;
				mimeType?: string;
			};
			if (!opt?.fileName || opt.data == null) {
				throw new Error('INVALID_DOWNLOAD_ARGS');
			}
			return api.ui.downloadBlob({
				fileName: String(opt.fileName),
				data: opt.data,
				mimeType: opt.mimeType,
			});
		}
		default:
			throw new Error(`UNKNOWN_RPC: ${method}`);
	}
}

export type AttachIframeBridgeOptions = {
	channel?: string;
	getLocale: () => HostLocale | string;
	onLocaleChange?: (handler: (locale: HostLocale) => void) => () => void;
	extraRpc?: Record<
		string,
		(bridge: HostBridgeProps, args: unknown[]) => unknown | Promise<unknown>
	>;
};

/** Host ↔ untrusted iframe：把 bridge 能力经 postMessage 暴露给 embed 页 */
export function attachIframeBridge(
	iframe: HTMLIFrameElement,
	bridge: HostBridgeProps,
	targetOrigin: string,
	opts: AttachIframeBridgeOptions,
): () => void {
	const channel = opts.channel ?? DEFAULT_MF_IFRAME_CHANNEL;
	const win = () => iframe.contentWindow;

	const sendInit = () => {
		const w = win();
		if (!w) return;
		w.postMessage(
			{
				channel,
				type: 'init',
				theme: bridge.api.theme,
				locale: opts.getLocale(),
				plugin: bridge.plugin,
			},
			targetOrigin,
		);
	};

	const pushLocale = (locale: HostLocale | string) => {
		const w = win();
		if (!w) return;
		w.postMessage({ channel, type: 'locale', locale }, targetOrigin);
	};

	const unlistenLocale = opts.onLocaleChange?.((next) => {
		if (next === 'zh-CN' || next === 'en-US') pushLocale(next);
	});

	const onMessage = (ev: MessageEvent) => {
		if (ev.source !== win()) return;
		if (targetOrigin !== '*' && ev.origin !== targetOrigin) return;
		const data = ev.data;
		if (!isRecord(data) || data.channel !== channel) return;

		if (data.type === 'ready') {
			const ready = data as ReadyMsg;
			if (ready.pluginId && ready.pluginId !== bridge.plugin.id) return;
			sendInit();
			return;
		}

		if (data.type !== 'rpc') return;
		const rpc = data as RpcMsg;
		if (typeof rpc.id !== 'string' || typeof rpc.method !== 'string') return;
		const args = Array.isArray(rpc.args) ? rpc.args : [];

		void (async () => {
			try {
				const value = await dispatchRpc(
					bridge,
					rpc.method,
					args,
					opts.extraRpc,
				);
				win()?.postMessage(
					{
						channel,
						type: 'rpc-result',
						id: rpc.id,
						ok: true,
						value,
					},
					targetOrigin,
				);
			} catch (e) {
				win()?.postMessage(
					{
						channel,
						type: 'rpc-result',
						id: rpc.id,
						ok: false,
						error: e instanceof Error ? e.message : String(e),
					},
					targetOrigin,
				);
			}
		})();
	};

	window.addEventListener('message', onMessage);

	const onLoad = () => sendInit();
	iframe.addEventListener('load', onLoad);
	if (iframe.contentDocument?.readyState === 'complete') {
		sendInit();
	}

	return () => {
		window.removeEventListener('message', onMessage);
		iframe.removeEventListener('load', onLoad);
		unlistenLocale?.();
	};
}

/** @deprecated 兼容旧名；请用 DEFAULT_MF_IFRAME_CHANNEL 或 config.iframeChannel */
export const MF_IFRAME_CHANNEL = 'dnhyxc-mf-iframe';
