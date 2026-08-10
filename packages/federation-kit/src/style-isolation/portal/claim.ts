/**
 * Portal 认领：pointer/focus 桥、override claim、resolveClaimPluginId。
 */
import { cssEscapeIdent } from '../protocol';
import {
	ensureBodyPortalPatch,
	ensureCreatePortalPatch,
	maybeReleaseBodyPortalPatch,
} from './bodyPatch';
import { ensureBodyPortalScope } from './scopeDom';
import { portalPlugins, portalRealmByPlugin, portalState } from './state';

function claimIdFromElement(el: Element | null): string | null {
	if (!el) return null;
	const scope = el.closest('[data-mf-portal-scope]');
	if (scope) {
		const id = scope.getAttribute('data-mf-portal-scope');
		if (id && portalPlugins.has(id)) return id;
	}
	const root = el.closest(
		'[data-mf-plugin]:not([data-mf-portal-stamp]):not([data-mf-portal-scope])',
	);
	const id = root?.getAttribute('data-mf-plugin');
	return id && portalPlugins.has(id) ? id : null;
}

/** 安装 pointer/focus 桥：更新 lastTouchedPluginId 供 Portal 认领 */
export function ensureTouchBridge() {
	if (portalState.touchBridgeInstalled || typeof document === 'undefined') {
		return;
	}
	portalState.touchBridgeInstalled = true;

	document.addEventListener(
		'pointerover',
		(e) => {
			const to = claimIdFromElement(
				e.target instanceof Element ? e.target : null,
			);
			const from = claimIdFromElement(
				e.relatedTarget instanceof Element ? e.relatedTarget : null,
			);
			if (to === from) return;
			portalState.lastTouchedPluginId = to;
		},
		true,
	);
	document.addEventListener(
		'focusin',
		(e) => {
			portalState.lastTouchedPluginId = claimIdFromElement(
				e.target instanceof Element ? e.target : null,
			);
		},
		true,
	);
}

/** override → touch → focus → sticky hover */
export function resolveClaimPluginId(): string | null {
	const override = portalState.portalClaimOverride;
	if (
		override &&
		(portalPlugins.has(override) || portalRealmByPlugin.has(override))
	) {
		return override;
	}
	const touched = portalState.lastTouchedPluginId;
	if (touched && portalPlugins.has(touched)) return touched;

	const ae = document.activeElement;
	if (ae instanceof Element) {
		const id = claimIdFromElement(ae);
		if (id) return id;
	}

	for (const id of portalPlugins) {
		const host = document.querySelector(
			`[data-mf-portal-scope="${cssEscapeIdent(id)}"]`,
		);
		if (
			host instanceof HTMLElement &&
			host.childElementCount > 0 &&
			(host.matches(':hover') || host.querySelector(':hover'))
		) {
			return id;
		}
	}
	return null;
}

/**
 * Host 打开会 Portal 的外壳（如 Drawer）之前同步认领，
 * 让首帧 createPortal 就进 scope。
 */
export function claimPluginPortalTarget(pluginId: string, realm: string): void {
	ensureTouchBridge();
	ensureCreatePortalPatch();
	ensureBodyPortalPatch();
	portalRealmByPlugin.set(pluginId, realm);
	portalState.portalClaimOverride = pluginId;
	portalState.lastTouchedPluginId = pluginId;
	ensureBodyPortalScope(pluginId);
}

export function clearPluginPortalClaim(pluginId?: string | null): void {
	if (pluginId && portalState.portalClaimOverride !== pluginId) return;
	portalState.portalClaimOverride = null;
	maybeReleaseBodyPortalPatch();
}
