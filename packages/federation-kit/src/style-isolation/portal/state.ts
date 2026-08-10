/**
 * Portal 收编共享状态（claim / scopeDom / bodyPatch / attach 共用）。
 * 必须挂 globalThis：kit 主入口与 ./react 双份打包时否则会各劫持一次 body，
 * release 把 orig 置空后另一份仍在调用 → origBodyRemove.call 崩。
 */
import type ReactDOM from 'react-dom';

const PORTAL_KEY = '__dnhyxc_ai_federation_portal__';

export type PortalNatives = {
	appendChild: typeof Node.prototype.appendChild;
	insertBefore: typeof Node.prototype.insertBefore;
	append: typeof Element.prototype.append;
	prepend: typeof Element.prototype.prepend;
	removeChild: typeof Node.prototype.removeChild;
	replaceChild: typeof Node.prototype.replaceChild;
	createPortal: typeof ReactDOM.createPortal;
};

type PortalBag = {
	plugins: Set<string>;
	realmByPlugin: Map<string, string>;
	state: {
		lastTouchedPluginId: string | null;
		touchBridgeInstalled: boolean;
		portalClaimOverride: string | null;
		bodyPatchBusy: boolean;
		createPortalPatched: boolean;
		bodyPortalPatched: boolean;
		portalPointerCssInstalled: boolean;
	};
	natives: PortalNatives | null;
};

type GlobalBag = typeof globalThis & {
	[PORTAL_KEY]?: PortalBag;
};

function store(): PortalBag {
	const g = globalThis as GlobalBag;
	if (!g[PORTAL_KEY]) {
		g[PORTAL_KEY] = {
			plugins: new Set(),
			realmByPlugin: new Map(),
			state: {
				lastTouchedPluginId: null,
				touchBridgeInstalled: false,
				portalClaimOverride: null,
				bodyPatchBusy: false,
				createPortalPatched: false,
				bodyPortalPatched: false,
				portalPointerCssInstalled: false,
			},
			natives: null,
		};
	}
	return g[PORTAL_KEY]!;
}

/** 与 store 同源的共享引用（各入口 import 后仍是同一 Set / 对象） */
export const portalPlugins = store().plugins;
export const portalRealmByPlugin = store().realmByPlugin;
export const portalState = store().state;

export function getPortalNatives(): PortalNatives | null {
	return store().natives;
}

export function setPortalNatives(natives: PortalNatives | null): void {
	store().natives = natives;
}
