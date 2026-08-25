import type { AccentId, ThemeName } from '@/hooks/theme';
import type { Locale } from '@/i18n';

export const HOST_APPEARANCE_CHANNEL = 'dnhyxc-host-appearance-v1';

export type HostAppearancePayload =
	| { kind: 'theme'; value: ThemeName }
	| { kind: 'accent'; value: AccentId }
	| { kind: 'locale'; value: Locale };

let appearanceChannel: BroadcastChannel | null = null;

function getAppearanceChannel(): BroadcastChannel | null {
	if (typeof BroadcastChannel === 'undefined') return null;
	if (!appearanceChannel) {
		appearanceChannel = new BroadcastChannel(HOST_APPEARANCE_CHANNEL);
	}
	return appearanceChannel;
}

export function broadcastHostAppearance(payload: HostAppearancePayload): void {
	getAppearanceChannel()?.postMessage(payload);
}

export function subscribeHostAppearance(
	handler: (payload: HostAppearancePayload) => void,
): () => void {
	const ch = getAppearanceChannel();
	if (!ch) return () => {};
	const fn = (ev: MessageEvent<HostAppearancePayload>) => {
		const data = ev.data;
		if (!data || typeof data !== 'object' || !('kind' in data)) return;
		handler(data);
	};
	ch.addEventListener('message', fn);
	return () => ch.removeEventListener('message', fn);
}
