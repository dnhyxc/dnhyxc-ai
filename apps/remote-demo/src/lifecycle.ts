type HostApi = {
	event: {
		on: (event: string, handler: (data?: unknown) => void) => void;
		off: (event: string, handler: (data?: unknown) => void) => void;
	};
	ui?: { showToast: (options: { message: string }) => void };
};

/** Host 会经 eventBus 推 locale；订阅须在 deactivate 里卸掉 */
let offLocale: (() => void) | undefined;

export async function activate(api: HostApi) {
	const onLocale = (data?: unknown) => {
		console.info('[remoteDemo] locale', data);
	};
	api.event.on('locale', onLocale);
	offLocale = () => api.event.off('locale', onLocale);

	api.ui?.showToast({ message: 'Remote Demo activated' });
}

export async function deactivate() {
	console.log('deactivate remoteDemo');
	offLocale?.();
	offLocale = undefined;
}
