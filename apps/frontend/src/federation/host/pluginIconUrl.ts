import type { PluginRegistry } from '@dnhyxc-ai/federation-kit';

/** registry `icon` 是否按图片 URL 渲染（非 Lucide 名） */
export function isPluginIconUrl(value?: string | null): boolean {
	const v = value?.trim();
	if (!v) return false;
	return (
		/^https?:\/\//i.test(v) ||
		v.startsWith('/ext-cos/') ||
		v.startsWith('/remotes/')
	);
}

/**
 * 把上传得到的 URL 写入指定插件的 menu.icon / host.icon（有则写）。
 * 二者皆无则返回 wrote: []，调用方应提示失败。
 */
export function applyPluginIconUrl(
	data: PluginRegistry,
	pluginId: string,
	url: string,
): { next: PluginRegistry; wrote: Array<'menu' | 'host'> } {
	const wrote: Array<'menu' | 'host'> = [];
	const plugins = data.plugins.map((p) => {
		if (p.id !== pluginId) return p;
		let next = p;
		if (p.menu) {
			next = { ...next, menu: { ...p.menu, icon: url } };
			wrote.push('menu');
		}
		if (p.host) {
			next = {
				...next,
				host: { ...p.host, icon: url },
			};
			wrote.push('host');
		}
		return next;
	});
	return { next: { ...data, plugins }, wrote };
}
