import type { HostIframeAppearance } from '../config/types';
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
		case 'ui.pickLocalFiles': {
			if (!api.ui?.pickLocalFiles) throw new Error('UI_DENIED');
			const opt = (args[0] ?? {}) as {
				accept?: string;
				multiple?: boolean;
				title?: string;
			};
			return api.ui.pickLocalFiles(opt);
		}
		default:
			throw new Error(`UNKNOWN_RPC: ${method}`);
	}
}

export type AttachIframeBridgeOptions = {
	channel?: string;
	getLocale: () => HostLocale | string;
	onLocaleChange?: (handler: (locale: HostLocale) => void) => () => void;
	/** 随 init / appearance 下发；缺省则 iframe 仅得 theme 字符串 */
	getAppearance?: () => HostIframeAppearance;
	onAppearanceChange?: (
		handler: (appearance: HostIframeAppearance) => void,
	) => () => void;
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
	/** ready 轮询只应答一次，避免 Strict Mode / 泄漏 interval 打爆主线程 */
	let readyAcked = false;
	let lastAppearanceFp = '';

	const sendInit = () => {
		const w = win();
		if (!w) return;
		const appearance = opts.getAppearance?.();
		w.postMessage(
			{
				channel,
				type: 'init',
				theme: appearance?.theme ?? bridge.api.theme,
				locale: opts.getLocale(),
				plugin: bridge.plugin,
				...(appearance ? { appearance } : {}),
			},
			targetOrigin,
		);
		if (appearance) {
			lastAppearanceFp = `${appearance.theme}|${appearance.darkClass ?? ''}|${JSON.stringify(appearance.cssVars)}`;
		}
	};

	const pushLocale = (locale: HostLocale | string) => {
		const w = win();
		if (!w) return;
		w.postMessage({ channel, type: 'locale', locale }, targetOrigin);
	};

	const pushAppearance = (appearance: HostIframeAppearance) => {
		const w = win();
		if (!w) return;
		const fp = `${appearance.theme}|${appearance.darkClass ?? ''}|${JSON.stringify(appearance.cssVars)}`;
		if (fp === lastAppearanceFp) return;
		lastAppearanceFp = fp;
		w.postMessage({ channel, type: 'appearance', appearance }, targetOrigin);
	};

	const unlistenLocale = opts.onLocaleChange?.((next) => {
		if (next === 'zh-CN' || next === 'en-US') pushLocale(next);
	});

	const unlistenAppearance = opts.onAppearanceChange?.((next) => {
		pushAppearance(next);
	});

	const onMessage = (ev: MessageEvent) => {
		if (ev.source !== win()) return;
		if (targetOrigin !== '*' && ev.origin !== targetOrigin) return;
		const data = ev.data;
		if (!isRecord(data) || data.channel !== channel) return;

		if (data.type === 'ready') {
			const ready = data as ReadyMsg;
			if (ready.pluginId && ready.pluginId !== bridge.plugin.id) return;
			if (readyAcked) return;
			readyAcked = true;
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

	const onLoad = () => {
		// load 可早于 iframe JS；不占 readyAcked，留给真正的 ready 握手
		sendInit();
	};
	iframe.addEventListener('load', onLoad);
	// 跨域时 contentDocument 可能抛错；勿让 attach 半途抛掉导致监听泄漏、无 cleanup
	try {
		if (iframe.contentDocument?.readyState === 'complete') {
			sendInit();
		}
	} catch {
		/* cross-origin */
	}

	// iframe JS 就绪略晚于 load 时，ready 会再 init；再补推一次强调色
	const kick = window.setTimeout(() => {
		const appearance = opts.getAppearance?.();
		if (appearance) pushAppearance(appearance);
	}, 120);

	return () => {
		window.clearTimeout(kick);
		window.removeEventListener('message', onMessage);
		iframe.removeEventListener('load', onLoad);
		unlistenLocale?.();
		unlistenAppearance?.();
	};
}

/** @deprecated 兼容旧名；请用 DEFAULT_MF_IFRAME_CHANNEL 或 config.iframeChannel */
export const MF_IFRAME_CHANNEL = 'dnhyxc-mf-iframe';
