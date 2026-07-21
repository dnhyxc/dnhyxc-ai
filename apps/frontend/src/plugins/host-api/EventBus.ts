type Handler = (data?: unknown) => void;

class EventBusImpl {
	private listeners = new Map<string, Set<Handler>>();
	private byPlugin = new Map<string, Set<string>>();

	on(pluginId: string, event: string, handler: Handler) {
		const key = `${pluginId}:${event}`;
		let set = this.listeners.get(key);
		if (!set) {
			set = new Set();
			this.listeners.set(key, set);
		}
		set.add(handler);
		let events = this.byPlugin.get(pluginId);
		if (!events) {
			events = new Set();
			this.byPlugin.set(pluginId, events);
		}
		events.add(event);
	}

	off(pluginId: string, event: string, handler: Handler) {
		this.listeners.get(`${pluginId}:${event}`)?.delete(handler);
	}

	emit(pluginId: string, event: string, data?: unknown) {
		const set = this.listeners.get(`${pluginId}:${event}`);
		if (!set) return;
		for (const h of set) {
			try {
				h(data);
			} catch (e) {
				console.error('[EventBus] handler error', pluginId, event, e);
			}
		}
	}

	clearPlugin(pluginId: string) {
		const events = this.byPlugin.get(pluginId);
		if (!events) return;
		for (const event of events) {
			this.listeners.delete(`${pluginId}:${event}`);
		}
		this.byPlugin.delete(pluginId);
	}
}

export const eventBus = new EventBusImpl();
