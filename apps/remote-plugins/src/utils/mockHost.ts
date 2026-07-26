/** 独立预览用假 HostBridge；嵌入主站时由 Host 注入真 api */
export function mockApi(extra?: Record<string, unknown>) {
	return {
		theme: 'light' as const,
		// 不传 locale：独立预览用本地 useI18n；插件模式由 Host 注入
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
