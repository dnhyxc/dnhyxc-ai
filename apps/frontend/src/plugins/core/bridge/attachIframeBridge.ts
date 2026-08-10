import { getActiveLocale, type Locale } from '@/i18n';
import { onListen } from '@/utils';
import type { HostBridgeProps } from '../types';

export const MF_IFRAME_CHANNEL = 'dnhyxc-mf-iframe';

type RpcMsg = {
	channel: typeof MF_IFRAME_CHANNEL;
	type: 'rpc';
	id: string;
	method: string;
	args: unknown[];
};

type ReadyMsg = {
	channel: typeof MF_IFRAME_CHANNEL;
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
): Promise<unknown> {
	const { api } = bridge;
	const ebook = api.modules?.ebook as
		| {
				getBookId: () => string | null;
				getBookTitle: () => string | null;
				navigateToCfi: (cfi: string) => void | Promise<void>;
				openThought: (t: unknown) => void;
				closeIdeasList?: () => void;
		  }
		| undefined;

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
		case 'ebook.getBookId':
			return ebook?.getBookId() ?? null;
		case 'ebook.getBookTitle':
			return ebook?.getBookTitle() ?? null;
		case 'ebook.navigateToCfi':
			await ebook?.navigateToCfi(String(args[0] ?? ''));
			return null;
		case 'ebook.openThought':
			ebook?.openThought(args[0]);
			return null;
		case 'ebook.closeIdeasList':
			ebook?.closeIdeasList?.();
			return null;
		default:
			throw new Error(`UNKNOWN_RPC: ${method}`);
	}
}

/** Host ↔ untrusted iframe：把 bridge 能力经 postMessage 暴露给 embed 页 */
export function attachIframeBridge(
	iframe: HTMLIFrameElement,
	bridge: HostBridgeProps,
	targetOrigin: string,
): () => void {
	const win = () => iframe.contentWindow;

	const sendInit = () => {
		const w = win();
		if (!w) return;
		w.postMessage(
			{
				channel: MF_IFRAME_CHANNEL,
				type: 'init',
				theme: bridge.api.theme,
				locale: getActiveLocale(),
				plugin: bridge.plugin,
			},
			targetOrigin,
		);
	};

	const pushLocale = (locale: Locale) => {
		const w = win();
		if (!w) return;
		w.postMessage(
			{
				channel: MF_IFRAME_CHANNEL,
				type: 'locale',
				locale,
			},
			targetOrigin,
		);
	};

	let unlistenLocale: (() => void) | undefined;
	void onListen<Locale>('locale', (next) => {
		if (next === 'zh-CN' || next === 'en-US') pushLocale(next);
	}).then((fn) => {
		unlistenLocale = fn;
	});

	const onMessage = (ev: MessageEvent) => {
		if (ev.source !== win()) return;
		if (targetOrigin !== '*' && ev.origin !== targetOrigin) return;
		const data = ev.data;
		if (!isRecord(data) || data.channel !== MF_IFRAME_CHANNEL) return;

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
				const value = await dispatchRpc(bridge, rpc.method, args);
				win()?.postMessage(
					{
						channel: MF_IFRAME_CHANNEL,
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
						channel: MF_IFRAME_CHANNEL,
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
