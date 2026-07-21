/** 与 Host `attachIframeBridge` 协议一致；untrusted embed 用 */

export const MF_IFRAME_CHANNEL = 'dnhyxc-mf-iframe';

type HostBridgeProps = {
	api: {
		t: (key: string, params?: Record<string, unknown>) => string;
		theme: 'light' | 'dark';
		event: {
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		http?: {
			get: <T = unknown>(url: string) => Promise<T>;
			post: <T = unknown>(url: string, body?: unknown) => Promise<T>;
		};
		ui?: {
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => void;
		};
		modules?: Readonly<Record<string, unknown>>;
	};
	plugin: { id: string; version: string; routePath: string };
};

type Pending = {
	resolve: (v: unknown) => void;
	reject: (e: Error) => void;
};

function isRecord(v: unknown): v is Record<string, unknown> {
	return !!v && typeof v === 'object';
}

export function connectIframeHost(pluginId: string): Promise<HostBridgeProps> {
	if (window.parent === window) {
		return Promise.reject(new Error('embed 页须在 Host iframe 内打开'));
	}

	const pending = new Map<string, Pending>();
	let seq = 0;

	const rpc = (method: string, args: unknown[] = []) =>
		new Promise<unknown>((resolve, reject) => {
			const id = `r${++seq}`;
			pending.set(id, { resolve, reject });
			window.parent.postMessage(
				{ channel: MF_IFRAME_CHANNEL, type: 'rpc', id, method, args },
				'*',
			);
		});

	return new Promise((resolve, reject) => {
		let settled = false;
		const timeout = window.setTimeout(() => {
			teardown();
			if (!settled) {
				settled = true;
				reject(new Error('等待 Host init 超时'));
			}
		}, 15_000);

		const teardown = () => {
			window.clearTimeout(timeout);
			window.clearInterval(retry);
			window.removeEventListener('message', onMessage);
		};

		const onMessage = (ev: MessageEvent) => {
			const data = ev.data;
			if (!isRecord(data) || data.channel !== MF_IFRAME_CHANNEL) return;

			if (data.type === 'init') {
				window.clearInterval(retry);
				window.clearTimeout(timeout);
				const theme =
					data.theme === 'dark' || data.theme === 'light'
						? data.theme
						: 'light';
				const plugin =
					isRecord(data.plugin) && typeof data.plugin.id === 'string'
						? {
								id: String(data.plugin.id),
								version: String(data.plugin.version ?? '0'),
								routePath: String(data.plugin.routePath ?? ''),
							}
						: { id: pluginId, version: '0', routePath: '' };

				document.documentElement.dataset.theme = theme;

				const bridge: HostBridgeProps = {
					api: {
						t: (k) => k,
						theme,
						event: {
							on: () => undefined,
							off: () => undefined,
							emit: () => undefined,
						},
						http: {
							get: (url) => rpc('http.get', [url]) as Promise<never>,
							post: (url, body) =>
								rpc('http.post', [url, body]) as Promise<never>,
						},
						ui: {
							showToast: (options) => {
								void rpc('ui.showToast', [options]);
							},
						},
						modules: {
							ebook: {
								getBookId: () => null,
								getBookTitle: () => null,
								navigateToCfi: (cfi: string) =>
									rpc('ebook.navigateToCfi', [cfi]),
								openThought: (thought: unknown) =>
									rpc('ebook.openThought', [thought]),
								closeIdeasList: () => rpc('ebook.closeIdeasList'),
							},
						},
					},
					plugin,
				};

				// IdeasList 同步读 getBookId()；RPC 异步 → 预取后改写为同步返回
				void (async () => {
					try {
						const [bookId, bookTitle] = await Promise.all([
							rpc('ebook.getBookId'),
							rpc('ebook.getBookTitle'),
						]);
						const ebook = bridge.api.modules!.ebook as {
							getBookId: () => string | null;
							getBookTitle: () => string | null;
						};
						ebook.getBookId = () =>
							typeof bookId === 'string' || bookId === null ? bookId : null;
						ebook.getBookTitle = () =>
							typeof bookTitle === 'string' || bookTitle === null
								? bookTitle
								: null;
						if (!settled) {
							settled = true;
							resolve(bridge);
						}
					} catch (e) {
						teardown();
						if (!settled) {
							settled = true;
							reject(e instanceof Error ? e : new Error(String(e)));
						}
					}
				})();
				return;
			}

			if (data.type === 'rpc-result' && typeof data.id === 'string') {
				const p = pending.get(data.id);
				if (!p) return;
				pending.delete(data.id);
				if (data.ok) p.resolve(data.value);
				else p.reject(new Error(String(data.error ?? 'rpc failed')));
			}
		};

		const ping = () =>
			window.parent.postMessage(
				{ channel: MF_IFRAME_CHANNEL, type: 'ready', pluginId },
				'*',
			);

		window.addEventListener('message', onMessage);
		ping();
		const retry = window.setInterval(ping, 400);
	});
}
