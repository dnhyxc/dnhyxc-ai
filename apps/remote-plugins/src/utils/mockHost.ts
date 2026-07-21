/** 独立预览用假 HostBridge；嵌入主站时由 Host 注入真 api */
export function mockApi(extra?: Record<string, unknown>) {
	return {
		t: (k: string) => k,
		theme: 'light' as const,
		event: {
			on: () => undefined,
			off: () => undefined,
			emit: () => undefined,
		},
		ui: {
			showToast: (o: { message: string }) => console.info('[toast]', o.message),
		},
		...extra,
	};
}

export function mockPlugin(id: string, routePath: string, version = '1.0.0') {
	return { id, version, routePath };
}
