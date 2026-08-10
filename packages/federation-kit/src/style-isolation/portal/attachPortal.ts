/**
 * 插件挂载期 Portal 桥：注册插件、建 scope、收回 EP orphan popper。
 */

import {
	ensureBodyPortalPatch,
	ensureCreatePortalPatch,
	maybeReleaseBodyPortalPatch,
} from './bodyPatch';
import { ensureTouchBridge } from './claim';
import { ensureBodyPortalScope, removeBodyPortalScope } from './scopeDom';
import { portalPlugins, portalRealmByPlugin, portalState } from './state';

/**
 * Element Plus 等会先在 body 建 `#*-popper-container-*`，再 Teleport 进该容器。
 * attach 时把已游离的容器收进当前插件的 portal scope。
 */
function reclaimOrphanPopperContainers(pluginId: string) {
	const scope = ensureBodyPortalScope(pluginId);
	for (const node of Array.from(document.body.children)) {
		if (!(node instanceof HTMLElement)) continue;
		if (!/-popper-container-/i.test(node.id || '')) continue;
		if (node.closest('[data-mf-portal-scope]')) continue;
		scope.appendChild(node);
	}
}

export function attachPortalScopeBridge(
	pluginId: string,
	realm: string,
): () => void {
	ensureTouchBridge();
	ensureCreatePortalPatch();
	ensureBodyPortalPatch();
	portalPlugins.add(pluginId);
	portalRealmByPlugin.set(pluginId, realm);
	portalState.lastTouchedPluginId = pluginId;
	ensureBodyPortalScope(pluginId);
	reclaimOrphanPopperContainers(pluginId);
	return () => {
		portalPlugins.delete(pluginId);
		portalRealmByPlugin.delete(pluginId);
		removeBodyPortalScope(pluginId);
		if (portalState.lastTouchedPluginId === pluginId) {
			portalState.lastTouchedPluginId = null;
		}
		maybeReleaseBodyPortalPatch();
	};
}
