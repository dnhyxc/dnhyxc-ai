import { notifyPluginEnabled } from '../enabled/enabledOverrides';
import { satisfiesRange } from '../runtime/PluginVerifier';
import type { PluginRegistry } from '../types';

export function formatRegistryUpdatedAt(d = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function readRegistryCache(cacheKey: string): PluginRegistry | null {
	try {
		const cached = localStorage.getItem(cacheKey);
		if (!cached) return null;
		const data = JSON.parse(cached) as PluginRegistry;
		if (!Array.isArray(data.plugins) || data.plugins.length === 0) return null;
		return data;
	} catch {
		return null;
	}
}

export function writeRegistryCache(cacheKey: string, data: PluginRegistry) {
	try {
		localStorage.setItem(cacheKey, JSON.stringify(data));
	} catch {
		/* ignore */
	}
	notifyPluginEnabled();
}

export function clearRegistryCache(cacheKey: string) {
	try {
		localStorage.removeItem(cacheKey);
	} catch {
		/* ignore */
	}
	notifyPluginEnabled();
}

export function assertRegistryHostApiCompatible(
	data: PluginRegistry,
	hostApiVersion: string,
	translate?: (key: string, params?: Record<string, string>) => string,
): void {
	const t = (key: string, params?: Record<string, string>) =>
		translate?.(key, params) ?? key;
	for (const p of data.plugins) {
		const range = p.hostApiRange?.trim();
		if (!range) {
			throw new Error(t('plugins.registry.missingHostApiRange', { id: p.id }));
		}
		if (!satisfiesRange(hostApiVersion, range)) {
			throw new Error(
				t('plugins.registry.hostApiIncompatible', {
					id: p.id,
					range,
					hostApi: hostApiVersion,
				}),
			);
		}
	}
}
