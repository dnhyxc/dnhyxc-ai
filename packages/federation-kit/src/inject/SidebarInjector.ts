import type { PluginSidebarItem } from '../types';

type Listener = () => void;

const SIDEBAR_KEY = '__dnhyxc_ai_federation_sidebar__';

export class SidebarInjector {
	private _items: PluginSidebarItem[] = [];
	private listeners = new Set<Listener>();

	get items() {
		return this._items;
	}

	add(item: PluginSidebarItem) {
		const prev = this._items.find((x) => x.pluginId === item.pluginId);
		if (
			prev &&
			prev.path === item.path &&
			prev.nameKey === item.nameKey &&
			prev.icon === item.icon &&
			prev.order === item.order
		) {
			return;
		}
		this._items = [
			...this._items.filter((x) => x.pluginId !== item.pluginId),
			item,
		].sort((a, b) => a.order - b.order);
		this.notify();
	}

	remove(pluginId: string) {
		const next = this._items.filter((x) => x.pluginId !== pluginId);
		if (next.length === this._items.length) return;
		this._items = next;
		this.notify();
	}

	subscribe(fn: Listener) {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	}

	private notify() {
		for (const fn of this.listeners) fn();
	}
}

type GlobalBag = typeof globalThis & {
	[SIDEBAR_KEY]?: SidebarInjector;
};

function getSidebar(): SidebarInjector {
	const g = globalThis as GlobalBag;
	if (!g[SIDEBAR_KEY]) g[SIDEBAR_KEY] = new SidebarInjector();
	return g[SIDEBAR_KEY]!;
}

/** 跨入口共享侧栏注入器 */
export const sidebarInjector = new Proxy({} as SidebarInjector, {
	get(_t, prop, _receiver) {
		const s = getSidebar();
		const value = Reflect.get(s, prop, s);
		return typeof value === 'function' ? value.bind(s) : value;
	},
});
