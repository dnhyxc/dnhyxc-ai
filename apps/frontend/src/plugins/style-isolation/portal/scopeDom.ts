/**
 * Portal scope DOM：全屏 overlay 容器、realm 打标、pointer-events CSS。
 */
import { cssEscapeIdent } from '../protocol';
import { resolveClaimPluginId } from './claim';
import { portalRealmByPlugin, portalState } from './state';

/**
 * Portal overlay 根：全屏 fixed + pointer-events:none（点击穿透到主界面），
 * 子树由 ensurePortalPointerCss 恢复事件。
 */
const PORTAL_SCOPE_STYLE =
	'position:fixed;inset:0;width:100%;height:100%;margin:0;padding:0;overflow:visible;pointer-events:none;z-index:2147503646;';

function ensurePortalPointerCss() {
	if (
		portalState.portalPointerCssInstalled ||
		typeof document === 'undefined'
	) {
		return;
	}
	portalState.portalPointerCssInstalled = true;
	const style = document.createElement('style');
	style.dataset.mfHostStyle = '1';
	style.textContent = '[data-mf-portal-scope]>*{pointer-events:auto;}';
	document.head.appendChild(style);
}

/** body 弹层节点打上 realm，使 `[realm].el-popper` 自身选择器生效 */
export function stampRealmOnPortalNode(node: Node) {
	if (node instanceof DocumentFragment) {
		for (const child of node.childNodes) stampRealmOnPortalNode(child);
		return;
	}
	if (!(node instanceof HTMLElement)) return;
	const id = resolveClaimPluginId();
	const realm = id ? portalRealmByPlugin.get(id) : undefined;
	if (!realm) return;
	node.setAttribute('data-mf-style-realm', realm);
	if (id) node.setAttribute('data-mf-plugin', id);
}

/** 获取或创建 body 上某插件的 portal scope 容器 */
export function ensureBodyPortalScope(pluginId: string): HTMLElement {
	ensurePortalPointerCss();
	const sel = `[data-mf-portal-scope="${cssEscapeIdent(pluginId)}"]`;
	let el = document.querySelector(sel) as HTMLElement | null;
	const realm = portalRealmByPlugin.get(pluginId);
	if (el) {
		if (realm && el.getAttribute('data-mf-style-realm') !== realm) {
			el.setAttribute('data-mf-style-realm', realm);
		}
		el.style.cssText = PORTAL_SCOPE_STYLE;
		return el;
	}
	el = document.createElement('div');
	el.setAttribute('data-mf-plugin', pluginId);
	if (realm) el.setAttribute('data-mf-style-realm', realm);
	el.setAttribute('data-mf-portal-scope', pluginId);
	el.dataset.mfPortalStamp = '1';
	el.style.cssText = PORTAL_SCOPE_STYLE;
	portalState.bodyPatchBusy = true;
	try {
		document.body.appendChild(el);
	} finally {
		portalState.bodyPatchBusy = false;
	}
	return el;
}

export function removeBodyPortalScope(pluginId: string) {
	document
		.querySelector(`[data-mf-portal-scope="${cssEscapeIdent(pluginId)}"]`)
		?.remove();
}
