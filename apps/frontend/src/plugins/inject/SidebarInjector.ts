import type { PluginSidebarItem } from '../core/types';

type Listener = () => void;

class SidebarInjectorImpl {
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

export const sidebarInjector = new SidebarInjectorImpl();
